// The stage: a ready-made picture that shows something happening, not a sign for it. A place,
// a few things standing in it, and moves between them, each move landing on the words the
// narrator says: a letter flies from the bank to the house, a barrier rises, coins pile up.
// Plain data, like every other picture, so it is checked before it is played and nothing in
// it ever runs. Pure: no DOM. pictures.js draws it and checks it; pacing.mjs times its moves.
import { ICON_SIZE, ICONS } from './icons.js';

const INK = '#1a1a1a', CREAM = '#ebeac5', LIGHT = '#fdf6e3', GOLD = '#ffcc4d', TEAL = '#55d6be';
const RED = '#d63a3a', GREEN = '#3fa34d', NAVY = '#13203a';

/** Where the ground is, in picture pixels: things stand on it, and their labels sit under it. */
export const GROUND = 146;
/** Where a thing in the air has its feet. */
const AIR = 86;

/** The places a stage can be, and what each is like, for whoever chooses one. */
export const PLACES = {
  home: 'Indoors at home: a wall, a window and a wooden floor.',
  outside: 'Outdoors by day: sky, sun and green hills.',
  street: 'A street by day: houses along the back and a pavement.',
  night: 'Outdoors at night: stars, a moon and dark hills.',
  sea: 'The seaside: sky, a strip of sand and the sea.',
  plain: 'A plain dark blue, for things that have no place.'
};

/** The spots a thing can stand in, left to right, and their middles. */
export const SPOTS = { 'far-left': 36, left: 98, middle: 160, right: 222, 'far-right': 284 };
const SPOT_NAMES = Object.keys(SPOTS);
const SPOT_WIDTH = 62;

/** How big a thing is drawn: pixels to one of its icon's. */
export const SIZES = { small: 2, medium: 3, big: 4 };

/** The cast who come back in every reel: Reelie, the film reel who presents. The people are icons (woman, man, ...). */
export const CAST = ['reelie'];

/** What each move shows, and what it takes, for whoever writes a stage (and for the checks). */
export const MOVES = {
  arrive: { says: 'a thing drops in: it is not there until now', needs: ['who'] },
  send: { says: 'something small flies from one thing to another: a letter, money, a message (again: true sends it again and again)', needs: ['what', 'from', 'to'] },
  flow: { says: 'a steady stream of dots from one thing to another: power, data or money moving all the time', needs: ['from', 'to'] },
  wave: { says: 'a sound wave from one thing to another: a voice, a call', needs: ['from', 'to'] },
  block: { says: 'a red barrier rises between two things: nothing passes, and anything sent between them bounces back', needs: ['from', 'to'] },
  pile: { says: 'coins pile up beside a thing, as many as count (1 to 10): what it costs, small or tall', needs: ['on', 'count'] },
  meter: { says: 'a bar over a thing fills to `to` (0 to 1): waiting, progress, how full', needs: ['on'] },
  count: { says: 'a number over a thing counts up to `to`, with `before` (such as £) and `after` (such as " days")', needs: ['on', 'to'] },
  mark: { says: 'a badge pops up on a thing: tick, cross, question, warning, lock, clock, heart or star', needs: ['on', 'with'] },
  pulse: { says: 'rings spread out from a thing: it is ringing, working, switched on', needs: ['on'] },
  say: { says: 'a speech bubble over a thing, four words at most', needs: ['who', 'text'] },
  walk: { says: 'a thing walks to another spot', needs: ['who', 'to'] },
  leave: { says: 'a thing fades away', needs: ['who'] }
};
/** The badges a mark can be. */
export const MARKS = ['tick', 'cross', 'question', 'warning', 'lock', 'clock', 'heart', 'star'];

/** The most things and moves a stage can have, the most words in a label and a bubble. */
export const STAGE_MAX = { things: 6, moves: 6, label: 3, say: 4, coins: 10 };

