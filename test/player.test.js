import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Player } from '../src/player.js';
import { GAP_MS } from '../src/timing.js';

// A narrator that "speaks" each scene for a fixed time, using the mocked timers, and can
// start part of the way in (or, with fromTop, only ever from the top, like the browser voice).
function fakeNarrator(ms = 5000, { fromTop = false } = {}) {
  const calls = [];
  return {
    calls,
    speak(index, { muted, from = 0 }, done) {
      const start = fromTop ? 0 : from;
      const call = { index, muted, from, stopped: false };
      calls.push(call);
      const id = setTimeout(done, Math.max(0, ms - start));
      return { stop: () => { call.stopped = true; clearTimeout(id); }, from: start };
    }
  };
}

const clock = () => Date.now();
// mock.timers counts a timer set inside a callback from the end of the current tick, so
// each test ticks to one timer at a time.

describe('Player timing', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
  afterEach(() => mock.timers.reset());

  it('starts paused on the first scene and narrates nothing', () => {
    const n = fakeNarrator();
    const p = new Player({ count: 3, narrator: n });
    assert.deepEqual(p.state, { index: 0, playing: false, muted: false, ended: false, count: 3, started: false });
    assert.equal(n.calls.length, 0);
  });

  it('moves on one gap after the narration ends, and stops at the end', () => {
    const n = fakeNarrator(5000);
    const changes = [];
    const p = new Player({ count: 3, narrator: n, onChange: (s) => changes.push(s) });
    p.play();
    assert.equal(p.index, 0);
    mock.timers.tick(5000);
    assert.equal(p.index, 0, 'waits for the gap before the next scene');
    mock.timers.tick(GAP_MS - 1);
    assert.equal(p.index, 0);
    mock.timers.tick(1);
    assert.equal(p.index, 1);
    mock.timers.tick(5000); mock.timers.tick(GAP_MS);
    assert.equal(p.index, 2);
    mock.timers.tick(5000); mock.timers.tick(GAP_MS);
    assert.equal(p.index, 2, 'stays on the last scene');
    assert.equal(p.playing, false);
    assert.equal(p.ended, true);
    assert.deepEqual(n.calls.map((c) => c.index), [0, 1, 2]);
    assert.equal(changes.at(-1).ended, true);
  });

  it('Play again starts over from the first scene', () => {
    const n = fakeNarrator(1000);
    const p = new Player({ count: 2, narrator: n });
    p.play();
    for (let i = 0; i < 2; i++) { mock.timers.tick(1000); mock.timers.tick(GAP_MS); }
    assert.equal(p.ended, true);
    p.play();
    assert.equal(p.index, 0);
    assert.equal(p.playing, true);
    assert.equal(p.ended, false);
  });

  it('pause stops the narration and holds the moment; Play carries on from it', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 3, narrator: n, now: clock });
    p.play();
    mock.timers.tick(2000);
    p.pause();
    assert.equal(n.calls[0].stopped, true);
    assert.equal(p.held, true);
    assert.equal(p.elapsedMs, 2000);
    mock.timers.tick(60000);
    assert.equal(p.index, 0);
    assert.equal(p.elapsedMs, 2000, 'the clock holds while paused');
    p.play();
    assert.equal(n.calls.length, 2);
    assert.deepEqual([n.calls[1].index, n.calls[1].from], [0, 2000], 'resumes where it stopped');
    mock.timers.tick(1000);
    assert.equal(p.elapsedMs, 3000);
    mock.timers.tick(2000);
    mock.timers.tick(GAP_MS);
    assert.equal(p.index, 1, 'and only the rest of the scene is left to play');
  });

  it('a voice that can only start a line from the top starts the scene clock again too', () => {
    const n = fakeNarrator(5000, { fromTop: true });
    const p = new Player({ count: 2, narrator: n, now: clock });
    p.play();
    mock.timers.tick(3000);
    p.pause();
    p.play();
    assert.equal(n.calls[1].from, 3000, 'asked to carry on');
    assert.equal(p.elapsedMs, 0, 'but the picture follows the voice back to the start');
  });

  it('pausing in the pause after the words waits out only what is left of it', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 2, narrator: n, now: clock, durations: [5000, 5000] });
    p.play();
    mock.timers.tick(5000);
    mock.timers.tick(400);
    p.pause();
    mock.timers.tick(30000);
    p.play();
    assert.equal(n.calls.length, 1, 'the words are not said again');
    mock.timers.tick(GAP_MS - 400 - 1);
    assert.equal(p.index, 0);
    mock.timers.tick(1);
    assert.equal(p.index, 1);
  });

  it('pause during the gap cancels the move to the next scene', () => {
    const n = fakeNarrator(1000);
    const p = new Player({ count: 3, narrator: n });
    p.play();
    mock.timers.tick(1000 + GAP_MS / 2);
    p.pause();
    mock.timers.tick(GAP_MS * 5);
    assert.equal(p.index, 0);
  });

  it('Next and Back clamp to the reel and restart the narration', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 3, narrator: n });
    p.back();
    assert.equal(p.index, 0);
    p.play();
    p.next();
    assert.equal(p.index, 1);
    assert.equal(n.calls[0].stopped, true, 'the old scene stops talking');
    p.next(); p.next(); p.next();
    assert.equal(p.index, 2);
    p.goTo(-5);
    assert.equal(p.index, 0);
    p.goTo(1.7);
    assert.equal(p.index, 1);
  });

  it('a stale done from a skipped scene does not skip the new one', () => {
    const dones = [];
    const narrator = { speak: (_i, _o, done) => { dones.push(done); return () => {}; } };
    const p = new Player({ count: 4, narrator });
    p.play();
    p.next();            // now on scene 1; scene 0's narration is stale
    dones[0]();          // the old clip reports it ended (a narrator that ignores cancel)
    mock.timers.tick(GAP_MS * 2);
    assert.equal(p.index, 1);
    dones[1]();
    mock.timers.tick(GAP_MS);
    assert.equal(p.index, 2);
  });

  it('a narrator that finishes at once still waits for the gap', () => {
    const narrator = { speak: (_i, _o, done) => { done(); done(); return () => {}; } };
    const p = new Player({ count: 3, narrator });
    p.play();
    assert.equal(p.index, 0);
    mock.timers.tick(GAP_MS);
    assert.equal(p.index, 1, 'calling done twice moves on only once');
    mock.timers.tick(GAP_MS);
    assert.equal(p.index, 2);
  });

  it('muting carries on quietly from the same moment', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 2, narrator: n, now: clock });
    p.play();
    mock.timers.tick(1500);
    p.toggleMuted();
    assert.equal(p.muted, true);
    assert.deepEqual(n.calls.map((c) => [c.index, c.muted, c.from, c.stopped]), [[0, false, 0, true], [0, true, 1500, false]]);
    mock.timers.tick(3500);
    mock.timers.tick(GAP_MS);
    assert.equal(p.index, 1, 'the scene still ends on time');
  });

  it('muting in the pause after the words just waits on', () => {
    const n = fakeNarrator(1000);
    const p = new Player({ count: 2, narrator: n, now: clock });
    p.play();
    mock.timers.tick(1000);
    mock.timers.tick(200);
    p.toggleMuted();
    assert.equal(n.calls.length, 1);
    mock.timers.tick(GAP_MS - 200);
    assert.equal(p.index, 1);
    assert.equal(n.calls[1].muted, true);
  });

  it('marks the reel started from the first Play', () => {
    const p = new Player({ count: 2, narrator: fakeNarrator() });
    p.next();
    assert.equal(p.started, false);
    p.play();
    assert.equal(p.started, true);
    p.pause();
    assert.equal(p.state.started, true);
  });

  it('moving while paused shows the scene fresh, or held at a moment', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 3, narrator: n, now: clock });
    p.goTo(1);
    assert.equal(p.held, false);
    assert.equal(p.elapsedMs, 0);
    p.goTo(2, 1500);
    assert.equal(p.held, true);
    assert.equal(p.elapsedMs, 1500);
    p.play();
    assert.deepEqual([n.calls[0].index, n.calls[0].from], [2, 1500]);
  });

  it('lays the scenes on a timeline and seeks to any moment', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 3, narrator: n, now: clock, durations: [5000, 3000, 4000] });
    assert.deepEqual(p.timeline.starts, [0, 5000 + GAP_MS, 8000 + 2 * GAP_MS]);
    assert.equal(p.timeline.total, 12000 + 3 * GAP_MS);
    p.seek(5000 + GAP_MS + 800);
    assert.equal(p.index, 1);
    assert.equal(p.elapsedMs, 800);
    assert.equal(p.positionMs, 5000 + GAP_MS + 800);
    p.play();
    assert.deepEqual([n.calls[0].index, n.calls[0].from], [1, 800]);
    p.seek(-50);
    assert.equal(p.index, 0);
    assert.equal(n.calls.at(-1).from, 0);
  });

  it('seeking into the pause after a scene\'s words rests there, then moves on', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 2, narrator: n, now: clock, durations: [5000, 5000] });
    p.play();
    p.seek(5500);
    assert.equal(n.calls.length, 1, 'nothing more is said for scene 1');
    mock.timers.tick(GAP_MS - 500 - 1);
    assert.equal(p.index, 0);
    mock.timers.tick(1);
    assert.equal(p.index, 1);
  });

  it('keeps the picture clock running after the end', () => {
    const n = fakeNarrator(1000);
    const p = new Player({ count: 1, narrator: n, now: clock, durations: [1000] });
    p.play();
    mock.timers.tick(1000);
    mock.timers.tick(GAP_MS);
    assert.equal(p.ended, true);
    mock.timers.tick(500);
    assert.equal(p.elapsedMs, 1000 + GAP_MS + 500);
    assert.equal(p.positionMs, p.timeline.total, 'but the position stops at the end');
  });

  it('needs at least one scene', () => {
    assert.throws(() => new Player({ count: 0, narrator: fakeNarrator() }), /at least one scene/);
  });
});
