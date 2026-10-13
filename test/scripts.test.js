import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';
import { checkReel } from '../scripts/check-reel.mjs';
import { parseScript, plainWords, reelSource } from '../scripts/from-script.mjs';
import { createReel, titleFromName } from '../scripts/new-reel.mjs';
import { clipFile, DEFAULTS, findFfmpeg, main as recordVoices, planClips } from '../scripts/voices.mjs';
import { normalizeReel } from '../src/reel.js';

describe('npm run new', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixelreel-test-'));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('makes a reel that loads and validates', async () => {
    const { file } = createReel('my-first-reel', { reelsDir: dir });
    const reel = normalizeReel((await import(pathToFileURL(file).href)).default);
    assert.equal(reel.title, 'My first reel');
    assert.ok(reel.scenes.length >= 1);
    assert.match(readFileSync(file, 'utf8'), /^\/\/ My first reel\n/);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'my-first-reel', 'audio', 'manifest.json'), 'utf8')), { clips: [] });
  });

  it('keeps an awkward title safe inside the file', async () => {
    const { file } = createReel('quotes', { reelsDir: dir, title: "It's a \\ test" });
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

  it('makes a reel from a Markdown script', async () => {
    const { file, warnings } = createReel('from-notes', { reelsDir: dir, script: SCRIPT, from: 'notes.md' });
    assert.deepEqual(warnings, []);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /^\/\/ Tea, explained\n\/\/ Made with npm run new from notes\.md\.\n/);
    const reel = normalizeReel((await import(pathToFileURL(file).href)).default);
    assert.deepEqual(reel.scenes.map((s) => s.title), ['Tea, explained', 'Picking', 'Brewing', 'The kettle chat', 'Questions?']);
  });

  it('will not make a reel from a script with no scenes', () => {
    assert.throws(() => createReel('empty-script', { reelsDir: dir, script: 'just words' }), /no scenes/);
  });
});

const SCRIPT = `# Tea, explained

How a leaf becomes a cup, in four short scenes.

## Picking

Only the top two leaves and a bud are picked.

> First, the picking. Only the top two leaves and a bud are taken from each bush.

- Two leaves
- One **bud**
- No [stalks](https://example.com/stalks)

## Brewing

\`\`\`sh
kettle --boil
steep --minutes 3
\`\`\`

## The kettle chat

\`\`\`chat
Kettle: Ready when you are.
You: Born ready.
\`\`\`

## Questions?
`;

