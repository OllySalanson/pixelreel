// A reel's own picture for a link sent in a message (/r/<id>/card.png): its first picture as
// it stands when its scene ends, in a frame, over a band with a play button, the reel's name
// and Reelie. A message that shows "GAS METER" says more than one that shows the same card
// for every reel. Drawn in Node with @napi-rs/canvas and the player's own kit, like the
// videos, so it needs no browser.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITES } from '../site/js/sprites.js';
import { reelFromData } from '../src/format.js';
import { createKit, H, rand, W } from '../src/kit.js';
import { narrationMs } from '../src/timing.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The size link previews ask for. */
export const CARD = { width: 1200, height: 630 };
const SCALE = 3;                        // the picture is 960 x 540: whole pixels, so it stays crisp
const PICTURE = { width: W * SCALE, height: H * SCALE }, BAND = CARD.height - PICTURE.height;
const EDGE = 6, MARGIN = 36;
const COLOURS = { night: '#0b1220', band: '#13203a', edge: '#ebeac5', gold: '#ffcc4d', lip: '#c98a12', ink: '#141b2d', star: '#fdf6e3', faint: '#7f93b8' };
const TITLE_SIZES = [56, 52, 48, 44, 40, 36];

/**
 * A reel's title as it goes in the band: the largest of the sizes at which it fits `room`
 * pixels, or, at the smallest, as many whole words as fit and three dots. `widthOf(text, size)`
 * measures.
 */
export function fitTitle(title, room, widthOf) {
  const size = TITLE_SIZES.find((s) => widthOf(title, s) <= room) ?? TITLE_SIZES.at(-1);
  if (widthOf(title, size) <= room) return { text: title, size };
  const words = title.split(' ');
  while (words.length > 1 && widthOf(`${words.join(' ')}...`, size) > room) words.pop();
  let text = words.join(' ');
  while (text.length > 1 && widthOf(`${text}...`, size) > room) text = text.slice(0, -1);   // one very long word
  return { text: `${text.replace(/[\s.,;:!?-]+$/, '')}...`, size };
}

/** Draws the card for a reel (reel.json, parsed). Resolves to a PNG. */
export async function drawCard(raw) {
  const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
  GlobalFonts.registerFromPath(join(ROOT, 'fonts', 'orange-kid.woff2'), 'Orange Kid');
  // a reel made here carries no images of its own (limits.mjs), so there is nothing to load or fetch
  const reel = reelFromData(raw), scene = reel.scenes[0];

  const canvas = createCanvas(CARD.width, CARD.height), g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const page = createKit(g);   // for the band: one of its pixels is one of the card's

  // the night it hangs in, with a few stars either side
  g.fillStyle = COLOURS.night;
  g.fillRect(0, 0, CARD.width, CARD.height);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = i % 4 ? COLOURS.star : COLOURS.faint;
    g.fillRect(Math.floor((rand(i * 1.37 + 3) * CARD.width) / EDGE) * EDGE, Math.floor((rand(i * 2.71 + 8) * PICTURE.height) / EDGE) * EDGE, EDGE, EDGE);
  }

  // the reel's first picture, as it stands when its scene ends, in a frame
  const left = (CARD.width - PICTURE.width) / 2;
  g.save();
  g.beginPath();
  g.rect(left, 0, PICTURE.width, PICTURE.height);
  g.clip();
  g.translate(left, 0);
  g.scale(SCALE, SCALE);
  scene.draw(Math.max(2, narrationMs(scene, null) / 1000 - 0.2), createKit(g), scene);
  g.restore();
  g.fillStyle = COLOURS.edge;
  g.fillRect(left - EDGE, 0, PICTURE.width + EDGE * 2, EDGE);
  g.fillRect(left - EDGE, 0, EDGE, PICTURE.height);
  g.fillRect(left + PICTURE.width, 0, EDGE, PICTURE.height);

  // the band under it: a play button, the reel's name, and whose it is
  const top = PICTURE.height;
  g.fillStyle = COLOURS.band;
  g.fillRect(0, top, CARD.width, BAND);
  g.fillStyle = COLOURS.edge;
  g.fillRect(0, top, CARD.width, EDGE);
  const key = 54, keyTop = top + EDGE + Math.round((BAND - EDGE - key - EDGE) / 2);
  g.fillStyle = COLOURS.lip;
  g.fillRect(MARGIN, keyTop + EDGE, key, key);
  g.fillStyle = COLOURS.gold;
  g.fillRect(MARGIN, keyTop, key, key);
  g.fillStyle = COLOURS.ink;
  for (let k = 0; k < 5; k++) g.fillRect(MARGIN + 18 + k * 4, keyTop + 13 + k * 3, 4, 28 - k * 6);   // a pixel triangle

  const brand = 'Pixel Reel', brandSize = 40, face = SPRITES.reelie, faceScale = 2;
  const faceW = face.rows[0].length * faceScale, brandW = faceW + 14 + page.textW(brand, brandSize);
  const middle = top + EDGE + (BAND - EDGE) / 2;
  page.sprite(face.rows, CARD.width - MARGIN - brandW, Math.round(middle - (face.rows.length * faceScale) / 2), faceScale, false, face.colours);
  page.text(brand, CARD.width - MARGIN - page.textW(brand, brandSize), Math.round(middle - brandSize / 2 - 2), brandSize, COLOURS.star);

  const titleLeft = MARGIN + key + 24;
  const title = fitTitle(reel.title, CARD.width - MARGIN - brandW - 40 - titleLeft, (text, size) => page.textW(text, size));
  page.text(title.text, titleLeft, Math.round(middle - title.size / 2 - 2), title.size, COLOURS.gold);

  return canvas.toBuffer('image/png');
}