/** How long after the one before a move comes, when nobody has said when (the service sets `at` from the voice). */
const EVERY = 1.6, FIRST = 0.8;

const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** True for a name a thing can be: an icon or one of the cast. */
export const isThingName = (name) => Object.hasOwn(ICONS, name) || CAST.includes(name);

/** The keys a thing and each move may have. */
const THING_KEYS = ['id', 'is', 'spot', 'up', 'size', 'label', 'flip', 'skin', 'hair'];
const MOVE_KEYS = ['do', 'cue', 'at', 'who', 'what', 'from', 'to', 'on', 'count', 'with', 'text', 'before', 'after', 'again'];

/**
 * Everything wrong with a stage picture, as messages for whoever wrote it, beyond its being an
 * object: [] when it can be played. `looks` checks a person's skin and hair (pictures.js).
 */
export function stageProblems(p, looks = () => []) {
  const problems = [];
  if (!Object.hasOwn(PLACES, p.place)) problems.push(`picture.place must be one of: ${Object.keys(PLACES).join(', ')}`);
  if (!Array.isArray(p.things) || p.things.length < 1 || p.things.length > STAGE_MAX.things) {
    return [...problems, `picture.things must be a list of 1 to ${STAGE_MAX.things} things, such as [{ "id": "bank", "is": "bank", "spot": "left" }]`];
  }
  const ids = new Set(), taken = new Map(), big = new Set();
  p.things.forEach((th, i) => {
    const where = `picture.things[${i}]`;
    if (!isPlain(th)) { problems.push(`${where} must be an object such as { "id": "bank", "is": "bank", "spot": "left" }`); return; }
    for (const key of Object.keys(th)) if (!THING_KEYS.includes(key)) problems.push(`${where}: a thing takes ${THING_KEYS.join(', ')}, not ${key}`);
    if (!isText(th.id) || ids.has(th.id)) problems.push(`${where} needs an id of its own, a short name the moves can use`);
    ids.add(th.id);
    if (!isThingName(th.is)) problems.push(`${where}: "${th.is}" is not something the stage can draw; it can draw ${CAST.join(', ')} and the icons`);
    if (!Object.hasOwn(SPOTS, th.spot)) { problems.push(`${where}.spot must be one of: ${SPOT_NAMES.join(', ')}`); return; }
    if (th.up !== undefined && typeof th.up !== 'boolean') problems.push(`${where}.up must be true or false`);
    if (th.flip !== undefined && typeof th.flip !== 'boolean') problems.push(`${where}.flip must be true or false`);
    if (th.size !== undefined && !Object.hasOwn(SIZES, th.size)) problems.push(`${where}.size must be one of: ${Object.keys(SIZES).join(', ')}`);
    if (th.label !== undefined && (!isText(th.label) || words(th.label) > STAGE_MAX.label)) problems.push(`${where}.label must be ${STAGE_MAX.label} words at most`);
    problems.push(...looks(th, where));
    // two things in one spot stand on each other, and a big one fills its neighbours' too
    const layer = th.up ? 'air' : 'ground', at = SPOT_NAMES.indexOf(th.spot), reach = th.size === 'big' ? 1 : 0;
    if (reach) big.add(th.id);
    for (let s = at - reach; s <= at + reach; s++) {
      const key = `${layer} ${s}`;
      if (taken.has(key)) {
        const other = taken.get(key);
        problems.push(`${where}: "${th.id}" stands where "${other}" does; give it a spot of its own${reach || big.has(other) ? ', with room either side for a big thing' : ''}`);
      } else taken.set(key, th.id);
    }
  });
  if (!Array.isArray(p.moves) || p.moves.length < 1 || p.moves.length > STAGE_MAX.moves) {
    return [...problems, `picture.moves must be a list of 1 to ${STAGE_MAX.moves} moves, so the picture shows something happening`];
  }
  p.moves.forEach((m, i) => {
    const where = `picture.moves[${i}]`;
    if (!isPlain(m)) { problems.push(`${where} must be an object such as { "do": "send", "what": "letter", "from": "bank", "to": "home" }`); return; }
    const spec = MOVES[m.do];
    if (!spec) { problems.push(`${where}.do must be one of: ${Object.keys(MOVES).join(', ')}`); return; }
    for (const key of Object.keys(m)) if (!MOVE_KEYS.includes(key)) problems.push(`${where}: a move takes ${MOVE_KEYS.join(', ')}, not ${key}`);
    for (const key of spec.needs) if (m[key] === undefined) problems.push(`${where}: a ${m.do} needs "${key}"`);
    for (const key of ['who', 'from', 'on']) if (m[key] !== undefined && !ids.has(m[key])) problems.push(`${where}.${key} must be the id of one of the things (${[...ids].join(', ')})`);
    if (m.to !== undefined) {
      if (m.do === 'walk') { if (!Object.hasOwn(SPOTS, m.to)) problems.push(`${where}.to must be a spot: ${SPOT_NAMES.join(', ')}`); }
      else if (m.do === 'meter') { if (typeof m.to !== 'number' || m.to < 0 || m.to > 1) problems.push(`${where}.to must be a number from 0 to 1`); }
      else if (m.do === 'count') { if (typeof m.to !== 'number' || !Number.isFinite(m.to) || m.to < 0 || m.to > 1e9) problems.push(`${where}.to must be a number`); }
      else if (!ids.has(m.to)) problems.push(`${where}.to must be the id of one of the things (${[...ids].join(', ')})`);
    }
    if (m.from !== undefined && m.from === m.to) problems.push(`${where}: a ${m.do} goes from one thing to another, not to itself`);
    if (m.what !== undefined && !Object.hasOwn(ICONS, m.what)) problems.push(`${where}.what must be an icon, such as letter or money`);
    if (m.with !== undefined && !MARKS.includes(m.with)) problems.push(`${where}.with must be one of: ${MARKS.join(', ')}`);
    if (m.count !== undefined && (!Number.isInteger(m.count) || m.count < 1 || m.count > STAGE_MAX.coins)) problems.push(`${where}.count must be a whole number from 1 to ${STAGE_MAX.coins}`);
    if (m.text !== undefined && (!isText(m.text) || words(m.text) > STAGE_MAX.say)) problems.push(`${where}.text must be ${STAGE_MAX.say} words at most`);
    for (const key of ['before', 'after']) if (m[key] !== undefined && (typeof m[key] !== 'string' || [...m[key]].length > 8)) problems.push(`${where}.${key} must be a few letters, such as "£" or " days"`);
    if (m.cue !== undefined && !isText(m.cue)) problems.push(`${where}.cue must be the words the narrator says as it happens`);
    if (m.at !== undefined && (typeof m.at !== 'number' || !Number.isFinite(m.at) || m.at < 0)) problems.push(`${where}.at must be a number of seconds`);
    if (m.again !== undefined && typeof m.again !== 'boolean') problems.push(`${where}.again must be true or false`);
  });
  return problems;
}

