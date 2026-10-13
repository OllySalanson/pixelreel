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
