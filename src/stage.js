// The stage: a ready-made picture that shows something happening, not a sign for it. A place,
// a few things standing in it, and moves between them, each move landing on the words the
// narrator says: a letter flies from the bank to the house, a barrier rises, coins pile up.
// Plain data, like every other picture, so it is checked before it is played and nothing in
// it ever runs. Pure: no DOM. pictures.js draws it and checks it; pacing.mjs times its moves.
import { ICONS } from './icons.js';
import { PEOPLE, personRows, THINGS, WEARS } from './library.js';
import { PALETTE } from './palette.js';

const INK = '#1a1a1a', CREAM = '#ebeac5', LIGHT = '#fdf6e3', GOLD = '#ffcc4d', TEAL = '#55d6be';
const RED = '#d63a3a', GREEN = '#3fa34d', NAVY = '#13203a';

/** Where the ground is, in picture pixels: things stand on it, and their labels sit under it. */
export const GROUND = 146;
/** Where a thing in the air has its feet. */
const AIR = 62;

/** The places a stage can be, and what each is like, for whoever chooses one. */
export const PLACES = {
  home: 'Indoors at home: a wall, a window and a wooden floor.',
  office: 'An office: a big window over the town, and a carpet.',
  surgery: 'A doctors\u2019 surgery or a hospital: a pale wall with a red cross, and a clean floor.',
  shop: 'Inside a shop: shelves of goods along the back.',
  school: 'A classroom: a blackboard and a wooden floor.',
  kitchen: 'A kitchen: tiles, cupboards and a worktop along the back.',
  bedroom: 'A bedroom at night: a window with the moon, and a rug.',
  cafe: 'A cafe: a counter, a menu board and a striped awning.',
  park: 'A park: trees, a path and a bench along the back.',
  festival: 'A festival field: tents, flags and a stage far off, at dusk.',
  station: 'A railway station: the platform edge, a clock and a train shelter.',
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
/** How far two things side by side may run into each other, in picture pixels, before it shows. */
const OVERLAP = 6;

/** How big a thing is drawn: picture pixels to one of its drawing's. One size of pixel throughout, and a big thing a little bigger. */
export const SIZES = { medium: 3, big: 4 };

/** The cast who come back in every reel: Reelie, the film reel who presents. The people are in the library (woman, man, ...). */
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

/** True for a name a thing can be: one of the cast, a person or a thing in the library, or an icon. */
export const isThingName = (name) => CAST.includes(name) || Object.hasOwn(PEOPLE, name) || Object.hasOwn(THINGS, name) || Object.hasOwn(ICONS, name);

/** The rows a thing is drawn from: the library's own drawing, or the icon of that name. */
export function drawingOf(name) {
  return PEOPLE[name] ?? THINGS[name] ?? (Object.hasOwn(ICONS, name) ? { rows: ICONS[name] } : null);
}

/** What a thing on a stage is drawn from: a person dressed as they are, or the library's drawing, or an icon's. */
const drawingFor = (th) => (Object.hasOwn(PEOPLE, th.is) ? { rows: personRows(th.is, th.wears ?? null) } : drawingOf(th.is));

/** How wide a thing is drawn, in picture pixels: 0 for one that cannot be drawn. */
export function thingWidth(th) {
  const sc = SIZES[th.size] ?? SIZES.medium;
  if (CAST.includes(th.is)) return 14 * sc;
  const drawing = Array.isArray(th.rows) ? { rows: th.rows } : isThingName(th.is) ? drawingFor(th) : null;
  return drawing ? Math.max(0, ...drawing.rows.map((r) => String(r).length)) * sc : 0;
}

/** The keys a thing and each move may have. */
const THING_KEYS = ['id', 'is', 'rows', 'colours', 'spot', 'up', 'size', 'label', 'flip', 'skin', 'hair', 'wears'];

/** The most rows, and letters in a row, of a thing a reel draws itself. */
export const OWN_MAX = { rows: 24, cols: 24 };

/** What a thing on a stage is drawn from: the reel's own rows, or the library's or an icon's. */
const thingDrawing = (th) => (Array.isArray(th.rows) ? { rows: th.rows, colours: th.colours ?? null } : drawingFor(th));
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
  const ids = new Set(), taken = new Map();
  p.things.forEach((th, i) => {
    const where = `picture.things[${i}]`;
    if (!isPlain(th)) { problems.push(`${where} must be an object such as { "id": "bank", "is": "bank", "spot": "left" }`); return; }
    for (const key of Object.keys(th)) if (!THING_KEYS.includes(key)) problems.push(`${where}: a thing takes ${THING_KEYS.join(', ')}, not ${key}`);
    if (!isText(th.id) || ids.has(th.id)) problems.push(`${where} needs an id of its own, a short name the moves can use`);
    ids.add(th.id);
    if (th.rows !== undefined || th.colours !== undefined) {
      problems.push(...ownProblems(th, where));
    } else if (!isThingName(th.is)) problems.push(`${where}: "${th.is}" is not something the stage can draw; it can draw ${CAST.join(', ')}, the people and things in the library, and the icons`);
    if (!Object.hasOwn(SPOTS, th.spot)) { problems.push(`${where}.spot must be one of: ${SPOT_NAMES.join(', ')}`); return; }
    if (th.up !== undefined && typeof th.up !== 'boolean') problems.push(`${where}.up must be true or false`);
    if (th.flip !== undefined && typeof th.flip !== 'boolean') problems.push(`${where}.flip must be true or false`);
    if (th.rows !== undefined && th.is !== undefined) problems.push(`${where}: a thing is one from the library ("is") or drawn by the reel ("rows"), not both`);
    if (th.wears !== undefined && (!Object.hasOwn(PEOPLE, th.is) || !Object.hasOwn(WEARS, th.wears))) problems.push(`${where}.wears: only a person wears anything, and it is one of: ${Object.keys(WEARS).join(', ')}`);
    if (th.size !== undefined && !Object.hasOwn(SIZES, th.size)) problems.push(`${where}.size must be one of: ${Object.keys(SIZES).join(', ')}`);
    if (th.label !== undefined && (!isText(th.label) || words(th.label) > STAGE_MAX.label)) problems.push(`${where}.label must be ${STAGE_MAX.label} words at most`);
    problems.push(...looks(th, where));
    // two things in one spot stand on each other
    const key = `${th.up ? 'air' : 'ground'} ${th.spot}`;
    if (taken.has(key)) problems.push(`${where}: "${th.id}" stands where "${taken.get(key).id}" does; give it a spot of its own`);
    else taken.set(key, th);
  });
  // things side by side may be wide (a house, a bus), so long as they do not run into each other
  const placed = [...taken.entries()].map(([key, th]) => ({ layer: key.split(' ')[0], x: SPOTS[th.spot], w: thingWidth(th), th }));
  for (const a of placed) {
    for (const b of placed) {
      if (a.layer !== b.layer || a.x >= b.x || (a.w + b.w) / 2 <= b.x - a.x + OVERLAP) continue;
      problems.push(`picture.things: "${a.th.id}" and "${b.th.id}" are too wide to stand ${b.x - a.x === SPOT_WIDTH ? 'side by side' : 'so close'}; leave a spot between them${a.w > SPOT_WIDTH || b.w > SPOT_WIDTH ? ', as a wide thing such as a house or a bus needs' : ''}`);
    }
  }
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
    if (m.what !== undefined && (!drawingOf(m.what) || Object.hasOwn(PEOPLE, m.what))) problems.push(`${where}.what must be a thing in the library or an icon, such as letter or money`);
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

/** What is wrong with a thing the reel draws itself: its rows and their letters. */
function ownProblems(th, where) {
  const rows = th.rows, own = isPlain(th.colours) ? Object.keys(th.colours) : [];
  if (!Array.isArray(rows) || !rows.length || rows.length > OWN_MAX.rows || !rows.every((r) => typeof r === 'string' && r.length > 0 && r.length <= OWN_MAX.cols)) {
    return [`${where}.rows must be 1 to ${OWN_MAX.rows} rows of 1 to ${OWN_MAX.cols} letters, such as ["..kk..", ".kyyk."]`];
  }
  const problems = [];
  if (new Set(rows.map((r) => r.length)).size > 1) problems.push(`${where}.rows must all be the same length, or the drawing breaks where one is not`);
  if (th.colours !== undefined && !(isPlain(th.colours) && Object.entries(th.colours).every(([k, c]) => [...k].length === 1 && k !== '.' && typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)))) {
    problems.push(`${where}.colours must be letters and the colours they stand for, such as { "h": "#6b3e2e" }`);
  }
  const odd = rows.join('').split('').find((ch) => ch !== '.' && !Object.hasOwn(PALETTE, ch) && !own.includes(ch));
  if (odd) problems.push(`${where}.rows uses "${odd}", which is not a palette letter: add it to colours`);
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
  } else if (kind === 'office') {
    px.rect('#c9d3dc', 0, 0, W, GROUND); px.rect('#b4c0cb', 0, GROUND - 22, W, 22); px.rect('#9fadba', 0, GROUND - 23, W, 1);
    // a long window over the town, high on the wall
    px.rect(INK, 20, 8, 280, 46); px.rect('#8fd3ff', 21, 9, 278, 44);
    for (const [x, w, h] of [[24, 30, 26], [58, 22, 36], [84, 40, 20], [128, 26, 32], [158, 34, 24], [196, 24, 38], [224, 40, 22], [268, 28, 30]]) {
      px.rect('#6f87a3', x, 53 - h, w, h);
      for (let wy = 56 - h; wy < 50; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 6) px.rect('#cfe6f2', wx, wy, 3, 3);
    }
    for (const x of [94, 160, 226]) px.rect(INK, x, 8, 2, 46);
    px.rect('#5d6f86', 0, GROUND, W, H - GROUND); px.rect('#4f5f74', 0, GROUND, W, 2);
    for (let x = 0; x < W; x += 8) px.rect('#56687e', x + ((x / 8) % 2) * 4, GROUND + 12, 2, 2);
  } else if (kind === 'surgery') {
    px.rect('#d7eee6', 0, 0, W, GROUND); px.rect('#bfe0d4', 0, GROUND - 26, W, 26); px.rect('#9fcbbb', 0, GROUND - 27, W, 1);
    px.rect(INK, 148, 8, 24, 24); px.rect(LIGHT, 149, 9, 22, 22); px.rect(RED, 157, 12, 6, 16); px.rect(RED, 152, 17, 16, 6);
    px.rect(INK, 22, 12, 46, 30); px.rect('#c8925a', 23, 13, 44, 28);
    for (const [x, y, c] of [[27, 16, LIGHT], [44, 17, '#ffe08a'], [30, 28, '#8fd3ff'], [48, 29, LIGHT]]) px.rect(c, x, y, 13, 9);
    px.rect('#e9ecef', 0, GROUND, W, H - GROUND); px.rect('#c9ced6', 0, GROUND, W, 2);
    for (let x = 0; x < W; x += 20) px.rect('#d5dae0', x, GROUND + 2, 1, H - GROUND - 2);
  } else if (kind === 'shop') {
    px.rect('#f1e2c6', 0, 0, W, GROUND);
    for (const y of [16, 44]) {
      px.rect('#8a5a34', 6, y + 18, W - 12, 4); px.rect(INK, 6, y + 22, W - 12, 1);
      for (let x = 10; x < W - 14; x += 12) {
        const n = (x - 10) / 12, c = ['#d63a3a', '#3fa34d', '#1f4e9c', '#ffcc4d', '#ff8c2a', '#8e5bd6'][(n * 5 + y) % 6];
        const h = 10 + ((n * 7 + y) % 3) * 3;
        px.rect(INK, x, y + 18 - h, 9, h); px.rect(c, x + 1, y + 19 - h, 7, h - 1); px.rect(LIGHT, x + 2, y + 21 - h, 5, 2);
      }
    }
    px.rect('#e3cfa8', 0, GROUND - 20, W, 20);
    for (let x = 0; x < W; x += 16) for (let y = GROUND; y < H; y += 16) px.rect(((x + y) / 16) % 2 ? '#c9ced6' : '#f4f4ee', x, y, 16, 16);
  } else if (kind === 'school') {
    px.rect('#efe3c4', 0, 0, W, GROUND); px.rect('#d8c49a', 0, GROUND - 22, W, 22); px.rect('#bba57a', 0, GROUND - 23, W, 1);
    px.rect('#7a4a24', 70, 8, 180, 50); px.rect('#24533a', 74, 12, 172, 42);
    for (const [x, y, w] of [[84, 18, 40], [84, 26, 64], [84, 34, 30], [170, 20, 52], [176, 30, 36], [168, 40, 44]]) px.rect('#cfe3d6', x, y, w, 2);
    px.rect('#7a4a24', 64, 58, 192, 4);
    px.rect('#a36a3a', 0, GROUND, W, H - GROUND); px.rect('#8a5a34', 0, GROUND, W, 2);
    for (let x = 0; x < W; x += 32) px.rect('#8a5a34', x, GROUND + 2, 1, H - GROUND - 2);
  } else if (kind === 'kitchen') {
    px.rect('#f1ead8', 0, 0, W, GROUND);
    for (let y = 40; y < GROUND - 24; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < W; x += 8) px.rect('#e2d9c2', x, y, 7, 7);
    for (let x = 8; x < W - 8; x += 52) { px.rect(INK, x, 6, 46, 28); px.rect('#7fb3a0', x + 1, 7, 44, 26); px.rect('#6a9a88', x + 22, 7, 2, 26); px.rect(INK, x + 18, 18, 2, 4); px.rect(INK, x + 26, 18, 2, 4); }
    px.rect(INK, 0, GROUND - 25, W, 1); px.rect('#c9ced6', 0, GROUND - 24, W, 4); px.rect('#7fb3a0', 0, GROUND - 20, W, 20);
    for (let x = 30; x < W; x += 60) px.rect(INK, x, GROUND - 18, 1, 18);
    px.rect('#d8cfb8', 0, GROUND, W, H - GROUND);
    for (let x = 0; x < W; x += 16) for (let y = GROUND; y < H; y += 16) if (((x + y) / 16) % 2) px.rect('#c4b99e', x, y, 16, 16);
  } else if (kind === 'bedroom') {
    px.rect('#3c4a7a', 0, 0, W, GROUND); px.rect('#34406b', 0, GROUND - 20, W, 20);
    px.window(36, 10, 60, 46, '#13203a'); px.circle('#fdf6e3', 76, 26, 7); px.circle('#13203a', 79, 24, 6);
    for (const [x, y] of [[46, 18], [58, 40], [88, 46], [50, 32]]) px.rect(LIGHT, x, y, 1, 1);
    px.rect(INK, 65, 10, 2, 46); px.rect(INK, 36, 32, 60, 2);
    px.rect(INK, 230, 12, 40, 30); px.rect('#ffcc4d', 231, 13, 38, 28); px.rect('#3fa34d', 236, 28, 28, 10); px.circle('#d63a3a', 250, 22, 4);
    px.rect('#5a3a6a', 0, GROUND, W, H - GROUND); px.rect('#7a4a8a', 60, GROUND + 6, 200, H - GROUND - 12);
    for (let x = 64; x < 256; x += 8) px.rect('#9a6aaa', x, GROUND + 9, 4, 2);
  } else if (kind === 'cafe') {
    px.rect('#f3e6cf', 0, 0, W, GROUND);
    for (let x = 0; x < W; x += 20) { px.rect(x % 40 ? '#d63a3a' : LIGHT, x, 0, 20, 14); }
    px.rect(INK, 0, 14, W, 1);
    for (let x = 0; x < W; x += 20) px.rect(x % 40 ? '#d63a3a' : LIGHT, x + 4, 15, 12, 4);
    px.rect(INK, 200, 26, 96, 50); px.rect('#24333a', 201, 27, 94, 48);
    for (const [y, w] of [[34, 60], [44, 48], [54, 70], [64, 40]]) { px.rect('#e8e2d0', 208, y, w, 2); px.rect(GOLD, 284, y, 6, 2); }
    px.rect(INK, 20, 30, 40, 40); px.rect('#8fd3ff', 21, 31, 38, 38); px.rect(INK, 39, 30, 2, 40); px.rect(INK, 20, 49, 40, 2);
    px.rect('#8a5a34', 0, GROUND - 24, W, 24); px.rect('#a36a3a', 0, GROUND - 26, W, 3); px.rect(INK, 0, GROUND - 27, W, 1);
    px.rect('#6a4228', 0, GROUND, W, H - GROUND);
    for (let x = 0; x < W; x += 24) px.rect('#5a3820', x, GROUND, 1, H - GROUND);
  } else if (kind === 'park') {
    px.sky('#4a90c2', '#a8d4ef'); px.clouds(t, 12, 4);
    px.hills('#5ab45a', GROUND - 18, 14, 0, 3);
    for (const [x, r] of [[24, 18], [92, 14], [228, 20], [300, 15]]) { px.rect('#6a4a24', x - 2, GROUND - 40, 5, 26); px.circle(INK, x, GROUND - 46, r + 1); px.circle('#2a7a35', x, GROUND - 46, r); px.circle('#3fa34d', x - 3, GROUND - 49, r - 5); }
    px.rect('#3fa34d', 0, GROUND - 14, W, 14);
    px.rect(INK, 140, GROUND - 26, 44, 3); px.rect('#a36a3a', 141, GROUND - 25, 42, 1); px.rect(INK, 140, GROUND - 20, 44, 3); px.rect(INK, 143, GROUND - 17, 2, 6); px.rect(INK, 179, GROUND - 17, 2, 6);
    px.rect('#d8c49a', 0, GROUND, W, H - GROUND); px.rect('#c4ad7e', 0, GROUND, W, 2);
    px.rect('#2a7a35', 0, GROUND + 20, W, H - GROUND - 20);
  } else if (kind === 'festival') {
    px.sky('#2a2a5a', '#e0785a'); px.stars(t);
    // the main stage far off, its lights swinging
    px.rect(INK, 118, 52, 84, 46); px.rect('#2b2b33', 120, 54, 80, 42); px.rect('#13203a', 126, 62, 68, 34);
    for (let i = 0; i < 3; i++) { const sx = 136 + i * 24, sw = Math.round(Math.sin(t * 1.6 + i) * 10); px.line(['#ffcc4d', '#55d6be', '#ff7eb6'][i], sx, 62, sx + sw, 94); }
    for (const [x, c] of [[20, '#d63a3a'], [60, '#1f4e9c'], [250, '#ffcc4d'], [290, '#3fa34d']]) {
      px.rect(INK, x - 14, GROUND - 30, 28, 1);
      for (let k = 0; k < 14; k++) px.rect(c, x - k, GROUND - 30 + k, 2 * k + 1, 1);
    }
    px.line(INK, 0, 36, W, 44);
    for (let x = 8; x < W; x += 18) { const y = 36 + Math.round(x * 8 / W); px.rect(['#d63a3a', '#ffcc4d', '#1f4e9c', '#3fa34d'][(x / 18 | 0) % 4], x, y + 1, 7, 5); }
    px.rect('#3a7a35', 0, GROUND - 16, W, 16); px.rect('#2a5a28', 0, GROUND, W, H - GROUND); px.rect('#4a8a40', 0, GROUND, W, 2);
  } else if (kind === 'station') {
    px.sky('#7a9ab8', '#c8d8e6');
    px.rect(INK, 0, 26, W, 3); px.rect('#24476b', 0, 22, W, 4);
    for (let x = 20; x < W; x += 70) px.rect('#24476b', x, 26, 4, GROUND - 26);
    px.circle(INK, 160, 46, 11); px.circle(LIGHT, 160, 46, 10); px.rect(INK, 159, 39, 2, 8); px.rect(INK, 159, 45, 6, 2); px.rect(INK, 159, 34, 2, 2);
    px.rect('#c8c2b0', 0, GROUND - 12, W, 12); px.rect('#f2e12b', 0, GROUND - 2, W, 2);
    px.rect('#8a8478', 0, GROUND, W, H - GROUND);
    for (let x = 0; x < W; x += 12) px.rect('#5a5448', x, GROUND + 12, 6, 3);
    px.rect('#6a6458', 0, GROUND + 10, W, 1); px.rect('#6a6458', 0, GROUND + 17, W, 1);
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
    const sc = SIZES[th.size ?? 'medium'], cast = CAST.includes(th.is), rows = cast ? null : thingDrawing(th).rows;
    const w = cast ? 14 * sc : Math.max(...rows.map((r) => r.length)) * sc, h = cast ? 15 * sc + 2 : rows.length * sc;
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
    th.x = Math.max(2 + th.w / 2, Math.min(320 - 2 - th.w / 2, th.x));   // never past the picture's edge
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
  else {
    const drawing = thingDrawing(th), own = th.rows ? null : look(th, index);
    px.sprite(drawing.rows, x, y, th.sc, th.flip === true || th.facing === -1, own || drawing.colours ? { ...drawing.colours, ...own } : null);
  }
  if (fade > 0) px.dither('#13203a', x - 2, y - 2, th.w + 4, th.h + 4, fade);
}

/** A small icon that flies from one thing to another; with a barrier between them, it bounces back off it. */
function flying(t, px, m, a, b, at, wall) {
  const takes = 1.4, since = t - at, k0 = m.again ? (since % (takes + 0.4)) / takes : since / takes;
  if (k0 < 0 || k0 > 1) return;
  let k = k0;
  if (wall) k = k0 < 0.5 ? k0 : 1 - k0;   // to the barrier, and back
  const x = px.lerp(a.x, b.x, k), y = px.lerp(a.cy, b.cy, k) - Math.sin(k * Math.PI) * 30, drawing = drawingOf(m.what);
  const w = Math.max(...drawing.rows.map((r) => r.length)) * 2, h = drawing.rows.length * 2;
  px.sprite(drawing.rows, Math.round(x - w / 2), Math.round(y - h / 2), 2, false, drawing.colours ?? null);
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
