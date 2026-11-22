// Pixel Reel as an app on a phone: the service worker that keeps pages and recordings for
// when there is no internet (site/js/sw.js, run here with stand-ins for the browser's
// parts), what a phone is told about it (the manifest), and the page that shows how to add it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { manifest } from '../scripts/site-art.mjs';
import { robotsTxt, SITE_PAGES, sitemapXml, sitePage } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { deviceOf, pagesAmong } from '../site/js/app.js';

const root = (path) => new URL(`../${path}`, import.meta.url);
const ORIGIN = 'https://reels.example';
const pathOf = (key) => new URL(typeof key === 'string' ? key : key.url, ORIGIN).pathname;

/** A browser's cache storage, in memory: caches by name, each holding answers by path, oldest first. */
function fakeCaches() {
  const stores = new Map();
  const cacheOf = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const kept = stores.get(name);
    return {
      async match(key) {
        const one = kept.get(pathOf(key));
        return one && new Response(one.bytes, { status: 200, headers: one.headers });
      },
      async put(key, res) {
        assert.equal(res.status, 200, 'a real cache refuses a part of an answer');
        kept.set(pathOf(key), { bytes: await res.arrayBuffer(), headers: [...res.headers] });
      },
      async add(url) {
        const res = await fetchFrom.current(url);
        if (!res.ok) throw new TypeError(`${url} could not be had`);
        await this.put(url, res);
      },
      async keys() { return [...kept.keys()].map((path) => ({ url: ORIGIN + path })); },
      async delete(key) { return kept.delete(pathOf(key)); }
    };
  };
  const fetchFrom = { current: null };
  return {
    stores, fetchFrom,
    open: async (name) => cacheOf(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    paths: (name) => [...(stores.get(name)?.keys() ?? [])]
  };
}

const PAGE = (title, files = []) => `<!doctype html><title>${title}</title>${files.map((file) => `<link href="${file}">`).join('')}<script src="/site/js/main.js"></script>`;

/**
 * The service worker, running on a pretend site: `site` maps each path to what the service
 * answers for it ({ body, status, headers }, or just a body). `online` can be switched off,
 * and `slow` (a set of paths) holds an answer back until `release()` is called. Timers are
 * kept in `timers`, to be run by hand.
 */
function worker(site = {}) {
  const caches = fakeCaches(), handlers = {}, asked = [], timers = [], held = [];
  const world = {
    site: {
      '/offline': PAGE('Not online', ['/site/css/site.css', '/site/fonts/lexend.woff2', '/site/art/what-is-pixel-reel.mp4', 'https://elsewhere.example/site/js/x.js']),
      '/site/css/site.css': 'body {}', '/site/js/main.js': 'main()', '/site/fonts/lexend.woff2': 'letters',
      ...site
    },
    online: true, slow: new Set(), claimed: false, skipped: false, preloading: false
  };
  const fetch = async (what, _options) => {
    const path = pathOf(what);
    asked.push(path);
    if (world.slow.has(path)) await new Promise((go) => held.push(go));
    if (!world.online) throw new TypeError('Failed to fetch');
    const answer = world.site[path];
    if (answer === undefined) return new Response('nothing here', { status: 404, headers: { 'cache-control': 'no-store' } });
    const { body = answer, status = 200, headers = {} } = typeof answer === 'string' ? {} : answer;
    return new Response(body, { status, headers });
  };
  caches.fetchFrom.current = fetch;
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (name, run) => { handlers[name] = run; },
    skipWaiting: async () => { world.skipped = true; },
    registration: { navigationPreload: { enable: async () => { world.preloading = true; } } },
    clients: { claim: async () => { world.claimed = true; } }
  };
  runInNewContext(readFileSync(root('site/js/sw.js'), 'utf8'), {
    self, caches, fetch, Response, URL, Promise,
    setTimeout: (run, ms, ...args) => timers.push({ run: () => run(...args), ms }),
    clearTimeout: () => {}
  });
  /** Tells the worker of something, and waits for all it says it will do about it. */
  const tell = async (name, event = {}) => {
    const waits = [];
    handlers[name]({ waitUntil: (work) => waits.push(work), ...event });
    await Promise.all(waits);
  };
  /** Asks the worker for an address, as a page would. Resolves to its answer, or null if it leaves the request alone. */
  const ask = (path, { mode = 'no-cors', method = 'GET', headers = {}, preload = undefined } = {}) => {
    let answer = null;
    const waits = [];
    handlers.fetch({
      request: { url: path.startsWith('http') ? path : ORIGIN + path, method, mode, headers: new Headers(headers) },
      preloadResponse: preload, respondWith: (given) => { answer = given; }, waitUntil: (work) => waits.push(work)
    });
    return answer && Object.assign(answer, { settled: () => Promise.all(waits) });
  };
  const visit = (path, options = {}) => ask(path, { mode: 'navigate', ...options });
  return { world, caches, asked, timers, tell, ask, visit, release: () => held.splice(0).forEach((go) => go()) };
}

