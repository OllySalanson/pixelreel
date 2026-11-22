// The files the website is made of: its styles, scripts, fonts and pictures, the player's
// own modules, and the reels it plays. Only addresses that match a rule here are served, so
// nothing else in the project can be asked for. Text is sent compressed, and everything
// carries a tag, so a browser that already has a file is told so instead of sent it again.
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TYPES = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4'
};
const TEXT = new Set(['.css', '.js', '.json', '.svg', '.txt', '.webmanifest']);

const HOUR = 3600, DAY = 24 * HOUR, YEAR = 365 * DAY;
const NAME = '[A-Za-z0-9][A-Za-z0-9._-]*';

/**
 * What may be served: the address it must match, and how long a browser may keep it. Fonts
 * and recordings never change under the same name (a clip is named after its words), so
 * they are kept for good; the rest is checked again after a while.
 */
const RULES = [
  [new RegExp(`^/site/fonts/${NAME}\\.woff2$`), YEAR],
  [new RegExp(`^/site/(?:css|js)/${NAME}\\.(?:css|js)$`), HOUR],
  [new RegExp(`^/site/art/${NAME}\\.(?:png|jpg|webp|svg|ico|webmanifest|mp3|mp4)$`), DAY],
  [new RegExp(`^/src/${NAME}\\.js$`), HOUR],
  [/^\/fonts\/orange-kid\.woff2$/, YEAR],
  [/^\/reels\/[a-z0-9][a-z0-9-]{0,63}\/reel\.json$/, HOUR],
  [/^\/reels\/[a-z0-9][a-z0-9-]{0,63}\/audio\/manifest\.json$/, HOUR],
  [/^\/reels\/[a-z0-9][a-z0-9-]{0,63}\/audio\/[A-Za-z0-9_-]{1,64}\.mp3$/, YEAR]
];

/**
 * A few files asked for at the top of the site, and where they really are. The service worker
 * is one: a browser lets it look after the pages beside and below its own address, so it
 * has to be at the top.
 */
const ALIASES = { '/favicon.ico': '/site/art/favicon.ico', '/sw.js': '/site/js/sw.js' };

const files = new Map();

/**
 * The file at address `path`, if the site serves it: { bytes, type, tag, keep } and, for
 * text, `br` and `gzip`. Null if there is no such file or it is not the site's to serve.
 * Read once and kept, until the file on disk changes.
 */
export function staticFile(path) {
  path = ALIASES[path] ?? path;
  const rule = RULES.find(([pattern]) => pattern.test(path));
  if (!rule) return null;
  const file = join(ROOT, path);
  let stat;
  try { stat = statSync(file); } catch { return null; }
  if (!stat.isFile()) return null;
  const kept = files.get(path);
  if (kept && kept.mtimeMs === stat.mtimeMs && kept.size === stat.size) return kept;
  const bytes = readFileSync(file), ext = extname(file);
  const entry = { ...(TEXT.has(ext) ? squeezed(bytes) : { bytes }), type: TYPES[ext], keep: rule[1], mtimeMs: stat.mtimeMs, size: stat.size, tag: tagOf(bytes) };
  files.set(path, entry);
  return entry;
}

/** A tag that changes when the bytes do, for a browser to say which copy it has. */
export const tagOf = (bytes) => `"${createHash('sha256').update(bytes).digest('base64url').slice(0, 20)}"`;

/** Text ready to send: { bytes } and, unless it is tiny, the same compressed two ways: `br` and `gzip`. */
export function squeezed(text) {
  const bytes = Buffer.from(text);
  if (bytes.length <= 512) return { bytes };
  return { bytes, br: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }), gzip: gzipSync(bytes, { level: 9 }) };
}

/** Sends `entry` (from squeezed) compressed the best way the browser takes, or as it is. */
export function sendSqueezed(req, res, status, entry, headers) {
  const accepts = String(req.headers['accept-encoding'] ?? '');
  const coding = entry.br && /\bbr\b/.test(accepts) ? 'br' : entry.gzip && /\bgzip\b/.test(accepts) ? 'gzip' : null;
  const body = coding ? entry[coding] : entry.bytes;
  res.writeHead(status, { ...headers, ...(coding ? { 'content-encoding': coding } : {}), ...(entry.br ? { vary: 'accept-encoding' } : {}), 'content-length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
}

/**
 * Answers a GET or HEAD for one of the site's files. `safe` are headers every answer
 * carries; with `fresh`, browsers are told to check for a newer copy every time (for working
 * on the site). Returns false, having sent nothing, if `path` is not one of the site's files.
 */
export function sendStatic(req, res, path, safe = {}, fresh = false) {
  const file = staticFile(path);
  if (!file) return false;
  const keep = fresh ? 'no-cache' : `public, max-age=${file.keep}${file.keep >= YEAR ? ', immutable' : ''}`;
  const headers = { ...safe, 'content-type': file.type, etag: file.tag, 'cache-control': keep };
  if (req.headers['if-none-match'] === file.tag) { res.writeHead(304, headers).end(); return true; }
  if (file.br) sendSqueezed(req, res, 200, file, headers);
  else sendBytes(req, res, file.bytes, headers);   // sound and pictures: as they are, a part at a time if asked
  return true;
}

/** Sends `bytes` with `headers`, answering Range requests so audio and video can seek. */
export function sendBytes(req, res, bytes, headers) {
  headers = { ...headers, 'accept-ranges': 'bytes' };
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
