// Writes down what is said into My notes' microphone, for browsers whose own speech
// recognition does not work (Brave has the name with nothing behind it; Firefox has none).
// The page records the microphone and sends it a few seconds at a time (site/js/hearing.js);
// this hands each piece to one Python with a Whisper model loaded (scripts/hear.py --serve),
// started the first time someone speaks, and stopped again after a while unused, to give its
// memory back. Nothing said is kept, or sent to another company.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { findPython } from '../scripts/voices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Samples a second, of what the page sends: mono, 16-bit. */
export const HEAR_RATE = 16_000;

/** The longest piece the page may send, in seconds: it cuts what is said at a pause well before this. */
export const HEAR_MOST_SECONDS = 12;

/** The most bytes in one piece. */
export const HEAR_MAX_BYTES = HEAR_RATE * 2 * HEAR_MOST_SECONDS;

/** It cannot write down what is said just now: the page says so, and the note can be typed. */
export class HearError extends Error {}

export class Hearing {
  /**
   * @param {object} [o]
   * @param {string[]} [o.command]   the program that hears, and its arguments before --serve
   * @param {string} [o.model]       the Whisper model to load
   * @param {number} [o.threads]     how many processor threads it may use
   * @param {number} [o.waiting]     how many pieces may wait their turn before more are turned away
   * @param {number} [o.idle]        how long unused, in ms, before it is stopped to give its memory back
   * @param {number} [o.patience]    how long one piece may take, in ms, before it is given up as stuck
   * @param {(line: string) => void} [o.log]
   */
  constructor({ command = [findPython(), join(ROOT, 'scripts', 'hear.py')], model = 'base.en', threads = 2, waiting = 6, idle = 15 * 60_000, patience = 30_000, env = process.env, log = () => {} } = {}) {
    Object.assign(this, { command, model, threads, waiting, idle, patience, env, log });
    this.child = null;
    this.ready = null;   // resolves once the model is loaded; rejects if it cannot be
    this.asked = new Map();   // id: { ok, fail, timer }
    this.queue = Promise.resolve();
    this.queued = 0;
    this.next = 0;
    this.sleep = null;
  }

  /** Starts the Python that hears, if it is not running. Resolves once its model is loaded. */
  start() {
    this.ready ??= new Promise((ok, fail) => {
      const began = Date.now();
      const child = spawn(this.command[0], [...this.command.slice(1), '--serve', '--model', this.model, '--threads', String(this.threads)], { stdio: ['pipe', 'pipe', 'inherit'], env: this.env });
      this.child = child;
      const gone = (why) => {
        if (this.child !== child) return;
        this.child = null;
        this.ready = null;   // the next piece tries again
        this.log(`hear: ${why}`);
        fail(new HearError(why));
        for (const [, waiting] of this.asked) { clearTimeout(waiting.timer); waiting.fail(new HearError(why)); }
        this.asked.clear();
      };
      child.on('error', (err) => gone(`could not start (${err.message})`));
      child.on('close', (code) => gone(`stopped${code === null ? '' : ` with exit code ${code}`}`));
      child.stdin.on('error', () => {});
      createInterface({ input: child.stdout }).on('line', (line) => {
        let said;
        try { said = JSON.parse(line); } catch { return; }
        if (said.ready) { this.log(`hear: ${this.model} loaded in ${((Date.now() - began) / 1000).toFixed(1)}s`); ok(); return; }
        const waiting = this.asked.get(said.id);
        if (!waiting) return;
        this.asked.delete(said.id);
        clearTimeout(waiting.timer);
        if (typeof said.text === 'string') waiting.ok(said.text);
        else waiting.fail(new HearError(said.error ?? 'nothing heard'));
      });
    });
    return this.ready;
  }

  /** Stops the Python that hears, if it is running. */
  stop() {
    clearTimeout(this.sleep);
    const child = this.child;
    if (!child) return;
    this.child = null;
    this.ready = null;
    child.kill();
  }

  /**
   * What was said in `pcm` (mono 16-bit samples at HEAR_RATE), as words. One piece is heard
   * at a time; throws a HearError if too many are waiting, or it cannot be heard.
   */
  hear(pcm) {
    if (this.queued >= this.waiting) return Promise.reject(new HearError('busy'));
    this.queued++;
    const turn = this.queue.then(() => this.once(pcm));
    this.queue = turn.catch(() => {}).finally(() => { this.queued--; });
    return turn;
  }

  async once(pcm) {
    clearTimeout(this.sleep);
    await this.start();
    const id = ++this.next;
    const heard = new Promise((ok, fail) => {
      const timer = setTimeout(() => {
        this.asked.delete(id);
        fail(new HearError('took too long'));
        this.log('hear: a piece took too long, so it was stopped');
        this.stop();
      }, this.patience);
      this.asked.set(id, { ok, fail, timer });
    });
    this.child.stdin.write(`${JSON.stringify({ id, pcm: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64') })}\n`);
    try {
      return await heard;
    } finally {
      clearTimeout(this.sleep);
      this.sleep = setTimeout(() => this.stop(), this.idle);
      this.sleep.unref?.();
    }
  }
}
