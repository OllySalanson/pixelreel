import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { CARD, drawCard, fitTitle } from '../service/card.mjs';

const canvas = await import('@napi-rs/canvas').then(() => true, () => false);
const skip = !canvas && 'needs @napi-rs/canvas (npm install)';

const reel = (name) => JSON.parse(readFileSync(new URL(`../reels/${name}/reel.json`, import.meta.url), 'utf8'));
/** A PNG's width and height, from its first chunk. */
const sizeOf = (png) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe('fitTitle', () => {
  const widthOf = (text, size) => text.length * size * 0.5;   // near enough to the pixel font

  it('uses the largest letters a title fits in', () => {
    assert.deepEqual(fitTitle('Tea', 800, widthOf), { text: 'Tea', size: 56 });
    assert.deepEqual(fitTitle('How to read your gas meter, left to right', 800, widthOf), { text: 'How to read your gas meter, left to right', size: 36 });
  });

  it('cuts a title too long for the smallest letters at a whole word, with three dots', () => {
    const { text, size } = fitTitle('Everything the council tax letter says about bands, discounts and when it is due', 800, widthOf);
    assert.equal(size, 36);
    assert.equal(text, 'Everything the council tax letter says...');
    assert.ok(widthOf(text, size) <= 800);
  });

  it('cuts one very long word where it must', () => {
    const { text, size } = fitTitle('A'.repeat(200), 800, widthOf);
    assert.ok(text.endsWith('...') && widthOf(text, size) <= 800 && text.length > 20);
  });
});

describe("a reel's own picture", { skip }, () => {
  it('is a PNG the size link previews ask for', async () => {
    const png = await drawCard(reel('gas-meter'));
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.deepEqual(sizeOf(png), CARD);
    assert.deepEqual(CARD, { width: 1200, height: 630 });
    assert.ok(png.length < 200_000, 'small enough to load in a message at once');
  });

  it('is the same every time, and different for each reel', async () => {
    const [once, again, other] = [await drawCard(reel('gas-meter')), await drawCard(reel('gas-meter')), await drawCard(reel('volcano'))];
    assert.ok(once.equals(again));
    assert.ok(!once.equals(other));
  });

  it('draws whatever a reel starts on and however long its name', async () => {
    const tea = {
      format: 'pixelreel/1', title: 'Everything the council tax letter says about bands, discounts and when it is due',
      scenes: [{ title: 'Kettle', caption: 'Boil it.', picture: { type: 'icons', items: [{ icon: 'cup', label: 'Tea' }] } }]
    };
    assert.deepEqual(sizeOf(await drawCard(tea)), CARD);
  });
});
