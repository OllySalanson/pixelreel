import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { CLAUDE_ADDRESSES, inRanges, LIMITS, limitProblems, RateLimit } from '../service/limits.mjs';
import { EXAMPLE_REEL, formatGuide, playerHtml } from '../service/mcp.mjs';
import { BusyError, isId, KEEP_DAYS, newId, Reels } from '../service/reels.mjs';
import { reelFromData } from '../src/format.js';
import { ICON_NAMES } from '../src/pictures.js';
import { markdownHtml, SITE_PAGES, SITE_POLICY } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { checkKey, DiskStore, S3Store, signRequest } from '../service/store.mjs';
import { fakeS3 } from './fake-s3.js';
import { ReelError } from '../src/reel.js';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-service-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let stores = 0;
const freshStore = () => new DiskStore(join(tmp, `store-${++stores}`));

const tea = {
  format: 'pixelreel/1',
  title: 'Tea',
  scenes: [
    { title: 'Kettle', caption: 'Boil it.', say: 'Boil the kettle.', picture: { type: 'big', text: 'BOIL' } },
    { title: 'Cup', caption: 'Pour it.', picture: { type: 'icons', items: [{ icon: 'cup', label: 'Tea' }] } }
  ]
};

/** Stands in for npm run voices: a manifest and a small file for each line, each 6 seconds long. */
async function fakeRecord(dir) {
  const reel = JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8'));
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const clips = reel.scenes.map((s, i) => ({ text: s.say ?? s.caption, file: `clip${i}.mp3`, seconds: 6 }));
  clips.forEach((c) => writeFileSync(join(dir, 'audio', c.file), 'ID3'));
  writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ engine: 'pocket', voice: 'peter_yearsley', clips }));
}

/**
 * A stand-in recorder that, like npm run voices, names each recording after its words and
 * leaves alone the lines the folder already has recordings of. `recorded` is told each line it does record.
 */
const thriftyRecord = (recorded = []) => async (dir) => {
  const reel = JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8'));
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const path = join(dir, 'audio', 'manifest.json');
  const had = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).clips.filter((c) => existsSync(join(dir, 'audio', c.file))) : [];
  const clips = reel.scenes.map((s) => {
    const text = s.say ?? s.caption, kept = had.find((c) => c.text === text);
    if (kept) return kept;
    recorded.push(text);
    const file = `${createHash('sha256').update(text).digest('hex').slice(0, 16)}.mp3`;
    writeFileSync(join(dir, 'audio', file), `said: ${text}`);
    return { text, file, seconds: 6 };
  });
  writeFileSync(path, JSON.stringify({ engine: 'pocket', voice: 'peter_yearsley', clips }));
};

const fakeVideo = async (dir, out) => writeFileSync(out, `video of ${JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8')).title}`);

/** Stands in for the card drawer (service/card.mjs, which test/card.test.js tries for real). */
const fakePicture = async (raw) => Buffer.from(`picture of ${raw.title}`);


describe('the store', () => {
  let s3;
  before(async () => { s3 = await fakeS3(); });
  after(() => s3.close());
  const kinds = { 'on disk': freshStore, 'in an S3-style bucket': () => { s3.objects.clear(); return new S3Store(s3.options); } };
  for (const [kind, fresh] of Object.entries(kinds)) {
    it(`keeps bytes under keys, lists and deletes them (${kind})`, async () => {
      const store = fresh();
      await store.put('reels/a/reel.json', '{}');
      await store.put('reels/a/audio/x.mp3', Buffer.from([1, 2, 3]));
      await store.put('reels/a/audio/y.mp3', 'y');
      await store.put('reels/b/reel.json', '{}');
      await store.put('reels/c/reel.json', '{}');
      await store.put('reels/ab/reel.json', '{}');
      assert.equal(String(await store.get('reels/a/reel.json')), '{}');
      assert.equal(await store.size('reels/a/audio/x.mp3'), 3);
      assert.equal(await store.get('reels/a/nothing'), null);
      assert.equal(await store.size('reels/a/nothing'), null);
      assert.deepEqual((await store.list('reels/a')).sort(), ['reels/a/audio/x.mp3', 'reels/a/audio/y.mp3', 'reels/a/reel.json']);
      assert.deepEqual((await store.folders('reels')).sort(), ['a', 'ab', 'b', 'c']);
      await store.remove('reels/a');
      assert.deepEqual(await store.list('reels/a'), []);
      assert.deepEqual((await store.list('reels/ab')), ['reels/ab/reel.json']);
      assert.deepEqual(await store.folders('nowhere'), []);
      await store.remove('nowhere');
    });
  }

  it('tries again when the bucket fails for a moment, and says so when it keeps failing', async () => {
    s3.objects.clear();
    const store = new S3Store(s3.options);
    s3.failNext = 2;
    await store.put('reels/a/reel.json', '{}');
    assert.equal(String(await store.get('reels/a/reel.json')), '{}');
    s3.failNext = 10;
    await assert.rejects(store.get('reels/a/reel.json'), /could not read reels\/a\/reel.json: 503/);
    s3.failNext = 0;
  });

  it('is refused by a bucket that does not know its secret', async () => {
    const store = new S3Store({ ...s3.options, secretKey: 'wrong' });
    await assert.rejects(store.put('reels/a/reel.json', '{}'), /could not save reels\/a\/reel.json: 403/);
  });

  it('signs requests the way AWS documents', () => {
    // the GET Object example in the S3 docs (Authenticating Requests: AWS Signature Version 4)
    const headers = signRequest({
      method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { Range: 'bytes=0-9' }, region: 'us-east-1',
      accessKey: 'AKIAIOSFODNN7EXAMPLE', secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', date: new Date('2013-05-24T00:00:00Z')
    });
    assert.equal(headers.authorization, 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
    assert.equal(headers.host, undefined);
  });

  it('refuses keys that could reach outside it', () => {
    for (const bad of ['../x', 'reels/../../x', '/etc/passwd', 'reels//x', '', 'a\\b', 'reels/./x', '.hidden']) {
      assert.throws(() => checkKey(bad), /is not a key the store takes/, bad);
    }
    assert.equal(checkKey('reels/abc_DEF-1/audio/clip.mp3'), 'reels/abc_DEF-1/audio/clip.mp3');
  });
});

describe('reel ids', () => {
  it('are long and random, so nobody can guess a link', () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.ok(isId(id), id);
    assert.equal(isId('../../etc'), false);
    assert.equal(isId('short'), false);
  });
});

