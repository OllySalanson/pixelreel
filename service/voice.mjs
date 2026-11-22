// Keeps the narrator ready. Recording a reel the usual way starts Python and loads the voice
// model afresh each time, which takes longer than speaking several lines: a third of the
// wait for a short reel was spent before a word was said. The service instead starts one
// Python when it wakes (scripts/pocket_speak.py --serve), which loads the model once and
// then speaks each reel's lines as they come. If it cannot start, or stops, recording falls
// back to the usual way, so a reel is never lost to it.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, ENGINES, findPython, speak as speakOnce } from '../scripts/voices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** An error from what was done with a finished line (encoding it, say), not from the speaking: the usual way would fail the same. */
class AfterSpeaking extends Error {}

export class WarmVoice {
  /**
   * @param {object} [o]
   * @param {string[]} [o.command]   the program that speaks, and its arguments before --serve
   * @param {string} [o.voice]       the voice to have loaded
   * @param {number} [o.threads]     how many processor threads it may use
   * @param {number} [o.patience]    how long to wait for the next line, in ms, before giving it up as stuck
   * @param {Function} [o.once]      speaks the usual way (scripts/voices.mjs), for when this cannot
   * @param {object} [o.env]         the environment the program runs in
   * @param {(line: string) => void} [o.log]
   */
  constructor({ command = [findPython(), join(ROOT, 'scripts', 'pocket_speak.py')], voice = ENGINES.pocket.voice,
    threads = Number(process.env.THREADS) || DEFAULTS.threads, patience = 180_000, once = speakOnce, env = process.env, log = () => {} } = {}) {
    Object.assign(this, { command, voice, threads, patience, once, env, log });
    this.jobs = 0;
    this.child = null;
    this.loading = null;   // resolves true once the voice is loaded, false if it could not be
    this.job = null;       // the lines being spoken: { id, on(message), fail(err) }
  }

  /** Starts loading the voice, if it is not loaded or loading. Resolves true once it is ready, false if it cannot be. */
  start() {
    this.loading ??= new Promise((ok) => {
      const began = Date.now();
      const child = spawn(this.command[0], [...this.command.slice(1), '--serve', '--voice', this.voice, '--threads', String(this.threads)], { stdio: ['pipe', 'pipe', 'inherit'], env: this.env });
      this.child = child;
      const gone = (why) => {
        if (this.child !== child) return;
        this.child = null;
        this.loading = null;   // the next reel tries again
        this.log(`voice: ${why}`);
        ok(false);
        const job = this.job;
        this.job = null;
        job?.fail(new Error(why));
      };
      child.on('error', (err) => gone(`could not start (${err.message})`));
      child.on('close', (code) => gone(`stopped${code === null ? '' : ` with exit code ${code}`}`));
      child.stdin.on('error', () => {});   // a write to one that has just stopped: its close says so
      createInterface({ input: child.stdout }).on('line', (line) => {
        let message;
        try { message = JSON.parse(line); } catch { return; }
        if (message.ready) {
          this.log(`voice: ${this.voice} is loaded and ready, after ${((Date.now() - began) / 1000).toFixed(1)} seconds`);
          ok(true);
        } else {
          this.job?.on(message);
        }
      });
    });
    return this.loading;
  }

  /**
   * Speaks `lines` ([{ text, wav }]), calling onDone(wav, seconds) as each is written: what
   * scripts/voices.mjs asks of a speaker. Lines the loaded voice does not get to are spoken
   * the usual way.
   */
  async speak(lines, settings, threads, onDone) {
    if (settings.engine !== 'pocket') { await this.once(lines, settings, threads, onDone); return; }
    const left = new Map(lines.map((line) => [line.wav, line]));
    if (await this.start()) {
      try {
        await this.ask({ voice: settings.voice, lines }, (wav, seconds) => { left.delete(wav); onDone(wav, seconds); });
        return;
      } catch (err) {
        if (err instanceof AfterSpeaking) throw err.cause;
        this.log(`voice: the loaded voice could not finish (${err.message}); speaking ${left.size} line${left.size === 1 ? '' : 's'} the usual way`);
      }
    }
    if (left.size) await this.once([...left.values()], settings, threads, onDone);
  }

  /** Sends one job to the loaded voice. Resolves when it is done; rejects if it fails, stops, or goes quiet. */
  ask(job, onLine) {
    return new Promise((ok, fail) => {
      const child = this.child;
      if (!child) { fail(new Error('it has stopped')); return; }
      let quiet;
      const settle = (err) => {
        clearTimeout(quiet);
        if (this.job === mine) this.job = null;
        if (err) fail(err); else ok();
      };
      const wait = () => {
        clearTimeout(quiet);
        quiet = setTimeout(() => { child.kill(); }, this.patience);   // its close fails the job
      };
      const mine = {
        id: ++this.jobs,
        fail: settle,
        on: (message) => {
          if (message.id !== mine.id) return;   // the tail of a job that was given up on
          wait();
          if (message.wav) {
            try { onLine(message.wav, message.seconds); } catch (err) { settle(Object.assign(new AfterSpeaking(err.message), { cause: err })); }
          } else if (message.done) settle();
          else if (message.error) settle(new Error(message.error));
        }
      };
      this.job = mine;
      wait();
      child.stdin.write(`${JSON.stringify({ id: mine.id, ...job })}\n`);
    });
  }

  /** Lets the voice go. */
  stop() {
    const child = this.child;
    this.child = null;
    this.loading = null;
    child?.stdin.end();
    child?.kill();
  }
}
