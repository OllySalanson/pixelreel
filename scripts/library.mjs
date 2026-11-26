#!/usr/bin/env node
// The library's sheet: every drawing on one page, numbered and big, for Olly to say yes or no
// to before it goes in (docs/library.md). Drawn in Node with the player's own kit, so what is
// on the sheet is what a reel shows.
//
//   npm run library -- sheet [--only name,name] [--new name,name] [--out sheet.html] [--title "..."]
//       one page: the people in every skin and in their work clothes, the places, and each
//       thing, with its number, its name and what it is.
//   npm run library -- wanted [--days 7]
//       the drawings the reels wished for over the last week, from the service's day book.
//   npm run library -- week [--names "a,b"] [--most 8]
//       the weekly drawing: Opus draws the most wanted things, a second Claude is shown each
//       without its name and says what it sees, and they go on one sheet for Olly.
//   npm run library -- add library-week.json [--skip name,name]
//       writes the drawings Olly said yes to into src/library.js.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createKit, H, W } from '../src/kit.js';
import { PEOPLE, THINGS, WEARS } from '../src/library.js';
import { drawPicture, SKINS } from '../src/pictures.js';
import { PLACES } from '../src/stage.js';
import { addToLibrary, blindLook, drawingProblems, drawThing, libraryHas, libraryName } from './drawer.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let canvasModule = null;
async function canvas() {
  if (!canvasModule) {
    canvasModule = await import('@napi-rs/canvas');
    canvasModule.GlobalFonts.registerFromPath(join(ROOT, 'fonts', 'orange-kid.woff2'), 'Orange Kid');
  }
  return canvasModule;
}