describe('the reels service', () => {
  it('checks a reel, records it in the background, and says when it is ready', async () => {
    let clock = Date.parse('2026-11-22T10:00:00Z');
    const reels = new Reels({ store: freshStore(), record: fakeRecord, video: fakeVideo, now: () => clock });
    const made = await reels.create(tea);
    assert.ok(isId(made.id));
    assert.deepEqual({ ...made, id: '' }, {
      id: '', title: 'Tea', scenes: 2, state: 'recording', seconds: 10,
      created: '2026-11-22T10:00:00.000Z', expires: '2026-12-22T10:00:00.000Z', video: 'none'
    });
    await reels.idle();
    const ready = await reels.status(made.id);
    assert.equal(ready.state, 'ready');
    assert.equal(ready.seconds, 14, 'the length from the recordings, with a 1.2 second pause after each');
    assert.deepEqual((await reels.manifest(made.id)).clips.map((c) => c.text), ['Boil the kettle.', 'Pour it.']);
    const timed = await reels.reel(made.id);
    assert.deepEqual(timed.scenes[1].picture, { type: 'icons', items: [{ icon: 'cup', label: 'Tea' }], start: 0.6, every: 1.4 }, 'its pictures are timed to the recording');
    assert.deepEqual({ ...timed, scenes: [timed.scenes[0], tea.scenes[1]] }, tea, 'and nothing else about it is changed');

    clock += KEEP_DAYS * 86400000;
    assert.equal(await reels.status(made.id), null, 'gone once it expires');
    assert.deepEqual(await reels.sweep(), [made.id]);
    assert.equal(await reels.reel(made.id), null);
  });

  it('says how far the recording has got, line by line, and that a reel behind another is waiting', async () => {
    // the stand-in recorder stops before each line until it is let go, so nothing here depends on how fast the machine is
    const held = [];
    let arrived = () => {};
    const hold = () => new Promise((ok) => { held.push(ok); arrived(); });
    const letGo = async () => {
      while (!held.length) await new Promise((ok) => { arrived = ok; });
      held.shift()();
    };
    const record = async (dir, _log, onLine) => {
      for (let done = 1; done <= 2; done++) {
        await hold();
        onLine(done, 2);
      }
      await hold();
      await fakeRecord(dir);
    };
    const reels = new Reels({ store: freshStore(), record, video: fakeVideo });
    const until = async (id, check) => {
      for (;;) {
        const status = await reels.status(id);
        if (check(status)) return status;
        await new Promise((ok) => setImmediate(ok));
      }
    };
    const first = await reels.create(tea), second = await reels.create(tea);
    assert.equal(first.state, 'recording', 'with nothing else in hand, it is being recorded already');
    assert.equal(second.state, 'queued', 'the one behind it waits its turn');
    assert.equal((await until(first.id, (s) => s.state === 'recording')).recorded, undefined, 'nothing is said until a line is done');
    await letGo();
    assert.deepEqual((({ recorded, lines }) => [recorded, lines])(await until(first.id, (s) => s.recorded === 1)), [1, 2]);
    await letGo();
    assert.equal((await until(first.id, (s) => s.recorded === 2)).state, 'recording');
    assert.equal((await reels.status(second.id)).state, 'queued');
    await letGo();
    const ready = await until(first.id, (s) => s.state === 'ready');
    assert.deepEqual([ready.recorded, ready.lines], [undefined, undefined], 'once it is ready there is nothing left to count');
    for (let i = 0; i < 3; i++) await letGo();
    await reels.idle();
    assert.equal((await reels.status(second.id)).state, 'ready');
  });

  it('records only the lines that changed when a reel improves on an earlier one', async () => {
    const recorded = [], record = thriftyRecord(recorded);
    const store = freshStore();
    const reels = new Reels({ store, record, video: fakeVideo });
    const first = await reels.create(tea);
    await reels.idle();
    assert.deepEqual(recorded, ['Boil the kettle.', 'Pour it.']);

    const changed = { ...tea, scenes: [tea.scenes[0], { ...tea.scenes[1], caption: 'Pour it out.' }, { title: 'Drink', caption: 'Drink it.' }] };
    const second = await reels.create(changed, { improves: first.id });
    assert.equal(second.kept, 1, 'it says how many lines kept their recordings');
    assert.notEqual(second.id, first.id, 'it is a new reel, with a link of its own');
    await reels.idle();
    assert.deepEqual(recorded.slice(2), ['Pour it out.', 'Drink it.'], 'the line that did not change is not recorded again');
    assert.equal((await reels.status(second.id)).state, 'ready');
    const clips = (await reels.manifest(second.id)).clips;
    assert.deepEqual(clips.map((c) => c.text), ['Boil the kettle.', 'Pour it out.', 'Drink it.']);
    assert.equal(String(await store.get(`reels/${second.id}/audio/${clips[0].file}`)), 'said: Boil the kettle.', 'the recording it kept is its own copy');
    assert.equal((await store.list(`reels/${second.id}/audio`)).length, 4, 'three recordings and the list of them: none it has no use for');
    await reels.remove(first.id);
    assert.ok(await store.get(`reels/${second.id}/audio/${clips[0].file}`), 'so deleting the earlier reel takes nothing from it');

    for (const from of [newId(), 'nonsense', second.id.slice(1)]) {
      const alone = await reels.create(tea, { improves: from });
      assert.equal(alone.kept, undefined, `improving on ${from}, which is not a reel, is just making a reel`);
    }
    await reels.idle();
  });

  it('keeps the lines of an earlier reel that is still being recorded when the change is asked for', async () => {
    // someone asks for a change before the first reel has finished: by the change's turn, the first is recorded
    let letGo;
    const held = new Promise((ok) => { letGo = ok; }), recorded = [], thrifty = thriftyRecord(recorded);
    const reels = new Reels({ store: freshStore(), record: async (dir) => { await held; await thrifty(dir); }, video: fakeVideo });
    const first = await reels.create(tea);
    const second = await reels.create({ ...tea, scenes: [...tea.scenes, { title: 'Drink', caption: 'Drink it.' }] }, { improves: first.id });
    assert.deepEqual([first.state, second.state, second.kept], ['recording', 'queued', 2], 'two of its three lines are the first reel\'s');
    letGo();
    await reels.idle();
    assert.deepEqual(recorded, ['Boil the kettle.', 'Pour it.', 'Drink it.'], 'each line was recorded once');
    const done = await reels.status(second.id);
    assert.deepEqual([done.state, done.kept, done.improves], ['ready', 2, undefined]);

    const failing = new Reels({ store: freshStore(), record: async () => { throw new Error('no voice'); }, video: fakeVideo });
    const lost = await failing.create(tea), after = await failing.create(tea, { improves: lost.id });
    await failing.idle();
    assert.equal((await failing.status(after.id)).kept, undefined, 'an earlier reel that could not be recorded has nothing to give');
  });

  it('refuses a reel with problems, saying every one, and keeps nothing', async () => {
    const store = freshStore();
    const reels = new Reels({ store, record: fakeRecord, video: fakeVideo });
    await assert.rejects(reels.create({ ...tea, format: 'nope', scenes: [{ title: 'A' }] }), (err) => err instanceof ReelError && err.problems.length === 2);
    assert.deepEqual(await store.folders('reels'), []);
  });

  it('makes the video once the voice is ready, once', async () => {
    let made = 0;
    const reels = new Reels({ store: freshStore(), record: fakeRecord, video: async (dir, out) => { made++; await fakeVideo(dir, out); } });
    const { id } = await reels.create(tea);
    await reels.idle();
    assert.equal((await reels.requestVideo(id)).video, 'queued');
    assert.equal((await reels.requestVideo(id)).video, 'queued', 'asking twice queues it once');
    await reels.idle();
    assert.equal((await reels.status(id)).video, 'ready');
    assert.equal(String(await reels.store.get(`reels/${id}/video.mp4`)), 'video of Tea');
    await reels.requestVideo(id);
    await reels.idle();
    assert.equal(made, 1, 'a made video is not made again');
  });

  it('draws a reel\'s own picture the first time it is asked for, and keeps it with the reel', async () => {
    let drawn = 0;
    const reels = new Reels({ store: freshStore(), record: () => new Promise(() => {}), video: fakeVideo, picture: async (raw) => { drawn++; return fakePicture(raw); } });
    const { id } = await reels.create(tea);
    assert.equal(String(await reels.card(id)), 'picture of Tea', 'before the voice is recorded: a link is often sent at once');
    assert.equal(String(await reels.card(id)), 'picture of Tea');
    assert.equal(drawn, 1, 'a drawn picture is not drawn again');
    assert.equal(await reels.card('AAAAAAAAAAAAAAAAAAAAAA'), null, 'no reel, no picture');
    await reels.remove(id);
    assert.equal(await reels.store.get(`reels/${id}/card.png`), null, 'it goes when the reel does');
    assert.equal(await reels.card(id), null);
  });

  it('says so, and gives nothing, when a picture cannot be drawn', async () => {
    const said = [];
    const reels = new Reels({ store: freshStore(), record: () => new Promise(() => {}), video: fakeVideo, picture: async () => { throw new Error('no canvas'); }, log: (l) => said.push(l) });
    const { id } = await reels.create(tea);
    assert.equal(await reels.card(id), null);
    assert.match(said.join('\n'), /its picture could not be drawn: Error: no canvas/);
    assert.equal(await reels.store.get(`reels/${id}/card.png`), null);
  });

  it('waits for the voice before making a video', async () => {
    const reels = new Reels({ store: freshStore(), record: fakeRecord, video: fakeVideo });
    const { id } = await reels.create(tea);
    assert.equal((await reels.requestVideo(id)).video, 'none', 'not until the voice is recorded');
  });

  it('says plainly when recording fails, and logs why', async () => {
    const said = [];
    const reels = new Reels({ store: freshStore(), record: async () => { throw new Error('model missing'); }, video: fakeVideo, log: (l) => said.push(l) });
    const { id } = await reels.create(tea);
    await reels.idle();
    const status = await reels.status(id);
    assert.equal(status.state, 'failed');
    assert.equal(status.error, 'The voice could not be recorded. Try again in a while.');
    assert.ok(said.some((l) => l.includes('model missing')), 'the reason goes to the log, not the person');
  });

  it('deletes a reel straight away when asked, even mid-recording', async () => {
    let release;
    const gate = new Promise((ok) => { release = ok; });
    const reels = new Reels({ store: freshStore(), record: async (dir) => { await gate; await fakeRecord(dir); }, video: fakeVideo });
    const { id } = await reels.create(tea);
    await new Promise((ok) => setImmediate(ok));
    assert.equal(await reels.remove(id), true);
    release();
    await reels.idle();
    assert.equal(await reels.status(id), null);
    assert.deepEqual(await reels.store.list(`reels/${id}`), [], 'the finished recording is not saved back');
    assert.equal(await reels.remove(id), false);
  });

  it('carries on after a restart with the jobs that were waiting', async () => {
    const store = freshStore();
    const before = new Reels({ store, record: () => new Promise(() => {}), video: fakeVideo });
    const { id } = await before.create(tea);   // its recording never finishes: the service stopped
    while ((await before.status(id)).state !== 'recording') await new Promise((ok) => setImmediate(ok));
    const after = new Reels({ store, record: fakeRecord, video: fakeVideo });
    await after.resume();
    await after.idle();
    assert.equal((await after.status(id)).state, 'ready');
  });
});

