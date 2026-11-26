// Ready-made pictures: a scene can say picture: { type: 'list', items: [...] } instead of
// writing draw(t, px). Each one animates in time with the scene. Data only, so a script or
// an AI agent can write a whole reel without a line of drawing code.
import { ICON_SIZE, ICONS } from './icons.js';
import { PALETTE } from './palette.js';
import { drawStage, stageProblems } from './stage.js';

const INK = '#1a1a1a', NIGHT = '#0b1220', NAVY = '#13203a', CREAM = '#ebeac5', LIGHT = '#fdf6e3', GOLD = '#ffcc4d';
const TEAL = '#55d6be', BLUE = '#24476b', GREY = '#9fb3c8', PINK = '#ff7eb6', MUTED = '#6f87a3';

/** Shrinks `size` (in steps of 2) until `str` fits in `maxW`. */
function fit(px, str, size, maxW, min = 10) {
  while (size > min && px.textW(str, size) > maxW) size -= 2;
  return size;
}

/** A panel with its corners knocked off, the way pixel art rounds things. */
function roundBox(px, x, y, w, h, fill, edge = INK) {
  px.rect(edge, x + 1, y, w - 2, h);
  px.rect(edge, x, y + 1, w, h - 2);
  px.rect(fill, x + 1, y + 1, w - 2, h - 2);
}

/** The three coloured dots on a window's title bar. */
function dots(px, x, y) {
  ['#d63a3a', GOLD, '#3fa34d'].forEach((c, i) => px.rect(c, x + i * 6, y, 4, 4));
}

/** A window with a title bar; returns the inside: { x, y, w, h }. */
function frame(px, x, y, w, h, title, body) {
  px.window(x, y, w, h, body);
  px.rect(BLUE, x + 1, y + 1, w - 2, 12);
  dots(px, x + 5, y + 5);
  if (title) px.text(title, x + w / 2, y + 1, 12, CREAM, 'center');
  return { x: x + 1, y: y + 13, w: w - 2, h: h - 14 };
}

/** Wrapped text, centred on cx, typed out line by line from `start`. */
function typedBlock(px, str, cx, y, t, start, size, col, maxW, cps = 28) {
  let budget = Math.floor((t - start) * cps);
  px.wrap(str, maxW, size).forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, budget));
    budget -= line.length;
    if (shown) px.text(shown, Math.round(cx - px.textW(line, size) / 2), y + i * (size + 3), size, col);
  });
}

const memos = new WeakMap();

/** Works something out once per picture (layouts need the font, so they wait for the first frame). */
function memo(p, key, fn) {
  if (!memos.has(p)) memos.set(p, {});
  const m = memos.get(p);
  if (!(key in m)) m[key] = fn();
  return m[key];
}

/** The biggest of `sizes` at which every line fits `maxW` and `rowsFor(size)` rows fit. */
function fitLines(px, lines, sizes, maxW, rowsFor, rowsNeeded) {
  return sizes.find((s) => rowsFor(s) >= rowsNeeded && lines.every((l) => px.textW(l, s) <= maxW)) ?? sizes.at(-1);
}

function title(t, px, p) {
  const { W } = px;
  px.sky(NIGHT, '#2f5d8a');
  px.stars(t);
  px.moon(278, 28);
  px.hills('#1f3b5e', 152, 26, t * 3, 2);
  px.hills('#142a45', 170, 14, t * 8, 5);
  const size = fit(px, p.text, 36, W - 36);
  const y = Math.round(px.tween(t, 0.15, 1, -50, p.sub ? 44 : 64, 'bounce'));
  px.text(p.text, W / 2, y + 2, size, INK, 'center');
  px.text(p.text, W / 2, y, size, GOLD, 'center', '#7a4a24');
  if (p.sub) typedBlock(px, p.sub, W / 2, y + size + 8, t, 1.3, 14, LIGHT, W - 60);
}

const TICK = ['.........g', '........gg', 'g......gg.', 'gg....gg..', '.gg..gg...', '..gggg....', '...gg.....'];

/** A navy backdrop with a faint grid of dots, for pictures that set things out on it. */
function dotted(px) {
  const { W, H } = px;
  px.rect(NAVY, 0, 0, W, H);
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
}