/** When each move starts: its own `at`, or one after another when nobody has said. */
export function moveTimes(moves) {
  let last = FIRST - EVERY;
  return moves.map((m) => {
    last = typeof m.at === 'number' ? m.at : Math.round((last + EVERY) * 100) / 100;
    return last;
  });
}

// ---------------------------------------------------------------------------------------
// The places

function place(t, px, kind) {
  const { W, H } = px;
  if (kind === 'night') {
    px.sky('#0b1220', '#2f5d8a'); px.stars(t); px.moon(284, 24);
    px.hills('#1f3b5e', GROUND + 4, 22, 0, 2);
    px.rect('#142a45', 0, GROUND, W, H - GROUND);
  } else if (kind === 'sea') {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 12, 4);
    px.rect('#1f6aa0', 0, GROUND - 22, W, 22);
    for (let x = 0; x < W; x += 16) px.rect('#5aa6d6', x + Math.round(Math.sin(t * 2 + x / 20) * 2), GROUND - 16 + ((x / 16) % 3) * 5, 8, 2);
    px.rect('#e8c98a', 0, GROUND, W, H - GROUND); px.rect('#d4b06c', 0, GROUND, W, 2);
  } else if (kind === 'home') {
    px.rect('#3a2f4a', 0, 0, W, GROUND); px.rect('#2c2338', 0, 0, W, 6);
    for (let x = 12; x < W; x += 24) px.rect('#43375a', x, 6, 2, GROUND - 26);
    px.rect('#2c2338', 0, GROUND - 20, W, 20); px.rect('#4b3d62', 0, GROUND - 21, W, 2);
    px.window(250, 8, 44, 26, '#8fd3ff'); px.rect('#b9e6ff', 252, 10, 18, 10); px.rect(INK, 271, 8, 2, 26); px.rect(INK, 250, 20, 44, 2);
    px.rect('#7a4a24', 0, GROUND, W, 3); px.rect('#5a3418', 0, GROUND + 3, W, H - GROUND - 3);
    for (let x = 0; x < W; x += 40) px.rect('#4a2a12', x, GROUND + 3, 1, H - GROUND - 3);
  } else if (kind === 'street') {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 10, 4);
    for (const [x, w, h, c] of [[0, 70, 46, '#c49a86'], [70, 60, 58, '#d1ad8c'], [130, 76, 42, '#bf9282'], [206, 62, 54, '#cda489'], [268, 52, 48, '#c49a86']]) {
      const top = GROUND - 14 - h;
      px.rect('#6b5a55', x, top - 1, w, h + 1); px.rect(c, x + 1, top, w - 2, h);
      px.rect('#8a6f66', x, top - 3, w, 3);
      for (let wx = x + 9; wx < x + w - 12; wx += 18) { px.rect('#6b5a55', wx - 1, top + 9, 10, 12); px.rect('#cfe6f2', wx, top + 10, 8, 10); }
    }
    px.rect('#9a9a9a', 0, GROUND - 14, W, 14); px.rect('#bdbdbd', 0, GROUND - 14, W, 2);
    px.rect('#4a4a52', 0, GROUND, W, H - GROUND); px.rect(INK, 0, GROUND, W, 1);
    for (let x = 8; x < W; x += 40) px.rect(LIGHT, x, GROUND + 18, 20, 3);
  } else if (kind === 'plain') {
    px.rect(NAVY, 0, 0, W, H);
    for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
    px.rect('#0b1220', 0, GROUND, W, H - GROUND); px.rect('#24476b', 0, GROUND, W, 1);
  } else {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 12, 4); px.circle(GOLD, 284, 26, 11); px.circle('#ffe08a', 282, 24, 5);
    px.hills('#3fa34d', GROUND + 4, 18, 0, 3);
    px.rect('#2a7a35', 0, GROUND, W, H - GROUND); px.rect('#4cb55a', 0, GROUND, W, 2);
  }
}

