// The weekly drawer: new library drawings from the names the reels wished for (docs/library.md).
// Opus draws each in the library's style, as rows of palette letters; a second Claude is shown
// each drawing, without its name, and asked what it is, so a drawing nobody would know is seen
// as such before Olly looks; and an approved drawing is written into src/library.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PEOPLE, THING_GROUPS, THINGS } from '../src/library.js';
import { PALETTE } from '../src/palette.js';
import { CAST } from '../src/stage.js';
import { ICONS } from '../src/icons.js';
import { replyJson } from '../service/try.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LIBRARY_FILE = join(ROOT, 'src', 'library.js');

/** The most letters across and down a library drawing may have. */
export const DRAWING_MAX = { cols: 30, rows: 26, minCols: 6, minRows: 6 };

/** A wished-for name as the library would call it: "Gas meter" is gas-meter. Null if it is not a plain name. */
export function libraryName(wish) {
  const name = String(wish ?? '').trim().toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return /^[a-z][a-z0-9-]{1,30}$/.test(name) ? name : null;
}

/** True if the library (or the cast, or an icon) already has `name`, or its plural or singular. */
export function libraryHas(name) {
  const forms = [name, name.replace(/s$/, ''), `${name}s`];
  return forms.some((n) => Object.hasOwn(THINGS, n) || Object.hasOwn(PEOPLE, n) || CAST.includes(n) || Object.hasOwn(ICONS, n));
}

