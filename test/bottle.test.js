// Message in a Bottle (bottle/): the endpoint that takes notes left with the button, and the
// reader that lists, fetches and marks them. The button itself is checked in a browser (bottle/README.md).
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createBottle, MAX_BYTES, noteFrom, shotFrom } from '../bottle/server.mjs';
import { main as bottles } from '../bottle/bottles.mjs';
import { Reels } from '../service/reels.mjs';
import { createService } from '../service/server.mjs';
import { sitePage } from '../service/site.mjs';
import { DiskStore } from '../service/store.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-bottle-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const SITE = 'https://site.example';
const KEY = 'link-secret', READER = 'reader-secret';
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2, 3]).toString('base64')}`;
const note = (extra = {}) => ({
  note: 'The heading is too big on a phone.',
  page: { url: `${SITE}/make`, title: 'Make a pixel reel' },
  target: { whole: false, selector: '#main > h1', tag: 'h1', text: 'Make a pixel reel', rect: { x: 10, y: 20.4, width: 300, height: 60 } },
  viewport: { width: 390, height: 844, scale: 3, scrollX: 0, scrollY: 120 },
  browser: 'Test browser', settings: { size: '2', font: 'lexend' }, shot: JPEG, ...extra
});

/** A bottle on a server of its own, with a clock that can be moved on. */
async function serve(options = {}) {
  const clock = { now: Date.parse('2026-11-22T12:00:00Z') };
  const store = new DiskStore(join(tmp, `store-${Math.random().toString(36).slice(2)}`));
  const bottle = createBottle({ store, key: KEY, reader: READER, origins: [SITE], now: () => clock.now, ...options });
  const server = createServer(async (req, res) => { if (!(await bottle.handle(req, res))) res.writeHead(418).end(); });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', headers = {}, body } = {}) => fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const leave = (body = note(), headers = {}) => call('/bottle/notes', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, 'x-bottle-key': KEY, ...headers }, body });
  const read = (path, headers = {}) => call(path, { headers: { authorization: `Bearer ${READER}`, ...headers } });
  return { server, base, store, clock, call, leave, read, close: () => new Promise((ok) => server.close(ok)) };
}

describe('a note as it is kept', () => {
  it('keeps only the fields it knows, each cut to its length, with an id that sorts by time', () => {
    const kept = noteFrom({ ...note(), extra: 'not kept', note: `  ${'x'.repeat(6000)}  `, settings: { size: '2', 'Bad Name': 'x', long: 'y'.repeat(500), n: 5 } }, new Date('2026-11-22T12:34:56Z'));
    assert.match(kept.id, /^20261122-123456-[0-9a-f]{8}$/);
    assert.equal(kept.state, 'new');
    assert.equal(kept.note.length, 5000);
    assert.equal(kept.extra, undefined);
    assert.deepEqual(kept.target.rect, { x: 10, y: 20, width: 300, height: 60 });
    assert.deepEqual(kept.settings, { size: '2', long: 'y'.repeat(100) });
    assert.equal(kept.shot, false);
  });

  it('wants words in the note', () => {
    assert.throws(() => noteFrom({ note: '   ' }), /Write what the note is about/);
    assert.throws(() => noteFrom(null), /Write what the note is about/);
  });

  it('takes a screenshot only if it is a JPEG', () => {
    assert.deepEqual([...shotFrom({ shot: JPEG }).subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.equal(shotFrom({ shot: `data:image/jpeg;base64,${Buffer.from('<svg/>').toString('base64')}` }), null);
    assert.equal(shotFrom({ shot: 'data:image/png;base64,iVBORw0KGgo=' }), null);
    assert.equal(shotFrom({}), null);
  });
});

describe('the endpoint', () => {
  let s;
  before(async () => { s = await serve(); });
  after(() => s.close());

  it('serves the button, the rest of it and the screenshot maker as scripts', async () => {
    for (const name of ['bottle.js', 'bottle-ui.mjs', 'shot.mjs']) {
      const res = await s.call(`/bottle/${name}`);
      assert.equal(res.status, 200, name);
      assert.match(res.headers.get('content-type'), /^text\/javascript/);
      assert.ok((await res.text()).length > 500, name);
    }
    const tag = (await s.call('/bottle/bottle.js')).headers.get('etag');
    assert.equal((await s.call('/bottle/bottle.js', { headers: { 'if-none-match': tag } })).status, 304);
  });

  it('answers only under its own address', async () => {
    assert.equal((await s.call('/elsewhere')).status, 418);
    assert.equal((await s.call('/bottles')).status, 418);
    assert.equal((await s.call('/bottle/nothing')).status, 404);
  });

  it('says whether a key is the right one', async () => {
    const check = (key) => s.call('/bottle/check', { method: 'POST', headers: { origin: SITE, 'x-bottle-key': key } });
    assert.equal((await check(KEY)).status, 200);
    assert.equal((await check('wrong')).status, 403);
    assert.equal((await s.call('/bottle/check', { method: 'POST', headers: { origin: 'https://elsewhere.example', 'x-bottle-key': KEY } })).status, 403);
  });

  it('keeps a note and its screenshot, and only whoever holds the reader key can see them', async () => {
    const res = await s.leave();
    assert.equal(res.status, 201);
    const { id } = await res.json();
    const kept = JSON.parse(await s.store.get(`bottles/${id}/note.json`));
    assert.equal(kept.note, 'The heading is too big on a phone.');
    assert.equal(kept.shot, true);
    assert.equal(kept.target.selector, '#main > h1');
    assert.deepEqual([...(await s.store.get(`bottles/${id}/shot.jpg`)).subarray(0, 3)], [0xff, 0xd8, 0xff]);

    // the link's key is not the reader's
    for (const path of ['/bottle/notes', `/bottle/notes/${id}`, `/bottle/notes/${id}/shot.jpg`]) {
      assert.equal((await s.call(path)).status, 403, path);
      assert.equal((await s.call(path, { headers: { authorization: `Bearer ${KEY}` } })).status, 403, path);
    }
    const list = await (await s.read('/bottle/notes')).json();
    assert.deepEqual(list.notes.map((n) => n.id), [id]);
    const shot = await s.read(`/bottle/notes/${id}/shot.jpg`);
    assert.equal(shot.headers.get('content-type'), 'image/jpeg');
    assert.equal((await s.read(`/bottle/notes/${id}`)).status, 200);
    assert.equal((await s.read('/bottle/notes/20261122-120000-00000000')).status, 404);
  });

  it('keeps a note with no screenshot when the browser could not make one', async () => {
    const { id } = await (await s.leave(note({ shot: null }))).json();
    assert.equal(JSON.parse(await s.store.get(`bottles/${id}/note.json`)).shot, false);
    assert.equal((await s.read(`/bottle/notes/${id}/shot.jpg`)).status, 404);
  });

  it('turns away a note with the wrong key, from another site, with no words or too big', async () => {
    assert.equal((await s.leave(note(), { 'x-bottle-key': 'wrong' })).status, 403);
    assert.equal((await s.leave(note(), { origin: 'https://elsewhere.example' })).status, 403);
    assert.equal((await s.leave(note({ note: '' }))).status, 400);
    assert.equal((await s.leave('{not json')).status, 400);
    const big = await s.leave(note({ shot: `data:image/jpeg;base64,${'A'.repeat(MAX_BYTES)}` })).catch(() => null);
    assert.ok(!big || big.status === 413);
  });

  it('marks a note, keeping what was done with it, and lists by state', async () => {
    const { id } = await (await s.leave()).json();
    const patch = (body) => s.call(`/bottle/notes/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${READER}`, 'content-type': 'application/json' }, body });
    assert.equal((await patch({ state: 'gone' })).status, 400);
    assert.equal((await s.call(`/bottle/notes/${id}`, { method: 'PATCH', body: { state: 'fixed' } })).status, 403);
    const marked = await (await patch({ state: 'fixed', answer: 'Made it smaller.' })).json();
    assert.equal(marked.state, 'fixed');
    assert.deepEqual(marked.history.map((h) => [h.state, h.answer]), [['fixed', 'Made it smaller.']]);
    const fixed = await (await s.read('/bottle/notes?state=fixed')).json();
    assert.deepEqual(fixed.notes.map((n) => n.id), [id]);
    assert.ok(!(await (await s.read('/bottle/notes')).json()).notes.some((n) => n.id === id), 'no longer new');
    assert.ok((await (await s.read('/bottle/notes?state=all')).json()).notes.some((n) => n.id === id));
    assert.equal((await s.read('/bottle/notes?state=nonsense')).status, 400);
  });
});

describe('limits', () => {
  it('lets each caller leave so many notes an hour', async () => {
    const s = await serve({ perHour: 2 });
    try {
      assert.equal((await s.leave()).status, 201);
      assert.equal((await s.leave()).status, 201);
      assert.equal((await s.leave()).status, 429);
      s.clock.now += 3600_001;
      assert.equal((await s.leave()).status, 201);
    } finally { await s.close(); }
  });

  it('turns away a caller who keeps trying wrong keys, even once they have the right one', async () => {
    const s = await serve({ wrongPerHour: 3 });
    try {
      for (let i = 0; i < 3; i++) assert.equal((await s.read('/bottle/notes', { authorization: 'Bearer guess' })).status, 403);
      assert.equal((await s.read('/bottle/notes', { authorization: 'Bearer guess' })).status, 429);
      assert.equal((await s.read('/bottle/notes')).status, 200, 'the right key still works');
    } finally { await s.close(); }
  });

  it('takes no notes and shows nothing without its keys', async () => {
    const s = await serve({ key: '', reader: '' });
    try {
      assert.equal((await s.call('/bottle/check', { method: 'POST', headers: { 'x-bottle-key': '' } })).status, 404);
      assert.equal((await s.leave(note(), { 'x-bottle-key': '' })).status, 404);
      assert.equal((await s.call('/bottle/notes', { headers: { authorization: 'Bearer ' } })).status, 404);
      assert.equal((await s.call('/bottle/bottle.js')).status, 200, 'the script is still there, and does nothing');
    } finally { await s.close(); }
  });
});

describe('in the Pixel Reel service', () => {
  it('is on every page of the site, and keeps notes with the reels, out of their way', async () => {
    assert.match(sitePage('home', 'https://pixelreel.pro'), /<script src="\/bottle\/bottle\.js" defer><\/script>/);
    const store = new DiskStore(join(tmp, 'service'));
    const reels = new Reels({ store });
    const server = createService({ reels, baseUrl: 'https://reels.example', bottle: { key: KEY, reader: READER } });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const res = await fetch(`${base}/bottle/notes`, { method: 'POST', headers: { origin: 'https://reels.example', 'x-bottle-key': KEY }, body: JSON.stringify(note()) });
      assert.equal(res.status, 201);
      const { id } = await res.json();
      assert.ok(existsSync(join(tmp, 'service', 'bottles', id, 'note.json')));
      assert.deepEqual(await reels.sweep(), [], 'the hourly sweep of old reels leaves notes alone');
      assert.equal((await fetch(`${base}/bottle/notes`, { method: 'POST', headers: { origin: 'https://elsewhere.example', 'x-bottle-key': KEY }, body: JSON.stringify(note()) })).status, 403);
      assert.equal((await fetch(`${base}/bottle/bottle.js`)).status, 200);
    } finally { await new Promise((ok) => server.close(ok)); }
  });
});

describe('the reader', () => {
  let s;
  before(async () => { s = await serve(); });
  after(() => s.close());

  const run = async (args, env = { BOTTLE_READER: READER }, extra = {}) => {
    const lines = [];
    const code = await bottles([...args, '--site', s.base], { env, out: (line) => lines.push(line), now: s.clock.now + 5 * 60000, ...extra });
    return { code, text: lines.join('\n') };
  };

  it('lists new notes, fetches them with their screenshots, and marks them', async () => {
    assert.equal((await run(['list'])).text, 'No new notes.');
    const { id } = await (await s.leave()).json();
    const listed = await run(['list']);
    assert.equal(listed.code, 0);
    assert.match(listed.text, new RegExp(`^${id}  new +5m  /make  h1: The heading is too big on a phone\\.$`));
    assert.equal(JSON.parse((await run(['list', '--json'])).text)[0].id, id);

    const out = join(tmp, 'fetched');
    const fetched = await run(['fetch', '--out', out]);
    assert.equal(fetched.code, 0);
    assert.equal(JSON.parse(readFileSync(join(out, id, 'note.json'), 'utf8')).note, 'The heading is too big on a phone.');
    assert.deepEqual([...readFileSync(join(out, id, 'shot.jpg')).subarray(0, 3)], [0xff, 0xd8, 0xff]);

    assert.match((await run(['show', id])).text, /"selector": "#main > h1"/);
    assert.equal((await run(['mark', id, 'fixed', '--answer', 'Smaller now.'])).text, `${id} is fixed`);
    assert.equal((await run(['list'])).text, 'No new notes.');
    assert.match((await run(['list', '--state', 'fixed'])).text, /fixed/);
  });

  it('reads the key from Secret Manager when told which secret holds it', async () => {
    const asked = [];
    const run2 = (cmd, args) => { asked.push([cmd, ...args]); return `${READER}\n`; };
    const { code } = await run(['list', '--gcloud-secret', 'bottle-reader', '--project', 'proj'], {}, { run: run2 });
    assert.equal(code, 0);
    assert.deepEqual(asked, [['gcloud', 'secrets', 'versions', 'access', 'latest', '--secret=bottle-reader', '--project=proj']]);
  });

  it('says plainly what is wrong', async () => {
    assert.match((await run(['list'], {})).text, /No reader key/);
    const wrong = await run(['list'], { BOTTLE_READER: 'wrong' });
    assert.equal(wrong.code, 1);
    assert.match(wrong.text, /403: That key is not right/);
    assert.equal((await run(['mark', 'x', 'eaten'])).code, 2);
    assert.equal((await bottles(['list'], { env: { BOTTLE_READER: READER }, out: () => {} })), 2, 'no site named');
  });
});
