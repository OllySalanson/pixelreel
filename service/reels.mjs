// The reels the service makes: each is checked, given an id nobody can guess, recorded in
// the background, and deleted after KEEP_DAYS. One job runs at a time, since recording a
// voice and drawing a video both keep a processor busy. Everything lives in the store
// (store.mjs); a job copies what it needs to a folder of its own and puts the results back.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reelFromData } from '../src/format.js';
import { clipLookup, ReelError } from '../src/reel.js';
import { staysAhead } from './ahead.mjs';
import { limitProblems, peterMs, reelMs } from './limits.mjs';
import { paceReel } from './pacing.mjs';
import { narrationMs, timeline } from '../src/timing.js';

/** How long a reel is kept before it is deleted, unless someone deletes it sooner. */
export const KEEP_DAYS = 30;

const ID = /^[A-Za-z0-9_-]{22}$/;

/** The file, beside a reel's own, that holds what its owner's key hashes to (begin() and owns()). */
const OWNER = 'owner.txt';

/** A recording the recorder made and named itself (scripts/voices.mjs), which it will know again by its name. */
const MADE_CLIP = /^[0-9a-f]{16}\.mp3$/;

/** Too many jobs are waiting: the reel is not made, and the person should try again soon. */
export class BusyError extends Error {
  constructor() {
    super('Pixel Reel is busy recording other reels. Try again in a few minutes.');
    this.name = 'BusyError';
  }
}

/** A new reel id: 16 random bytes, so a link to a reel cannot be guessed. */
export const newId = () => randomBytes(16).toString('base64url');

/** True for something shaped like a reel id. */
export const isId = (id) => typeof id === 'string' && ID.test(id);

/**
 * A recorder: records the voice for the reel in folder `dir`, with npm run voices (Pocket TTS,
 * voice peter_yearsley), telling `onLine(done, of, clip)` as each line is recorded: how many
 * are done of how many, and the recording ({ text, file, seconds }), by then in the folder's
 * audio/. Its last argument may name the `language` the words are in, if not English, and the
 * `voice` to read them in, if not the usual one. With a `speaker` (a WarmVoice's, service/voice.mjs) the lines are spoken by a voice kept loaded.
 */
export const recordWith = (speaker = null) => async (dir, log, onLine, { language = null, voice = null } = {}) => {
  const { main } = await import('../scripts/voices.mjs');
  const choices = [...(language ? ['--lang', language] : []), ...(voice ? ['--voice', voice] : [])];
  await main([dir, ...choices], { log, onClip: (clip, { done, of }) => onLine(done, of, clip), ...(speaker ? { speaker } : {}) });
};

/**
 * The narrators besides Peter that a service may offer, by the first name people ask for
 * them by, and the Pocket TTS voice each one is. All speak British English.
 */
export const NARRATORS = { anna: 'anna', vera: 'vera', stuart: 'stuart_bell', charles: 'charles', paul: 'paul' };

/** A language's name, or a narrator's, as it is written in a sentence: french is French, anna is Anna. */
export const languageName = (language) => language[0].toUpperCase() + language.slice(1);

/** Draws a reel's own picture for link previews, from its reel.json, parsed. Resolves to a PNG. */
async function drawPicture(raw) {
  const { drawCard } = await import('./card.mjs');
  return drawCard(raw);
}

/** Draws the reel in folder `dir` into the MP4 `out`, with npm run video. */
async function drawVideo(dir, out) {
  const { renderVideo } = await import('../scripts/video.mjs');
  await renderVideo(dir, out, { fps: 20, scale: 4 });
}

export class Reels {
  /**
   * @param {object} options
   * @param {import('./store.mjs').DiskStore} options.store   where reels are kept
   * @param {(dir: string, log: Function, onLine: (done: number, of: number, clip?: object) => void) => Promise<void>} [options.record]   records a folder's voices, saying as each line is done
   * @param {(dir: string, out: string) => Promise<void>} [options.video]   draws a folder's reel as an MP4
   * @param {(raw: object) => Promise<Uint8Array>} [options.picture]   draws a reel's picture for link previews, as a PNG
   * @param {string[]} [options.languages]   the languages besides English the narrator can read here (those whose voice models are to hand)
   * @param {string[]} [options.narrators]   the narrators besides Peter that may be asked for here, by first name (see NARRATORS)
   */
  constructor({ store, record = recordWith(), video = drawVideo, picture = drawPicture, now = () => Date.now(), keepDays = KEEP_DAYS, maxQueue = 20, languages = [], narrators = [], log = () => {} }) {
    Object.assign(this, { store, record, video, picture, now, keepDays, maxQueue, languages, narrators, log });
    this.queue = [];
    this.running = null;
    this.notes = new Map();   // how far each reel that is still being written has got: note()
  }

