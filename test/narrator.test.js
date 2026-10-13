import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createNarrator } from '../src/narrator.js';
import { estimateSpeechMs, speechWatchdogMs } from '../src/timing.js';

const scenes = [{ say: 'Recorded line.' }, { say: 'A line with no recording at all.' }];
const clipFor = (s) => (s === scenes[0] ? { url: 'audio/a.mp3', seconds: 6 } : null);

function fakeAudio({ fails = false } = {}) {
  let src = '';
  return {
    loads: 0, currentTime: 0, paused: true, onended: null, onerror: null,
    get src() { return src; },
    set src(v) { src = v; this.loads++; },
    play() { this.paused = false; return fails ? Promise.reject(Object.assign(new Error('nope'), { name: 'NotSupportedError' })) : Promise.resolve(); },
    pause() { this.paused = true; }
  };
}

function fakeSpeech() {
  return {
    spoken: [], cancelled: 0,
    getVoices: () => [{ lang: 'en-US', name: 'US' }, { lang: 'en-GB', name: 'UK' }],
    speak(u) { this.spoken.push(u); },
    cancel() { this.cancelled++; }
  };
}
class Utterance { constructor(text) { this.text = text; } }

describe('createNarrator', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
  afterEach(() => mock.timers.reset());

  it('plays the recorded clip and reports when it ends', () => {
    const audio = fakeAudio();
    const n = createNarrator({ scenes, clipFor, audio, speech: fakeSpeech(), Utterance });
    let done = 0;
    n.speak(0, { muted: false }, () => done++);
    assert.equal(audio.src, 'audio/a.mp3');
    assert.equal(audio.paused, false);
    assert.equal(n.lastSource, 'clip');
    audio.onended();
    assert.equal(done, 1);
  });

  it('reads the line with the browser voice when there is no clip, preferring a British voice', () => {
    const speech = fakeSpeech();
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio(), speech, Utterance });
    let done = 0;
    n.speak(1, { muted: false }, () => done++);
    assert.equal(n.lastSource, 'browser-voice');
    assert.equal(speech.spoken[0].text, scenes[1].say);
    assert.equal(speech.spoken[0].voice.name, 'UK');
    mock.timers.tick(estimateSpeechMs(scenes[1].say));
    speech.spoken[0].onend();
    speech.spoken[0].onend();
    assert.equal(done, 1, 'finishes once');
  });

  it('does not skip ahead when the browser voice fails or ends at once', () => {
    for (const event of ['onerror', 'onend']) {
      const speech = fakeSpeech();
      const n = createNarrator({ scenes, clipFor, audio: fakeAudio(), speech, Utterance });
      let done = 0;
      n.speak(1, { muted: false }, () => done++);
      speech.spoken[0][event]({ error: 'synthesis-failed' });
      assert.equal(done, 0, `${event} straight away waits`);
      mock.timers.tick(estimateSpeechMs(scenes[1].say));
      assert.equal(done, 1, `${event} finishes once the words would have been said`);
    }
  });

  it('falls back to the browser voice when a clip will not play', async () => {
    const speech = fakeSpeech();
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio({ fails: true }), speech, Utterance });
    n.speak(0, { muted: false }, () => {});
    await Promise.resolve(); await Promise.resolve();
    assert.equal(speech.spoken.length, 1);
    assert.equal(speech.spoken[0].text, scenes[0].say);
  });

  it('moves on even when the browser voice never says it has finished', () => {
    const speech = fakeSpeech();
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio(), speech, Utterance });
    let done = 0;
    n.speak(1, { muted: false }, () => done++);
    mock.timers.tick(speechWatchdogMs(scenes[1].say) - 1);
    assert.equal(done, 0);
    mock.timers.tick(1);
    assert.equal(done, 1);
  });

  it('with no voice at all, waits about as long as the words would take', () => {
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio() });
    let done = 0;
    n.speak(1, { muted: false }, () => done++);
    assert.equal(n.lastSource, 'timer');
    mock.timers.tick(estimateSpeechMs(scenes[1].say));
    assert.equal(done, 1);
  });

  it('muted, stays quiet for the length of the clip', () => {
    const audio = fakeAudio(), speech = fakeSpeech();
    const n = createNarrator({ scenes, clipFor, audio, speech, Utterance });
    let done = 0;
    n.speak(0, { muted: true }, () => done++);
    assert.equal(audio.src, '');
    assert.equal(speech.spoken.length, 0);
    mock.timers.tick(5999);
    assert.equal(done, 0);
    mock.timers.tick(1);
    assert.equal(done, 1);
  });

  it('stopping silences the clip and the browser voice', () => {
    const audio = fakeAudio(), speech = fakeSpeech();
    const n = createNarrator({ scenes, clipFor, audio, speech, Utterance });
    let done = 0;
    n.speak(0, { muted: false }, () => done++).stop();
    assert.equal(audio.paused, true);
    assert.equal(audio.onended, null);
    const { stop } = n.speak(1, { muted: false }, () => done++);
    const before = speech.cancelled;
    stop();
    assert.equal(speech.cancelled, before + 1);
    mock.timers.tick(speechWatchdogMs(scenes[1].say) * 2);
    assert.equal(done, 0);
  });

  it('starts a clip part of the way in, and resumes it without loading it again', () => {
    const audio = fakeAudio();
    const n = createNarrator({ scenes, clipFor, audio, speech: fakeSpeech(), Utterance });
    const first = n.speak(0, { muted: false, from: 0 }, () => {});
    first.stop();
    const again = n.speak(0, { muted: false, from: 2500 }, () => {});
    assert.equal(again.from, 2500);
    assert.equal(audio.currentTime, 2.5);
    assert.equal(audio.loads, 1, 'the same clip is not fetched twice');
    assert.equal(audio.paused, false);
  });

  it('says from the top with the browser voice, and says so', () => {
    const speech = fakeSpeech();
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio(), speech, Utterance });
    const said = n.speak(1, { muted: false, from: 3000 }, () => {});
    assert.equal(said.from, 0);
    assert.equal(speech.spoken[0].text, scenes[1].say);
  });

  it('muted part of the way in, waits only for the rest', () => {
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio(), speech: fakeSpeech(), Utterance });
    let done = 0;
    const said = n.speak(0, { muted: true, from: 2000 }, () => done++);
    assert.equal(said.from, 2000);
    mock.timers.tick(3999);
    assert.equal(done, 0);
    mock.timers.tick(1);
    assert.equal(done, 1);
  });

  it('with no voice at all, part of the way in, waits only for the rest', () => {
    const n = createNarrator({ scenes, clipFor, audio: fakeAudio() });
    let done = 0;
    const said = n.speak(1, { muted: false, from: 1000 }, () => done++);
    assert.equal(said.from, 1000);
    mock.timers.tick(estimateSpeechMs(scenes[1].say) - 1000);
    assert.equal(done, 1);
  });
});
