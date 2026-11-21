// Loads a reel by name in the browser: reels/<name>/reel.js (or reel.json), checked, plus its recorded
// clips and pictures. Shared by the player (main.js) and the banner maker (export.js).
import { parseReelJson } from './format.js';
import { clipLookup, normalizeReel, REEL_NAME, ReelError } from './reel.js';

/** The text at `url`, or null if it is not there. */
async function fetchText(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function loadManifest(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;   // no recordings yet (or opened from disk): the browser's voice reads instead
  }
}

/**
 * @param {string} name   the reel's folder name under reels/
 * @returns {Promise<{ name: string, base: string, reel: object, clipFor: Function, images: Record<string, HTMLImageElement> }>}
 */
export async function loadReel(name) {
  if (!REEL_NAME.test(name ?? '')) throw new Error(`"${name}" is not a reel name. Use lowercase letters, digits and dashes, for example ?reel=my-reel.`);
  const base = `reels/${name}/`;
  let reel;
  try {
    reel = normalizeReel((await import(new URL(base + 'reel.js', location.href).href)).default, { base });
  } catch (err) {
    if (err instanceof ReelError) throw err;
    // No reel.js (or one that will not load): a reel made of data is a reel.json instead.
    const json = await fetchText(base + 'reel.json');
    if (json === null) {
      console.error(err);
      throw new Error(`Could not load ${base}reel.js or ${base}reel.json. Check the reel name, and look in the browser console for a typo in the file.`, { cause: err });
    }
    reel = parseReelJson(json, { base });
  }
  const clipFor = clipLookup(await loadManifest(base + 'audio/manifest.json'), base + 'audio/');
  return { name, base, reel, clipFor, images: loadImages(reel.images) };
}

/**
 * Reads a reel carried inside the page itself (a one-file reel, made by npm run page): the
 * text of a reel.json, and optionally an audio manifest whose clips are data: URLs.
 */
export function inlineReel(reelText, manifestText) {
  const reel = parseReelJson(reelText);
  const clipFor = clipLookup(manifestText ? JSON.parse(manifestText) : null);
  return { name: '', base: '', reel, clipFor, images: loadImages(reel.images) };
}

function loadImages(sources) {
  const images = {};
  for (const [key, src] of Object.entries(sources)) {
    const im = new Image();
    im.onerror = () => console.warn(`picture "${key}" did not load from ${src}`);
    im.src = src;
    images[key] = im;
  }
  return images;
}
