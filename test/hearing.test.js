import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { HEAR_MAX_BYTES, HearError, Hearing } from '../service/hear.mjs';
import { Reels } from '../service/reels.mjs';
import { createService } from '../service/server.mjs';
import { DiskStore } from '../service/store.mjs';
import { canRecord, CUT_AFTER, downsample, Listener, quietest, RATE } from '../site/js/hearing.js';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-hear-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** `seconds` of a steady sound (or of nothing, at 0). */
const sound = (seconds, loud = 8000) => Int16Array.from({ length: Math.round(seconds * RATE) }, (_, i) => (i % 2 ? loud : -loud));

describe('what the page records', () => {
  it('is made into 16-bit samples at 16,000 a second, from whatever the browser records at', () => {
    const at48k = Float32Array.from({ length: 4800 }, () => 0.5);
    const out = downsample(at48k, 48000);
    assert.equal(out.length, 1600);
    assert.ok(out.every((s) => s === 16384));
    assert.equal(downsample(Float32Array.from({ length: 441 }, () => 1), 44100).length, 160);
    assert.equal(downsample(Float32Array.from([2, -2]), 16000).join(), '32767,-32768', 'too loud is kept in range');
  });

  it('is cut at its quietest moment', () => {
    const pcm = new Int16Array(RATE * 2).fill(9000);
    pcm.fill(0, RATE, RATE + 1600);
    const cut = quietest(pcm, 0, pcm.length);
    assert.ok(cut >= RATE && cut <= RATE + 1600, `cut at ${cut}`);
  });

  it('is only recorded where the browser can', () => {
    assert.equal(canRecord({ navigator: {} }), false);
    assert.equal(canRecord({ navigator: { mediaDevices: { getUserMedia() {} } }, AudioWorkletNode() {}, AudioContext() {} }), true);
  });
});

describe('a note said aloud, written down by the service', () => {
  it('shows the words so far, put right as more is heard, and keeps the whole of it at the end', async () => {
    const sent = [], shown = [];
    const heard = ['why is', 'why is the sunset red', 'why is the sunset red and not blue'];
    const listener = new Listener({ send: async (pcm) => { sent.push(pcm.length); return heard[sent.length - 1]; }, onText: (t) => shown.push(t) });
    listener.add(sound(0.2));
    await listener.step();
    assert.equal(sent.length, 0, 'not enough to send yet');
    listener.add(sound(1));
    await listener.step();
    listener.add(sound(1));
    await listener.step();
    assert.deepEqual(shown, ['why is', 'why is the sunset red']);
    assert.deepEqual(sent, [1.2 * RATE, 2.2 * RATE], 'each time, all that is not yet written down for good');
    assert.equal(await listener.finish(), 'why is the sunset red and not blue');
  });

  it('writes down a long note a piece at a time, cut at pauses, so no piece sent is long', async () => {
    const sent = [];
    const listener = new Listener({ send: async (pcm) => { sent.push(pcm.length); return `piece${sent.length}`; } });
    const long = sound(CUT_AFTER + 1);
    long.fill(0, (CUT_AFTER - 1) * RATE, (CUT_AFTER - 1) * RATE + 1600);   // a pause a second before the cut
    listener.add(long);
    await listener.step();
    assert.ok(Math.abs(sent[0] - ((CUT_AFTER - 1) * RATE + 800)) < 800, `cut at the pause, at ${sent[0] / RATE}s`);
    assert.equal(listener.text, 'piece1');
    listener.add(sound(1));
    assert.equal(await listener.finish(), 'piece1 piece2');
    assert.ok(sent[1] < 3 * RATE);
  });

  it('sends nothing for silence, and says so when a piece could not be heard', async () => {
    let sent = 0;
    const quiet = new Listener({ send: async () => { sent++; return 'x'; } });
    quiet.add(sound(2, 0));
    await quiet.step();
    assert.equal(await quiet.finish(), '');
    assert.equal(sent, 0);
    const failing = new Listener({ send: async () => { throw new Error('busy'); } });
    failing.add(sound(1));
    await failing.step();
    await assert.rejects(failing.finish(), /busy/);
  });
});

