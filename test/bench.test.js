import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { benchProblems, cents, kindsOf, readRun, tokensFrom, topicNames } from '../scripts/bench.mjs';
import { drawScenes, pacedForPeter, sceneSeconds } from '../service/frames.mjs';
import { EXAMPLE_REEL } from '../service/mcp.mjs';
import { told } from './told.js';

test('the bench has ten fixed topics', () => {
  assert.equal(topicNames().length, 10);
});

test('the bench reads the tokens from the writer\'s log and prices them', () => {
  const tokens = tokensFrom(['try: text, 4610 tokens in, 1197 out (claude-sonnet-5-5)', 'try: text, 100 tokens in, 3 out (x)', 'something else']);
  assert.deepEqual(tokens, { in: 4710, out: 1200 });
  assert.equal(cents('claude-sonnet-5-5', { in: 1e6, out: 0 }), 200);
  assert.equal(cents('claude-opus-5-5', { in: 0, out: 1e6 }), 2000);
});

test('the bench says what the service would say of a reel, and which pictures it chose', () => {
  assert.deepEqual(benchProblems(EXAMPLE_REEL), []);
  assert.ok(benchProblems({ format: 'pixelreel/1', title: 'x', scenes: [] }).length);
  assert.deepEqual(kindsOf(EXAMPLE_REEL), ['title', 'icons', 'big', 'list', 'compare', 'sprite']);
});

test('every reel of the cards run is one the service would take', () => {
  const run = readRun('cards');
  assert.deepEqual(Object.keys(run).sort(), topicNames());
  for (const [topic, kept] of Object.entries(run)) assert.deepEqual(benchProblems(kept.reel), [], topic);
});

test('a reel\'s scenes are drawn as frames, timed to how long Peter will take', async () => {
  const scenes = await drawScenes(EXAMPLE_REEL, { parts: [0.5, 0.9], scale: 2 });
  assert.equal(scenes.length, EXAMPLE_REEL.scenes.length);
  for (const scene of scenes) {
    assert.equal(scene.frames.length, 2);
    assert.equal(scene.frames[0].width, 640);
    assert.equal(scene.broken, undefined);
  }
  const list = pacedForPeter(EXAMPLE_REEL).scenes[3];
  assert.ok(list.picture.start > 0 && list.picture.every > 0, 'the list is timed to the line');
  assert.ok(sceneSeconds(list) >= 4);
});

test('with the cards, Claude is told exactly what it was told before the stage (test/fixtures/cards-told.json)', () => {
  assert.deepEqual(told({ pictures: 'cards' }), JSON.parse(readFileSync(new URL('./fixtures/cards-told.json', import.meta.url), 'utf8')));
});
