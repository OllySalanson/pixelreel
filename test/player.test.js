import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Player } from '../src/player.js';
import { GAP_MS } from '../src/timing.js';

// A narrator that "speaks" each scene for a fixed time, using the mocked timers.
function fakeNarrator(ms = 5000) {
  const calls = [];
  return {
    calls,
    speak(index, { muted }, done) {
      const call = { index, muted, stopped: false };
      calls.push(call);
      const id = setTimeout(done, ms);
      return () => { call.stopped = true; clearTimeout(id); };
    }
  };
}

describe('Player timing', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('starts paused on the first scene and narrates nothing', () => {
    const n = fakeNarrator();
    const p = new Player({ count: 3, narrator: n });
    assert.deepEqual(p.state, { index: 0, playing: false, muted: false, ended: false, count: 3 });
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

  it('pause stops the narration and holds the scene', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 3, narrator: n });
    p.play();
    mock.timers.tick(2000);
    p.pause();
    assert.equal(n.calls[0].stopped, true);
    mock.timers.tick(60000);
    assert.equal(p.index, 0);
    p.play();
    assert.equal(n.calls.length, 2, 'resuming narrates the scene again');
    assert.equal(n.calls[1].index, 0);
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

  it('muting restarts the scene quietly and passes muted to the narrator', () => {
    const n = fakeNarrator(5000);
    const p = new Player({ count: 2, narrator: n });
    p.play();
    p.toggleMuted();
    assert.equal(p.muted, true);
    assert.deepEqual(n.calls.map((c) => [c.index, c.muted, c.stopped]), [[0, false, true], [0, true, false]]);
  });

  it('needs at least one scene', () => {
    assert.throws(() => new Player({ count: 0, narrator: fakeNarrator() }), /at least one scene/);
  });
});
