// Where the service keeps reels, behind one small interface so the place can change without
// the rest noticing: a folder on disk, or an S3-style bucket (Google Cloud Storage, Cloudflare
// R2). Keys are paths such as "reels/<id>/reel.json"; values are bytes.
import { createHash, createHmac } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile, rename } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

const KEY = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/;

/** Checks a key is a plain relative path, with no way out of the store. */
export function checkKey(key) {
  if (typeof key !== 'string' || !KEY.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`"${key}" is not a key the store takes`);
  }
  return key;
}

/** A store in a folder on this machine. */
export class DiskStore {
  constructor(root) {
    this.root = normalize(root);
  }

  toString() {
    return this.root;
  }

  path(key) {
    const file = join(this.root, checkKey(key));
    if (!file.startsWith(this.root + sep)) throw new Error(`"${key}" is outside the store`);
    return file;
  }

  /** Saves `data` (bytes or text) under `key`, all at once: a reader never sees half a file. */
  async put(key, data) {
    const file = this.path(key), part = `${file}.${process.pid}.${Date.now()}.part`;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(part, data);
    await rename(part, file);
  }

  /** The bytes saved under `key`, or null if there are none. */
  async get(key) {
    try {
      return await readFile(this.path(key));
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') return null;
      throw err;
    }
  }