describe('the service limits', () => {
  const scene = (extra = {}) => ({ title: 'A', caption: 'Short.', ...extra });
  const problems = (raw) => limitProblems(reelFromData(raw), raw);

  it('lets an ordinary reel through', () => {
    assert.deepEqual(problems(tea), []);
  });

  it('says what is too big, and how to fix it', () => {
    const big = { ...tea, images: { cat: 'https://example.com/cat.png' }, scenes: Array.from({ length: 13 }, () => scene()) };
    big.scenes[0] = scene({ say: 'word '.repeat(71).trim(), caption: 'x'.repeat(161), picture: { type: 'list', items: Array(9).fill('item') } });
    assert.deepEqual(problems(big), [
      `scenes: 13 is too many; a reel here has at most ${LIMITS.scenes}. Explain one thing, or make two reels.`,
      'images: a reel made here cannot carry pictures from elsewhere; use the icons, or a sprite of your own',
      'scene 1: say has 71 words; keep it to 70, or split the scene in two',
      'scene 1: caption has 161 characters; keep it to 160',
      'scene 1: picture.items has 9; keep it to 8'
    ]);
    const long = { ...tea, scenes: Array.from({ length: 9 }, () => scene({ say: 'word '.repeat(70).trim() })) };
    assert.deepEqual(problems(long), ['the reel would run about 4:22; keep it under 4:00, with fewer or shorter scenes']);
  });

  it('counts each caller by the hour, and everyone by the day', () => {
    let clock = 0;
    const limit = new RateLimit({ perHour: 2, perDay: 3, now: () => clock });
    assert.equal(limit.hit('a'), null);
    assert.equal(limit.hit('a'), null);
    assert.equal(limit.hit('a'), 'That is 2 in the last hour from here. Try again in 60 minutes.');
    assert.equal(limit.hit('b'), null);
    assert.equal(limit.hit('c'), 'Pixel Reel has made as many reels as it can today. Try again tomorrow.');
    clock += 86400001;
    assert.equal(limit.hit('a'), null, 'a new day, a new hour');
  });

  it('checks without counting, so only what is made is counted', () => {
    const limit = new RateLimit({ perHour: 1, perDay: 5, now: () => 0 });
    assert.equal(limit.check('a'), null);
    assert.equal(limit.check('a'), null, 'asking does not use anything up');
    limit.count('a');
    assert.match(limit.check('a'), /^That is 1 in the last hour from here\./);
  });

  it('knows which addresses are in a range', () => {
    for (const address of ['160.79.104.0', '160.79.111.255', '153.61.208.1', '153.61.223.255', '::ffff:160.79.105.9', ' 160.79.106.1 ']) {
      assert.equal(inRanges(address, CLAUDE_ADDRESSES), true, address);
    }
    for (const address of ['160.79.112.0', '160.79.103.255', '153.61.224.0', '8.8.8.8', '2607:6bc0::1', 'unknown', '', '160.79.104', '999.79.104.1']) {
      assert.equal(inRanges(address, CLAUDE_ADDRESSES), false, address);
    }
    assert.equal(inRanges('192.0.2.7', ['192.0.2.7']), true, 'one address is a range of one');
    assert.equal(inRanges('192.0.2.8', ['192.0.2.7', 'nonsense/99']), false);
    assert.equal(inRanges('203.0.113.9', ['0.0.0.0/0']), true);
  });

  it('counts everyone behind shared addresses together, with more room, and says so', () => {
    let clock = 0;
    const limit = new RateLimit({ perHour: 1, perDay: 100, shared: { ranges: CLAUDE_ADDRESSES, perHour: 3 }, now: () => clock });
    assert.equal(limit.hit('160.79.104.5'), null);
    assert.equal(limit.hit('160.79.110.9'), null, 'a second person on Claude, from another of its addresses');
    assert.equal(limit.hit('153.61.209.1'), null);
    clock += 20 * 60000;
    assert.equal(limit.hit('160.79.104.5'), 'People using Claude have made 3 in the last hour between them, which is as many as Pixel Reel can make. Try again in 40 minutes.');
    assert.equal(limit.hit('203.0.113.7'), null, 'someone elsewhere still has their own hour');
    assert.equal(limit.hit('203.0.113.7'), 'That is 1 in the last hour from here. Try again in 60 minutes.');
    clock += 41 * 60000;
    assert.equal(limit.hit('153.61.209.1'), null, 'room again once the hour has moved on');
  });

  it('refuses a reel past the limits, and when too many are waiting', async () => {
    const reels = new Reels({ store: freshStore(), record: () => new Promise(() => {}), video: fakeVideo, maxQueue: 1 });
    await assert.rejects(reels.create({ ...tea, scenes: Array.from({ length: 13 }, () => scene()) }), (err) => err instanceof ReelError && /too many/.test(err.problems[0]));
    await reels.create(tea);   // starts at once, its recording never ends
    await reels.create(tea);   // waits
    await assert.rejects(reels.create(tea), BusyError);
  });
});

