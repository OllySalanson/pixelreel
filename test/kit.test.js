import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createKit, EASE, H, rand, W } from '../src/kit.js';
import { coverage, fakeContext } from './fake-canvas.js';

const kit = () => { const g = fakeContext(); return { g, px: createKit(g) }; };

describe('the pixel kit: motion', () => {
  it('eases every curve from 0 to 1', () => {
    for (const [name, f] of Object.entries(EASE)) {
      assert.ok(Math.abs(f(0)) < 1e-9, `${name}(0)`);
      assert.ok(Math.abs(f(1) - 1) < 1e-9, `${name}(1)`);
    }
    assert.ok(EASE.out(0.5) > 0.5 && EASE.in(0.5) < 0.5);
    assert.ok([0.6, 0.7, 0.8, 0.9].some((k) => EASE.back(k) > 1), 'back overshoots');
  });

  it('tweens between two numbers over time', () => {
    const { px } = kit();
    assert.equal(px.tween(0, 1, 2, 10, 30), 10, 'before it starts');
    assert.equal(px.tween(9, 1, 2, 10, 30), 30, 'after it ends');
    assert.equal(px.tween(2, 1, 2, 10, 30, 'linear'), 20);
    assert.equal(px.tween(2, 1, 2, 0, 1, (k) => k * k), 0.25, 'a curve of your own');
    assert.equal(px.tween(1, 1, 0, 0, 5), 5, 'no duration jumps straight there');
  });

  it('has steady random numbers, frames, blinks and typing', () => {
    const { px } = kit();
    assert.equal(rand(7), rand(7));
    for (let i = 0; i < 200; i++) { const v = rand(i * 0.37); assert.ok(v >= 0 && v < 1); }
    assert.equal(px.frame(0.5, 4, ['a', 'b', 'c']), 'c');
    assert.equal(px.frame(-0.1, 10, ['a', 'b']), 'b', 'never runs off the list');
    assert.equal(px.blink(0, 2), true);
    assert.equal(px.blink(0.3, 2), false);
    assert.equal(px.typed('Hello', 1.2, 1, 10), 'He');
    assert.equal(px.typed('Hello', 0, 1), '');
    assert.equal(px.lerp(10, 20, 0.25), 12.5);
    assert.equal(px.clamp(5, 0, 3), 3);
  });

  it('types text out with a cursor, and says when it is done', () => {
    const { g, px } = kit();
    assert.equal(px.type('Hi there', 0, 0, 0.5, 12, '#fff', 1), false);
    assert.equal(g.texts.length, 0, 'nothing before it starts');
    assert.equal(px.type('Hi there', 0, 0, 1.2, 12, '#fff', 1, 10), false);
    assert.equal(g.texts.at(-1).str, 'Hi');
    assert.ok(g.rects.length > 0, 'a cursor while typing');
    assert.equal(px.type('Hi there', 0, 0, 9, 12, '#fff', 1, 10), true);
  });

  it('shakes, then settles', () => {
    const { px } = kit();
    assert.deepEqual(px.shake(0.9, 1), [0, 0]);
    assert.deepEqual(px.shake(1.6, 1, 0.5), [0, 0]);
    for (let t = 1; t < 1.5; t += 0.03) {
      const [dx, dy] = px.shake(t, 1, 0.5, 4);
      assert.ok(Math.abs(dx) <= 4 && Math.abs(dy) <= 4);
    }
  });
});

describe('the pixel kit: sprites', () => {
  it('draws palette letters, flipped if asked, with colours of its own ahead of the palette', () => {
    const { g, px } = kit();
    px.sprite(['k.', '.y'], 10, 20, 2);
    assert.deepEqual(g.rects.map((r) => [r.x, r.y, r.w, r.c]), [[10, 20, 2, '#1a1a1a'], [12, 22, 2, '#ffcc4d']]);
    g.rects.length = 0;
    px.sprite(['kh'], 0, 0, 1, true, { h: '#123456', k: '#abcdef' });
    assert.deepEqual(g.rects.map((r) => [r.x, r.c]), [[0, '#123456'], [1, '#abcdef']]);
  });
});

