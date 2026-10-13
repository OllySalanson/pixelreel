// Transitions: how one picture gives way to the next. Pure geometry on the grid of
// logical pixels, so the tests can check any frame without a canvas. px.transition() in
// kit.js does the drawing, both for the player between scenes and for a scene that wants
// one inside its own picture.

/** Every transition, by name. 'cut', the default, switches at once. */
export const TRANSITIONS = ['cut', 'fade', 'dissolve', 'wipe', 'slide', 'blinds', 'iris', 'flash', 'star'];

const LENGTH_MS = { cut: 0, fade: 900, dissolve: 800, wipe: 700, slide: 700, blinds: 700, iris: 1100, flash: 500, star: 1000 };

/** How long a transition takes, in ms. */
export function transitionMs(kind) {
  return LENGTH_MS[kind] ?? 0;
}

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const easeIn = (k) => k * k * k;
const easeOut = (k) => 1 - (1 - k) ** 3;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
// a fixed scatter in [0, 1) for each block, the same on every frame
const scatter = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * Frame `p` (0 to 1) of a transition inside `box` ({ x, y, w, h }). Returns:
 *   newAt  [dx, dy]  where to draw the incoming picture (clipped to the box)
 *   oldAt  [dx, dy]  where to draw the outgoing picture
 *   old    [[x, y, w, h], ...]  where the outgoing picture shows, over the incoming one
 *   cover  null, { colour, rects } painted solid, or { colour, level }: an ordered dither
 *          over the whole box, from 0 (none) to 1 (solid)
 */
export function transitionFrame(kind, p, box) {
  p = clamp01(p);
  const { x, y, w, h } = box;
  const frame = { newAt: [0, 0], oldAt: [0, 0], old: [], cover: null };
  const whole = [[x, y, w, h]];
  switch (kind) {
    case 'fade':     // dithers down to black, then back up into the new picture
    case 'flash': {  // the same, through a white flash
      if (p < 0.5) frame.old = whole;
      frame.cover = { colour: kind === 'fade' ? '#000000' : '#fdf6e3', level: p < 0.5 ? p * 2 : (1 - p) * 2 };
      break;
    }
    case 'dissolve': {   // the old picture crumbles away in blocks
      const s = Math.max(4, Math.round(w / 40));
      for (let j = 0; j * s < h; j++) {
        for (let i = 0; i * s < w; i++) {
          if (scatter(i, j) >= p) frame.old.push([x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s)]);
        }
      }
      break;
    }
    case 'wipe': {   // left to right, behind a zigzag edge
      const band = Math.max(3, Math.round(h / 30));
      const edge = x - 2 * band + easeInOut(p) * (w + 2 * band);
      for (let j = 0; j * band < h; j++) {
        const tooth = j % 4 < 2 ? j % 4 : 4 - (j % 4);   // 0, 1, 2, 1, 0, ...
        const from = Math.max(x, Math.round(edge + tooth * band));
        if (from < x + w) frame.old.push([from, y + j * band, x + w - from, Math.min(band, h - j * band)]);
      }
      break;
    }
    case 'slide': {   // the new picture pushes the old one off to the left
      const shift = Math.round(easeInOut(p) * w);
      frame.newAt = [w - shift, 0];
      frame.oldAt = [-shift, 0];
      if (shift < w) frame.old = [[x, y, w - shift, h]];
      break;
    }
    case 'blinds': {   // slats close over the old picture
      const s = Math.max(4, Math.round(h / 12));
      const left = Math.round(s * (1 - easeInOut(p)));
      if (left > 0) for (let j = 0; j * s < h; j++) frame.old.push([x, y + j * s, w, Math.min(left, h - j * s)]);
      break;
    }
    case 'iris': {   // a closing circle, like the end of an old cartoon, then opening on the new picture
      const R = Math.hypot(w, h) / 2 + 1;
      let r = 0;
      if (p < 0.45) { frame.old = whole; r = R * (1 - easeIn(p / 0.45)); }
      else if (p > 0.55) r = R * easeOut((p - 0.55) / 0.45);
      frame.cover = { colour: '#000000', rects: outside(box, (row) => circleSpan(x + w / 2, y + h / 2, r, row)) };
      break;
    }
    case 'star': {   // the new picture bursts out of a spinning star. You know what you did.
      const outer = (Math.hypot(w, h) / 2) * 2.5 * easeIn(p), turn = p * 2.4;
      const points = [];
      for (let k = 0; k < 10; k++) {
        const a = turn - Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? outer * 0.45 : outer;
        points.push([x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r]);
      }
      frame.old = outside(box, (row) => polygonSpans(points, row));
      break;
    }
    default:   // 'cut'
      break;
  }
  return frame;
}

/** Where the horizontal line through the middle of pixel row `row` crosses a circle: [[from, to]] or []. */
function circleSpan(cx, cy, r, row) {
  const dy = row + 0.5 - cy;
  if (Math.abs(dy) >= r) return [];
  const half = Math.sqrt(r * r - dy * dy);
  return [[cx - half, cx + half]];
}

/** The parts of pixel row `row` inside a polygon, as [[from, to], ...] (even-odd rule). */
function polygonSpans(points, row) {
  const yy = row + 0.5, xs = [];
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    if ((y1 <= yy) !== (y2 <= yy)) xs.push(x1 + ((yy - y1) / (y2 - y1)) * (x2 - x1));
  }
  xs.sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
  return spans;
}

/** One-pixel-high rects covering each row of `box` outside the spans `inside(row)` returns. */
function outside(box, inside) {
  const rects = [];
  const right = box.x + box.w;
  for (let row = box.y; row < box.y + box.h; row++) {
    let at = box.x;
    for (const [from, to] of inside(row)) {
      const a = Math.max(box.x, Math.min(right, Math.round(from))), b = Math.max(box.x, Math.min(right, Math.round(to)));
      if (a > at) rects.push([at, row, a - at, 1]);
      at = Math.max(at, b);
    }
    if (at < right) rects.push([at, row, right - at, 1]);
  }
  return rects;
}
