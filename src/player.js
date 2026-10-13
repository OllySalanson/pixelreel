// The player's state and timing: which scene is showing, whether it is playing, and
// when to move on. It knows nothing about the page; a narrator does the talking and
// main.js draws. That keeps every timing rule testable without a browser.
import { GAP_MS } from './timing.js';

/**
 * @typedef {object} Narrator
 * @property {(index: number, opts: { muted: boolean }, done: () => void) => (() => void)} speak
 *   Narrates scene `index`, calls `done` once when it has finished, and returns a function
 *   that stops it early. With `muted`, it should stay quiet but still take as long.
 */

export class Player {
  /**
   * @param {object} o
   * @param {number} o.count            how many scenes
   * @param {Narrator} o.narrator
   * @param {(state: object) => void} [o.onChange]  called after every change
   * @param {{ set: Function, clear: Function }} [o.timer]  setTimeout and clearTimeout
   * @param {number} [o.gapMs]          pause between scenes
   */
  constructor({ count, narrator, onChange = () => {}, timer, gapMs = GAP_MS }) {
    if (!(count > 0)) throw new Error('a player needs at least one scene');
    this.count = count;
    this.narrator = narrator;
    this.onChange = onChange;
    this.timer = timer ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
    this.gapMs = gapMs;
    this.index = 0;
    this.playing = false;
    this.muted = false;
    this.ended = false;
    this._stop = null;
    this._gap = null;
    this._turn = 0;
  }

  get state() {
    return { index: this.index, playing: this.playing, muted: this.muted, ended: this.ended, count: this.count };
  }

  play() {
    if (this.playing) return;
    if (this.ended) this.index = 0;
    this.ended = false;
    this.playing = true;
    this._narrate();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this._silence();
    this._changed();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  /** Shows scene `i` (clamped to the reel), narrating it if playing. */
  goTo(i) {
    this.index = Math.max(0, Math.min(this.count - 1, Math.trunc(i) || 0));
    this.ended = false;
    this._narrate();
  }

  next() { this.goTo(this.index + 1); }
  back() { this.goTo(this.index - 1); }

  setMuted(muted) {
    this.muted = Boolean(muted);
    // restart the scene's narration so the change is heard (or silenced) at once
    this._narrate();
  }

  toggleMuted() { this.setMuted(!this.muted); }

  _silence() {
    this._turn++;
    if (this._stop) { this._stop(); this._stop = null; }
    if (this._gap !== null) { this.timer.clear(this._gap); this._gap = null; }
  }

  _narrate() {
    this._silence();
    this._changed();
    if (!this.playing) return;
    const turn = this._turn;
    let finished = false;
    const stop = this.narrator.speak(this.index, { muted: this.muted }, () => {
      if (finished || turn !== this._turn || !this.playing) return;   // stale: the scene changed since
      finished = true;
      this._stop = null;
      this._gap = this.timer.set(() => { this._gap = null; if (turn === this._turn) this._advance(); }, this.gapMs);
    });
    if (!finished && turn === this._turn) this._stop = stop;
  }

  _advance() {
    if (this.index < this.count - 1) { this.index++; this._narrate(); return; }
    this.playing = false;
    this.ended = true;
    this._silence();
    this._changed();
  }

  _changed() { this.onChange(this.state); }
}
