// The service worker, served as /sw.js: what lets Pixel Reel be added to a phone and open
// with no internet. It keeps a copy, on this device only, of each page the site has shown,
// the files those pages load, and each of the site's own recordings that has been played.
// With a connection everything still comes from the service, as fresh as ever: a kept copy
// is for when there is none, or when it is too slow to wait for. A page the service says
// not to keep (no-store, as a made reel's is) is never kept by this. A made reel is kept
// only when someone asks for it to be (site/js/kept.js puts it in REELS): then this answers
// from that copy when the service cannot be reached, until the day the reel is deleted.
// It is not a module and imports nothing, so every browser with service workers can run
// it; test/app.test.js runs it in Node with stand-ins for the browser's parts.

const PAGES = 'pixelreel-pages-1';   // pages, and the files they load
const SOUND = 'pixelreel-sound-1';   // recordings, which never change under the same name
const REELS = 'pixelreel-reels-1';   // made reels someone chose to keep: the same name as KEPT in site/js/kept.js
const SHARED = 'pixelreel-shared-1'; // what a phone has just shared to Pixel Reel, until the page takes it: the same name as in site/js/shared.js
const OFFLINE = '/offline';          // the page shown in place of one that was never kept
const WAIT_MS = 4000;                // how long a slow connection is given before a kept copy is shown instead
const MOST_SOUND = 400;              // how many recordings are kept before the oldest are let go
const MOST_PAGES = 40;               // how many pages one message may ask to have kept

/** One of the site's own recordings: named after its words, so it never changes. */
const isSound = (path) => /^\/reels\/[a-z0-9-]+\/audio\/[A-Za-z0-9_-]+\.mp3$/.test(path);

/** Something of a made reel's: its page, what its player asks the service for, or a recording. Gives [, id, which]. */
const reelFile = (path) => /^\/r\/([A-Za-z0-9_-]{16,64})(?:\/(play\.json|audio\/[A-Za-z0-9_.-]{1,64}\.mp3))?$/.exec(path);

/** One of the files a page loads: styles, scripts, fonts, pictures, and the reels the site plays. Not video, which is large. */
const isFile = (path) => /^\/(?:site|src|fonts)\/[A-Za-z0-9._/-]+\.(?:css|js|woff2|png|jpg|webp|svg|ico|webmanifest|mp3)$/.test(path) ||
  /^\/reels\/[a-z0-9-]+\/(?:reel|audio\/manifest)\.json$/.test(path) || path === '/favicon.ico';

/** An address that is a page: not a file, and not one of the service's own doors. */
const isPage = (path) => path.startsWith('/') && !path.startsWith('//') && !/\.[a-z0-9]+$/i.test(path) && !/^\/(?:mcp|try|health)(?:\/|$)/.test(path);

/** Whether an answer may be kept: a whole, good one that the service has not said to forget. */
const keepable = (res) => res.status === 200 && !/no-store/.test(res.headers.get('cache-control') ?? '');

/**
 * The answer to `asked` (a request already on its way to the service), kept under `key`
 * for later. The kept copy stands in when there is no connection, when the service is in
 * trouble, or when it has not answered in WAIT_MS. With no kept copy, it is the service's
 * answer or nothing: this throws if there is no connection.
 */
async function freshOrKept(event, key, asked) {
  const cache = await caches.open(PAGES), kept = await cache.match(key);
  const fresh = asked.then(async (res) => {
    if (keepable(res)) await cache.put(key, res.clone());
    return res;
  });
  if (!kept) return fresh;
  event.waitUntil(fresh.catch(() => {}));   // if the kept copy is shown first, the fresh one is still fetched and kept
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(resolve, WAIT_MS, kept); });
  try {
    const res = await Promise.race([fresh, slow]);
    return res.status >= 500 ? kept : res;
  } catch {
    return kept;
  } finally {
    clearTimeout(timer);
  }
}

/** A page: fresh if it can be, the kept copy if not, and the "not online" page if it was never kept. */
async function page(event, path) {
  // the browser may have started asking for the page while this was waking up
  const asked = Promise.resolve(event.preloadResponse).then((early) => early ?? fetch(event.request));
  try {
    return await freshOrKept(event, path, asked);
  } catch {
    const kept = reelFile(path) && (await keptReel(path));   // a reel that was kept still has its page
    return kept ?? (await (await caches.open(PAGES)).match(OFFLINE)) ?? Response.error();
  }
}

/** Forgets a kept reel: its page, what its player asks for, and its recordings. */
async function forgetReel(id) {
  const cache = await caches.open(REELS);
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path === `/r/${id}` || path.startsWith(`/r/${id}/`)) await cache.delete(request);
  }
}

/**
 * Something of a kept reel's (see reelFile), or undefined if the reel was not kept. A reel
 * is kept until the day the service deletes its own copy, which its play.json names: asked
 * for after that, it is forgotten instead.
 */
async function keptReel(path) {
  const cache = await caches.open(REELS), id = reelFile(path)[1];
  const play = await cache.match(`/r/${id}/play.json`);
  if (!play) return undefined;
  const { expires } = await play.json();
  if (expires && Date.parse(expires) <= Date.now()) {
    await forgetReel(id);
    return undefined;
  }
  return cache.match(path);
}

/**
 * What a reel's player asks the service for: the service's answer if it can be had, as it
 * says how far a reel has got, and whether it is still there. If the service says the reel
 * has gone, the kept copy goes too. Only when the service cannot be reached does the kept
 * copy answer.
 */