const titleOf = async (res) => /<title>([^<]*)/.exec(await res.text())[1];

describe('the service worker', () => {
  it('keeps the page for when there is no internet, and all it loads, when it first arrives', async () => {
    const { world, caches, tell } = worker();
    await tell('install');
    assert.deepEqual(caches.paths('pixelreel-pages-1').sort(), ['/offline', '/site/css/site.css', '/site/fonts/lexend.woff2', '/site/js/main.js'],
      'the page and the styles, scripts and letters it names: not video, and nothing from anywhere else');
    assert.ok(world.skipped, 'and takes over at once from any older version');
  });

  it('does not arrive at all if it could not keep that page whole', async () => {
    const missing = worker({ '/site/css/site.css': { status: 500, body: 'oh dear' } });
    await assert.rejects(missing.tell('install'), 'a browser then tries again on the next visit');
    const offline = worker();
    offline.world.online = false;
    await assert.rejects(offline.tell('install'));
  });

  it('throws away what an older version of it kept, and nothing else', async () => {
    const { world, caches, tell } = worker();
    for (const name of ['pixelreel-pages-0', 'pixelreel-pages-1', 'pixelreel-sound-1', 'someone-elses']) await caches.open(name);
    await tell('activate');
    assert.deepEqual(await caches.keys(), ['pixelreel-pages-1', 'pixelreel-sound-1', 'someone-elses']);
    assert.ok(world.claimed, 'it looks after the page that brought it, not only the next one');
    assert.ok(world.preloading, 'and has the browser start asking for a page while it wakes');
  });

  it('answers a page from the service, as fresh as ever, and keeps a copy', async () => {
    const { world, caches, visit } = worker({ '/claude': PAGE('Add it') });
    assert.equal(await titleOf(await visit('/claude?from=somewhere')), 'Add it');
    assert.ok(caches.paths('pixelreel-pages-1').includes('/claude'), 'kept under its address alone, whatever follows the question mark');
    world.site['/claude'] = PAGE('Add it, new');
    assert.equal(await titleOf(await visit('/claude')), 'Add it, new', 'a kept copy never stands in for a fresh one that can be had');
  });

  it('uses the answer the browser asked for while it was waking, if there is one', async () => {
    const { asked, visit } = worker();
    const early = Promise.resolve(new Response(PAGE('Early'), { status: 200 }));
    assert.equal(await titleOf(await visit('/claude', { preload: early })), 'Early');
    assert.deepEqual(asked, [], 'and does not ask twice');
  });

  it('shows the kept copy with no internet, and the not-online page for one it never kept', async () => {
    const { world, tell, visit } = worker({ '/claude': PAGE('Add it') });
    await tell('install');
    await visit('/claude');
    world.online = false;
    assert.equal(await titleOf(await visit('/claude')), 'Add it');
    assert.equal(await titleOf(await visit('/press')), 'Not online');
    assert.equal(await titleOf(await visit('/r/abcdefghijklmnopqrstuv')), 'Not online');
  });

  it('never keeps a page the service says to forget, such as a reel someone made', async () => {
    const reel = '/r/abcdefghijklmnopqrstuv';
    const { world, caches, tell, visit } = worker({ [reel]: { body: PAGE('A private reel'), headers: { 'cache-control': 'no-store' } } });
    await tell('install');
    assert.equal(await titleOf(await visit(reel)), 'A private reel');
    await tell('message', { data: { keep: [reel] } });
    assert.ok(!caches.paths('pixelreel-pages-1').includes(reel));
    world.online = false;
    assert.equal(await titleOf(await visit(reel)), 'Not online');
  });

  it('shows a page that is not there as the service gives it, and does not keep it', async () => {
    const { caches, visit } = worker();
    const res = await visit('/nothing');
    assert.equal(res.status, 404);
    assert.deepEqual(caches.paths('pixelreel-pages-1'), []);
  });

  it('shows the kept copy when the service is too slow to wait for, and keeps the fresh one when it comes', async () => {
    const { world, caches, timers, visit, release } = worker({ '/claude': PAGE('Add it') });
    await visit('/claude');
    world.site['/claude'] = PAGE('Add it, new');
    world.slow.add('/claude');
    const answer = visit('/claude');
    while (!timers.length) await new Promise((soon) => setImmediate(soon));
    assert.equal(timers[0].ms, 4000);
    timers[0].run();
    assert.equal(await titleOf(await answer), 'Add it', 'four seconds is long enough to stare at nothing');
    release();
    await answer.settled();
    assert.equal(await titleOf(await (await caches.open('pixelreel-pages-1')).match('/claude')), 'Add it, new');
  });

  it('shows the kept copy when the service is in trouble', async () => {
    const { world, visit } = worker({ '/claude': PAGE('Add it') });
    await visit('/claude');
    world.site['/claude'] = { status: 503, body: 'starting up' };
    assert.equal(await titleOf(await visit('/claude')), 'Add it');
    world.site['/press'] = { status: 503, body: 'starting up' };
    assert.equal((await visit('/press')).status, 503, 'with no copy, what the service said is what there is');
  });

  it('keeps the files a page loads, and gives the kept ones with no internet', async () => {
    const { world, ask } = worker({ '/reels/volcano/reel.json': '{"title":"Volcano"}', '/src/kit.js': 'kit()', '/favicon.ico': 'icon' });
    for (const path of ['/reels/volcano/reel.json', '/src/kit.js', '/favicon.ico', '/site/css/site.css']) assert.equal((await ask(path)).status, 200, path);
    world.online = false;
    assert.equal(await (await ask('/reels/volcano/reel.json')).text(), '{"title":"Volcano"}');
    assert.equal(await (await ask('/src/kit.js')).text(), 'kit()');
    await assert.rejects(ask('/site/js/never-seen.js'), 'a file never kept fails as it would have without the worker');
  });

  it("leaves alone what is not the site's to answer, or is not a page or a file of its own", () => {
    const { ask, visit } = worker();
    assert.equal(ask('/try', { method: 'POST' }), null, 'something being sent');
    assert.equal(ask('https://elsewhere.example/site/js/main.js'), null, 'another site');
    for (const path of ['/mcp', '/health', '/r/abcdefghijklmnopqrstuv/play.json', '/r/abcdefghijklmnopqrstuv/audio/clip0.mp3', '/r/abcdefghijklmnopqrstuv/card.png',
      '/site/art/what-is-pixel-reel.mp4', '/reels/volcano/reel.js', '/package.json']) {
      assert.equal(ask(path), null, path);
    }
    for (const path of ['/mcp', '/try', '/health', '/r/abcdefghijklmnopqrstuv/video.mp4', '/site/art/logo-on-night.png']) {
      assert.equal(visit(path), null, `${path} is not a page`);
    }
  });

  it('keeps a recording whole the first time it is played, and plays it from then on with no internet', async () => {
    const clip = '/reels/volcano/audio/0123456789abcdef.mp3';
    const { world, caches, asked, ask } = worker({ [clip]: { body: 'ABCDEFGHIJ', headers: { 'content-type': 'audio/mpeg' } } });
    const first = await ask(clip, { headers: { range: 'bytes=0-' } });
    assert.equal(first.status, 206, 'a player asks for sound a part at a time');
    assert.equal(first.headers.get('content-range'), 'bytes 0-9/10');
    assert.equal(await first.text(), 'ABCDEFGHIJ');
    assert.deepEqual(caches.paths('pixelreel-sound-1'), [clip]);
    world.online = false;
    const part = await ask(clip, { headers: { range: 'bytes=2-5' } });
    assert.deepEqual([part.status, part.headers.get('content-range'), part.headers.get('content-length'), part.headers.get('content-type'), await part.text()],
      [206, 'bytes 2-5/10', '4', 'audio/mpeg', 'CDEF']);
    assert.equal(await (await ask(clip, { headers: { range: 'bytes=-3' } })).text(), 'HIJ', 'its last three bytes');
    assert.equal(await (await ask(clip, { headers: { range: 'bytes=8-99' } })).text(), 'IJ');
    assert.equal((await ask(clip, { headers: { range: 'bytes=10-' } })).status, 416, 'past its end');
    const whole = await ask(clip);
    assert.deepEqual([whole.status, await whole.text()], [200, 'ABCDEFGHIJ']);
    assert.deepEqual(asked, [clip], 'the service was asked for it once: a recording never changes under the same name');
  });

  it('does not keep a recording that is not there', async () => {
    const { caches, ask } = worker();
    assert.equal((await ask('/reels/volcano/audio/gone.mp3', { headers: { range: 'bytes=0-' } })).status, 404);
    assert.deepEqual(caches.paths('pixelreel-sound-1'), []);
  });

  it('lets go of the oldest recordings once it has a great many', async () => {
    const clips = Array.from({ length: 403 }, (_, i) => `/reels/volcano/audio/clip${i}.mp3`);
    const { caches, ask } = worker(Object.fromEntries(clips.map((clip) => [clip, 'la'])));
    for (const clip of clips) await ask(clip);
    assert.deepEqual(caches.paths('pixelreel-sound-1'), clips.slice(3));
  });

  it('keeps the pages a page asks it to, once each, with the files they name', async () => {
    const { caches, asked, tell } = worker({ '/': PAGE('Home', ['/reels/pixel-reel/reel.json']), '/claude': PAGE('Add it'), '/reels/pixel-reel/reel.json': '{}' });
    await tell('message', { data: { keep: ['/', '/claude', '/gone', 'https://elsewhere.example/', '//elsewhere.example/', '/site/css/site.css', '/mcp', 7] } });
    assert.deepEqual(caches.paths('pixelreel-pages-1').sort(), ['/', '/claude', '/reels/pixel-reel/reel.json', '/site/js/main.js']);
    assert.ok(!asked.some((path) => path === '/mcp' || path === '/site/css/site.css'), 'only pages of the site are asked for');
    asked.length = 0;
    await tell('message', { data: { keep: ['/', '/claude'] } });
    assert.deepEqual(asked, [], 'a page already kept is not fetched again: visiting it keeps it fresh');
    await tell('message', { data: 'keep everything' });
    await tell('message', { data: { keep: Array.from({ length: 500 }, (_, i) => `/page-${i}`) } });
    assert.equal(asked.length, 40, 'and only so many at a time');
  });

  it('gets out of the way if anything goes wrong inside it', async () => {
    const { caches, visit, ask } = worker({ '/claude': PAGE('Add it'), '/reels/volcano/audio/a.mp3': 'la' });
    caches.open = async () => { throw new Error('this browser has no room to keep anything'); };
    assert.equal(await titleOf(await visit('/claude')), 'Add it');
    assert.equal(await (await ask('/site/css/site.css')).text(), 'body {}');
    assert.equal(await (await ask('/reels/volcano/audio/a.mp3')).text(), 'la');
  });
});