describe('the site pages', () => {
  it('turns the Markdown they use into HTML, escaping everything else', () => {
    assert.equal(markdownHtml('<!-- a note -->\n# Hi <b>\n\nOne\nline, **bold**, *soft* and [a link](/x).\n\n- `code`\n- `https://a.example/mcp`\n  more\n\n1. first\n2. second'),
      '<h1>Hi &lt;b&gt;</h1>\n<p>One line, <strong>bold</strong>, <em>soft</em> and <a href="/x">a link</a>.</p>\n' +
      '<ul><li><code>code</code></li><li><code class="address">https:/<wbr>/<wbr>a.example/<wbr>mcp</code> more</li></ul>\n<ol><li>first</li><li>second</li></ol>');
  });

  it('has a page for each address', () => {
    assert.deepEqual(Object.keys(SITE_PAGES), ['/', '/claude', '/press', '/privacy', '/terms', '/credits']);
  });
});

describe('the service over HTTP', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const { callerOf, createService, MAX_BODY } = await import('../service/server.mjs');
  const reels = new Reels({ store: freshStore(), record: fakeRecord, video: fakeVideo, picture: fakePicture });
  const limits = { reels: new RateLimit({ perHour: 1000, perDay: 1000 }), videos: new RateLimit({ perHour: 1000, perDay: 1000 }) };
  const server = createService({ reels, baseUrl: 'https://reels.example/', limits, trustProxy: true });
  let local;
  before(async () => {
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    local = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => { server.close(); server.closeAllConnections(); });

  const connect = async () => {
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${local}/mcp`)));
    return client;
  };
  const words = (result) => result.content.map((c) => c.text).join('\n');

  it('lists its tools, each titled and marked read-only or destructive', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ['reel_format', 'make_reel', 'get_reel', 'get_reel_video', 'delete_reel']);
    for (const t of tools) {
      assert.ok(t.title && t.annotations.title, `${t.name} has a title`);
      assert.equal(typeof t.annotations.readOnlyHint, 'boolean', `${t.name} says if it only reads`);
      if (!t.annotations.readOnlyHint) assert.equal(typeof t.annotations.destructiveHint, 'boolean', `${t.name} says if it destroys`);
      assert.ok(t.name.length <= 64);
    }
    assert.equal(tools.find((t) => t.name === 'delete_reel').annotations.destructiveHint, true);
    const guide = words(await client.callTool({ name: 'reel_format', arguments: {} }));
    assert.match(guide, /Icons, by what they are about:\n- Paperwork and money: letter, document, money, card, bank/);
    for (const name of ICON_NAMES) assert.match(guide, new RegExp(`[ ,]${name}[,.]`), `the guide offers ${name}`);
    await client.close();
  });

  it('says who it is, with its picture, and when to use it', async () => {
    const client = await connect();
    assert.deepEqual(client.getServerVersion(), {
      name: 'pixelreel', title: 'Pixel Reel', version: '0.1.0', websiteUrl: 'https://reels.example',
      icons: [{ src: 'https://reels.example/site/art/icon-192.png', mimeType: 'image/png', sizes: ['192x192'] },
        { src: 'https://reels.example/site/art/icon-512.png', mimeType: 'image/png', sizes: ['512x512'] }]
    });
    for (const size of [192, 512]) assert.ok(staticFile(`/site/art/icon-${size}.png`), 'the picture is there to be shown');
    assert.match(client.getInstructions(), /^Pixel Reel makes short pixel-art explainers/);
    assert.match(client.getInstructions(), /answer in one or two short sentences/);
    await client.close();
  });

  it('tells Claude how to write a good reel where it will read it: in make_reel itself', async () => {
    const client = await connect();
    const make = (await client.listTools()).tools.find((t) => t.name === 'make_reel');
    assert.match(make.description, /5 to 7 scenes, about 40 seconds/);
    assert.match(make.description, /a letter, a bill, a document, a web page, how something works, or the chat so far/);
    assert.ok(make.description.length < 2000, 'short enough for clients that cut a long description off');
    const { properties, $defs } = make.inputSchema;
    assert.equal(properties.format.const, 'pixelreel/1');
    assert.equal(properties.images, undefined, 'no pictures from elsewhere, so none are offered');
    assert.match($defs.scene.properties.say.description, /12 to 25 words/);
    const pictures = $defs.picture.oneOf;
    assert.deepEqual(pictures.map((p) => p.title), ['title', 'list', 'terminal', 'code', 'chat', 'big', 'icons', 'flow', 'compare', 'sprite']);
    for (const picture of pictures) {
      assert.equal(picture.properties.every ?? picture.properties.start, undefined, `${picture.title}: the service does the timing, so Claude is not asked to guess it`);
    }
    await client.close();
  });

  it('gives a guide with a finished reel in it, which is itself a good reel', async () => {
    const guide = formatGuide();
    const example = JSON.parse(guide.slice(guide.indexOf('{"format"')));
    assert.deepEqual(example, EXAMPLE_REEL);
    assert.deepEqual(limitProblems(reelFromData(example), example), []);
    assert.ok(example.scenes.length >= 5 && example.scenes.length <= 7);
    for (const scene of example.scenes) {
      const said = scene.say.split(/\s+/).length;
      assert.ok(said >= 12 && said <= 25, `"${scene.say}" is ${said} words`);
      assert.ok(scene.caption.split(/\s+/).length <= 12, scene.caption);
      assert.notEqual(scene.say, scene.caption);
      assert.equal(scene.picture.every ?? scene.picture.start, undefined);
    }
    assert.equal(new Set(example.scenes.map((s) => s.picture.type)).size, example.scenes.length, 'every scene has a different picture');
    assert.equal(new Set(example.scenes.at(-1).picture.rows.map((r) => r.length)).size, 1, "the sprite's rows are all one length");
    assert.doesNotMatch(guide, /\bevery\b.*\bstart\b/, 'the guide does not offer timing fields');
  });

  it('makes a reel, shows it, makes its video and deletes it', async () => {
    const client = await connect();
    const made = await client.callTool({ name: 'make_reel', arguments: tea });
    assert.equal(made.isError, undefined);
    const { id, watch } = made.structuredContent;
    assert.equal(watch, `https://reels.example/r/${id}`, 'links use the address people reach the service at');
    assert.match(words(made), /^"Tea" is made \(2 scenes, about 0:10\) and (waiting its turn: Peter is recording another reel first|Peter is recording the voice now, which takes about as long as the reel lasts)\./);
    assert.match(words(made), /answer in one or two short sentences, with the link on a line of its own\. Do not list the scenes\. There is no need to check on it\./);
    assert.equal(made.structuredContent.message, words(made), 'the same words for a client that shows Claude only the data');

    const waiting = await fetch(`${local}/r/${id}`);
    await reels.idle();
    const ready = await client.callTool({ name: 'get_reel', arguments: { id } });
    assert.match(words(ready), /^"Tea" is ready: 2 scenes, 0:14\. Watch it at https:\/\/reels\.example\/r\//);
    assert.match(await waiting.text(), /<h1 class="sr-only" id="watch-title">Tea<\/h1>/, 'the page is there at once, and waits for the voice itself');

    const page = await fetch(`${local}/r/${id}`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-security-policy'), SITE_POLICY, "a reel's page loads only the service's own files");
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.match(html, /<title>Tea - Pixel Reel<\/title>/);
    assert.match(html, new RegExp(`<div class="wrap watch-in" id="watch" data-watch="${id}">`), 'the player on the page asks the service for this reel');
    assert.match(html, new RegExp(`<meta property="og:image" content="https://reels\\.example/r/${id}/card\\.png">`), 'a link sent in a message shows the reel\'s own picture');
    assert.match(html, /<meta property="og:image:alt" content="Tea: a pixel reel\. Press Play\.">/);
    const card = await fetch(`${local}/r/${id}/card.png`);
    assert.equal(card.status, 200);
    assert.equal(card.headers.get('content-type'), 'image/png');
    assert.equal(card.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(await card.text(), 'picture of Tea');
    assert.match(html, new RegExp(`<link rel="canonical" href="https://reels\\.example/r/${id}">`));
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
    assert.doesNotMatch(html, /Boil the kettle|Boil it\./, 'the page names the reel, but holds none of its words');
    assert.match(html, /<h2 id="own-title">Want one of your own\?<\/h2>/, 'whoever is sent a reel can find out what made it');
    const audio = await fetch(`${local}/r/${id}/audio/clip0.mp3`, { headers: { range: 'bytes=1-2' } });
    assert.equal(audio.status, 206);
    assert.equal(await audio.text(), 'D3');

    assert.match(words(await client.callTool({ name: 'get_reel_video', arguments: { id } })), /being made/);
    await reels.idle();
    const video = await client.callTool({ name: 'get_reel_video', arguments: { id } });
    assert.equal(video.structuredContent.video, `https://reels.example/r/${id}/video.mp4`);
    assert.equal(await (await fetch(`${local}/r/${id}/video.mp4`)).text(), 'video of Tea');

    assert.match(words(await client.callTool({ name: 'delete_reel', arguments: { id } })), /^Deleted\./);
    assert.equal((await fetch(`${local}/r/${id}`)).status, 404);
    assert.equal((await fetch(`${local}/r/${id}/card.png`)).status, 404, 'its picture goes with it');
    assert.equal((await client.callTool({ name: 'get_reel', arguments: { id } })).isError, true);
    await client.close();
  });

  it('gives each of the site\'s own reels a page to send, with its own picture for a message', async () => {
    const page = await fetch(`${local}/watch/gas-meter`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-security-policy'), SITE_POLICY);
    assert.match(html, /<title>How to read your gas meter - Pixel Reel<\/title>/);
    assert.match(html, /<meta property="og:image" content="https:\/\/reels\.example\/watch\/gas-meter\/card\.png">/);
    assert.equal((await fetch(`${local}/watch/gas-meter`, { headers: { 'if-none-match': page.headers.get('etag') } })).status, 304);
    const card = await fetch(`${local}/watch/gas-meter/card.png`);
    assert.equal(card.status, 200);
    assert.equal(card.headers.get('content-type'), 'image/png');
    assert.equal(await card.text(), 'picture of How to read your gas meter');
    for (const path of ['/watch/site-what', '/watch/nothing', '/watch/gas-meter/', '/watch/../reels']) {
      assert.equal((await fetch(`${local}${path}`)).status, 404, `${path} is not a page`);
    }
  });

  it('shows the card every reel can share when a reel\'s own picture cannot be drawn', async () => {
    const plain = new Reels({ store: freshStore(), record: () => new Promise(() => {}), video: fakeVideo, picture: async () => { throw new Error('no canvas'); } });
    const other = createService({ reels: plain, baseUrl: 'https://reels.example' });
    await new Promise((ok) => other.listen(0, '127.0.0.1', ok));
    try {
      const { id } = await plain.create(tea);
      const card = await fetch(`http://127.0.0.1:${other.address().port}/r/${id}/card.png`, { redirect: 'manual' });
      assert.equal(card.status, 302);
      assert.equal(card.headers.get('location'), '/site/art/reel-card.png');
      assert.ok(staticFile('/site/art/reel-card.png'), 'which is there to be shown');
      const ours = await fetch(`http://127.0.0.1:${other.address().port}/watch/volcano/card.png`, { redirect: 'manual' });
      assert.equal(ours.status, 302);
      assert.equal(ours.headers.get('location'), '/site/art/share.png', 'and the site\'s own card for one of its own reels');
      assert.ok(staticFile('/site/art/share.png'));
    } finally {
      other.close();
      other.closeAllConnections();
    }
  });

  it('gives Claude every problem in a reel at once, as a tool error to fix', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'make_reel', arguments: { ...tea, scenes: [{ title: 'A', picture: { type: 'icons', items: [] } }] } });
    assert.equal(result.isError, true);
    assert.match(words(result), /^This reel has problems\. Fix them all, then call make_reel again:\n- scene 1: needs a caption\n- scene 1: picture\.items must be/);
    await client.close();
  });

  it('takes a reel that does not say its format, as there is only the one here', async () => {
    const client = await connect();
    const { format, ...bare } = tea;
    assert.deepEqual((await client.listTools()).tools.find((t) => t.name === 'make_reel').inputSchema.required, ['title', 'scenes']);
    const made = await client.callTool({ name: 'make_reel', arguments: bare });
    assert.equal(made.isError, undefined);
    assert.equal((await reels.reel(made.structuredContent.id)).format, format);
    const wrong = await client.callTool({ name: 'make_reel', arguments: { ...tea, format: 'pixelreel/9' } });
    assert.match(words(wrong), /format: this player reads "pixelreel\/1", not "pixelreel\/9"/, 'but one that names another format is told so');
    await reels.idle();
    await client.close();
  });

  it('lets Claude change a reel it made, keeping the lines it leaves alone', async () => {
    const mine = new Reels({ store: freshStore(), record: thriftyRecord(), video: fakeVideo, picture: fakePicture });
    const other = createService({ reels: mine, baseUrl: 'https://reels.example' });
    await new Promise((ok) => other.listen(0, '127.0.0.1', ok));
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${other.address().port}/mcp`)));
    try {
      const make = (await client.listTools()).tools.find((t) => t.name === 'make_reel');
      assert.match(make.inputSchema.properties.improves.description, /^To change a reel you made: the id of that reel\./);
      assert.match(make.description, /send the whole reel again with "improves" set to its id/);
      assert.ok(make.description.length < 2000);
      const first = await client.callTool({ name: 'make_reel', arguments: tea });
      await mine.idle();
      const second = await client.callTool({ name: 'make_reel', arguments: { ...tea, title: 'Tea, again', improves: first.structuredContent.id } });
      assert.equal(second.isError, undefined, 'improves is not taken for part of the reel');
      assert.equal(second.structuredContent.kept, 2);
      assert.match(words(second), /\n2 of its lines keep their recordings from the earlier reel, so it will be ready sooner\. The earlier reel is still at its own link: delete_reel removes it/);
      await mine.idle();
      assert.equal((await mine.reel(second.structuredContent.id)).improves, undefined, 'and is not kept in it');
      assert.doesNotMatch(words(await client.callTool({ name: 'get_reel', arguments: { id: second.structuredContent.id } })), /keep their recordings/, 'once it is ready there is no more to say about it');
      const lost = await client.callTool({ name: 'make_reel', arguments: { ...tea, improves: 'no-such-reel' } });
      assert.equal(lost.isError, undefined, 'an earlier reel that has gone does not stop the new one');
      assert.equal(lost.structuredContent.kept, undefined);
      await mine.idle();
      await client.close();
    } finally {
      other.close();
      other.closeAllConnections();
    }
  });

  it('offers a player to show inside the chat, allowed to reach only the service', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    for (const name of ['make_reel', 'get_reel']) assert.equal(tools.find((t) => t.name === name)._meta.ui.resourceUri, 'ui://pixelreel/player.html');
    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((r) => [r.uri, r.mimeType]), [['ui://pixelreel/player.html', 'text/html;profile=mcp-app']]);
    const [player] = (await client.readResource({ uri: 'ui://pixelreel/player.html' })).contents;
    assert.equal(player.mimeType, 'text/html;profile=mcp-app');
    assert.deepEqual(player._meta.ui.csp, { connectDomains: ['https://reels.example'], resourceDomains: ['https://reels.example'] });
    assert.match(player.text, /<body class="embed app" data-service="https:\/\/reels\.example">/);
    assert.match(player.text, /function startPixelreel\(\) \{/);
    assert.match(player.text, /'ui\/initialize'/);
    assert.doesNotMatch(player.text, /id="reel-data"/, 'the reel arrives later, from the tool result');
    assert.match(player.text, /body\[data-opens="title"\] \.bigplay, body\[data-opens="card"\] \.bigplay \{ top: 72%; \}/, "the big Play button sits under a title's words, not on them");
    assert.match(player.text, /document\.body\.dataset\.opens = reel\.opens;/);
    await assert.rejects(client.readResource({ uri: 'ui://pixelreel/other.html' }));
    await client.close();
  });

  it('offers ready-made things to ask for, in the words a person would use', async () => {
    const client = await connect();
    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map((p) => [p.name, p.title]), [
      ['reel_about', 'A reel about...'], ['reel_of_a_letter', 'A reel of a letter or bill'],
      ['reel_of_a_document', 'A reel of a document or web page'], ['reel_of_this_chat', 'A reel of this chat']
    ]);
    for (const p of prompts) assert.ok(p.description && !('words' in p), `${p.name} says what it is for`);
    assert.deepEqual(prompts[0].arguments, [{ name: 'about', description: 'What you want explained, in a few words.', required: true }]);

    const text = async (name, args) => {
      const { messages } = await client.getPrompt({ name, arguments: args });
      assert.deepEqual(messages.map((m) => [m.role, m.content.type]), [['user', 'text']]);
      return messages[0].content.text;
    };
    assert.equal(await text('reel_about', { about: '  how a mortgage\n works ' }), 'Make me a pixel reel about this: how a mortgage works');
    assert.equal((await text('reel_about', { about: 'x'.repeat(5000) })).length, 'Make me a pixel reel about this: '.length + 600, 'what is typed is kept to a sensible length');
    await assert.rejects(client.getPrompt({ name: 'reel_about', arguments: {} }), /needs about/);
    const letter = await text('reel_of_a_letter');
    assert.match(letter, /what I have to do, if anything; by when; what happens if I do not/);
    assert.match(letter, /Leave out names, addresses, and account or reference numbers/);
    assert.match(letter, /If I have not given you one yet, ask me for it/);
    assert.match(await text('reel_of_a_document', { link: 'https://example.com/a' }), /^Make me a pixel reel of the web page at https:\/\/example\.com\/a\. If you cannot read it/);
    assert.match(await text('reel_of_a_document'), /^Make me a pixel reel of the document I have given you in this chat\./);
    assert.match(await text('reel_of_this_chat'), /what we worked out, what was decided, and what happens next/);
    await assert.rejects(client.getPrompt({ name: 'nothing' }), /There is no prompt called nothing/);

    const guide = words(await client.callTool({ name: 'reel_format', arguments: {} }));
    assert.match(guide, /What to put in, by what you are given:\n- A letter, bill or form: who it is from/, 'the same advice is in the guide, for someone who asks in their own words');
    await client.close();
  });

  it('tells whoever is waiting how many lines are recorded so far', async () => {
    let carryOn;
    const slow = new Reels({
      store: freshStore(), video: fakeVideo, picture: fakePicture,
      record: async (dir, _log, onLine) => { onLine(1, 2); await new Promise((ok) => { carryOn = ok; }); await fakeRecord(dir); }
    });
    const other = createService({ reels: slow, baseUrl: 'https://reels.example' });
    await new Promise((ok) => other.listen(0, '127.0.0.1', ok));
    const at = `http://127.0.0.1:${other.address().port}`;
    try {
      const client = new Client({ name: 'test', version: '1' });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${at}/mcp`)));
      const { id } = (await client.callTool({ name: 'make_reel', arguments: tea })).structuredContent;
      let play;
      do { play = await (await fetch(`${at}/r/${id}/play.json`)).json(); } while (!play.lines);
      assert.deepEqual([play.state, play.recorded, play.lines], ['recording', 1, 2]);
      assert.match(words(await client.callTool({ name: 'get_reel', arguments: { id } })), /Peter is recording the voice now \(1 of 2 lines done\)/);
      carryOn();
      await slow.idle();
      const ready = await (await fetch(`${at}/r/${id}/play.json`)).json();
      assert.deepEqual([ready.state, ready.recorded, ready.lines], ['ready', undefined, undefined]);
      await client.close();
    } finally {
      other.close();
      other.closeAllConnections();
    }
  });

  it('shows the count in the player in the chat, and does not say a new reel is waiting when it is not', async () => {
    const bridge = readFileSync(new URL('../service/app-bridge.js', import.meta.url), 'utf8');
    assert.match(bridge, /Peter has read \$\{state\.recorded\} of \$\{state\.lines\} lines/);
    assert.match(bridge, /waiting\(\{ state: 'recording' \}\)/, 'a reel just made is shown as being recorded until the service says otherwise');
    assert.match(bridge, /className: 'lines'/, 'with a square for each line');
    assert.match(playerHtml('https://reels.example'), /\.lines i\.on \{ background: var\(--gold\); \}/, 'which the page knows how to draw');
  });

  it('tells the player in the chat when a reel is ready, from any origin', async () => {
    const { id } = await reels.create(tea);
    const early = await fetch(`${local}/r/${id}/play.json`);
    assert.equal(early.headers.get('access-control-allow-origin'), '*');
    assert.match((await early.json()).state, /queued|recording/);
    await reels.idle();
    const ready = await (await fetch(`${local}/r/${id}/play.json`)).json();
    assert.equal(ready.state, 'ready');
    assert.equal(ready.watch, `https://reels.example/r/${id}`);
    assert.deepEqual(ready.reel, await reels.reel(id), 'the reel as it is kept, its pictures timed to the voice');
    assert.equal(ready.reel.scenes[1].picture.start, 0.6);
    assert.deepEqual(ready.clips.map((c) => c.file), [`https://reels.example/r/${id}/audio/clip0.mp3`, `https://reels.example/r/${id}/audio/clip1.mp3`]);
    assert.ok(Date.parse(ready.expires) > Date.now(), 'it says how long the reel is kept');
    assert.equal(ready.video, undefined, 'no video has been asked for');
    await reels.requestVideo(id);
    await reels.idle();
    assert.equal((await (await fetch(`${local}/r/${id}/play.json`)).json()).video, `https://reels.example/r/${id}/video.mp4`);
    const gone = await fetch(`${local}/r/${newId()}/play.json`);
    assert.equal(gone.status, 404);
    assert.deepEqual(await gone.json(), { state: 'gone' });
  });

  it('stops a caller who asks for too many, as a tool error Claude can pass on', async () => {
    limits.reels = new RateLimit({ perHour: 1, perDay: 100 });
    const asking = (from) => {
      const client = new Client({ name: 'test', version: '1' });
      return client.connect(new StreamableHTTPClientTransport(new URL(`${local}/mcp`), { requestInit: { headers: { 'x-forwarded-for': from } } })).then(() => client);
    };
    const one = await asking('203.0.113.7'), two = await asking('198.51.100.9');
    assert.equal((await one.callTool({ name: 'make_reel', arguments: tea })).isError, undefined);
    const again = await one.callTool({ name: 'make_reel', arguments: tea });
    assert.equal(again.isError, true);
    assert.match(words(again), /^No more reels for now\. That is 1 in the last hour from here\. Try again in 60 minutes\.$/);
    assert.equal((await two.callTool({ name: 'make_reel', arguments: tea })).isError, undefined, 'each caller has their own hour');
    await Promise.all([one.close(), two.close()]);
    limits.reels = new RateLimit({ perHour: 1000, perDay: 1000 });
    await reels.idle();
  });

  it('does not count a reel sent back to be fixed against the caller', async () => {
    limits.reels = new RateLimit({ perHour: 1, perDay: 100 });
    const client = await connect();
    const wrong = await client.callTool({ name: 'make_reel', arguments: { ...tea, scenes: [] } });
    assert.equal(wrong.isError, true);
    assert.match(words(wrong), /^This reel has problems/);
    assert.equal((await client.callTool({ name: 'make_reel', arguments: tea })).isError, undefined, 'the try that failed used nothing up');
    assert.match(words(await client.callTool({ name: 'make_reel', arguments: tea })), /^No more reels for now\./);
    await client.close();
    limits.reels = new RateLimit({ perHour: 1000, perDay: 1000 });
    await reels.idle();
  });

  it('takes a caller to be who the proxy in front saw, not who the caller says they are', async () => {
    const said = [];
    const req = (forwarded) => ({ headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded }, socket: { remoteAddress: '10.0.0.1' } });
    assert.equal(callerOf(req('203.0.113.7'), 1), '203.0.113.7');
    assert.equal(callerOf(req('1.2.3.4, 203.0.113.7'), 1), '203.0.113.7', 'an address the caller wrote in front is not believed');
    assert.equal(callerOf(req('1.2.3.4, 203.0.113.7, 198.51.100.1'), 2), '203.0.113.7', 'two proxies in front: the second from the end');
    assert.equal(callerOf(req('203.0.113.7'), 2), '203.0.113.7', 'fewer than expected: the first there is');
    assert.equal(callerOf(req('1.2.3.4'), 0), '10.0.0.1', 'no proxy trusted: the connection itself');
    assert.equal(callerOf(req(undefined), 1), '10.0.0.1');

    // over HTTP: someone who writes a new address in front each time is still one caller
    const strict = { reels: new RateLimit({ perHour: 1, perDay: 100 }), videos: new RateLimit({ perHour: 100, perDay: 100 }) };
    const other = createService({ reels, baseUrl: 'https://reels.example', limits: strict, trustProxy: 1, log: (line) => said.push(line) });
    await new Promise((ok) => other.listen(0, '127.0.0.1', ok));
    const asking = async (forwarded) => {
      const client = new Client({ name: 'test', version: '1' });
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${other.address().port}/mcp`), { requestInit: { headers: { 'x-forwarded-for': forwarded } } }));
      return client;
    };
    try {
      const one = await asking('9.9.9.9, 203.0.113.7'), two = await asking('8.8.8.8, 203.0.113.7');
      assert.equal((await one.callTool({ name: 'make_reel', arguments: tea })).isError, undefined);
      assert.match(words(await two.callTool({ name: 'make_reel', arguments: tea })), /^No more reels for now\. That is 1 in the last hour from here\./);
      await Promise.all([one.close(), two.close()]);
      assert.deepEqual(said.filter((line) => line.startsWith('callers:')), [
        'callers: X-Forwarded-For came with 2 addresses, but PIXELREEL_TRUST_PROXY is 1. If 2 proxies are in front, set it to 2, or callers are told apart wrongly'
      ], 'it says once how many addresses arrive, and never what they are');
      const plain = await asking('203.0.113.7');
      await plain.close();
      assert.equal(said.filter((line) => line.startsWith('callers:')).at(-1), 'callers: X-Forwarded-For came with 1 address, as PIXELREEL_TRUST_PROXY=1 expects');
    } finally {
      other.close();
      other.closeAllConnections();
      await reels.idle();
    }
  });

  it("keeps a reel's title as words, whatever is in it", async () => {
    const { id } = await reels.create({ ...tea, title: 'Tea & <b>cake</b> "now"' });
    await reels.idle();
    const html = await (await fetch(`${local}/r/${id}`)).text();
    assert.match(html, /<h1 class="sr-only" id="watch-title">Tea &amp; &lt;b&gt;cake&lt;\/b&gt; &quot;now&quot;<\/h1>/);
    assert.match(html, /<title>Tea &amp; &lt;b&gt;cake&lt;\/b&gt; &quot;now&quot; - Pixel Reel<\/title>/);
    assert.doesNotMatch(html, /<b>cake/);
  });

  it('says so, on its own page, when a reel is not there', async () => {
    const res = await fetch(`${local}/r/${newId()}`);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(await res.text(), /<h1 id="lost-title">No reel here<\/h1>/);
  });

  it('answers odd requests plainly, and serves nothing it should not', async () => {
    assert.equal((await fetch(`${local}/mcp`)).status, 405);
    assert.equal((await fetch(`${local}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })).status, 400);
    assert.equal((await fetch(`${local}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(MAX_BODY + 1) })).status, 413);
    assert.equal((await fetch(`${local}/r/${newId()}`)).status, 404);
    assert.equal((await fetch(`${local}/r/../../package.json`)).status, 404);
    const { id } = await reels.create(tea);
    await reels.idle();
    for (const bad of ['audio/manifest.json', 'reel.json', 'status.json', 'audio/..%2Freel.json', 'audio/clip0.wav']) {
      assert.equal((await fetch(`${local}/r/${id}/${bad}`)).status, 404, bad);
    }
    assert.equal(await (await fetch(`${local}/health`)).text(), 'ok');
  });

  it('serves its own pages, with the connector address filled in', async () => {
    for (const path of Object.keys(SITE_PAGES)) {
      const res = await fetch(`${local}${path}`);
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get('content-security-policy'), SITE_POLICY);
      const html = await res.text();
      assert.equal(html.match(/<h1[ >]/g)?.length, 1, `${path} has one main heading`);
      assert.doesNotMatch(html, /\{\{|<!--/, `${path} has no placeholders or notes left in it`);
      assert.match(html, /<meta name="robots" content="noindex, nofollow">/, `${path} asks not to be listed, while Pixel Reel is by invitation`);
    }
    const claude = await (await fetch(`${local}/claude`)).text();
    assert.match(claude, /<code class="address" id="address">https:\/\/reels\.example<wbr>\/mcp<\/code>/);
    assert.ok(claude.includes('href="https://claude.ai/customize/connectors?modal=add-custom-connector&amp;connectorName=Pixel%20Reel&amp;connectorUrl=https%3A%2F%2Freels.example%2Fmcp"'), 'the big button opens Claude with the name and address filled in');
  });

  it('sends a page compressed, and not at all to a browser that has it', async () => {
    const plain = await fetch(`${local}/`, { headers: { 'accept-encoding': 'identity' } });
    const small = await fetch(`${local}/`, { headers: { 'accept-encoding': 'br' } });
    assert.equal(small.headers.get('content-encoding'), 'br');
    assert.equal(small.headers.get('vary'), 'accept-encoding');
    assert.equal(await small.text(), await plain.text(), 'fetch unpacks it to the same page');
    assert.ok(Number(small.headers.get('content-length')) < Number(plain.headers.get('content-length')) / 3);
    const again = await fetch(`${local}/`, { headers: { 'if-none-match': plain.headers.get('etag') } });
    assert.equal(again.status, 304);
  });

  it('answers an address it does not know with its own page, and 404', async () => {
    const res = await fetch(`${local}/no-such-page`);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match(await res.text(), /<h1 id="lost-title">Nothing on this channel<\/h1>/);
  });

  it("serves the site's files, and nothing else in the project", async () => {
    const css = await fetch(`${local}/site/css/site.css`, { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(css.status, 200);
    assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
    assert.equal(css.headers.get('content-encoding'), 'gzip');
    assert.equal(css.headers.get('cache-control'), 'public, max-age=3600');
    assert.equal((await fetch(`${local}/site/css/site.css`, { headers: { 'if-none-match': css.headers.get('etag') } })).status, 304);
    for (const [path, type] of [['/site/js/main.js', 'text/javascript; charset=utf-8'], ['/src/kit.js', 'text/javascript; charset=utf-8'],
      ['/reels/pixel-reel/reel.json', 'application/json; charset=utf-8'], ['/reels/pixel-reel/audio/manifest.json', 'application/json; charset=utf-8'],
      ['/site/art/favicon.svg', 'image/svg+xml'], ['/favicon.ico', 'image/x-icon'], ['/site/art/site.webmanifest', 'application/manifest+json']]) {
      const res = await fetch(`${local}${path}`);
      assert.equal(res.status, 200, path);
      assert.equal(res.headers.get('content-type'), type, path);
    }
    const font = await fetch(`${local}/site/fonts/lexend.woff2`);
    assert.equal(font.headers.get('content-type'), 'font/woff2');
    assert.equal(font.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'a font never changes under the same name');
    const { clips } = await (await fetch(`${local}/reels/pixel-reel/audio/manifest.json`)).json();
    const clip = await fetch(`${local}/reels/pixel-reel/audio/${clips[0].file}`, { headers: { range: 'bytes=0-9' } });
    assert.equal(clip.status, 206, 'a recording can be asked for a part at a time, to seek');
    assert.equal(clip.headers.get('content-type'), 'audio/mpeg');
    assert.equal((await clip.arrayBuffer()).byteLength, 10);
    for (const bad of ['/package.json', '/site/layout.html', '/site/pages/home.html', '/site/pages/privacy.md', '/reels/showreel/reel.js', '/service/main.mjs',
      '/src/../package.json', '/site/js/..%2F..%2Fpackage.json', '/site/css/', '/src/pixelreel.css', '/reels/pixel-reel/', '/.gitignore', '/site/art/.hidden.png']) {
      assert.equal((await fetch(`${local}${bad}`)).status, 404, bad);
    }
  });

  it('keeps search engines out, and never lets them near a reel', async () => {
    assert.equal(await (await fetch(`${local}/robots.txt`)).text(), 'User-agent: *\nDisallow: /\n');
    assert.equal((await fetch(`${local}/sitemap.xml`)).status, 404);
    const { id } = await reels.create(tea);
    await reels.idle();
    for (const path of [`/r/${id}`, `/r/${id}/play.json`, `/r/${id}/audio/clip0.mp3`, `/r/${newId()}`]) {
      assert.equal((await fetch(`${local}${path}`)).headers.get('x-robots-tag'), 'noindex, nofollow', path);
    }
  });

  it('lets search engines list the site, but still not the reels, once it is listed', async () => {
    const open = createService({ reels, baseUrl: 'https://reels.example', listed: true });
    await new Promise((ok) => open.listen(0, '127.0.0.1', ok));
    const at = `http://127.0.0.1:${open.address().port}`;
    try {
      assert.match(await (await fetch(`${at}/`)).text(), /<meta name="robots" content="index, follow">/);
      assert.equal(await (await fetch(`${at}/robots.txt`)).text(), 'User-agent: *\nDisallow: /r/\nDisallow: /mcp\n\nSitemap: https://reels.example/sitemap.xml\n');
      const map = await (await fetch(`${at}/sitemap.xml`)).text();
      for (const path of Object.keys(SITE_PAGES)) assert.ok(map.includes(`<loc>https://reels.example${path}</loc>`), path);
    } finally {
      open.close();
    }
  });
});