describe('reels from a script', () => {
  const { reel, warnings } = parseScript(SCRIPT);

  it('opens with a title scene, said over the intro', () => {
    assert.equal(reel.title, 'Tea, explained');
    assert.deepEqual(reel.scenes[0], {
      title: 'Tea, explained',
      caption: 'How a leaf becomes a cup, in four short scenes.',
      say: 'How a leaf becomes a cup, in four short scenes.',
      picture: { type: 'title', text: 'Tea, explained', sub: 'How a leaf becomes a cup, in four short scenes.' }
    });
    assert.deepEqual(warnings, []);
  });

  it('turns paragraphs, quotes, lists and code blocks into captions, narration and pictures', () => {
    const [, picking, brewing, chat, questions] = reel.scenes;
    assert.equal(picking.caption, 'Only the top two leaves and a bud are picked.');
    assert.equal(picking.say, 'First, the picking. Only the top two leaves and a bud are taken from each bush.');
    assert.deepEqual(picking.picture, { type: 'list', items: ['Two leaves', 'One bud', 'No stalks'] });
    assert.deepEqual(brewing.picture, { type: 'terminal', lines: ['$ kettle --boil', '$ steep --minutes 3'] });
    assert.equal(brewing.say, 'Brewing.');
    assert.deepEqual(chat.picture.messages, [{ from: 'Kettle', text: 'Ready when you are.' }, { from: 'You', text: 'Born ready.' }]);
    assert.deepEqual(questions.picture, { type: 'big', text: 'Questions?' });
  });

  it('reads release notes as they come', () => {
    const notes = parseScript([
      '## What\'s Changed', '* Dark mode by @sam in https://github.com/o/r/pull/12', '* Faster start', '',
      '## New Contributors', '* @kim made their first contribution in https://github.com/o/r/pull/13', '',
      '**Full Changelog**: https://github.com/o/r/compare/v1...v2'
    ].join('\n'), { title: 'Version 2' });
    assert.equal(notes.reel.title, 'Version 2');
    assert.deepEqual(notes.reel.scenes[0].picture, { type: 'title', text: 'Version 2' }, 'an opening title card');
    assert.deepEqual(notes.reel.scenes[1].picture.items, ['Dark mode', 'Faster start']);
    assert.equal(notes.reel.scenes[1].say, "What's Changed. Dark mode. Faster start.");
    assert.equal(notes.reel.scenes[1].caption, "What's Changed");
    assert.deepEqual(notes.reel.scenes[2].picture.items, ['kim made their first contribution']);
    assert.equal(notes.reel.scenes[2].caption, 'New Contributors', 'the bare "Full Changelog" link is left out');
    assert.doesNotThrow(() => normalizeReel(notes.reel));
  });

  it('numbers ordered lists, titles code and says what it left out', () => {
    const { reel: r, warnings: w } = parseScript('- stray\n## Steps\n1. One\n2. Two\n```js reel.js\nlet a = 1;\n```\n## Code\n```py\nprint(1)\n```\n```sh\nls\n```');
    assert.deepEqual(r.scenes[0].picture, { type: 'list', items: ['One', 'Two'], numbered: true });
    assert.deepEqual(r.scenes[1].picture, { type: 'code', title: 'example.py', lines: ['print(1)'] });
    assert.deepEqual(w, ['a list before the first scene was left out', 'scene "Steps" has more than one picture; it shows the first',
      'scene "Code" has more than one picture; it shows the first']);
  });

  it('cleans links, credits, addresses and emphasis out of the words', () => {
    assert.equal(plainWords('See [the docs](https://x.y) or https://x.y/z, **now** by @someone in https://x.y/1'), 'See the docs or now');
    assert.equal(plainWords('An _emphasised_ word and a `code` word'), 'An emphasised word and a code word');
  });

  it('writes tidy JavaScript that loads back as the same reel', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pixelreel-src-')), 'reel.js');
    writeFileSync(file, reelSource(reel, { from: 'notes.md' }));
    const back = (await import(pathToFileURL(file).href)).default;
    assert.deepEqual(back, reel);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /\n {6}picture: \{ type: 'big', text: 'Questions\?' \}\n/);
    assert.match(reelSource({ title: "It's", scenes: [] }), /title: "It's"/, 'apostrophes read naturally');
    assert.ok(text.split('\n').every((l) => l.length <= 120), 'no line runs off the screen');
    rmSync(dirname(file), { recursive: true, force: true });
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

  it('keeps recordings someone made themselves, even with --all, and never clears them away', () => {
    const one = clipFile('One.', settings);
    const manifest = { clips: [{ text: 'One.', file: one, seconds: 1.2 }, { text: 'Two.', file: 'my-take.mp3', seconds: 2.5 }] };
    const existing = [one, 'my-take.mp3', 'outtake.mp3', 'manifest.json'];
    const { clips, todo, stale } = planClips([{ say: 'One.' }, { say: 'Two.' }], settings, { manifest, existing, all: true });
    assert.deepEqual(clips.map((c) => [c.text, c.file]), [['One.', one], ['Two.', 'my-take.mp3']]);
    assert.deepEqual(todo.map((c) => c.text), ['One.']);
    assert.deepEqual(stale, [], 'files it did not make are left alone');
    const unused = planClips([{ say: 'Three.' }], settings, { manifest, existing });
    assert.deepEqual(unused.stale, [one]);
  });

  it('the example reel manifest lists exactly the clips on disk', () => {
    const audio = new URL('../reels/what-is-pixelreel/audio/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', audio), 'utf8'));
    const files = readdirSync(audio).filter((f) => f.endsWith('.mp3')).sort();
    assert.deepEqual(manifest.clips.map((c) => c.file).sort(), files);
  });
});

// A pretend speech engine: reads the words on stdin and writes a WAV of 50 ms per character.
const FAKE_TTS = `import { readFileSync, writeFileSync } from 'node:fs';
const text = readFileSync(0, 'utf8'), rate = 8000, n = Math.round(rate * text.length * 0.05);
const b = Buffer.alloc(44 + n * 2);
b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
b.write('data', 36); b.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 6000), 44 + i * 2);
writeFileSync(process.argv[2], b);
`;

let ffmpeg = null;
try { ffmpeg = findFfmpeg(); } catch { /* the test below is skipped */ }