// ---------------------------------------------------------------------------------------
// The cast

/** Reelie, the film reel who presents, standing with feet on `feet`. The same Reelie as the showreel's. */
function reelie(px, cx, feet, r, t, talking) {
  const cy = Math.round(feet - r - 1), step = 0;   // standing still
  for (const side of [-1, 1]) {
    const fx = Math.round(r * 0.45);
    px.rect(INK, cx + side * fx - 4, cy + r - 4 - step, 8, 6);
    px.rect('#46566e', cx + side * fx - 3, cy + r - 3 - step, 6, 3);
  }
  px.circle(INK, cx, cy, r);
  px.circle('#8094ab', cx, cy, r - 1);
  px.circle('#cfdbe7', cx - 1, cy - 1, r - 2);
  px.circle('#aebfd1', cx, cy, r - 3);
  for (let k = 0; k < 5; k++) {
    const a = t * 1.5 + (k * 2 * Math.PI) / 5 - Math.PI / 2;
    px.circle('#2b3a52', cx + Math.cos(a) * r * 0.67, cy + Math.sin(a) * r * 0.67, Math.max(1, Math.round(r * 0.15)));
  }
  const hub = Math.max(5, Math.round(r * 0.46)), e = Math.max(1, Math.round(hub / 6));
  px.circle(INK, cx, cy, hub + 1);
  px.circle(GOLD, cx, cy, hub);
  px.rect('#ffe08a', cx - Math.round(hub * 0.5), cy - hub + 1, Math.round(hub * 0.6), 1);
  const ex = Math.round(hub * 0.42), ey = Math.round(hub * 0.3), my = cy + Math.round(hub * 0.36), mw = Math.round(hub * 0.3);
  if ((t % 3.7) > 3.56) for (const x of [cx - ex, cx + ex]) px.rect(INK, x - e - Math.floor(e / 2), cy - ey + e, e * 3, e);
  else for (const x of [cx - ex, cx + ex]) px.rect(INK, x - Math.floor(e / 2), cy - ey, e, e * 2);
  if (talking && Math.floor(t * 8) % 2) { px.rect(INK, cx - mw, my - e, mw * 2 + 1, e * 3); px.rect(RED, cx - mw + e, my, mw * 2 + 1 - 2 * e, e); }
  else { px.rect(INK, cx - mw + e, my + e, mw * 2 + 1 - 2 * e, e); px.rect(INK, cx - mw, my, e, e); px.rect(INK, cx + mw, my, e, e); }
}

