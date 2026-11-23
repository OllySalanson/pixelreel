// Message in a Bottle (bottle/, a package of its own with its own tests) as Pixel Reel uses
// it: on every page of the site, with its notes kept in the reels' store.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { Reels } from '../service/reels.mjs';
import { createService } from '../service/server.mjs';
import { sitePage } from '../service/site.mjs';
import { DiskStore } from '../service/store.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-bottle-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const KEY = 'link-secret', READER = 'reader-secret';
const note = () => ({ note: 'The heading is too big on a phone.', page: { url: 'https://reels.example/make' }, target: { tag: 'h1' } });

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
