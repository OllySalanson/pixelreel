import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const main = read('src/main.js');

describe('the player page', () => {
  // A button that changed its words used to change its width, so at the end of the example reel
  // "Play again" pushed the scene dots onto a second line and gave the page a scrollbar.
  for (const [id, variable] of [['play', 'playBtn'], ['mute', 'muteBtn']]) {
    it(`#${id} holds every label main.js shows on it, stacked so its width never changes`, () => {
      const button = new RegExp(`<button id="${id}"[^>]*class="[^"]*\\blabels\\b[^"]*"[^>]*>(.*?)</button>`).exec(html);
      assert.ok(button, `#${id} is a button with class "labels"`);
      const spans = [...button[1].matchAll(/<span( class="on")?>([^<]+)<\/span>/g)];
      assert.equal(spans.filter((m) => m[1]).length, 1, 'one label shows before the script runs');
      const call = new RegExp(`showLabel\\(${variable}, (.*)\\);`).exec(main);
      assert.ok(call, `main.js sets #${id} with showLabel`);
      const shown = [...call[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      assert.deepEqual(spans.map((m) => m[2]).sort(), [...new Set(shown)].sort());
    });
  }
});

describe('the banner maker page', () => {
  const maker = read('export.html');

  // In a 170px column the Scene select cut "7. No recording? No problem" to "7. No recording",
  // and the Detail select cut "3x: sharpest text", even at 1280px wide.
  it('puts the Scene select in the wide Reel row, where long scene titles fit', () => {
    const row = /<div class="wide">((?:(?!<\/div>).)*)<\/div>/s.exec(maker);
    assert.ok(row && row[1].includes('id="reel"'), 'the first wide row holds the Reel box');
    assert.match(row[1], /<select id="scene">/);
  });

  it('keeps the other form columns wide enough for "3x: sharpest text"', () => {
    const min = /\.maker form \{[^}]*minmax\((\d+)px, 1fr\)/.exec(maker);
    assert.ok(min, 'the form is a grid of columns with a minimum width');
    // 18px Verdana: about 155px of text, plus 20px of padding, 6px of border and the select's arrow.
    assert.ok(Number(min[1]) >= 200, `columns are at least 200px, not ${min[1]}px`);
  });
});
