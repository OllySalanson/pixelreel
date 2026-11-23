// Message in a Bottle, the endpoint: one service for every site the button is on. It checks
// each person's key before the button shows, takes the notes they leave with it, keeps each one
// with its screenshot, sends the sign-in links asked for at a site's /review page, and hands the
// notes to whoever looks after the sites, to work through and mark. Plain Node (node:http
// requests and responses), with no other packages but the screenshot maker it serves to the
// browser, so it can be dropped into any Node service. See README.md.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { doneMail, inviteMail, keyLink, outbox, signInMail } from './mail.mjs';
import { plainEmail, Said, same, ID as SITE_ID, Sites } from './sites.mjs';

/** The most one note may carry, screenshot and all. */
export const MAX_BYTES = 6 * 1024 * 1024;

/** The biggest screenshot kept, in bytes: a note with a bigger one is kept without it. */
export const MAX_SHOT = 4 * 1024 * 1024;

/** How long each field of a note may be, in characters. */
export const FIELDS = { note: 5000, url: 2000, title: 300, selector: 1000, text: 1000, tag: 40, browser: 500, outcome: 1000 };

/**
 * What a note can be, in the order a note goes through them: new when left; in-progress once
 * someone is on it; held when doing it would harm the site's SEO or brand, so it waits for a
 * decision; declined when it would be bad for the client; done when it is on the preview;
 * closed once its writer says it is right.
 */
export const STATES = ['new', 'in-progress', 'held', 'declined', 'done', 'closed'];

/** What the notes' first states are now. */
const OLD_STATES = { read: 'in-progress', asked: 'in-progress', fixed: 'done', dropped: 'declined' };

/** A note's id: when it was left, then a random part, so that ids sort by time. */
const ID = /^\d{8}-\d{6}-[0-9a-f]{8}$/;

const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow, noarchive' };

