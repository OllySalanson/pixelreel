import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { after, describe, it } from 'node:test';
import { bundle } from '../scripts/bundle.mjs';
import { onePage, pageHtml } from '../scripts/page.mjs';
import { GAP, SKILL_ZIP, skillFiles, skillZip } from '../scripts/skill.mjs';
import { unzip, zip } from '../scripts/zip.mjs';
import { REEL_FORMAT } from '../src/format.js';
import { PICTURES } from '../src/pictures.js';
import { crc32 } from '../src/png.js';

const src = (name) => new URL(`../src/${name}`, import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-page-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const tea = { format: REEL_FORMAT, title: 'Tea', scenes: [{ title: 'Kettle', caption: 'Boil it. </script> stays words.', picture: { type: 'big', text: 'BOIL' } }] };

/** The JSON in the page's <script type="application/json" id="..."> element. */
const pageJson = (page, id) => JSON.parse(new RegExp(`<script type="application/json" id="${id}">(.*?)</script>`, 's').exec(page)[1]);

describe('bundle', () => {
  it('joins modules into one script that works as they do', () => {
    const script = bundle([src('format.js')], { run: `result = __m['format.js'].parseReelJson(text).scenes[0].say;` });
    const context = { text: JSON.stringify(tea), result: null };
    runInNewContext(script, context);
    assert.equal(context.result, 'Boil it. </script> stays words.');
    assert.doesNotMatch(script, /^\s*(import|export)\b/m, 'no module syntax is left');
  });

  it('takes each module once, after the ones it needs', () => {
    const script = bundle([src('format.js'), src('reel.js')]);
    const order = [...script.matchAll(/^__m\['([a-z]+\.js)'\]/gm)].map((m) => m[1]);
    assert.deepEqual(order, ['icons.js', 'palette.js', 'pictures.js', 'transitions.js', 'reel.js', 'format.js']);
  });

  it('refuses forms of import and export it does not understand', () => {
    const dir = join(tmp, 'odd');
    mkdirSync(dir);
    writeFileSync(join(dir, 'a.js'), "import * as b from './b.js';\n");
    assert.throws(() => bundle([join(dir, 'a.js')]), /a\.js:1: the bundler only takes "import \{ a, b \} from/);
    writeFileSync(join(dir, 'c.js'), 'export default 3;\n');
    assert.throws(() => bundle([join(dir, 'c.js')]), /c\.js:1: the bundler only takes exported functions/);
  });
});

describe('npm run page', () => {
  it('makes a page that needs no other file', () => {
    assert.match(pageHtml({ reelJson: '{}', title: 'Save $$$ & $& more' }), /<title>Save \$\$\$ &amp; \$&amp; more<\/title>/, 'a title is never read as a pattern');
    const page = pageHtml({ reelJson: JSON.stringify(tea), title: 'Tea - pixelreel' });
    assert.doesNotMatch(page, /\b(src|href)="(?!data:)[^"#]/, 'nothing to fetch');
    assert.doesNotMatch(page, /url\('\.\.\//);
    assert.match(page, /url\('data:font\/woff2;base64,/);
    assert.match(page, /<title>Tea - pixelreel<\/title>/);
    assert.match(page, /<body data-sound="off">/, 'with no recordings, it starts quiet');
    assert.equal((page.match(/<\/script>/g) || []).length, 2, 'the bundled player cannot end its own script early');
  });

  it('carries a reel.json, its pictures and the recordings its scenes use', () => {
    const dir = join(tmp, 'tea');
    mkdirSync(join(dir, 'audio'), { recursive: true });
    writeFileSync(join(dir, 'reel.json'), JSON.stringify({ ...tea, images: { pot: 'pot.png', web: 'https://example.com/a.png' } }));
    writeFileSync(join(dir, 'pot.png'), Buffer.from([137, 80, 78, 71]));
    writeFileSync(join(dir, 'audio', 'a.mp3'), 'ID3');
    writeFileSync(join(dir, 'audio', 'old.mp3'), 'ID3');
    writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ clips: [
      { text: 'Boil it. </script> stays words.', file: 'a.mp3', seconds: 2 },
      { text: 'Words no scene says any more.', file: 'old.mp3', seconds: 1 }
    ] }));
    const page = onePage(dir);
    const reel = pageJson(page, 'reel-data');
    assert.equal(reel.scenes[0].caption, tea.scenes[0].caption, '"</script>" in a caption is kept safe');
    assert.deepEqual(reel.images, { pot: 'data:image/png;base64,iVBORw==', web: 'https://example.com/a.png' });
    assert.deepEqual(pageJson(page, 'reel-audio').clips, [{ text: tea.scenes[0].caption, file: 'data:audio/mpeg;base64,SUQz', seconds: 2 }]);
    assert.match(page, /<body>/, 'with recordings, the sound starts on');
    assert.match(page, /<title>Tea - pixelreel<\/title>/);
  });

  it('only makes pages from reels that hold no code', () => {
    const dir = join(tmp, 'code');
    mkdirSync(dir);
    writeFileSync(join(dir, 'reel.js'), "export default { title: 'T', scenes: [{ title: 'A', caption: 'a' }] };\n");
    assert.throws(() => onePage(dir), /Only a reel\.json, which holds no code, can be made into one page/);
    const bad = join(tmp, 'bad');
    mkdirSync(bad);
    writeFileSync(join(bad, 'reel.json'), JSON.stringify({ ...tea, format: undefined }));
    assert.throws(() => onePage(bad), (err) => err.problems?.[0].startsWith('format: say which format'));
  });
});

describe('zip', () => {
  it('stores files so any unzip tool can open them, and reads them back', () => {
    const files = [{ name: 'a/', data: '' }, { name: 'a/b.txt', data: 'hello' }, { name: 'a/c.bin', data: Uint8Array.of(0, 255) }];
    const back = unzip(zip(files));
    assert.deepEqual(back.map((f) => f.name), ['a/', 'a/b.txt', 'a/c.bin']);
    assert.equal(back[1].data.toString(), 'hello');
    assert.deepEqual([...back[2].data], [0, 255]);
    assert.equal(back[1].crc, crc32(Buffer.from('hello')));
    assert.deepEqual(zip(files), zip(files), 'the same files always make the same bytes');
  });
});

describe('the Claude skill', () => {
  const files = Object.fromEntries(skillFiles().map((f) => [f.name, f.data]));
  const skill = files['pixel-reel/SKILL.md'];

  it('is up to date: run npm run skill after changing the player or the skill', () => {
    assert.ok(readFileSync(SKILL_ZIP).equals(skillZip()), 'skill/pixel-reel.zip is out of date');
  });

  it('is a skill Claude can load', () => {
    const front = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/.exec(skill);
    assert.ok(front, 'SKILL.md starts with a name and a description');
    assert.equal(front[1], 'pixel-reel');
    assert.ok(front[2].length <= 1024, 'the description fits in 1024 characters');
    assert.deepEqual(Object.keys(files), ['pixel-reel/', 'pixel-reel/SKILL.md', 'pixel-reel/example.json', 'pixel-reel/make-page.mjs', 'pixel-reel/template.html']);
  });

  it('documents every ready-made picture, with its fields', () => {
    for (const [type, { fields }] of Object.entries(PICTURES)) {
      const row = new RegExp(`^\\| \`${type}\` \\| (.*) \\|.*\\|$`, 'm').exec(skill);
      assert.ok(row, `SKILL.md has a row for ${type}`);
      for (const [key, want] of Object.entries(fields)) assert.ok(row[1].includes(`\`${key}${want.endsWith('?') ? '?' : ''}\``), `${type} lists ${key}`);
    }
  });

  it('has a template with one gap for the reel', () => {
    assert.equal(files['pixel-reel/template.html'].split(GAP).length, 2);
  });

  it('makes a page from the example, and lists every problem in a bad reel', () => {
    const dir = join(tmp, 'skill');
    mkdirSync(dir);
    for (const [name, data] of Object.entries(files)) if (!name.endsWith('/')) writeFileSync(join(dir, name.split('/')[1]), data);
    const ok = spawnSync(process.execPath, [join(dir, 'make-page.mjs'), join(dir, 'example.json'), join(dir, 'tea.html')], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /^Wrote .*tea\.html: "How to make a cup of tea", 6 scenes, about 0:\d\d\.\n$/);
    const page = readFileSync(join(dir, 'tea.html'), 'utf8');
    assert.deepEqual(pageJson(page, 'reel-data'), JSON.parse(files['pixel-reel/example.json']));
    assert.match(page, /<title>How to make a cup of tea - pixelreel<\/title>/);

    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ format: REEL_FORMAT, title: 'T', colour: 1, scenes: [{ title: 'A', picture: { type: 'big' } }] }));
    const bad = spawnSync(process.execPath, [join(dir, 'make-page.mjs'), join(dir, 'bad.json')], { encoding: 'utf8', cwd: dir });
    assert.equal(bad.status, 1);
    assert.equal(bad.stderr, 'This reel has problems. Fix them all, then run this again:\n' +
      '- colour: a reel has format, title, intro, note, transition, captions, images, scenes, not colour\n' +
      '- scene 1: needs a caption\n- scene 1: picture.text is needed for a big picture\n');
  });
});