function list(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 36 : 10, room = H - top - 8;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const n = p.items.length, rowH = Math.min(30, Math.floor(room / n));
  const size = Math.max(10, Math.min(20, rowH - 8) & ~1);
  const first = top + Math.floor((room - rowH * n) / 2);   // the list sits in the middle of the space left
  const every = p.every ?? 1.4, start = p.start ?? 0.6;
  const latest = Math.floor((t - start) / every);
  p.items.forEach((item, i) => {
    const at = start + i * every;
    if (t < at) return;
    const x = 26 + Math.round(px.tween(t, at, 0.35, -70, 0, 'out'));
    const y = first + i * rowH + Math.floor((rowH - 13) / 2);
    if (p.numbered) {
      px.circle(GOLD, x + 6, y + 6, 7);
      px.text(String(i + 1), x + 6, y, 12, INK, 'center');
    } else {
      px.window(x, y, 13, 13, LIGHT);
      if (t >= at + 0.3) px.sprite(TICK, x + 2, y + 3);
    }
    const s = fit(px, item, size, W - x - 30);
    px.text(item, x + 20, y + 7 - Math.round(s * 0.55), s, i === latest && t < at + every + 1 ? GOLD : CREAM, 'left', INK);
  });
}

const CMD_CPS = 16;

/** When each terminal line starts and finishes: commands (lines starting "$ ") type, output appears. */
function terminalPlan(lines) {
  let at = 0.6;
  return lines.map((line) => {
    const cmd = line.startsWith('$ ');
    const text = cmd ? line.slice(2) : line;
    const start = at, end = cmd ? start + text.length / CMD_CPS : start;
    at = cmd ? end + 0.45 : start + 0.18;
    return { text, cmd, start, end };
  });
}

function terminal(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const box = frame(px, 14, 10, W - 28, H - 20, p.title ?? 'terminal', '#0d1117');
  const plan = terminalPlan(p.lines);
  const size = memo(p, 'size', () => fitLines(px, p.lines.map((l) => '  ' + l), [16, 14, 12], box.w - 16, (s) => Math.floor((box.h - 8) / (s + 1)), p.lines.length + 1));
  const rowH = size + 1, rows = Math.floor((box.h - 8) / rowH), indent = Math.round(size * 0.75), caret = Math.round(size * 0.75);
  const done = plan.length && t >= plan.at(-1).end + 0.4;
  const shown = plan.filter((l) => t >= l.start);
  const visible = shown.slice(-(done ? rows - 1 : rows));
  visible.forEach((l, i) => {
    const y = box.y + 5 + i * rowH;
    if (!l.cmd) { px.text(l.text, box.x + 6, y, size, GREY); return; }
    px.text('$', box.x + 6, y, size, TEAL);
    const typing = t < l.end;
    const text = typing ? px.typed(l.text, t, l.start, CMD_CPS) : l.text;
    px.text(text, box.x + 6 + indent, y, size, LIGHT);
    if (typing) px.rect(LIGHT, box.x + 7 + indent + px.textW(text, size), y + 2, Math.round(size / 3), caret);
  });
  if (done) {
    const y = box.y + 5 + visible.length * rowH;
    px.text('$', box.x + 6, y, size, TEAL);
    if (px.blink(t, 1)) px.rect(LIGHT, box.x + 7 + indent, y + 2, Math.round(size / 3), caret);
  }
}

const KEYWORDS = new Set(['export', 'default', 'import', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else',
  'for', 'while', 'new', 'true', 'false', 'null', 'undefined', 'async', 'await', 'class', 'this', 'of', 'in']);