const json = (res, status, value) => res.writeHead(status, { ...HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(value));

/** Counts in a sliding window, for each caller: hit() says whether one more is allowed, and counts it if so. */
class Window {
  constructor(most, ms, now) {
    Object.assign(this, { most, ms, now, seen: new Map() });
  }

  hit(caller) {
    const at = this.now(), times = (this.seen.get(caller) ?? []).filter((t) => t > at - this.ms);
    if (times.length >= this.most) { this.seen.set(caller, times); return false; }
    this.seen.set(caller, [...times, at]);
    if (this.seen.size > 10000) for (const [who, ts] of this.seen) if (!ts.some((t) => t > at - this.ms)) this.seen.delete(who);
    return true;
  }
}

/** The files a browser loads: the button, the rest of it once a key is in hand, the screenshot maker, and the page of queues. */
function files() {
  const file = (url, type) => {
    const bytes = readFileSync(url);
    return { bytes, type, gzip: gzipSync(bytes, { level: 9 }), tag: `"${createHash('sha256').update(bytes).digest('base64url').slice(0, 20)}"` };
  };
  const js = 'text/javascript; charset=utf-8';
  return {
    'bottle.js': file(new URL('./bottle.js', import.meta.url), js),
    'bottle-ui.mjs': file(new URL('./bottle-ui.mjs', import.meta.url), js),
    'shot.mjs': file(fileURLToPath(import.meta.resolve('modern-screenshot')), js),
    'admin.mjs': file(new URL('./admin.mjs', import.meta.url), js),
    'admin.css': file(new URL('./admin.css', import.meta.url), 'text/css; charset=utf-8')
  };
}

/** A page of the bottle's own: nothing on it for a search engine, which is told to keep it out. */
const page = (title, body, prefix) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
${body(prefix)}
</head>
<body></body>
</html>
`;
const ADMIN = (p) => `<link rel="stylesheet" href="${p}/admin.css">\n<script type="module" src="${p}/admin.mjs"></script>`;
const REVIEW = (p) => `<script src="${p}/bottle.js" data-review="" defer></script>`;
const PAGE_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

async function readBytes(req, max) {
  if (Number(req.headers['content-length']) > max) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > max) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const readJson = async (req, max = 64 * 1024) => {
  try { return JSON.parse((await readBytes(req, max))?.toString('utf8') ?? ''); } catch { return null; }
};

const text = (value, most) => (typeof value === 'string' ? value.trim().slice(0, most) : '');
const count = (value) => (Number.isFinite(value) ? Math.round(value) : null);

/** The note a browser sent, made safe to keep: only the fields known, each cut to its length. Throws a message for the sender if there is no note. */
export function noteFrom(body, now = new Date()) {
  const note = text(body?.note, FIELDS.note);
  if (!note) throw new Error('Write what the note is about first.');
  const target = body.target ?? {}, view = body.viewport ?? {}, rect = target.rect ?? {};
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return {
    id: `${stamp.slice(0, 8)}-${stamp.slice(8)}-${randomBytes(4).toString('hex')}`,
    at: now.toISOString(),
    state: 'new',
    note,
    spoken: body.spoken === true,
    page: { url: text(body.page?.url, FIELDS.url), title: text(body.page?.title, FIELDS.title) },
    target: {
      whole: Boolean(target.whole),
      selector: text(target.selector, FIELDS.selector),
      tag: text(target.tag, FIELDS.tag),
      text: text(target.text, FIELDS.text),
      rect: { x: count(rect.x), y: count(rect.y), width: count(rect.width), height: count(rect.height) }
    },
    viewport: { width: count(view.width), height: count(view.height), scale: Number.isFinite(view.scale) ? view.scale : null, scrollX: count(view.scrollX), scrollY: count(view.scrollY) },
    browser: text(body.browser, FIELDS.browser),
    // the page's own settings, from the data- attributes on its <html>: how it looked
    settings: Object.fromEntries(Object.entries(body.settings && typeof body.settings === 'object' ? body.settings : {})
      .filter(([name, value]) => /^[a-z][a-z0-9-]{0,40}$/.test(name) && typeof value === 'string').slice(0, 20).map(([name, value]) => [name, value.slice(0, 100)])),
    shot: false,
    outcome: {},
    history: []
  };
}

/** The screenshot in a note, as JPEG bytes, or null if it carries none that is one. */
export function shotFrom(body) {
  const data = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(typeof body?.shot === 'string' ? body.shot : '')?.[1];
  const bytes = data ? Buffer.from(data, 'base64') : null;
  return bytes && bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;
}

/**
 * What marking a note `state` says about it, from what was sent (`body`): for done, what was
 * done and how sure (`confidence`, 0 to 100) that it is what was meant; for held, the conflict
 * (with the site's SEO or brand) and the solution proposed; for declined, the `reason`, one or
 * two plain sentences beginning "We haven't". Throws a message saying what is missing.
 */
export function outcomeFrom(state, body = {}) {
  const say = (name) => text(body[name], FIELDS.outcome);
  if (state === 'done') {
    const what = say('what'), confidence = Number(body.confidence);
    if (!what) throw new Error('Say what was done, in "what".');
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error('Say how sure it is what was meant, as "confidence" from 0 to 100.');
    return { what, confidence: Math.round(confidence), ...(say('conflict') ? { conflict: say('conflict') } : {}) };
  }
  if (state === 'held') {
    const conflict = say('conflict'), proposal = say('proposal');
    if (!conflict || !proposal) throw new Error('Say what it conflicts with, in "conflict", and the solution proposed, in "proposal".');
    return { conflict, proposal };
  }
  if (state === 'declined') {
    const reason = say('reason');
    if (!/^We (haven't|have not) /.test(reason)) throw new Error('Give the reason as "We haven\'t done this because...", in "reason".');
    if ((reason.match(/[.!?](\s|$)/g) ?? []).length > 2) throw new Error('Keep the reason to one or two sentences.');
    return { reason };
  }
  return {};
}

/** A note as its writer sees it: held is theirs to wait on like any other, and only done and declined notes say what came of them. */
export function clientView(note) {
  const state = note.state === 'held' ? 'in-progress' : note.state;
  return {
    id: note.id, at: note.at, note: note.note, page: note.page?.url ?? '', state,
    ...(state === 'done' || state === 'closed' ? { what: note.outcome?.what ?? '' } : {}),
    ...(state === 'declined' ? { reason: note.outcome?.reason ?? '' } : {})
  };
}

/**
 * The endpoint, mounted at `prefix` (default /bottle). Its handle(req, res) answers anything
 * under the prefix (and the `review` page, if there is one) and returns true, or returns
 * false having sent nothing.
 *
 * - `store`: where notes are kept, with put(key, bytes), get(key) (null when there is none)
 *   and folders(prefix), as service/store.mjs's are. Everything is under `bottles/`.
 * - `home` ({ id, name }) and `origins`: the site this service is part of, and its addresses.
 * - `key`: the service's own secret, a key for `owner` ({ id, name, email }), who is on the
 *   home site's list and may also see every site's queue on the admin page.
 * - `reader`: the admin key, for whoever looks after the sites: it adds sites and people and
 *   reads and marks the notes. Without one, only the owner's key does.
 * - `review`: the address of the home site's own sign-in page, such as /review, or null.
 * - `mail(message)`: sends an email ({ to, subject, text }). Without one, each is kept in the
 *   store's outbox instead (mail.mjs) and nothing is sent. `from` signs them.
 * - `caller(req)`: who is asking, for the rate limits (default: the connecting address).
 * - `perHour`, `perDay`: how many notes each person may leave an hour, and each site a day;
 *   `wrongPerHour`, how many wrong keys a caller may try; `signInsPerHour`, how many sign-in
 *   links a caller (or an address) may ask for.
 */
export function createBottle({ store, key = '', reader = '', origins = [], home = { id: 'home', name: 'This site' }, owner = { id: 'owner', name: 'Owner' },
  prefix = '/bottle', review = null, mail = null, from = '', caller = (req) => req.socket.remoteAddress ?? 'unknown',
  perHour = 30, perDay = 200, wrongPerHour = 10, signInsPerHour = 5, log = () => {}, now = () => Date.now() } = {}) {
  const served = files();
  const sites = new Sites({ store, home: { ...home, origins }, owner, ownerKey: key, now });
  const send = mail ?? outbox(store, { now, log });
  const notes = new Window(perHour, 3600_000, now), noteCallers = new Window(perHour, 3600_000, now), daily = new Window(perDay, 86400_000, now);
  const wrong = new Window(wrongPerHour, 3600_000, now), signIns = new Window(signInsPerHour, 3600_000, now), signInsTo = new Window(3, 3600_000, now);
  const pending = new Set();

  /** Work done after the answer is sent, so how long it takes says nothing; idle() waits for it. */
  const later = (work) => {
    const job = Promise.resolve().then(work).catch((err) => log(`bottle: ${err.stack ?? err}`)).finally(() => pending.delete(job));
    pending.add(job);
  };

  /** Turns a caller away, or, if they keep getting keys wrong, away for an hour. */
  const refuse = (req, res, status, error) => {
    if (!wrong.hit(caller(req))) json(res, 429, { error: 'Too many wrong keys. Try again in an hour.' });
    else json(res, status, { error });
  };

  /** Whether the request comes from one of `site`'s pages (or from no page at all, as a script's does). */
  const fromSite = (req, site) => !req.headers.origin || site.origins.includes(req.headers.origin);

  /** Who the key in x-bottle-key is, if they may leave notes from here; otherwise the caller is turned away and it is null. */
  const person = async (req, res) => {
    const found = await sites.who(req.headers['x-bottle-key']);
    if (found && fromSite(req, found.site)) return found;
    refuse(req, res, 403, 'That key is not right.');
    return null;
  };

  /** Whether the request holds the admin key, or is from the owner on the home site. */
  const admin = async (req, res) => {
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (reader && same(bearer, reader)) return true;
    if (!bearer && req.headers['x-bottle-key']) {
      const found = await sites.who(req.headers['x-bottle-key']);
      if (found?.person.owner && fromSite(req, found.site)) return true;
    }
    if (!reader && !key) json(res, 404, { error: 'Notes are not read here.' });
    else refuse(req, res, 403, 'That key is not right.');
    return false;
  };

  const read = async (id) => {
    const bytes = await store.get(`bottles/${id}/note.json`);
    if (!bytes) return null;
    const note = JSON.parse(bytes);
    note.state = OLD_STATES[note.state] ?? note.state;
    note.site ??= home.id;
    note.outcome ??= {};
    return note;
  };
  const write = (note) => store.put(`bottles/${note.id}/note.json`, JSON.stringify(note, null, 2));

  const all = async () => {
    const ids = (await store.folders('bottles')).filter((id) => ID.test(id)).sort();
    const found = [];
    for (let i = 0; i < ids.length; i += 8) found.push(...(await Promise.all(ids.slice(i, i + 8).map(read))));
    // in the order they were left: ids are by the second, so two left in the same second go by when
    return found.filter(Boolean).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  };

  const sendFile = (req, res, name) => {
    const file = served[name];
    const headers = {
      ...HEADERS, 'content-type': file.type, 'cache-control': 'public, max-age=3600', etag: file.tag, vary: 'accept-encoding',
      // other sites' pages load the button from here
      'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin'
    };
    if (req.headers['if-none-match'] === file.tag) { res.writeHead(304, headers).end(); return; }
    const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    const body = gzip ? file.gzip : file.bytes;
    res.writeHead(200, { ...headers, ...(gzip ? { 'content-encoding': 'gzip' } : {}), 'content-length': body.length }).end(req.method === 'HEAD' ? undefined : body);
  };

  const sendPage = (req, res, html) => {
    res.writeHead(200, { ...HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': PAGE_POLICY })
      .end(req.method === 'HEAD' ? undefined : html);
  };

  async function check(req, res) {
    const given = req.headers['x-bottle-key'];
    const found = await sites.who(given);
    if (found && fromSite(req, found.site)) { json(res, 200, { ok: true }); return; }
    // a sign-in link's code is swapped, once, for a key of the person's own, which this browser keeps instead
    const redeemed = !found && (await sites.redeem(given));
    if (redeemed && fromSite(req, redeemed.site)) { log(`bottle: ${redeemed.person.id} signed in on ${redeemed.site.id}`); json(res, 200, { ok: true, key: redeemed.key }); return; }
    refuse(req, res, 403, 'That key is not right.');
  }

  async function leave(req, res) {
    const found = await person(req, res);
    if (!found) return;
    const { site, person: who } = found;
    if (!notes.hit(`${site.id}/${who.id}`) || !noteCallers.hit(caller(req)) || !daily.hit(site.id)) { json(res, 429, { error: 'That is a lot of notes. Try again in a while.' }); return; }
    const bytes = await readBytes(req, MAX_BYTES);
    if (!bytes) {
      res.setHeader('connection', 'close');
      res.once('finish', () => req.socket.destroy());
      json(res, 413, { error: 'That note is too big to send.' });
      return;
    }
    let body, note;
    try {
      body = JSON.parse(bytes.toString('utf8'));
      note = noteFrom(body, new Date(now()));
    } catch (err) {
      json(res, 400, { error: err instanceof SyntaxError ? 'That note could not be read.' : err.message });
      return;
    }
    Object.assign(note, { site: site.id, person: who.id, by: who.name });
    const shot = shotFrom(body);
    if (shot && shot.length <= MAX_SHOT) {
      await store.put(`bottles/${note.id}/shot.jpg`, shot);
      note.shot = true;
    } else if (shot) log(`bottle: a screenshot of ${shot.length} bytes was too big to keep, ${note.id}`);
    await write(note);
    log(`bottle: a note was left on ${site.id}, ${note.id}`);
    json(res, 201, { id: note.id });
  }

  async function mine(req, res, id) {
    const found = await person(req, res);
    if (!found) return;
    const theirs = (note) => note && note.site === found.site.id && note.person === found.person.id;
    if (!id) {
      json(res, 200, { notes: (await all()).filter(theirs).reverse().slice(0, 50).map(clientView) });
      return;
    }
    // its writer says a done note is right, and that closes it
    const note = await read(id);
    if (!theirs(note)) { json(res, 404, { error: 'There is no such note.' }); return; }
    if (note.state !== 'done') { json(res, 409, { error: 'That note is not done yet.' }); return; }
    note.state = 'closed';
    note.history = [...note.history, { at: new Date(now()).toISOString(), state: 'closed', by: found.person.id }];
    await write(note);
    json(res, 200, clientView(note));
  }

  async function signIn(req, res) {
    const site = await sites.at(req.headers.origin);
    if (!site) { json(res, 403, { error: 'Only from a site the notes are taken for.' }); return; }
    const body = await readJson(req);
    const email = plainEmail(body?.email);
    if (!email || email.length > 254) { json(res, 400, { error: 'Give your email address.' }); return; }
    if (!signIns.hit(caller(req)) || !signInsTo.hit(`${site.id}/${email}`)) { json(res, 429, { error: 'Try again in a while.' }); return; }
    // the same answer, as soon, whether or not the address is on the list: only its owner learns which, from their email
    json(res, 202, { ok: true });
    later(async () => {
      const made = await sites.code(site.id, email);
      if (!made) return;
      await send(signInMail({ site: made.site, person: made.person, key: made.code, from }));
      log(`bottle: a sign-in link was sent for ${made.person.id} on ${site.id}`);
    });
  }

  /** Each site with how many of its notes are in each state. */
  async function queues() {
    const found = await all(), list = await sites.all();
    return list.map((site) => {
      const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
      for (const n of found) if (n.site === site.id && counts[n.state] !== undefined) counts[n.state]++;
      return { ...Sites.shown(site), counts };
    });
  }

  async function mark(req, res, id) {
    const note = await read(id);
    if (!note) { json(res, 404, { error: 'There is no such note.' }); return; }
    const body = await readJson(req);
    if (!STATES.includes(body?.state)) { json(res, 400, { error: `Send { "state": one of ${STATES.join(', ')} } and what goes with it.` }); return; }
    let outcome;
    try { outcome = outcomeFrom(body.state, body); } catch (err) { json(res, 400, { error: err.message }); return; }
    const was = note.state, answer = text(body.answer, FIELDS.note);
    note.state = body.state;
    note.outcome = { ...note.outcome, ...outcome };
    note.history = [...note.history, { at: new Date(now()).toISOString(), state: body.state, ...outcome, ...(answer ? { answer } : {}) }];
    await write(note);
    // its writer hears when it is done, once
    if (note.state === 'done' && was !== 'done' && !note.told) {
      const found = note.person && (await sites.person(note.site, note.person));
      if (found?.person.email && found.person.on !== false) {
        note.told = new Date(now()).toISOString();
        await write(note);
        later(() => send(doneMail({ site: found.site, person: found.person, note, from })));
      }
    }
    json(res, 200, note);
  }

  /** The admin's requests about sites and the people on them. */
  async function people(req, res, parts) {
    const [siteId, , personId, act] = parts;
    if (parts.includes('') || parts.length > 4) { json(res, 404, { error: 'There is nothing here.' }); return; }
    const method = req.method;
    try {
      if (!siteId && method === 'GET') { json(res, 200, { sites: await queues() }); return; }
      if (!siteId && method === 'POST') { const body = await readJson(req); json(res, 201, Sites.shown(await sites.add(body ?? {}))); return; }
      if (!SITE_ID.test(siteId)) { json(res, 404, { error: 'There is no such site.' }); return; }
      if (parts.length === 1 && method === 'GET') {
        const site = await sites.get(siteId);
        json(res, site ? 200 : 404, site ? Sites.shown(site) : { error: 'There is no such site.' });
        return;
      }
      if (parts[1] !== 'people') { json(res, 404, { error: 'There is nothing here.' }); return; }
      if (!personId && method === 'POST') {
        const body = await readJson(req) ?? {};
        const { person: added, key: made } = await sites.addPerson(siteId, body);
        json(res, 201, { person: added, link: keyLink(await sites.get(siteId), made) });
        return;
      }
      const found = personId && (await sites.person(siteId, personId));
      if (!found) { json(res, 404, { error: 'There is nobody by that id on that site\'s list.' }); return; }
      if (!act && method === 'PATCH') {
        const body = await readJson(req);
        if (typeof body?.on !== 'boolean') { json(res, 400, { error: 'Send { "on": true } or { "on": false }.' }); return; }
        json(res, 200, await sites.turn(siteId, personId, body.on));
        return;
      }
      if ((act === 'link' || act === 'invite') && method === 'POST' && !found.person.owner) {
        const made = await sites.newKey(siteId, personId, act);
        if (act === 'link') { json(res, 200, { link: keyLink(found.site, made) }); return; }
        const body = await readJson(req) ?? {};
        const to = plainEmail(body.to) || found.person.email;
        await send({ ...inviteMail({ site: found.site, person: found.person, key: made, from, path: review ?? '/review' }), to });
        json(res, 200, { to, sent: Boolean(mail) });
        return;
      }
      json(res, 404, { error: 'There is nothing here.' });
    } catch (err) {
      if (err instanceof Said) json(res, 400, { error: err.message });
      else throw err;
    }
  }

  async function mails(res) {
    const ids = (await store.folders('bottles/outbox')).sort().reverse().slice(0, 50);
    const found = await Promise.all(ids.map(async (id) => JSON.parse((await store.get(`bottles/outbox/${id}/mail.json`)) ?? 'null')));
    json(res, 200, { mails: found.filter(Boolean) });
  }

  /** Lets a page on any site the notes are taken for reach the endpoint from its own address. */
  const welcome = async (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !(await sites.allowed(origin))) return false;
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
    return true;
  };

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost'), path = url.pathname, method = req.method;
    const reading = method === 'GET' || method === 'HEAD';
    if (review && path.replace(/\/$/, '') === review && reading) { sendPage(req, res, page('Review', REVIEW, prefix)); return true; }
    if (path !== prefix && !path.startsWith(`${prefix}/`)) return false;
    const rest = path.slice(prefix.length + 1);
    try {
      if (reading && served[rest]) { sendFile(req, res, rest); return true; }
      if (reading && rest === 'admin') { sendPage(req, res, page('Queues', ADMIN, prefix)); return true; }
      if (method === 'OPTIONS') {
        if (await welcome(req, res)) {
          res.writeHead(204, { ...HEADERS, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, x-bottle-key', 'access-control-max-age': '600' }).end();
        } else json(res, 403, { error: 'Only from a site the notes are taken for.' });
        return true;
      }
      // what a page asks, from its own site or another
      if (['check', 'notes', 'signin', 'mine'].includes(rest) || rest.startsWith('mine/')) await welcome(req, res);
      if (rest === 'check' && method === 'POST') { await check(req, res); return true; }
      if (rest === 'signin' && method === 'POST') { await signIn(req, res); return true; }
      if (rest === 'notes' && method === 'POST') { await leave(req, res); return true; }
      if (rest === 'mine' && method === 'GET') { await mine(req, res, null); return true; }
      const closing = /^mine\/([^/]+)\/closed$/.exec(rest);
      if (closing && ID.test(closing[1]) && method === 'POST') { await mine(req, res, closing[1]); return true; }

      // what only whoever looks after the sites may ask
      if (rest === 'notes' && method === 'GET') {
        if (!(await admin(req, res))) return true;
        const state = url.searchParams.get('state'), site = url.searchParams.get('site');
        if (state && state !== 'all' && state !== 'open' && !STATES.includes(state)) { json(res, 400, { error: `state is one of ${STATES.join(', ')}, open or all` }); return true; }
        const open = ['new', 'in-progress', 'held'];
        const wanted = (n) => state === 'all' || (state === 'open' ? open.includes(n.state) : n.state === (state ?? 'new'));
        json(res, 200, { notes: (await all()).filter((n) => wanted(n) && (!site || n.site === site)) });
        return true;
      }
      if (rest === 'sites' || rest.startsWith('sites/')) {
        if (await admin(req, res)) await people(req, res, rest.split('/').slice(1));
        return true;
      }
      if (rest === 'outbox' && reading) { if (await admin(req, res)) await mails(res); return true; }
      const one = /^notes\/([^/]+)(\/shot\.jpg)?$/.exec(rest);
      if (one && ID.test(one[1])) {
        if (!(await admin(req, res))) return true;
        if (reading && one[2]) {
          const shot = await store.get(`bottles/${one[1]}/shot.jpg`);
          if (shot) res.writeHead(200, { ...HEADERS, 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'content-length': shot.length }).end(shot);
          else json(res, 404, { error: 'That note has no screenshot.' });
          return true;
        }
        if (reading) { const note = await read(one[1]); json(res, note ? 200 : 404, note ?? { error: 'There is no such note.' }); return true; }
        if (method === 'PATCH' && !one[2]) { await mark(req, res, one[1]); return true; }
      }
      json(res, 404, { error: 'There is nothing here.' });
    } catch (err) {
      log(`bottle: ${method} ${path}: ${err.stack ?? err}`);
      if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Try again in a while.' });
    }
    return true;
  }

  /** Resolves once the work begun after an answer (an email to send) is done. */
  const idle = async () => { while (pending.size) await Promise.all(pending); };

  return { handle, idle, sites };
}
