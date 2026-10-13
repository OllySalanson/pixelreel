import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { changedBox, crop, flipbookSvg, parseClips } from '../src/flipbook.js';
import { base64, crc32, palettePng } from '../src/png.js';

/** Reads a palette PNG back into RGBA pixels, checking every chunk on the way. */
function decode(png) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength), chunks = {};
  for (let at = 8; at < png.length;) {
    const len = view.getUint32(at), type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    assert.equal(view.getUint32(at + 8 + len), crc32(png.subarray(at + 4, at + 8 + len)), `${type} checksum`);
    chunks[type] = png.subarray(at + 8, at + 8 + len);
    at += 12 + len;
  }
  const head = new DataView(chunks.IHDR.buffer, chunks.IHDR.byteOffset);
  const w = head.getUint32(0), h = head.getUint32(4);
  assert.deepEqual([chunks.IHDR[8], chunks.IHDR[9]], [8, 3], '8-bit palette');
  const rows = inflateSync(chunks.IDAT), out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    assert.equal(rows[y * (w + 1)], 0, 'no filter');
    for (let x = 0; x < w; x++) {
      const i = rows[y * (w + 1) + 1 + x], o = (y * w + x) * 4;
      out.set([chunks.PLTE[i * 3], chunks.PLTE[i * 3 + 1], chunks.PLTE[i * 3 + 2], chunks.tRNS ? chunks.tRNS[i] : 255], o);
    }
  }
  return { w, h, rgba: out, chunks };
}

describe('palette PNGs', () => {
  it('knows its checksums', () => {
    assert.equal(crc32(new TextEncoder().encode('IEND')), 0xae426082);
  });

  it('round-trips pixel art exactly, transparency and all', async () => {
    const w = 7, h = 5, rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) rgba.set(i % 3 ? [255, 204, 77, 255] : [11, 18, 32, i % 2 ? 255 : 0], i * 4);
    const { w: dw, h: dh, rgba: back, chunks } = decode(await palettePng(w, h, rgba));
    assert.deepEqual([dw, dh], [w, h]);
    assert.deepEqual(back, rgba);
    assert.equal(chunks.PLTE.length, 3 * 3, 'three colours, three palette entries');
  });

  it('leaves out transparency when nothing is see-through', async () => {
    const { chunks } = decode(await palettePng(2, 1, Uint8Array.of(1, 2, 3, 255, 4, 5, 6, 255)));
    assert.equal(chunks.tRNS, undefined);
  });

  it('keeps the 256 commonest colours of a busier picture and maps the rest to the nearest', async () => {
    const w = 400, h = 2, rgba = new Uint8Array(w * h * 4);
    for (let x = 0; x < w; x++) {
      rgba.set([x % 300, 0, 0, 255], x * 4);              // 300 reds, a few used twice
      rgba.set([0, 0, 255, 255], (w + x) * 4);             // one blue, used 400 times
    }
    const { rgba: back, chunks } = decode(await palettePng(w, h, rgba));
    assert.equal(chunks.PLTE.length, 256 * 3);
    for (let x = 0; x < w; x++) {
      assert.deepEqual([...back.subarray((w + x) * 4, (w + x) * 4 + 4)], [0, 0, 255, 255], 'the common blue survives');
      assert.ok(Math.abs(back[x * 4] - rgba[x * 4]) <= 60, 'a dropped red becomes a near one');
    }
  });

  it('writes base64 for big pictures without running out of stack', () => {
    const bytes = new Uint8Array(300000).map((_, i) => i % 251);
    assert.equal(base64(bytes), Buffer.from(bytes).toString('base64'));
  });
});

describe('flipbook SVGs', () => {
  const layers = [
    { href: 'a.png', start: 0, x: 0, y: 0, w: 320, h: 180 },
    { href: 'patch&1.png', start: 1, x: 10, y: 20, w: 30, h: 40 },
    { href: 'b.png', start: 3, x: 0, y: 0, w: 320, h: 180 }
  ];
  const svg = flipbookSvg(layers, { width: 320, height: 180, fps: 4, frames: 4, scale: 2, title: 'Tea <time>', desc: 'A "cup"' });

  it('shows the picture at its pixel size, scaled up crisply', () => {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 320 180" width="640" height="360" image-rendering="optimizeSpeed">\n/);
    assert.match(svg, /image-rendering:pixelated/);
    assert.match(svg, /<title>Tea &lt;time&gt;<\/title>\n<desc>A &quot;cup&quot;<\/desc>/);
  });

  it('lays each patch over the frames before it, from its own frame to the end of the loop', () => {
    assert.deepEqual(svg.match(/<image [^>]*\/>/g), [
      '<image href="a.png" width="320" height="180"/>',
      '<image class="f1" href="patch&amp;1.png" x="10" y="20" width="30" height="40"/>',
      '<image class="f3" href="b.png" width="320" height="180"/>'
    ]);
    assert.match(svg, /animation:1s step-end infinite/);
    assert.match(svg, /@keyframes f1\{0%\{opacity:0\}25%\{opacity:1\}100%\{opacity:1\}\}/);
    assert.match(svg, /@keyframes f3\{0%\{opacity:0\}75%\{opacity:1\}100%\{opacity:1\}\}/);
  });

  it('stands still on the first frame for anyone who prefers less motion', () => {
    assert.match(svg, /image:first-of-type\{opacity:1\}/);
    assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{image\{animation:none\}\}/);
  });

  it('starts with a whole frame', () => {
    assert.throws(() => flipbookSvg([], { width: 1, height: 1, fps: 1, frames: 1 }), /starts with a whole frame/);
    assert.throws(() => flipbookSvg([{ href: 'x', start: 2 }], { width: 1, height: 1, fps: 1, frames: 3 }), /starts with a whole frame/);
  });

  it('finds the patch that changed between two frames, and crops it out', () => {
    const w = 6, h = 4, a = new Uint8ClampedArray(w * h * 4), b = new Uint8ClampedArray(a);
    assert.equal(changedBox(a, b, w, h), null);
    b[(1 * w + 2) * 4] = 255; b[(2 * w + 4) * 4 + 3] = 9;
    assert.deepEqual(changedBox(a, b, w, h), { x: 2, y: 1, w: 3, h: 2 });
    const patch = crop(b, w, { x: 2, y: 1, w: 3, h: 2 });
    assert.equal(patch.length, 3 * 2 * 4);
    assert.equal(patch[0], 255);
    assert.equal(patch[(1 * 3 + 2) * 4 + 3], 9);
  });
});

describe('banner clips', () => {
  it('reads several clips, counting scenes from 1', () => {
    assert.deepEqual(parseClips(' 2:0-2, 4:8.3-9.6 ,', 5), [{ scene: 1, from: 0, to: 2 }, { scene: 3, from: 8.3, to: 9.6 }]);
    assert.equal(parseClips('  ', 5), null);
  });

  it('says what is wrong with a clip', () => {
    assert.throws(() => parseClips('2-4', 5), /"2-4" should look like 2:1.5-4/);
    assert.throws(() => parseClips('9:0-1', 5), /There is no scene 9: this reel has 5/);
    assert.throws(() => parseClips('2:3-1', 5), /the end should come after the start/);
  });
});
