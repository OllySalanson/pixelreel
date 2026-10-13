import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { CAPTION_STYLES, clipLookup, defaultDraw, normalizeReel, REEL_NAME, ReelError } from '../src/reel.js';
import { coverage, fakeContext } from './fake-canvas.js';

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

const root = new URL('../reels/', import.meta.url);
const names = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const reels = await Promise.all(names.map(async (name) => {
  const reel = normalizeReel((await import(new URL(`${name}/reel.js`, root).href)).default, { base: `reels/${name}/` });
  const manifest = JSON.parse(readFileSync(new URL(`${name}/audio/manifest.json`, root), 'utf8'));
  return { name, reel, manifest };
}));

describe('the reels in reels/', () => {
  it('includes the showreel and the example', () => {
    assert.ok(names.includes('showreel') && names.includes('what-is-pixelreel'));
  });

  it('plays the reel named in index.html when there is no ?reel=', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.ok(names.includes(/data-reel="([^"]+)"/.exec(html)[1]));
  });

  for (const { name, reel, manifest } of reels) {
    it(`${name}: valid, with a name fit for an address and a picture for every scene`, () => {
      assert.ok(REEL_NAME.test(name));
      assert.ok(reel.scenes.length >= 6);
      for (const s of reel.scenes) assert.notEqual(s.draw, defaultDraw, `${s.title} draws its own picture`);
    });

    it(`${name}: an up-to-date recording for every scene, and no stray clips`, () => {
      const find = clipLookup(manifest, 'audio/');
      for (const s of reel.scenes) {
        const clip = find(s);
        assert.ok(clip, `"${s.title}" has a recording (run npm run voices ${name})`);
        assert.ok(clip.seconds > 2);
        assert.ok(readFileSync(new URL(`${name}/${clip.url}`, root)).length > 1000);
      }
      const files = readdirSync(new URL(`${name}/audio/`, root)).filter((f) => f.endsWith('.mp3')).sort();
      assert.deepEqual(manifest.clips.map((c) => c.file).sort(), files);
    });

    it(`${name}: every scene draws from start to finish without a hitch`, () => {
      const find = clipLookup(manifest, '');
      reel.scenes.forEach((s, i) => {
        const g = fakeContext(), px = createKit(g);
        const seconds = (find(s)?.seconds ?? 10) + 3;
        for (let t = 0; t <= seconds; t += 0.37) s.draw(t, px, s);
        assert.ok(g.rects.length > 0, `scene ${i + 1} draws something`);
        assert.equal(g.depth, 0, `scene ${i + 1} restores everything it changes`);
      });
    });
  }

  it('showreel: the stopwatch hand never sweeps through its readout', () => {
    const { reel } = reels.find((r) => r.name === 'showreel');
    const scene = reel.scenes.find((s) => s.title === 'Make your own');
    for (let t = 0; t <= 8; t += 0.1) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      const readout = g.texts.find((x) => /^0:\d\d$/.test(x.str));
      const w = readout.str.length * 6, box = { x: readout.x - w / 2, y: readout.y, w, h: 12 };
      assert.equal(coverage(g.rects.filter((r) => r.c === '#d63a3a'), box), 0, `the hand stays clear of ${readout.str}`);
    }
  });

  it('showreel: the sleeper\'s z\'s rise clear of the chair and the monitor', () => {
    const { reel } = reels.find((r) => r.name === 'showreel');
    const scene = reel.scenes.find((s) => s.title === 'Nobody reads the docs');
    for (let t = 0; t <= 12; t += 0.05) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      const monitor = g.rects.find((r) => r.c === '#171717' && r.w === 62 && r.h === 40);
      const chair = g.rects.find((r) => r.c === '#3b2c3f');
      const zs = g.texts.filter((x) => x.str === 'z');
      assert.equal(zs.length, 3);
      for (const z of zs) {
        const size = parseInt(z.font, 10), clear = z.x + size / 2 <= monitor.x - 1 || z.y + size <= monitor.y;
        assert.ok(clear, `a z at (${z.x.toFixed(1)}, ${z.y.toFixed(1)}) is over the monitor at ${t.toFixed(2)}s`);
        assert.ok(z.y + size <= chair.y, `a z at (${z.x.toFixed(1)}, ${z.y.toFixed(1)}) is over the sleeper at ${t.toFixed(2)}s`);
      }
    }
  });

  it('showreel: the laptop\'s file names fit on its screen without touching', () => {
    const { reel } = reels.find((r) => r.name === 'showreel');
    const scene = reel.scenes.find((s) => s.title === 'Put it anywhere');
    const g = fakeContext(), px = createKit(g);
    // Orange Kid widths at 8px, measured in the browser (the fake canvas's guess is too wide here)
    const real = { 'index.html': 26.3, 'reel.js': 15.7, 'audio/': 17 };
    const guess = g.measureText.bind(g);
    g.measureText = (str) => (str in real && parseInt(g.font, 10) === 8 ? { width: real[str] } : guess(str));
    scene.draw(0.5, px, scene);
    const screen = g.rects.find((r) => r.c === '#0d1117' && r.w === 76 && r.h === 42);
    const names = g.texts.filter((x) => x.str in real).map((x) => ({ str: x.str, l: x.x - real[x.str] / 2, r: x.x + real[x.str] / 2 }));
    assert.equal(names.length, 3);
    for (const n of names) {
      assert.ok(n.l >= screen.x + 1 && n.r <= screen.x + screen.w - 1, `${n.str} spans ${n.l.toFixed(1)}-${n.r.toFixed(1)}, off the screen`);
    }
    names.slice(1).forEach((n, i) => assert.ok(n.l - names[i].r >= 3, `${names[i].str} and ${n.str} are too close`));
  });

  it('showreel: the laptop waveform stays between its title bar and OFFLINE', () => {
    const { reel } = reels.find((r) => r.name === 'showreel');
    const scene = reel.scenes.find((s) => s.title === 'A voice, made at home');
    for (let t = 0; t <= 13; t += 0.05) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      const label = g.texts.find((x) => x.str === 'OFFLINE');
      const bars = g.rects.filter((r) => r.c === '#55d6be' && r.w === 3 && r.x >= 116 && r.x < 204);
      assert.equal(bars.length, 22);
      for (const b of bars) {
        assert.ok(b.y >= 63, `a bar reaches the title bar at ${t.toFixed(2)}s`);
        assert.ok(b.y + b.h <= label.y - 3, `a bar touches OFFLINE at ${t.toFixed(2)}s`);
      }
    }
  });

  it('what-is-pixelreel: the last scene types its steps and says thanks before its words end', () => {
    const { reel, manifest } = reels.find((r) => r.name === 'what-is-pixelreel');
    const scene = reel.scenes.find((s) => s.title === 'Make your own');
    const g = fakeContext(), px = createKit(g);
    scene.draw(clipLookup(manifest, '')(scene).seconds - 0.1, px, scene);
    const said = g.texts.map((x) => x.str);
    for (const line of ['$ npm run new my-reel', '$ edit reels/my-reel/reel.js', '$ npm run voices my-reel']) {
      assert.ok(said.includes(line), `"${line}" is typed out in full`);
    }
    assert.ok(said.includes('THANKS FOR WATCHING'));
  });

  it('what-is-pixelreel: each control lights up as the narrator names it', () => {
    const { reel } = reels.find((r) => r.name === 'what-is-pixelreel');
    const scene = reel.scenes.find((s) => s.title === 'Watch your way');
    // just after "Play,", "pause,", "go back,", "or skip ahead" and "Turn the sound off" in the clip
    for (const [t, named] of [[1.4, 'PLAY'], [1.9, 'PAUSE'], [2.4, 'BACK'], [3.0, 'NEXT'], [4.3, 'SOUND']]) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      const lit = g.texts.filter((x) => x.c === '#202020' && x.y === 49).map((x) => x.str);
      assert.deepEqual(lit, [named], `${named} is the lit control at ${t}s`);
    }
  });

  it('what-is-pixelreel: each part of a scene appears as the narrator names it', () => {
    const { reel } = reels.find((r) => r.name === 'what-is-pixelreel');
    const scene = reel.scenes.find((s) => s.title === 'A reel is a list of scenes');
    // during "four parts", then just after "A title.", "A caption,", "The words..." and "And a picture."
    for (const [t, shown] of [[3.6, []], [4.4, ['TITLE']], [5.3, ['TITLE', 'CAPTION']],
      [7.4, ['TITLE', 'CAPTION', 'SAY']], [9.3, ['TITLE', 'CAPTION', 'SAY', 'DRAW']]]) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      const names = g.texts.filter((x) => x.c === '#a52222').map((x) => x.str);
      assert.deepEqual(names, shown, `parts shown at ${t}s`);
    }
  });

  it('what-is-pixelreel: SEND THE LINK appears as the narrator says it', () => {
    const { reel } = reels.find((r) => r.name === 'what-is-pixelreel');
    const scene = reel.scenes.find((s) => s.title === 'Share it anywhere');
    // during "or any other web host,", then just after "and send someone the link" starts
    for (const [t, shown] of [[8.5, false], [9.4, true]]) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      assert.equal(g.texts.some((x) => x.str === 'SEND THE LINK'), shown, `sign shown at ${t}s`);
    }
  });

  it('what-is-pixelreel: the file being sent is named inside the computer screen', () => {
    const { reel } = reels.find((r) => r.name === 'what-is-pixelreel');
    const scene = reel.scenes.find((s) => s.title === 'Share it anywhere');
    const names = ['index.html', 'reel.js', 'audio'];
    // the screen inside the computer's black frame
    const [sx, sy, sw, sh] = [43, 121, 66, 36];
    for (let t = 0; t < 6; t += 0.05) {
      const g = fakeContext(), px = createKit(g);
      scene.draw(t, px, scene);
      const labels = g.texts.filter((x) => names.includes(x.str));
      assert.equal(labels.length, 1, `one file named at ${t.toFixed(2)}s`);
      const [{ str, x, y }] = labels, w = px.textW(str, 12);
      assert.ok(x - w / 2 >= sx && x + w / 2 <= sx + sw && y >= sy && y + 12 <= sy + sh,
        `${str} at (${x}, ${y.toFixed(1)}) stays inside the screen at ${t.toFixed(2)}s`);
    }
  });

  it('turns away a reel name that could escape the folder', () => {
    assert.ok(!REEL_NAME.test('../secret'));
    assert.ok(!REEL_NAME.test('Has Spaces'));
  });
});
