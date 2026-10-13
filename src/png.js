// Small PNGs for pixel art: one byte a pixel from a palette of up to 256 colours, instead
// of four. Used by the banner maker, so a few seconds of a reel fits comfortably in a README.

const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 a PNG chunk ends with. */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Encodes RGBA pixels (as from getImageData) as a palette PNG. A picture with more than 256
 * colours (smoothed text, a photo) keeps its 256 commonest and draws the rest with the nearest.
 */
export async function palettePng(width, height, rgba) {
  const counts = new Map();
  for (let o = 0; o < rgba.length; o += 4) {
    const key = ((rgba[o] << 24) | (rgba[o + 1] << 16) | (rgba[o + 2] << 8) | rgba[o + 3]) >>> 0;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const colours = [...counts.keys()];
  if (colours.length > 256) colours.sort((a, b) => counts.get(b) - counts.get(a)).length = 256;
  const index = new Map(colours.map((k, i) => [k, i]));
  const channels = (k) => [k >>> 24, (k >>> 16) & 255, (k >>> 8) & 255, k & 255];
  const nearest = (key) => {
    const c = channels(key);
    let best = 0, bestD = Infinity;
    colours.forEach((k, i) => {
      const p = channels(k), d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 + (p[3] - c[3]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    index.set(key, best);
    return best;
  };
  const rows = new Uint8Array((width + 1) * height);   // each row starts with filter 0: none
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const key = ((rgba[o] << 24) | (rgba[o + 1] << 16) | (rgba[o + 2] << 8) | rgba[o + 3]) >>> 0;
      rows[y * (width + 1) + 1 + x] = index.get(key) ?? nearest(key);
    }
  }
  const palette = new Uint8Array(colours.length * 3), alpha = new Uint8Array(colours.length);
  colours.forEach((k, i) => { const [r, g, b, a] = channels(k); palette.set([r, g, b], i * 3); alpha[i] = a; });
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;   // bits per palette index
  header[9] = 3;   // colour type: palette
  const parts = [SIGNATURE, chunk('IHDR', header), chunk('PLTE', palette)];
  if (alpha.some((a) => a !== 255)) parts.push(chunk('tRNS', alpha));
  parts.push(chunk('IDAT', await deflate(rows)), chunk('IEND', new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Bytes as base64, in slices so a big picture never overflows the call stack. */
export function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
