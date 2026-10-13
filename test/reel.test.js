import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { CAPTION_STYLES, clipLookup, defaultDraw, normalizeReel, REEL_NAME, ReelError } from '../src/reel.js';
import { fakeContext } from './fake-canvas.js';
import example from '../reels/what-is-pixelreel/reel.js';

const scene = (extra = {}) => ({ title: 'A', caption: 'Read this.', ...extra });

describe('normalizeReel', () => {
  it('fills in defaults', () => {
    const reel = normalizeReel({ title: ' My reel ', scenes: [scene()] });
    assert.equal(reel.title, 'My reel');
    assert.match(reel.intro, /Sound will start/);
    assert.equal(reel.note, '');
    assert.deepEqual(reel.images, {});
    assert.equal(reel.scenes[0].say, 'Read this.', 'with no say, the caption is read aloud');
    assert.equal(reel.scenes[0].draw, defaultDraw);
  });

  it('keeps say and draw when given', () => {
    const draw = () => {};
    const reel = normalizeReel({ title: 'T', scenes: [scene({ say: '  Spoken.  ', draw })] });
    assert.equal(reel.scenes[0].say, 'Spoken.');
    assert.equal(reel.scenes[0].draw, draw);
  });

  it('puts the reel folder in front of relative picture paths only', () => {
    const reel = normalizeReel(
      { title: 'T', images: { a: 'images/a.png', b: '/abs.png', c: 'https://example.com/c.png', d: 'data:image/png;base64,AA' }, scenes: [scene()] },
      { base: 'reels/x/' }
    );
    assert.deepEqual(reel.images, { a: 'reels/x/images/a.png', b: '/abs.png', c: 'https://example.com/c.png', d: 'data:image/png;base64,AA' });
  });

  it('lists every problem at once', () => {
    let err;
    try {
      normalizeReel({ scenes: [scene(), { title: '', caption: 'x', draw: 'nope' }, null, scene({ say: '' })], images: { a: 3 } });
    } catch (e) { err = e; }
    assert.ok(err instanceof ReelError);
    assert.deepEqual(err.problems, [
      'title: give the reel a title',
      'images.a: must be a path to a picture',
      'scene 2: needs a title',
      'scene 2: draw must be a function draw(t, px)',
      'scene 3: must be an object',
      'scene 4: say must be text (or leave it out to read the caption)'
    ]);
    assert.match(err.message, /^This reel has problems:\n- title/);
  });

  it('cuts between scenes with plain captions unless asked otherwise', () => {
    const reel = normalizeReel({ title: 'T', scenes: [scene()] });
    assert.equal(reel.transition, 'cut');
    assert.equal(reel.captions, 'plain');
    assert.deepEqual([reel.scenes[0].transition, reel.scenes[0].captions], ['cut', 'plain']);
  });

  it('lets each scene override the reel\'s transition and captions', () => {
    const reel = normalizeReel({
      title: 'T', transition: 'dissolve', captions: 'typewriter',
      scenes: [scene(), scene({ transition: 'iris', captions: 'plain' })]
    });
    assert.deepEqual(reel.scenes.map((s) => [s.transition, s.captions]), [['dissolve', 'typewriter'], ['iris', 'plain']]);
    assert.deepEqual(CAPTION_STYLES, ['plain', 'typewriter']);
  });

  it('names the transitions and caption styles it knows when given another', () => {
    let err;
    try {
      normalizeReel({ title: 'T', transition: 'spin', captions: 'karaoke', scenes: [scene({ transition: 'zoom', captions: 'loud' })] });
    } catch (e) { err = e; }
    assert.deepEqual(err.problems, [
      "transition: must be one of 'cut', 'fade', 'dissolve', 'wipe', 'slide', 'blinds', 'iris', 'flash', 'star'",
      "captions: must be one of 'plain', 'typewriter'",
      "scene 1: transition must be one of 'cut', 'fade', 'dissolve', 'wipe', 'slide', 'blinds', 'iris', 'flash', 'star'",
      "scene 1: captions must be one of 'plain', 'typewriter'"
    ]);
  });

  it('turns a ready-made picture into the scene\'s drawing', () => {
    const reel = normalizeReel({ title: 'T', scenes: [scene({ picture: { type: 'big', text: 'WOW' } })] });
    const g = fakeContext();
    reel.scenes[0].draw(2, createKit(g));
    assert.ok(g.texts.some((x) => x.str === 'WOW'));
  });

  it('checks pictures, scene by scene', () => {
    let err;
    try {
      normalizeReel({
        title: 'T', images: { cat: 'cat.png' },
        scenes: [
          scene({ picture: { type: 'list' } }),
          scene({ picture: { type: 'image', name: 'dog' } }),
          scene({ picture: { type: 'big', text: 'X' }, draw() {} }),
          scene({ picture: { type: 'image', name: 'cat' } })
        ]
      });
    } catch (e) { err = e; }
    assert.deepEqual(err.problems, [
      'scene 1: picture.items is needed for a list picture',
      "scene 2: picture.name must name one of the reel's images (cat)",
      'scene 3: give it draw or picture, not both'
    ]);
  });

  it('rejects a reel with no scenes or no object at all', () => {
    assert.throws(() => normalizeReel({ title: 'T', scenes: [] }), /at least one scene/);
    assert.throws(() => normalizeReel({ title: 'T' }), /at least one scene/);
    assert.throws(() => normalizeReel(undefined), /export an object/);
  });
});

