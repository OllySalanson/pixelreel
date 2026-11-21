#!/usr/bin/env node
// Makes a reel into one HTML file that plays anywhere: npm run page my-reel [-- --out tea.html]
// The player, its font, the reel and its recordings all go inside the page, so it can be
// emailed, sent in a chat or opened from a download, with nothing to host. Only a reel.json
// can be made into a page: it is data, so the page runs no code but the player's own.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseReelJson } from '../src/format.js';
import { bundle } from './bundle.mjs';
import { reelFile } from './reel-file.mjs';
import { reelDir } from './voices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };

const dataUrl = (file) => {
  const type = TYPES[extname(file).toLowerCase()];
  if (!type) throw new Error(`${basename(file)} is not a kind of file a page can carry (${Object.keys(TYPES).join(', ')})`);
  return `data:${type};base64,${readFileSync(file).toString('base64')}`;
};

/** JSON that is safe inside a <script> element: no "</script>" can end it early. */
const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The player page with everything inside it. `reelJson` is the text to put in the page as the
 * reel (already checked, or a placeholder for a tool to fill in), made safe to sit inside a
 * <script> element here; `manifest` is an audio
 * manifest whose clip files are data: URLs, or null for a page with no recordings, which
 * starts with the sound off.
 */
export function pageHtml({ reelJson, manifest = null, title = 'pixelreel' }) {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const font = `data:font/woff2;base64,${readFileSync(join(ROOT, 'fonts', 'orange-kid.woff2')).toString('base64')}`;
  const css = readFileSync(join(ROOT, 'src', 'pixelreel.css'), 'utf8').replace("url('../fonts/orange-kid.woff2')", `url('${font}')`);
  if (css.includes('../fonts/')) throw new Error('src/pixelreel.css names a font file the page cannot carry');
  const script = bundle([join(ROOT, 'src', 'main.js')]).replace(/<\/script/gi, '<\\/script');
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`],
    [/\n<link rel="preload"[^>]*>/, ''],
    [/<link rel="stylesheet" href="src\/pixelreel\.css">/, () => `<style>\n${css}</style>`],
    [/<script type="module" src="src\/main\.js"><\/script>/, () => `<script type="module">\n${script}</script>`],
    [/<!-- data-reel [^>]*-->\n<body data-reel="[^"]*">/, manifest ? '<body>' : '<body data-sound="off">'],
    [/<\/body>/, () => `<script type="application/json" id="reel-data">${reelJson.replace(/</g, '\\u003c')}</script>\n` +
      (manifest ? `<script type="application/json" id="reel-audio">${scriptJson(manifest)}</script>\n` : '') + '</body>']
  ];
  let page = html;
  for (const [from, to] of swaps) {
    if (!from.test(page)) throw new Error(`index.html has changed: ${from} no longer matches, so update scripts/page.mjs`);
    page = page.replace(from, to);
  }
  return page;
}

/** The one-file page for the reel.json in folder `dir`, with its pictures and recordings inside. */
export function onePage(dir) {
  const file = reelFile(dir);
  if (!file) throw new Error(`There is no reel.js or reel.json in ${dir}.`);
  if (!file.endsWith('.json')) throw new Error(`${basename(dir)} is a reel.js. Only a reel.json, which holds no code, can be made into one page.`);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const reel = parseReelJson(JSON.stringify(raw));   // checks it, saying every problem at once
  if (raw.images) {
    for (const [name, src] of Object.entries(raw.images)) {
      if (!/^([a-z][a-z0-9+.-]*:|\/)/i.test(src)) raw.images[name] = dataUrl(join(dir, src));
    }
  }
  const manifestFile = join(dir, 'audio', 'manifest.json');
  let manifest = null;
  if (existsSync(manifestFile)) {
    const said = new Set(reel.scenes.map((s) => s.say));
    const clips = JSON.parse(readFileSync(manifestFile, 'utf8')).clips
      .filter((c) => said.has(c.text?.trim()) && existsSync(join(dir, 'audio', c.file)))
      .map((c) => ({ text: c.text, file: dataUrl(join(dir, 'audio', c.file)), seconds: c.seconds }));
    if (clips.length) manifest = { clips };
  }
  return pageHtml({ reelJson: JSON.stringify(raw), manifest, title: `${reel.title} - pixelreel` });
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' } } });
  const dir = reelDir(positionals[0]);
  const out = resolve(values.out ?? `${basename(dir)}.html`);
  const page = onePage(dir);
  writeFileSync(out, page);
  console.log(`Wrote ${out} (${Math.round(page.length / 1024)} KB). Open it in any browser, or send it to someone.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.problems ? `This reel has problems:\n- ${err.problems.join('\n- ')}` : err.message); process.exitCode = 1; });
}
