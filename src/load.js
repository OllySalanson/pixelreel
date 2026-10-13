// Loads a reel by name in the browser: reels/<name>/reel.js, checked, plus its recorded
// clips and pictures. Shared by the player (main.js) and the banner maker (export.js).
import { clipLookup, normalizeReel, REEL_NAME } from './reel.js';

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
  let mod;
  try {
    mod = await import(new URL(base + 'reel.js', location.href).href);
  } catch (err) {
    console.error(err);
    throw new Error(`Could not load ${base}reel.js. Check the reel name, and look in the browser console for a typo in the file.`, { cause: err });
  }
  const reel = normalizeReel(mod.default, { base });
  const clipFor = clipLookup(await loadManifest(base + 'audio/manifest.json'), base + 'audio/');
  const images = {};
  for (const [key, src] of Object.entries(reel.images)) {
    const im = new Image();
    im.onerror = () => console.warn(`picture "${key}" did not load from ${src}`);
    im.src = src;
    images[key] = im;
  }
  return { name, base, reel, clipFor, images };
}
