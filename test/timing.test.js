import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clockTime, countWords, estimateSpeechMs, locate, MIN_SCENE_MS, narrationMs, speechWatchdogMs, timeline, TYPE_MIN_CPS, TYPE_SHARE,
  typedLength, WORDS_PER_SECOND
} from '../src/timing.js';

describe('timing', () => {
  it('counts words however they are spaced', () => {
    assert.equal(countWords('  one two\nthree\tfour  '), 4);
    assert.equal(countWords(''), 0);
    assert.equal(countWords(undefined), 0);
  });

  it('guesses speech length from the number of words, with a floor', () => {
    const words = Array(50).fill('word').join(' ');
    assert.equal(estimateSpeechMs(words), Math.round((50 / WORDS_PER_SECOND) * 1000));
    assert.equal(estimateSpeechMs('Hi.'), MIN_SCENE_MS);
  });

  it('uses the recorded clip length when there is one', () => {
    const scene = { say: Array(50).fill('word').join(' ') };
    assert.equal(narrationMs(scene, { seconds: 12.34 }), 12340);
    assert.equal(narrationMs(scene, { seconds: 1 }), MIN_SCENE_MS, 'never shorter than the floor');
    assert.equal(narrationMs(scene, null), estimateSpeechMs(scene.say));
    assert.equal(narrationMs(scene, { seconds: 0 }), estimateSpeechMs(scene.say), 'a clip with no length falls back to the guess');
  });

  it('waits well past the guess before giving up on the browser voice', () => {
    const text = Array(30).fill('word').join(' ');
    assert.ok(speechWatchdogMs(text) > estimateSpeechMs(text) * 2);
  });

  it('lays scenes end to end with a pause after each', () => {
    assert.deepEqual(timeline([1000, 2000, 500], 100), { starts: [0, 1100, 3200], spans: [1100, 2100, 600], total: 3800 });
    assert.deepEqual(timeline([], 100), { starts: [], spans: [], total: 0 });
  });

  it('finds the scene and moment for any point on the timeline', () => {
    const line = timeline([1000, 2000, 500], 100);
    assert.deepEqual(locate(line, 0), { index: 0, offset: 0 });
    assert.deepEqual(locate(line, 1099), { index: 0, offset: 1099 });
    assert.deepEqual(locate(line, 1100), { index: 1, offset: 0 });
    assert.deepEqual(locate(line, 3500), { index: 2, offset: 300 });
    assert.deepEqual(locate(line, -40), { index: 0, offset: 0 });
    assert.deepEqual(locate(line, 99999), { index: 2, offset: 600 });
  });

  it('writes times the way people read them', () => {
    assert.equal(clockTime(0), '0:00');
    assert.equal(clockTime(9999), '0:09');
    assert.equal(clockTime(83000), '1:23');
    assert.equal(clockTime(-5), '0:00');
  });

  it('types a caption ahead of the voice, never too slowly', () => {
    const text = 'x'.repeat(60);
    assert.equal(typedLength(text, 0, 10000), 0);
    const finish = Math.min(10000 * TYPE_SHARE, (60 / TYPE_MIN_CPS) * 1000);
    assert.equal(typedLength(text, finish / 2, 10000), 30);
    assert.equal(typedLength(text, finish, 10000), 60);
    assert.equal(typedLength(text, 99999, 10000), 60);
    assert.ok(typedLength('x'.repeat(240), 10000, 60000) >= 10 * TYPE_MIN_CPS, 'a long narration still types at a fair pace');
    assert.equal(typedLength('', 500, 1000), 0);
  });
});
