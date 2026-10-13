// Ready-made pictures: a scene can say picture: { type: 'list', items: [...] } instead of
// writing draw(t, px). Each one animates in time with the scene. Data only, so a script or
// an AI agent can write a whole reel without a line of drawing code.

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

function list(t, px, p) {
  const { W, H } = px;
  px.rect(NAVY, 0, 0, W, H);
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
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

function big(t, px, p) {
  const { W, H } = px;
  px.rect('#1d1236', 0, 0, W, H);
  // squares rushing out from the middle
  for (let k = 0; k < 10; k++) {
    const r = ((k * 22 + t * 26) % 220) + 4, c = k % 2 ? '#2c1b52' : '#3a2470';
    px.rect(c, W / 2 - r, H / 2 - r, 2 * r, 6); px.rect(c, W / 2 - r, H / 2 + r - 6, 2 * r, 6);
    px.rect(c, W / 2 - r, H / 2 - r, 6, 2 * r); px.rect(c, W / 2 + r - 6, H / 2 - r, 6, 2 * r);
  }
  const size = fit(px, p.text, 48, W - 30);
  const cy = p.sub ? 58 : 72;
  const k = px.tween(t, 0.1, 0.6, 0, 1, 'back');
  if (k > 0.05) {
    px.zoom(k, W / 2, cy + size / 2, () => {
      px.text(p.text, W / 2, cy + 3, size, INK, 'center');
      px.text(p.text, W / 2, cy, size, GOLD, 'center', '#a52222');
    });
  }
  if (p.sub) typedBlock(px, p.sub, W / 2, cy + size + 10, t, 0.9, 16, LIGHT, W - 50);
}

function image(t, px, p) {
  const { W, H } = px;
  px.rect(NIGHT, 0, 0, W, H);
  const k = 1 + Math.min(t, 30) * 0.004;   // a slow push in
  px.zoom(k, W / 2, H / 2, () => px.image(p.name, 16, 12, W - 32, H - 24));
}

/**
 * Every ready-made picture: its fields (a trailing ? marks optional ones) and how it draws.
 * Kinds: text, list (of text), messages ([{ from, text }]), number, flag (true or false), image (a name from images).
 */
export const PICTURES = {
  title: { fields: { text: 'text', sub: 'text?' }, draw: title },
  list: { fields: { items: 'list', heading: 'text?', numbered: 'flag?', every: 'number?', start: 'number?' }, draw: list },
  terminal: { fields: { lines: 'list', title: 'text?' }, draw: terminal },
  code: { fields: { lines: 'list', title: 'text?' }, draw: code },
  chat: { fields: { messages: 'messages', title: 'text?', every: 'number?', start: 'number?' }, draw: chat },
  big: { fields: { text: 'text', sub: 'text?' }, draw: big },
  image: { fields: { name: 'image' }, draw: image }
};

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const KINDS = {
  text: [isText, 'must be text'],
  list: [(v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string'), 'must be a list of text, for example ["One", "Two"]'],
  messages: [(v) => Array.isArray(v) && v.length > 0 && v.every((m) => m && isText(m.from) && isText(m.text)), 'must be a list of { from: "Name", text: "Hello" }'],
  number: [(v) => typeof v === 'number' && Number.isFinite(v) && v >= 0, 'must be a number of seconds'],
  flag: [(v) => typeof v === 'boolean', 'must be true or false']
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