/** Splits a line of code into [text, colour] pieces, for simple highlighting. */
export function highlight(line) {
  const out = [];
  const re = /(\/\/.*$|#.*$)|('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;
  let m;
  while ((m = re.exec(line))) {
    let c = CREAM;
    if (m[1]) c = MUTED;
    else if (m[2]) c = GOLD;
    else if (m[3]) c = TEAL;
    else if (m[4]) c = KEYWORDS.has(m[4]) ? PINK : /^\s*:/.test(line.slice(re.lastIndex)) ? '#8fd3ff' : CREAM;
    else if (m[6]) c = GREY;
    out.push([m[0], c]);
  }
  return out;
}

const CODE_CPS = 40;

function code(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const box = frame(px, 14, 10, W - 28, H - 20, p.title ?? 'reel.js', '#101a2c');
  const gutter = 22;
  const size = memo(p, 'size', () => fitLines(px, p.lines, [14, 12, 10], box.w - gutter - 12, (s) => Math.floor((box.h - 6) / s), p.lines.length));
  const rowH = size, rows = Math.floor((box.h - 6) / rowH);
  px.rect('#0c1424', box.x, box.y, gutter, box.h);
  let budget = Math.floor((t - 0.5) * CODE_CPS), started = 0;
  const shown = p.lines.map((line) => {
    if (budget >= 0) started++;
    const part = line.slice(0, Math.max(0, budget));
    budget -= line.length + 4;   // a beat at the end of each line
    return part;
  });
  const first = Math.max(0, started - rows);
  for (let i = first; i < Math.min(started, first + rows); i++) {
    const y = box.y + 4 + (i - first) * rowH;
    px.text(String(i + 1), box.x + gutter - 4, y, Math.min(size, 12), MUTED, 'right');
    let x = box.x + gutter + 6;
    for (const [piece, c] of highlight(shown[i])) { px.text(piece, x, y, size, c); x += px.textW(piece, size); }
    if (shown[i].length < p.lines[i].length && i === started - 1) px.rect(LIGHT, x + 1, y + 2, Math.round(size / 3), Math.round(size * 0.75));
  }
}

/** Lays out a chat once: each message's side, lines and bubble size. */
function chatLayout(px, p) {
  const first = p.messages[0].from;
  let y = 0, last = null;
  return p.messages.map((m) => {
    const lines = px.wrap(m.text, 112, 12);
    const w = Math.max(...lines.map((l) => px.textW(l, 12))) + 10, h = lines.length * 12 + 5;
    const named = m.from !== last;
    if (named) y += last === null ? 0 : 4;
    const top = y + (named ? 11 : 0);
    y = top + h + 4;
    last = m.from;
    return { ...m, lines, w, h, named, top, bottom: y, mine: m.from !== first };
  });
}

const layouts = new WeakMap();

function chat(t, px, p) {
  const { H } = px;
  px.sky(NAVY, BLUE);
  const x = 66, y = 6, w = 188, h = H - 12;
  roundBox(px, x, y, w, h, '#f4f1de');
  px.rect(TEAL, x + 1, y + 1, w - 2, 15);
  px.rect(INK, x + 1, y + 16, w - 2, 1);
  px.text(p.title ?? p.messages[0].from, x + w / 2, y + 2, 14, INK, 'center');
  if (!layouts.has(p)) layouts.set(p, chatLayout(px, p));
  const msgs = layouts.get(p), every = p.every ?? 1.8, start = p.start ?? 0.8;
  const view = { x: x + 2, y: y + 19, w: w - 4, h: h - 22 };
  const shownCount = msgs.filter((_, i) => t >= start + i * every).length;
  const next = msgs[shownCount];
  const typing = next && t >= start + shownCount * every - 0.8;
  const bottom = (shownCount ? msgs[shownCount - 1].bottom : 0) + (typing ? 20 : 0);
  const scroll = Math.max(0, bottom - view.h + 4);
  px.clip([[view.x, view.y, view.w, view.h]], () => {
    msgs.slice(0, shownCount).forEach((m) => {
      const top = view.y + 2 + m.top - scroll;
      const bx = m.mine ? view.x + view.w - m.w - 6 : view.x + 6;
      if (m.named) px.text(m.from, m.mine ? bx + m.w : bx, top - 11, 10, MUTED, m.mine ? 'right' : 'left');
      roundBox(px, bx, top, m.w, m.h, m.mine ? TEAL : '#ffffff');
      m.lines.forEach((l, i) => px.text(l, bx + 5, top + 2 + i * 12, 12, INK));
    });
    if (typing) {
      const top = view.y + 2 + (shownCount ? msgs[shownCount - 1].bottom : 0) + 4 - scroll;
      const bx = next.mine ? view.x + view.w - 32 : view.x + 6;
      roundBox(px, bx, top, 26, 12, next.mine ? TEAL : '#ffffff');
      for (let k = 0; k < 3; k++) px.rect(MUTED, bx + 6 + k * 6, top + 5 - (Math.floor(t * 6) % 3 === k ? 1 : 0), 3, 3);
    }
  });
}

/** One big word or number on a paper card, punched in, a gold line drawn under it, and a line of words beneath. */
function big(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const lay = memo(p, 'big', () => {
    const sub = p.sub ? px.wrap(p.sub, W - 76, 16) : [];
    const size = fit(px, p.text, sub.length > 1 ? 48 : 60, W - 76), wordW = px.textW(p.text, size);
    const w = Math.min(W - 24, Math.max(190, wordW + 64, ...sub.map((line) => px.textW(line, 16) + 44)));
    const h = 22 + size + 12 + (sub.length ? 8 + sub.length * 19 : 0) + 14;
    return { size, wordW, sub, w, h };
  });
  const { size, wordW, sub, w, h } = lay, x = Math.round((W - w) / 2), y = Math.round((H - h) / 2), cy = y + 22;
  px.rect(NIGHT, x + 3, y + 3, w, h);
  px.window(x, y, w, h, LIGHT);
  // the line under the word is drawn from the left once the word has landed, and then stays
  const lineW = Math.round(px.tween(t, 0.6, 0.4, 0, wordW + 12, 'out'));
  if (lineW > 0) px.rect(GOLD, Math.round(W / 2 - wordW / 2 - 6), cy + size + 3, lineW, 5);
  const k = px.tween(t, 0.1, 0.6, 0, 1, 'back');
  if (k > 0.05) px.zoom(k, W / 2, cy + size / 2, () => px.text(p.text, W / 2, cy, size, INK, 'center'));
  if (sub.length) typedBlock(px, p.sub, W / 2, cy + size + 20, t, 0.9, 16, '#2b3550', W - 76);
}

function image(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const k = 1 + Math.min(t, 30) * 0.004;   // a slow push in
  px.zoom(k, W / 2, H / 2, () => px.image(p.name, 16, 12, W - 32, H - 24));
}

/** A chunky arrow pointing right, `len` pixels long, centred on `y`, with an ink shadow. */
function arrow(px, x, y, len, c = GOLD) {
  const head = Math.min(6, len);
  for (const [dx, col] of [[1, INK], [0, c]]) {
    if (len > head) px.rect(col, x + dx, y - 2 + dx, len - head, 4);
    for (let i = 0; i < head; i++) px.rect(col, x + len - head + i + dx, y - (head - i) + dx, 1, 2 * (head - i));
  }
}

/** The icons that are one person, whom an item can give a skin and a hair colour. */
export const PERSON_ICONS = ['woman', 'man', 'girl', 'boy', 'baby'];
/** The skins and hair colours a person icon can have. */
export const SKINS = { light: PALETTE.s, medium: PALETTE.S, deep: PALETTE.d };
export const HAIRS = { black: '#2a1d14', brown: PALETTE.n, blonde: PALETTE.y, ginger: '#c2452d', grey: '#c3c9d0' };
/** The hair a person is given, by skin, when an item does not say. */
const HAIR_FOR = { light: ['brown', 'blonde', 'black', 'ginger'], medium: ['black', 'brown'], deep: ['black'] };

function hash(str) {
  let h = 7;
  for (const ch of str) h = (Math.imul(h, 31) + ch.codePointAt(0)) >>> 0;
  return h;
}

/**
 * The colours a person icon is drawn in, for px.sprite: the skin and hair its item says, or,
 * where it says nothing, a look of its own chosen from its label (or its place, unlabelled).
 * So nobody is drawn one colour by default, and the same person looks the same in every scene.
 * Null for an icon that is not one person.
 */
export function personLook(item, i = 0) {
  if (!PERSON_ICONS.includes(item.icon)) return null;
  const h = hash((item.label ?? `${item.icon} ${i}`).trim().toLowerCase());
  const skin = item.skin ?? Object.keys(SKINS)[h % 3], hairs = HAIR_FOR[skin];
  return { s: SKINS[skin], n: HAIRS[item.hair ?? hairs[Math.floor(h / 3) % hairs.length]] };
}

/** Icons in a row, arriving one by one with their labels; `arrows` joins each to the next. */
function iconRow(t, px, p, arrows) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 34 : 8;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const n = p.items.length, slot = W / n;
  const sc = n <= 2 ? 5 : n === 3 ? 4 : 3, size = ICON_SIZE * sc;
  const labelled = p.items.some((it) => it.label);
  const labelSize = memo(p, 'labelSize', () => Math.min(16, ...p.items.map((it) => (it.label ? fit(px, it.label, 16, slot - 10) : 16))));
  const y0 = top + Math.round((H - top - 6 - size - (labelled ? 8 + labelSize : 0)) / 2);
  const every = p.every ?? 1.4, start = p.start ?? 0.6;
  const latest = Math.floor((t - start) / every);
  p.items.forEach((item, i) => {
    const at = start + i * every, cx = Math.round(slot * (i + 0.5));
    if (arrows && i > 0 && t >= at - 0.4) {
      const from = Math.round(cx - slot + size / 2 + 5), to = Math.round(cx - size / 2 - 5);
      const len = Math.round((to - from) * px.clamp((t - at + 0.4) / 0.3, 0, 1));
      if (len > 0) arrow(px, from, y0 + size / 2, len);
    }
    if (t < at) return;
    const drop = Math.round(px.tween(t, at, 0.6, -size - y0, 0, 'bounce'));
    px.sprite(ICONS[item.icon], cx - size / 2, y0 + drop + (t > at + 0.6 ? px.bob(t + i, 2, 1) : 0), sc, false, personLook(item, i));
    if (item.label) px.text(item.label, cx, y0 + size + 8, labelSize, i === latest && t < at + every + 1 ? GOLD : CREAM, 'center', INK);
  });
}

