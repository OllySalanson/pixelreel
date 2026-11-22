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
/** Whether a run of pixels, `run` wide from x, y, lies where words sit. */
const amongWords = (quiet, x, y, run = 1) => quiet.some(([qx, qy, qw, qh]) => x + run > qx && x < qx + qw && y >= qy && y < qy + qh);

function stars(px, w, h, t, seed, quiet = [], y0 = 0) {
  const n = Math.round((w * h) / 520);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rand(seed + i * 1.37) * w), y = y0 + Math.floor(rand(seed + i * 2.71 + 5) ** 1.5 * h);
    const beat = Math.floor(t * 1.2 + rand(i + 0.5) * 9) % 9;
    if (beat === 0 || amongWords(quiet, x, y)) continue;
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

/** How big Reelie is, in a scene's pixels. */
export const REELIE = { w: SPRITES.reelie.rows[0].length, h: SPRITES.reelie.rows.length };

/** Which way Reelie's eyes turn for something at (px, py), seen from its face at (cx, cy): -1, 0 or 1 across and down. */
export const lookAt = (cx, cy, px, py) => [px - cx, py - cy].map((d) => (Math.abs(d) < 10 ? 0 : Math.sign(d)));

/** How far off the ground Reelie is `s` seconds after it is pressed: one hop, of about half a second. */
export const hopHeight = (s) => (s >= 0 && s < 0.5 ? Math.round(7 * Math.sin((Math.PI * s) / 0.5)) : 0);

/** What Reelie says when it is pressed: something new each time, and short enough for a phone. */
export const SAYINGS = ['Hello!', 'Tea?', 'Press Play!', 'Oi oi.', 'Ooh.', 'You rang?', 'Again!', 'Mind out.'];

/**
 * Reelie, the film reel, bobbing gently. With `asleep`, eyes shut and a few Zs, which fade
 * out before they reach any words (`quiet`). `look` ([across, down], each -1, 0 or 1) turns
 * its eyes, and `hop` lifts it that many pixels off the ground.
 */
export function reelie(px, x, y, t, { asleep = false, still = false, quiet = [], look = null, hop = 0 } = {}) {
  const bob = still || asleep ? 0 : Math.round(Math.sin(t * 2.2) * 1), cx = x + 13, cy = y + 13 + bob - hop;
  px.sprite(SPRITES.reelie.rows, x, y + bob - hop, 1, false, SPRITES.reelie.colours);
  if (look && !asleep && (look[0] || look[1])) {
    // its eyes are two pixels tall, three either side of the middle: paint them out, and in again where it is looking
    px.rect(GOLD, cx - 3, cy - 2, 1, 2); px.rect(GOLD, cx + 3, cy - 2, 1, 2);
    px.rect(INK, cx - 3 + look[0], cy - 2 + look[1], 1, 2); px.rect(INK, cx + 3 + look[0], cy - 2 + look[1], 1, 2);
  }
  if (asleep || (!still && t % 4.1 > 3.95)) {
    px.rect(GOLD, cx - 3, cy - 2, 1, 2); px.rect(GOLD, cx + 3, cy - 2, 1, 2);
    px.rect(INK, cx - 4, cy - 1, 3, 1); px.rect(INK, cx + 2, cy - 1, 3, 1);
  }
  if (asleep) {
    px.rect(GOLD, cx - 2, cy + 2, 5, 2); px.rect(INK, cx - 1, cy + 3, 2, 1);
    for (let k = 0; k < 3; k++) {
      const age = still ? k / 3 : (t * 0.25 + k / 3) % 1, size = 10 + k * 2;
      const zx = cx + 12 + Math.round(age * 9), zy = cy - 12 - Math.round(age * 16);
      if (!amongWords(quiet, zx, zy, size)) px.text('z', zx, zy, size, STAR);
    }
  }
}

/**
 * A shooting star, once in a while, in the top of a sky h pixels deep that starts `top` down.
 * It passes behind the words (`quiet`), never across them.
 */
function shootingStar(px, w, h, t, { still = false, every = 11, quiet = [], top = 0 } = {}) {
  if (still) return;
  const turn = Math.floor(t / every), age = (t % every) / 0.9;
  if (age > 1) return;
  const x = Math.round(rand(turn * 3.3) * w * 0.7 + w * 0.2 - age * 46), y = Math.round(rand(turn * 7.7) * h * 0.35 + top + 6 + age * 20);
  for (let k = 0; k < 7; k++) {
    const run = k > 4 ? 1 : 2;
    if (!amongWords(quiet, x + k * 2, y - k, run)) px.rect(k < 2 ? STAR : FAINT, x + k * 2, y - k, run, 1);
  }
}

/**
 * What Reelie (standing at x, y) says, in a bubble over its head, or beside its head where
 * words are in the way above: a bubble has a ground of its own, so it may stand in the room
 * kept round the words, but never on them.
 */
function says(px, words, x, y, quiet) {
  if (!amongWords(quiet, x - 2, y - 19 + ROOM, 60)) px.bubble(words, x - 2, y - 19, 12, x + 13);
  else if (!amongWords(quiet, x + REELIE.w + 2, y + 3 + ROOM, 60)) px.bubble(words, x + REELIE.w + 2, y + 3, 12);
}

