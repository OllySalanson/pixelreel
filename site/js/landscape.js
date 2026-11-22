// The pixel landscapes behind the site's night bands, and Reelie who lives in them. Pure
// drawing with the player's own pixel kit: given a kit, a size and a time, each scene paints
// itself. scenery.js puts them on the page; scripts/site-art.mjs draws the share picture.
import { SPRITES } from './sprites.js';
import { rand } from '../../src/kit.js';

const NIGHT = '#0b1220', STAR = '#fdf6e3', FAINT = '#8fa3c4', GOLD = '#ffcc4d', INK = '#1a1a1a', PAPER = '#faf3e1';

/** A band of sky from y0 to y1 through `stops` ([[0 to 1, '#rrggbb'], ...]), each colour dithered into the next. */
function sky(px, w, y0, y1, stops) {
  for (let y = y0; y < y1; y += 2) {
    const p = (y - y0) / (y1 - y0);
    let i = 0;
    while (i < stops.length - 2 && p >= stops[i + 1][0]) i++;
    const [from, colour] = stops[i], [to, next] = stops[i + 1];
    px.rect(colour, 0, y, w, 2);
    px.dither(next, 0, y, w, 2, Math.round(Math.max(0, Math.min(1, (p - from) / (to - from))) * 8) / 8);
  }
}

/**
 * Stars over w x h, thicker towards the top, each twinkling in its own time. None is drawn
 * inside `quiet` (a list of [x, y, w, h]): words are easier to read on a plain background.
 */
function stars(px, w, h, t, seed, quiet = [], y0 = 0) {
  const n = Math.round((w * h) / 520);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rand(seed + i * 1.37) * w), y = y0 + Math.floor(rand(seed + i * 2.71 + 5) ** 1.5 * h);
    const beat = Math.floor(t * 1.2 + rand(i + 0.5) * 9) % 9;
    if (beat === 0 || quiet.some(([qx, qy, qw, qh]) => x >= qx && x < qx + qw && y >= qy && y < qy + qh)) continue;
    px.rect(i % 4 ? STAR : FAINT, x, y, 1, 1);
    if (i % 19 === 0 && beat > 4) { px.rect(STAR, x - 1, y, 3, 1); px.rect(STAR, x, y - 1, 1, 3); }
  }
}

/** A crescent moon, r pixels across its half. */
function moon(px, cx, cy, r = 11) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r && (x - r * 0.55) ** 2 + (y + r * 0.3) ** 2 > r * r * 0.7) px.rect(STAR, cx + x, cy + y, 1, 1);
    }
  }
}

/** The top of a rolling ridge at every x: between base - amp and base. A different seed gives a different ridge. */
function ridge(w, base, amp, seed, period = 420) {
  const waves = [0, 1, 2, 3].map((i) => [1 + i * 2 + Math.floor(rand(seed * 7 + i) * 2), rand(seed * 13 + i) * 2 * Math.PI, 1 / (i + 1)]);
  const total = waves.reduce((sum, [, , a]) => sum + a, 0);
  return Array.from({ length: w }, (_, x) => {
    const u = (x / period) * 2 * Math.PI;
    return Math.round(base - amp * (0.5 + 0.5 * waves.reduce((sum, [f, phase, a]) => sum + a * Math.sin(f * u + phase), 0) / total));
  });
}

/** Fills everything under a ridge's tops, down to h. */
function ground(px, tops, colour, h) {
  let from = 0;
  for (let x = 1; x <= tops.length; x++) {
    if (x === tops.length || tops[x] !== tops[from]) { px.rect(colour, from, tops[from], x - from, h - tops[from]); from = x; }
  }
}

const PINE = ['..k..', '..k..', '.kkk.', '.kkk.', 'kkkkk', '.kkk.', 'kkkkk', 'kkkkk', '..k..'];

/** Pine trees standing along a ridge, here and there. */
function pines(px, tops, colour, seed, every = 23) {
  for (let i = 0, x = 6; x < tops.length - 6; i++, x += every + Math.floor(rand(seed + i) * every)) {
    if (rand(seed * 3 + i) < 0.35) continue;
    px.sprite(PINE, x - 2, tops[x] - 8, 1, false, { k: colour });
    if (rand(seed * 5 + i) > 0.5) px.sprite(PINE, x + 4, tops[Math.min(tops.length - 1, x + 6)] - 7, 1, false, { k: colour });
  }
}

/** A cottage with a lit window, and smoke from its chimney. */
function cottage(px, x, y, t, wall, still) {
  px.rect(wall, x, y - 9, 14, 9);
  for (let i = 0; i < 6; i++) px.rect(wall, x - 1 + i, y - 10 - i, 16 - 2 * i, 1);
  px.rect(wall, x + 10, y - 17, 2, 5);
  px.rect(GOLD, x + 3, y - 6, 3, 3);
  px.rect('#ffe08a', x + 3, y - 6, 1, 1);
  px.rect(GOLD, x + 9, y - 6, 2, 3);
  if (still) return;
  for (let k = 0; k < 3; k++) {
    const age = (t * 0.35 + k / 3) % 1;
    px.rect('#3d5378', x + 10 + Math.round(Math.sin(age * 5 + k) * 2 + age * 3), y - 19 - Math.round(age * 12), 2, 2);
  }
}