describe('the pixel kit: shapes and scenery', () => {
  it('draws filled circles and rings symmetrically', () => {
    const { g, px } = kit();
    px.circle('#f00', 50, 50, 0);
    assert.deepEqual(g.rects, [{ x: 50, y: 50, w: 1, h: 1, c: '#f00' }]);
    g.rects.length = 0;
    px.circle('#f00', 50, 50, 6);
    assert.equal(g.rects.length, 13);
    assert.ok(coverage(g.rects, { x: 0, y: 0, w: W, h: H }) > Math.PI * 25);
    g.rects.length = 0;
    px.ring('#f00', 50, 50, 6, 2);
    const ring = coverage(g.rects, { x: 0, y: 0, w: W, h: H });
    g.rects.length = 0;
    px.circle('#f00', 50, 50, 6);
    assert.ok(ring < coverage(g.rects, { x: 0, y: 0, w: W, h: H }), 'a ring has a hole');
  });

  it('draws lines end to end, and ignores nonsense', () => {
    const { g, px } = kit();
    px.line('#fff', 0, 0, 5, 3);
    assert.deepEqual([g.rects[0].x, g.rects[0].y], [0, 0]);
    assert.deepEqual([g.rects.at(-1).x, g.rects.at(-1).y], [5, 3]);
    assert.equal(g.rects.length, 6);
    px.line('#fff', 0, 0, NaN, 3);
    assert.equal(g.rects.length, 6);
  });

  it('rolls hills across every column, within their height, repeating every 320 pixels', () => {
    const { g, px } = kit();
    px.hills('#123', 140, 20, 0, 3);
    const first = g.rects.splice(0);
    assert.equal(first.reduce((s, r) => s + r.w, 0), W, 'each column once');
    for (const r of first) assert.ok(r.y >= 120 && r.y <= 140 && r.y + r.h === H);
    px.hills('#123', 140, 20, W, 3);
    assert.deepEqual(g.rects, first, 'scrolling a whole width comes back round');
  });

  it('repeats a parallax layer to fill the width as it scrolls', () => {
    const { px } = kit();
    const xs = [];
    px.parallax(1, 30, 100, (x) => xs.push(x));
    assert.deepEqual(xs, [-30, 70, 170, 270]);
    const back = [];
    px.parallax(1, -30, 100, (x) => back.push(x));
    assert.deepEqual(back, [-70, 30, 130, 230]);
  });

  it('dithers from clear to solid', () => {
    const { g, px } = kit();
    px.dither('#000', 0, 0, 8, 8, 0);
    assert.equal(g.rects.length, 0);
    px.dither('#000', 0, 0, 8, 8, 1);
    assert.equal(g.rects.length, 1);
    g.rects.length = 0;
    px.dither('#000', 0, 0, 8, 8, 0.5);
    assert.equal(coverage(g.rects, { x: 0, y: 0, w: 8, h: 8 }), 32);
  });

  it('throws confetti for about two seconds', () => {
    const { g, px } = kit();
    px.confetti(0.5, 1, 100, 100);
    assert.equal(g.rects.length, 0, 'not before it starts');
    px.confetti(1.4, 1, 100, 100, 30);
    assert.equal(g.rects.length, 30);
    g.rects.length = 0;
    px.confetti(4.5, 1, 100, 100);
    assert.equal(g.rects.length, 0, 'all gone after');
  });

  it('wraps text and sizes a speech bubble around it', () => {
    const { g, px } = kit();
    assert.deepEqual(px.wrap('one two three four', 42, 12), ['one two', 'three', 'four']);
    assert.deepEqual(px.wrap('a\nb', 400), ['a', 'b']);
    const box = px.bubble('one two three four', 10, 20, 12, 30, '#fff', '#000', 42);
    assert.deepEqual(box, { x: 10, y: 20, w: 52, h: 44 });
    assert.equal(g.texts.length, 3);
  });

  it('moves, magnifies and clips what a function draws, and always restores', () => {
    const { g, px } = kit();
    px.shift(2.4, -3.6, () => px.rect('#fff', 0, 0, 1, 1));
    assert.deepEqual(g.transforms[0], ['translate', 2, -4]);
    px.zoom(2, 10, 10, () => {});
    assert.deepEqual(g.transforms.slice(1), [['translate', 10, 10], ['scale', 2, 2], ['translate', -10, -10]]);
    px.clip([[0, 0, 5, 5], [10, 10, 5, 5]], () => {});
    assert.deepEqual(g.clips.at(-1), [[0, 0, 5, 5], [10, 10, 5, 5]]);
    assert.throws(() => px.shift(0, 0, () => { throw new Error('oops'); }), /oops/);
    assert.equal(g.depth, 0);
  });

  it('runs a transition: the new picture, the old one over it, then any cover', () => {
    const { g, px } = kit();
    const calls = [];
    px.transition('iris', 0.2, () => calls.push('old'), () => calls.push('new'));
    assert.deepEqual(calls, ['new', 'old']);
    calls.length = 0;
    px.transition('cut', 0.2, () => calls.push('old'), () => calls.push('new'));
    assert.deepEqual(calls, ['new']);
    g.rects.length = 0;
    px.transition('iris', 0.5, () => {}, () => {});
    assert.equal(coverage(g.rects, { x: 0, y: 0, w: W, h: H }), W * H, 'the iris shuts to black halfway');
  });

  it('draws a ready-made picture', () => {
    const { g, px } = kit();
    px.picture({ type: 'big', text: 'HELLO' }, 2);
    assert.ok(g.texts.some((x) => x.str === 'HELLO'));
    assert.throws(() => px.picture({ type: 'nope' }, 0), /no ready-made picture called "nope"/);
  });
});
