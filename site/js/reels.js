// Loads the reels the site plays: /reels/<name>/reel.json and its recordings. They are
// plain data, checked by the player's own checks, so nothing in them ever runs.
import { parseReelJson } from '../../src/format.js';
import { clipLookup } from '../../src/reel.js';
import { narrationMs, timeline } from '../../src/timing.js';

const loading = new Map();

async function fetchReel(name) {
  const base = `/reels/${name}/`;
  const [text, manifest] = await Promise.all([
    fetch(`${base}reel.json`).then((res) => {
      if (!res.ok) throw new Error(`There is no reel called "${name}".`);
      return res.text();
    }),
    fetch(`${base}audio/manifest.json`).then((res) => (res.ok ? res.json() : null)).catch(() => null)
  ]);
  const reel = parseReelJson(text);
  const clipFor = clipLookup(manifest, `${base}audio/`);
  const durations = reel.scenes.map((s) => narrationMs(s, clipFor(s)));
  return { name, reel, clipFor, durations, line: timeline(durations) };
}

/**
 * The reel called `name`, ready to play: { name, reel, clipFor, durations, line }. Each reel
 * is fetched once, however many players and pictures ask for it.
 */
export function loadReel(name) {
  if (!loading.has(name)) {
    loading.set(name, fetchReel(name).catch((err) => { loading.delete(name); throw err; }));
  }
  return loading.get(name);
}

/** How long something lasts, for people: "39 seconds", "1 minute 16". */
export function lengthWords(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} seconds`;
  return `${Math.floor(s / 60)} minute${s >= 120 ? 's' : ''}${s % 60 ? ` ${s % 60}` : ''}`;
}
