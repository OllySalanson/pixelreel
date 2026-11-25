// My notes' microphone, where the browser's own speech recognition does not work (Brave has
// the name with nothing behind it; Firefox has none): the page records what is said and sends
// it to the service a few seconds at a time (POST /hear, service/hear.mjs), which writes it
// down. The words so far are shown as they come back, and put right as more is heard. Only
// the Listener and downsample() are needed by Node, which tests them; the rest runs in a page.

/** Samples a second the service takes: mono, 16-bit. */
export const RATE = 16_000;

/** Longer than this, in seconds, and what is said is cut at a pause, and that much written down for good. */
export const CUT_AFTER = 7;

/** How far back from the end a cut may be, in seconds: it is made at the quietest moment in that stretch. */
export const CUT_WITHIN = 3;

/** Under this, in seconds, there is nothing yet worth sending. */
const LEAST = 0.4;

/** Quieter than this everywhere (of 32,767), and nothing was said. */
const HUSH = 400;

/** `samples` (floats from -1 to 1) at `from` a second, as 16-bit samples at RATE: each new sample the mean of the old ones it stands for. */
export function downsample(samples, from) {
  const step = from / RATE, out = new Int16Array(Math.floor(samples.length / step));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
    let sum = 0;
    for (let j = a; j < b; j++) sum += samples[j];
    out[i] = Math.max(-32768, Math.min(32767, Math.round((sum / (b - a)) * 32767)));
  }
  return out;
}

/** Where the quietest twentieth of a second is, between samples `from` and `to` of `pcm`: the sample to cut at. */
export function quietest(pcm, from, to) {
  const span = RATE / 20;
  let best = to, least = Infinity;
  for (let at = Math.max(0, from); at + span <= to; at += span / 2) {
    let sum = 0;
    for (let j = at; j < at + span; j++) sum += pcm[j] * pcm[j];
    if (sum < least) { least = sum; best = at + span / 2; }
  }
  return Math.round(best);
}

const join = (...parts) => parts.map((part) => part.trim()).filter(Boolean).join(' ');

/**
 * What is said, as it is said. add() takes the samples recorded (16-bit, at RATE); step(),
 * called every second or so, sends what has not been written down for good to `send(pcm)`,
 * which resolves to its words. What runs past CUT_AFTER seconds is cut at a pause and written
 * down for good, so no piece sent is ever long, and the words so far are always quick to
 * come back. `onText(words)` is told every change. finish() sends the rest and resolves to
 * all of it.
 */
export class Listener {
  constructor({ send, onText = () => {} }) {
    Object.assign(this, { send, onText });
    this.kept = '';     // written down for good
    this.guess = '';    // what the rest is heard as, so far
    this.tail = new Int16Array(0);   // recorded, and not yet written down for good
    this.busy = null;
    this.failed = null;
  }

  add(samples) {
    const longer = new Int16Array(this.tail.length + samples.length);
    longer.set(this.tail);
    longer.set(samples, this.tail.length);
    this.tail = longer;
  }

  get text() { return join(this.kept, this.guess); }

  /** Sends what there is, unless a piece is still on its way. */
  step() {
    if (this.busy || this.failed || this.tail.length < LEAST * RATE) return this.busy;
    if (this.tail.length > CUT_AFTER * RATE) {
      const cut = quietest(this.tail, this.tail.length - CUT_WITHIN * RATE, this.tail.length);
      const piece = this.tail.slice(0, cut);
      this.tail = this.tail.slice(cut);
      return this.ask(piece, true);
    }
    return this.ask(this.tail, false);
  }

  ask(piece, forGood) {
    const heard = this.tail.length;
    const quiet = !piece.some((sample) => Math.abs(sample) > HUSH);
    this.busy = (quiet ? Promise.resolve('') : this.send(piece)).then((words) => {
      if (forGood) {
        this.kept = join(this.kept, words);
        this.guess = '';
      } else if (this.tail.length >= heard) this.guess = words;   // still the start of what is waiting
      this.onText(this.text);
    }, (err) => { this.failed = err; }).finally(() => { this.busy = null; });
    return this.busy;
  }

  /** Writes down the rest for good, and resolves to everything said. Rejects if a piece could not be heard. */
  async finish() {
    while (this.busy) await this.busy;
    if (!this.failed && this.tail.length >= 0.15 * RATE) {
      const rest = this.tail;
      this.tail = new Int16Array(0);
      await this.ask(rest, true);
    }
    if (this.failed) throw this.failed;
    this.guess = '';
    return this.text;
  }
}

/** True where a page can record the microphone for the service to hear. */
export const canRecord = (scope = globalThis) => Boolean(scope.navigator?.mediaDevices?.getUserMedia && scope.AudioWorkletNode && scope.AudioContext);

/**
 * Starts recording, for the service to write down. Resolves to { stop() }, once the
 * microphone is on (the browser may ask first); stop() resolves to everything said.
 * `onText(words)` is told the words so far as they come back. `endpoint` is where to send it.
 */
export async function recordForService({ onText, endpoint = '/hear' }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const context = new AudioContext();
  const end = () => { for (const track of stream.getTracks()) track.stop(); context.close().catch(() => {}); };
  try {
    await context.resume();   // a browser may hold a new one paused, after the wait for the microphone
    await context.audioWorklet.addModule(new URL('./hear-worklet.js', import.meta.url));
  } catch (err) {
    end();
    throw err;
  }
  const listener = new Listener({
    onText,
    send: async (pcm) => {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: pcm });
      if (!res.ok) throw new Error('not heard');
      return (await res.json()).text ?? '';
    }
  });
  const node = new AudioWorkletNode(context, 'pixelreel-hear');
  node.port.onmessage = (e) => listener.add(downsample(e.data, context.sampleRate));
  context.createMediaStreamSource(stream).connect(node);
  const ticking = setInterval(() => listener.step(), 1200);
  return {
    async stop() {
      clearInterval(ticking);
      node.port.onmessage = null;
      end();
      return listener.finish();
    }
  };
}