function icons(t, px, p) { iconRow(t, px, p, false); }
function flow(t, px, p) { iconRow(t, px, p, true); }

/** Two cards side by side: the one to avoid, with a cross, then the one to choose, with a tick. */
function compare(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 34 : 12;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const w = 128, h = H - top - 10, every = p.every ?? 2, start = p.start ?? 0.6;
  const labelSize = memo(p, 'labelSize', () => Math.min(fit(px, p.bad.label, 16, w - 12), fit(px, p.good.label, 16, w - 12)));
  [[p.bad, 'cross', '#d63a3a', 0], [p.good, 'tick', '#3fa34d', 1]].forEach(([side, mark, colour, i]) => {
    const at = start + i * every;
    if (t < at) return;
    const x = i ? W - 22 - w : 22, y = top + Math.round(px.tween(t, at, 0.5, H, 0, 'back'));
    px.rect('#0b1220', x + 3, y + 3, w, h);
    px.window(x, y, w, h, LIGHT);
    px.rect(colour, x + 1, y + 1, w - 2, 20);
    px.rect(INK, x + 1, y + 21, w - 2, 1);
    px.window(x + w / 2 - 10, y + 2, 20, 18, LIGHT);
    px.sprite(ICONS[mark], x + w / 2 - 8, y + 3, 1);
    const sc = 4, size = ICON_SIZE * sc, room = h - 22 - (side.label ? labelSize + 10 : 0);
    const iy = y + 22 + Math.max(2, Math.round((room - size) / 2));
    px.sprite(ICONS[side.icon], x + w / 2 - size / 2, iy + (t > at + 0.5 ? px.bob(t + i * 2, 2, 1) : 0), sc, false, personLook(side, i));
    if (side.label) px.text(side.label, x + w / 2, y + h - labelSize - 8, labelSize, INK, 'center');
  });
}

