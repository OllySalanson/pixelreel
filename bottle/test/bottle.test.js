// Message in a Bottle: the endpoint that checks each person's key, takes the notes they leave
// and sends sign-in links, and the admin tool that adds sites and people and works through the
// notes. The button itself is checked in a browser (README.md). Needs nothing but Node and
// this folder: run with npm test here.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { main as bottles } from '../bottles.mjs';
import { decide, pressedPart } from '../bottle-ui.mjs';
import { arrivedMail, inviteMail, newsMail, resend, signInMail } from '../mail.mjs';
import { clientView, createBottle, MAX_BYTES, MAX_SHOT, noteFrom, outcomeFrom, shotFrom } from '../server.mjs';
import { slug } from '../sites.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-bottle-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** A store kept in memory, with the three things the endpoint asks of one. */
export class MemoryStore {
  constructor() { this.items = new Map(); }
  async put(key, data) { this.items.set(key, Buffer.from(data)); }
  async get(key) { return this.items.get(key) ?? null; }
  async remove(prefix) { for (const key of [...this.items.keys()]) if (key.startsWith(`${prefix}/`)) this.items.delete(key); }
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
const DECLINED = { state: 'declined', reason: "We haven't removed the Worthing page. It brings in about 4 enquiries a month." };
/** The code in a link from an email: after #bottle=, or ?bottle= in links sent before. */
const codeIn = (text) => /[#?]bottle=([\w-]+)/.exec(text)?.[1] ?? null;
const MINUTE = 60_000, HOUR = 3600_000;

/** A bottle on a server of its own, with a clock that can be moved on. */
async function serve(options = {}) {
  const clock = { now: Date.parse('2026-11-22T12:00:00Z') };
  const store = new MemoryStore();
  const bottle = createBottle({ store, key: KEY, reader: READER, origins: [HOME], home: { id: 'home', name: 'Home' }, owner: { id: 'olly', name: 'Olly' }, review: '/review', from: 'Olly', wrongPerHour: 1000, every: 0, now: () => clock.now, ...options });
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
  /** Presses a link's button: swaps its code for a key of the browser's own. */
  const use = (code, origin = CLIENT) => call('/bottle/check', { method: 'POST', headers: { origin, 'x-bottle-key': code, 'content-type': 'application/json' }, body: { use: true } });
  const keyFor = async (code, origin = CLIENT) => { const res = await use(code, origin); assert.equal(res.status, 200, 'the link works'); return (await res.json()).key; };
  const mark = (id, body) => admin(`notes/${id}`, 'PATCH', body);
  const outbox = async () => { await bottle.idle(); return (await admin('outbox', 'GET')).body.mails; };
  /** Adds the client's site and a person on its list, and gives their link's code and the key one browser swapped it for. */
  const client = async (email = 'sam@client.example', name = 'Sam Smith') => {
    await admin('sites', 'POST', { id: 'client', name: 'Client Ltd', origins: [CLIENT] });
    const made = await admin('sites/client/people', 'POST', { name, email });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const code = codeIn(made.body.link);
    return { ...made.body, code, key: await keyFor(code) };
  };
  /** Moves the clock on and sends whatever news is due. */
  const later = async (ms) => { clock.now += ms; await bottle.tell(); return outbox(); };
  return { server, base, store, clock, bottle, call, leave, read, admin, check, use, keyFor, mark, outbox, later, client, close: () => new Promise((ok) => server.close(ok)) };
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

  it('shows its writer only what is theirs to see: a held note is waiting, and only done and declined notes say what came of them', () => {
    const kept = { id: 'x', at: 'now', note: 'Bigger logo', page: { url: 'u' }, state: 'held', outcome: { conflict: 'Brand', proposal: 'p' } };
    assert.deepEqual(clientView(kept), { id: 'x', at: 'now', note: 'Bigger logo', page: 'u', state: 'waiting' });
    assert.equal(clientView({ ...kept, state: 'done', outcome: { what: 'Bigger now.', confidence: 80 } }).what, 'Bigger now.');
    assert.equal(clientView({ ...kept, state: 'done', outcome: { what: 'w', confidence: 80 } }).confidence, undefined);
    assert.equal(clientView({ ...kept, state: 'declined', outcome: { reason: "We haven't, because." } }).reason, "We haven't, because.");
  });
});

describe('the emails', () => {
  const site = { name: 'Client Ltd', origins: [CLIENT] }, person = { name: 'Sam Smith', email: 'sam@client.example' };

  it('invites a person with a link that works for a week, says who it is from, and names the site in the subject', () => {
    const mail = inviteMail({ site, person, code: 'k-1', from: 'Olly' });
    assert.equal(mail.to, 'sam@client.example');
    assert.equal(mail.subject, 'Client Ltd: your link to leave notes on the new site');
    assert.match(mail.text, /^Hello Sam,\n\nI'm Olly, and I'm looking after the work on Client Ltd\.\n\n/);
    assert.ok(mail.text.includes(`${CLIENT}/#bottle=k-1`), 'the code is after #, which no site is sent');
    assert.ok(!mail.text.includes('?bottle='));
    assert.match(mail.text, /It works for 7 days\./);
    assert.match(mail.text, /We will email you when it is done, or why not\./);
    assert.ok(mail.text.includes('go to client.example/review'));
    assert.match(mail.text, /\n\nOlly$/);
    assert.equal(mail.replyTo, undefined, 'no reply-to unless there is one');
    assert.doesNotMatch(mail.text, /Reply to this email/, 'and no promise of one');
  });

  it('says where a reply goes, when there is somewhere', () => {
    for (const mail of [inviteMail({ site, person, code: 'k', from: 'Olly', replyTo: 'olly@home.example' }), signInMail({ site, person, code: 'c', from: 'Olly', replyTo: 'olly@home.example' })]) {
      assert.equal(mail.replyTo, 'olly@home.example');
      assert.match(mail.text, /\n\nReply to this email to reach Olly\.\n\nOlly$/);
    }
  });

  it('previews an invitation with no link in it', () => {
    const mail = inviteMail({ site, person, code: null, from: 'Olly' });
    assert.ok(mail.text.includes('(link removed for preview)'));
    assert.equal(codeIn(mail.text), null);
  });

  it('sends a sign-in link that works once, named for its site', () => {
    const mail = signInMail({ site, person, code: 'c-1' });
    assert.equal(mail.subject, 'Client Ltd: your sign-in link');
    assert.ok(mail.text.includes(`${CLIENT}/#bottle=c-1`));
    assert.match(mail.text, /It works once, for the next 30 minutes\.$/);
  });

  it('says what came of a person\'s notes in one email, under a link to each page', () => {
    const done = (words, url, what) => ({ note: words, state: 'done', page: { url }, outcome: { what } });
    const one = newsMail({ site, person, notes: [done('Bigger logo', `${CLIENT}/about`, 'The logo is bigger.')] });
    assert.equal(one.subject, 'Client Ltd: your note is done');
    assert.match(one.text, /Here is what came of your note on Client Ltd\.\n\nhttps:\/\/client\.example\/about\n\nDone: "Bigger logo"\nWhat we did: The logo is bigger\.$/);
    const three = newsMail({ site, person, from: 'Olly', notes: [done('Bigger logo', `${CLIENT}/about`, 'Bigger.'), done('Purple', `${CLIENT}/`, 'Purple now.'), done('Bold', `${CLIENT}/about`, 'Bold now.')] });
    assert.equal(three.subject, 'Client Ltd: 3 of your notes are done');
    assert.equal(three.text.split(`${CLIENT}/about\n`).length, 2, 'each page once');
    assert.match(three.text, /about\n\nDone: "Bigger logo"\nWhat we did: Bigger\.\n\nDone: "Bold"\nWhat we did: Bold now\.\n\n\nhttps:\/\/client\.example\/\n\nDone: "Purple"/);
    const mixed = newsMail({ site, person, notes: [done('Bigger logo', `${CLIENT}/`, 'Bigger.'), { note: 'No Worthing', state: 'declined', page: { url: `${CLIENT}/` }, outcome: { reason: DECLINED.reason } }] });
    assert.equal(mixed.subject, 'Client Ltd: what came of 2 of your notes');
    assert.ok(mixed.text.includes(`Not done: "No Worthing"\n${DECLINED.reason}`));
  });

  it('tells whoever looks after the sites that notes have come in, with a link to the queue', () => {
    const mail = arrivedMail({ to: 'olly@home.example', site, notes: [{ note: 'Bigger logo', by: 'Sam Smith' }, { note: 'Purple', by: 'Jo' }], queue: `${HOME}/bottle/admin#site=client` });
    assert.equal(mail.subject, 'Client Ltd: 2 new notes');
    assert.equal(mail.text, `2 new notes on Client Ltd:\n\nSam Smith: "Bigger logo"\nJo: "Purple"\n\n${HOME}/bottle/admin#site=client`);
    assert.equal(arrivedMail({ to: 'x', site, notes: [{ note: 'a', by: 'b' }], queue: 'q' }).subject, 'Client Ltd: 1 new note');
  });

  it('sends through Resend, from the address given, with the reply-to, and says when Resend will not', async () => {
    const asked = [];
    const fake = async (url, init) => { asked.push([url, init]); return new Response('{"id":"e-1"}', { status: 200 }); };
    const send = resend({ key: 're_test', from: 'Olly <notes@example.com>', fetch: fake });
    assert.deepEqual(await send(inviteMail({ site, person, code: 'k-1', replyTo: 'olly@home.example' })), { id: 'e-1' });
    const [[url, init]] = asked;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.headers.authorization, 'Bearer re_test');
    const body = JSON.parse(init.body);
    assert.deepEqual([body.from, body.to, body.subject, body.reply_to], ['Olly <notes@example.com>', ['sam@client.example'], 'Client Ltd: your link to leave notes on the new site', 'olly@home.example']);
    assert.ok(body.text.includes('#bottle=k-1'));
    await send({ to: 'a@b.example', subject: 'Hi', text: 'x' });
    assert.equal(JSON.parse(asked[1][1].body).reply_to, undefined);
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
    // the button asks for the very bottle-ui.mjs served with it, so a browser never runs one with the other from before a change
    const ui = (await s.call('/bottle/bottle-ui.mjs')).headers.get('etag').slice(1, -1);
    assert.ok((await (await s.call('/bottle/bottle.js')).text()).includes(`'bottle-ui.mjs?v=${ui}'`));
    assert.equal((await s.call(`/bottle/bottle-ui.mjs?v=${ui}`)).status, 200);
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

  it('opens the links of a site that lives under a path on its own page, there for good', async () => {
    const t = await serve();
    try {
      const made = await t.admin('sites', 'POST', { id: 'preview', name: 'A Preview', origins: ['https://host.example/laura/previews/index.html?x=1#top'] });
      assert.equal(made.status, 201);
      assert.deepEqual(made.body.origins, ['https://host.example'], 'its pages are known by their origin, as any site\'s');
      assert.equal(made.body.page, 'https://host.example/laura/previews/index.html');
      const ann = (await t.admin('sites/preview/people', 'POST', { name: 'Ann Lee', email: 'ann@host.example' })).body;
      assert.match(ann.link, /^https:\/\/host\.example\/laura\/previews\/index\.html#bottle=[\w-]{32}$/);
      assert.equal((await t.use(codeIn(ann.link), 'https://host.example')).status, 200, 'and it works there');
      // giving the site another address with no path keeps the page its links open
      assert.equal((await t.admin('sites', 'POST', { id: 'preview', origins: ['https://www.host.example'] })).body.page, 'https://host.example/laura/previews/index.html');
      assert.match((await t.admin('sites/preview/people/ann-lee/link', 'POST', {})).body.link, /^https:\/\/host\.example\/laura\/previews\/index\.html#bottle=/);
      assert.equal((await t.admin('sites', 'POST', { id: 'client', origins: [CLIENT] })).body.page, undefined, 'a site at its home page has none');
    } finally { await t.close(); }
  });

  it('adds a site and a person, whose link offers to switch the button on, and swaps its code for a key only when pressed, on that site only', async () => {
    const res0 = await s.admin('sites', 'POST', { id: 'client', name: 'Client Ltd', origins: [CLIENT] });
    assert.equal(res0.status, 201);
    const sam = (await s.admin('sites/client/people', 'POST', { name: 'Sam Smith', email: 'sam@client.example' })).body;
    assert.equal(sam.person.id, 'sam-smith');
    assert.match(sam.link, /^https:\/\/client\.example\/#bottle=[\w-]{32}$/);
    const code = codeIn(sam.link);
    // opening the link (as a mail scanner may) uses nothing up
    const looked = await s.check(code, CLIENT);
    assert.equal(looked.status, 409);
    assert.equal((await looked.json()).code, true);
    assert.equal((await s.check(code, CLIENT)).status, 409, 'still there');
    assert.equal((await s.use(code, HOME)).status, 403, 'not on another site');
    assert.equal((await s.leave(note(), { origin: CLIENT, 'x-bottle-key': code })).status, 403, 'a code is not a key');
    sam.key = await s.keyFor(code);
    assert.equal((await s.check(sam.key, CLIENT)).status, 200);
    assert.equal((await s.check(sam.key, HOME)).status, 403, 'not on another site');
    const res = await s.leave(note({ page: { url: `${CLIENT}/about` } }), { origin: CLIENT, 'x-bottle-key': sam.key });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    const kept = JSON.parse(await s.store.get(`bottles/${(await res.json()).id}/note.json`));
    assert.deepEqual([kept.site, kept.person, kept.by], ['client', 'sam-smith', 'Sam Smith']);
    // a person's key reads no notes
    assert.equal((await s.call('/bottle/notes', { headers: { 'x-bottle-key': sam.key, origin: CLIENT } })).status, 403);
    // and the store holds no key or code that works
    assert.ok(![...s.store.items.values()].some((bytes) => bytes.includes(sam.key) || bytes.includes(code)));
  });

  it('lets an invitation switch the button on in each browser it is opened in, for a week', async () => {
    const ann = (await s.admin('sites/client/people', 'POST', { name: 'Ann Lee', email: 'ann@client.example' })).body;
    const code = codeIn(ann.link);
    const phone = await s.keyFor(code), laptop = await s.keyFor(code);
    assert.notEqual(phone, laptop, 'each browser has a key of its own');
    assert.equal((await s.check(phone, CLIENT)).status, 200);
    assert.equal((await s.check(laptop, CLIENT)).status, 200);
    s.clock.now += 7 * 86400_000 + 1;
    assert.equal((await s.use(code)).status, 403, 'the link has run out');
    assert.equal((await s.check(phone, CLIENT)).status, 200, 'the keys it gave still work');
  });

  it('retires the last invitation when it makes a new one', async () => {
    const first = codeIn((await s.admin('sites/client/people', 'POST', { name: 'Raj Patel', email: 'raj@client.example' })).body.link);
    const second = codeIn((await s.admin('sites/client/people/raj-patel/link', 'POST', {})).body.link);
    assert.equal((await s.use(first)).status, 403, 'the first stops working');
    await s.admin('sites/client/people/raj-patel/invite', 'POST', {});
    const third = codeIn((await s.outbox())[0].text);
    assert.equal((await s.use(second)).status, 403, 'and so does the second');
    assert.equal((await s.use(third)).status, 200);
  });

  it('turns one person off, ending every key and link they have for good, while everyone else\'s still work', async () => {
    const jo = (await s.admin('sites/client/people', 'POST', { name: 'Jo', email: 'jo@client.example' })).body;
    const joCode = codeIn(jo.link), joKey = await s.keyFor(joCode);
    const sam = (await s.admin('sites/client', 'GET')).body.people.find((p) => p.id === 'sam-smith');
    assert.equal(sam.on, true);
    assert.equal(sam.key, undefined, 'no key is shown');
    const off = await s.admin('sites/client/people/jo/', 'PATCH', { on: false });
    assert.equal(off.status, 404, 'an id is exact');
    assert.equal((await s.admin('sites/client/people/jo', 'PATCH', { on: false })).body.on, false);
    assert.equal((await s.check(joKey, CLIENT)).status, 403);
    assert.equal((await s.leave(note(), { origin: CLIENT, 'x-bottle-key': joKey })).status, 403);
    assert.match((await s.admin('sites/client/people/jo/invite', 'POST', {})).body.error, /turned off/);
    assert.equal((await s.admin('sites/client/people/jo', 'PATCH', { on: true })).body.on, true);
    assert.equal((await s.check(joKey, CLIENT)).status, 403, 'turned on again, the old key stays dead');
    assert.equal((await s.use(joCode)).status, 403, 'and so does the link they were sent');
    const fresh = codeIn((await s.admin('sites/client/people/jo/link', 'POST', {})).body.link);
    assert.equal((await s.check(await s.keyFor(fresh), CLIENT)).status, 200, 'a new invitation works');
  });

  it('corrects a person\'s address, and what was sent to the old one stops working', async () => {
    const lee = (await s.admin('sites/client/people', 'POST', { name: 'Lee', email: 'lee@clinet.example' })).body;
    const key = await s.keyFor(codeIn(lee.link));
    const fixed = await s.admin('sites/client/people/lee', 'PATCH', { email: ' Lee@Client.example ' });
    assert.equal(fixed.body.email, 'lee@client.example');
    assert.equal((await s.check(key, CLIENT)).status, 403);
    assert.equal((await s.use(codeIn(lee.link))).status, 403);
    assert.match((await s.admin('sites/client/people/lee', 'PATCH', { email: 'sam@client.example' })).body.error, /on Client Ltd's list already/);
    assert.match((await s.admin('sites/client/people/lee', 'PATCH', { email: 'nope' })).body.error, /email address/);
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

  it('lets pages on the sites it knows reach it from their own address, and no others, and tells them the site\'s name', async () => {
    const ask = (origin) => s.call('/bottle/notes', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-bottle-key' } });
    const res = await ask(CLIENT);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    assert.match(res.headers.get('access-control-allow-headers'), /x-bottle-key/);
    assert.equal((await ask('https://elsewhere.example')).status, 403);
    assert.equal((await s.check('a-wrong-key', 'https://elsewhere.example')).headers.get('access-control-allow-origin'), null);
    const named = await s.call('/bottle/site', { method: 'POST', headers: { origin: CLIENT } });
    assert.deepEqual(await named.json(), { name: 'Client Ltd' });
    assert.equal(named.headers.get('access-control-allow-origin'), CLIENT);
    assert.equal((await s.call('/bottle/site', { method: 'POST', headers: { origin: 'https://elsewhere.example' } })).status, 403);
  });

  it('sends the invitation with the sender it is given, keeps a record of it with no link in it, and keeps nothing in the outbox then', async () => {
    const sent = [];
    const t = await serve({ mail: async (m) => { sent.push(m); return { id: 're-1' }; }, replyTo: 'olly@home.example' });
    try {
      await t.client();
      const res = await t.admin('sites/client/people/sam-smith/invite', 'POST', {});
      assert.deepEqual(res.body, { to: 'sam@client.example', sent: true });
      assert.deepEqual(sent.map((m) => [m.to, m.subject, m.replyTo]), [['sam@client.example', 'Client Ltd: your link to leave notes on the new site', 'olly@home.example']]);
      assert.deepEqual(await t.outbox(), []);
      const record = JSON.parse(await t.store.get('bottles/sent/re-1/sent.json'));
      assert.deepEqual([record.to, record.kind, record.site, record.person], ['sam@client.example', 'invitation', 'client', 'sam-smith']);
      assert.equal(codeIn(JSON.stringify(record)), null, 'no link in it');
      assert.equal(record.text, undefined);
      const sam = (await t.admin('sites/client', 'GET')).body.people.find((p) => p.id === 'sam-smith');
      assert.deepEqual([sam.mail.kind, sam.mail.state], ['invitation', 'sent']);
      assert.ok(Date.parse(sam.invitedUntil) > t.clock.now);
    } finally { await t.close(); }
  });

  it('empties the outbox kept before, with its links, once emails really go', async () => {
    const t = await serve();
    await t.client();
    await t.admin('sites/client/people/sam-smith/invite', 'POST', {});
    assert.equal((await t.outbox()).length, 1);
    const store = t.store;
    await t.close();
    const u = await serve({ store, mail: async () => ({ id: 'x' }) });
    try {
      await u.bottle.idle();
      assert.ok(![...store.items.keys()].some((k) => k.startsWith('bottles/outbox/')));
    } finally { await u.close(); }
  });

  it('gives a new link, and sends a preview to another address with no link in it', async () => {
    const link = (await s.admin('sites/client/people/sam-smith/link', 'POST', {})).body.link;
    const sent = await s.admin('sites/client/people/sam-smith/invite', 'POST', { to: 'test@olly.example' });
    assert.deepEqual(sent.body, { to: 'test@olly.example', sent: false, preview: true });
    const [mail] = await s.outbox();
    assert.equal(mail.to, 'test@olly.example');
    assert.equal(mail.subject, 'Client Ltd: your link to leave notes on the new site');
    assert.equal(codeIn(mail.text), null, 'nothing in it works');
    assert.ok(mail.text.includes('(link removed for preview)'));
    assert.equal((await s.use(codeIn(link))).status, 200, 'and the link she has still works');
    assert.equal((await s.admin('sites/client/people/sam-smith/invite', 'POST', { to: 'nope' })).status, 400);
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

describe('a Resend webhook', () => {
  const SECRET = `whsec_${Buffer.from('a test signing secret').toString('base64')}`;
  const sign = (id, stamp, body) => `v1,${createHmac('sha256', Buffer.from('a test signing secret')).update(`${id}.${stamp}.${body}`).digest('base64')}`;

  it('keeps a bounce on the person the email was for, and takes nothing unsigned', async () => {
    const t = await serve({ mail: async () => ({ id: 're-9' }), hook: SECRET });
    try {
      await t.client();
      await t.admin('sites/client/people/sam-smith/invite', 'POST', {});
      const body = JSON.stringify({ type: 'email.bounced', created_at: new Date(t.clock.now).toISOString(), data: { email_id: 're-9', to: ['sam@client.example'] } });
      const stamp = String(Math.floor(t.clock.now / 1000));
      const hook = (headers) => t.call('/bottle/resend', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
      assert.equal((await hook({ 'svix-id': 'm-1', 'svix-timestamp': stamp, 'svix-signature': 'v1,bm90IGl0' })).status, 400);
      assert.equal((await hook({ 'svix-id': 'm-1', 'svix-timestamp': String(Number(stamp) - 3600), 'svix-signature': sign('m-1', Number(stamp) - 3600, body) })).status, 400, 'nor an old one');
      assert.equal((await hook({ 'svix-id': 'm-1', 'svix-timestamp': stamp, 'svix-signature': `v1,xx ${sign('m-1', stamp, body)}` })).status, 200);
      const sam = (await t.admin('sites/client', 'GET')).body.people.find((p) => p.id === 'sam-smith');
      assert.deepEqual([sam.mail.kind, sam.mail.state], ['invitation', 'bounced']);
    } finally { await t.close(); }
    const u = await serve();
    try { assert.equal((await u.call('/bottle/resend', { method: 'POST', body: '{}' })).status, 404, 'there is none without its secret'); } finally { await u.close(); }
  });
});

describe('signing in at a site\'s /review page', () => {
  let s, sam;
  before(async () => { s = await serve(); sam = await s.client(); });
  after(() => s.close());
  const signIn = (email, origin = CLIENT) => s.call('/bottle/signin', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: { email } });

  it('emails someone on the list a link that works once, for half an hour, once its button is pressed', async () => {
    const res = await signIn(' Sam@Client.example ');
    assert.equal(res.status, 202);
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    const [mail] = await s.outbox();
    assert.equal(mail.to, 'sam@client.example');
    assert.equal(mail.subject, 'Client Ltd: your sign-in link');
    const code = codeIn(mail.text);
    assert.notEqual(code, sam.code);
    assert.equal((await s.check(code, CLIENT)).status, 409, 'opening the link uses nothing up');
    const key = await s.keyFor(code);
    assert.match(key, /^[\w-]{32}$/);
    assert.equal((await s.check(key, CLIENT)).status, 200, 'the browser keeps a key of its own');
    assert.equal((await s.use(code)).status, 403, 'the link works once');
    assert.equal((await s.check(code, CLIENT)).status, 403);

    await signIn('sam@client.example');
    const late = codeIn((await s.outbox())[0].text);
    s.clock.now += 31 * MINUTE;
    assert.equal((await s.use(late)).status, 403, 'and for half an hour');
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

  it('sends one address five links a day at most, counted in the store, so a restart counts the same', async () => {
    const t = await serve({ signInsPerHour: 1000 });
    const ask = (u) => u.call('/bottle/signin', { method: 'POST', headers: { origin: CLIENT }, body: { email: 'sam@client.example' } });
    await t.client();
    const links = async (u) => (await u.outbox()).filter((m) => m.subject.endsWith('sign-in link')).length;
    for (let i = 0; i < 3; i++) { assert.equal((await ask(t)).status, 202); t.clock.now += HOUR; }
    assert.equal(await links(t), 3);
    const store = t.store, now = t.clock.now;
    await t.close();
    // a new copy of the service, with nothing held in memory
    const u = await serve({ store, signInsPerHour: 1000 });
    u.clock.now = now;
    try {
      for (let i = 0; i < 4; i++) { assert.equal((await ask(u)).status, 202, 'the answer is the same'); u.clock.now += HOUR; }
      assert.equal(await links(u), 5);
    } finally { await u.close(); }
  });
});

describe('what a person sees of their own notes, and hears of them', () => {
  let s, sam, jo;
  before(async () => {
    s = await serve();
    sam = await s.client();
    jo = (await s.admin('sites/client/people', 'POST', { name: 'Jo', email: 'jo@client.example' })).body;
    jo.key = await s.keyFor(codeIn(jo.link));
  });
  after(() => s.close());
  const leave = async (who, words, url = `${CLIENT}/`) => (await (await s.leave(note({ note: words, page: { url, title: 'x' } }), { origin: CLIENT, 'x-bottle-key': who.key })).json()).id;
  const mine = async (who) => (await (await s.call('/bottle/mine', { headers: { origin: CLIENT, 'x-bottle-key': who.key } })).json()).notes;
  const news = async () => (await s.outbox()).filter((m) => /done|what came of/.test(m.subject));

  it('lists only their own, newest first, with what came of each; a held note is waiting', async () => {
    const a = await leave(sam, 'Bigger logo', `${CLIENT}/about`), b = await leave(sam, 'Remove the Worthing page'), c = await leave(sam, 'Purple buttons');
    await leave(jo, 'Jo\'s note');
    await s.mark(a, DONE);
    await s.mark(b, DECLINED);
    await s.mark(c, { state: 'held', conflict: 'Brand: the buttons are the brand\'s yellow.', proposal: 'A purple outline instead.' });
    const seen = await mine(sam);
    assert.deepEqual(seen.map((n) => [n.note, n.state]), [['Purple buttons', 'waiting'], ['Remove the Worthing page', 'declined'], ['Bigger logo', 'done']]);
    assert.equal(seen[0].conflict, undefined);
    assert.match(seen[1].reason, /^We haven't removed/);
    assert.equal(seen[2].what, DONE.what);
    assert.equal(seen[2].page, `${CLIENT}/about`);
    assert.deepEqual((await mine(jo)).map((n) => n.note), ['Jo\'s note']);
  });

  it('tells them what came of their notes in one email, once marking has stopped, and once only', async () => {
    assert.deepEqual(await news(), [], 'nothing while notes are still being marked');
    assert.deepEqual(await s.later(9 * MINUTE), [], 'nor until ten minutes have gone without one');
    const [mail] = await s.later(2 * MINUTE);
    assert.equal(mail.to, 'sam@client.example');
    assert.equal(mail.subject, 'Client Ltd: what came of 2 of your notes');
    assert.match(mail.text, /Done: "Bigger logo"\nWhat we did: Made the heading smaller on a phone\./);
    assert.match(mail.text, /Not done: "Remove the Worthing page"\nWe haven't removed/);
    assert.equal((await news()).length, 1);
    const [a] = (await mine(sam)).filter((n) => n.note === 'Bigger logo');
    await s.mark(a.id, { state: 'in-progress' });
    await s.mark(a.id, DONE);
    assert.equal((await s.later(2 * HOUR)).filter((m) => /done|what came of/.test(m.subject)).length, 1, 'once');
  });

  it('sends a person at most one email an hour, however the marking goes', async () => {
    const t = await serve();
    try {
      const ann = await t.client('ann@client.example', 'Ann Lee');
      const left = async (words) => (await (await t.leave(note({ note: words }), { origin: CLIENT, 'x-bottle-key': ann.key })).json()).id;
      const ids = [await left('One'), await left('Two'), await left('Three'), await left('Four')];
      for (const id of ids.slice(0, 3)) await t.mark(id, DONE);
      const first = await t.later(11 * MINUTE);
      assert.deepEqual(first.map((m) => m.subject), ['Client Ltd: 3 of your notes are done'], 'three done at once is one email');
      await t.mark(ids[3], DONE);
      assert.equal((await t.later(11 * MINUTE)).length, 1, 'the next waits for the hour');
      const second = await t.later(50 * MINUTE);
      assert.deepEqual(second.map((m) => m.subject), ['Client Ltd: your note is done', 'Client Ltd: 3 of your notes are done']);
    } finally { await t.close(); }
  });

  it('marks a note told only once its email has gone, and tries again when it fails', async () => {
    let fail = true;
    const sent = [];
    const t = await serve({ mail: async (m) => { if (fail) throw new Error('Resend is down'); sent.push(m); return { id: null }; } });
    try {
      const ann = await t.client('ann@client.example', 'Ann Lee');
      const id = (await (await t.leave(note(), { origin: CLIENT, 'x-bottle-key': ann.key })).json()).id;
      await t.mark(id, DONE);
      await t.later(11 * MINUTE);
      assert.equal(JSON.parse(await t.store.get(`bottles/${id}/note.json`)).told, undefined, 'not told');
      fail = false;
      await t.later(11 * MINUTE);
      assert.deepEqual(sent.map((m) => m.subject), ['Client Ltd: your note is done']);
      assert.ok(JSON.parse(await t.store.get(`bottles/${id}/note.json`)).told);
    } finally { await t.close(); }
  });

  it('keeps the news of a person turned off until they are on again', async () => {
    const t = await serve();
    try {
      const ann = await t.client('ann@client.example', 'Ann Lee');
      const id = (await (await t.leave(note(), { origin: CLIENT, 'x-bottle-key': ann.key })).json()).id;
      await t.admin('sites/client/people/ann-lee', 'PATCH', { on: false });
      await t.mark(id, DONE);
      assert.deepEqual(await t.later(2 * HOUR), []);
      await t.admin('sites/client/people/ann-lee', 'PATCH', { on: true });
      assert.deepEqual((await t.later(MINUTE)).map((m) => m.subject), ['Client Ltd: your note is done']);
    } finally { await t.close(); }
  });

  it('closes a done note when its writer says it is right, and nobody else\'s', async () => {
    const [done] = (await mine(sam)).filter((n) => n.state === 'done');
    const close = (who, id) => s.call(`/bottle/mine/${id}/closed`, { method: 'POST', headers: { origin: CLIENT, 'x-bottle-key': who.key } });
    assert.equal((await close(jo, done.id)).status, 404);
    const res = await close(sam, done.id);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).state, 'closed');
    const [held] = (await mine(sam)).filter((n) => n.state === 'waiting');
    assert.equal((await close(sam, held.id)).status, 409);
    assert.equal((await s.call('/bottle/mine', { headers: { origin: CLIENT, 'x-bottle-key': 'a-wrong-key' } })).status, 403);
  });
});

describe('word of new notes, to whoever looks after the sites', () => {
  it('comes once notes stop arriving, at most an hour apart for each site, with a link to its queue, and never for the owner\'s own', async () => {
    const t = await serve({ notify: 'olly@home.example' });
    try {
      const ann = await t.client('ann@client.example', 'Ann Lee');
      for (const words of ['One', 'Two']) await t.leave(note({ note: words }), { origin: CLIENT, 'x-bottle-key': ann.key });
      await t.leave(note({ note: 'My own' }));
      const [mail, ...more] = await t.later(11 * MINUTE);
      assert.deepEqual(more, []);
      assert.equal(mail.to, 'olly@home.example');
      assert.equal(mail.subject, 'Client Ltd: 2 new notes');
      assert.ok(mail.text.endsWith(`${HOME}/bottle/admin#site=client`));
      assert.doesNotMatch(mail.text, /My own/);
      await t.leave(note({ note: 'Three' }), { origin: CLIENT, 'x-bottle-key': ann.key });
      assert.equal((await t.later(11 * MINUTE)).length, 1, 'not within the hour');
      assert.equal((await t.later(50 * MINUTE))[0].subject, 'Client Ltd: 1 new note');
    } finally { await t.close(); }
  });
});

describe('choosing the part of the page a note is about', () => {
  const link = { nodeType: 1, name: 'the link' }, under = { nodeType: 1, name: 'under the pointer' }, outlined = { nodeType: 1, name: 'outlined' };
  const at = (x, y) => (x === 120 && y === 340 ? under : null);

  it('takes the part under the pointer, or the one outlined if nothing is there', () => {
    assert.equal(pressedPart({ detail: 1, target: link, clientX: 120, clientY: 340 }, at, outlined), under);
    assert.equal(pressedPart({ detail: 1, target: link, clientX: 5, clientY: 5 }, at, outlined), outlined);
  });

  it('takes the element a click with no pointer was made on (Enter on a link), not the top corner of the page', () => {
    // such a click is at 0, 0: it chose whatever was in the top left corner (the page's own bar on a preview)
    assert.equal(pressedPart({ detail: 0, target: link, clientX: 0, clientY: 0 }, () => under, outlined), link);
  });
});

describe('what a page opened from a link does', () => {
  /** A stand-in for the service: what it says each token is. */
  const service = (said) => async (token) => said[token] ?? 'wrong';

  it('keeps a key that works when the link it came with has been used, and says so', async () => {
    // the bug the review found: a used sign-in link, opened again, took away the phone's key
    const plan = await decide({ link: 'used-code', kept: 'good-key', look: service({ 'good-key': 'key' }) });
    assert.deepEqual(plan, { show: 'good-key', say: 'This link has run out. The note button is still on.' });
  });

  it('says a link has run out, with nothing kept, rather than showing nothing', async () => {
    assert.deepEqual(await decide({ link: 'old-code', kept: null, look: service({}) }), { runOut: true, forget: false });
    assert.deepEqual(await decide({ link: 'old-code', kept: 'dead-key', look: service({}) }), { runOut: true, forget: true });
  });

  it('offers a link\'s code to be used, and uses nothing up by itself', async () => {
    assert.deepEqual(await decide({ link: 'code', kept: null, look: service({ code: 'code' }) }), { offer: 'code', forget: false });
    assert.deepEqual(await decide({ link: 'code', kept: 'good-key', look: service({ code: 'code', 'good-key': 'key' }) }), { show: 'good-key', say: 'The note button is on already.' });
  });

  it('switches on with a key from a link sent before, and says so the first time', async () => {
    assert.deepEqual(await decide({ link: 'k', kept: null, look: service({ k: 'key' }) }), { show: 'k', keep: 'k', say: 'The note button is on.' });
    assert.deepEqual(await decide({ link: 'k', kept: 'k', look: service({ k: 'key' }) }), { show: 'k', keep: 'k' });
  });

  it('forgets a kept key, silently, only when it is itself refused, and keeps it when the service cannot be reached', async () => {
    assert.deepEqual(await decide({ link: null, kept: 'k', look: service({ k: 'key' }) }), { show: 'k' });
    assert.deepEqual(await decide({ link: null, kept: 'k', look: service({}) }), { forget: true });
    assert.deepEqual(await decide({ link: null, kept: 'k', look: async () => 'unknown' }), { forget: false });
    assert.deepEqual(await decide({ link: 'x', kept: 'k', look: async (t) => (t === 'k' ? 'unknown' : 'wrong') }), { runOut: true, forget: false });
    assert.deepEqual(await decide({ link: null, kept: null, look: service({}) }), {});
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
    assert.match(added.text, /^Ann Lee \(ann-lee\) is on civ-speak's list\. Their link, which works for 7 days:\nhttps:\/\/civspeak\.example\/#bottle=[\w-]{32}$/);
    assert.match((await run(['people', 'civ-speak'])).text, /^ann-lee +on +Ann Lee {2}ann@civspeak\.example {2}\(link works until 29 Nov\)$/);
    assert.equal((await run(['person', 'off', 'civ-speak', 'ann-lee'])).text, 'Ann Lee is off');
    assert.match((await run(['people', 'civ-speak'])).text, /^ann-lee +off +Ann Lee {2}ann@civspeak\.example$/);
    assert.equal((await run(['person', 'on', 'civ-speak', 'ann-lee'])).text, 'Ann Lee is on');
    assert.match((await run(['person', 'link', 'civ-speak', 'ann-lee'])).text, /^https:\/\/civspeak\.example\/#bottle=/);
    assert.equal((await run(['invite', 'civ-speak', 'ann-lee', '--to', 'test@olly.example'])).text, 'A preview of the invitation, with no link in it, to test@olly.example is in the outbox, not sent.');
    assert.match((await run(['outbox'])).text, /to test@olly\.example {2}"Civ Speak: your link to leave notes on the new site"\n {4}Hello Ann,/);
    assert.equal((await run(['invite', 'civ-speak', 'ann-lee'])).text, 'The invitation to ann@civspeak.example is in the outbox, not sent.');
    assert.match((await run(['people', 'civ-speak'])).text, /\(invitation in the outbox 22 Nov, link works until 29 Nov\)$/);
    assert.equal((await run(['person', 'email', 'civ-speak', 'ann-lee', 'ann.lee@civspeak.example'])).text, 'Ann Lee\'s address is ann.lee@civspeak.example. Send them a new invitation.');
    assert.match((await run(['people', 'civ-speak'])).text, /^ann-lee +on +Ann Lee {2}ann\.lee@civspeak\.example$/);
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
    assert.equal((await run(['close', ids[2]])).text, `${ids[2]} is closed`);
    assert.match((await run(['results', 'home'])).text, /\| Remove the Worthing page\. \| closed \| We haven't removed the Worthing page\./);
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
