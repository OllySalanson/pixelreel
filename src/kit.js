// The pixel kit: the drawing helpers every scene's draw(t, px) receives.
// Scenes draw on a 320x180 grid of logical pixels; the player scales it up crisply.
import { drawPicture } from './pictures.js';
import { transitionFrame } from './transitions.js';

export const W = 320;
export const H = 180;
export const FONT = "'Orange Kid', monospace";

/** Palette letters for px.sprite(). Any other character is used as a CSS colour. */
export const PALETTE = {
  k: '#1a1a1a', s: '#f2c194', b: '#1f4e9c', B: '#163a75', y: '#ffcc4d', w: '#fdf6e3', r: '#d63a3a', R: '#a52222',
  n: '#7a4a24', N: '#5a3418', g: '#3fa34d', G: '#2a7a35', e: '#9fb3c8', o: '#ff8c2a', p: '#8e5bd6', t: '#55d6be',
  c: '#ebeac5'
};

/** Easing curves for px.tween(): each turns progress from 0 to 1 into a shaped 0 to 1. */
export const EASE = {
  linear: (k) => k,
  in: (k) => k * k * k,
  out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  back: (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
  bounce(k) {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) { k -= 1.5 / d; return n * k * k + 0.75; }
    if (k < 2.5 / d) { k -= 2.25 / d; return n * k * k + 0.9375; }
    k -= 2.625 / d;
    return n * k * k + 0.984375;
  },
  elastic: (k) => (k <= 0 || k >= 1 ? k : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1)
};