/** The most rows and columns a table picture can have, the fewest columns, and the most letters in a cell and across a row. */
export const TABLE_MAX = { rows: 5, cols: 4, minCols: 2, cell: 24, across: 56 };

/**
 * A small table on a paper card: a row of headings if it has one, then rows that arrive
 * one by one, the newest lit. The first column is read from the left, as names are; the
 * rest sit in the middle of their columns, as times and amounts do.
 */
function table(t, px, p) {
  const { W, H } = px;
  dotted(px);
  const top = p.heading ? 34 : 10, room = H - top - 10, widest = W - 24;
  if (p.heading) px.sign(p.heading, W / 2, 9, fit(px, p.heading, 16, W - 40), GOLD);
  const lines = [...(p.columns ? [p.columns] : []), ...p.rows], cols = p.rows[0].length, head = p.columns ? 1 : 0;
  const lay = memo(p, 'table', () => {
    const rowH = Math.min(26, Math.floor(room / lines.length));
    const widths = (size) => Array.from({ length: cols }, (_, c) => Math.max(...lines.map((line) => px.textW(line[c], size))) + 14);
    const total = (size) => widths(size).reduce((a, b) => a + b, 0);
    const size = [16, 14, 12, 10].find((sz) => sz + 6 <= rowH && total(sz) <= widest) ?? 10;
    const natural = widths(size), sum = total(size);
    // a table of little words is opened out, so it does not look lost; one too wide for the picture is squeezed to fit
    const want = sum > widest ? widest : Math.max(sum, Math.min(widest, 232));
    const colW = natural.map((w) => Math.floor(w * want / sum));
    return { rowH, size, colW, width: colW.reduce((a, b) => a + b, 0) };
  });
  const { rowH, size, colW, width } = lay, height = rowH * lines.length;
  const x0 = Math.round((W - width) / 2), y0 = top + Math.floor((room - height) / 2);
  const every = p.every ?? 1.4, start = p.start ?? 0.6, latest = Math.floor((t - start) / every);
  px.rect(NIGHT, x0 + 2, y0 + 2, width + 2, height + 2);
  px.window(x0 - 1, y0 - 1, width + 2, height + 2, LIGHT);
  lines.forEach((line, r) => {
    const y = y0 + r * rowH, i = r - head, at = start + i * every;
    const heading = r < head, here = heading || t >= at, lit = !heading && i === latest && t < at + every + 1;
    px.rect(heading ? BLUE : lit ? GOLD : i % 2 ? '#f1e7cb' : LIGHT, x0, y, width, rowH);
    if (r) px.rect(heading || r === head ? INK : '#cfc3a0', x0, y, width, 1);
    if (!here) return;
    const slide = heading ? 0 : Math.round(px.tween(t, at, 0.3, -8, 0, 'out'));
    let x = x0;
    line.forEach((cell, c) => {
      const s = fit(px, cell, size, colW[c] - 8, 8), ty = y + Math.round((rowH - s) / 2) - 1;
      if (c) px.text(cell, x + Math.round(colW[c] / 2) + slide, ty, s, heading ? CREAM : INK, 'center');
      else px.text(cell, x + 7 + slide, ty, s, heading ? CREAM : INK, 'left');
      x += colW[c];
    });
  });
  let x = x0;
  for (let c = 0; c < cols - 1; c++) { x += colW[c]; px.rect('#cfc3a0', x, y0 + head * rowH + 1, 1, height - head * rowH - 1); }
}

