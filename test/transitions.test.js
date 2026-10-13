import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRANSITIONS, transitionFrame, transitionMs } from '../src/transitions.js';
import { coverage } from './fake-canvas.js';

const full = { x: 0, y: 0, w: 320, h: 180 };
const inset = { x: 40, y: 30, w: 120, h: 70 };
const area = (box) => box.w * box.h;

describe('transitions', () => {
  it('every one but cut takes a moment', () => {
    for (const kind of TRANSITIONS) {
      if (kind === 'cut') assert.equal(transitionMs(kind), 0);
      else assert.ok(transitionMs(kind) >= 400 && transitionMs(kind) <= 1500, kind);
    }
    assert.equal(transitionMs('nonsense'), 0);
  });

  it('starts on the old picture and ends on the new one', () => {
    for (const kind of TRANSITIONS.filter((k) => k !== 'cut')) {
      for (const box of [full, inset]) {
        const first = transitionFrame(kind, 0, box), last = transitionFrame(kind, 1, box);
        assert.equal(coverage(first.old, box), area(box), `${kind} shows all of the old picture at the start`);
        assert.ok(!first.cover?.rects?.length && !(first.cover?.level > 0), `${kind} covers nothing at the start`);
        assert.equal(coverage(last.old, box), 0, `${kind} shows none of the old picture at the end`);
        assert.ok(!last.cover?.rects?.length && !(last.cover?.level > 0), `${kind} covers nothing at the end`);
        assert.deepEqual(last.newAt, [0, 0], `${kind} lands the new picture in place`);
      }
    }
  });

  it('a cut shows the new picture at once', () => {
    const f = transitionFrame('cut', 0, full);
    assert.deepEqual(f.old, []);
    assert.equal(f.cover, null);
  });

  it('gives way steadily, never jumping back', () => {
    for (const kind of ['dissolve', 'wipe', 'slide', 'blinds', 'star']) {
      let before = Infinity;
      for (let p = 0; p <= 1.0001; p += 0.05) {
        const now = coverage(transitionFrame(kind, p, full).old, full);
        assert.ok(now <= before, `${kind} at ${p.toFixed(2)}`);
        before = now;
      }
    }
  });

  it('keeps everything inside the box it was given', () => {
    for (const kind of TRANSITIONS) {
      for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const f = transitionFrame(kind, p, inset);
        for (const [x, y, w, h] of [...f.old, ...(f.cover?.rects ?? [])]) {
          assert.ok(x >= inset.x && y >= inset.y && x + w <= inset.x + inset.w && y + h <= inset.y + inset.h, `${kind} at ${p}: ${[x, y, w, h]}`);
          assert.ok(w > 0 && h > 0, `${kind} at ${p}: no empty rects`);
        }
      }
    }
  });

  it('closes the iris to black halfway, and fades through a solid colour', () => {
    const iris = transitionFrame('iris', 0.5, full);
    assert.equal(coverage(iris.cover.rects, full), area(full));
    assert.equal(transitionFrame('fade', 0.5, full).cover.level, 1);
    assert.equal(transitionFrame('flash', 0.5, full).cover.level, 1);
  });

  it('slides the new picture in from the right as the old one leaves', () => {
    const f = transitionFrame('slide', 0.5, full);
    assert.equal(f.newAt[0] + -f.oldAt[0], 320);
    assert.ok(f.newAt[0] > 0 && f.oldAt[0] < 0);
  });

  it('clamps progress outside 0 to 1', () => {
    assert.deepEqual(transitionFrame('wipe', -2, full), transitionFrame('wipe', 0, full));
    assert.deepEqual(transitionFrame('wipe', 7, full), transitionFrame('wipe', 1, full));
  });
});