  /** A reel (parsed reel.json) checked: the reel, or a ReelError if it has problems or is past the service's limits. */
  check(raw) {
    const reel = reelFromData(raw);
    const over = limitProblems(reel, raw);
    if (over.length) throw new ReelError(over);
    return reel;
  }

  /** What a reel's status begins as: an id nobody can guess, and the day it will be deleted. */
  blank(title, state) {
    const created = this.now();
    return {
      id: newId(),
      title,
      scenes: 0,
      state,
      seconds: 0,
      created: new Date(created).toISOString(),
      expires: new Date(created + this.keepDays * 86400000).toISOString(),
      video: 'none'
    };
  }

  /** What is known of a reel once its scenes are: how many, and about how long it will run. */
  measure(reel) {
    return { title: reel.title, scenes: reel.scenes.length, seconds: Math.round(reelMs(reel) / 1000) };
  }

  /**
   * Checks a reel (parsed reel.json) and starts recording it. Throws a ReelError if it has
   * problems or is past the service's limits, or a BusyError if too many jobs are waiting.
   * `improves` is the id of an earlier reel this one is a change to: the lines the two share
   * keep their recordings, so only what changed is recorded (`kept` in its status says how
   * many). The earlier reel need not be recorded yet: it will be by the time this one's turn comes.
   * `language` is the language its words are in, for the narrator to read it in: one of `languages`, or English.
   * `narrator` is who reads it, by first name: one of `narrators`, or Peter.
   */
  async create(raw, { improves = null, language = null, narrator = null } = {}) {
    const reel = this.check(raw);
    const who = narrator && narrator !== 'peter' ? narrator : null;
    if (who && !(this.narrators.includes(who) && NARRATORS[who])) {
      throw new ReelError([`narrator: the narrators here are ${['Peter', ...this.narrators.map(languageName)].join(', ')}, not ${JSON.stringify(narrator)}. Leave it out for Peter.`]);
    }
    const spoken = language && language !== 'english' ? language : null;
    if (spoken && !this.languages.includes(spoken)) {
      throw new ReelError([`language: Peter reads ${['English', ...this.languages.map(languageName)].join(', ')} here, not ${JSON.stringify(language)}. Write the reel in English, and tell the person so.`]);
    }
    if (this.queue.length >= this.maxQueue) throw new BusyError();
    const status = { ...this.blank(reel.title, 'queued'), ...this.measure(reel) };
    await this.store.put(`reels/${status.id}/reel.json`, JSON.stringify(raw));
    const kept = await this.shared(improves, reel, { language: spoken, narrator: who });
    if (kept) Object.assign(status, { improves, kept });   // its recordings are fetched when this one's turn comes (run)
    if (spoken) status.language = spoken;
    if (who) status.narrator = who;
    await this.save(status);
    this.enqueue({ id: status.id, kind: 'voice' });
    // with nothing else in hand its recording has begun already, and whoever asked is told so
    return this.running?.id === status.id ? { ...status, state: 'recording' } : status;
  }

  /**
   * How many of a checked reel's lines the earlier reel `from` also says, word for word, in the
   * same language and the same voice. None if `from` is not a reel.
   */
  async shared(from, reel, { language = null, narrator = null } = {}) {
    const earlier = await this.status(from);
    if (!earlier || (earlier.language ?? null) !== language || (earlier.narrator ?? null) !== narrator) return 0;
    let before;
    try { before = reelFromData(await this.reel(from)); } catch { return 0; }   // not written yet
    const said = new Set(before.scenes.map((scene) => scene.say));
    return new Set(reel.scenes.map((scene) => scene.say).filter((line) => said.has(line))).size;
  }

  /**
   * Gives reel `to` the recordings reel `from` has of `lines` (the words `to` says), so the
   * recorder finds them done and records only the rest. How many it gave; none if `from`
   * has gone, or could not be recorded.
   */
  async borrow(from, to, lines) {
    const manifest = (await this.status(from))?.state === 'ready' ? await this.manifest(from) : null;
    const wanted = new Set(lines), kept = [];
    for (const clip of manifest?.clips ?? []) {
      if (!wanted.has(clip?.text) || !MADE_CLIP.test(clip.file)) continue;
      const bytes = await this.store.get(`reels/${from}/audio/${clip.file}`);
      if (!bytes) continue;
      await this.store.put(`reels/${to}/audio/${clip.file}`, bytes);
      kept.push(clip);
    }
    if (kept.length) await this.store.put(`reels/${to}/audio/manifest.json`, JSON.stringify({ ...manifest, clips: kept }));
    return kept.length;
  }