/** What is wrong with a table's rows and columns, beyond their being lists of text. */
function tableShape(p) {
  const cols = p.rows[0].length;
  if (p.rows.some((row) => row.length !== cols)) return ['picture.rows must all have the same number of cells'];
  if (p.columns && p.columns.length !== cols) return [`picture.columns has ${p.columns.length} headings for rows of ${cols} cells: give one for each column`];
  const lines = [...(p.columns ? [p.columns] : []), ...p.rows];
  const across = Array.from({ length: cols }, (_, c) => Math.max(...lines.map((line) => [...line[c]].length))).reduce((a, b) => a + b, 0);
  if (across > TABLE_MAX.across) return [`picture: this table is too wide to read: the longest cell of each column comes to ${across} letters, and ${TABLE_MAX.across} fit. Shorten the cells, or use fewer columns`];
  return [];
}

/** Pixel art of the reel's own, from rows of palette letters, scaled to fill the picture. */
function sprite(t, px, p) {
  const { W, H } = px;
  px.sky(NAVY, BLUE);
  px.stars(t);
  const cols = Math.max(...p.rows.map((r) => r.length)), rows = p.rows.length;
  const room = H - (p.label ? 44 : 20);
  const sc = Math.max(1, Math.min(12, Math.floor((W - 32) / cols), Math.floor(room / rows)));
  const x = Math.round((W - cols * sc) / 2), y = Math.round(10 + (room - rows * sc) / 2);
  const drop = Math.round(px.tween(t, 0.2, 0.7, -y - rows * sc, 0, 'bounce'));
  px.sprite(p.rows, x, y + drop + (t > 0.9 ? px.bob(t, 2, 2) : 0), sc, false, p.colours ?? null);
  if (p.label && t >= 0.9) px.sign(p.label, W / 2, H - 30, fit(px, p.label, 16, W - 40), GOLD);
}

/** A thing on a stage as an icon item, for personLook: its label, or failing that its id, keeps its look the same from scene to scene. */
const asItem = (th) => ({ icon: th.is, label: th.label ?? th.id, ...(th.skin ? { skin: th.skin } : {}), ...(th.hair ? { hair: th.hair } : {}) });

/** A place, a few things standing in it, and moves between them (stage.js). */
function stage(t, px, p) { drawStage(t, px, p, (th, i) => personLook(asItem(th), i)); }

/** What is wrong with a stage beyond its fields' being there: stage.js checks it, and a person's skin and hair are checked here. */
function stageCheck(p) {
  return stageProblems(p, (th, where) => {
    const wrong = [];
    for (const key of ['skin', 'hair']) {
      if (th[key] === undefined) continue;
      if (!PERSON_ICONS.includes(th.is)) wrong.push(`${where}.${key}: only a ${PERSON_ICONS.join(', ')} takes ${key}`);
      else if (!Object.hasOwn(LOOKS[key], th[key])) wrong.push(`${where}.${key} must be one of: ${Object.keys(LOOKS[key]).join(', ')}`);
    }
    return wrong;
  });
}