/** A steady pseudo-random number in [0, 1) for any number `n`: the same `n` always gives the same answer. */
export function rand(n) {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const mod = (a, n) => ((a % n) + n) % n;
const CONFETTI = ['#ffcc4d', '#55d6be', '#d63a3a', '#8e5bd6', '#ff8c2a', '#fdf6e3', '#3fa34d'];
// thresholds of a 4x4 ordered dither, for px.dither()
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

/**
 * @param {CanvasRenderingContext2D} g   a context already scaled so 1 unit = 1 logical pixel
 * @param {Record<string, HTMLImageElement>} images   the reel's pictures, by name
 */
export function createKit(g, images = {}) {
  const patterns = new Map();

  /** A repeating 4x4 dither tile at the canvas's real resolution, so it stays crisp when scaled. */
  function ditherPattern(colour, steps) {
    if (!g.createPattern || typeof DOMMatrix === 'undefined') return null;
    const m = g.getTransform();
    const k = Math.max(1, Math.round(Math.hypot(m.a, m.b)));
    const key = `${colour}|${steps}|${k}`;
    if (!patterns.has(key)) {
      const tile = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(4 * k, 4 * k)
        : Object.assign(document.createElement('canvas'), { width: 4 * k, height: 4 * k });
      const tg = tile.getContext('2d');
      tg.fillStyle = colour;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (BAYER[j][i] < steps) tg.fillRect(i * k, j * k, k, k);
      const pattern = g.createPattern(tile, 'repeat');
      pattern.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0]));
      patterns.set(key, pattern);
    }
    return patterns.get(key);
  }

  const px = {
    W, H, PAL: PALETTE, EASE,

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

    /** Pixel-font text. `align` is 'left', 'center' or 'right'; `shadow`, a colour, adds a drop shadow. */
    text(str, x, y, size = 12, col = '#fdf6e3', align = 'left', shadow = null) {
      g.font = size + 'px ' + FONT; g.textBaseline = 'top'; g.textAlign = align;
      if (shadow) { g.fillStyle = shadow; g.fillText(str, Math.round(x) + 1, Math.round(y) + 1); }
      g.fillStyle = col;
      g.fillText(str, Math.round(x), Math.round(y));
      g.textAlign = 'left';
    },

    /** The width `str` takes in the pixel font. */
    textW(str, size = 12) { g.font = size + 'px ' + FONT; return Math.ceil(g.measureText(str).width); },

    /** Breaks `str` into lines no wider than `maxW` (a newline always breaks). */
    wrap(str, maxW, size = 12) {
      const lines = [];
      for (const para of String(str).split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const longer = line ? line + ' ' + word : word;
          if (line && px.textW(longer, size) > maxW) { lines.push(line); line = word; } else line = longer;
        }
        lines.push(line);
      }
      return lines;
    },

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

    /**
     * A speech bubble with its top-left corner at x, y, wrapped to `maxW`. With `tailX`, a tail
     * under it points down at that x. Returns where it landed: { x, y, w, h }.
     */
    bubble(str, x, y, size = 12, tailX = null, bg = '#fdf6e3', fg = '#202020', maxW = 150) {
      const lines = px.wrap(str, maxW, size), lh = size + 1;
      const w = Math.max(...lines.map((l) => px.textW(l, size))) + 10, h = lines.length * lh + 5;
      x = Math.round(x); y = Math.round(y);
      px.rect('#171717', x + 1, y, w - 2, h); px.rect('#171717', x, y + 1, w, h - 2);
      px.rect(bg, x + 1, y + 1, w - 2, h - 2);
      if (tailX !== null) {
        const tx = Math.round(Math.max(x + 3, Math.min(x + w - 10, tailX - 3)));
        px.rect(bg, tx + 1, y + h - 1, 5, 1);
        px.rect('#171717', tx + 1, y + h, 1, 1); px.rect(bg, tx + 2, y + h, 3, 1); px.rect('#171717', tx + 5, y + h, 1, 1);
        px.rect('#171717', tx + 2, y + h + 1, 1, 1); px.rect(bg, tx + 3, y + h + 1, 1, 1); px.rect('#171717', tx + 4, y + h + 1, 1, 1);
        px.rect('#171717', tx + 3, y + h + 2, 1, 1);
      }
      lines.forEach((l, i) => px.text(l, x + 5, y + 2 + i * lh, size, fg));
      return { x, y, w, h };
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
     * Rolling hills along the bottom of the picture, tops between y - amp and y. The shape
     * repeats every 320 pixels, so moving `shift` scrolls them forever: px.hills(c, 140, 20, t * 15).
     * A different `seed` gives a different range.
     */
    hills(c, y, amp = 16, shift = 0, seed = 1) {
      const waves = [0, 1, 2, 3].map((i) => [1 + i * 2 + Math.floor(rand(seed * 7 + i) * 2), rand(seed * 13 + i) * 2 * Math.PI, 1 / (i + 1)]);
      const total = waves.reduce((s, [, , a]) => s + a, 0), s0 = Math.round(shift);
      let runX = 0, runTop = null;
      for (let x = 0; x <= W; x++) {
        let top = null;
        if (x < W) {
          const u = ((x + s0) / W) * 2 * Math.PI;
          const v = waves.reduce((s, [f, ph, a]) => s + a * Math.sin(f * u + ph), 0) / total;
          top = Math.round(y - amp * (0.5 + 0.5 * v));
        }
        if (top !== runTop) {
          if (runTop !== null) px.rect(c, runX, runTop, x - runX, H - runTop);
          runX = x; runTop = top;
        }
      }
    },

    /** A few chunky clouds drifting right to left across a band starting at y. */
    clouds(t, y, speed = 6, colour = '#fdf6e3', count = 3, seed = 1) {
      for (let i = 0; i < count; i++) {
        const w = 22 + Math.floor(rand(seed * 5 + i) * 26), span = W + w + 20;
        const x = W + 10 - mod(rand(seed * 3 + i) * span + t * speed * (0.75 + rand(seed + i) * 0.5), span);
        const yy = y + Math.floor(rand(seed * 11 + i) * 22);
        px.rect(colour, x + 2, yy, w - 4, 8); px.rect(colour, x, yy + 2, w, 4);
        px.rect(colour, x + w * 0.25 + 2, yy - 4, w * 0.4 - 4, 4); px.rect(colour, x + w * 0.25, yy - 2, w * 0.4, 2);
      }
    },

    /** Calls draw(x) once for each copy of a `width`-wide layer needed to fill the picture, scrolled `speed` px a second. */
    parallax(t, speed, width, draw) {
      const from = -Math.round(mod(t * speed, width));
      for (let x = from; x < W; x += width) draw(x);
    },

    /** A filled circle. */
    circle(c, cx, cy, r) {
      cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
        px.rect(c, cx - half, cy + dy, half * 2 + 1, 1);
      }
    },

    /** A circle outline, `w` pixels thick. */
    ring(c, cx, cy, r, w = 1) {
      cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
      const inner = r - w;
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
        if (inner < 0 || Math.abs(dy) > inner) { px.rect(c, cx - half, cy + dy, half * 2 + 1, 1); continue; }
        const hole = Math.floor(Math.sqrt((inner + 0.5) ** 2 - dy * dy));
        px.rect(c, cx - half, cy + dy, half - hole, 1);
        px.rect(c, cx + hole + 1, cy + dy, half - hole, 1);
      }
    },

    /** A one-pixel line from x0, y0 to x1, y1. */
    line(c, x0, y0, x1, y1) {
      [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.round);
      if (![x0, y0, x1, y1].every(Number.isFinite)) return;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        px.rect(c, x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) return;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },

    /** Speckles a box with colour `c` in an ordered dither: `level` 0 leaves it clear, 1 fills it. */
    dither(c, x, y, w, h, level) {
      const steps = Math.round(Math.max(0, Math.min(1, level)) * 16);
      if (steps <= 0) return;
      if (steps >= 16) { px.rect(c, x, y, w, h); return; }
      [x, y, w, h] = [x, y, w, h].map(Math.round);
      const pattern = ditherPattern(c, steps);
      if (pattern) { g.fillStyle = pattern; g.fillRect(x, y, w, h); return; }
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (BAYER[mod(j, 4)][mod(i, 4)] < steps) px.rect(c, i, j, 1, 1);
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
    shown(t, i, every = 2.5, start = 0.5) { return t >= start + i * every; },

    /** Part of the way from a to b: k = 0 gives a, k = 1 gives b. */
    lerp(a, b, k) { return a + (b - a) * k; },

    /** Keeps v between lo and hi. */
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },

    rand,

    /**
     * Animates a number from `from` to `to` over `dur` seconds starting at `start`, shaped by
     * an easing curve: 'linear', 'in', 'out' (the default), 'inOut', 'back', 'bounce', 'elastic'.
     */
    tween(t, start, dur, from, to, ease = 'out') {
      const k = dur > 0 ? Math.max(0, Math.min(1, (t - start) / dur)) : t >= start ? 1 : 0;
      return from + (to - from) * (typeof ease === 'function' ? ease : EASE[ease] ?? EASE.out)(k);
    },

    /** Picks the frame of an animation for time t: `frames` is a list (of sprites, colours, anything), shown `fps` a second. */
    frame(t, fps, frames) { return frames[mod(Math.floor(t * fps), frames.length)]; },

    /** True for the first half of every blink: `rate` blinks a second. */
    blink(t, rate = 2) { return mod(Math.floor(t * rate * 2), 2) === 0; },

    /** The part of `str` typed so far, `cps` characters a second from `start`. */
    typed(str, t, start = 0, cps = 15) { return String(str).slice(0, Math.max(0, Math.floor((t - start) * cps + 1e-9))); },

    /** Types `str` out from `start`, with a cursor while it types. Returns true once it is all there. */
    type(str, x, y, t, size = 12, col = '#fdf6e3', start = 0, cps = 15) {
      if (t < start) return false;
      const shown = px.typed(str, t, start, cps), done = shown.length >= String(str).length;
      px.text(shown, x, y, size, col);
      if (!done) px.rect(col, x + px.textW(shown, size) + 1, y + Math.round(size * 0.15), Math.max(2, Math.round(size / 4)), Math.round(size * 0.7));
      return done;
    },

    /** A burst of confetti from x, y at time `start`, falling away over about two seconds. */
    confetti(t, start, x, y, count = 40) {
      const dt = t - start;
      if (dt < 0 || dt > 3) return;
      for (let i = 0; i < count; i++) {
        if (dt > 1.6 + rand(i * 3.1) * 1.2) continue;
        const a = -Math.PI / 2 + (rand(i * 1.7) - 0.5) * 2.4, v = 60 + rand(i * 2.3) * 100;
        const cx = x + Math.cos(a) * v * dt + Math.sin(dt * 7 + i) * 3 * dt, cy = y + Math.sin(a) * v * dt + 95 * dt * dt;
        const spin = mod(Math.floor(dt * 12 + i), 3);   // pieces tumble as they fall
        px.rect(CONFETTI[i % CONFETTI.length], cx, cy, [3, 2, 1][spin], [1, 2, 3][spin]);
      }
    },

    /** A little star that twinkles at x, y. */
    sparkle(x, y, t, col = '#fdf6e3', rate = 6) {
      const n = [0, 1, 2, 1][mod(Math.floor(t * rate), 4)];
      px.rect(col, x, y, 1, 1);
      for (let k = 1; k <= n; k++) {
        px.rect(col, x - k, y, 1, 1); px.rect(col, x + k, y, 1, 1);
        px.rect(col, x, y - k, 1, 1); px.rect(col, x, y + k, 1, 1);
      }
    },

    /** A shake that starts at `start` and dies away over `dur` seconds: returns [dx, dy] to add to positions, or pass to px.shift(). */
    shake(t, start, dur = 0.5, amp = 3) {
      const k = (t - start) / dur;
      if (!(k >= 0 && k < 1)) return [0, 0];
      const f = Math.floor(t * 30), a = amp * (1 - k);
      return [Math.round((rand(f) * 2 - 1) * a), Math.round((rand(f + 99) * 2 - 1) * a)];
    },

    /** Draws whatever fn() draws moved by dx, dy (whole pixels). */
    shift(dx, dy, fn) {
      g.save(); g.translate(Math.round(dx), Math.round(dy));
      try { fn(); } finally { g.restore(); }
    },

    /** Draws whatever fn() draws magnified `k` times around cx, cy. Whole numbers keep the pixels square. */
    zoom(k, cx, cy, fn) {
      g.save(); g.translate(cx, cy); g.scale(k, k); g.translate(-cx, -cy);
      try { fn(); } finally { g.restore(); }
    },

    /** Draws whatever fn() draws only inside `rects`, a list of [x, y, w, h]. */
    clip(rects, fn) {
      g.save(); g.beginPath();
      for (const [x, y, w, h] of rects) g.rect(x, y, w, h);
      g.clip();
      try { fn(); } finally { g.restore(); }
    },

    /**
     * Frame `p` (0 to 1) of a transition from one picture to another inside `box`: drawOld()
     * and drawNew() each paint a whole picture. The player uses this between scenes; a scene
     * can use it too. `kind` is one of the transitions (see transitions.js).
     */
    transition(kind, p, drawOld, drawNew, box = { x: 0, y: 0, w: W, h: H }) {
      const f = transitionFrame(kind, p, box);
      px.clip([[box.x, box.y, box.w, box.h]], () => px.shift(f.newAt[0], f.newAt[1], drawNew));
      if (f.old.length) px.clip(f.old, () => px.shift(f.oldAt[0], f.oldAt[1], drawOld));
      if (f.cover?.rects) for (const [x, y, w, h] of f.cover.rects) px.rect(f.cover.colour, x, y, w, h);
      else if (f.cover) px.dither(f.cover.colour, box.x, box.y, box.w, box.h, f.cover.level);
    },

    /** Draws a ready-made picture (the same `picture` objects a scene can have) at time t. */
    picture(spec, t) { drawPicture(spec, t, px); }
  };
  return px;
}
