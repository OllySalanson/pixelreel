#!/usr/bin/env node
// Checks reels without a browser: npm run check [my-reel] [-- --recorded]
// Says what is wrong and where, or how long each reel runs and which scenes still have no
// recording. With no name it checks every reel; --recorded also fails a reel with scenes
// left for the browser's voice (handy in CI). Exits with 1 if anything needs fixing.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { clipLookup, normalizeReel } from '../src/reel.js';
import { clockTime, narrationMs, timeline } from '../src/timing.js';
import { reelDir } from './voices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Checks the reel in folder `dir`. Returns { ok, report: [lines to print] }. */
export async function checkReel(dir, { recorded = false } = {}) {
  const name = relative(process.cwd(), dir) || basename(dir);
  const file = join(dir, 'reel.js');
  if (!existsSync(file)) return { ok: false, report: [`${name}: there is no reel.js here.`] };
  let reel;
  try {
    reel = normalizeReel((await import(pathToFileURL(file).href)).default);
  } catch (err) {
    const why = err.problems ? err.problems.map((p) => `  - ${p}`).join('\n') : `  ${err.message}`;
    return { ok: false, report: [`${name}: this reel has problems:\n${why}`] };
  }
  const report = [], manifestFile = join(dir, 'audio', 'manifest.json');
  let ok = true;
  for (const [key, src] of Object.entries(reel.images)) {
    if (!/^([a-z][a-z0-9+.-]*:|\/)/i.test(src) && !existsSync(join(dir, src))) {
      report.push(`  - picture "${key}" is missing: there is no ${src} in ${name}`);
      ok = false;
    }
  }
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null;
  const clipFor = clipLookup(manifest, '');
  const missing = reel.scenes.map((s, i) => (clipFor(s) && existsSync(join(dir, 'audio', clipFor(s).url)) ? null : `${i + 1}. ${s.title}`)).filter(Boolean);
  const length = timeline(reel.scenes.map((s) => narrationMs(s, clipFor(s)))).total;
  report.unshift(`${name}: "${reel.title}", ${reel.scenes.length} scene${reel.scenes.length === 1 ? '' : 's'}, about ${clockTime(length)}.`);
  if (missing.length) {
    report.push(`  ${missing.length} without an up-to-date recording, so the browser's voice reads ${missing.length === 1 ? 'it' : 'them'}: ${missing.join(', ')}.`,
      `  Record ${missing.length === 1 ? 'it' : 'them'} with: npm run voices ${basename(dir)}`);
    if (recorded) ok = false;
  } else {
    report.push('  Every scene has an up-to-date recording.');
  }
  return { ok, report };
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { recorded: { type: 'boolean', default: false } } });
  const reelsDir = join(ROOT, 'reels');
  const dirs = positionals.length ? positionals.map(reelDir)
    : readdirSync(reelsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(reelsDir, d.name));
  let allOk = true;
  for (const dir of dirs) {
    const { ok, report } = await checkReel(dir, values);
    console.log(report.join('\n'));
    allOk &&= ok;
  }
  if (!allOk) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.message); process.exitCode = 1; });
}