describe('the Python that hears', () => {
  // stands in for scripts/hear.py --serve: says how many samples it was given
  const fake = join(tmp, 'fake-hear.mjs');
  writeFileSync(fake, `
import { createInterface } from 'node:readline';
if (process.argv.includes('broken')) process.exit(3);
console.log(JSON.stringify({ ready: true }));
createInterface({ input: process.stdin }).on('line', (line) => {
  const { id, pcm } = JSON.parse(line);
  const n = Buffer.from(pcm, 'base64').length / 2;
  if (n === 1) { console.log(JSON.stringify({ id, error: 'too short' })); return; }
  if (n === 2) return;   // stuck
  console.log(JSON.stringify({ id, text: n + ' samples' }));
});`);

  it('is started once, hears one piece at a time, and stops when asked', async () => {
    const said = [];
    const hearing = new Hearing({ command: [process.execPath, fake], log: (l) => said.push(l) });
    const [a, b] = await Promise.all([hearing.hear(new Int16Array(10)), hearing.hear(new Int16Array(20))]);
    assert.deepEqual([a, b], ['10 samples', '20 samples']);
    assert.match(said[0], /^hear: base\.en loaded in/);
    await assert.rejects(hearing.hear(new Int16Array(1)), (err) => err instanceof HearError && /too short/.test(err.message));
    assert.equal(await hearing.hear(new Int16Array(5)), '5 samples', 'a bad piece does not stop the next');
    hearing.stop();
    assert.equal(hearing.child, null);
  });

  it('gives up on a stuck piece, and on a Python that will not start, and turns pieces away when too many wait', async () => {
    const stuck = new Hearing({ command: [process.execPath, fake], patience: 200 });
    await assert.rejects(stuck.hear(new Int16Array(2)), /took too long/);
    assert.equal(await stuck.hear(new Int16Array(3)), '3 samples', 'and starts again for the next');
    stuck.stop();
    const broken = new Hearing({ command: [process.execPath, fake, 'broken'] });
    await assert.rejects(broken.hear(new Int16Array(3)), HearError);
    const crowded = new Hearing({ command: [process.execPath, fake], waiting: 1 });
    const first = crowded.hear(new Int16Array(4));
    await assert.rejects(crowded.hear(new Int16Array(4)), /busy/);
    assert.equal(await first, '4 samples');
    crowded.stop();
  });
});

describe('POST /hear', () => {
  const asked = [];
  const hearing = { hear: async (pcm) => { asked.push(pcm.length); if (pcm.length === 6) throw new HearError('busy'); return 'why is it red'; } };
  const reels = new Reels({ store: new DiskStore(join(tmp, 'store')), record: async () => {}, video: async () => {} });
  const server = createService({ reels, baseUrl: 'https://reels.example', hearing, writer: async () => ({}) });
  const off = createService({ reels, baseUrl: 'https://reels.example' });
  let local, localOff;
  before(async () => {
    // a site Message in a Bottle is on, kept as it keeps them (bottles/sites/<site>/site.json)
    await reels.store.put('bottles/sites/hoops/site.json', JSON.stringify({ id: 'hoops', name: 'Hoops', origins: ['https://hoops.example'], people: [] }));
    await Promise.all([server, off].map((s) => new Promise((ok) => s.listen(0, '127.0.0.1', ok))));
    local = `http://127.0.0.1:${server.address().port}`;
    localOff = `http://127.0.0.1:${off.address().port}`;
  });
  after(() => { for (const s of [server, off]) { s.close(); s.closeAllConnections(); } });
  const send = (body, origin = 'https://reels.example', base = local) => fetch(`${base}/hear`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', ...(origin ? { origin } : {}) }, body });

  it('writes down what was said, for the website\'s own page', async () => {
    const res = await send(new Uint8Array(3200));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: 'why is it red' });
    assert.equal(asked.at(-1), 3200);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('and for a page of a site Message in a Bottle is on, from its own address', async () => {
    const pre = await fetch(`${local}/hear`, { method: 'OPTIONS', headers: { origin: 'https://hoops.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'https://hoops.example');
    assert.match(pre.headers.get('access-control-allow-headers'), /content-type/);
    const res = await send(new Uint8Array(100), 'https://hoops.example');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://hoops.example');
  });

  it('turns away other sites, too much, what is not sound, and says when it is busy', async () => {
    const before = asked.length;
    assert.equal((await send(new Uint8Array(100), 'https://elsewhere.example')).status, 403);
    assert.equal((await send(new Uint8Array(100), null)).status, 403);
    assert.equal((await send(new Uint8Array(HEAR_MAX_BYTES + 2))).status, 413);
    assert.equal((await send(new Uint8Array(101))).status, 400);
    assert.equal(asked.length, before, 'none of those is heard');
    const busy = await send(new Uint8Array(6));
    assert.deepEqual([busy.status, await busy.json()], [503, { error: 'busy' }]);
    assert.equal((await send(new Uint8Array(100), 'https://reels.example', localOff)).status, 404, 'and is not there at all without a Hearing');
  });

  it('tells a reel\'s page whether it hears', async () => {
    const made = await reels.create({ format: 'pixelreel/1', title: 'Tea', scenes: [{ title: 'Kettle', caption: 'Boil it.', say: 'Boil the kettle.', picture: { type: 'big', text: 'BOIL' } }] });
    assert.match(await (await fetch(`${local}/r/${made.id}`)).text(), /data-here="on" data-mic="on"/);
    assert.match(await (await fetch(`${localOff}/r/${made.id}`)).text(), /data-here="off" data-mic="off"/);
    await reels.idle();
  });
});
