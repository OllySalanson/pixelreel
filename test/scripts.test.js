import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';
import { createReel, titleFromName } from '../scripts/new-reel.mjs';
import { clipFile, DEFAULTS, planClips } from '../scripts/voices.mjs';
import { normalizeReel } from '../src/reel.js';

describe('npm run new', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixelreel-test-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('makes a reel that loads and validates', async () => {
    const file = createReel('my-first-reel', { reelsDir: dir });
    const reel = normalizeReel((await import(pathToFileURL(file).href)).default);
    assert.equal(reel.title, 'My first reel');
    assert.ok(reel.scenes.length >= 1);
    assert.match(readFileSync(file, 'utf8'), /^\/\/ My first reel\n/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'my-first-reel', 'audio', 'manifest.json'), 'utf8')), { clips: [] });
  });

  it('keeps an awkward title safe inside the file', async () => {
    const file = createReel('quotes', { reelsDir: dir, title: "It's a \\ test" });
    const reel = normalizeReel((await import(pathToFileURL(file).href)).default);
    assert.equal(reel.title, "It's a \\ test");
  });

  it('refuses bad or taken names', () => {
    assert.throws(() => createReel('../escape', { reelsDir: dir }), /not a usable reel name/);
    assert.throws(() => createReel(undefined, { reelsDir: dir }), /not a usable reel name/);
    assert.throws(() => createReel('my-first-reel', { reelsDir: dir }), /already exists/);
  });

  it('titles a reel from its name', () => {
    assert.equal(titleFromName('a-b-c'), 'A b c');
  });
});

describe('npm run voices planning', () => {
  const settings = { voice: DEFAULTS.voice, speed: DEFAULTS.speed, lang: DEFAULTS.lang };
  const scenes = [{ say: 'One.' }, { say: 'Two.' }, { say: 'One.' }];

  it('names a clip after its words, voice, speed and language', () => {
    assert.equal(clipFile('One.', settings), clipFile('One.', settings));
    assert.notEqual(clipFile('One.', settings), clipFile('One!', settings));
    assert.notEqual(clipFile('One.', settings), clipFile('One.', { ...settings, voice: 'bf_emma' }));
    assert.notEqual(clipFile('One.', settings), clipFile('One.', { ...settings, speed: 1 }));
    assert.match(clipFile('One.', settings), /^[0-9a-f]{16}\.mp3$/);
  });

  it('records each distinct line once, the first time', () => {
    const { clips, todo, stale } = planClips(scenes, settings);
    assert.deepEqual(clips.map((c) => c.text), ['One.', 'Two.']);
    assert.equal(todo.length, 2);
    assert.deepEqual(stale, []);
  });

  it('keeps unchanged clips, records changed lines and drops unused files', () => {
    const one = clipFile('One.', settings), two = clipFile('Two.', settings);
    const manifest = { clips: [{ text: 'One.', file: one, seconds: 1.2 }, { text: 'Two.', file: two, seconds: 2 }] };
    const changed = [{ say: 'One.' }, { say: 'Three.' }];
    const { clips, todo, stale } = planClips(changed, settings, { manifest, existing: [one, two, 'manifest.json'] });
    assert.deepEqual(clips.map((c) => [c.text, c.seconds]), [['One.', 1.2], ['Three.', 0]]);
    assert.deepEqual(todo.map((c) => c.text), ['Three.']);
    assert.deepEqual(stale, [two]);
  });

  it('records again when the file has gone missing, or with --all', () => {
    const one = clipFile('One.', settings);
    const manifest = { clips: [{ text: 'One.', file: one, seconds: 1.2 }] };
    assert.equal(planClips([{ say: 'One.' }], settings, { manifest, existing: [] }).todo.length, 1);
    assert.equal(planClips([{ say: 'One.' }], settings, { manifest, existing: [one], all: true }).todo.length, 1);
  });

  it('the example reel manifest lists exactly the clips on disk', () => {
    const audio = new URL('../reels/what-is-pixelreel/audio/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', audio), 'utf8'));
    const files = readdirSync(audio).filter((f) => f.endsWith('.mp3')).sort();
    assert.deepEqual(manifest.clips.map((c) => c.file).sort(), files);
  });
});