  /**
   * Starts a reel whose scenes are still being written: it has an id, and so a page to wait
   * on, at once. write() gives it its scenes, or fail() gives up on it. With `owned`, what
   * comes back has a `key` too, which is kept nowhere: whoever holds it may delete the reel
   * (owns()). Throws a BusyError if too many jobs are waiting.
   */
  async begin(title, { owned = false } = {}) {
    if (this.queue.length >= this.maxQueue) throw new BusyError();
    const status = this.blank(title, 'writing');
    await this.save(status);
    if (!owned) return status;
    // The one who began it is given a key nobody else has, and only what the key hashes to
    // is kept: with it they may delete the reel (owns()), and without it nobody may.
    const key = randomBytes(24).toString('base64url');
    await this.store.put(`reels/${status.id}/${OWNER}`, createHash('sha256').update(key).digest('hex'));
    return { ...status, key };
  }

  /** True if `key` is the one begin() gave whoever began reel `id`. */
  async owns(id, key) {
    if (!isId(id) || typeof key !== 'string' || !key) return false;
    const kept = await this.store.get(`reels/${id}/${OWNER}`);
    if (!kept) return false;
    const mine = createHash('sha256').update(key).digest(), theirs = Buffer.from(kept.toString(), 'hex');
    return mine.length === theirs.length && timingSafeEqual(mine, theirs);
  }

  /**
   * Gives a reel started with begin() its scenes (parsed reel.json) and starts recording it.
   * Throws a ReelError, leaving the reel still waiting to be written, if they have problems.
   * Null if the reel has gone, or is no longer waiting for its scenes.
   */
  async write(id, raw) {
    const reel = this.check(raw);
    const status = await this.status(id);
    if (status?.state !== 'writing') return null;
    this.notes.delete(id);
    const written = { ...status, ...this.measure(reel), state: 'queued' };
    await this.store.put(`reels/${id}/reel.json`, JSON.stringify(raw));
    await this.save(written);
    this.enqueue({ id, kind: 'voice' });
    return written;
  }

  /** Gives up on a reel started with begin(), saying why in words for whoever is waiting on its page. */
  async fail(id, error) {
    this.notes.delete(id);
    if ((await this.status(id))?.state === 'writing') await this.update(id, { state: 'failed', error });
  }

  /**
   * Notes how far the writing of a reel started with begin() has got: { title, scenes }, its
   * name once it has one and how many scenes are written. Kept in memory only, for its page
   * to show while it waits (progress()): it changes many times a second, and matters to
   * nobody once the reel is written.
   */
  note(id, { title = null, scenes = 0 }) {
    this.notes.set(id, { title, scenes });
  }

  /**
   * How far a reel that is not ready has got, for its page to show: { written, title } (how
   * many scenes Claude has written so far, and the reel's name once it has one) while it is
   * being written; { ahead } (how many jobs are before it) while it waits to be recorded;
   * or nothing. How far the recording itself has got is kept in the reel's status
   * (`recorded`, of `lines`).
   */
  progress(id) {
    const note = this.notes.get(id);
    if (note) return { written: note.scenes, ...(note.title ? { title: note.title } : {}) };
    const place = this.queue.findIndex((job) => job.id === id && job.kind === 'voice');
    return place < 0 ? {} : { ahead: place + (this.running ? 1 : 0) };
  }

  /** Where a reel is up to, or null if there is no such reel (or it has expired). */
  async status(id) {
    if (!isId(id)) return null;
    const bytes = await this.store.get(`reels/${id}/status.json`);
    if (!bytes) return null;
    const status = JSON.parse(bytes);
    if (Date.parse(status.expires) <= this.now()) return null;
    return status;
  }

  /** The reel.json a reel was made from, parsed, or null. */
  async reel(id) {
    if (!isId(id)) return null;
    const bytes = await this.store.get(`reels/${id}/reel.json`);
    return bytes ? JSON.parse(bytes) : null;
  }

  /** The recordings' manifest, or null until the voice is recorded. */
  async manifest(id) {
    if (!isId(id)) return null;
    const bytes = await this.store.get(`reels/${id}/audio/manifest.json`);
    return bytes ? JSON.parse(bytes) : null;
  }

