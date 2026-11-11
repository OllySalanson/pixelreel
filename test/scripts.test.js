import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';
import { checkReel } from '../scripts/check-reel.mjs';
import { parseScript, plainWords, reelSource } from '../scripts/from-script.mjs';
import { createReel, titleFromName } from '../scripts/new-reel.mjs';
import { clipFile, ENGINES, findFfmpeg, main as recordVoices, narrator, planClips } from '../scripts/voices.mjs';
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
  const settings = narrator({});
  const scenes = [{ say: 'One.' }, { say: 'Two.' }, { say: 'One.' }];

  it('names a clip after its words and its narrator', () => {
    assert.equal(clipFile('One.', settings), clipFile('One.', settings));
    assert.notEqual(clipFile('One.', settings), clipFile('One!', settings));
    assert.notEqual(clipFile('One.', settings), clipFile('One.', { ...settings, voice: 'stuart_bell' }));
    const kokoro = narrator({ engine: 'kokoro' });
    assert.notEqual(clipFile('One.', kokoro), clipFile('One.', { ...kokoro, voice: 'bf_emma' }));
    assert.notEqual(clipFile('One.', kokoro), clipFile('One.', { ...kokoro, speed: 1 }));
    assert.notEqual(clipFile('One.', settings), clipFile('One.', kokoro));
    assert.match(clipFile('One.', settings), /^[0-9a-f]{16}\.mp3$/);
  });

  it('gives Kokoro clips the names they always had, so recorded reels stay up to date', () => {
    const text = "Let's be honest. Nobody reads the docs. Not the read me, not the wiki, and definitely not the change log. So here's a cartoon instead.";
    assert.equal(clipFile(text, narrator({ engine: 'kokoro' })), 'bf8ee0fbe6f303d9.mp3', 'the showreel\'s first clip');
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

});

