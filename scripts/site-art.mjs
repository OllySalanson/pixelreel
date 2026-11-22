#!/usr/bin/env node
// Draws the website's own pictures into site/art/: npm run site-art
// The tab icon, the home-screen icons, the pictures shown when a link to the site or to a
// reel is shared, and the logos for the press kit. All are drawn from the site's own sprites and landscape
// (site/js/), so they match the pages. Run it again after changing Reelie or the landscape.
// Needs @napi-rs/canvas (npm install).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { appManifest, spriteSvg } from '../service/site.mjs';
import { SCENES } from '../site/js/landscape.js';
import { SPRITES } from '../site/js/sprites.js';
import { createKit } from '../src/kit.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NIGHT = '#0b1220', CREAM = '#f8f7dd', GOLD = '#ffcc4d', PAPER = '#faf3e1', INK = '#141b2d';

/** Reelie's rows in the middle of a `size` x `size` square. */
function squared(size) {
  const { rows } = SPRITES.reelie, left = Math.floor((size - rows[0].length) / 2), top = Math.floor((size - rows.length) / 2);
  const blank = '.'.repeat(size);
  return Array.from({ length: size }, (_, y) => {
    const row = rows[y - top];
    return row ? '.'.repeat(left) + row + '.'.repeat(size - left - row.length) : blank;
  });
}

/** The pictures that are plain text (SVG and the manifest), by file name: the same every time, so a test can check them. */
export function textArt() {
  const svg = (rows, scale) => spriteSvg(rows, { colours: SPRITES.reelie.colours, scale }).replace('<svg class="px" ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(' aria-hidden="true" focusable="false"', '') + '\n';
  return {
    'favicon.svg': svg(squared(28), 1),
    'reelie.svg': svg(SPRITES.reelie.rows, 16),
    'site.webmanifest': JSON.stringify(appManifest(), null, 2) + '\n'
  };
}

/** A PNG inside the wrapper an .ico file needs, for browsers that only ask for /favicon.ico. */
function ico(png, size) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(1, 2);            // an icon
  head.writeUInt16LE(1, 4);            // one picture
  head.writeUInt8(size, 6);
  head.writeUInt8(size, 7);
  head.writeUInt16LE(1, 10);           // colour planes
  head.writeUInt16LE(32, 12);          // bits a pixel
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18);          // where the picture starts
  return Buffer.concat([head, png]);
}

async function main() {
  const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
  GlobalFonts.registerFromPath(join(ROOT, 'fonts', 'orange-kid.woff2'), 'Orange Kid');
  GlobalFonts.registerFromPath(join(ROOT, 'site', 'fonts', 'lexend.woff2'), 'Lexend');
  const out = join(ROOT, 'site', 'art');
  mkdirSync(out, { recursive: true });
  const save = (name, data) => { writeFileSync(join(out, name), data); console.log(`  ${name}`); };
  const { rows, colours } = SPRITES.reelie;

  /** A canvas w x h with its kit, drawing `scale` real pixels to one of the kit's. */
  const board = (w, h, scale = 1) => {
    const canvas = createCanvas(w, h), g = canvas.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.imageSmoothingEnabled = false;
    return { canvas, g, px: createKit(g) };
  };
  /** Reelie on a night square, for icons. */
  const icon = (size, scale) => {
    const { canvas, g, px } = board(size, size);
    g.fillStyle = NIGHT;
    g.fillRect(0, 0, size, size);
    px.sprite(rows, Math.round((size - rows[0].length * scale) / 2), Math.round((size - rows.length * scale) / 2), scale, false, colours);
    return canvas.toBuffer('image/png');
  };

  console.log('Drawing site/art:');
  for (const [name, text] of Object.entries(textArt())) save(name, text);

  const small = board(32, 32);
  small.px.sprite(squared(28), 2, 2, 1, false, colours);
  save('favicon.ico', ico(small.canvas.toBuffer('image/png'), 32));
  save('touch-icon.png', icon(180, 5));
  save('icon-192.png', icon(192, 5));
  save('icon-512.png', icon(512, 14));
  // smaller in its square, so nothing of Reelie is lost when a phone cuts the icon into a circle
  save('icon-maskable-192.png', icon(192, 4));
  save('icon-maskable-512.png', icon(512, 10));

  const big = board(rows[0].length * 16, rows.length * 16);
  big.px.sprite(rows, 0, 0, 16, false, colours);
  save('reelie.png', big.canvas.toBuffer('image/png'));

  // the logo: Reelie and the name, on night and on paper
  for (const [name, back, ink] of [['logo-on-night.png', NIGHT, CREAM], ['logo-on-paper.png', PAPER, INK]]) {
    const { canvas, g, px } = board(1200, 400);
    g.fillStyle = back;
    g.fillRect(0, 0, 1200, 400);
    px.sprite(rows, 96, 400 / 2 - (rows.length * 8) / 2, 8, false, colours);
    g.fillStyle = ink;
    g.font = '800 150px Lexend';
    g.textBaseline = 'middle';
    g.fillText('Pixel Reel', 96 + rows[0].length * 8 + 56, 206);
    save(name, canvas.toBuffer('image/png'));
  }

  // the picture for a shared link: the landscape, with the two lines that say it all
  const share = board(1200, 630, 4);
  SCENES.hero(share.px, 300, 158, 6.5, { paper: PAPER, still: true, quiet: [[0, 0, 262, 106]] });
  const g = share.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.textBaseline = 'alphabetic';
  g.font = '800 124px Lexend';
  g.fillStyle = CREAM;
  g.fillText('Watch it.', 76, 196);
  g.fillStyle = GOLD;
  g.fillText("Don't read it.", 76, 328);
  g.font = '500 40px Lexend';
  g.fillStyle = CREAM;
  g.fillText('Pixel Reel. Short cartoons with a warm voice.', 80, 398);
  save('share.png', share.canvas.toBuffer('image/png'));

  // the picture for a link to someone's reel, sent in a message: it says what it is, and nothing of what is in it
  const card = board(1200, 630, 4);
  SCENES.hero(card.px, 300, 158, 6.5, { paper: PAPER, still: true, quiet: [[0, 0, 262, 106]] });
  const c = card.g;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.textBaseline = 'alphabetic';
  c.font = '800 124px Lexend';
  c.fillStyle = CREAM;
  c.fillText('A pixel reel', 76, 196);
  c.fillStyle = GOLD;
  c.fillText('for you.', 76, 328);
  c.font = '500 40px Lexend';
  c.fillStyle = CREAM;
  c.fillText('Press Play, and Peter will read it to you.', 80, 398);
  save('reel-card.png', card.canvas.toBuffer('image/png'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.message); process.exitCode = 1; });
}