describe('clipLookup', () => {
  const reel = normalizeReel({ title: 'T', scenes: [scene({ say: 'One.' }), scene({ say: 'Two.' }), scene({ say: 'Three.' })] });

  it('matches clips to scenes by their words, not their position', () => {
    const find = clipLookup({ clips: [{ text: 'Two.', file: 'b.mp3', seconds: 2.5 }, { text: 'One.', file: 'a.mp3', seconds: '1.5' }] }, 'reels/x/audio/');
    assert.deepEqual(find(reel.scenes[0]), { url: 'reels/x/audio/a.mp3', seconds: 1.5 });
    assert.deepEqual(find(reel.scenes[1]), { url: 'reels/x/audio/b.mp3', seconds: 2.5 });
    assert.equal(find(reel.scenes[2]), null, 'a line with no recording has no clip');
  });

  it('copes with no manifest or a damaged one', () => {
    assert.equal(clipLookup(null)(reel.scenes[0]), null);
    assert.equal(clipLookup({ clips: [null, { text: 'One.' }, { file: 'x.mp3' }] })(reel.scenes[0]), null);
  });
});

describe('the example reel', () => {
  const reel = normalizeReel(example, { base: 'reels/what-is-pixelreel/' });
  const manifest = JSON.parse(readFileSync(new URL('../reels/what-is-pixelreel/audio/manifest.json', import.meta.url), 'utf8'));

  it('is a valid reel with a picture for every scene', () => {
    assert.ok(reel.scenes.length >= 6);
    for (const s of reel.scenes) assert.notEqual(s.draw, defaultDraw, `${s.title} draws its own picture`);
  });

  it('has an up-to-date recording for every scene', () => {
    const find = clipLookup(manifest, 'audio/');
    for (const s of reel.scenes) {
      const clip = find(s);
      assert.ok(clip, `"${s.title}" has a recording (run npm run voices what-is-pixelreel)`);
      assert.ok(clip.seconds > 2);
      assert.ok(readFileSync(new URL('../reels/what-is-pixelreel/' + clip.url, import.meta.url)).length > 1000);
    }
  });

  it('keeps its folder name a valid reel name', () => {
    assert.ok(REEL_NAME.test('what-is-pixelreel'));
    assert.ok(!REEL_NAME.test('../secret'));
    assert.ok(!REEL_NAME.test('Has Spaces'));
  });
});