describe('npm run voices narrator', () => {
  const george = { voice: 'bm_george', speed: 0.92, lang: 'en-gb', clips: [] };

  it('narrates a new reel with Pocket TTS, voice peter_yearsley', () => {
    assert.deepEqual(narrator({}), { engine: 'pocket', voice: 'peter_yearsley' });
    assert.deepEqual(narrator({ voice: 'stuart_bell' }), { engine: 'pocket', voice: 'stuart_bell' });
  });

  it('picks Kokoro for a Kokoro voice name, or when asked', () => {
    assert.deepEqual(narrator({ voice: 'bf_emma', speed: '1' }), { engine: 'kokoro', voice: 'bf_emma', speed: 1, lang: 'en-gb' });
    const { voice, speed, lang } = ENGINES.kokoro;
    assert.deepEqual(narrator({ engine: 'kokoro' }), { engine: 'kokoro', voice, speed, lang });
  });

  it('keeps the narrator a reel was recorded with, unless told otherwise', () => {
    assert.deepEqual(narrator({}, george), { engine: 'kokoro', voice: 'bm_george', speed: 0.92, lang: 'en-gb' }, 'a manifest from before Pocket TTS');
    assert.deepEqual(narrator({ speed: '1' }, george), { engine: 'kokoro', voice: 'bm_george', speed: 1, lang: 'en-gb' });
    assert.deepEqual(narrator({}, { engine: 'pocket', voice: 'charles', clips: [] }), { engine: 'pocket', voice: 'charles' });
    assert.deepEqual(narrator({ engine: 'pocket' }, george), { engine: 'pocket', voice: 'peter_yearsley' });
    assert.deepEqual(narrator({}, { voice: 'command: say -o {out}', speed: 1, lang: 'any', clips: [] }), narrator({}), 'a command is never run from a manifest');
  });

  it('says what is wrong with a mixed-up choice', () => {
    assert.throws(() => narrator({ speed: '1' }), /Pocket TTS has no --speed/);
    assert.throws(() => narrator({ engine: 'piper' }), /--engine must be pocket or kokoro/);
    assert.throws(() => narrator({ engine: 'kokoro', speed: 'fast' }), /--speed must be a number/);
    assert.throws(() => narrator({ command: 'say {out}', voice: 'bm_george' }), /cannot go with --engine/);
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

// A pretend Python: given pocket_speak.py or kokoro_tts.py and a job on stdin, it notes the job in
// jobs.jsonl and answers like the real script, with a WAV of 50 ms per character for each line.
// It fails at once for the voice "nobody".
const FAKE_PYTHON = `#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
const job = JSON.parse(readFileSync(0, 'utf8'));
appendFileSync(join(dirname(process.argv[1]), 'jobs.jsonl'), JSON.stringify({ script: basename(process.argv[2]), ...job }) + '\\n');
if (job.voice === 'nobody') process.exit(1);
for (const { text, wav } of job.lines) {
  const rate = 8000, n = Math.round(rate * text.length * 0.05), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 6000), 44 + i * 2);
  writeFileSync(wav, b);
  console.log(JSON.stringify({ wav, seconds: n / rate }));
}
`;

describe('npm run voices with Pocket TTS and Kokoro', { skip: (!ffmpeg && 'needs ffmpeg') || (process.platform === 'win32' && 'needs a script it can run directly') }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixelreel-engines-'));
  const python = join(dir, 'python.mjs'), jobsFile = join(dir, 'jobs.jsonl');
  const before = process.env.PIXELREEL_PYTHON;
  after(() => {
    if (before === undefined) delete process.env.PIXELREEL_PYTHON; else process.env.PIXELREEL_PYTHON = before;
    rmSync(dir, { recursive: true, force: true });
  });
  writeFileSync(python, FAKE_PYTHON);
  chmodSync(python, 0o755);
  const reel = join(dir, 'reel');
  mkdirSync(reel);
  writeFileSync(join(reel, 'reel.js'), "export default { title: 'T', scenes: [{ title: 'A', caption: 'One.', say: 'Hello there.' }] };\n");
  const quiet = { log: () => {} };
  const manifest = () => JSON.parse(readFileSync(join(reel, 'audio', 'manifest.json'), 'utf8'));
  const jobs = () => readFileSync(jobsFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

  it('records a new reel with Pocket TTS, then keeps that narrator', async () => {
    process.env.PIXELREEL_PYTHON = python;
    await recordVoices([reel, '--threads', '3'], quiet);
    const [job] = jobs();
    assert.equal(job.script, 'pocket_speak.py');
    assert.deepEqual({ voice: job.voice, threads: job.threads, text: job.lines[0].text }, { voice: 'peter_yearsley', threads: 3, text: 'Hello there.' });
    const m = manifest();
    assert.deepEqual([m.engine, m.voice, m.clips[0].seconds], ['pocket', 'peter_yearsley', 0.6]);
    await recordVoices([reel], quiet);
    assert.equal(jobs().length, 1, 'nothing to record again');
  });

  it('switches to Kokoro when asked, recording again, and stays with it', async () => {
    process.env.PIXELREEL_PYTHON = python;
    await recordVoices([reel, '--voice', 'bm_george'], quiet);
    const job = jobs().at(-1);
    assert.equal(job.script, 'kokoro_tts.py');
    assert.deepEqual([job.voice, job.speed, job.lang], ['bm_george', 0.92, 'en-gb']);
    assert.match(job.model, /kokoro-v1\.0\.onnx$/);
    assert.deepEqual([manifest().engine, readdirSync(join(reel, 'audio')).filter((f) => f.endsWith('.mp3')).length], ['kokoro', 1], 'the Pocket TTS clip is cleared away');
    await recordVoices([reel], quiet);
    assert.equal(jobs().length, 2);
  });

  it('goes on naming the old narrator when a new one fails before recording anything', async () => {
    process.env.PIXELREEL_PYTHON = python;
    const before = manifest();
    await assert.rejects(recordVoices([reel, '--voice', 'nobody'], quiet), /Pocket TTS stopped with exit code 1/);
    assert.deepEqual(manifest(), before);
    await recordVoices([reel], quiet);
    assert.equal(jobs().length, 3, 'only the failed attempt ran');
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