  /**
   * A reel's own picture for a link sent in a message, as a PNG: drawn the first time it is
   * asked for, which can be before the voice is recorded, and kept with the reel. Null if
   * there is no such reel, or its picture cannot be drawn.
   */
  async card(id) {
    const status = await this.status(id);
    if (!status || status.state === 'writing') return null;   // nothing to draw until it is written
    const key = `reels/${id}/card.png`;
    const kept = await this.store.get(key);
    if (kept) return kept;
    const raw = await this.reel(id);
    if (!raw) return null;   // one that could not be written has nothing to draw either
    try {
      const png = Buffer.from(await this.picture(raw));
      if (await this.status(id)) await this.store.put(key, png);   // not if it was deleted meanwhile
      return png;
    } catch (err) {
      this.log(`${id}: its picture could not be drawn: ${err.stack ?? err}`);
      return null;
    }
  }

  /**
   * What a player can have of a reel whose voice is still being recorded, so it need not wait
   * for the last line: the reel with its pictures timed (to each line's recording, or to a
   * guess at it), the recordings so far, a guess at how long each line still to come will
   * last (`guesses`), and `playable`: whether a player that starts now would stay behind
   * the recorder (ahead.mjs). Null until there is a recording to play.
   */
  async early(id) {
    const status = await this.status(id);
    const manifest = status?.state === 'recording' ? await this.manifest(id) : null;
    if (!manifest?.clips?.length) return null;
    const raw = await this.reel(id), reel = reelFromData(raw), clipFor = clipLookup(manifest);
    const lines = reel.scenes.map((scene) => {
      const clip = clipFor(scene);
      return { text: scene.say, seconds: clip?.seconds || peterMs(scene.say) / 1000, ready: Boolean(clip) };
    });
    // how long the recorder has taken over each second of speech so far, and how long it has been at the line in hand
    const pace = status.spoken > 0 ? (status.spokenAt - status.since) / 1000 / status.spoken : NaN;
    const spent = (this.now() - (status.spokenAt ?? status.since ?? this.now())) / 1000;
    const timed = paceReel(raw, { clips: lines.map((line) => ({ text: line.text, file: 'guess', seconds: line.seconds })) });
    const guesses = lines.filter((line) => !line.ready).map(({ text, seconds }) => ({ text, seconds: Math.round(seconds * 100) / 100 }));
    return { reel: timed, clips: manifest.clips, guesses, playable: staysAhead(lines, pace, { spent }) };
  }

  /** Asks for a reel's MP4. Does nothing if it is made, being made, or the voice is not ready yet. */
  async requestVideo(id) {
    const status = await this.status(id);
    if (!status) return null;
    if (status.state === 'ready' && (status.video === 'none' || status.video === 'failed')) {
      status.video = 'queued';
      await this.save(status);
      this.enqueue({ id, kind: 'video' });
    }
    return status;
  }

  /** Deletes a reel now. True if there was one. */
  async remove(id) {
    if (!isId(id) || !(await this.store.get(`reels/${id}/status.json`))) return false;
    this.queue = this.queue.filter((job) => job.id !== id);
    await this.store.remove(`reels/${id}`);
    return true;
  }

  /** Deletes every reel past its expiry date. Returns the ids deleted. */
  async sweep() {
    const gone = [];
    for (const id of await this.store.folders('reels')) {
      if (!isId(id)) continue;
      const bytes = await this.store.get(`reels/${id}/status.json`);
      const expires = bytes ? Date.parse(JSON.parse(bytes).expires) : 0;
      if (expires <= this.now() && this.running?.id !== id) {
        await this.store.remove(`reels/${id}`);
        gone.push(id);
      }
    }
    return gone;
  }

  /**
   * After a restart: queues again every job that was waiting or under way. A reel that was
   * still being written cannot be picked up, so whoever is waiting on it is told.
   */
  async resume() {
    for (const id of await this.store.folders('reels')) {
      const status = await this.status(id);
      if (!status) continue;
      if (status.state === 'writing') await this.fail(id, 'Pixel Reel was restarted while it was being written. Make it again.');
      else if (status.state === 'queued' || status.state === 'recording') this.enqueue({ id, kind: 'voice' });
      else if (status.video === 'queued' || status.video === 'making') this.enqueue({ id, kind: 'video' });
    }
  }

  /** Stops taking jobs: resolves once the one in hand is done. resume() picks up the rest on the next start. */
  async stop() {
    this.queue = [];
    await this.running?.done;
  }

  /** Resolves once every queued job is done. */
  async idle() {
    while (this.running || this.queue.length) await this.running?.done;
  }

  async save(status) {
    await this.store.put(`reels/${status.id}/status.json`, JSON.stringify(status, null, 2));
  }

  /** Changes some of a reel's status, unless the reel has been deleted meanwhile. */
  async update(id, changes) {
    const bytes = await this.store.get(`reels/${id}/status.json`);
    if (bytes) await this.save({ ...JSON.parse(bytes), ...changes });
  }

