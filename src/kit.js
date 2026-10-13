// The pixel kit: the drawing helpers every scene's draw(t, px) receives.
// Scenes draw on a 320x180 grid of logical pixels; the player scales it up crisply.

export const W = 320;
export const H = 180;
export const FONT = "'Orange Kid', monospace";

/** Palette letters for px.sprite(). Any other character is used as a CSS colour. */
export const PALETTE = {
  k: '#1a1a1a', s: '#f2c194', b: '#1f4e9c', B: '#163a75', y: '#ffcc4d', w: '#fdf6e3', r: '#d63a3a', R: '#a52222',
  n: '#7a4a24', N: '#5a3418', g: '#3fa34d', G: '#2a7a35', e: '#9fb3c8', o: '#ff8c2a', p: '#8e5bd6', t: '#55d6be',
  c: '#ebeac5'
};

/**
 * @param {CanvasRenderingContext2D} g   a context already scaled so 1 unit = 1 logical pixel
 * @param {Record<string, HTMLImageElement>} images   the reel's pictures, by name
 */
export function createKit(g, images = {}) {
  const px = {
    W, H, PAL: PALETTE,

    /** A filled rectangle. */
    rect(c, x, y, w, h) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); },

    /** Draws rows of palette letters ('.' or ' ' is see-through), each letter `sc` pixels big. */
    sprite(rows, x, y, sc = 1, flip = false) {
      for (let j = 0; j < rows.length; j++) {
        for (let i = 0; i < rows[j].length; i++) {
          const ch = rows[j][flip ? rows[j].length - 1 - i : i];
          if (ch === '.' || ch === ' ') continue;
          g.fillStyle = PALETTE[ch] || ch;
          g.fillRect(Math.round(x + i * sc), Math.round(y + j * sc), sc, sc);
        }
      }
    },

    /** Pixel-font text. `align` is 'left', 'center' or 'right'. */
    text(str, x, y, size = 12, col = '#fdf6e3', align = 'left') {
      g.font = size + 'px ' + FONT; g.textBaseline = 'top'; g.textAlign = align; g.fillStyle = col;
      g.fillText(str, Math.round(x), Math.round(y));
      g.textAlign = 'left';
    },

    /** The width `str` takes in the pixel font. */
    textW(str, size = 12) { g.font = size + 'px ' + FONT; return Math.ceil(g.measureText(str).width); },

    /** A framed panel: ink border, cream fill. */
    window(x, y, w, h, fill = '#ebeac5') {
      px.rect('#171717', x, y, w, h);
      px.rect(fill, x + 1, y + 1, w - 2, h - 2);
    },

    /** A label in a framed panel, centred on `cx`. */
    sign(str, cx, y, size = 12, bg = '#ebeac5', fg = '#202020') {
      const w = px.textW(str, size) + 10, h = size + 5;
      px.window(cx - w / 2, y, w, h, bg);
      px.text(str, cx, y + 2, size, fg, 'center');
    },

    /** A banded sky from colour `top` to colour `bot` (both #rrggbb). */
    sky(top, bot) {
      const ch = (hex, p) => parseInt(hex.substr(p, 2), 16);
      for (let i = 0; i < 10; i++) {
        const k = i / 9;
        const col = [1, 3, 5].map((p) => Math.round(ch(top, p) * (1 - k) + ch(bot, p) * k).toString(16).padStart(2, '0'));
        px.rect('#' + col.join(''), 0, i * 18, W, 18);
      }
    },

    /** Twinkling stars across the top of the picture. */
    stars(t) {
      for (let i = 0; i < 34; i++) {
        const x = (i * 97) % W, y = (i * 53) % 96;
        if ((i + Math.floor(t * 2)) % 7) px.rect('#fdf6e3', x, y, 1, 1);
      }
    },

    /** A crescent moon. */
    moon(cx = 280, cy = 26) {
      for (let y = -9; y <= 9; y++) {
        for (let x = -9; x <= 9; x++) {
          if (x * x + y * y <= 81 && (x - 5) * (x - 5) + (y + 3) * (y + 3) > 56) px.rect('#fdf6e3', cx + x, cy + y, 1, 1);
        }
      }
    },

    /**
     * One of the reel's pictures (see `images` in reel.js), fitted inside the box and framed.
     * Smoothed, so photos and screenshots never shimmer. Returns where it landed, or null
     * while it is still loading.
     */
    image(name, x = 0, y = 0, w = W, h = H, frame = true) {
      const img = images[name];
      if (!img || !img.complete || !img.naturalWidth) { px.rect('#13203a', x, y, w, h); return null; }
      const k = Math.min(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, dx, dy, dw, dh);
      g.imageSmoothingEnabled = false;
      if (frame) { g.strokeStyle = '#171717'; g.lineWidth = 2; g.strokeRect(dx - 1, dy - 1, dw + 2, dh + 2); }
      return { x: dx, y: dy, w: dw, h: dh, k };
    },

    /** A gentle bounce: add it to a y position. */
    bob(t, speed = 3, amp = 2) { return Math.round(Math.sin(t * speed) * amp); },

    /** True once item `i` of a list should show, revealing one every `every` seconds from `start`. */
    shown(t, i, every = 2.5, start = 0.5) { return t >= start + i * every; }
  };
  return px;
}
