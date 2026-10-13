import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { highlight, noSignal, PICTURES, pictureProblems } from '../src/pictures.js';
import { coverage, fakeContext } from './fake-canvas.js';

const examples = {
  title: { type: 'title', text: 'PIXELREEL', sub: 'Narrated pixel-art videos from a list of scenes' },
  list: { type: 'list', heading: 'WHERE IT HELPS', items: ['Onboarding', 'Release notes', 'Pull requests'], numbered: true, every: 1, start: 0.2 },
  terminal: { type: 'terminal', title: 'bash', lines: ['$ npm run new my-reel', 'Made reels/my-reel/reel.js', '$ npm run voices my-reel'] },
  code: { type: 'code', title: 'reel.js', lines: ['export default {', "  title: 'Tea', // hot", '  scenes: []', '};'] },
  chat: { type: 'chat', title: 'Launch', messages: [{ from: 'Boss', text: 'Status?' }, { from: 'You', text: 'Made you a cartoon.' }, { from: 'Boss', text: 'Lovely.' }] },
  big: { type: 'big', text: '2 MIN', sub: 'to make your first reel' },
  image: { type: 'image', name: 'garden' }
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
    assert.match(pictureProblems({ type: 'movie' })[0], /^picture.type must be one of: title, list, terminal, code, chat, big, image$/);
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
