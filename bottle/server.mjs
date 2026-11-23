// Message in a Bottle, the endpoint: takes the notes left with the button (bottle.js), keeps
// each one with its screenshot, and hands them to whoever holds the reader key. Plain Node
// (node:http requests and responses), with no other packages but the screenshot maker it
// serves to the browser, so it can be dropped into any Node service. See README.md.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** The most one note may carry, screenshot and all. */
export const MAX_BYTES = 6 * 1024 * 1024;

/** How long each field of a note may be, in characters. */
export const FIELDS = { note: 5000, url: 2000, title: 300, selector: 1000, text: 1000, tag: 40, browser: 500 };

/** What a note can be marked as, by whoever reads them. A note starts as new. */
export const STATES = ['new', 'read', 'asked', 'fixed', 'dropped'];

/** A note's id: when it was left, then a random part, so that ids sort by time. */
const ID = /^\d{8}-\d{6}-[0-9a-f]{8}$/;

const HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow' };

const sha = (text) => createHash('sha256').update(String(text)).digest();
/** Whether `given` is `secret`, taking as long whatever it is. */
const same = (given, secret) => typeof given === 'string' && given.length > 0 && timingSafeEqual(sha(given), sha(secret));

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

/** The files the browser loads: the button, the rest of it once a key is in hand, and the screenshot maker. */
function scripts() {
  const file = (url) => {
    const bytes = readFileSync(url);
    return { bytes, gzip: gzipSync(bytes, { level: 9 }), tag: `"${createHash('sha256').update(bytes).digest('base64url').slice(0, 20)}"` };
  };
  return {
    'bottle.js': file(new URL('./bottle.js', import.meta.url)),
    'bottle-ui.mjs': file(new URL('./bottle-ui.mjs', import.meta.url)),
    'shot.mjs': file(fileURLToPath(import.meta.resolve('modern-screenshot')))
  };
}

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
 * The endpoint, mounted at `prefix` (default /bottle). Its handle(req, res) answers anything
 * under the prefix and returns true, or returns false having sent nothing.
 *
 * - `store`: where notes are kept, with put(key, bytes), get(key) (null when there is none)
 *   and folders(prefix), as service/store.mjs's are. Keys are `bottles/<id>/note.json` and
 *   `bottles/<id>/shot.jpg`.
 * - `key`: the secret in the link that shows the button (?bottle=<key>). Without one the
 *   button never shows and no note is taken.
 * - `reader`: a second secret, for reading the notes and marking them. Without one nobody can.
 * - `origins`: the sites whose pages may send notes (their origins, such as https://example.com).
 * - `caller(req)`: who is asking, for the rate limits (default: the connecting address).
 * - `perHour`, `perDay`: how many notes each caller may leave; `wrongPerHour`, how many wrong keys each may try.
 */
export function createBottle({ store, key = '', reader = '', origins = [], prefix = '/bottle', caller = (req) => req.socket.remoteAddress ?? 'unknown',
  perHour = 30, perDay = 200, wrongPerHour = 10, log = () => {}, now = () => Date.now() } = {}) {
  const files = scripts();
  const notes = new Window(perHour, 3600_000, now), daily = new Window(perDay, 86400_000, now), wrong = new Window(wrongPerHour, 3600_000, now);
  const allowed = new Set(origins.map((o) => new URL(o).origin));

  /** Whether the request carries `secret` as `header`; a caller who keeps getting it wrong is turned away for a while. */
  const holds = (req, res, header, secret) => {
    const given = header === 'authorization' ? /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] : req.headers[header];
    if (secret && same(given, secret)) return true;
    if (!wrong.hit(caller(req))) json(res, 429, { error: 'Too many wrong keys. Try again in an hour.' });
    else json(res, secret ? 403 : 404, { error: secret ? 'That key is not right.' : 'Notes are not taken here.' });
    return false;
  };

  const fromSite = (req) => !req.headers.origin || allowed.has(req.headers.origin);

  const read = async (id) => {
    const bytes = await store.get(`bottles/${id}/note.json`);
    return bytes ? JSON.parse(bytes) : null;
  };

  const sendFile = (req, res, name) => {
    const file = files[name];
    const headers = { ...HEADERS, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600', etag: file.tag, vary: 'accept-encoding' };
    if (req.headers['if-none-match'] === file.tag) { res.writeHead(304, headers).end(); return; }
    const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    const body = gzip ? file.gzip : file.bytes;
    res.writeHead(200, { ...headers, ...(gzip ? { 'content-encoding': 'gzip' } : {}), 'content-length': body.length }).end(req.method === 'HEAD' ? undefined : body);
  };

  async function leave(req, res) {
    if (!fromSite(req)) { json(res, 403, { error: 'Notes are taken only from this site.' }); return; }
    if (!holds(req, res, 'x-bottle-key', key)) return;
    const who = caller(req);
    if (!notes.hit(who) || !daily.hit('everyone')) { json(res, 429, { error: 'That is a lot of notes. Try again in a while.' }); return; }
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
    const shot = shotFrom(body);
    if (shot) {
      await store.put(`bottles/${note.id}/shot.jpg`, shot);
      note.shot = true;
    }
    await store.put(`bottles/${note.id}/note.json`, JSON.stringify(note, null, 2));
    log(`bottle: a note was left, ${note.id}`);
    json(res, 201, { id: note.id });
  }

  async function list(req, res, url) {
    const state = url.searchParams.get('state');
    if (state && state !== 'all' && !STATES.includes(state)) { json(res, 400, { error: `state is one of ${STATES.join(', ')} or all` }); return; }
    const ids = (await store.folders('bottles')).filter((id) => ID.test(id)).sort();
    const found = [];
    for (let i = 0; i < ids.length; i += 8) found.push(...(await Promise.all(ids.slice(i, i + 8).map(read))));
    json(res, 200, { notes: found.filter((n) => n && (state === 'all' || n.state === (state ?? 'new'))) });
  }

  async function mark(req, res, id) {
    const note = await read(id);
    if (!note) { json(res, 404, { error: 'There is no such note.' }); return; }
    let body;
    try { body = JSON.parse((await readBytes(req, 64 * 1024))?.toString('utf8') ?? ''); } catch { body = null; }
    if (!STATES.includes(body?.state)) { json(res, 400, { error: `Send { "state": one of ${STATES.join(', ')} } and, if you like, an "answer".` }); return; }
    const answer = text(body.answer, FIELDS.note);
    note.state = body.state;
    note.history = [...(note.history ?? []), { at: new Date(now()).toISOString(), state: body.state, ...(answer ? { answer } : {}) }];
    await store.put(`bottles/${id}/note.json`, JSON.stringify(note, null, 2));
    json(res, 200, note);
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost'), path = url.pathname;
    if (path !== prefix && !path.startsWith(`${prefix}/`)) return false;
    const rest = path.slice(prefix.length + 1), method = req.method;
    try {
      if ((method === 'GET' || method === 'HEAD') && files[rest]) { sendFile(req, res, rest); return true; }
      if (rest === 'check' && method === 'POST') {
        if (!fromSite(req)) json(res, 403, { error: 'Only from this site.' });
        else if (holds(req, res, 'x-bottle-key', key)) json(res, 200, { ok: true });
        return true;
      }
      if (rest === 'notes' && method === 'POST') { await leave(req, res); return true; }
      if (rest === 'notes' && method === 'GET') { if (holds(req, res, 'authorization', reader)) await list(req, res, url); return true; }
      const one = /^notes\/([^/]+)(\/shot\.jpg)?$/.exec(rest);
      if (one && ID.test(one[1])) {
        if (!holds(req, res, 'authorization', reader)) return true;
        if (method === 'GET' && one[2]) {
          const shot = await store.get(`bottles/${one[1]}/shot.jpg`);
          if (shot) res.writeHead(200, { ...HEADERS, 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'content-length': shot.length }).end(shot);
          else json(res, 404, { error: 'That note has no screenshot.' });
          return true;
        }
        if (method === 'GET') { const note = await read(one[1]); json(res, note ? 200 : 404, note ?? { error: 'There is no such note.' }); return true; }
        if (method === 'PATCH' && !one[2]) { await mark(req, res, one[1]); return true; }
      }
      json(res, 404, { error: 'There is nothing here.' });
    } catch (err) {
      log(`bottle: ${method} ${path}: ${err.stack ?? err}`);
      if (!res.headersSent) json(res, 500, { error: 'Something went wrong. Try again in a while.' });
    }
    return true;
  }

  return { handle, on: Boolean(key) };
}