  enqueue(job) {
    if (this.queue.some((j) => j.id === job.id && j.kind === job.kind)) return;
    this.queue.push(job);
    if (!this.running) this.next();
  }

  next() {
    const job = this.queue.shift();
    if (!job) { this.running = null; return; }
    this.running = { ...job, done: this.run(job).catch((err) => this.log(`job ${job.kind} ${job.id} failed: ${err.stack ?? err}`)).then(() => this.next()) };
  }

  /** Copies a reel's files out of the store into a folder of its own, for the tools that work on folders. */
  async checkOut(id) {
    const dir = await mkdtemp(join(tmpdir(), 'pixelreel-job-'));
    for (const key of await this.store.list(`reels/${id}`)) {
      const name = key.slice(`reels/${id}/`.length);
      if (name === 'status.json' || name === 'video.mp4' || name === 'card.png' || name === OWNER) continue;
      await mkdir(join(dir, name, '..'), { recursive: true });
      await writeFile(join(dir, name), await this.store.get(key));
    }
    return dir;
  }

  async run({ id, kind }) {
    const status = await this.status(id);
    if (!status) return;
    if (kind === 'voice' && status.improves) {
      // a change to an earlier reel: that one is recorded by now, so the lines the two share need not be said again
      const lines = reelFromData(await this.reel(id)).scenes.map((scene) => scene.say);
      const kept = await this.borrow(status.improves, id, lines);
      await this.update(id, { improves: undefined, kept: kept || undefined });
    }
    const dir = await this.checkOut(id);
    try {
      if (kind === 'voice') {
        await this.update(id, { state: 'recording' });
        // How far the recording has got, for whoever is waiting to watch; and each line's recording
        // as it is made, with how fast they are coming, so a player can start before the last one
        // (early). Kept one after another, so none lands after "ready".
        let progress = Promise.resolve();
        const since = this.now(), sofar = [...((await this.manifest(id))?.clips ?? [])];   // a change to an earlier reel starts with the lines it kept
        let spoken = 0;
        const onLine = (done, of, clip = null) => {
          progress = progress.then(async () => {
            if (!(await this.status(id))) return;   // deleted meanwhile: nothing of it is put back
            if (clip?.file && clip.seconds > 0) {
              await this.store.put(`reels/${id}/audio/${clip.file}`, await readFile(join(dir, 'audio', clip.file)));
              sofar.push({ text: clip.text, file: clip.file, seconds: clip.seconds });
              spoken += clip.seconds;
              await this.store.put(`reels/${id}/audio/manifest.json`, JSON.stringify({ clips: sofar }));
            }
            await this.update(id, { recorded: done, lines: of, since, spoken, spokenAt: this.now() });
          }).catch((err) => this.log(`${id}: could not note line ${done}: ${err.stack ?? err}`));
        };
        try {
          try {
            await this.record(dir, (line) => this.log(`${id}: ${line}`), onLine, { language: status.language ?? null, voice: NARRATORS[status.narrator] ?? null });
          } finally {
            await progress;
          }
          if (!(await this.status(id))) return;   // deleted while it was recording
          for (const name of await readdir(join(dir, 'audio'))) {
            await this.store.put(`reels/${id}/audio/${name}`, await readFile(join(dir, 'audio', name)));
          }
          // now the voice has a length, the pictures are timed to it: the page, the player in the chat and the video all play this
          const manifest = await this.manifest(id), raw = paceReel(await this.reel(id), manifest);
          await this.store.put(`reels/${id}/reel.json`, JSON.stringify(raw));
          const reel = reelFromData(raw), clipFor = clipLookup(manifest);
          const seconds = Math.round(timeline(reel.scenes.map((s) => narrationMs(s, clipFor(s)))).total / 1000);
          await this.update(id, { state: 'ready', seconds, recorded: undefined, lines: undefined, since: undefined, spoken: undefined, spokenAt: undefined });
        } catch (err) {
          this.log(`${id}: recording failed: ${err.stack ?? err}`);
          await this.update(id, { state: 'failed', error: 'The voice could not be recorded. Try again in a while.', recorded: undefined, lines: undefined, since: undefined, spoken: undefined, spokenAt: undefined });
        }
      } else {
        await this.update(id, { video: 'making' });
        try {
          const out = join(dir, 'video.mp4');
          await this.video(dir, out);
          if (await this.status(id)) await this.store.put(`reels/${id}/video.mp4`, await readFile(out));
          await this.update(id, { video: 'ready' });
        } catch (err) {
          this.log(`${id}: video failed: ${err.stack ?? err}`);
          await this.update(id, { video: 'failed' });
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