// ---------------------------------------------------------------------------------------
// Drawing a stage

/** Where every thing is at time t: its middle, its box, whether it is there yet, and how far it has faded. */
function layout(t, p, times) {
  const things = new Map();
  for (const th of p.things) {
    const sc = SIZES[th.size ?? 'medium'], cast = CAST.includes(th.is);
    const w = cast ? Math.round(ICON_SIZE * sc * 0.9) : ICON_SIZE * sc, h = cast ? w + 3 : ICON_SIZE * sc;
    things.set(th.id, { ...th, sc, w, h, x: SPOTS[th.spot], feet: th.up ? AIR : GROUND, from: 0, gone: Infinity, walking: false });
  }
  p.moves.forEach((m, i) => {
    const th = things.get(m.who), at = times[i];
    if (!th) return;
    if (m.do === 'arrive') th.from = at;
    if (m.do === 'leave') th.gone = Math.min(th.gone, at);
    if (m.do === 'walk' && t >= at) {
      const k = Math.min(1, (t - at) / 1.6), to = SPOTS[m.to];
      th.walking = k < 1;
      th.x = Math.round(th.x + (to - th.x) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2));
      if (to < th.x && th.walking) th.facing = -1;
    }
  });
  for (const th of things.values()) {
    th.top = th.feet - th.h;
    th.cy = th.top + th.h / 2;
  }
  return things;
}

/** A thing's label: as big as fits between its neighbours, down to 10 pixels. */
function labelSize(px, label, room) {
  let size = 14;
  while (size > 10 && px.textW(label, size) > room) size -= 2;
  return size;
}

function drawThing(t, px, th, look, index) {
  if (t < th.from) return;
  const fade = th.gone === Infinity ? 0 : px.clamp((t - th.gone) / 0.6, 0, 1);
  if (fade >= 1) return;
  const drop = Math.round(px.tween(t, th.from + index * 0.12, 0.55, -th.feet - 8, 0, 'bounce'));
  const bob = th.walking ? -Math.abs(Math.round(Math.sin(t * 14) * 2)) : 0;
  const x = Math.round(th.x - th.w / 2), y = th.top + drop + bob;
  if (!th.up && drop === 0) px.rect('rgba(0,0,0,0.25)', x + 4, th.feet - 1, th.w - 8, 2);   // a shadow, so it stands on the ground
  if (th.is === 'reelie') reelie(px, Math.round(th.x), th.feet + drop + bob, Math.round(th.w / 2) - 1, t, true);
  else px.sprite(ICONS[th.is], x, y, th.sc, th.flip === true || th.facing === -1, look(th, index));
  if (fade > 0) px.dither('#13203a', x - 2, y - 2, th.w + 4, th.h + 4, fade);
}