describe('npm run voices --command', { skip: !ffmpeg && 'needs ffmpeg' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixelreel-voices-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const reel = join(dir, 'reel');
  mkdirSync(reel);
  writeFileSync(join(reel, 'reel.js'), `export default { title: 'T', scenes: [
    { title: 'A', caption: 'One.', say: 'Hello there.' }, { title: 'B', caption: 'Two.', say: 'Twenty characters!!!' }] };\n`);
  writeFileSync(join(dir, 'tts.mjs'), FAKE_TTS);
  const command = `node "${join(dir, 'tts.mjs')}" {out}`;
  const quiet = { log: () => {} };
  const manifest = () => JSON.parse(readFileSync(join(reel, 'audio', 'manifest.json'), 'utf8'));

  it('records every line with any speech engine that writes an audio file', async () => {
    await recordVoices([reel, '--command', command], quiet);
    const m = manifest();
    assert.equal(m.voice, `command: ${command}`);
    assert.deepEqual(m.clips.map((c) => [c.text, c.seconds]), [['Hello there.', 0.6], ['Twenty characters!!!', 1]]);
    for (const c of m.clips) assert.ok(readFileSync(join(reel, 'audio', c.file)).length > 500, 'an MP3 for each line');
  });

  it('records nothing again until the words or the command change', async () => {
    const before = manifest();
    await recordVoices([reel, '--command', command], quiet);
    assert.deepEqual(manifest(), before);
    await recordVoices([reel, '--command', command + ' '], quiet);
    assert.deepEqual(manifest(), before, 'spaces around the command do not count');
    await recordVoices([reel, '--command', `${command} --louder`], quiet);
    assert.notDeepEqual(manifest().clips.map((c) => c.file), before.clips.map((c) => c.file));
    assert.equal(readdirSync(join(reel, 'audio')).filter((f) => f.endsWith('.mp3')).length, 2, 'old clips are cleared away');
  });

  it('insists on {out}, and says when the engine fails', async () => {
    await assert.rejects(recordVoices([reel, '--command', 'say hello'], quiet), /--command needs \{out\}/);
    const before = manifest();
    await assert.rejects(recordVoices([reel, '--all', '--command', 'node -e "process.exit(3)" {out}'], quiet), /exit code 3/);
    assert.deepEqual(manifest().clips, before.clips, 'a failed run keeps the recordings it had');
  });
});

describe('npm run check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixelreel-check-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const reel = (name, source) => {
    mkdirSync(join(dir, name, 'audio'), { recursive: true });
    writeFileSync(join(dir, name, 'reel.js'), source);
    return join(dir, name);
  };

  it('passes the example reel, recordings and all', async () => {
    const { ok, report } = await checkReel(fileURLToPath(new URL('../reels/what-is-pixelreel', import.meta.url)), { recorded: true });
    assert.equal(ok, true);
    assert.match(report[0], /"What is pixelreel\?", 8 scenes, about 1:\d\d\./);
    assert.equal(report[1], '  Every scene has an up-to-date recording.');
  });

  it('lists the scenes still waiting for a recording, failing only with --recorded', async () => {
    const d = reel('unrecorded', "export default { title: 'T', scenes: [{ title: 'One', caption: 'Hi.' }, { title: 'Two', caption: 'Bye.' }] };\n");
    const loose = await checkReel(d);
    assert.equal(loose.ok, true);
    assert.match(loose.report[1], /2 without an up-to-date recording, so the browser's voice reads them: 1\. One, 2\. Two\./);
    assert.match(loose.report[2], /npm run voices unrecorded/);
    assert.equal((await checkReel(d, { recorded: true })).ok, false);
  });

  it('says what is wrong with a broken reel, and a missing picture', async () => {
    const broken = await checkReel(reel('broken', "export default { title: 'T', scenes: [{ title: 'One' }] };\n"));
    assert.equal(broken.ok, false);
    assert.match(broken.report[0], /this reel has problems:\n {2}- scene 1: needs a caption/);
    const pictures = await checkReel(reel('pictures', "export default { title: 'T', images: { cat: 'cat.png' }, scenes: [{ title: 'One', caption: 'Hi.' }] };\n"));
    assert.equal(pictures.ok, false);
    assert.match(pictures.report.join('\n'), /picture "cat" is missing: there is no cat\.png/);
    assert.equal((await checkReel(join(dir, 'nothing-here'))).ok, false);
  });
});
