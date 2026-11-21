// The Pixel Reel service over HTTP: the MCP connector at /mcp, and for each reel a page to
// watch it (/r/<id>), its recordings and its MP4. Nothing here is specific to one host; it
// needs a folder (or store) for the reels, and the address people reach it at.
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { pageHtml } from '../scripts/page.mjs';
import { createMcpServer } from './mcp.mjs';
import { isId } from './reels.mjs';
import { SITE_PAGES, sitePage } from './site.mjs';

/** The most a request to /mcp may carry. A long reel is a few kilobytes. */
export const MAX_BODY = 256 * 1024;

const AUDIO_FILE = /^[A-Za-z0-9_-]{1,64}\.mp3$/;

/** What a reel's page may load: its own script and styles, the font inside it, and its own recordings. Nothing from elsewhere. */
const PAGE_POLICY = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; media-src 'self'; base-uri 'none'; form-action 'none'";

const SAFE = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A small page in the player's colours, for a reel that is not ready, or not there. */
export function notice(heading, words, { refresh = 0 } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">\n` : ''}<title>${escapeHtml(heading)} - pixelreel</title>
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

/** Sends `bytes`, answering Range requests so audio and video can seek. */
function sendBytes(req, res, bytes, type) {
  const headers = { ...SAFE, 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const size = bytes.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` }).end(); return; }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': bytes.length });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}

const sendPage = (res, status, html, extra = {}) => res.writeHead(status, { ...SAFE, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra }).end(html);

/** Reads a request body up to MAX_BODY bytes. Null if it is bigger. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const rpcError = (res, status, code, message) => res.writeHead(status, { ...SAFE, 'content-type': 'application/json' })
  .end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));

/** Who is asking: the connecting address, or behind a trusted proxy, the first it forwarded for. */
function callerOf(req, trustProxy) {
  const forwarded = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  return forwarded || req.socket.remoteAddress || 'unknown';
}

async function handleMcp(req, res, { reels, baseUrl, log, limits, trustProxy }) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); rpcError(res, 405, -32000, 'Send MCP requests with POST.'); return; }
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

async function handleReel(req, res, id, rest, { reels, baseUrl }) {
  const status = await reels.status(id);
  if (!status) {
    if (rest === 'play.json') { res.writeHead(404, { ...SAFE, 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end('{"state":"gone"}'); return; }
    sendPage(res, 404, notice('No reel here', 'This reel has been deleted, or kept past its 30 days, or the link is not quite right.'));
    return;
  }
  if (rest === '') {
    if (status.state === 'failed') { sendPage(res, 200, notice('This reel could not be made', status.error ?? 'Something went wrong.')); return; }
    if (status.state !== 'ready') {
      sendPage(res, 200, notice('Nearly ready', `The voice for "${status.title}" is being recorded. This page will play the reel as soon as it is done.`, { refresh: 5 }));
      return;
    }
    const manifest = await reels.manifest(id);
    const clips = (manifest?.clips ?? []).map((c) => ({ text: c.text, file: `/r/${id}/audio/${c.file}`, seconds: c.seconds }));
    const page = pageHtml({ reelJson: JSON.stringify(await reels.reel(id)), manifest: { clips }, title: `${status.title} - pixelreel` });
    sendPage(res, 200, page, { 'content-security-policy': PAGE_POLICY });
    return;
  }
  if (rest === 'play.json') {
    // what the player inside a chat needs, asked for from another origin (the chat's frame)
    const play = { state: status.state, title: status.title, watch: `${baseUrl}/r/${id}` };
    if (status.state === 'failed') play.error = status.error;
    if (status.state === 'ready') {
      play.reel = await reels.reel(id);
      play.clips = ((await reels.manifest(id))?.clips ?? []).map((c) => ({ text: c.text, file: `${baseUrl}/r/${id}/audio/${c.file}`, seconds: c.seconds }));
    }
    res.writeHead(200, { ...SAFE, 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }).end(JSON.stringify(play));
    return;
  }
  const audio = /^audio\/(.+)$/.exec(rest);
  const key = audio && AUDIO_FILE.test(audio[1]) ? `reels/${id}/audio/${audio[1]}` : rest === 'video.mp4' ? `reels/${id}/video.mp4` : null;
  const bytes = key && (await reels.store.get(key));
  if (!bytes) { sendPage(res, 404, notice('Not here', 'There is nothing at this address.')); return; }
  sendBytes(req, res, bytes, key.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg');
}

/**
 * The service as an HTTP server (not yet listening). `baseUrl` is the address people reach it
 * at; `limits` ({ reels, videos }, RateLimits) cap what each caller asks for; `trustProxy`
 * takes the caller's address from X-Forwarded-For, for a service behind a proxy that sets it.
 */
export function createService({ reels, baseUrl, log = () => {}, limits = null, trustProxy = false }) {
  const context = { reels, baseUrl: baseUrl.replace(/\/$/, ''), log, limits, trustProxy };
  return createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/mcp') { await handleMcp(req, res, context); return; }
      if (path === '/health') { res.writeHead(200, { ...SAFE, 'content-type': 'text/plain' }).end('ok'); return; }
      if (SITE_PAGES[path] && (req.method === 'GET' || req.method === 'HEAD')) {
        sendPage(res, 200, sitePage(SITE_PAGES[path], context.baseUrl), { 'cache-control': 'public, max-age=300', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
        return;
      }
      const reel = /^\/r\/([^/]+)(?:\/(.*))?$/.exec(path);
      if (reel && isId(reel[1]) && (req.method === 'GET' || req.method === 'HEAD')) { await handleReel(req, res, reel[1], reel[2] ?? '', context); return; }
      sendPage(res, 404, notice('Not here', 'There is nothing at this address.'));
    } catch (err) {
      log(`${req.method} ${req.url}: ${err.stack ?? err}`);
      if (!res.headersSent) sendPage(res, 500, notice('Something went wrong', 'Try again in a while.'));
    }
  });
}
