import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { recordWith } from '../service/reels.mjs';
import { WarmVoice } from '../service/voice.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-voice-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const STAND_IN = [process.execPath, fileURLToPath(new URL('./fake-voice.js', import.meta.url))];
const PETER = { engine: 'pocket', voice: 'peter_yearsley' };
let made = 0;

/** A voice run by the stand-in, misbehaving as `how` says, with what it logged, what was spoken the usual way, and how often it started. */
function voice(how = '', options = {}) {
  const starts = join(tmp, `starts-${++made}.txt`), said = [], usual = [];
  const warm = new WarmVoice({
    command: STAND_IN,
    env: { ...process.env, FAKE_VOICE: how, FAKE_VOICE_LOG: starts },
    threads: 3,
    log: (line) => said.push(line),
    once: async (lines, settings, threads, onDone) => { for (const line of lines) { usual.push(line.text); onDone(line.wav, 1); } },
    ...options
  });
  after(() => warm.stop());
  return { warm, said, usual, starts: () => (existsSync(starts) ? readFileSync(starts, 'utf8').trim().split('\n') : []) };
}

const lines = (...texts) => texts.map((text, i) => ({ text, wav: join(tmp, `line-${++made}-${i}.wav`) }));

describe('the voice kept ready', () => {
  it('loads once, when asked to start, and speaks reel after reel', async () => {
    const { warm, said, usual, starts } = voice();
    assert.equal(await warm.start(), true);
    assert.equal(await warm.start(), true, 'asking again does not start another');
    assert.deepEqual(starts(), ['--serve --voice peter_yearsley --threads 3 --keep 2']);
    assert.match(said[0], /^voice: peter_yearsley is loaded and ready, after \d+\.\d seconds$/);

    const first = lines('Boil the kettle.', 'Pour it.'), done = [];
    await warm.speak(first, PETER, 2, (wav, seconds) => done.push([wav, seconds]));
    assert.deepEqual(done, [[first[0].wav, 1.6], [first[1].wav, 0.8]], 'each line is handed over as it is spoken, in order');
    assert.equal(readFileSync(first[0].wav, 'utf8'), 'peter_yearsley says: Boil the kettle.');

    const second = lines('Drink it.');
    await warm.speak(second, PETER, 2, (wav) => done.push(wav));
    assert.equal(done.at(-1), second[0].wav);
    assert.equal(starts().length, 1, 'the second reel is spoken by the same one');
    assert.deepEqual(usual, [], 'nothing needed the usual way');
  });

  it('starts by itself for the first reel, if nothing started it', async () => {
    const { warm, starts } = voice();
    const done = [];
    await warm.speak(lines('Hello.'), PETER, 2, (wav) => done.push(wav));
    assert.equal(done.length, 1);
    assert.equal(starts().length, 1);
  });

  it('records the usual way when it cannot start, and tries again for the next reel', async () => {
    const { warm, said, usual, starts } = voice('broken');
    assert.equal(await warm.start(), false);
    assert.match(said[0], /^voice: stopped with exit code 3$/);
    await warm.speak(lines('One.', 'Two.'), PETER, 2, () => {});
    assert.deepEqual(usual, ['One.', 'Two.']);
    assert.equal(starts().length, 2, 'it tried once at the start and once for the reel');
    const missing = new WarmVoice({ command: [join(tmp, 'no-such-python')], log: (line) => said.push(line), once: async (rest) => usual.push(...rest.map((l) => l.text)) });
    assert.equal(await missing.start(), false);
    assert.match(said.at(-1), /^voice: could not start \(/);
    await missing.speak(lines('Three.'), PETER, 2, () => {});
    assert.equal(usual.at(-1), 'Three.');
  });

  it('speaks only the lines left the usual way when it stops part of the way through', async () => {
    const { warm, said, usual } = voice('dies');
    const done = [], reel = lines('One.', 'Two.', 'Three.');
    await warm.speak(reel, PETER, 2, (wav) => done.push(wav));
    assert.deepEqual(usual, ['Two.', 'Three.'], 'the line it had spoken is not spoken twice');
    assert.deepEqual(done, reel.map((l) => l.wav));
    assert.match(said.join('\n'), /voice: the loaded voice could not finish \(stopped with exit code 1\); speaking 2 lines the usual way/);
  });

  it('gives up on one that goes quiet, rather than waiting for ever', async () => {
    const { warm, usual } = voice('stuck', { patience: 150 });
    const reel = lines('One.', 'Two.');
    await warm.speak(reel, PETER, 2, () => {});
    assert.deepEqual(usual, ['Two.']);
    assert.equal(warm.child, null, 'the stuck one is stopped');
  });

  it('passes on what the voice itself says is wrong, by trying the usual way', async () => {
    const { warm, said, usual, starts } = voice('refuses');
    await warm.speak(lines('One.'), { engine: 'pocket', voice: 'nobody' }, 2, () => {});
    assert.match(said.join('\n'), /could not finish \(no voice called nobody\)/);
    assert.deepEqual(usual, ['One.'], 'the usual way then says so in its own words');
    assert.equal(starts().length, 1, 'one job it could not do does not stop it');
  });

  it('speaks other languages too, loading each one the first time it is asked for', async () => {
    const { warm, said, usual, starts } = voice('', { keep: 3 });
    const french = lines('Un.', 'Deux.'), again = lines('Trois.'), english = lines('Four.');
    await warm.speak(french, { engine: 'pocket', voice: 'anna', lang: 'french' }, 2, () => {});
    await warm.speak(again, { engine: 'pocket', voice: 'anna', lang: 'french' }, 2, () => {});
    await warm.speak(english, PETER, 2, () => {});
    assert.deepEqual(usual, [], 'none of it the usual way, which would load the model afresh for each reel');
    assert.equal(readFileSync(french[1].wav, 'utf8'), 'anna says in french: Deux.');
    assert.equal(readFileSync(english[0].wav, 'utf8'), 'peter_yearsley says: Four.', 'and English is not named');
    assert.deepEqual(starts(), ['--serve --voice peter_yearsley --threads 3 --keep 3'], 'in the one Python, told how many languages to hold');
    assert.deepEqual(said.filter((line) => /model is loaded/.test(line)), ['voice: the french model is loaded, after 0.1 seconds (holding 1600 MB)'], 'the model is loaded once, and the log says how long it took and what it holds');
  });

  it('starts afresh when the loaded voice says it holds too much, losing nothing', async () => {
    const { warm, said, usual, starts } = voice('fills');
    const done = [], in1 = lines('Un.'), in2 = lines('Eins.'), in3 = lines('Four.');
    await warm.speak(in1, { engine: 'pocket', voice: 'peter_yearsley', lang: 'french' }, 2, (wav) => done.push(wav));
    await warm.speak(in2, { engine: 'pocket', voice: 'peter_yearsley', lang: 'german' }, 2, (wav) => done.push(wav));
    await new Promise((ok) => warm.child ? warm.child.once('close', ok) : ok());   // it stops itself once that reel is spoken
    await warm.speak(in3, PETER, 2, (wav) => done.push(wav));
    assert.deepEqual(done, [in1[0].wav, in2[0].wav, in3[0].wav], 'every line was spoken');
    assert.deepEqual(usual, [], 'and none the usual way: the reel that filled it was finished first');
    assert.equal(starts().length, 2, 'it was started again for the next reel');
    assert.ok(said.includes('voice: holding 2700 MB, more than it should: starting afresh'), said.join('\n'));
  });

  it('leaves other engines, and what goes wrong after a line is spoken, alone', async () => {
    const { warm, usual, starts } = voice();
    await warm.speak(lines('One.'), { engine: 'kokoro', voice: 'bm_george' }, 2, () => {});
    assert.deepEqual(usual, ['One.'], 'Kokoro is not Pocket TTS: it is spoken the usual way');
    assert.deepEqual(starts(), [], 'and nothing is loaded for it');
    await assert.rejects(warm.speak(lines('Two.', 'Three.'), PETER, 2, () => { throw new Error('ffmpeg could not encode it'); }), /^Error: ffmpeg could not encode it$/);
    assert.deepEqual(usual, ['One.'], 'a line that was spoken but could not be saved is not spoken again');
    // the voice is still finishing "Three." of the reel that was given up on: its lines are not taken for this one's
    const done = [], next = lines('Four.');
    await warm.speak(next, PETER, 2, (wav) => done.push(wav));
    assert.deepEqual(done, [next[0].wav], 'and it carries on with the next reel');
  });

  it('lets go when stopped', async () => {
    const { warm } = voice();
    await warm.start();
    const { child } = warm;
    const closed = new Promise((ok) => child.on('close', ok));
    warm.stop();
    await closed;
    assert.equal(warm.child, null);
  });

  it('is what a recorder is given to speak with', () => {
    assert.equal(typeof recordWith(), 'function');
    assert.equal(recordWith(async () => {}).length, 3, 'a recorder takes a folder, somewhere to log, and who to tell of each line');
  });
});
