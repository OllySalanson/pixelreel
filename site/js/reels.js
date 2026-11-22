// Loads the reels the site plays: /reels/<name>/reel.json and its recordings. They are
// plain data, checked by the player's own checks, so nothing in them ever runs.
import { reelFromData } from '../../src/format.js';
import { clipLookup } from '../../src/reel.js';
import { narrationMs, timeline } from '../../src/timing.js';

const loading = new Map();

/**
 * A reel ready to play: { name, reel, clipFor, durations, line, opens }. `source` is the
 * reel's JSON, as text or already read; `manifest` its recordings ({ clips: [...] } or null),
 * whose files are found under `audioBase`.
 */
export function showOf(name, source, manifest, audioBase = '') {
  const raw = typeof source === 'string' ? JSON.parse(source) : source;
  const reel = reelFromData(raw);
  const clipFor = clipLookup(manifest, audioBase);
  const durations = reel.scenes.map((s) => narrationMs(s, clipFor(s)));
  // the kind of picture the reel opens on, so the Play button can keep off a title's words
  const opens = raw.scenes[0]?.picture?.type ?? 'card';
  return { name, reel, clipFor, durations, line: timeline(durations), opens };
}

async function fetchReel(name) {
  const base = `/reels/${name}/`;
  const [text, manifest] = await Promise.all([
    fetch(`${base}reel.json`).then((res) => {
      if (!res.ok) throw new Error(`There is no reel called "${name}".`);
      return res.text();
    }),
    fetch(`${base}audio/manifest.json`).then((res) => (res.ok ? res.json() : null)).catch(() => null)
  ]);
  return showOf(name, text, manifest, `${base}audio/`);
}

/**
 * The reel called `name` in reels/, ready to play (see showOf). Each reel is fetched once,
 * however many players and pictures ask for it.
 */
export function loadReel(name) {
  if (!loading.has(name)) {
    loading.set(name, fetchReel(name).catch((err) => { loading.delete(name); throw err; }));
  }
  return loading.get(name);
}

/** How long something lasts, for people: "39 seconds", "1 minute 16". */
export function lengthWords(ms) {
  const s = Math.floor(ms / 1000);   // whole seconds, as the player's clock counts them, so a reel has one length everywhere
  if (s < 60) return `${s} seconds`;
  return `${Math.floor(s / 60)} minute${s >= 120 ? 's' : ''}${s % 60 ? ` ${s % 60}` : ''}`;
}

/**
 * What a reel's page shows while the reel is not ready: { sign, words, part }. `play` is
 * what the service says of it (its state, and how far it has got); `waited` is how many
 * seconds the page has been waiting. `sign` is a word or two for the screen, `words` a
 * plain sentence, and `part` how much of the making is done, from 0 to 1 (null when it
 * cannot be known). Making a reel is two jobs, each about half of the wait: Claude writes
 * it, which gives no sign of how far along it is, then Peter records it, a scene at a time.
 */
export function waitingFor(play, waited = 0) {
  switch (play.state) {
    case 'writing':
      // it creeps towards half way, quickly at first, and never gets there by itself
      return { sign: 'WRITING', words: 'Claude is reading it and writing the scenes. This takes about half a minute.', part: 0.45 * (1 - Math.exp(-Math.max(0, waited) / 14)) };
    case 'queued':
      return { sign: 'WRITTEN', words: play.ahead > 0 ? `It is written. Peter has ${play.ahead === 1 ? 'one reel' : `${play.ahead} reels`} to record first.` : 'It is written. Peter is about to record it.', part: 0.5 };
    case 'recording': {
      // the service counts the lines Peter has said, of how many: one a scene, as a rule
      const known = play.lines > 0 && Number.isInteger(play.recorded);
      const done = known ? Math.min(play.recorded, play.lines) : 0;
      return known
        ? { sign: 'RECORDING', words: `Peter is recording scene ${Math.min(done + 1, play.lines)} of ${play.lines}.`, part: 0.5 + 0.5 * done / play.lines }
        : { sign: 'RECORDING', words: 'Peter is recording it. It will play here in a moment.', part: 0.75 };
    }
    default:
      return { sign: 'ONE MOMENT', words: 'Trying to reach Pixel Reel. One moment.', part: null };
  }
}

