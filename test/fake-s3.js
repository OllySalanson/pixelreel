// A small S3-style bucket in memory, served over HTTP, for testing S3Store: it checks every
// request's signature, lists a page of two at a time so paging is exercised, and can be told
// to fail the next few requests.
import { createServer } from 'node:http';
import { signRequest } from '../service/store.mjs';

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function fakeS3({ bucket = 'reels', accessKey = 'id', secretKey = 'secret', region = 'auto', page = 2 } = {}) {
  const objects = new Map();
  const fake = { objects, failNext: 0, requests: 0 };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    fake.requests++;
    if (fake.failNext > 0) { fake.failNext--; res.writeHead(503).end('slow down'); return; }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const amzDate = req.headers['x-amz-date'] ?? '';
    const date = new Date(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
    const expected = signRequest({ method: req.method, url: url.href, body, region, accessKey, secretKey, date }).authorization;
    if (Number.isNaN(date.getTime()) || req.headers.authorization !== expected) { res.writeHead(403).end('SignatureDoesNotMatch'); return; }
    const [, name, ...rest] = url.pathname.split('/');
    if (name !== bucket) { res.writeHead(404).end('NoSuchBucket'); return; }
    const key = rest.map(decodeURIComponent).join('/');
    if (!key && req.method === 'GET') {
      const prefix = url.searchParams.get('prefix') ?? '', delimiter = url.searchParams.get('delimiter'), marker = url.searchParams.get('marker') ?? '';
      const entries = new Set();
      for (const k of [...objects.keys()].filter((k) => k.startsWith(prefix))) {
        const cut = delimiter ? k.indexOf(delimiter, prefix.length) : -1;
        entries.add(cut >= 0 ? `P${k.slice(0, cut + 1)}` : `K${k}`);
      }
      const after = [...entries].filter((e) => e.slice(1) > marker).sort((a, b) => (a.slice(1) < b.slice(1) ? -1 : 1));
      const shown = after.slice(0, page), truncated = after.length > page;
      const xml = '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>' +
        `<Name>${bucket}</Name><Prefix>${escapeXml(prefix)}</Prefix><IsTruncated>${truncated}</IsTruncated>` +
        (truncated && delimiter ? `<NextMarker>${escapeXml(shown.at(-1).slice(1))}</NextMarker>` : '') +
        shown.map((e) => (e[0] === 'K' ? `<Contents><Key>${escapeXml(e.slice(1))}</Key><Size>${objects.get(e.slice(1)).length}</Size></Contents>` : `<CommonPrefixes><Prefix>${escapeXml(e.slice(1))}</Prefix></CommonPrefixes>`)).join('') +
        '</ListBucketResult>';
      res.writeHead(200, { 'content-type': 'application/xml' }).end(xml);
      return;
    }
    if (req.method === 'PUT') { objects.set(key, body); res.writeHead(200).end(); return; }
    const found = objects.get(key);
    if (req.method === 'DELETE') { objects.delete(key); res.writeHead(found ? 204 : 404).end(); return; }
    if (!found) { res.writeHead(404).end('NoSuchKey'); return; }
    res.writeHead(200, { 'content-length': found.length }).end(req.method === 'HEAD' ? undefined : found);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.endpoint = `http://127.0.0.1:${server.address().port}`;
  fake.options = { endpoint: fake.endpoint, bucket, accessKey, secretKey, region, retryMs: 1 };
  fake.close = () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  return fake;
}