/** A small icon that flies from one thing to another; with a barrier between them, it bounces back off it. */
function flying(t, px, m, a, b, at, wall) {
  const takes = 1.4, since = t - at, k0 = m.again ? (since % (takes + 0.4)) / takes : since / takes;
  if (k0 < 0 || k0 > 1) return;
  let k = k0;
  if (wall) k = k0 < 0.5 ? k0 : 1 - k0;   // to the barrier, and back
  const x = px.lerp(a.x, b.x, k), y = px.lerp(a.cy, b.cy, k) - Math.sin(k * Math.PI) * 30;
  px.sprite(ICONS[m.what], Math.round(x - ICON_SIZE), Math.round(y - ICON_SIZE), 2);
}

/** Draws stage `p` at time t, with `look(thing, i)` giving a person's colours (personLook in pictures.js). */
export function drawStage(t, px, p, look = () => null) {
  const times = moveTimes(p.moves), things = layout(t, p, times);
  const live = (i) => t >= times[i];
  const blocked = (m) => p.moves.some((o, j) => o.do === 'block' && live(j) &&
    ((o.from === m.from && o.to === m.to) || (o.from === m.to && o.to === m.from)));
  place(t, px, p.place);

  // behind the things: streams and waves
  p.moves.forEach((m, i) => {
    if (!live(i)) return;
    const a = things.get(m.from), b = things.get(m.to), on = things.get(m.on);
    if (m.do === 'pulse' && on && t >= on.from) {
      // rings that spread and fade, kept inside the picture
      for (const lag of [0, 0.5]) {
        const k = ((t - times[i]) * 0.8 + lag) % 1, r = Math.round(Math.min(on.w / 2 + 3 + k * 14, on.x - 2, px.W - on.x - 2, GROUND - on.cy - 2));
        if (k < 0.85) px.ring(GOLD, Math.round(on.x), Math.round(on.cy), r, 2);
      }
    }
    if (!a || !b) return;
    if (m.do === 'flow') {
      for (let n = 0; n < 6; n++) {
        const k = ((t - times[i]) * 0.45 + n / 6) % 1, x = px.lerp(a.x, b.x, k), y = px.lerp(a.cy, b.cy, k);
        px.rect(INK, x - 3, y - 3, 6, 6); px.rect(TEAL, x - 2, y - 2, 4, 4);
      }
    } else if (m.do === 'wave') {
      const dir = Math.sign(b.x - a.x) || 1, x0 = a.x + dir * (a.w / 2 + 4), x1 = b.x - dir * (b.w / 2 + 4);
      const reach = px.clamp((t - times[i]) / 1.0, 0, 1), span = (x1 - x0) * reach;
      for (let d = 0; Math.abs(d) < Math.abs(span); d += dir * 4) {
        const k = d / (x1 - x0 || 1), y = px.lerp(a.cy, b.cy, k), h = 3 + Math.round(Math.abs(Math.sin(t * 7 + d * 0.3)) * 10);
        px.rect(GOLD, x0 + d, Math.round(y - h / 2), 2, h);
      }
    }
  });

  [...things.values()].forEach((th, i) => drawThing(t, px, th, look, i));

  // the labels, each as big as fits between its neighbours
  const shown = [...things.values()].filter((th) => th.label && t >= th.from + 0.5 && th.gone === Infinity);
  for (const th of shown) {
    const near = shown.filter((o) => o !== th && o.feet === th.feet).map((o) => Math.abs(o.x - th.x));
    const room = Math.min(SPOT_WIDTH * 2 - 6, ...near.map((d) => d - 6)), size = labelSize(px, th.label, room);
    const y = th.up ? th.feet + 3 : GROUND + 4;
    px.text(th.label, Math.round(th.x), y, size, th.up ? LIGHT : CREAM, 'center', INK);
  }

  // in front of the things: what flies, rises, piles up and is said
  p.moves.forEach((m, i) => {
    if (!live(i)) return;
    const at = times[i], a = things.get(m.from), b = things.get(m.to), th = things.get(m.on ?? m.who);
    if (m.do === 'send' && a && b) flying(t, px, m, a, b, at, blocked(m));
    if (m.do === 'block' && a && b) {
      const x = Math.round((a.x + b.x) / 2), h = Math.round(px.tween(t, at, 0.4, 0, 54, 'back')), top = GROUND - h;
      px.rect(INK, x - 5, top - 1, 10, h + 1); px.rect(RED, x - 4, top, 8, h);
      for (let y = top + 4; y < GROUND - 4; y += 10) px.rect(LIGHT, x - 4, y, 8, 3);
    }
    if (!th) return;
    if (m.do === 'pile') {
      const n = Math.min(m.count, Math.floor((t - at) / 0.3) + 1), x = Math.round(th.x + th.w / 2 + 4);
      for (let c = 0; c < n; c++) { const y = th.feet - 5 - c * 5; px.rect(INK, x - 1, y - 1, 16, 6); px.rect(GOLD, x, y, 14, 4); px.rect('#c98a12', x, y + 3, 14, 1); }
    }
    if (m.do === 'meter') {
      const w = Math.max(44, th.w), x = Math.round(th.x - w / 2), y = th.top - 12;
      const k = px.tween(t, at, 2, 0, m.to ?? 1, 'linear');
      px.rect(INK, x - 1, y - 1, w + 2, 9); px.rect(LIGHT, x, y, w, 7); px.rect(GREEN, x, y, Math.round(w * k), 7);
    }
    if (m.do === 'count') {
      const v = px.tween(t, at, 1.4, 0, m.to, 'out'), whole = Number.isInteger(m.to);
      const shownV = whole ? String(Math.round(v)) : v.toFixed(2);
      // on a plate as wide as the number at its end, so it does not shift as it counts
      const end = `${m.before ?? ''}${whole ? m.to : m.to.toFixed(2)}${m.after ?? ''}`, w = px.textW(end, 20) + 12;
      const x = px.clamp(Math.round(th.x - w / 2), 2, px.W - w - 2), y = Math.max(2, th.top - 28);
      px.window(x, y, w, 24, NAVY);
      px.text(`${m.before ?? ''}${shownV}${m.after ?? ''}`, x + w / 2, y + 2, 20, GOLD, 'center', INK);
    }
    if (m.do === 'mark') {
      if (px.tween(t, at, 0.3, 0, 1, 'back') < 0.5) return;
      const cx = Math.round(th.x + th.w / 2 - 2), cy = th.top + 2;
      px.circle(INK, cx, cy, 11); px.circle(LIGHT, cx, cy, 10);
      px.sprite(ICONS[m.with], cx - 8, cy - 8, 1);
    }
    if (m.do === 'say') {
      // a bubble lasts until the same thing says something else
      const next = p.moves.findIndex((o, j) => j > i && o.do === 'say' && o.who === m.who && live(j));
      if (next !== -1) return;
      const w = Math.min(140, px.textW(m.text, 12) + 10), x = px.clamp(Math.round(th.x - w / 2), 4, px.W - w - 4);
      px.bubble(m.text, x, Math.max(2, th.top - 28), 12, Math.round(th.x), LIGHT, '#202020', 130);
    }
  });
}
