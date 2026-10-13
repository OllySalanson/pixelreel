// The player's state and timing: which scene is showing, whether it is playing, how far
// into the scene it is, and when to move on. It knows nothing about the page; a narrator
// does the talking and main.js draws. That keeps every timing rule testable without a browser.
import { GAP_MS, locate, timeline } from './timing.js';

/**
 * @typedef {object} Narrator
 * @property {(index: number, opts: { muted: boolean, from: number }, done: () => void) => ({ stop: () => void, from: number } | (() => void))} speak
 *   Narrates scene `index` starting `from` ms in, calls `done` once when it has finished, and
 *   returns how to stop it early and where it really started: a voice that can only say a
 *   line from the top reports from: 0. With `muted`, it should stay quiet but take as long.
 */

export class Player {
  /**
   * @param {object} o
   * @param {number} o.count            how many scenes
   * @param {Narrator} o.narrator
   * @param {(state: object) => void} [o.onChange]  called after every change
   * @param {{ set: Function, clear: Function }} [o.timer]  setTimeout and clearTimeout
   * @param {number} [o.gapMs]          pause between scenes
   * @param {number[]} [o.durations]    how long each scene's narration lasts, in ms: for seeking
   * @param {() => number} [o.now]      a clock in milliseconds
   */
  constructor({ count, narrator, onChange = () => {}, timer, gapMs = GAP_MS, durations = null, now }) {
    if (!(count > 0)) throw new Error('a player needs at least one scene');
    this.count = count;
    this.narrator = narrator;
    this.onChange = onChange;
    this.timer = timer ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
    this.gapMs = gapMs;
    this.durations = durations;
    this.timeline = timeline(durations ?? Array(count).fill(0), gapMs);
    this.now = now ?? (() => (globalThis.performance ?? Date).now());
    this.index = 0;
    this.playing = false;
    this.muted = false;
    this.ended = false;
    this.started = false;
    this._base = 0;          // the clock time the current scene started, while it plays
    this._held = null;       // paused part of the way through: how far, in ms
    this._gapLeft = null;    // paused in the pause after the words: how much of it is left
    this._gapEnds = 0;
    this._stop = null;
    this._gap = null;
    this._turn = 0;
  }

  get state() {
    return { index: this.index, playing: this.playing, muted: this.muted, ended: this.ended, count: this.count, started: this.started };
  }

  /** How far into the current scene, in ms. It runs while playing (and on past the end) and holds while paused. */
  get elapsedMs() {
    if (this.playing || this.ended) return Math.max(0, this.now() - this._base);
    return this._held ?? 0;
  }

  /** True when paused part of the way through a scene: Play carries on from there. */
  get held() { return this._held !== null; }

  /** How far into the whole reel, in ms. */
  get positionMs() {
    return this.timeline.starts[this.index] + Math.min(this.timeline.spans[this.index], this.elapsedMs);
  }

  play() {
    if (this.playing) return;
    if (this.ended) { this.index = 0; this._held = null; this._gapLeft = null; }
    this.ended = false;
    this.playing = true;
    this.started = true;
    const from = this._held ?? 0, gapLeft = this._gapLeft;
    this._held = null;
    this._gapLeft = null;
    if (gapLeft !== null) this._rest(from, gapLeft);
    else this._narrate(from);
  }

  pause() {
    if (!this.playing) return;
    const held = this.elapsedMs;
    const gapLeft = this._gap !== null ? Math.max(0, this._gapEnds - this.now()) : null;
    this.playing = false;
    this._silence();
    this._held = held;
    this._gapLeft = gapLeft;
    this._changed();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  /** Shows scene `i` (clamped to the reel), `from` ms in. Narrates it if playing; otherwise holds there. */
  goTo(i, from = 0) {
    this.index = Math.max(0, Math.min(this.count - 1, Math.trunc(i) || 0));
    this.ended = false;
    this._gapLeft = null;
    from = Math.max(0, Number(from) || 0);
    if (!this.playing) {
      this._silence();
      this._held = from > 0 ? from : null;
      this._changed();
      return;
    }
    this._held = null;
    this._narrate(from);
  }

  next() { this.goTo(this.index + 1); }
  back() { this.goTo(this.index - 1); }

  /** Jumps to `ms` into the whole reel. */
  seek(ms) {
    const { index, offset } = locate(this.timeline, ms);
    this.goTo(index, offset);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    // carry on from the same moment, so the change is heard (or silenced) at once
    if (this.playing && this._gap === null) this._narrate(this.elapsedMs);
    else this._changed();
  }

  toggleMuted() { this.setMuted(!this.muted); }

  _silence() {
    this._turn++;
    if (this._stop) { this._stop(); this._stop = null; }
    if (this._gap !== null) { this.timer.clear(this._gap); this._gap = null; }
  }

  /** Narrates the current scene from `from` ms in; when the words end, rests, then moves on. */
  _narrate(from) {
    this._silence();
    const words = this.durations?.[this.index];
    if (words != null && from >= words) { this._rest(from, words + this.gapMs - from); return; }
    this._base = this.now() - from;
    this._changed();
    const turn = this._turn;
    let finished = false;
    const said = this.narrator.speak(this.index, { muted: this.muted, from }, () => {
      if (finished || turn !== this._turn || !this.playing) return;   // stale: the scene changed since
      finished = true;
      this._stop = null;
      this._wait(this.gapMs, turn);
    });
    const stop = typeof said === 'function' ? said : said?.stop;
    // a voice that can only say a line from the top starts the scene's clock again with it
    if (Number.isFinite(said?.from) && said.from !== from) this._base = this.now() - said.from;
    if (!finished && turn === this._turn) this._stop = stop ?? null;
  }

  /** The pause after a scene's words, `from` ms into the scene: waits `ms`, then moves on. */
  _rest(from, ms) {
    this._silence();
    this._base = this.now() - from;
    this._changed();
    this._wait(Math.max(0, ms), this._turn);
  }

  _wait(ms, turn) {
    this._gapEnds = this.now() + ms;
    this._gap = this.timer.set(() => { this._gap = null; if (turn === this._turn) this._advance(); }, ms);
  }

  _advance() {
    if (this.index < this.count - 1) { this.index++; this._narrate(0); return; }
    this.playing = false;
    this.ended = true;
    this._silence();
    this._changed();
  }

  _changed() { this.onChange(this.state); }
}
