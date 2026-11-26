import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reelFromData, reelSchema } from '../src/format.js';
import { createKit } from '../src/kit.js';
import { pictureProblems } from '../src/pictures.js';
import { GROUND, MOVES, moveTimes, PLACES, SPOTS, stageProblems } from '../src/stage.js';
import { paceStage, pacePicture } from '../service/pacing.mjs';
import { fakeContext } from './fake-canvas.js';

const stage = (more = {}) => ({
  type: 'stage',
  place: 'street',
  things: [{ id: 'home', is: 'house', spot: 'left', label: 'Your home' }, { id: 'bank', is: 'bank', spot: 'right', label: 'The bank' }, { id: 'you', is: 'woman', spot: 'middle', hair: 'ginger' }],
  moves: [{ do: 'send', what: 'letter', from: 'bank', to: 'home', cue: 'sends a letter' }, { do: 'pile', on: 'bank', count: 4, cue: 'what you owe' }],
  ...more
});
const reel = (picture) => ({ format: 'pixelreel/1', title: 'Bill', scenes: [{ title: 'Bill', caption: 'A bill.', say: 'The bank sends a letter, saying what you owe.', picture }] });

describe('the stage', () => {
  it('is a picture a reel.json can hold', () => {
    assert.deepEqual(pictureProblems(stage()), []);
    assert.equal(reelFromData(reel(stage())).scenes.length, 1);
  });

  it('says what is wrong with a stage, every fault at once', () => {
    const wrong = stageProblems({
      place: 'moon',
      things: [{ id: 'a', is: 'house', spot: 'left' }, { id: 'a', is: 'spaceship', spot: 'left', label: 'one two three four' }, { id: 'c', is: 'car', spot: 'nowhere' }],
      moves: [{ do: 'fly' }, { do: 'send', from: 'a', to: 'zz', what: 'letter' }, { do: 'say', who: 'a', text: 'far too many words to say here' }, { do: 'walk', who: 'a', to: 'b' }]
    });
    for (const bit of ['place must be one of', 'an id of its own', '"spaceship" is not something', 'label must be 3 words', 'stands where "a" does', 'spot must be one of',
      '.do must be one of', '.to must be the id', '.text must be 4 words', '.to must be a spot']) {
      assert.ok(wrong.some((p) => p.includes(bit)), `says ${bit}: ${wrong.join(' | ')}`);
    }
  });

  it('keeps a big thing clear of its neighbours, and the air apart from the ground', () => {
    const things = [{ id: 'a', is: 'house', spot: 'left' }, { id: 'b', is: 'car', spot: 'middle' }];
    assert.ok(stageProblems(stage({ things, moves: [{ do: 'pulse', on: 'a' }] })).some((p) => p.includes('too wide to stand side by side')));
    const apart = [{ id: 'a', is: 'house', spot: 'left' }, { id: 'b', is: 'woman', spot: 'middle' }, { id: 'c', is: 'car', spot: 'far-right' }];
    assert.deepEqual(stageProblems(stage({ things: apart, moves: [{ do: 'pulse', on: 'a' }] })), [], 'a house beside a person is fine');
    const air = [{ id: 'a', is: 'house', spot: 'left' }, { id: 'b', is: 'cloud', spot: 'left', up: true }];
    assert.deepEqual(stageProblems(stage({ things: air, moves: [{ do: 'pulse', on: 'a' }] })), []);
  });

  it('gives only people a skin and hair', () => {
    const things = [{ id: 'a', is: 'house', spot: 'left', skin: 'deep' }, { id: 'b', is: 'man', spot: 'right', hair: 'purple' }];
    const wrong = pictureProblems(stage({ things, moves: [{ do: 'pulse', on: 'a' }] }));
    assert.ok(wrong.some((p) => p.includes('things[0].skin: only a woman')), wrong.join(' | '));
    assert.ok(wrong.some((p) => p.includes('things[1].hair must be one of')), wrong.join(' | '));
  });

  it('draws every place and every move at every moment, inside the picture', () => {
    const all = Object.keys(MOVES);
    for (const place of Object.keys(PLACES)) {
      const p = stage({
        place,
        things: [{ id: 'r', is: 'reelie', spot: 'far-left' }, { id: 'a', is: 'woman', spot: 'left', label: 'Ana' }, { id: 'b', is: 'bank', spot: 'right', label: 'Bank' }, { id: 'c', is: 'cloud', spot: 'middle', up: true }],
        moves: [{ do: 'arrive', who: 'c' }, { do: 'send', what: 'money', from: 'a', to: 'b', again: true }, { do: 'block', from: 'a', to: 'b' }, { do: 'count', on: 'b', to: 81.15, before: '£' }, { do: 'say', who: 'r', text: 'Look!' }, { do: 'walk', who: 'r', to: 'middle' }]
      });
      assert.deepEqual(pictureProblems(p), [], place);
      const g = fakeContext(), px = createKit(g);
      for (const t of [0, 0.3, 1, 2.5, 4, 7, 20]) px.picture(p, t);
      assert.equal(g.depth, 0);
      // a label is never cut off at the edge (the clouds may drift off it)
      for (const tx of g.texts) {
        const w = tx.str.length * (parseFloat(tx.font) / 2), left = tx.x - (g.textAlign === 'center' ? w / 2 : 0);
        assert.ok(tx.x >= 0 && tx.x <= 320 && tx.y >= 0 && tx.y < 180 && left > -w, `${place}: "${tx.str}" is inside the picture`);
      }
    }
    // the rest of the moves, one stage each
    for (const move of all) {
      const m = { do: move, ...{ arrive: { who: 'a' }, send: { what: 'letter', from: 'a', to: 'b' }, flow: { from: 'a', to: 'b' }, wave: { from: 'a', to: 'b' }, block: { from: 'a', to: 'b' }, pile: { on: 'a', count: 10 }, meter: { on: 'a', to: 0.5 }, count: { on: 'a', to: 3, after: ' days' }, mark: { on: 'a', with: 'tick' }, pulse: { on: 'a' }, say: { who: 'a', text: 'Hello' }, walk: { who: 'a', to: 'far-right' }, leave: { who: 'a' } }[move] };
      const p = stage({ things: [{ id: 'a', is: 'phone', spot: 'left' }, { id: 'b', is: 'computer', spot: 'right' }], moves: [m] });
      assert.deepEqual(pictureProblems(p), [], move);
      const g = fakeContext(), px = createKit(g);
      for (const t of [0, 1, 2, 3, 9]) px.picture(p, t);
    }
  });

  it('stands things on the ground in their spots', () => {
    assert.deepEqual(Object.values(SPOTS), [36, 98, 160, 222, 284]);
    assert.ok(GROUND > 120 && GROUND < 160);
  });

  it('starts moves one after another when nobody has said when, and at their own time when they have', () => {
    assert.deepEqual(moveTimes([{}, {}, {}]), [0.8, 2.4, 4]);
    assert.deepEqual(moveTimes([{ at: 1 }, {}, { at: 5 }]), [1, 2.6, 5]);
  });

  it('times each move to the words the narrator says, in order, before the line ends', () => {
    const say = 'The bank sends a letter. Weeks later, you see what you owe, and you pay it.';
    const p = paceStage(stage({ moves: [{ do: 'send', what: 'letter', from: 'bank', to: 'home', cue: 'sends a letter' }, { do: 'pulse', on: 'home' }, { do: 'pile', on: 'bank', count: 4, cue: 'what you owe' }, { do: 'mark', on: 'home', with: 'tick', cue: 'pay it' }] }), say, 6);
    const at = p.moves.map((m) => m.at);
    assert.ok(at[0] < 1.6, `the letter goes as it is said: ${at}`);
    assert.ok(at[2] > 2.5 && at[2] < 4.8, `the coins as "what you owe" is said: ${at}`);
    assert.ok(at[1] > at[0] && at[1] < at[2], 'a move with no cue falls in step between');
    assert.ok(at[3] > at[2] && at[3] <= 5.1, 'the last is in before the line ends');
    assert.deepEqual(pacePicture(stage(), say, 6).moves.length, 2);
  });

  it('is in the format\'s schema', () => {
    const pictures = reelSchema().$defs.picture.oneOf.map((p) => p.title);
    assert.ok(pictures.includes('stage'));
  });
});
