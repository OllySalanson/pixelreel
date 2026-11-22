import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { ICON_GROUPS, ICONS, ICON_SIZE } from '../src/icons.js';
import { PALETTE } from '../src/palette.js';
import { highlight, ICON_NAMES, noSignal, PICTURES, pictureProblems } from '../src/pictures.js';
import { coverage, fakeContext } from './fake-canvas.js';

const examples = {
  title: { type: 'title', text: 'PIXELREEL', sub: 'Narrated pixel-art videos from a list of scenes' },
  list: { type: 'list', heading: 'WHERE IT HELPS', items: ['Onboarding', 'Release notes', 'Pull requests'], numbered: true, every: 1, start: 0.2 },
  terminal: { type: 'terminal', title: 'bash', lines: ['$ npm run new my-reel', 'Made reels/my-reel/reel.js', '$ npm run voices my-reel'] },
  code: { type: 'code', title: 'reel.js', lines: ['export default {', "  title: 'Tea', // hot", '  scenes: []', '};'] },
  chat: { type: 'chat', title: 'Launch', messages: [{ from: 'Boss', text: 'Status?' }, { from: 'You', text: 'Made you a cartoon.' }, { from: 'Boss', text: 'Lovely.' }] },
  big: { type: 'big', text: '2 MIN', sub: 'to make your first reel' },
  image: { type: 'image', name: 'garden' },
  icons: { type: 'icons', heading: 'YOU NEED', items: [{ icon: 'letter', label: 'The letter' }, { icon: 'phone' }, { icon: 'cup', label: 'Tea' }] },
  flow: { type: 'flow', items: [{ icon: 'person', label: 'You ask' }, { icon: 'document', label: 'Scenes' }, { icon: 'heart', label: 'You watch' }], every: 1 },
  compare: { type: 'compare', heading: 'WHICH?', bad: { icon: 'document', label: 'A long letter' }, good: { icon: 'computer', label: 'A pixel reel' } },
  sprite: { type: 'sprite', label: 'MY CAT', colours: { h: '#6b3e2e' }, rows: ['.h....h.', 'hhh..hhh', 'hkhhhhkh', 'hhhyyhhh', '.hhhhhh.'] }
};

describe('ready-made pictures', () => {
  it('has an example of every one, and each is valid', () => {
    assert.deepEqual(Object.keys(examples).sort(), Object.keys(PICTURES).sort());
    for (const p of Object.values(examples)) assert.deepEqual(pictureProblems(p, ['garden']), [], p.type);
  });

  it('draws every one at every moment without a hitch', () => {
    for (const p of Object.values(examples)) {
      const g = fakeContext(), px = createKit(g, {});
      for (const t of [0, 0.4, 1.3, 3, 8, 30]) px.picture(p, t);
      assert.ok(g.rects.length > 0, `${p.type} draws something`);
      assert.equal(g.depth, 0, `${p.type} restores what it changes`);
    }
  });

  it('shows the words it was given', () => {
    const g = fakeContext(), px = createKit(g, {});
    px.picture(examples.list, 30);
    for (const item of examples.list.items) assert.ok(g.texts.some((x) => x.str === item), item);
    px.picture(examples.chat, 30);
    assert.ok(g.texts.some((x) => x.str === 'Lovely.'));
  });

  it('says exactly what is wrong with a picture', () => {
    assert.deepEqual(pictureProblems(null), ["picture must be an object such as { type: 'title', text: 'Hello' }"]);
    assert.match(pictureProblems({ type: 'movie' })[0], /^picture.type must be one of: title, list, terminal, code, chat, big, image, icons, flow, compare, sprite$/);
    assert.deepEqual(pictureProblems({ type: 'list', itmes: ['a'] }), [
      'picture: a list picture takes items, heading, numbered, every, start, not itmes',
      'picture.items is needed for a list picture'
    ]);
    assert.deepEqual(pictureProblems({ type: 'list', items: [], numbered: 'yes', every: -1 }), [
      'picture.items must be a list of text, for example ["One", "Two"]',
      'picture.numbered must be true or false',
      'picture.every must be a number of seconds'
    ]);
    assert.deepEqual(pictureProblems({ type: 'chat', messages: [{ from: 'A' }] }), ['picture.messages must be a list of { from: "Name", text: "Hello" }']);
    assert.deepEqual(pictureProblems({ type: 'image', name: 'nope' }, ['garden']), ["picture.name must name one of the reel's images (garden)"]);
    assert.deepEqual(pictureProblems({ type: 'image', name: 'nope' }), ["picture.name must name one of the reel's images, and this reel has none"]);
  });

  it('says which icons there are, and checks a sprite for letters it cannot draw', () => {
    const icons = ICON_NAMES.join(', ');
    assert.deepEqual(pictureProblems({ type: 'icons', items: [{ icon: 'house' }, { icon: 'castle' }] }), [
      `picture.items must be a list of 1 to 4 { icon, label }, such as [{ "icon": "house", "label": "Home" }], with icons: ${icons}`
    ]);
    assert.equal(pictureProblems({ type: 'flow', items: Array(5).fill({ icon: 'tick' }) }).length, 1, 'no more than four');
    assert.deepEqual(pictureProblems({ type: 'compare', bad: { icon: 'car', label: 'Drive' }, good: { icon: 'phone' } }), [
      `picture.good must be { icon, label }, such as { "icon": "phone", "label": "Ring us" }, with icons: ${icons}`
    ]);
    assert.deepEqual(pictureProblems({ type: 'sprite', rows: ['..yz..'] }), [
      'picture.rows[0] uses "z", which is not a palette letter: add it to colours, such as { "z": "#336699" }'
    ]);
    assert.deepEqual(pictureProblems({ type: 'sprite', rows: ['..yz..'], colours: { z: '#123' } }), []);
    assert.deepEqual(pictureProblems({ type: 'sprite', rows: ['y'], colours: { z: 'red' } }), ['picture.colours must be letters and the colours they stand for, such as { "h": "#6b3e2e" }']);
    assert.equal(pictureProblems({ type: 'sprite', rows: [] }).length, 1);
    assert.equal(pictureProblems({ type: 'sprite', rows: ['y'.repeat(65)] }).length, 1, 'rows of up to 64 letters');
  });

  it('draws each icon a picture names, and every label', () => {
    const g = fakeContext(), px = createKit(g, {});
    px.picture(examples.flow, 30);
    for (const label of ['You ask', 'Scenes', 'You watch']) assert.ok(g.texts.some((x) => x.str === label), label);
    px.picture(examples.compare, 30);
    for (const label of ['A long letter', 'A pixel reel']) assert.ok(g.texts.some((x) => x.str === label), label);
  });

  it('highlights code without losing a character', () => {
    for (const line of ["export default { title: 'Tea', n: 42 }; // done", 'const s = "a \\" b";', '', '  # a comment']) {
      assert.equal(highlight(line).map(([s]) => s).join(''), line);
    }
    const colours = Object.fromEntries(highlight("const n = 'x'; // hi").map(([s, c]) => [s, c]));
    assert.notEqual(colours.const, colours.n, 'keywords stand out');
    assert.notEqual(colours["'x'"], colours.n, 'and strings');
    assert.notEqual(colours['// hi'], colours.n, 'and comments');
  });
});