/** What is wrong with a drawing: [] when it can go on the sheet. */
export function drawingProblems(d) {
  const problems = [];
  const rows = d?.rows;
  if (!Array.isArray(rows) || rows.length < DRAWING_MAX.minRows || rows.length > DRAWING_MAX.rows || !rows.every((r) => typeof r === 'string')) {
    return [`"rows" must be ${DRAWING_MAX.minRows} to ${DRAWING_MAX.rows} rows of letters`];
  }
  const widths = new Set(rows.map((r) => r.length));
  if (widths.size > 1) problems.push(`every row must be the same length; they run from ${Math.min(...widths)} to ${Math.max(...widths)}`);
  if (Math.max(...widths) > DRAWING_MAX.cols || Math.min(...widths) < DRAWING_MAX.minCols) problems.push(`a row is ${DRAWING_MAX.minCols} to ${DRAWING_MAX.cols} letters`);
  const own = d.colours && typeof d.colours === 'object' ? d.colours : {};
  for (const [k, v] of Object.entries(own)) if ([...k].length !== 1 || !/^#[0-9a-f]{6}$/i.test(String(v))) problems.push(`colours: "${k}" must be one letter for a colour such as "#6b3e2e"`);
  const odd = [...new Set(rows.join(''))].filter((ch) => ch !== '.' && !Object.hasOwn(PALETTE, ch) && !Object.hasOwn(own, ch));
  if (odd.length) problems.push(`letters ${odd.map((ch) => `"${ch}"`).join(', ')} are not palette letters: add them to colours`);
  if (!rows.join('').includes('k')) problems.push('outline it in k, black, as the library\'s drawings are');
  if (typeof d.says !== 'string' || !d.says.trim()) problems.push('"says" is what it is, in a few plain words');
  return problems;
}

/** What the drawer is told: the palette, the style, and a few of the library's own drawings to match. */
function drawerSystem() {
  const examples = ['letter', 'kettle', 'guitar', 'gas-meter', 'laptop'].map((name) => `${name}: ${JSON.stringify({ rows: THINGS[name].rows, ...(THINGS[name].colours ? { colours: THINGS[name].colours } : {}) })}`);
  return `You draw pixel art for Pixel Reel's library: things that stand on a stage in short explainer cartoons. Each drawing is rows of letters, one letter a pixel, drawn three screen pixels to one of its own.

The letters: ${Object.entries(PALETTE).map(([k, v]) => `${k} ${v}`).join(', ')}, and "." for see-through. For a colour the palette lacks, add "colours": { "letter": "#rrggbb" }.
The style, the same as every drawing in the library:
- Outlined in k (black), one pixel thick, with flat colours inside and a little shading in a darker shade.
- Seen from the side or the front, the way a child would draw it, so anyone knows it at a glance from its shape alone.
- ${DRAWING_MAX.minCols} to ${DRAWING_MAX.cols} letters across and ${DRAWING_MAX.minRows} to ${DRAWING_MAX.rows} down, every row the same length, standing on its bottom row.
- No words or letters in it, and no face on a thing that has none.
Some of the library's drawings, to match:
${examples.join('\n')}

Reply with one JSON object and nothing else: { "rows": [...], "colours": { } (optional), "says": "what it is, in a few plain words", "group": one of ${Object.keys(THING_GROUPS).map((g) => JSON.stringify(g)).join(', ')} }.`;
}

/** Has Claude draw `name` (one try, and one more to mend it). Resolves to a drawing, or throws. */
export async function drawThing(client, name, { model = 'claude-opus-5-5', effort = 'medium', log = () => {} } = {}) {
  const messages = [{ role: 'user', content: `Draw a ${name.replace(/-/g, ' ')}.` }];
  for (let round = 1; ; round++) {
    const response = await client.messages.create({ model, max_tokens: 16000, output_config: { effort }, system: drawerSystem(), messages });
    log(`drawer: ${name}, ${response.usage.input_tokens} tokens in, ${response.usage.output_tokens} out (${response.model})`);
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let drawing = null, problems;
    try { drawing = replyJson(text); problems = drawingProblems(drawing); } catch { problems = ['reply with one JSON object and nothing else']; }
    if (!problems.length) return { rows: drawing.rows, ...(drawing.colours && Object.keys(drawing.colours).length ? { colours: drawing.colours } : {}), says: drawing.says.trim(), group: Object.hasOwn(THING_GROUPS, drawing.group) ? drawing.group : 'Out and about' };
    if (round === 2) throw new Error(`${name} could not be drawn: ${problems.join('; ')}`);
    messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That drawing has problems. Fix every one and reply with the whole JSON again:\n- ${problems.join('\n- ')}` });
  }
}

/** A drawing as a PNG, big, on a pale card, for the blind look and the sheet. */
export async function drawingPng(d, { scale = 6 } = {}) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const cols = d.rows[0].length, rows = d.rows.length, c = createCanvas(cols * scale + 40, rows * scale + 40), g = c.getContext('2d');
  g.fillStyle = '#dfe7ee';
  g.fillRect(0, 0, c.width, c.height);
  d.rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    g.fillStyle = d.colours?.[ch] ?? PALETTE[ch];
    g.fillRect(20 + i * scale, 20 + j * scale, scale, scale);
  }));
  return c.toBuffer('image/png');
}

/** The words of a name or an answer, as compared: lower case, without plural endings. */
const stems = (text) => String(text).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2).map((w) => w.replace(/(es|s)$/, ''));

/** Whether `seen` (what the blind look said) names `name` or what it `says` it is. */
export function recognised(name, says, seen) {
  const want = new Set([...stems(name.replace(/-/g, ' ')), ...stems(says)]), got = stems(seen);
  return got.some((w) => want.has(w));
}

/** Shows Claude a drawing without its name, and asks what it is. Resolves to { seen, recognised }. */
export async function blindLook(client, name, drawing, { model = 'claude-sonnet-5-5', log = () => {} } = {}) {
  const png = (await drawingPng(drawing)).toString('base64');
  const response = await client.messages.create({
    model, max_tokens: 200, output_config: { effort: 'low' },
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } }, { type: 'text', text: 'What is this pixel-art drawing of? Answer in four words at most, and nothing else.' }] }]
  });
  log(`drawer: blind look at ${name}, ${response.usage.input_tokens} tokens in, ${response.usage.output_tokens} out`);
  const seen = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim().replace(/[.\n]+$/, '').slice(0, 60);
  return { seen, recognised: recognised(name, drawing.says, seen) };
}

/** A library entry as src/library.js writes one. */
export function entryJs(name, d) {
  const key = /^[a-z]+$/.test(name) ? name : `'${name}'`;
  const colours = d.colours ? `,\n    colours: { ${Object.entries(d.colours).map(([k, v]) => `${/^[A-Za-z]$/.test(k) ? k : `'${k}'`}: '${v}'`).join(', ')} }` : '';
  return `  ${key}: {\n    group: '${d.group}', says: '${d.says.replace(/\\/g, '').replace(/'/g, "\\'")}',\n    rows: [\n${d.rows.map((r) => `      '${r}'`).join(',\n')}\n    ]${colours}\n  }`;
}

/** Writes approved drawings (name: drawing) into the library's THINGS, after the last one. Resolves to the names added. */
export function addToLibrary(drafts, { file = LIBRARY_FILE, day = new Date().toISOString().slice(0, 10) } = {}) {
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf('export const THINGS = {'), end = text.indexOf('\n};\n', start);
  if (start < 0 || end < 0) throw new Error('src/library.js has no THINGS to add to');
  const names = Object.keys(drafts).filter((name) => !Object.hasOwn(THINGS, name));
  if (!names.length) return [];
  const block = `,\n  // ----- said yes to on the weekly sheet, ${day}\n${names.map((name) => entryJs(name, drafts[name])).join(',\n')}`;
  writeFileSync(file, text.slice(0, end) + block + text.slice(end));
  return names;
}
