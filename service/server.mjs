// The Pixel Reel service over HTTP: the MCP connector at /mcp, the website, and for each reel
// a page to watch it (/r/<id>), its recordings and its MP4. Nothing here is specific to one host; it
// needs a folder (or store) for the reels, and the address people reach it at.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ReelError } from '../src/reel.js';
import { createMcpServer } from './mcp.mjs';
import { BusyError, isId } from './reels.mjs';
import { robotsTxt, SITE_PAGES, SITE_POLICY, sitemapXml, sitePage, WATCH, watchPage } from './site.mjs';
import { sendBytes, sendSqueezed, sendStatic, squeezed, tagOf } from './static.mjs';
import { MAX_WORDS_BODY, PDF_MAX, sourceOf, TryError } from './try.mjs';

/** The most a request to /mcp may carry. A long reel is a few kilobytes. */
export const MAX_BODY = 256 * 1024;

const AUDIO_FILE = /^[A-Za-z0-9_-]{1,64}\.mp3$/;

const SAFE = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };

/** A reel is for whoever has its link, so search engines are asked to stay out of them all. */
const UNLISTED = { 'x-robots-tag': 'noindex, nofollow' };

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A small page that needs nothing else, for when something has gone wrong with the service itself. */
export function notice(heading, words) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)} - Pixel Reel</title>
<style>
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b1220; color: #f8f7dd; font: 20px/1.55 Verdana, Tahoma, sans-serif; }
main { max-width: 34em; margin: 16px; padding: 22px 26px; background: #13203a; border: 4px solid #ebeac5; border-radius: 4px; }
h1 { margin: 0 0 8px; font-size: 26px; color: #ffcc4d; }
p { margin: 0; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(words)}</p>
</main>
</body>
</html>
`;
}

const sendPage = (res, status, html, extra = {}) => res.writeHead(status, { ...SAFE, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra }).end(html);

/**
 * Reads a request body up to `max` bytes, as bytes. Null if it is bigger: the rest is left
 * unread, and the line stays open so that the caller can be told why.
 */
async function readBytes(req, max) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > max) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Reads a request body up to `max` bytes, as text. Null if it is bigger. */
const readBody = async (req, max = MAX_BODY) => (await readBytes(req, max))?.toString('utf8') ?? null;

const rpcError = (res, status, code, message) => res.writeHead(status, { ...SAFE, 'content-type': 'application/json' })
  .end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));

/**
 * Who is asking: the connecting address, or behind `hops` trusted proxies, the address the
 * outermost of them saw. Each proxy adds the address it was called from to the end of
 * X-Forwarded-For, so that is the `hops`th from the end; anything before it came from the
 * caller, who can write whatever they like there.
 */
export function callerOf(req, hops) {
  const chain = hops > 0 ? String(req.headers['x-forwarded-for'] ?? '').split(',').map((a) => a.trim()).filter(Boolean) : [];
  return chain.at(-hops) ?? chain[0] ?? req.socket.remoteAddress ?? 'unknown';
}

async function handleMcp(req, res, context) {
  const { reels, baseUrl, log, limits, trustProxy } = context;
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); rpcError(res, 405, -32000, 'Send MCP requests with POST.'); return; }
  if (trustProxy) {
    // How many addresses arrive says whether PIXELREEL_TRUST_PROXY is right, without logging any of them. A
    // caller can only add to the list, so the fewest ever seen is how many the proxies in front add themselves.
    const seen = String(req.headers['x-forwarded-for'] ?? '').split(',').filter((a) => a.trim()).length;
    if (seen < context.fewestForwarded) {
      context.fewestForwarded = seen;
      log(seen === trustProxy ? `callers: X-Forwarded-For came with ${seen} address${seen === 1 ? '' : 'es'}, as PIXELREEL_TRUST_PROXY=${trustProxy} expects`
        : `callers: X-Forwarded-For came with ${seen} address${seen === 1 ? '' : 'es'}, but PIXELREEL_TRUST_PROXY is ${trustProxy}. If ${seen || 'no'} prox${seen === 1 ? 'y is' : 'ies are'} in front, set it to ${seen}, or callers are told apart wrongly`);
    }
  }
  const raw = await readBody(req);
  if (raw === null) { rpcError(res, 413, -32600, `A request may carry at most ${MAX_BODY / 1024} KB.`); return; }
  let body;
  try { body = JSON.parse(raw); } catch { rpcError(res, 400, -32700, 'The request is not valid JSON.'); return; }
  const server = createMcpServer({ reels, baseUrl, limits, client: callerOf(req, trustProxy) });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    log(`mcp: ${err.stack ?? err}`);
    if (!res.headersSent) rpcError(res, 500, -32603, 'Something went wrong. Try again in a while.');
  }
}

async function handleReel(req, res, id, rest, context) {
  const { reels, baseUrl } = context;
  const status = await reels.status(id);
  if (!status) {
    if (rest === 'play.json') { res.writeHead(404, { ...SAFE, ...UNLISTED, 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end('{"state":"gone"}'); return; }
    sendSitePage(req, res, 404, 'reel-gone', context, UNLISTED);
    return;
  }
  if (rest === '') {
    // The site's own page with its player, which asks for play.json and waits with the
    // watcher while the voice is still being recorded. It names the reel and points at
    // its own picture, so a link sent in a message shows what it is, but holds none of its words.
    const page = sitePage('reel', baseUrl, {
      values: { reelid: id, reeltitle: escapeHtml(status.title) }, title: `${status.title} - Pixel Reel`, path: `/r/${id}`,
      image: `${baseUrl}/r/${id}/card.png`, imagealt: `${status.title}: a pixel reel. Press Play.`
    });
    sendSqueezed(req, res, 200, squeezed(page), { ...SAFE, ...UNLISTED, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': SITE_POLICY });
    return;
  }
  if (rest === 'play.json') {
    // what a player needs: the reel's own page asks for it, and so does the player inside a
    // chat, from another origin (the chat's frame)
    const play = { state: status.state, title: status.title, watch: `${baseUrl}/r/${id}`, expires: status.expires };
    if (status.state === 'failed') play.error = status.error;
    // while the voice is being recorded: how many lines are done, of how many
    if (status.state === 'recording' && status.lines) Object.assign(play, { recorded: status.recorded, lines: status.lines });
    // while it is written, how many scenes so far, and its name once it has one; while it waits its turn, how many jobs are before it
    if (status.state === 'writing' || status.state === 'queued') Object.assign(play, reels.progress(id));
    if (status.state === 'ready') {
      play.reel = await reels.reel(id);
      play.clips = ((await reels.manifest(id))?.clips ?? []).map((c) => ({ text: c.text, file: `${baseUrl}/r/${id}/audio/${c.file}`, seconds: c.seconds }));
      if (status.video === 'ready') play.video = `${baseUrl}/r/${id}/video.mp4`;
    }
    res.writeHead(200, { ...SAFE, ...UNLISTED, 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }).end(JSON.stringify(play));
    return;
  }
  if (rest === 'card.png') {
    // the reel's own picture, for a link sent in a message; the same card as every reel's if it cannot be drawn
    const png = await reels.card(id);
    if (!png) { res.writeHead(302, { ...SAFE, ...UNLISTED, location: '/site/art/reel-card.png', 'cache-control': 'no-store' }).end(); return; }
    sendBytes(req, res, png, { ...SAFE, ...UNLISTED, 'content-type': 'image/png', 'cache-control': 'private, max-age=3600' });
    return;
  }
  const audio = /^audio\/(.+)$/.exec(rest);
  const key = audio && AUDIO_FILE.test(audio[1]) ? `reels/${id}/audio/${audio[1]}` : rest === 'video.mp4' ? `reels/${id}/video.mp4` : null;
  const bytes = key && (await reels.store.get(key));
  if (!bytes) { sendSitePage(req, res, 404, 'not-found', context, UNLISTED); return; }
  sendBytes(req, res, bytes, { ...SAFE, ...UNLISTED, 'content-type': key.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg', 'cache-control': 'private, max-age=3600' });
}

const sendJson = (res, status, value) => res.writeHead(status, { ...SAFE, 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(value));

/**
 * Make it right here: a visitor with no Claude of their own gives one thing to explain (a
 * link or a few words, some writing, a PDF or a picture: sourceOf in service/try.mjs). They
 * are given a reel's page to go to straight away, and the service's writer has Claude write
 * the reel while they wait there (writeReel). Only there when the service was given a
 * writer (service/writer.mjs), since every reel made this way costs money; and counted more
 * strictly than the connector.
 */
async function handleTry(req, res, context) {
  const { reels, writer, limits, trustProxy, baseUrl } = context;
  if (!writer) { sendSitePage(req, res, 404, 'not-found', context); return; }
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); sendJson(res, 405, { error: 'Ask with POST.' }); return; }
  // Only the website's own page may ask, so no other site can spend this service's money. A
  // browser says where a request comes from; anything that does not say is turned away too.
  const elsewhere = req.headers.origin !== new URL(baseUrl).origin ||
    (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin');
  if (elsewhere) { sendJson(res, 403, { error: 'Ask from the Pixel Reel website.' }); return; }
  const type = req.headers['content-type'], words = /^application\/json\b/i.test(type ?? '');
  const tooBig = () => {
    // the rest of what is being sent is not wanted: once the answer has gone the line is cut, not read to its end
    res.setHeader('connection', 'close');
    res.once('finish', () => req.socket.destroy());
    sendJson(res, 413, { error: words ? 'That is too much for one reel. Give it less: a few pages at most.' : 'That file is too big. Give it a shorter one, or only the pages that matter.' });
  };
  const most = words ? MAX_WORDS_BODY : PDF_MAX;
  if (Number(req.headers['content-length']) > most) { tooBig(); return; }
  const bytes = await readBytes(req, most);
  if (!bytes) { tooBig(); return; }
  let source;
  try {
    source = sourceOf(type, bytes);
  } catch (err) {
    if (!(err instanceof TryError)) throw err;
    sendJson(res, 400, { error: err.message });
    return;
  }
  const caller = callerOf(req, trustProxy);
  const refused = limits?.tries.hit(caller);
  if (refused) { sendJson(res, 429, { error: `No more reels just now. ${refused}` }); return; }
  let begun;
  try {
    await writer.fits?.(source);   // too long to read is said here and now, while what was given is still in front of them
    begun = await reels.begin(WRITING_TITLE);
  } catch (err) {
    limits?.tries.undo(caller);   // nothing has reached Claude yet
    if (!(err instanceof TryError || err instanceof BusyError)) throw err;
    sendJson(res, 422, { error: err.message });
    return;
  }
  // The visitor goes to the reel's own page at once, and waits there with something to
  // watch. Claude writes the scenes after this request has been answered.
  sendJson(res, 200, { id: begun.id, watch: `/r/${begun.id}` });
  const job = writeReel(context, begun.id, source, caller).finally(() => context.writing.delete(job));
  context.writing.add(job);
}

/** What a reel is called on its page until Claude has given it a title. */
export const WRITING_TITLE = 'Your reel';

/**
 * Has the writer write the scenes of reel `id` from what the visitor gave, and starts
 * recording them; or gives up on the reel, saying why in words for whoever is waiting on
 * its page. Never throws.
 */
async function writeReel({ reels, writer, limits, log }, id, source, caller) {
  const onProgress = (so) => reels.note(id, so);   // for the reel's page to show while it waits
  try {
    let reel = await writer(source, { onProgress });
    try {
      await reels.write(id, reel);
    } catch (err) {
      if (!(err instanceof ReelError)) throw err;
      reel = await writer(source, { before: reel, problems: err.problems, onProgress });   // one chance to put it right
      await reels.write(id, reel);
    }
  } catch (err) {
    if (err instanceof TryError && err.free) limits?.tries.undo(caller);   // what never reached Claude is not one of the visitor's goes
    const known = err instanceof TryError || err instanceof ReelError;
    if (!known) log(`try: ${id} could not be written: ${err.stack ?? err}`);
    const why = err instanceof TryError ? err.message : err instanceof ReelError ? 'Claude could not write that reel. Try again, or try other words.' : 'Something went wrong. Try again in a while.';
    await reels.fail(id, why).catch((failure) => log(`try: ${id} could not be marked as failed: ${failure.stack ?? failure}`));
  }
}

/**
 * One of the site's own pages, which loads only the site's own files. Each is put together
 * once and kept, compressed (unless `fresh`, when it is made again each time, for working on
 * the site), and a browser that already has it is told so.
 */
function sendSitePage(req, res, status, name, { baseUrl, listed, fresh, pages, writer }, extra = {}) {
  let page = fresh ? null : pages.get(name);
  if (!page) {
    // "watch/<reel>" is the page of one of the site's own reels
    const html = name.startsWith('watch/') ? watchPage(name.slice(6), baseUrl, { listed }) : sitePage(name, baseUrl, { listed, values: { here: writer ? 'on' : 'off' } });
    page = squeezed(html);
    page.tag = tagOf(page.bytes);
    if (!fresh) pages.set(name, page);
  }
  const keep = status !== 200 ? 'no-store' : fresh ? 'no-cache' : 'public, max-age=300';
  const headers = { ...SAFE, ...extra, 'content-type': 'text/html; charset=utf-8', 'cache-control': keep, 'content-security-policy': SITE_POLICY, etag: page.tag };
  if (status === 200 && req.headers['if-none-match'] === page.tag) { res.writeHead(304, headers).end(); return; }
  sendSqueezed(req, res, status, page, headers);
}

/**
 * The picture a message shows for the page of one of the site's own reels
 * (/watch/<name>/card.png): drawn once, the way a made reel's is, and the site's own card if
 * it cannot be.
 */
async function sendWatchCard(req, res, name, { reels, cards, fresh, log }) {
  if (fresh || !cards.has(name)) {
    try {
      cards.set(name, Buffer.from(await reels.picture(JSON.parse(readFileSync(new URL(`../reels/${name}/reel.json`, import.meta.url), 'utf8')))));
    } catch (err) {
      log(`${name}: its picture could not be drawn: ${err.stack ?? err}`);
      cards.set(name, null);
    }
  }
  const png = cards.get(name);
  if (!png) { res.writeHead(302, { ...SAFE, location: '/site/art/share.png', 'cache-control': 'no-store' }).end(); return; }
  sendBytes(req, res, png, { ...SAFE, 'content-type': 'image/png', 'cache-control': fresh ? 'no-cache' : 'public, max-age=3600' });
}

/**
 * The service as an HTTP server (not yet listening). `baseUrl` is the address people reach it
 * at; `limits` ({ reels, videos }, RateLimits) cap what each caller asks for; `trustProxy`
 * (how many proxies are in front, or true for one) takes the caller's address from the
 * X-Forwarded-For they set;
 * `listed` lets search engines list the website (never the reels), for once it is open to all;
 * `fresh` has browsers check for a newer copy of the site's files every time, for working on it;
 * `writer` (see service/writer.mjs) switches on Make it right here, which costs money a reel;
 * the server's written() resolves once every reel begun that way is written or given up on.
 */
export function createService({ reels, baseUrl, log = () => {}, limits = null, trustProxy = false, listed = false, fresh = false, writer = null }) {
  const context = {
    reels, baseUrl: baseUrl.replace(/\/$/, ''), log, limits, listed, fresh, writer, pages: new Map(), cards: new Map(), writing: new Set(),
    trustProxy: trustProxy === true ? 1 : Math.max(0, Math.floor(Number(trustProxy)) || 0), fewestForwarded: Infinity
  };
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/mcp') { await handleMcp(req, res, context); return; }
      if (path === '/try') { await handleTry(req, res, context); return; }
      if (path === '/health') { res.writeHead(200, { ...SAFE, 'content-type': 'text/plain' }).end('ok'); return; }
      const reading = req.method === 'GET' || req.method === 'HEAD';
      if (reading && SITE_PAGES[path]) { sendSitePage(req, res, 200, SITE_PAGES[path], context); return; }
      const watch = /^\/watch\/([a-z0-9-]+)(\/card\.png)?$/.exec(path);
      if (reading && watch && WATCH.includes(watch[1])) {
        if (watch[2]) await sendWatchCard(req, res, watch[1], context);
        else sendSitePage(req, res, 200, `watch/${watch[1]}`, context);
        return;
      }
      if (reading && path === '/robots.txt') {
        res.writeHead(200, { ...SAFE, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' }).end(robotsTxt(context.baseUrl, listed));
        return;
      }
      if (reading && path === '/sitemap.xml' && listed) {
        res.writeHead(200, { ...SAFE, 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' }).end(sitemapXml(context.baseUrl));
        return;
      }
      if (reading && sendStatic(req, res, path, SAFE, fresh)) return;
      const reel = /^\/r\/([^/]+)(?:\/(.*))?$/.exec(path);
      if (reel && isId(reel[1]) && reading) { await handleReel(req, res, reel[1], reel[2] ?? '', context); return; }
      sendSitePage(req, res, 404, 'not-found', context);
    } catch (err) {
      log(`${req.method} ${req.url}: ${err.stack ?? err}`);
      if (!res.headersSent) sendPage(res, 500, notice('Something went wrong', 'Try again in a while.'));
    }
  });
  /** Resolves once every reel that Make it right here has begun is written, or given up on. */
  server.written = async () => { while (context.writing.size) await Promise.all(context.writing); };
  return server;
}