describe('the no signal card', () => {
  it('fills the whole picture, says NO SIGNAL and restores what it changes', () => {
    const g = fakeContext(), px = createKit(g, {});
    noSignal(0, px);
    assert.equal(coverage(g.rects, { x: 0, y: 0, w: 320, h: 180 }), 320 * 180);
    assert.ok(g.texts.some((x) => x.str === 'NO SIGNAL'));
    assert.equal(g.depth, 0);
  });

  it('crackles with static as time passes, and holds still at one moment', () => {
    const at = (t) => { const g = fakeContext(); noSignal(t, createKit(g, {})); return JSON.stringify(g.rects); };
    assert.equal(at(1.2), at(1.2));
    assert.notEqual(at(0), at(1.2));
  });
});

describe('the icons', () => {
  it('are all square, the same size, and drawn in palette letters', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      assert.equal(rows.length, ICON_SIZE, `${name} has ${ICON_SIZE} rows`);
      for (const row of rows) {
        assert.equal(row.length, ICON_SIZE, `${name}: "${row}" is ${ICON_SIZE} wide`);
        assert.ok([...row].every((ch) => ch === '.' || ch in PALETTE), `${name}: "${row}" uses only palette letters`);
      }
    }
    assert.deepEqual(ICON_NAMES, Object.keys(ICONS));
  });

  it('keep the first twenty where they were, with plenty more to choose from', () => {
    assert.deepEqual(ICON_NAMES.slice(0, 20), ['letter', 'document', 'phone', 'money', 'house', 'calendar', 'clock', 'person', 'people', 'heart',
      'tick', 'cross', 'warning', 'lock', 'computer', 'lightbulb', 'cup', 'car', 'question', 'star']);
    assert.ok(ICON_NAMES.length >= 60, `${ICON_NAMES.length} icons`);
    for (const name of ['water', 'fire', 'bolt', 'sun', 'book', 'key', 'bus', 'pill', 'card', 'baby']) assert.ok(name in ICONS, name);
    for (const name of ICON_NAMES) assert.match(name, /^[a-z]+$/, `${name} is one plain word`);
  });

  it('are each in one group, and no group names an icon that is not there', () => {
    const grouped = Object.values(ICON_GROUPS).flat();
    assert.deepEqual([...grouped].sort(), [...ICON_NAMES].sort());
    assert.equal(new Set(grouped).size, grouped.length, 'none is in two groups');
  });

  it('are not blank, and no two are the same picture', () => {
    const seen = new Map();
    for (const [name, rows] of Object.entries(ICONS)) {
      const art = rows.join('\n');
      assert.ok([...art].filter((ch) => ch !== '.' && ch !== '\n').length >= 20, `${name} has something in it`);
      assert.equal(seen.get(art), undefined, `${name} is the same as ${seen.get(art)}`);
      seen.set(art, name);
    }
  });

  it('show on the dark blue of a picture: none is drawn only in black', () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      assert.ok([...rows.join('')].some((ch) => ch !== '.' && ch !== 'k'), `${name} has a colour besides its outline`);
    }
  });

  it('are all listed, by group, where people and agents read what there is', () => {
    for (const file of ['../docs/scenes.md', '../skill/pixel-reel/SKILL.md']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      for (const [group, names] of Object.entries(ICON_GROUPS)) {
        assert.ok(text.includes(`**${group}:** ${names.map((n) => `\`${n}\``).join(', ')}`), `${file} lists ${group}`);
      }
    }
  });
});