/** A stage picture drawn as a PNG data address, `scale` sheet pixels to a picture pixel, at `t` seconds in. */
async function stagePng(picture, { scale = 2, t = 6, width = W, height = H, left = 0, top = 0 } = {}) {
  const { createCanvas } = await canvas();
  const c = createCanvas(width * scale, height * scale), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
  drawPicture(picture, t, createKit(g));
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

/** One thing by itself on a pale card, as big as fits at a whole number of sheet pixels to one of its own, so it stays crisp. */
async function thingPng(thing) {
  const { createCanvas } = await canvas();
  const cols = thing.rows[0].length, rows = thing.rows.length, width = 300, height = 200;
  const scale = Math.max(1, Math.min(8, Math.floor((width - 40) / cols), Math.floor((height - 40) / rows)));
  const c = createCanvas(width, height), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#dfe7ee';
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#c3ced8';
  g.fillRect(0, height - 24, width, 24);
  createKit(g).sprite(thing.rows, Math.round((width - cols * scale) / 2), height - 24 - rows * scale, scale, false, thing.colours ?? null);
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const SPOTS3 = ['left', 'middle', 'right'];

/** The sheet as one page of HTML. `things` are the names of the things on it (all, unless asked). */
export async function sheetHtml({ things = Object.keys(THINGS), people = Object.keys(PEOPLE), places = Object.keys(PLACES), title = 'New drawings for Pixel Reel', fresh = [], drafts = {} } = {}) {
  let n = 0;
  const cards = [];
  // the people: each in the three skins, then in each thing they can wear
  const peopleRows = [];
  for (const is of people) {
    const outline = PEOPLE[is].outline;
    const skins = outline ? [undefined] : Object.keys(SKINS);
    const crowd = skins.map((skin, i) => ({ id: `p${i}`, is, spot: SPOTS3[i] ?? 'middle', skin, label: skin ?? 'anyone' }));
    const png = await stagePng({ type: 'stage', place: 'plain', things: crowd, moves: [{ do: 'pulse', on: 'p0', at: 99 }] }, { scale: 3, top: 84, height: 82 });
    peopleRows.push({ n: ++n, name: is, says: outline ? 'anyone at all: a plain outline' : `${is.replace('-', ' ')}, in each skin, with hair of their own`, png });
  }
  const wears = Object.entries(WEARS).filter(([, w]) => w), slots = ['far-left', 'left', 'middle', 'right', 'far-right'];
  for (let i = 0; i < wears.length; i += 5) {
    const five = wears.slice(i, i + 5);
    const dressed = five.map(([name], k) => ({ id: `w${k}`, is: ['woman', 'man', 'girl', 'older-man', 'boy', 'older-woman'][(i + k) % 6], spot: slots[k], wears: name, label: name, skin: Object.keys(SKINS)[(i + k) % 3] }));
    const png = await stagePng({ type: 'stage', place: 'plain', things: dressed, moves: [{ do: 'pulse', on: 'w0', at: 99 }] }, { scale: 3, top: 76, height: 90 });
    peopleRows.push({ n: ++n, name: 'what people wear', says: five.map(([name, w]) => `${name}: ${w.says}`).join('. '), png });
  }
  for (const name of things) {
    const thing = drafts[name] ?? THINGS[name];
    const png = await thingPng(thing);
    // a new drawing says what a second Claude, not told its name, took it for
    const seen = thing.seen ? ` Shown it without its name, Claude saw: ${thing.seen}.${thing.recognised ? '' : ' Not known at a glance.'}` : '';
    cards.push({ n: ++n, name, says: `${thing.says}.${seen}`.replace(/\.\./g, '.'), group: thing.group, png, unknown: thing.seen && !thing.recognised });
  }
  const placeCards = [];
  for (const place of places) {
    const png = await stagePng({ type: 'stage', place, things: [{ id: 'r', is: 'reelie', spot: 'far-left' }], moves: [{ do: 'pulse', on: 'r', at: 99 }] }, { scale: 2, t: 3 });
    placeCards.push({ n: ++n, name: place, says: PLACES[place], png });
  }
  const groups = [...new Set(cards.map((c) => c.group))];
  const card = (c, wide = false) => `<figure class="${[wide ? 'wide' : '', c.unknown ? 'unknown' : ''].join(' ').trim()}"><span class="n">${c.n}</span>${fresh.includes(c.name) || c.says.split('. ').some((bit) => fresh.includes(bit.split(':')[0])) ? '<span class="new">new</span>' : ''}<img src="${c.png}" alt="${esc(c.name)}"><figcaption><b>${esc(c.name)}</b> ${esc(c.says)}</figcaption></figure>`;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg: #0d1b2a; --card: #13203a; --ink: #ebeac5; --gold: #ffcc4d; --faint: #9fb3c8; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.5 Verdana, 'DejaVu Sans', sans-serif; }
  main { max-width: 1240px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { color: var(--gold); font-size: 30px; margin: 0 0 4px; }
  h2 { color: var(--gold); font-size: 22px; margin: 36px 0 12px; }
  p { margin: 0 0 8px; color: var(--faint); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .grid.wide { grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); }
  figure { position: relative; margin: 0; background: var(--card); border: 2px solid #24476b; border-radius: 6px; overflow: hidden; }
  figure img { display: block; width: 100%; height: auto; image-rendering: pixelated; }
  figcaption { padding: 8px 12px 10px; font-size: 16px; color: var(--faint); }
  figcaption b { display: block; color: var(--ink); font-size: 18px; }
  figure.unknown { border-color: #ff8c2a; }
  .new { position: absolute; top: 8px; right: 8px; padding: 2px 8px; background: #55d6be; color: #1a1a1a; font-weight: bold; border-radius: 4px; }
  .n { position: absolute; top: 8px; left: 8px; min-width: 36px; padding: 2px 8px; background: var(--gold); color: #1a1a1a; font-weight: bold; text-align: center; border-radius: 4px; }
</style></head>
<body><main>
<h1>${esc(title)}</h1>
<p>${n} drawings${fresh.length ? ', the new ones marked' : ''}. Say yes to the sheet, or give the numbers to draw again.</p>
<h2>People</h2>
<div class="grid wide">${peopleRows.map((c) => card(c, true)).join('')}</div>
${groups.map((group) => `<h2>${esc(group)}</h2>\n<div class="grid">${cards.filter((c) => c.group === group).map((c) => card(c)).join('')}</div>`).join('\n')}
${placeCards.length ? `<h2>Places</h2>\n<div class="grid wide">${placeCards.map((c) => card(c, true)).join('')}</div>` : ''}
</main></body></html>
`;
}

/** The admin key, to read the day book: PIXELREEL_BOTTLE_READER, or the live service's own secret. */
function adminKey() {
  if (process.env.PIXELREEL_BOTTLE_READER) return process.env.PIXELREEL_BOTTLE_READER;
  const got = spawnSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret', 'pixelreel-bottle-reader', '--project', 'pixelreel-515501'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (got.status !== 0 || !got.stdout.trim()) throw new Error('no admin key: set PIXELREEL_BOTTLE_READER, or sign in to gcloud');
  return got.stdout.trim();
}

/** The drawings the reels wanted over the last `days` days, most wanted first, from the service's day book. */
async function wantedFrom(service, days) {
  const res = await fetch(`${service}/day/wanted?days=${days}`, { headers: { authorization: `Bearer ${adminKey()}` } });
  if (!res.ok) throw new Error(`${service} said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const USAGE = `npm run library -- sheet [--only name,name] [--new name,name] [--out sheet.html] [--title "..."]
npm run library -- wanted [--service https://pixelreel.pro] [--days 7]
npm run library -- week [--names "gas meter,wheelchair"] [--most 8] [--days 7] [--out library-week.json]
npm run library -- add library-week.json [--skip name,name]`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      only: { type: 'string' }, new: { type: 'string' }, out: { type: 'string' }, title: { type: 'string' }, service: { type: 'string', default: 'https://pixelreel.pro' },
      days: { type: 'string', default: '7' }, names: { type: 'string' }, most: { type: 'string', default: '8' }, skip: { type: 'string' }
    }
  });
  const list = (text) => text?.split(',').map((x) => x.trim()).filter(Boolean);
  const [command, file] = positionals;
  if (command === 'sheet') {
    const only = list(values.only);
    for (const name of only ?? []) if (!THINGS[name] && !PEOPLE[name] && !PLACES[name]) throw new Error(`there is nothing called ${name} in the library`);
    const out = values.out ?? 'library-sheet.html';
    writeFileSync(out, await sheetHtml({
      ...(only ? { things: only.filter((x) => THINGS[x]), people: only.filter((x) => PEOPLE[x]), places: only.filter((x) => PLACES[x]) } : {}),
      ...(values.title ? { title: values.title } : {}),
      fresh: list(values.new) ?? []
    }));
    console.log(out);
  } else if (command === 'wanted') {
    const got = await wantedFrom(values.service, Number(values.days) || 7);
    console.log(`${got.reels} reels from ${got.from} to ${got.to}; wanted:`);
    for (const w of got.wanted) console.log(`  ${w.name} (${w.reels})${libraryHas(libraryName(w.name) ?? '') ? ' - the library has it' : ''}`);
  } else if (command === 'week') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default, client = new Anthropic({ timeout: 300_000, maxRetries: 1 });
    const asked = list(values.names) ?? (await wantedFrom(values.service, Number(values.days) || 7)).wanted.map((w) => w.name);
    const names = [...new Set(asked.map(libraryName).filter((n) => n && !libraryHas(n)))].slice(0, Number(values.most) || 8);
    if (!names.length) { console.log('Nothing new is wanted this week.'); return; }
    const drafts = {}, log = (line) => console.log(line);
    for (const name of names) {
      try {
        const drawing = await drawThing(client, name, { log });
        drafts[name] = { ...drawing, ...(await blindLook(client, name, drawing, { log })) };
        console.log(`${name}: drawn; shown it without its name, Claude saw "${drafts[name].seen}"${drafts[name].recognised ? '' : ' (not known at a glance)'}`);
      } catch (err) {
        console.log(`${name}: ${err.message}`);
      }
    }
    const out = values.out ?? 'library-week.json';
    writeFileSync(out, `${JSON.stringify(drafts, null, 1)}\n`);
    const sheet = out.replace(/\.json$/, '') + '.html';
    writeFileSync(sheet, await sheetHtml({ things: Object.keys(drafts), people: [], places: [], drafts, fresh: Object.keys(drafts), title: values.title ?? `New drawings for Pixel Reel, week of ${new Date().toISOString().slice(0, 10)}` }));
    console.log(`${out}\n${sheet}`);
  } else if (command === 'add' && file) {
    const drafts = JSON.parse(readFileSync(file, 'utf8')), skip = new Set(list(values.skip) ?? []);
    const chosen = Object.fromEntries(Object.entries(drafts).filter(([name, d]) => !skip.has(name) && !drawingProblems(d).length));
    const added = addToLibrary(chosen);
    console.log(added.length ? `Added to src/library.js: ${added.join(', ')}. Run npm run skill and the tests, then open a pull request.` : 'Nothing to add.');
  } else {
    console.error(USAGE);
    process.exitCode = 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
