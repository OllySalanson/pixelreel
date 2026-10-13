import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { flipbookSvg } from '../src/flipbook.js';
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
  const svg = flipbookSvg(['a.png', 'a.png', 'b.png', 'c&d.png'], { width: 320, height: 180, fps: 4, scale: 2, title: 'Tea <time>', desc: 'A "cup"' });

  it('shows the picture at its pixel size, scaled up crisply', () => {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 320 180" width="640" height="360" image-rendering="optimizeSpeed">\n/);
    assert.match(svg, /image-rendering:pixelated/);
    assert.match(svg, /<title>Tea &lt;time&gt;<\/title>\n<desc>A &quot;cup&quot;<\/desc>/);
  });

  it('holds repeated frames as one picture, each starting on its beat', () => {
    const images = svg.match(/<image [^>]*\/>/g);
    assert.deepEqual(images, [
      '<image class="h2" href="a.png" width="320" height="180"/>',
      '<image class="h1" href="b.png" width="320" height="180" style="animation-delay:0.5s"/>',
      '<image class="h1" href="c&amp;d.png" width="320" height="180" style="animation-delay:0.75s"/>'
    ]);
    assert.match(svg, /animation:1s step-end infinite/);
    assert.match(svg, /@keyframes h2\{0%\{opacity:1\}50%\{opacity:0\}\}/);
    assert.match(svg, /@keyframes h1\{0%\{opacity:1\}25%\{opacity:0\}\}/);
  });

  it('stands still for anyone who prefers less motion, on the first frame', () => {
    assert.match(svg, /image:first-of-type\{opacity:1\}/);
    assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{image\{animation:none\}\}/);
  });

  it('needs a frame', () => {
    assert.throws(() => flipbookSvg([], { width: 1, height: 1, fps: 1 }), /at least one frame/);
  });
});