/** Reelie, the film reel, bobbing gently. With `asleep`, eyes shut and a few Zs. */
export function reelie(px, x, y, t, { asleep = false, still = false } = {}) {
  const bob = still || asleep ? 0 : Math.round(Math.sin(t * 2.2) * 1), cx = x + 13, cy = y + 13 + bob;
  px.sprite(SPRITES.reelie.rows, x, y + bob, 1, false, SPRITES.reelie.colours);
  if (asleep || (!still && t % 4.1 > 3.95)) {
    px.rect(GOLD, cx - 3, cy - 2, 1, 2); px.rect(GOLD, cx + 3, cy - 2, 1, 2);
    px.rect(INK, cx - 4, cy - 1, 3, 1); px.rect(INK, cx + 2, cy - 1, 3, 1);
  }
  if (asleep) {
    px.rect(GOLD, cx - 2, cy + 2, 5, 2); px.rect(INK, cx - 1, cy + 3, 2, 1);
    for (let k = 0; k < 3; k++) {
      const age = still ? k / 3 : (t * 0.25 + k / 3) % 1;
      px.text('z', cx + 12 + Math.round(age * 9), cy - 12 - Math.round(age * 16), 10 + k * 2, STAR);
    }
  }
}

/** A shooting star, once in a while. */
function shootingStar(px, w, h, t, still, every = 11) {
  if (still) return;
  const turn = Math.floor(t / every), age = (t % every) / 0.9;
  if (age > 1) return;
  const x = rand(turn * 3.3) * w * 0.7 + w * 0.2 - age * 46, y = rand(turn * 7.7) * h * 0.35 + 6 + age * 20;
  for (let k = 0; k < 7; k++) px.rect(k < 2 ? STAR : FAINT, x + k * 2, y - k, 2 - (k > 4 ? 1 : 0), 1);
}

/**
 * Each scene: draw(px, w, h, t, { quiet, paper, still, met }) paints it w x h pixels big at
 * time t. `quiet` is where words sit (no stars there), `paper` the page's colour, `still`
 * holds it calm, and `met` is how many seconds ago its foot first came into view (null: not yet).
 */
const HELLO = [0.5, 5];   // when Reelie's hello shows, in seconds after you first see it
const FILM = 11;          // how far in from the top and the foot of the cinema its strips of film reach (.cinema in site.css)

export const SCENES = {
  // the top of the home page: night, with dawn on its way, and the page itself as the nearest hill
  hero(px, w, h, t, { quiet = [], paper = PAPER, still = false, met = null } = {}) {
    // the sky is plain behind the words, and glows only below them, low down behind the hills
    const horizon = h - 32, words = Math.max(0, ...quiet.map(([, y, , qh]) => y + qh));
    const glow = Math.max(14, Math.min(44, horizon - words));
    px.rect(NIGHT, 0, 0, w, horizon - glow);
    sky(px, w, horizon - glow, horizon + 2, [[0, NIGHT], [0.26, '#152748'], [0.46, '#2c4c84'], [0.62, '#544b8d'], [0.76, '#a2587e'], [0.9, '#ee8a5f'], [1, '#ffc46b']]);
    stars(px, w, horizon - 20, t, 3, quiet);
    shootingStar(px, w, horizon - glow, t, still);
    const far = ridge(w, horizon + 2, 20, 4), mid = ridge(w, horizon + 12, 16, 9), near = ridge(w, horizon + 22, 13, 2);
    ground(px, far, '#25385f', h);
    pines(px, far, '#25385f', 11, 31);
    ground(px, mid, '#17294a', h);
    pines(px, mid, '#17294a', 5);
    const home = Math.round(w * (w < 150 ? 0.62 : 0.36));   // clear of Reelie on a narrow screen
    cottage(px, home, mid[home + 7] + 2, t, '#17294a', still);
    ground(px, near, '#0d1930', h);
    pines(px, near, '#0d1930', 8, 37);
    const front = ridge(w, h - 2, 12, 6);
    ground(px, front, paper, h);
    const at = Math.round(Math.min(w - 40, Math.max(12, w * 0.06))), top = front[at + 13] - 27;
    reelie(px, at, top, t, { still });
    // Reelie says hello, once, when you first reach it (it stands below the first screenful);
    // over its head, clear of the cottage, and never when pictures are held still
    if (!still && met !== null && met > HELLO[0] && met < HELLO[1]) px.bubble('Hello!', at - 2, top - 19, 12, at + 13);
  },

  // now showing: just the night sky
  cinema(px, w, h, t, { quiet = [], still = false } = {}) {
    px.rect(NIGHT, 0, 0, w, h);
    stars(px, w, h - 2 * FILM, t, 7, quiet, FILM);   // between the strips of film, not in among their holes
    shootingStar(px, w, h, t + 5, still, 14);
  },

  // the last word: day gives way to night
  finale(px, w, h, t, { quiet = [], paper = PAPER } = {}) {
    const dusk = Math.min(h, 52);
    sky(px, w, 0, dusk, [[0, paper], [0.2, '#ffd98a'], [0.4, '#f29b62'], [0.58, '#b55c7c'], [0.76, '#5a4b8b'], [0.9, '#1f2f58'], [1, NIGHT]]);
    px.rect(NIGHT, 0, dusk, w, h - dusk);
    stars(px, w, h - dusk + 8, t, 13, quiet, dusk - 8);
  },

  // the foot of the page: hills, the moon, and Reelie fast asleep
  footer(px, w, h, t, { quiet = [], still = false } = {}) {
    px.rect(NIGHT, 0, 0, w, h);
    stars(px, w, h - 30, t, 21, quiet);
    moon(px, w - Math.max(22, Math.round(w * 0.08)), 20, 9);
    const far = ridge(w, h - 12, 18, 14), near = ridge(w, h - 2, 14, 17);
    ground(px, far, '#17294a', h);
    pines(px, far, '#17294a', 3);
    ground(px, near, '#0d1930', h);
    const at = Math.round(Math.min(w - 44, Math.max(12, w * 0.07)));
    reelie(px, at, near[at + 13] - 27, t, { asleep: true, still });
  }
};
