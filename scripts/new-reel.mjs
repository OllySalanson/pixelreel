#!/usr/bin/env node
// Starts a new reel: npm run new my-reel [-- --title "My reel"] [-- --from notes.md]
// Creates reels/<name>/reel.js from the template, or from a Markdown script (see
// scripts/from-script.mjs), ready to edit and play.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { normalizeReel, REEL_NAME } from '../src/reel.js';
import { parseScript, reelSource } from './from-script.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Turns "my-first-reel" into "My first reel". */
export function titleFromName(name) {
  const words = name.split('-').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Writes reels/<name>/reel.js under `reelsDir` and returns { file, warnings }. With `script`
 * (the text of a Markdown script, from the file named `from`) the scenes come from it;
 * otherwise from the template. Throws on a bad or taken name.
 */
export function createReel(name, { title, reelsDir = join(ROOT, 'reels'), script, from = 'a script' } = {}) {
  if (!REEL_NAME.test(name ?? '')) {
    throw new Error(`"${name ?? ''}" is not a usable reel name. Use lowercase letters, digits and dashes, for example: npm run new my-reel`);
  }
  const dir = join(reelsDir, name);
  if (existsSync(dir)) throw new Error(`reels/${name} already exists. Pick another name, or edit ${relative(process.cwd(), join(dir, 'reel.js'))}.`);
  let body, warnings = [];
  if (script !== undefined) {
    const made = parseScript(script, { title });
    normalizeReel(made.reel);   // a script that makes a broken reel says so now, not in the browser
    body = reelSource(made.reel, { from });
    warnings = made.warnings;
  } else {
    title ||= titleFromName(name);
    const template = readFileSync(join(ROOT, 'scripts', 'templates', 'reel.js'), 'utf8');
    // the title goes inside single quotes in the template, so escape what would end them
    const quoted = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    body = template
      .replace(/'__TITLE__'/g, `'${quoted}'`)
      .replace(/'__SIGN__'/g, `'${quoted.toUpperCase()}'`)
      .replace(/__TITLE__/g, title.replace(/\n/g, ' '));
  }
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const file = join(dir, 'reel.js');
  writeFileSync(file, body);
  // no recordings yet: the browser's own voice reads every scene until npm run voices
  writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ clips: [] }, null, 2) + '\n');
  return { file, warnings };
}

function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { title: { type: 'string' }, from: { type: 'string' } } });
  const name = positionals[0];
  try {
    const script = values.from === undefined ? undefined : readFileSync(values.from === '-' ? 0 : values.from, 'utf8');
    const from = values.from === '-' ? 'standard input' : values.from && basename(values.from);
    const { file, warnings } = createReel(name, { title: values.title, script, from });
    for (const w of warnings) console.warn(`Note: ${w}.`);
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