async function reelPlay(event, path, id) {
  let res = null;
  try {
    res = await fetch(event.request);
  } catch {
    // no connection: the kept copy, if there is one
  }
  if (res?.status === 404) event.waitUntil(forgetReel(id));
  if (res && res.status < 500) return res;
  const kept = await keptReel(path);
  if (kept) return kept;
  if (res) return res;
  throw new TypeError('no connection, and this reel was not kept');
}

/** One of a made reel's recordings: the kept copy, the part of it asked for, or else the service's as if this were not here. */
async function reelSound(request, path) {
  const kept = await keptReel(path);
  return kept ? part(kept, request.headers.get('range')) : fetch(request);
}

/** The part of a kept recording a player asks for: sound is asked for a part at a time, to seek. */
async function part(whole, range) {
  const asked = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
  if (!asked || (!asked[1] && !asked[2])) return whole;
  const bytes = await whole.arrayBuffer(), size = bytes.byteLength;
  const start = asked[1] ? Number(asked[1]) : Math.max(0, size - Number(asked[2]));
  const end = asked[1] && asked[2] ? Math.min(Number(asked[2]), size - 1) : size - 1;
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: { 'content-type': whole.headers.get('content-type') ?? 'audio/mpeg', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1), 'accept-ranges': 'bytes' }
  });
}

/**
 * A recording: the kept copy if there is one, as it never changes. If not, all of it is
 * fetched and kept, whatever part was asked for, so that it plays next time with no connection.
 */
async function sound(request, path) {
  const cache = await caches.open(SOUND);
  let whole = await cache.match(path);
  if (!whole) {
    whole = await fetch(path);
    if (whole.status !== 200) return whole;
    await cache.put(path, whole.clone());
    const keys = await cache.keys();   // oldest first
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MOST_SOUND)).map((old) => cache.delete(old)));
  }
  return part(whole, request.headers.get('range'));
}

/**
 * Keeps the page at `path` and every file of the site's that it names, so that it can be
 * shown with no connection. With `must`, it throws if any of that cannot be had; without,
 * a page already kept is left alone, and what cannot be had is gone without.
 */
async function keepPage(path, must = false) {
  const cache = await caches.open(PAGES);
  if (!must && (await cache.match(path))) return;
  const res = await fetch(path);
  if (!keepable(res)) {
    if (must) throw new Error(`${path} could not be kept`);
    return;
  }
  await cache.put(path, res.clone());
  const named = new Set([...(await res.text()).matchAll(/(?:href|src)="(\/[^"?#]+)"/g)].map(([, file]) => file).filter(isFile));
  const got = await Promise.allSettled([...named].map(async (file) => { if (!(await cache.match(file))) await cache.add(file); }));
  if (must && got.some((one) => one.status === 'rejected')) throw new Error(`a file ${path} needs could not be kept`);
}

/**
 * Something shared to Pixel Reel from a phone's Share menu, which the phone sends to /share
 * (the manifest's share_target says so). It is put by, on this device, and the home page is
 * brought up at the make-one box, where site/js/shared.js hands it over. Nothing of it is
 * sent to the service by this.
 */
async function share(request) {
  const cache = await caches.open(SHARED);
  await Promise.all([cache.delete('/shared/words'), cache.delete('/shared/file')]);   // one thing at a time: the newest
  const form = await request.formData(), file = form.get('file');
  const said = Object.fromEntries(['title', 'text', 'url'].map((name) => [name, typeof form.get(name) === 'string' ? form.get(name) : '']));
  await cache.put('/shared/words', new Response(JSON.stringify(said), { headers: { 'content-type': 'application/json' } }));
  if (file && typeof file !== 'string' && file.size) {
    await cache.put('/shared/file', new Response(file, { headers: { 'content-type': file.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name ?? '') } }));
  }
  return Response.redirect(new URL('/?shared#make', self.location.origin), 303);
}

self.addEventListener('install', (event) => {
  // the "not online" page, and with it everything every page shares: the styles, the scripts and the letters
  event.waitUntil(keepPage(OFFLINE, true).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('pixelreel-') && ![PAGES, SOUND, REELS, SHARED].includes(name)) await caches.delete(name);   // what an older version of this kept
    }
    await self.registration.navigationPreload?.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event, url = new URL(request.url), path = url.pathname;
  if (url.origin !== self.location.origin) return;   // not the site's to answer
  if (request.method === 'POST' && path === '/share') {
    // if it cannot be put by, the make-one box is still the place to be
    event.respondWith(share(request).catch(() => Response.redirect(new URL('/#make', self.location.origin), 303)));
    return;
  }
  if (request.method !== 'GET') return;   // anything else being sent is the service's to take
  // whatever goes wrong in here, the request still goes to the service as if this were not there
  const safely = (answer) => event.respondWith(answer.catch(() => fetch(request)));
  const reel = reelFile(path);
  if (isSound(path)) safely(sound(request, path));
  else if (request.mode === 'navigate') { if (isPage(path)) safely(page(event, path)); }
  else if (reel?.[2] === 'play.json') safely(reelPlay(event, path, reel[1]));
  else if (reel?.[2]) safely(reelSound(request, path));
  else if (isFile(path)) safely(freshOrKept(event, path, fetch(request)));
});

// A page asks for pages to be kept: itself, the first time it is seen, and once Pixel Reel
// is on a phone's home screen, every page it links to.
self.addEventListener('message', (event) => {
  const paths = Array.isArray(event.data?.keep) ? event.data.keep.filter((path) => typeof path === 'string' && isPage(path)).slice(0, MOST_PAGES) : [];
  if (paths.length) event.waitUntil(Promise.allSettled(paths.map((path) => keepPage(path))));
});
