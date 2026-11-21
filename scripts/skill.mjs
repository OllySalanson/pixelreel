#!/usr/bin/env node
// Packs the Claude skill: npm run skill writes skill/pixel-reel.zip, ready to upload in Claude
// (Customize > Skills). It holds the hand-written SKILL.md and example.json from
// skill/pixel-reel/, the player as a one-file page with a gap for the reel (template.html),
// and make-page.mjs, which checks a reel.json with the player's own checks and fills the gap.
// The ZIP is committed, so a test fails until it is remade after the player changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundle } from './bundle.mjs';
import { pageHtml } from './page.mjs';
import { zip } from './zip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_ZIP = join(ROOT, 'skill', 'pixel-reel.zip');
/** Where the reel goes in template.html. */
export const GAP = 'PIXELREEL_REEL_HERE';

const MAKE_PAGE = `#!/usr/bin/env node
// Checks a pixel reel and makes it into one web page: node make-page.mjs reel.json [page.html]
// Made by npm run skill in the pixelreel project from the player's own checks: do not edit.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
`;

const RUN = `const { parseReelJson } = __m['format.js'];
const { clockTime, narrationMs, timeline } = __m['timing.js'];
const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node make-page.mjs reel.json [page.html]');
  process.exit(2);
}
const text = readFileSync(input, 'utf8');
let reel;
try {
  reel = parseReelJson(text);
} catch (err) {
  if (!err.problems) throw err;
  console.error('This reel has problems. Fix them all, then run this again:\\n- ' + err.problems.join('\\n- '));
  process.exit(1);
}
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const reelJson = JSON.stringify(JSON.parse(text)).replace(/</g, '\\\\u003c');
const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'template.html'), 'utf8');
const page = template
  .replace(/<title>[^<]*<\\/title>/, () => '<title>' + escapeHtml(reel.title) + ' - pixelreel</title>')
  .replace('${GAP}', () => reelJson);
const out = output || basename(input).replace(/\\.json$/i, '') + '.html';
writeFileSync(out, page);
const length = timeline(reel.scenes.map((s) => narrationMs(s, null))).total;
console.log('Wrote ' + out + ': "' + reel.title + '", ' + reel.scenes.length + ' scenes, about ' + clockTime(length) + '.');
`;

/** The skill's files, in the order they go in the ZIP. */
export function skillFiles() {
  const own = (name) => readFileSync(join(ROOT, 'skill', 'pixel-reel', name), 'utf8');
  const script = bundle([join(ROOT, 'src', 'format.js'), join(ROOT, 'src', 'timing.js')], { run: RUN });
  return [
    { name: 'pixel-reel/', data: '' },
    { name: 'pixel-reel/SKILL.md', data: own('SKILL.md') },
    { name: 'pixel-reel/example.json', data: own('example.json') },
    { name: 'pixel-reel/make-page.mjs', data: MAKE_PAGE + script },
    { name: 'pixel-reel/template.html', data: pageHtml({ reelJson: GAP }) }
  ];
}

export const skillZip = () => zip(skillFiles());

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bytes = skillZip();
  writeFileSync(SKILL_ZIP, bytes);
  console.log(`Wrote skill/pixel-reel.zip (${Math.round(bytes.length / 1024)} KB). Upload it in Claude: Customize > Skills.`);
}