describe('what a phone is told about Pixel Reel', () => {
  const told = manifest();

  it('says it opens on a screen of its own, from the top of the site', () => {
    assert.equal(told.display, 'standalone');
    assert.deepEqual([told.id, told.start_url, told.scope], ['/', '/', '/']);
    assert.equal(told.name, 'Pixel Reel');
    assert.ok(told.short_name.length <= 12, 'a home screen has room for about twelve letters under an icon');
  });

  it('has icons the site serves, one of each size cut to survive a round or a square mask', () => {
    for (const purpose of ['any', 'maskable']) {
      assert.deepEqual(told.icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes), ['192x192', '512x512'], purpose);
    }
    for (const icon of told.icons) {
      const file = staticFile(icon.src);
      assert.ok(file, `${icon.src} is there to be served`);
      // a PNG says how big it is in its first few bytes
      assert.equal(`${file.bytes.readUInt32BE(16)}x${file.bytes.readUInt32BE(20)}`, icon.sizes, icon.src);
    }
  });

  it('offers, when its icon is pressed and held, only places that exist', () => {
    const home = sitePage('home', ORIGIN);
    assert.ok(told.shortcuts.length >= 2);
    for (const { url, name } of told.shortcuts) {
      const [path, part] = url.split('#');
      assert.ok(path in SITE_PAGES, `${name} leads to ${url}`);
      if (part) assert.match(home, new RegExp(`id="${part}"`), `${name} leads to ${url}`);
    }
  });

  it('is pointed at by every page, which also says what an iPhone should call it', () => {
    const page = sitePage('privacy', ORIGIN);
    assert.match(page, /<link rel="manifest" href="\/site\/art\/site\.webmanifest">/);
    assert.match(page, /<meta name="apple-mobile-web-app-title" content="Pixel Reel">/);
    assert.match(page, /<link rel="apple-touch-icon" href="\/site\/art\/touch-icon\.png">/);
  });

  it('serves the service worker from the top of the site, so that it may look after all of it', () => {
    const served = staticFile('/sw.js');
    assert.ok(served);
    assert.equal(served.type, 'text/javascript; charset=utf-8');
    assert.deepEqual(served.bytes, readFileSync(root('site/js/sw.js')));
    assert.match(readFileSync(root('site/js/app.js'), 'utf8'), /serviceWorker\.register\('\/sw\.js'\)/);
  });
});