/**
 * Every ready-made picture: its fields (a trailing ? marks optional ones), how it draws, and
 * any check beyond its fields. Kinds: text, list (of text), messages ([{ from, text }]), number,
 * flag (true or false), image (a name from images), objects (a list the picture's own check looks into), items (1 to 4 { icon, label? }), item
 * ({ icon, label }), rows (sprite rows of palette letters) and colours ({ letter: '#rrggbb' }).
 */
export const PICTURES = {
  title: { fields: { text: 'text', sub: 'text?' }, draw: title },
  list: { fields: { items: 'list', heading: 'text?', numbered: 'flag?', every: 'number?', start: 'number?' }, draw: list },
  terminal: { fields: { lines: 'list', title: 'text?' }, draw: terminal },
  code: { fields: { lines: 'list', title: 'text?' }, draw: code },
  chat: { fields: { messages: 'messages', title: 'text?', every: 'number?', start: 'number?' }, draw: chat },
  big: { fields: { text: 'text', sub: 'text?' }, draw: big },
  image: { fields: { name: 'image' }, draw: image },
  icons: { fields: { items: 'items', heading: 'text?', every: 'number?', start: 'number?' }, draw: icons },
  flow: { fields: { items: 'items', heading: 'text?', every: 'number?', start: 'number?' }, draw: flow },
  compare: { fields: { bad: 'item', good: 'item', heading: 'text?', every: 'number?', start: 'number?' }, draw: compare },
  table: { fields: { rows: 'cells', columns: 'heads?', heading: 'text?', every: 'number?', start: 'number?' }, draw: table, check: tableShape },
  sprite: { fields: { rows: 'rows', colours: 'colours?', label: 'text?' }, draw: sprite, check: spriteLetters },
  stage: { fields: { place: 'text', things: 'objects', moves: 'objects' }, draw: stage, check: stageCheck }
};

/** The names a picture can use for an icon. */
export const ICON_NAMES = Object.keys(ICONS);

/** The most rows, and letters in a row, a sprite picture can have. */
export const SPRITE_MAX = { rows: 40, cols: 64 };

/** Any letter in a sprite's rows that is neither see-through, a palette letter, nor one of its colours. */
function spriteLetters(p) {
  const own = p.colours && typeof p.colours === 'object' ? Object.keys(p.colours) : [];
  for (const [i, row] of (Array.isArray(p.rows) ? p.rows : []).entries()) {
    const odd = typeof row === 'string' && [...row].find((ch) => ch !== '.' && ch !== ' ' && !(ch in PALETTE) && !own.includes(ch));
    if (odd) return [`picture.rows[${i}] uses "${odd}", which is not a palette letter: add it to colours, such as { "${odd}": "#336699" }`];
  }
  return [];
}

const LOOKS = { skin: SKINS, hair: HAIRS };
const isIconItem = (v, labelled) => v !== null && typeof v === 'object' && !Array.isArray(v) && ICON_NAMES.includes(v.icon) &&
  (labelled ? isText(v.label) : v.label === undefined || isText(v.label)) &&
  Object.entries(v).every(([k, x]) => k === 'icon' || k === 'label' || (k in LOOKS && PERSON_ICONS.includes(v.icon) && Object.hasOwn(LOOKS[k], x)));
const iconHelp = `icons: ${Object.keys(ICONS).join(', ')}. A ${PERSON_ICONS.join(', ')} can also take skin (${Object.keys(SKINS).join(', ')}) and hair (${Object.keys(HAIRS).join(', ')})`;

