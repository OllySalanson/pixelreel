#!/usr/bin/env node
// Starts a new reel: npm run new my-reel [-- --title "My reel"]
// Creates reels/<name>/reel.js from the template, ready to edit and play.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { REEL_NAME } from '../src/reel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Turns "my-first-reel" into "My first reel". */
export function titleFromName(name) {
  const words = name.split('-').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Writes reels/<name>/reel.js under `reelsDir` and returns its path. Throws on a bad or taken name. */
export function createReel(name, { title, reelsDir = join(ROOT, 'reels') } = {}) {
  if (!REEL_NAME.test(name ?? '')) {
    throw new Error(`"${name ?? ''}" is not a usable reel name. Use lowercase letters, digits and dashes, for example: npm run new my-reel`);
  }
  title ||= titleFromName(name);
  const dir = join(reelsDir, name);
  if (existsSync(dir)) throw new Error(`reels/${name} already exists. Pick another name, or edit ${relative(process.cwd(), join(dir, 'reel.js'))}.`);
  const template = readFileSync(join(ROOT, 'scripts', 'templates', 'reel.js'), 'utf8');
  // the title goes inside single quotes in the template, so escape what would end them
  const quoted = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const body = template
    .replace(/'__TITLE__'/g, `'${quoted}'`)
    .replace(/'__SIGN__'/g, `'${quoted.toUpperCase()}'`)
    .replace(/__TITLE__/g, title.replace(/\n/g, ' '));
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const file = join(dir, 'reel.js');
  writeFileSync(file, body);
  // no recordings yet: the browser's own voice reads every scene until npm run voices
  writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ clips: [] }, null, 2) + '\n');
  return file;
}

function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { title: { type: 'string' } } });
  const name = positionals[0];
  try {
    const file = createReel(name, { title: values.title });
    const rel = relative(process.cwd(), file);
    console.log(`Made ${rel}

Next:
  1. Write your scenes in ${rel}
  2. Watch it:        npm start, then open http://localhost:8000/?reel=${name}
  3. Record voices:   npm run voices ${name}   (until then the browser reads it aloud)`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