describe('adding Pixel Reel to a phone', () => {
  const app = sitePage('app', ORIGIN), offline = sitePage('offline', ORIGIN, { listed: true });

  it('knows an iPhone, an iPad that says it is a Mac, an Android phone and a computer', () => {
    assert.equal(deviceOf({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' }), 'iphone');
    assert.equal(deviceOf({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }), 'iphone');
    assert.equal(deviceOf({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 0 }), 'computer');
    assert.equal(deviceOf({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36' }), 'android');
    assert.equal(deviceOf({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', platform: 'Win32' }), 'computer');
    assert.equal(deviceOf(), 'computer');
  });

  it('shows what to press for each of them, a picture and a few words to each step', () => {
    const devices = [...app.matchAll(/<details data-device="([a-z]+)">/g)].map(([, device]) => device);
    assert.deepEqual(devices, ['iphone', 'android', 'computer'], 'one for each device it can tell apart');
    assert.equal([...app.matchAll(/<span class="tile [^"]+"><svg class="px"/g)].length, 6, 'two presses each, each with its picture');
  });

  it('has one big button, which leads to the steps when the browser will not do the adding itself', () => {
    assert.match(app, /<a class="btn btn-gold btn-big" href="#how" data-install>Add Pixel Reel to your phone<\/a>/);
    assert.match(app, /<section class="section section-tint" id="how"/);
    assert.match(app, /<p class="said" role="status" data-install-says><\/p>/, 'somewhere to say it is done');
  });

  it('can be reached from the foot of every page', () => {
    for (const name of ['home', 'claude', 'privacy', 'not-found']) assert.match(sitePage(name, ORIGIN), /<a href="\/app">Add to your phone<\/a>/, name);
  });

  it('finds the pages a page leads to, for keeping, and nothing else', () => {
    assert.deepEqual(pagesAmong(['/', '/claude', '/#make', '/claude#top', 'https://reels.example/press', '/watch/volcano', 'https://github.com/x', '/r/abc/video.mp4', 'mailto:a@b.c', '#how', 'http://['], ORIGIN),
      ['/', '/claude', '/press', '/watch/volcano']);
  });

  it('keeps the page for when there is no internet away from search engines, even once the site is listed', () => {
    assert.match(offline, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(sitePage('app', ORIGIN, { listed: true }), /<meta name="robots" content="index, follow">/);
    assert.ok(!sitemapXml(ORIGIN).includes('/offline'));
    assert.ok(sitemapXml(ORIGIN).includes(`${ORIGIN}/app<`));
    assert.match(robotsTxt(ORIGIN, true), /Sitemap:/);
  });

  it('offers a way to try again, and a way home, on that page', () => {
    assert.match(offline, /<a class="btn btn-gold btn-big" href="">Try again<\/a>/);
    assert.match(offline, /<a class="btn btn-paper btn-big" href="\/">Back to the start<\/a>/);
    assert.match(offline, /<body class="page-offline">/, 'which app.js looks for, to try again by itself when the internet comes back');
  });
});