const isText = (v) => typeof v === 'string' && v.trim() !== '';
/** One row of a table: a few short cells of text. */
const isCells = (v) => Array.isArray(v) && v.length >= TABLE_MAX.minCols && v.length <= TABLE_MAX.cols && v.every((cell) => isText(cell) && [...cell].length <= TABLE_MAX.cell);
const KINDS = {
  text: [isText, 'must be text'],
  list: [(v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string'), 'must be a list of text, for example ["One", "Two"]'],
  messages: [(v) => Array.isArray(v) && v.length > 0 && v.every((m) => m && isText(m.from) && isText(m.text)), 'must be a list of { from: "Name", text: "Hello" }'],
  number: [(v) => typeof v === 'number' && Number.isFinite(v) && v >= 0, 'must be a number of seconds'],
  flag: [(v) => typeof v === 'boolean', 'must be true or false'],
  items: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= 4 && v.every((it) => isIconItem(it, false)),
    `must be a list of 1 to 4 { icon, label }, such as [{ "icon": "house", "label": "Home" }], with ${iconHelp}`],
  item: [(v) => isIconItem(v, true), `must be { icon, label }, such as { "icon": "phone", "label": "Ring us" }, with ${iconHelp}`],
  rows: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= SPRITE_MAX.rows && v.every((r) => typeof r === 'string' && r.length <= SPRITE_MAX.cols) && v.some((r) => r.length),
    `must be a list of rows of palette letters, such as ["..yy..", ".yyyy."], up to ${SPRITE_MAX.rows} rows of up to ${SPRITE_MAX.cols} letters`],
  cells: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= TABLE_MAX.rows && v.every((row) => isCells(row)),
    `must be 1 to ${TABLE_MAX.rows} rows, each a list of ${TABLE_MAX.minCols} to ${TABLE_MAX.cols} short cells of text, such as [["High Street", "9:05"], ["Station", "9:20"]]`],
  heads: [(v) => isCells(v), `must be a list of ${TABLE_MAX.minCols} to ${TABLE_MAX.cols} short headings, one for each column, such as ["Stop", "Time"]`],
  objects: [(v) => Array.isArray(v) && v.length > 0, 'must be a list'],
  colours: [(v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.entries(v).every(([k, c]) => [...k].length === 1 && k !== '.' && k !== ' ' && typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)),
    'must be letters and the colours they stand for, such as { "h": "#6b3e2e" }']
};

/** Everything wrong with a scene's `picture`, as a list of messages (empty when it is fine). */
export function pictureProblems(picture, imageNames = []) {
  const types = Object.keys(PICTURES);
  if (!picture || typeof picture !== 'object' || Array.isArray(picture)) return [`picture must be an object such as { type: 'title', text: 'Hello' }`];
  const spec = PICTURES[picture.type];
  if (!spec) return [`picture.type must be one of: ${types.join(', ')}`];
  const problems = [];
  const fields = Object.keys(spec.fields);
  for (const key of Object.keys(picture)) {
    if (key !== 'type' && !fields.includes(key)) problems.push(`picture: a ${picture.type} picture takes ${fields.join(', ')}, not ${key}`);
  }
  for (const [key, want] of Object.entries(spec.fields)) {
    const optional = want.endsWith('?'), kind = want.replace('?', ''), value = picture[key];
    if (value === undefined) { if (!optional) problems.push(`picture.${key} is needed for a ${picture.type} picture`); continue; }
    if (kind === 'image') {
      if (!imageNames.includes(value)) problems.push(`picture.${key} must name one of the reel's images${imageNames.length ? ` (${imageNames.join(', ')})` : ', and this reel has none'}`);
      continue;
    }
    const [ok, says] = KINDS[kind];
    if (!ok(value)) problems.push(`picture.${key} ${says}`);
  }
  if (spec.check && !problems.length) problems.push(...spec.check(picture));
  return problems;
}

/** Draws ready-made picture `spec` at time `t` with pixel kit `px`. */
export function drawPicture(spec, t, px) {
  const kind = PICTURES[spec?.type];
  if (!kind) throw new Error(`there is no ready-made picture called "${spec?.type}"`);
  kind.draw(t, px, spec);
}

const BARS = [CREAM, GOLD, TEAL, '#3fa34d', '#8e5bd6', '#d63a3a', BLUE];

/** The player's test card, shown when a reel will not load: colour bars, a rolling band of static and NO SIGNAL. */
export function noSignal(t, px) {
  const { W, H } = px, bw = W / BARS.length, frame = Math.floor(t * 12);
  BARS.forEach((c, i) => {
    const x = Math.round(i * bw), w = Math.round((i + 1) * bw) - x;
    px.rect(c, x, 0, w, 122);
    px.rect(i % 2 ? NIGHT : BARS[BARS.length - 1 - i], x, 122, w, 14);
  });
  px.rect(NIGHT, 0, 136, W, H - 136);
  for (let i = 0; i < 4; i++) px.rect(['#05080f', NAVY, '#1a2b47', MUTED][i], 24 + i * 22, 146, 22, 24);
  const band = Math.round((t * 40) % (H + 16)) - 16;
  px.dither(LIGHT, 0, band, W, 16, 0.25);
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(px.rand(frame * 997 + i) * W), y = Math.floor(px.rand(frame * 991 + i + 0.5) * H);
    px.rect(i % 3 ? LIGHT : INK, x, y, 1 + (i % 2), 1);
  }
  px.sign('NO SIGNAL', W / 2, 44, 24, NIGHT, GOLD);
  px.sign('Have you tried turning it off and on again?', W / 2, 82, 12, NIGHT, CREAM);
}
