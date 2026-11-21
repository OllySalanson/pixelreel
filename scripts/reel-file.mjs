// Finds and reads the reel in a folder, for the tools: reel.js (code allowed) or reel.json
// (data only, see src/format.js). A folder holds one or the other, never both.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseReelJson } from '../src/format.js';
import { normalizeReel } from '../src/reel.js';

export const REEL_FILES = ['reel.js', 'reel.json'];

/** The path of the reel file in `dir`, or null if there is none. Throws if there are both. */
export function reelFile(dir) {
  const found = REEL_FILES.map((f) => join(dir, f)).filter((f) => existsSync(f));
  if (found.length > 1) throw new Error(`${dir} has both reel.js and reel.json. Keep one of them.`);
  return found[0] ?? null;
}

/** Loads and checks the reel in `dir`. Throws a ReelError listing its problems, or an Error if there is no reel. */
export async function readReel(dir) {
  const file = reelFile(dir);
  if (!file) throw new Error(`There is no reel.js or reel.json in ${dir}.`);
  if (file.endsWith('.json')) return parseReelJson(readFileSync(file, 'utf8'));
  return normalizeReel((await import(pathToFileURL(file).href)).default);
}
