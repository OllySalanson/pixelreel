import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { isId, KEEP_DAYS, newId, Reels } from '../service/reels.mjs';
import { checkKey, DiskStore } from '../service/store.mjs';
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

const fakeVideo = async (dir, out) => writeFileSync(out, `video of ${JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8')).title}`);

describe('the store', () => {
  it('keeps bytes under keys, lists and deletes them', async () => {
    const store = freshStore();
    await store.put('reels/a/reel.json', '{}');
    await store.put('reels/a/audio/x.mp3', Buffer.from([1, 2, 3]));
    await store.put('reels/b/reel.json', '{}');
    assert.equal(String(await store.get('reels/a/reel.json')), '{}');
    assert.equal(await store.size('reels/a/audio/x.mp3'), 3);
    assert.equal(await store.get('reels/a/nothing'), null);
    assert.deepEqual((await store.list('reels/a')).sort(), ['reels/a/audio/x.mp3', 'reels/a/reel.json']);
    assert.deepEqual((await store.folders('reels')).sort(), ['a', 'b']);
    await store.remove('reels/a');
    assert.deepEqual(await store.list('reels/a'), []);
    assert.deepEqual(await store.folders('nowhere'), []);
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
      id: '', title: 'Tea', scenes: 2, state: 'queued', seconds: 10,
      created: '2026-11-22T10:00:00.000Z', expires: '2026-12-22T10:00:00.000Z', video: 'none'
    });
    await reels.idle();
    const ready = await reels.status(made.id);
    assert.equal(ready.state, 'ready');
    assert.equal(ready.seconds, 14, 'the length from the recordings, with a 1.2 second pause after each');
    assert.deepEqual((await reels.manifest(made.id)).clips.map((c) => c.text), ['Boil the kettle.', 'Pour it.']);
    assert.deepEqual(await reels.reel(made.id), tea);

    clock += KEEP_DAYS * 86400000;
    assert.equal(await reels.status(made.id), null, 'gone once it expires');
    assert.deepEqual(await reels.sweep(), [made.id]);
    assert.equal(await reels.reel(made.id), null);
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

describe('the service over HTTP', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const { createService, MAX_BODY } = await import('../service/server.mjs');
  const reels = new Reels({ store: freshStore(), record: fakeRecord, video: fakeVideo });
  const server = createService({ reels, baseUrl: 'https://reels.example/' });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const local = `http://127.0.0.1:${server.address().port}`;
  after(() => server.close());

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
    assert.equal(tools.find((t) => t.name === 'make_reel').inputSchema.properties.format.const, 'pixelreel/1');
    assert.match(words(await client.callTool({ name: 'reel_format', arguments: {} })), /Icons: letter, document, phone/);
    await client.close();
  });

  it('makes a reel, shows it, makes its video and deletes it', async () => {
    const client = await connect();
    const made = await client.callTool({ name: 'make_reel', arguments: tea });
    assert.equal(made.isError, undefined);
    const { id, watch } = made.structuredContent;
    assert.equal(watch, `https://reels.example/r/${id}`, 'links use the address people reach the service at');
    assert.match(words(made), /being recorded|waiting its turn/);

    const waiting = await fetch(`${local}/r/${id}`);
    await reels.idle();
    const ready = await client.callTool({ name: 'get_reel', arguments: { id } });
    assert.match(words(ready), /^"Tea" is ready: 2 scenes, 0:14\. Watch it at https:\/\/reels\.example\/r\//);
    assert.match(await waiting.text(), /Nearly ready|<canvas/);

    const page = await fetch(`${local}/r/${id}`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'.*media-src 'self'/);
    assert.match(html, /<title>Tea - pixelreel<\/title>/);
    assert.match(html, new RegExp(`"file":"/r/${id}/audio/clip0\\.mp3"`), 'the page plays the recordings from the service');
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
    assert.equal((await client.callTool({ name: 'get_reel', arguments: { id } })).isError, true);
    await client.close();
  });

  it('gives Claude every problem in a reel at once, as a tool error to fix', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'make_reel', arguments: { ...tea, scenes: [{ title: 'A', picture: { type: 'icons', items: [] } }] } });
    assert.equal(result.isError, true);
    assert.match(words(result), /^This reel has problems\. Fix them all, then call make_reel again:\n- scene 1: needs a caption\n- scene 1: picture\.items must be/);
    await client.close();
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
    await assert.rejects(client.readResource({ uri: 'ui://pixelreel/other.html' }));
    await client.close();
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
    assert.deepEqual(ready.reel, tea);
    assert.deepEqual(ready.clips.map((c) => c.file), [`https://reels.example/r/${id}/audio/clip0.mp3`, `https://reels.example/r/${id}/audio/clip1.mp3`]);
    const gone = await fetch(`${local}/r/${newId()}/play.json`);
    assert.equal(gone.status, 404);
    assert.deepEqual(await gone.json(), { state: 'gone' });
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
});
