import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MARGIN, staysAhead } from '../service/ahead.mjs';

// six lines of five seconds: the player spends 6.2 seconds on each (the line, and the pause after)
const reel = (ready) => Array.from({ length: 6 }, (_, i) => ({ seconds: 5, ready: i < ready }));

describe('starting a reel before its last line is recorded', () => {
  it('waits for the first line, whatever the pace', () => {
    assert.equal(staysAhead(reel(0), 0.1), false);
    assert.equal(staysAhead([], 0.5), false);
    assert.equal(staysAhead([{ seconds: 5, ready: false }, { seconds: 5, ready: true }], 0.5), false, 'a later line is no use without the first');
  });

  it('starts after one line when the recorder reads faster than the player plays', () => {
    // at 0.8 seconds a second of speech, with the margin, a line takes 5 seconds: each is ready before its scene comes
    assert.equal(staysAhead(reel(1), 0.8), true);
    assert.equal(staysAhead(reel(1), 0.99), true, 'just fast enough: 6.19 seconds a line against 6.2');
    assert.equal(staysAhead(reel(1), 1), false, 'a hair too slow, with the margin');
    assert.equal(MARGIN, 1.25);
  });

  it('waits for more lines the slower the recorder is', () => {
    const needs = (pace) => [1, 2, 3, 4, 5, 6].find((ready) => staysAhead(reel(ready), pace));
    assert.deepEqual([0.5, 1, 1.2, 1.5, 3, 6].map(needs), [1, 2, 2, 3, 5, 6], 'at six times as long as the speech, nothing short of all of it will do');
    assert.equal(staysAhead(reel(6), 99), true, 'with every line recorded there is nothing to wait for');
  });

  it('counts the time already spent on the line in hand, and trusts nothing from a recorder that is overdue', () => {
    assert.equal(staysAhead(reel(1), 1), false);
    assert.equal(staysAhead(reel(1), 1, { spent: 1 }), true, 'a second into the line, it will be ready in time');
    assert.equal(staysAhead(reel(1), 0.8, { spent: 4.9 }), true);
    assert.equal(staysAhead(reel(1), 0.8, { spent: 5.1 }), false, 'the line should have been done: the pace it was judged by is not holding');
  });

  it('promises nothing with no pace to go by', () => {
    for (const pace of [NaN, 0, -1, Infinity, undefined]) assert.equal(staysAhead(reel(2), pace), false, String(pace));
  });

  it('takes a short scene to last as long as the player holds one', () => {
    // one second lines still give the recorder 5.2 seconds a scene
    const short = Array.from({ length: 4 }, (_, i) => ({ seconds: 1, ready: i < 1 }));
    assert.equal(staysAhead(short, 4), true);
    assert.equal(staysAhead(short, 4.2), false);
  });
});