/**
 * Each scene: draw(px, w, h, t, { quiet, paper, still, met, pointer, poked, pokes }) paints it
 * w x h pixels big at time t. `quiet` is where words sit (no stars there), `paper` the
 * page's colour, `still` holds it calm, and `met` is how many seconds ago its foot first
 * came into view (null: not yet). `pointer` is where the pointer is, in the scene's pixels;
 * `poked` how many seconds ago Reelie was last pressed, and `pokes` how many times so far.
 * A scene with Reelie in it gives back where: { reelie: [x, y, w, h] }.
 */
/**
 * How far round the words a scene is kept plain, in its own pixels: scenery.js makes each
 * `quiet` zone this much bigger than the words in it. The tallest OpenDyslexic heading
 * reaches 34 page pixels past its own line.
 */
export const ROOM = 9;

const HELLO = [0.5, 5];   // when Reelie's hello shows, in seconds after you first see it
const SAY_S = 2.2;        // how long what Reelie says when pressed stays up, in seconds
const WAKE_S = 4;         // how long sleeping Reelie stays awake when pressed
const FILM = 11;          // how far in from the top and the foot of the cinema its strips of film reach (.cinema in site.css)

export const SCENES = {
  // the top of the home page: night, with dawn on its way, and the page itself as the nearest hill
  hero(px, w, h, t, { quiet = [], paper = PAPER, still = false, met = null, pointer = null, poked = null, pokes = 0 } = {}) {
    // the sky is plain behind the words, and glows only below them, low down behind the hills
    const horizon = h - 32, words = Math.max(0, ...quiet.map(([, y, , qh]) => y + qh));
    const glow = Math.max(14, Math.min(44, horizon - words));
    px.rect(NIGHT, 0, 0, w, horizon - glow);
    sky(px, w, horizon - glow, horizon + 2, [[0, NIGHT], [0.26, '#152748'], [0.46, '#2c4c84'], [0.62, '#544b8d'], [0.76, '#a2587e'], [0.9, '#ee8a5f'], [1, '#ffc46b']]);
    stars(px, w, horizon - 20, t, 3, quiet);
    shootingStar(px, w, horizon - glow, t, { still, quiet });
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
    // Reelie watches the pointer, and hops when it is pressed; held still, it does neither
    const hop = still ? 0 : hopHeight(poked ?? -1);
    reelie(px, at, top, t, { still, hop, look: still || !pointer ? null : lookAt(at + 13, top + 12, ...pointer) });
    // Reelie says hello, once, when you first reach it (it stands below the first screenful),
    // and something else each time it is pressed; over its head, clear of the cottage, and
    // never when pictures are held still (the bubble has a ground of its own, so it may
    // stand in the room round the words, but not on them)
    const pressed = poked !== null && poked < SAY_S, hello = met !== null && met > HELLO[0] && met < HELLO[1];
    if (!still && (pressed || hello)) says(px, pressed ? SAYINGS[pokes % SAYINGS.length] : SAYINGS[0], at, top - hop, quiet);
    return { reelie: [at, top, REELIE.w, REELIE.h] };
  },

  // now showing: just the night sky
  cinema(px, w, h, t, { quiet = [], still = false } = {}) {
    px.rect(NIGHT, 0, 0, w, h);
    stars(px, w, h - 2 * FILM, t, 7, quiet, FILM);   // between the strips of film, not in among their holes
    shootingStar(px, w, h - 2 * FILM, t + 5, { still, every: 14, quiet, top: FILM });
  },

  // the last word: day gives way to night
  finale(px, w, h, t, { quiet = [], paper = PAPER } = {}) {
    // the dusk fades out above the words, however close to the top a narrow screen puts them
    const dusk = Math.max(8, Math.min(h, 52, ...quiet.map(([, y]) => y)));
    sky(px, w, 0, dusk, [[0, paper], [0.2, '#ffd98a'], [0.4, '#f29b62'], [0.58, '#b55c7c'], [0.76, '#5a4b8b'], [0.9, '#1f2f58'], [1, NIGHT]]);
    px.rect(NIGHT, 0, dusk, w, h - dusk);
    stars(px, w, h - dusk + 8, t, 13, quiet, dusk - 8);
  },

  // the foot of the page: hills, the moon, and Reelie fast asleep
  footer(px, w, h, t, { quiet = [], still = false, poked = null } = {}) {
    px.rect(NIGHT, 0, 0, w, h);
    stars(px, w, h - 30, t, 21, quiet);
    moon(px, w - Math.max(14, Math.round(w * 0.08)), 6, 5);   // small, above the footer's rule (3rem down), so the line never crosses it
    const far = ridge(w, h - 12, 18, 14), near = ridge(w, h - 2, 14, 17);
    ground(px, far, '#17294a', h);
    pines(px, far, '#17294a', 3);
    ground(px, near, '#0d1930', h);
    const at = Math.round(Math.min(w - 44, Math.max(12, w * 0.07))), top = near[at + 13] - 27;
    // pressed, Reelie wakes for a moment, says goodnight, and goes back to sleep
    const woken = !still && poked !== null && poked < WAKE_S;
    reelie(px, at, top, t, { asleep: !woken, still, quiet });
    if (woken) says(px, poked < WAKE_S / 2 ? 'Mmm?' : 'Night night.', at, top, quiet);
    return { reelie: [at, top, REELIE.w, REELIE.h] };
  }
};
