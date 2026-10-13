// An animated SVG that flips through frames like a flipbook. It stays crisp at any size and
// it plays in a README, because GitHub shows SVG animations. The banner maker writes these,
// from one stretch of a scene or several clips one after another.

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Pictures `layers`, each shown from its `start` frame (counting `fps` a second) to the end of
 * the loop, on top of the ones before. The first is a whole frame at 0; the rest can be just the
 * patch that changed ({ href, start, x, y, w, h }), which keeps a banner small. It also stands
 * still on that first frame for anyone who prefers less motion.
 * @param {Array<{ href: string, start: number, x?: number, y?: number, w?: number, h?: number }>} layers
 * @param {{ width: number, height: number, fps: number, frames: number, scale?: number, title?: string, desc?: string }} o
 *   width and height are the picture's size in pixels, frames how many make one loop, and
 *   scale how big it is shown.
 */
export function flipbookSvg(layers, { width, height, fps, frames, scale = 3, title = '', desc = '' }) {
  if (!layers.length || layers[0].start !== 0) throw new Error('a flipbook starts with a whole frame at 0');
  const seconds = +(frames / fps).toFixed(3);
  const starts = [...new Set(layers.map((l) => l.start).filter((n) => n > 0))];
  const style = [
    `image{opacity:0;image-rendering:pixelated;animation:${seconds}s step-end infinite}`,
    'image:first-of-type{opacity:1}',
    ...starts.map((n) => `.f${n}{animation-name:f${n}}@keyframes f${n}{0%{opacity:0}${+((100 * n) / frames).toFixed(4)}%{opacity:1}100%{opacity:1}}`),
    '@media (prefers-reduced-motion:reduce){image{animation:none}}'
  ].join('');
  const images = layers.map((l) => {
    const at = l.x || l.y ? ` x="${l.x ?? 0}" y="${l.y ?? 0}"` : '';
    return `<image${l.start ? ` class="f${l.start}"` : ''} href="${escape(l.href)}"${at} width="${l.w ?? width}" height="${l.h ?? height}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}" image-rendering="optimizeSpeed">`,
    title ? `<title>${escape(title)}</title>` : '',
    desc ? `<desc>${escape(desc)}</desc>` : '',
    `<style>${style}</style>`,
    ...images,
    '</svg>'
  ].filter((line) => line !== '').join('\n') + '\n';
}

/** The smallest box around every pixel that differs between two RGBA frames, or null if none do. */
export function changedBox(a, b, width, height) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  const wa = new Uint32Array(a.buffer, a.byteOffset, width * height), wb = new Uint32Array(b.buffer, b.byteOffset, width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (wa[row + x] !== wb[row + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The RGBA pixels inside `box` of a frame `width` pixels wide. */
export function crop(rgba, width, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) out.set(rgba.subarray(((box.y + y) * width + box.x) * 4, ((box.y + y) * width + box.x + box.w) * 4), y * box.w * 4);
  return out;
}

/**
 * Reads "2:0-2, 4:8.3-9.6" (scene, counting from 1, then from and to in seconds) into a list
 * of clips. Returns null when the box is empty, or throws to say what is wrong.
 */
export function parseClips(text, sceneCount) {
  const parts = String(text).split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  return parts.map((part) => {
    const m = /^(\d+)\s*:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(part);
    if (!m) throw new Error(`"${part}" should look like 2:1.5-4 (scene 2, from 1.5 to 4 seconds in).`);
    const scene = Number(m[1]) - 1, from = Number(m[2]), to = Number(m[3]);
    if (scene < 0 || scene >= sceneCount) throw new Error(`There is no scene ${m[1]}: this reel has ${sceneCount}.`);
    if (!(to > from)) throw new Error(`In "${part}", the end should come after the start.`);
    return { scene, from, to };
  });
}
