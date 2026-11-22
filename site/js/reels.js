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