  /** How many bytes are saved under `key`, or null. */
  async size(key) {
    try {
      const s = await stat(this.path(key));
      return s.isFile() ? s.size : null;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Every key under `prefix` (a folder such as "reels/abc"), in no particular order. */
  async list(prefix) {
    const keys = [];
    const walk = async (key) => {
      let entries;
      try {
        entries = await readdir(this.path(key), { withFileTypes: true });
      } catch (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return;
        throw err;
      }
      for (const e of entries) {
        if (e.name.endsWith('.part')) continue;
        if (e.isDirectory()) await walk(`${key}/${e.name}`);
        else keys.push(`${key}/${e.name}`);
      }
    };
    await walk(checkKey(prefix));
    return keys;
  }

  /** The folders directly under `prefix`, such as every reel id under "reels". */
  async folders(prefix) {
    try {
      return (await readdir(this.path(prefix), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /** Deletes `prefix` and everything under it. */
  async remove(prefix) {
    await rm(this.path(prefix), { recursive: true, force: true });
  }
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
/** Percent-encodes as AWS Signature Version 4 wants: everything but A-Z a-z 0-9 - _ . ~ */
const encode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const byPair = ([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0);

/**
 * Signs a request with AWS Signature Version 4, the way S3-style stores (Cloudflare R2, Google
 * Cloud Storage's XML API with an HMAC key) want it. `url` must have its path already encoded.
 * Returns the headers to send, `host` left out (fetch sets it) though it is signed.
 */
export function signRequest({ method, url, headers = {}, body = '', region, accessKey, secretKey, date = new Date() }) {
  const u = new URL(url);
  const stamp = date.toISOString().replace(/[-:]|\.\d{3}/g, ''), day = stamp.slice(0, 8);
  const all = { host: u.host, 'x-amz-content-sha256': sha256(body), 'x-amz-date': stamp };
  for (const [name, value] of Object.entries(headers)) all[name.toLowerCase()] = String(value).trim();
  const names = Object.keys(all).sort(), signed = names.join(';');
  const query = [...u.searchParams].map(([k, v]) => [encode(k), encode(v)]).sort(byPair).map(([k, v]) => `${k}=${v}`).join('&');
  const canonical = [method, u.pathname, query, names.map((n) => `${n}:${all[n]}\n`).join(''), signed, all['x-amz-content-sha256']].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  const key = ['s3', 'aws4_request'].reduce(hmac, hmac(hmac(`AWS4${secretKey}`, day), region));
  const send = { ...all };
  delete send.host;
  return { ...send, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${hmac(key, toSign).toString('hex')}` };
}

const unescapeXml = (s) => s.replace(/&(lt|gt|quot|apos|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]);
const xmlValues = (xml, pattern) => [...xml.matchAll(pattern)].map((m) => unescapeXml(m[1]));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A store in an S3-style bucket, for hosts whose own disk does not last (Cloud Run): Google
 * Cloud Storage through its XML API (endpoint https://storage.googleapis.com, an HMAC key) or
 * Cloudflare R2 (endpoint https://<account>.r2.cloudflarestorage.com). Each put is one object,
 * so a reader never sees half a file. Requests that fail on the store's side are tried again.
 */
export class S3Store {
  constructor({ endpoint, bucket, region = 'auto', accessKey, secretKey, fetch = globalThis.fetch, retries = 3, retryMs = 250 }) {
    if (!endpoint || !bucket || !accessKey || !secretKey) throw new Error('an S3 store needs an endpoint, a bucket, a key id and a secret');
    Object.assign(this, { endpoint: endpoint.replace(/\/$/, ''), bucket, region, accessKey, secretKey, fetch, retries, retryMs });
  }

  /** The store PIXELREEL_S3_ENDPOINT, _BUCKET, _REGION (default auto), _KEY_ID and _SECRET name. */
  static fromEnv(env) {
    return new S3Store({
      endpoint: env.PIXELREEL_S3_ENDPOINT, bucket: env.PIXELREEL_S3_BUCKET, region: env.PIXELREEL_S3_REGION || 'auto',
      accessKey: env.PIXELREEL_S3_KEY_ID, secretKey: env.PIXELREEL_S3_SECRET
    });
  }

  toString() {
    return `${this.endpoint}/${this.bucket}`;
  }

  async request(method, key, { query = {}, body } = {}) {
    const url = new URL(`${this.endpoint}/${encode(this.bucket)}${key ? `/${checkKey(key).split('/').map(encode).join('/')}` : ''}`);
    for (const [name, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(name, value);
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        const headers = signRequest({ method, url: url.href, body: body ?? '', region: this.region, accessKey: this.accessKey, secretKey: this.secretKey });
        res = await this.fetch(url.href, { method, headers, body });
      } catch (err) {
        if (attempt >= this.retries) throw err;
      }
      if (res && !(res.status >= 500 || res.status === 429)) return res;
      if (attempt >= this.retries) return res;
      await res?.arrayBuffer().catch(() => {});
      await wait(this.retryMs * 2 ** attempt);
    }
  }

  async check(res, what) {
    if (res.ok) return res;
    throw new Error(`the store could not ${what}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }

  async put(key, data) {
    await this.check(await this.request('PUT', key, { body: Buffer.from(data) }), `save ${key}`);
  }

  async get(key) {
    const res = await this.request('GET', key);
    if (res.status === 404) { await res.arrayBuffer(); return null; }
    return Buffer.from(await (await this.check(res, `read ${key}`)).arrayBuffer());
  }

  async size(key) {
    const res = await this.request('HEAD', key);
    if (res.status === 404) return null;
    await this.check(res, `look up ${key}`);
    return Number(res.headers.get('content-length'));
  }

  /** Every object (or, with `delimiter`, every common prefix) under `prefix/`, a page at a time. */
  async listing(prefix, delimiter) {
    const keys = [], prefixes = [];
    let marker;
    for (;;) {
      const res = await this.request('GET', '', { query: { prefix: `${checkKey(prefix)}/`, delimiter, marker } });
      const xml = await (await this.check(res, `list ${prefix}`)).text();
      const pageKeys = xmlValues(xml, /<Contents>[\s\S]*?<Key>([^<]*)<\/Key>/g);
      const pagePrefixes = xmlValues(xml, /<CommonPrefixes>\s*<Prefix>([^<]*)<\/Prefix>/g);
      keys.push(...pageKeys);
      prefixes.push(...pagePrefixes);
      if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) return { keys, prefixes };
      const next = xmlValues(xml, /<NextMarker>([^<]*)<\/NextMarker>/g)[0] ?? [...pageKeys, ...pagePrefixes].sort().at(-1);
      if (!next || next === marker) throw new Error(`the store's listing of ${prefix} did not move on`);
      marker = next;
    }
  }

  async list(prefix) {
    return (await this.listing(prefix)).keys;
  }

  async folders(prefix) {
    return (await this.listing(prefix, '/')).prefixes.map((p) => p.slice(prefix.length + 1).replace(/\/$/, '')).filter(Boolean);
  }

  async remove(prefix) {
    const keys = [...(await this.list(prefix)), prefix];
    const removeOne = async (key) => {
      const res = await this.request('DELETE', key);
      if (res.status !== 404) await this.check(res, `delete ${key}`);
      await res.arrayBuffer().catch(() => {});
    };
    for (let i = 0; i < keys.length; i += 8) await Promise.all(keys.slice(i, i + 8).map(removeOne));
  }
}
