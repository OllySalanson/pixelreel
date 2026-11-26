import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { ICON_GROUPS, ICONS, ICON_SIZE } from '../src/icons.js';
import { PALETTE } from '../src/palette.js';
import { HAIRS, highlight, ICON_NAMES, noSignal, PERSON_ICONS, personLook, PICTURES, pictureProblems, SKINS } from '../src/pictures.js';
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
  table: { type: 'table', heading: 'SUNDAY BUSES', columns: ['Stop', '1st bus', '2nd bus'], rows: [['High Street', '9:05', '9:35'], ['Library', '9:12', '9:42'], ['Station', '9:20', '9:50']] },
  stage: { type: 'stage', place: 'street', things: [{ id: 'home', is: 'house', spot: 'left', label: 'Your home' }, { id: 'bank', is: 'bank', spot: 'right' }, { id: 'reelie', is: 'reelie', spot: 'far-left' }], moves: [{ do: 'send', what: 'letter', from: 'bank', to: 'home', cue: 'a letter' }, { do: 'pile', on: 'bank', count: 3 }] },
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
    assert.match(pictureProblems({ type: 'movie' })[0], /^picture.type must be one of: title, list, terminal, code, chat, big, image, icons, flow, compare, table, sprite, stage$/);
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
    const icons = `${ICON_NAMES.join(', ')}. A woman, man, girl, boy, baby can also take skin (light, medium, deep) and hair (black, brown, blonde, ginger, grey)`;
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

  it('shows a big word on a still paper card: nothing rushes about behind it', () => {
    const drawn = (p, t) => { const g = fakeContext(); createKit(g, {}).picture(p, t); return g; };
    const p = { type: 'big', text: '£83.50', sub: 'the total to pay' };
    const settled = drawn(p, 5);
    assert.equal(JSON.stringify(drawn(p, 9).rects), JSON.stringify(settled.rects), 'once the word has landed, the picture holds still');
    assert.equal(JSON.stringify(drawn(p, 9).texts), JSON.stringify(settled.texts));
    assert.ok(settled.texts.some((x) => x.str === '£83.50') && settled.texts.some((x) => x.str === 'the total to pay'));
    for (const g of [drawn(p, 0), drawn(p, 0.4), settled]) {
      for (const r of g.rects) {
        assert.ok(!['#1d1236', '#2c1b52', '#3a2470'].includes(r.c), 'none of the old purple');
        assert.ok(r.x >= 0 && r.x + r.w <= 320 && r.y >= 0 && r.y + r.h <= 180, `inside the picture: ${JSON.stringify(r)}`);
      }
      assert.ok(g.rects.some((r) => r.c === '#fdf6e3' && r.w >= 180 && r.h >= 60), 'the card is paper, there from the first moment');
    }
    assert.equal(drawn(p, 0.4).rects.filter((r) => r.c === '#ffcc4d').length, 0, 'the gold line is drawn once the word has landed');
    assert.equal(settled.rects.filter((r) => r.c === '#ffcc4d').length, 1);
    // a long line underneath wraps inside the card, and a word alone still gets one
    for (const one of [{ type: 'big', text: 'ONE THING AT A TIME', sub: 'fixed fee for being connected, whatever you use' }, { type: 'big', text: '6' }]) {
      for (const r of drawn(one, 30).rects) assert.ok(r.x >= 0 && r.x + r.w <= 320 && r.y >= 0 && r.y + r.h <= 180, JSON.stringify(r));
    }
  });

  it('fills a table in a row at a time, the headings there from the start', () => {
    const words = (t) => { const g = fakeContext(); createKit(g, {}).picture(examples.table, t); return g.texts.map((x) => x.str); };
    const cells = (rows) => ['SUNDAY BUSES', 'Stop', '1st bus', '2nd bus', ...rows.flat()];
    assert.deepEqual(words(0.2).sort(), cells([]).sort(), 'before any row arrives, only its headings');
    assert.deepEqual(words(0.6 + 1.4 + 0.1).sort(), cells(examples.table.rows.slice(0, 2)).sort(), 'the second row is there once its turn comes');
    assert.deepEqual(words(30).sort(), cells(examples.table.rows).sort(), 'and every cell by the end');
    const paced = (t) => { const g = fakeContext(); createKit(g, {}).picture({ ...examples.table, start: 2, every: 3 }, t); return g.texts.length; };
    assert.equal(paced(1.9), 4, 'start and every say when its rows arrive, as for a list');
    assert.equal(paced(5.1), 4 + 6);
    // the newest row is lit, and stops being once the next one comes
    const bare = { type: 'table', columns: examples.table.columns, rows: examples.table.rows };   // no heading, whose sign is gold too
    const lit = (t) => { const g = fakeContext(); createKit(g, {}).picture(bare, t); return g.rects.filter((r) => r.c === '#ffcc4d' && r.w > 100).length; };
    assert.equal(lit(0.7), 1);
    assert.equal(lit(30), 0, 'none is left lit at the end');
    // one with no headings, and one whose cells are as long as they may be, still fit the picture
    for (const p of [{ type: 'table', rows: [['Monday', 'Bins'], ['Friday', 'Garden waste']] },
      { type: 'table', columns: ['Appointment type', 'When to book', 'How long'], rows: [['Routine check up', 'Two weeks ahead', '10 minutes'], ['Something urgent', "Ring at 8 o'clock", '5 minutes']] }]) {
      assert.deepEqual(pictureProblems(p), []);
      const g = fakeContext();
      createKit(g, {}).picture(p, 30);
      for (const r of g.rects) assert.ok(r.x >= 0 && r.x + r.w <= 320 && r.y >= 0 && r.y + r.h <= 180, `inside the picture: ${JSON.stringify(r)}`);
    }
  });

  it('says what is wrong with a table: its shape, its size and cells too long to read', () => {
    const table = (extra) => pictureProblems({ type: 'table', rows: [['High Street', '9:05'], ['Station', '9:20']], ...extra });
    assert.deepEqual(table({}), []);
    assert.deepEqual(table({ rows: [['High Street', '9:05'], ['Station']] }), ['picture.rows must be 1 to 5 rows, each a list of 2 to 4 short cells of text, such as [["High Street", "9:05"], ["Station", "9:20"]]'], 'a row of one cell is not a table');
    assert.deepEqual(table({ rows: [['High Street', '9:05', '9:35'], ['Station', '9:20']] }), ['picture.rows must all have the same number of cells']);
    assert.deepEqual(table({ columns: ['Stop', 'First', 'Second'] }), ['picture.columns has 3 headings for rows of 2 cells: give one for each column']);
    assert.match(table({ rows: Array.from({ length: 6 }, () => ['Stop', '9:05']) })[0], /^picture\.rows must be 1 to 5 rows/);
    assert.match(table({ rows: [['A', 'B', 'C', 'D', 'E']] })[0], /^picture\.rows must be 1 to 5 rows/);
    assert.match(table({ rows: [['A cell that goes on for far too long', '9:05']] })[0], /^picture\.rows must be 1 to 5 rows/, 'a cell is 24 letters at most');
    assert.match(table({ rows: [['Twenty letters long..', 'Twenty letters long..', 'Twenty letters long..']] })[0], /^picture: this table is too wide to read: the longest cell of each column comes to 63 letters, and 56 fit\./);
    assert.deepEqual(table({ rows: [['High Street', 905]] }).length, 1, 'a cell is text, not a number');
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

describe('people', () => {
  const colours = (picture) => {
    const g = fakeContext();
    createKit(g, {}).picture(picture, 30);
    return new Set(g.rects.map((r) => r.c));
  };

  it('are a woman, a man, a girl and a boy, and anyone at all', () => {
    assert.deepEqual(PERSON_ICONS, ['woman', 'man', 'girl', 'boy', 'baby']);
    for (const name of [...PERSON_ICONS, 'person', 'people', 'children']) assert.ok(name in ICONS, name);
    assert.ok(ICON_GROUPS['People and home'].includes('woman'));
    // person is nobody in particular: a plain outline, with no face, skin or hair to make them anyone
    assert.ok(ICONS.person.every((row) => /^[kt.]+$/.test(row)), 'person is an outline');
  });

  it('come in more than one colour: a group is never one skin', () => {
    const skins = Object.keys(SKINS).length;
    assert.equal(skins, 3);
    for (const letter of ['s', 'S', 'd']) assert.ok(letter in PALETTE, `${letter} is a skin letter`);
    for (const group of ['people', 'children']) {
      const used = new Set([...ICONS[group].join('')].filter((ch) => ['s', 'S', 'd'].includes(ch)));
      assert.ok(used.size >= 2, `${group} has two skins in it`);
    }
  });

  it('look as the reel says, when it says', () => {
    const laura = { icon: 'woman', label: 'Laura', skin: 'deep', hair: 'ginger' };
    assert.deepEqual(pictureProblems({ type: 'icons', items: [laura, { icon: 'man', skin: 'light' }] }), []);
    assert.deepEqual(pictureProblems({ type: 'compare', bad: { icon: 'boy', label: 'Sam', hair: 'grey' }, good: { ...laura } }), []);
    assert.deepEqual(personLook(laura), { s: SKINS.deep, n: HAIRS.ginger });
    const seen = colours({ type: 'icons', items: [laura] });
    assert.ok(seen.has(SKINS.deep) && seen.has(HAIRS.ginger), 'drawn in her skin and hair');
    assert.ok(!seen.has(PALETTE.s), 'and not in the light skin');
    assert.ok(colours({ type: 'compare', bad: { icon: 'car', label: 'Drive' }, good: laura }).has(SKINS.deep), 'on a compare card too');
  });

  it('take a look only where there is one person to give it to, and only a look there is', () => {
    for (const item of [{ icon: 'house', skin: 'deep' }, { icon: 'people', hair: 'black' }, { icon: 'woman', skin: 'green' }, { icon: 'man', hair: 'pink' }, { icon: 'girl', height: 'tall' }]) {
      assert.equal(pictureProblems({ type: 'icons', items: [item] }).length, 1, JSON.stringify(item));
    }
  });

  it('given no look, get one of their own: every skin and many hair colours, the same for the same person in every scene', () => {
    const names = ['Laura', 'Sam', 'Priya', 'Tom', 'Ada', 'Kwame', 'Mei', 'Olly', 'Jo', 'Ravi', 'Ellen', 'Chen', 'Nia', 'Ben', 'Zara', 'Luis'];
    const looks = names.map((label) => personLook({ icon: 'woman', label }));
    assert.equal(new Set(looks.map((l) => l.s)).size, 3, 'all three skins');
    assert.ok(new Set(looks.map((l) => l.n)).size >= 3, 'several hair colours');
    assert.deepEqual(personLook({ icon: 'woman', label: 'Laura' }), personLook({ icon: 'girl', label: ' LAURA ' }, 3), 'the same person, the same look');
    const places = [0, 1, 2, 3].map((i) => personLook({ icon: 'man' }, i).s);
    assert.ok(new Set(places).size >= 2, 'unlabelled people side by side differ');
    assert.equal(personLook({ icon: 'house', label: 'Home' }), null);
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
