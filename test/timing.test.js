import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countWords, estimateSpeechMs, MIN_SCENE_MS, narrationMs, speechWatchdogMs, WORDS_PER_SECOND } from '../src/timing.js';

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
});
