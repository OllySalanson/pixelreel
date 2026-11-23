// Message in a Bottle: the endpoint that checks each person's key, takes the notes they leave
// and sends sign-in links, and the admin tool that adds sites and people and works through the
// notes. The button itself is checked in a browser (README.md). Needs nothing but Node and
// this folder: run with npm test here.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { main as bottles } from '../bottles.mjs';
import { doneMail, inviteMail, resend, signInMail } from '../mail.mjs';
import { clientView, createBottle, MAX_BYTES, MAX_SHOT, noteFrom, outcomeFrom, shotFrom } from '../server.mjs';
import { slug } from '../sites.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-bottle-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** A store kept in memory, with the three things the endpoint asks of one. */
export class MemoryStore {
  constructor() { this.items = new Map(); }
  async put(key, data) { this.items.set(key, Buffer.from(data)); }
  async get(key) { return this.items.get(key) ?? null; }
  async folders(prefix) {
    return [...new Set([...this.items.keys()].filter((k) => k.startsWith(`${prefix}/`) && k.slice(prefix.length + 1).includes('/')).map((k) => k.slice(prefix.length + 1).split('/')[0]))];
  }
}

const HOME = 'https://site.example', CLIENT = 'https://client.example';
const KEY = 'owner-secret-key', READER = 'admin-secret-key';
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2, 3]).toString('base64')}`;
const note = (extra = {}) => ({
  note: 'The heading is too big on a phone.',
  page: { url: `${HOME}/make`, title: 'Make a pixel reel' },
  target: { whole: false, selector: '#main > h1', tag: 'h1', text: 'Make a pixel reel', rect: { x: 10, y: 20.4, width: 300, height: 60 } },
  viewport: { width: 390, height: 844, scale: 3, scrollX: 0, scrollY: 120 },
  browser: 'Test browser', settings: { size: '2', font: 'lexend' }, shot: JPEG, ...extra
});
const DONE = { state: 'done', what: 'Made the heading smaller on a phone.', confidence: 90 };

/** A bottle on a server of its own, with a clock that can be moved on. */
async function serve(options = {}) {
  const clock = { now: Date.parse('2026-11-22T12:00:00Z') };
  const store = new MemoryStore();
  const bottle = createBottle({ store, key: KEY, reader: READER, origins: [HOME], home: { id: 'home', name: 'Home' }, owner: { id: 'olly', name: 'Olly' }, review: '/review', from: 'Olly', wrongPerHour: 1000, now: () => clock.now, ...options });
  const server = createServer(async (req, res) => { if (!(await bottle.handle(req, res))) res.writeHead(418).end(); });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', headers = {}, body } = {}) => fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  // a second apart, as notes are, so they sort by when they were left
  const leave = (body = note(), headers = {}) => (clock.now += 1000) && call('/bottle/notes', { method: 'POST', headers: { 'content-type': 'application/json', origin: HOME, 'x-bottle-key': KEY, ...headers }, body });
  const read = (path, headers = {}) => call(path, { headers: { authorization: `Bearer ${READER}`, ...headers } });
  const admin = async (path, method, body) => {
    const res = await call(`/bottle/${path}`, { method, headers: { authorization: `Bearer ${READER}`, 'content-type': 'application/json' }, body });
    return { status: res.status, body: await res.json() };
  };
  const check = (key, origin = HOME) => call('/bottle/check', { method: 'POST', headers: { origin, 'x-bottle-key': key } });
  const mark = (id, body) => admin(`notes/${id}`, 'PATCH', body);
  const outbox = async () => { await bottle.idle(); return (await admin('outbox', 'GET')).body.mails; };
  /** Adds the client's site and a person on its list, and gives their key. */
  const client = async (email = 'sam@client.example', name = 'Sam Smith') => {
    await admin('sites', 'POST', { id: 'client', name: 'Client Ltd', origins: [CLIENT] });
    const made = await admin('sites/client/people', 'POST', { name, email });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    return { ...made.body, key: new URL(made.body.link).searchParams.get('bottle') };
  };
  return { server, base, store, clock, bottle, call, leave, read, admin, check, mark, outbox, client, close: () => new Promise((ok) => server.close(ok)) };
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
    assert.equal(kept.spoken, false);
    assert.equal(noteFrom({ ...note(), spoken: true }).spoken, true);
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

  it('says what came of a note: done with how sure, held with the conflict and a way out, declined in a sentence or two', () => {
    assert.deepEqual(outcomeFrom('done', { what: ' Smaller. ', confidence: 87.6 }), { what: 'Smaller.', confidence: 88 });
    assert.throws(() => outcomeFrom('done', { what: 'Smaller.' }), /confidence/);
    assert.throws(() => outcomeFrom('done', { confidence: 50 }), /what was done/);
    assert.throws(() => outcomeFrom('done', { what: 'x', confidence: 101 }), /confidence/);
    assert.deepEqual(outcomeFrom('held', { conflict: 'SEO: the page title is what people search for.', proposal: 'Change the heading but keep the title.' }),
      { conflict: 'SEO: the page title is what people search for.', proposal: 'Change the heading but keep the title.' });
    assert.throws(() => outcomeFrom('held', { conflict: 'Brand' }), /proposal/);
    const reason = "We haven't removed the Worthing page. It brings in about 4 enquiries a month, and removing it would lose most of them.";
    assert.deepEqual(outcomeFrom('declined', { reason }), { reason });
    assert.throws(() => outcomeFrom('declined', { reason: 'No.' }), /We haven't done this because/);
    assert.throws(() => outcomeFrom('declined', { reason: "We haven't done it. One. Two. Three." }), /one or two sentences/);
    assert.deepEqual(outcomeFrom('in-progress', { what: 'ignored' }), {});
  });

  it('shows its writer only what is theirs to see: a held note is in progress, and only done and declined notes say what came of them', () => {
    const kept = { id: 'x', at: 'now', note: 'Bigger logo', page: { url: 'u' }, state: 'held', outcome: { conflict: 'Brand', proposal: 'p' } };
    assert.deepEqual(clientView(kept), { id: 'x', at: 'now', note: 'Bigger logo', page: 'u', state: 'in-progress' });
    assert.equal(clientView({ ...kept, state: 'done', outcome: { what: 'Bigger now.', confidence: 80 } }).what, 'Bigger now.');
    assert.equal(clientView({ ...kept, state: 'done', outcome: { what: 'w', confidence: 80 } }).confidence, undefined);
    assert.equal(clientView({ ...kept, state: 'declined', outcome: { reason: "We haven't, because." } }).reason, "We haven't, because.");
  });
});

describe('the emails', () => {
  const site = { name: 'Client Ltd', origins: [CLIENT] }, person = { name: 'Sam Smith', email: 'sam@client.example' };

  it('invites a person with their own link and the short address for next time', () => {
    const mail = inviteMail({ site, person, key: 'k-1', from: 'Olly' });
    assert.equal(mail.to, 'sam@client.example');
    assert.equal(mail.subject, 'Review your website');
    assert.match(mail.text, /^Hello Sam,/);
    assert.ok(mail.text.includes(`${CLIENT}/?bottle=k-1`));
    assert.ok(mail.text.includes('go to client.example/review'));
    assert.match(mail.text, /\n\nOlly$/);
  });

  it('sends a sign-in link that works once, and says when a note is done', () => {
    assert.ok(signInMail({ site, person, key: 'c-1' }).text.includes(`${CLIENT}/?bottle=c-1`));
    const done = doneMail({ site, person, note: { note: 'Bigger logo', page: { url: `${CLIENT}/about` }, outcome: { what: 'The logo is bigger.' } } });
    assert.equal(done.subject, 'Your note is done');
    assert.match(done.text, /You asked: "Bigger logo"\n\nWhat we did: The logo is bigger\.\n\nSee it here: https:\/\/client\.example\/about/);
  });

  it('sends through Resend, from the address given, and says when Resend will not', async () => {
    const asked = [];
    const fake = async (url, init) => { asked.push([url, init]); return new Response('{"id":"e-1"}', { status: 200 }); };
    const send = resend({ key: 're_test', from: 'Olly <notes@example.com>', fetch: fake });
    await send(inviteMail({ site, person, key: 'k-1' }));
    const [[url, init]] = asked;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.headers.authorization, 'Bearer re_test');
    const body = JSON.parse(init.body);
    assert.deepEqual([body.from, body.to, body.subject], ['Olly <notes@example.com>', ['sam@client.example'], 'Review your website']);
    assert.ok(body.text.includes('?bottle=k-1'));
    const refused = resend({ key: 're_test', from: 'x@example.com', fetch: async () => new Response('{"message":"domain not verified"}', { status: 403 }) });
    await assert.rejects(refused({ to: 'a@b.example', subject: 'Hi', text: 'x' }), /Resend would not send "Hi": 403 .*domain not verified/);
    assert.throws(() => resend({ key: '', from: 'x@example.com' }), /API key/);
  });

  it('makes an id from a name', () => {
    assert.equal(slug("Sam O'Neill"), 'sam-oneill');
    assert.equal(slug('Zoë Ålund'), 'zoe-alund');
    assert.equal(slug('***'), 'person');
  });
});

describe('the endpoint', () => {
  let s;
  before(async () => { s = await serve(); });
  after(() => s.close());

  it('serves the button, the rest of it, the screenshot maker and the page of queues, to any site', async () => {
    for (const name of ['bottle.js', 'bottle-ui.mjs', 'shot.mjs', 'admin.mjs', 'admin.css']) {
      const res = await s.call(`/bottle/${name}`);
      assert.equal(res.status, 200, name);
      assert.match(res.headers.get('content-type'), name.endsWith('.css') ? /^text\/css/ : /^text\/javascript/);
      assert.equal(res.headers.get('access-control-allow-origin'), '*');
      assert.ok((await res.text()).length > 500, name);
    }
    const tag = (await s.call('/bottle/bottle.js')).headers.get('etag');
    assert.equal((await s.call('/bottle/bottle.js', { headers: { 'if-none-match': tag } })).status, 304);
  });

  it('answers only under its own address and at its review page', async () => {
    assert.equal((await s.call('/elsewhere')).status, 418);
    assert.equal((await s.call('/bottles')).status, 418);
    assert.equal((await s.call('/reviews')).status, 418);
    assert.equal((await s.call('/bottle/nothing')).status, 404);
  });

  it('keeps search engines out of everything it answers', async () => {
    for (const path of ['/review', '/review/', '/bottle/admin', '/bottle/bottle.js', '/bottle/nothing', '/bottle/notes']) {
      const res = await s.call(path);
      assert.match(res.headers.get('x-robots-tag') ?? '', /noindex/, path);
    }
    for (const path of ['/review', '/bottle/admin']) {
      const res = await s.call(path);
      assert.equal(res.status, 200, path);
      const html = await res.text();
      assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/, path);
      assert.match(res.headers.get('content-security-policy'), /script-src 'self'/, path);
      assert.doesNotMatch(html, /<body>[^<]/, 'nothing on it to read');
    }
    assert.match(await (await s.call('/review')).text(), /<script src="\/bottle\/bottle\.js" data-review="" defer><\/script>/);
  });

  it('says whether a key is the right one, from the right site', async () => {
    assert.equal((await s.check(KEY)).status, 200);
    assert.equal((await s.check('a-wrong-key')).status, 403);
    assert.equal((await s.check(KEY, 'https://elsewhere.example')).status, 403);
  });

  it('keeps a note and its screenshot, and only whoever holds the admin key, or the owner, can see them', async () => {
    const res = await s.leave();
    assert.equal(res.status, 201);
    const { id } = await res.json();
    const kept = JSON.parse(await s.store.get(`bottles/${id}/note.json`));
    assert.equal(kept.note, 'The heading is too big on a phone.');
    assert.equal(kept.shot, true);
    assert.deepEqual([kept.site, kept.person, kept.by], ['home', 'olly', 'Olly']);
    assert.deepEqual([...(await s.store.get(`bottles/${id}/shot.jpg`)).subarray(0, 3)], [0xff, 0xd8, 0xff]);

    for (const path of ['/bottle/notes', `/bottle/notes/${id}`, `/bottle/notes/${id}/shot.jpg`, '/bottle/sites', '/bottle/sites/home', '/bottle/outbox']) {
      assert.equal((await s.call(path)).status, 403, path);
      assert.equal((await s.call(path, { headers: { authorization: `Bearer ${KEY}` } })).status, 403, path);
    }
    const list = await (await s.read('/bottle/notes')).json();
    assert.deepEqual(list.notes.map((n) => n.id), [id]);
    // the owner's own key, as the page of queues sends it from the home site
    assert.equal((await s.call('/bottle/notes', { headers: { 'x-bottle-key': KEY, origin: HOME } })).status, 200);
    assert.equal((await s.call('/bottle/notes', { headers: { 'x-bottle-key': KEY, origin: CLIENT } })).status, 403);
    const shot = await s.read(`/bottle/notes/${id}/shot.jpg`);
    assert.equal(shot.headers.get('content-type'), 'image/jpeg');
    assert.equal((await s.read(`/bottle/notes/${id}`)).status, 200);
    assert.equal((await s.read('/bottle/notes/20261122-120000-00000000')).status, 404);
  });

  it('keeps a note with no screenshot when the browser could not make one, or made one too big', async () => {
    const { id } = await (await s.leave(note({ shot: null }))).json();
    assert.equal(JSON.parse(await s.store.get(`bottles/${id}/note.json`)).shot, false);
    assert.equal((await s.read(`/bottle/notes/${id}/shot.jpg`)).status, 404);
    const huge = Buffer.alloc(MAX_SHOT + 10, 1);
    huge.set([0xff, 0xd8, 0xff]);
    const big = await s.leave(note({ shot: `data:image/jpeg;base64,${huge.toString('base64')}` }));
    assert.equal(big.status, 201);
    assert.equal(JSON.parse(await s.store.get(`bottles/${(await big.json()).id}/note.json`)).shot, false);
  });

  it('turns away a note with the wrong key, from another site, with no words or too big', async () => {
    assert.equal((await s.leave(note(), { 'x-bottle-key': 'a-wrong-key' })).status, 403);
    assert.equal((await s.leave(note(), { origin: 'https://elsewhere.example' })).status, 403);
    assert.equal((await s.leave(note({ note: '' }))).status, 400);
    assert.equal((await s.leave('{not json')).status, 400);
    const big = await s.leave(note({ shot: `data:image/jpeg;base64,${'A'.repeat(MAX_BYTES)}` })).catch(() => null);
    assert.ok(!big || big.status === 413);
  });

  it('marks a note with what came of it, and lists by state and site', async () => {
    const { id } = await (await s.leave()).json();
    assert.equal((await s.mark(id, { state: 'gone' })).status, 400);
    assert.equal((await s.call(`/bottle/notes/${id}`, { method: 'PATCH', body: DONE })).status, 403);
    assert.match((await s.mark(id, { state: 'done', what: 'Smaller.' })).body.error, /confidence/);
    assert.equal((await s.mark(id, { state: 'in-progress' })).body.state, 'in-progress');
    const marked = (await s.mark(id, DONE)).body;
    assert.equal(marked.state, 'done');
    assert.deepEqual(marked.outcome, { what: DONE.what, confidence: 90 });
    assert.deepEqual(marked.history.map((h) => h.state), ['in-progress', 'done']);
    const done = await (await s.read('/bottle/notes?state=done')).json();
    assert.deepEqual(done.notes.map((n) => n.id), [id]);
    assert.ok(!(await (await s.read('/bottle/notes')).json()).notes.some((n) => n.id === id), 'no longer new');
    assert.ok((await (await s.read('/bottle/notes?state=all&site=home')).json()).notes.some((n) => n.id === id));
    assert.equal((await (await s.read('/bottle/notes?state=all&site=client')).json()).notes.length, 0);
    assert.equal((await s.read('/bottle/notes?state=nonsense')).status, 400);
  });

  it('reads notes kept before there were sites, in the states they are called now', async () => {
    const old = { ...noteFrom(note(), new Date('2026-11-21T10:00:00Z')), state: 'fixed' };
    delete old.outcome;
    await s.store.put(`bottles/${old.id}/note.json`, JSON.stringify(old));
    const seen = (await s.read(`/bottle/notes/${old.id}`).then((r) => r.json()));
    assert.deepEqual([seen.state, seen.site], ['done', 'home']);
  });
});

describe('sites and the people on their lists', () => {
  let s;
  before(async () => { s = await serve(); });
  after(() => s.close());

  it('adds a site and a person, whose own link switches the button on, on that site only', async () => {
    const sam = await s.client();
    assert.equal(sam.person.id, 'sam-smith');
    assert.match(sam.link, /^https:\/\/client\.example\/\?bottle=[\w-]{32}$/);
    assert.equal((await s.check(sam.key, CLIENT)).status, 200);
    assert.equal((await s.check(sam.key, HOME)).status, 403, 'not on another site');
    const res = await s.leave(note({ page: { url: `${CLIENT}/about` } }), { origin: CLIENT, 'x-bottle-key': sam.key });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    const kept = JSON.parse(await s.store.get(`bottles/${(await res.json()).id}/note.json`));
    assert.deepEqual([kept.site, kept.person, kept.by], ['client', 'sam-smith', 'Sam Smith']);
    // a person's key reads no notes
    assert.equal((await s.call('/bottle/notes', { headers: { 'x-bottle-key': sam.key, origin: CLIENT } })).status, 403);
    // and the store holds no key that works
    assert.ok(![...s.store.items.values()].some((bytes) => bytes.includes(sam.key)));
  });

  it('turns one person off, and their keys show nothing, while everyone else\'s still work', async () => {
    const jo = (await s.admin('sites/client/people', 'POST', { name: 'Jo', email: 'jo@client.example' })).body;
    const joKey = new URL(jo.link).searchParams.get('bottle');
    const sam = (await s.admin('sites/client', 'GET')).body.people.find((p) => p.id === 'sam-smith');
    assert.equal(sam.on, true);
    assert.equal(sam.key, undefined, 'no key is shown');
    const off = await s.admin('sites/client/people/jo/', 'PATCH', { on: false });
    assert.equal(off.status, 404, 'an id is exact');
    assert.equal((await s.admin('sites/client/people/jo', 'PATCH', { on: false })).body.on, false);
    assert.equal((await s.check(joKey, CLIENT)).status, 403);
    assert.equal((await s.leave(note(), { origin: CLIENT, 'x-bottle-key': joKey })).status, 403);
    assert.equal((await s.admin('sites/client/people/jo', 'PATCH', { on: true })).body.on, true);
    assert.equal((await s.check(joKey, CLIENT)).status, 200);
  });

  it('says what is wrong with a site or person it is asked to add', async () => {
    assert.match((await s.admin('sites', 'POST', { id: 'Bad Id', origins: [CLIENT] })).body.error, /short, in lower case/);
    assert.match((await s.admin('sites', 'POST', { id: 'nowhere' })).body.error, /Name the site's address/);
    assert.match((await s.admin('sites', 'POST', { id: 'x', origins: ['not an address'] })).body.error, /is not an address/);
    assert.match((await s.admin('sites/client/people', 'POST', { name: 'Sam Again', email: 'SAM@client.example' })).body.error, /on Client Ltd's list already/);
    assert.match((await s.admin('sites/client/people', 'POST', { name: 'No Email' })).body.error, /email address/);
    assert.equal((await s.admin('sites/nobody/people', 'POST', { name: 'A', email: 'a@b.example' })).status, 400);
    assert.equal((await s.admin('sites/client/people/nobody', 'PATCH', { on: false })).status, 404);
    assert.equal((await s.admin('sites/home/people/olly', 'PATCH', { on: false })).status, 400, 'the owner is the service\'s setting');
  });

  it('lets pages on the sites it knows reach it from their own address, and no others', async () => {
    const ask = (origin) => s.call('/bottle/notes', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-bottle-key' } });
    const res = await ask(CLIENT);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    assert.match(res.headers.get('access-control-allow-headers'), /x-bottle-key/);
    assert.equal((await ask('https://elsewhere.example')).status, 403);
    assert.equal((await s.check('a-wrong-key', 'https://elsewhere.example')).headers.get('access-control-allow-origin'), null);
  });

  it('sends the invitation with the sender it is given, and keeps nothing in the outbox then', async () => {
    const sent = [];
    const t = await serve({ mail: async (m) => { sent.push(m); } });
    try {
      await t.client();
      const res = await t.admin('sites/client/people/sam-smith/invite', 'POST', {});
      assert.deepEqual(res.body, { to: 'sam@client.example', sent: true });
      assert.deepEqual(sent.map((m) => [m.to, m.subject]), [['sam@client.example', 'Review your website']]);
      assert.deepEqual(await t.outbox(), []);
    } finally { await t.close(); }
  });

  it('gives a new link, and sends the invitation only to the outbox', async () => {
    const link = (await s.admin('sites/client/people/sam-smith/link', 'POST', {})).body.link;
    assert.equal((await s.check(new URL(link).searchParams.get('bottle'), CLIENT)).status, 200);
    const sent = await s.admin('sites/client/people/sam-smith/invite', 'POST', { to: 'test@olly.example' });
    assert.deepEqual(sent.body, { to: 'test@olly.example', sent: false });
    const [mail] = await s.outbox();
    assert.equal(mail.to, 'test@olly.example');
    assert.equal(mail.subject, 'Review your website');
    const key = /\?bottle=([\w-]+)/.exec(mail.text)[1];
    assert.equal((await s.check(key, CLIENT)).status, 200, 'the invitation\'s link works');
  });

  it('counts each site\'s notes by state', async () => {
    const { sites } = (await s.admin('sites', 'GET')).body;
    assert.deepEqual(sites.map((x) => x.id), ['client', 'home']);
    const client = sites.find((x) => x.id === 'client');
    assert.deepEqual(client.counts, { new: 1, 'in-progress': 0, held: 0, declined: 0, done: 0, closed: 0 });
    assert.deepEqual(client.origins, [CLIENT]);
    assert.deepEqual(sites.find((x) => x.id === 'home').people.map((p) => [p.id, p.owner]), [['olly', true]]);
  });
});

describe('signing in at a site\'s /review page', () => {
  let s, sam;
  before(async () => { s = await serve(); sam = await s.client(); });
  after(() => s.close());
  const signIn = (email, origin = CLIENT) => s.call('/bottle/signin', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: { email } });

  it('emails someone on the list a link that works once, for half an hour', async () => {
    const res = await signIn(' Sam@Client.example ');
    assert.equal(res.status, 202);
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    const [mail] = await s.outbox();
    assert.equal(mail.to, 'sam@client.example');
    const code = /\?bottle=([\w-]+)/.exec(mail.text)[1];
    assert.notEqual(code, sam.key);
    const swapped = await s.check(code, CLIENT);
    assert.equal(swapped.status, 200);
    const { key } = await swapped.json();
    assert.match(key, /^[\w-]{32}$/);
    assert.equal((await s.check(key, CLIENT)).status, 200, 'the browser keeps a key of its own');
    assert.equal((await s.check(code, CLIENT)).status, 403, 'the link works once');

    await signIn('sam@client.example');
    const late = /\?bottle=([\w-]+)/.exec((await s.outbox())[0].text)[1];
    s.clock.now += 31 * 60_000;
    assert.equal((await s.check(late, CLIENT)).status, 403, 'and for half an hour');
  });

  it('answers the same to anyone not on the list, and sends them nothing', async () => {
    const before = (await s.outbox()).length;
    const res = await signIn('stranger@elsewhere.example');
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal((await s.outbox()).length, before);
    assert.equal((await signIn('sam@client.example', 'https://elsewhere.example')).status, 403);
    assert.equal((await signIn('not an address')).status, 202);
    assert.equal((await signIn('')).status, 400);
    await s.admin('sites/client/people/sam-smith', 'PATCH', { on: false });
    await signIn('sam@client.example');
    assert.equal((await s.outbox()).length, before, 'nor to someone turned off');
    await s.admin('sites/client/people/sam-smith', 'PATCH', { on: true });
  });

  it('sends only so many links an hour', async () => {
    const t = await serve({ signInsPerHour: 2 });
    try {
      await t.client();
      const ask = () => t.call('/bottle/signin', { method: 'POST', headers: { origin: CLIENT }, body: { email: 'x@client.example' } });
      assert.equal((await ask()).status, 202);
      assert.equal((await ask()).status, 202);
      assert.equal((await ask()).status, 429);
    } finally { await t.close(); }
  });
});

describe('what a person sees of their own notes', () => {
  let s, sam, jo;
  before(async () => {
    s = await serve();
    sam = await s.client();
    jo = (await s.admin('sites/client/people', 'POST', { name: 'Jo', email: 'jo@client.example' })).body;
    jo.key = new URL(jo.link).searchParams.get('bottle');
  });
  after(() => s.close());
  const leave = async (who, words) => (await (await s.leave(note({ note: words }), { origin: CLIENT, 'x-bottle-key': who.key })).json()).id;
  const mine = async (who) => (await (await s.call('/bottle/mine', { headers: { origin: CLIENT, 'x-bottle-key': who.key } })).json()).notes;

  it('lists only their own, newest first, with what came of each, and emails them once when one is done', async () => {
    const a = await leave(sam, 'Bigger logo'), b = await leave(sam, 'Remove the Worthing page'), c = await leave(sam, 'Purple buttons');
    await leave(jo, 'Jo\'s note');
    await s.mark(a, DONE);
    await s.mark(b, { state: 'declined', reason: "We haven't removed the Worthing page. It brings in about 4 enquiries a month." });
    await s.mark(c, { state: 'held', conflict: 'Brand: the buttons are the brand\'s yellow.', proposal: 'A purple outline instead.' });
    const seen = await mine(sam);
    assert.deepEqual(seen.map((n) => [n.note, n.state]), [['Purple buttons', 'in-progress'], ['Remove the Worthing page', 'declined'], ['Bigger logo', 'done']]);
    assert.equal(seen[0].conflict, undefined);
    assert.match(seen[1].reason, /^We haven't removed/);
    assert.equal(seen[2].what, DONE.what);
    assert.deepEqual((await mine(jo)).map((n) => n.note), ['Jo\'s note']);

    const mails = (await s.outbox()).filter((m) => m.subject === 'Your note is done');
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, 'sam@client.example');
    await s.mark(a, { state: 'in-progress' });
    await s.mark(a, DONE);
    assert.equal((await s.outbox()).filter((m) => m.subject === 'Your note is done').length, 1, 'once');
  });

  it('closes a done note when its writer says it is right, and nobody else\'s', async () => {
    const [done] = (await mine(sam)).filter((n) => n.state === 'done');
    const close = (who, id) => s.call(`/bottle/mine/${id}/closed`, { method: 'POST', headers: { origin: CLIENT, 'x-bottle-key': who.key } });
    assert.equal((await close(jo, done.id)).status, 404);
    const res = await close(sam, done.id);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).state, 'closed');
    const [held] = (await mine(sam)).filter((n) => n.state === 'in-progress');
    assert.equal((await close(sam, held.id)).status, 409);
    assert.equal((await s.call('/bottle/mine', { headers: { origin: CLIENT, 'x-bottle-key': 'a-wrong-key' } })).status, 403);
  });
});

describe('limits', () => {
  it('lets each person leave so many notes an hour', async () => {
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
      assert.equal((await s.check('a-wrong-key')).status, 429);
      assert.equal((await s.read('/bottle/notes')).status, 200, 'the right key still works');
    } finally { await s.close(); }
  });

  it('takes no notes and shows nothing without its keys', async () => {
    const s = await serve({ key: '', reader: '' });
    try {
      assert.equal((await s.check('')).status, 403);
      assert.equal((await s.leave(note(), { 'x-bottle-key': '' })).status, 403);
      assert.equal((await s.call('/bottle/notes', { headers: { authorization: 'Bearer ' } })).status, 404);
      assert.equal((await s.call('/bottle/sites')).status, 404);
      assert.equal((await s.call('/bottle/bottle.js')).status, 200, 'the script is still there, and does nothing');
    } finally { await s.close(); }
  });
});

describe('the admin tool', () => {
  let s;
  before(async () => { s = await serve(); });
  after(() => s.close());

  const run = async (args, env = { BOTTLE_READER: READER }, extra = {}) => {
    const lines = [];
    const code = await bottles([...args, '--service', s.base], { env, out: (line) => lines.push(line), now: s.clock.now + 5 * 60000, ...extra });
    return { code, text: lines.join('\n') };
  };

  it('adds a site and the people on its list, prints their links, and turns one off', async () => {
    assert.equal((await run(['site', 'add', 'civ-speak', '--name', 'Civ Speak', '--origin', 'https://civspeak.example'])).text, 'civ-speak is Civ Speak, at https://civspeak.example');
    const added = await run(['person', 'add', 'civ-speak', '--name', 'Ann Lee', '--email', 'ann@civspeak.example']);
    assert.equal(added.code, 0);
    assert.match(added.text, /^Ann Lee \(ann-lee\) is on civ-speak's list\. Their link:\nhttps:\/\/civspeak\.example\/\?bottle=[\w-]{32}$/);
    assert.match((await run(['people', 'civ-speak'])).text, /^ann-lee +on +Ann Lee {2}ann@civspeak\.example$/);
    assert.equal((await run(['person', 'off', 'civ-speak', 'ann-lee'])).text, 'Ann Lee is off');
    assert.match((await run(['people', 'civ-speak'])).text, /^ann-lee +off/);
    assert.equal((await run(['person', 'on', 'civ-speak', 'ann-lee'])).text, 'Ann Lee is on');
    assert.match((await run(['person', 'link', 'civ-speak', 'ann-lee'])).text, /^https:\/\/civspeak\.example\/\?bottle=/);
    assert.equal((await run(['invite', 'civ-speak', 'ann-lee', '--to', 'test@olly.example'])).text, 'The invitation to test@olly.example is in the outbox, not sent.');
    assert.match((await run(['outbox'])).text, /to test@olly\.example {2}"Review your website"\n {4}Hello Ann,/);
    assert.match((await run(['sites'])).text, /^civ-speak +Civ Speak {2}https:\/\/civspeak\.example {2}1 on the list {2}no notes$/m);
  });

  it('works through a site\'s queue: lists it, fetches it with its screenshots, marks each note, and shows the results', async () => {
    assert.equal((await run(['queue', 'home'])).text, 'No open notes on home.');
    const ids = [];
    for (const words of ['The heading is too big on a phone.', 'Make the logo purple.', 'Remove the Worthing page.']) ids.push((await (await s.leave(note({ note: words }))).json()).id);
    const queued = await run(['queue', 'home']);
    assert.equal(queued.code, 0);
    assert.match(queued.text.split('\n')[0], new RegExp(`^${ids[0]}  new +5m  home /make  h1: The heading is too big on a phone\\.$`));
    assert.equal(JSON.parse((await run(['queue', 'home', '--json'])).text).length, 3);

    const out = join(tmp, 'fetched');
    assert.equal((await run(['fetch', '--site', 'home', '--state', 'open', '--out', out])).code, 0);
    assert.equal(JSON.parse(readFileSync(join(out, ids[0], 'note.json'), 'utf8')).note, 'The heading is too big on a phone.');
    assert.deepEqual([...readFileSync(join(out, ids[0], 'shot.jpg')).subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.match((await run(['show', ids[0]])).text, /"selector": "#main > h1"/);

    assert.equal((await run(['start', ids[0]])).text, `${ids[0]} is in-progress`);
    assert.equal((await run(['done', ids[0], '--what', 'Smaller on a phone now.', '--confidence', '90'])).text, `${ids[0]} is done`);
    assert.equal((await run(['held', ids[1], '--conflict', 'Brand: the logo is yellow.', '--proposal', 'A purple badge beside it.'])).text, `${ids[1]} is held`);
    const declined = await run(['declined', ids[2], '--reason', 'Gone.']);
    assert.equal(declined.code, 1);
    assert.match(declined.text, /^400: Give the reason as "We haven't done this because\.\.\."/);
    assert.equal((await run(['declined', ids[2], '--reason', "We haven't removed the Worthing page. It brings in about 4 enquiries a month."])).text, `${ids[2]} is declined`);
    assert.match((await run(['done', ids[1], '--what', 'x'])).text, /confidence/);

    assert.equal((await run(['results', 'home'])).text, [
      '| Request | State | What was done | Confidence | Conflict |',
      '| --- | --- | --- | --- | --- |',
      '| The heading is too big on a phone. | done | Smaller on a phone now. | 90% |   |',
      '| Make the logo purple. | held | Held: A purple badge beside it. |   | Brand: the logo is yellow. |',
      "| Remove the Worthing page. | declined | We haven't removed the Worthing page. It brings in about 4 enquiries a month. |   |   |"
    ].join('\n'));
    assert.match((await run(['queue', 'home'])).text, /held/);
    assert.equal((await run(['close', ids[0]])).text, `${ids[0]} is closed`);
    assert.match((await run(['list', '--state', 'closed'])).text, /closed/);
  });

  it('reads the key from Secret Manager when told which secret holds it', async () => {
    const asked = [];
    const run2 = (cmd, args) => { asked.push([cmd, ...args]); return `${READER}\n`; };
    const { code } = await run(['list', '--gcloud-secret', 'bottle-reader', '--project', 'proj'], {}, { run: run2 });
    assert.equal(code, 0);
    assert.deepEqual(asked, [['gcloud', 'secrets', 'versions', 'access', 'latest', '--secret=bottle-reader', '--project=proj']]);
  });

  it('says plainly what is wrong', async () => {
    assert.match((await run(['list'], {})).text, /No admin key/);
    const wrong = await run(['list'], { BOTTLE_READER: 'wrong' });
    assert.equal(wrong.code, 1);
    assert.match(wrong.text, /^403: That key is not right/);
    assert.equal((await run(['mark', 'x', 'eaten'])).code, 2);
    assert.equal((await run(['queue'])).code, 2);
    assert.equal((await bottles(['list'], { env: { BOTTLE_READER: READER }, out: () => {} })), 2, 'no service named');
    const gone = await bottles(['list', '--service', 'http://127.0.0.1:9'], { env: { BOTTLE_READER: READER }, out: () => {} });
    assert.equal(gone, 1);
  });
});
