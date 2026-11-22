// The reels the service makes: each is checked, given an id nobody can guess, recorded in
// the background, and deleted after KEEP_DAYS. One job runs at a time, since recording a
// voice and drawing a video both keep a processor busy. Everything lives in the store
// (store.mjs); a job copies what it needs to a folder of its own and puts the results back.
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reelFromData } from '../src/format.js';
import { clipLookup, ReelError } from '../src/reel.js';
import { limitProblems } from './limits.mjs';
import { paceReel } from './pacing.mjs';
import { narrationMs, timeline } from '../src/timing.js';

/** How long a reel is kept before it is deleted, unless someone deletes it sooner. */
export const KEEP_DAYS = 30;

const ID = /^[A-Za-z0-9_-]{22}$/;

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

/** Records the voice for the reel in folder `dir`, with npm run voices (Pocket TTS, voice peter_yearsley). */
async function recordVoices(dir, log) {
  const { main } = await import('../scripts/voices.mjs');
  await main([dir], { log });
}

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
   * @param {(dir: string, log: Function) => Promise<void>} [options.record]   records a folder's voices
   * @param {(dir: string, out: string) => Promise<void>} [options.video]   draws a folder's reel as an MP4
   * @param {(raw: object) => Promise<Uint8Array>} [options.picture]   draws a reel's picture for link previews, as a PNG
   */
  constructor({ store, record = recordVoices, video = drawVideo, picture = drawPicture, now = () => Date.now(), keepDays = KEEP_DAYS, maxQueue = 20, log = () => {} }) {
    Object.assign(this, { store, record, video, picture, now, keepDays, maxQueue, log });
    this.queue = [];
    this.running = null;
  }

  /**
   * Checks a reel (parsed reel.json) and starts recording it. Throws a ReelError if it has
   * problems or is past the service's limits, or a BusyError if too many jobs are waiting.
   */
  async create(raw) {
    const reel = reelFromData(raw);
    const over = limitProblems(reel, raw);
    if (over.length) throw new ReelError(over);
    if (this.queue.length >= this.maxQueue) throw new BusyError();
    const id = newId(), created = this.now();
    const status = {
      id,
      title: reel.title,
      scenes: reel.scenes.length,
      state: 'queued',
      seconds: Math.round(timeline(reel.scenes.map((s) => narrationMs(s, null))).total / 1000),
      created: new Date(created).toISOString(),
      expires: new Date(created + this.keepDays * 86400000).toISOString(),
      video: 'none'
    };
    await this.store.put(`reels/${id}/reel.json`, JSON.stringify(raw));
    await this.save(status);
    this.enqueue({ id, kind: 'voice' });
    return status;
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
    if (!(await this.status(id))) return null;
    const key = `reels/${id}/card.png`;
    const kept = await this.store.get(key);
    if (kept) return kept;
    try {
      const png = Buffer.from(await this.picture(await this.reel(id)));
      if (await this.status(id)) await this.store.put(key, png);   // not if it was deleted meanwhile
      return png;
    } catch (err) {
      this.log(`${id}: its picture could not be drawn: ${err.stack ?? err}`);
      return null;
    }
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

  /** After a restart: queues again every job that was waiting or under way. */
  async resume() {
    for (const id of await this.store.folders('reels')) {
      const status = await this.status(id);
      if (!status) continue;
      if (status.state === 'queued' || status.state === 'recording') this.enqueue({ id, kind: 'voice' });
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
      if (name === 'status.json' || name === 'video.mp4' || name === 'card.png') continue;
      await mkdir(join(dir, name, '..'), { recursive: true });
      await writeFile(join(dir, name), await this.store.get(key));
    }
    return dir;
  }

  async run({ id, kind }) {
    if (!(await this.status(id))) return;
    const dir = await this.checkOut(id);
    try {
      if (kind === 'voice') {
        await this.update(id, { state: 'recording' });
        try {
          await this.record(dir, (line) => this.log(`${id}: ${line}`));
          if (!(await this.status(id))) return;   // deleted while it was recording
          for (const name of await readdir(join(dir, 'audio'))) {
            await this.store.put(`reels/${id}/audio/${name}`, await readFile(join(dir, 'audio', name)));
          }
          // now the voice has a length, the pictures are timed to it: the page, the player in the chat and the video all play this
          const manifest = await this.manifest(id), raw = paceReel(await this.reel(id), manifest);
          await this.store.put(`reels/${id}/reel.json`, JSON.stringify(raw));
          const reel = reelFromData(raw), clipFor = clipLookup(manifest);
          const seconds = Math.round(timeline(reel.scenes.map((s) => narrationMs(s, clipFor(s)))).total / 1000);
          await this.update(id, { state: 'ready', seconds });
        } catch (err) {
          this.log(`${id}: recording failed: ${err.stack ?? err}`);
          await this.update(id, { state: 'failed', error: 'The voice could not be recorded. Try again in a while.' });
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
