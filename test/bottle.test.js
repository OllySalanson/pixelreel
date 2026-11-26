// Message in a Bottle (the message-in-a-bottle package, with tests of its own) as Pixel Reel uses
// it: on every page of the site, with its notes kept in the reels' store.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
      // the screenshot maker, found through the installed package as the image installs it
      assert.match(await (await fetch(`${base}/bottle/shot.mjs`)).text(), /domToJpeg/);

      // the service's own key is Olly's, on Pixel Reel's list, and the admin key adds other sites and the people on them
      const admin = (path, body) => fetch(`${base}/bottle/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${READER}` }, body: body && JSON.stringify(body) }).then((r) => r.json());
      const kept = JSON.parse(readFileSync(join(tmp, 'service', 'bottles', id, 'note.json'), 'utf8'));
      assert.deepEqual([kept.site, kept.person], ['pixelreel', 'olly']);
      await admin('sites', { id: 'civ-speak', name: 'Civ Speak', origins: ['https://civspeak.example'] });
      const { link } = await admin('sites/civ-speak/people', { name: 'Ann', email: 'ann@civspeak.example' });
      assert.match(link, /^https:\/\/civspeak\.example\/#bottle=/);
      assert.deepEqual((await admin('sites')).sites.map((x) => [x.id, x.name]), [['civ-speak', 'Civ Speak'], ['pixelreel', 'Pixel Reel']]);
      assert.deepEqual(await reels.sweep(), [], 'and the sweep leaves the sites and people alone too');
      assert.equal((await admin('sites')).sites.length, 2);

      // Pixel Reel's own page for signing in, kept out of search engines
      const review = await fetch(`${base}/review`);
      assert.equal(review.status, 200);
      assert.match(review.headers.get('x-robots-tag'), /noindex/);
      assert.match(await review.text(), /<meta name="robots" content="noindex/);
    } finally { await new Promise((ok) => server.close(ok)); }
  });

  it('answers Claude at /bottle/mcp/<key> for a person on a site\'s list, beside its own /mcp', async () => {
    const reels = new Reels({ store: new DiskStore(join(tmp, 'claude')) });
    const server = createService({ reels, baseUrl: 'https://reels.example', bottle: { key: KEY, reader: READER } });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const admin = (path, body) => fetch(`${base}/bottle/${path}`, { method: 'POST', headers: { authorization: `Bearer ${READER}` }, body: JSON.stringify(body) }).then((r) => r.json());
      await admin('sites', { id: 'harbour', name: 'Harbour Bakery', origins: ['https://harbour.example'] });
      await admin('sites/harbour/people', { name: 'Laura', email: 'laura@harbour.example' });
      const { address } = await admin('sites/harbour/people/laura/claude', {});
      assert.match(address, /^https:\/\/reels\.example\/bottle\/mcp\/[\w-]{32}$/);
      const ask = (message) => fetch(address.replace('https://reels.example', base), { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(message) }).then((r) => r.json());
      const sent = await ask({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'suggest_change', arguments: { change: 'Happy to be messaged on WhatsApp.' } } });
      assert.match(sent.result.content[0].text, /^Sent\. It is in the Harbour Bakery queue/);
      const { notes } = await fetch(`${base}/bottle/notes?state=all&site=harbour`, { headers: { authorization: `Bearer ${READER}` } }).then((r) => r.json());
      assert.deepEqual(notes.map((n) => [n.note, n.via, n.by]), [['Happy to be messaged on WhatsApp.', 'claude', 'Laura']]);
      // Pixel Reel's own connector is still its own
      const own = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }).then((r) => r.json());
      assert.ok(own.result.tools.some((tool) => tool.name === 'make_reel'));
    } finally { await new Promise((ok) => server.close(ok)); }
  });

  it('sends a note said aloud to the service\'s /hear where the browser cannot hear, when hearing is on', async () => {
    const reels = new Reels({ store: new DiskStore(join(tmp, 'hear')) });
    const heardIn = async (hearing) => {
      const server = createService({ reels, baseUrl: 'https://reels.example', hearing, bottle: { key: KEY, reader: READER } });
      await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
      try {
        const base = `http://127.0.0.1:${server.address().port}`;
        return /const HEAR = ([^;]+);/.exec(await (await fetch(`${base}/bottle/bottle-ui.mjs`)).text())[1];
      } finally { await new Promise((ok) => server.close(ok)); }
    };
    assert.equal(await heardIn({ hear: async () => '' }), '"/hear"');
    assert.equal(await heardIn(null), 'null', 'without it, Speak is only where the browser hears');
  });
});
