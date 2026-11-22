// Pixel Reel as an app on a phone: the service worker that keeps pages and recordings for
// when there is no internet (site/js/sw.js, run here with stand-ins for the browser's
// parts), what a phone is told about it (the manifest), and the page that shows how to add it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { appManifest, robotsTxt, SITE_PAGES, sitemapXml, sitePage } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { deviceName, deviceOf, pagesAmong } from '../site/js/app.js';
import { forgetReel, isKept, KEPT, keepReel, keptReels, keptWords } from '../site/js/kept.js';
import { SHARED, sharedWords, takeShared } from '../site/js/shared.js';

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
  const ask = (path, { mode = 'no-cors', method = 'GET', headers = {}, preload = undefined, request = null } = {}) => {
    let answer = null;
    const waits = [];
    handlers.fetch({
      request: request ?? { url: path.startsWith('http') ? path : ORIGIN + path, method, mode, headers: new Headers(headers) },
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
    for (const path of ['/mcp', '/health', '/r/abcdefghijklmnopqrstuv/card.png', '/r/abcdefghijklmnopqrstuv/video.mp4', '/r/short/play.json',
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

describe('a reel kept on the device', () => {
  const ID = 'abcdefghijklmnopqrstuv', OTHER = 'ZYXWVUTSRQPONMLKJIHGFE';
  const inAWeek = new Date(Date.now() + 7 * 24 * 3600_000).toISOString(), lastWeek = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  /** What the service has for a reel that is ready: its page, what its player asks for, and two recordings. */
  const reelOnService = (id, { title = 'Your gas bill', expires = inAWeek, state = 'ready' } = {}) => ({
    [`/r/${id}`]: { body: PAGE(title), headers: { 'cache-control': 'no-store' } },
    [`/r/${id}/play.json`]: {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ state, title, expires, reel: { title, scenes: [] }, clips: ['one', 'two'].map((name) => ({ text: name, file: `${ORIGIN}/r/${id}/audio/${name}.mp3`, seconds: 2 })) })
    },
    [`/r/${id}/audio/one.mp3`]: { body: 'ONE-ONE-ONE', headers: { 'content-type': 'audio/mpeg' } },
    [`/r/${id}/audio/two.mp3`]: { body: 'TWO-TWO-TWO', headers: { 'content-type': 'audio/mpeg' } }
  });
  /** A worker on a site with that reel, and the two things kept.js is handed: the browser's store, and a way to ask the service. */
  const withReel = (extra = {}) => {
    const w = worker({ ...reelOnService(ID), ...extra });
    return { ...w, hands: { store: w.caches, get: w.caches.fetchFrom.current } };
  };

  it('is kept whole: its page, both recordings, and what its player asks the service for', async () => {
    const { caches, hands } = withReel();
    assert.deepEqual(await keepReel(ID, hands), { id: ID, title: 'Your gas bill', expires: inAWeek });
    assert.deepEqual(caches.paths(KEPT).sort(), [`/r/${ID}`, `/r/${ID}/audio/one.mp3`, `/r/${ID}/audio/two.mp3`, `/r/${ID}/play.json`]);
    assert.ok(await isKept(ID, hands));
    assert.ok(!(await isKept(OTHER, hands)));
  });

  it('is not kept at all if it is not ready, or if any of it cannot be fetched', async () => {
    const recording = withReel(reelOnService(ID, { state: 'recording' }));
    await assert.rejects(keepReel(ID, recording.hands));
    const missing = withReel({ [`/r/${ID}/audio/two.mp3`]: { status: 404, body: 'gone' } });
    await assert.rejects(keepReel(ID, missing.hands));
    const gone = withReel({ [`/r/${ID}/play.json`]: { status: 404, body: '{"state":"gone"}' } });
    await assert.rejects(keepReel(ID, gone.hands));
    for (const { caches, hands } of [recording, missing, gone]) {
      assert.deepEqual(caches.paths(KEPT), [], 'half a reel is no use on a train');
      assert.ok(!(await isKept(ID, hands)));
    }
  });

  it('is kept afresh when kept again, as a reel can be changed after it is made', async () => {
    const { world, caches, hands } = withReel();
    await keepReel(ID, hands);
    const changed = JSON.parse(world.site[`/r/${ID}/play.json`].body);
    changed.title = 'Your gas bill, shorter';
    changed.clips = [changed.clips[0], { text: 'three', file: `${ORIGIN}/r/${ID}/audio/three.mp3`, seconds: 2 }];
    world.site[`/r/${ID}/play.json`].body = JSON.stringify(changed);
    world.site[`/r/${ID}/audio/three.mp3`] = { body: 'THREE', headers: { 'content-type': 'audio/mpeg' } };
    assert.equal((await keepReel(ID, hands)).title, 'Your gas bill, shorter');
    assert.deepEqual(caches.paths(KEPT).sort(), [`/r/${ID}`, `/r/${ID}/audio/one.mp3`, `/r/${ID}/audio/three.mp3`, `/r/${ID}/play.json`], 'the recording it no longer uses is let go');
    world.online = false;
    await assert.rejects(keepReel(ID, hands));
    assert.equal((await keptReels(hands))[0].title, 'Your gas bill, shorter', 'and a copy that cannot be freshened is left as it was');
  });

  it('is forgotten when asked, and only that reel', async () => {
    const { caches, hands } = withReel(reelOnService(OTHER, { title: 'The offside rule' }));
    await keepReel(ID, hands);
    await keepReel(OTHER, hands);
    await forgetReel(ID, hands);
    assert.ok(!(await isKept(ID, hands)));
    assert.deepEqual(caches.paths(KEPT).sort(), [`/r/${OTHER}`, `/r/${OTHER}/audio/one.mp3`, `/r/${OTHER}/audio/two.mp3`, `/r/${OTHER}/play.json`]);
  });

  it('is listed with the others, the newest first, until the day the service deletes its own copy', async () => {
    const { hands } = withReel({ ...reelOnService(OTHER, { title: 'The offside rule' }), ...reelOnService('0123456789abcdefghijkl', { title: 'An old one', expires: lastWeek }) });
    await keepReel('0123456789abcdefghijkl', hands);
    await keepReel(ID, hands);
    await keepReel(OTHER, hands);
    const kept = await keptReels(hands);
    assert.deepEqual(kept.map(({ id, title, expires }) => [id, title, expires]), [[OTHER, 'The offside rule', inAWeek], [ID, 'Your gas bill', inAWeek]]);
    assert.equal(kept[0].play.clips.length, 2, 'with what its player needs to play it');
    assert.ok(!(await isKept('0123456789abcdefghijkl', hands)), 'one whose time is up is forgotten, not listed');
  });

  it('says on its poster how long it runs and the day it goes', () => {
    assert.equal(keptWords(64_000, '2026-12-22T09:00:00.000Z'), '1 minute 4, until 22 December');
    assert.equal(keptWords(41_500, null), '41 seconds');
  });

  it('plays with no internet: its page, what its player asks for, and its recordings a part at a time', async () => {
    const { world, tell, visit, ask, hands } = withReel();
    await tell('install');
    await keepReel(ID, hands);
    world.online = false;
    assert.equal(await titleOf(await visit(`/r/${ID}`)), 'Your gas bill');
    const play = await (await ask(`/r/${ID}/play.json`)).json();
    assert.deepEqual([play.state, play.title, play.clips.length], ['ready', 'Your gas bill', 2]);
    const part = await ask(`/r/${ID}/audio/two.mp3`, { headers: { range: 'bytes=4-6' } });
    assert.deepEqual([part.status, part.headers.get('content-range'), await part.text()], [206, 'bytes 4-6/11', 'TWO']);
    assert.equal(await (await ask(`/r/${ID}/audio/one.mp3`)).text(), 'ONE-ONE-ONE');
    assert.equal(await titleOf(await visit(`/r/${OTHER}`)), 'Not online', 'a reel nobody kept has nothing to show');
    await assert.rejects(ask(`/r/${OTHER}/play.json`));
  });

  it('still asks the service first, so a kept copy never hides how a reel really is', async () => {
    const { world, asked, ask, visit, hands } = withReel();
    await keepReel(ID, hands);
    world.site[`/r/${ID}`] = { body: PAGE('Your gas bill, as the service has it now'), headers: { 'cache-control': 'no-store' } };
    assert.equal(await titleOf(await visit(`/r/${ID}`)), 'Your gas bill, as the service has it now');
    asked.length = 0;
    await ask(`/r/${ID}/play.json`);
    assert.deepEqual(asked, [`/r/${ID}/play.json`]);
    world.site[`/r/${ID}/play.json`] = { status: 503, body: 'starting up' };
    assert.equal((await (await ask(`/r/${ID}/play.json`)).json()).state, 'ready', 'unless the service is in trouble');
  });

  it('is forgotten the moment the service says the reel has gone', async () => {
    const { world, ask, hands } = withReel();
    await keepReel(ID, hands);
    world.site[`/r/${ID}/play.json`] = { status: 404, body: '{"state":"gone"}' };
    const answer = ask(`/r/${ID}/play.json`);
    assert.equal((await (await answer).json()).state, 'gone');
    await answer.settled();
    assert.ok(!(await isKept(ID, hands)), 'deleted from the service is deleted from here');
    world.online = false;
    await assert.rejects(ask(`/r/${ID}/play.json`), 'so there is nothing to play it from, with no internet');
  });

  it('is forgotten, not played, once the day the service deletes its own copy has passed', async () => {
    const { world, caches, tell, visit, ask, hands } = withReel(reelOnService(ID, { expires: lastWeek }));
    await tell('install');
    await keepReel(ID, hands);
    world.online = false;
    assert.equal(await titleOf(await visit(`/r/${ID}`)), 'Not online');
    await assert.rejects(ask(`/r/${ID}/play.json`));
    assert.deepEqual(caches.paths(KEPT), []);
  });

  it('leaves the recordings of a reel nobody kept to the service, part and all', async () => {
    const { caches, ask } = withReel();
    assert.equal(await (await ask(`/r/${ID}/audio/one.mp3`, { headers: { range: 'bytes=0-2' } })).text(), 'ONE-ONE-ONE', 'the stand-in service sends it whole: the worker did not cut it');
    assert.deepEqual(caches.paths(KEPT), [], 'watching a reel does not keep it: asking does');
  });

  it('survives a newer version of the worker, which throws away only what older versions kept', async () => {
    const { tell, hands } = withReel();
    await keepReel(ID, hands);
    await tell('activate');
    assert.ok(await isKept(ID, hands));
  });

  it('has a button on its page, out of sight until the reel is ready and there is somewhere to keep it', () => {
    const page = sitePage('reel', ORIGIN, { values: { reelid: ID, reeltitle: 'Tea' } });
    assert.match(page, /<button class="btn btn-paper" type="button" id="watch-keep" hidden>Keep it on this phone<\/button>/);
    assert.match(page, /<p class="watch-sent" id="watch-keep-says" role="status"><\/p>/);
  });

  it('is the only thing on its page that is called kept: the small print says the day the reel is deleted', () => {
    const page = sitePage('reel', ORIGIN, { values: { reelid: ID, reeltitle: 'Tea' } });
    assert.match(page, /<p id="watch-kept" hidden>Only people with this link can watch\. It is deleted on <span id="watch-until"><\/span>\.<\/p>/);
    assert.doesNotMatch(page, /It is kept until/, 'or the same word would mean a copy on the phone and the reel at the service');
  });

  it('is offered on the page for when there is no internet, in a part of it out of sight until there is one to show', () => {
    const offline = sitePage('offline', ORIGIN);
    assert.match(offline, /<section class="section night cinema" aria-labelledby="yours-title" hidden>/);
    assert.match(offline, /<ul class="posters" data-kept><\/ul>/);
  });

  it('is said to be on a phone, an iPad, a tablet or a computer, whichever it is', () => {
    assert.equal(deviceName({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1' }), 'phone');
    assert.equal(deviceName({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }), 'iPad');
    assert.equal(deviceName({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1' }), 'iPad');
    assert.equal(deviceName({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0.0.0 Mobile Safari/537.36' }), 'phone');
    assert.equal(deviceName({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/131.0.0.0 Safari/537.36' }), 'tablet');
    assert.equal(deviceName({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36' }), 'computer');
    assert.equal(deviceName(), 'computer');
  });
});

describe('something shared to Pixel Reel from a phone', () => {
  /** What a phone sends to /share: the words it has, and a file if one was shared. */
  const sharing = (fields, file = null) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    if (file) form.set('file', file);
    return new Request(`${ORIGIN}/share`, { method: 'POST', body: form });
  };

  it('is put by on the phone, and the home page brought up at the make-one box', async () => {
    const { caches, asked, ask } = worker();
    const res = await ask('/share', { request: sharing({ title: 'Council tax', text: 'Worth a read https://example.org/council-tax', url: '' }) });
    assert.deepEqual([res.status, res.headers.get('location')], [303, `${ORIGIN}/?shared#make`]);
    assert.deepEqual(caches.paths(SHARED), ['/shared/words']);
    assert.deepEqual(asked, [], 'nothing of it is sent to the service');
    assert.deepEqual(await takeShared({ store: caches }), { words: 'https://example.org/council-tax', file: null });
    assert.equal(await takeShared({ store: caches }), null, 'and it is handed over once');
  });

  it('brings a file with it: a letter as a PDF, or a photo of one', async () => {
    const { caches, ask } = worker();
    await ask('/share', { request: sharing({ title: 'Scan' }, new File(['%PDF-1.7 a letter'], 'my pension letter.pdf', { type: 'application/pdf' })) });
    assert.deepEqual(caches.paths(SHARED).sort(), ['/shared/file', '/shared/words']);
    const { words, file } = await takeShared({ store: caches });
    assert.deepEqual([words, file.name, file.type, await file.text()], ['Scan', 'my pension letter.pdf', 'application/pdf', '%PDF-1.7 a letter']);
  });

  it('keeps only the newest thing shared', async () => {
    const { caches, ask } = worker();
    await ask('/share', { request: sharing({ text: 'first' }, new File(['one'], 'one.txt', { type: 'text/plain' })) });
    await ask('/share', { request: sharing({ text: 'second' }) });
    assert.deepEqual(await takeShared({ store: caches }), { words: 'second', file: null });
  });

  it('still goes to the make-one box if it cannot be put by', async () => {
    const { caches, ask } = worker();
    caches.open = async () => { throw new Error('no room'); };
    const res = await ask('/share', { request: sharing({ text: 'tea' }) });
    assert.deepEqual([res.status, res.headers.get('location')], [303, `${ORIGIN}/#make`]);
  });

  it("is the only thing being sent that the worker takes, and only at the site's own /share", () => {
    const { ask } = worker();
    assert.equal(ask('/try', { method: 'POST' }), null);
    assert.equal(ask('/mcp', { method: 'POST' }), null);
    assert.equal(ask('https://elsewhere.example/share', { method: 'POST' }), null);
    assert.equal(ask('/share', { method: 'PUT' }), null);
  });

  it('survives a newer version of the worker', async () => {
    const { caches, tell, ask } = worker();
    await ask('/share', { request: sharing({ text: 'tea' }) });
    await tell('activate');
    assert.deepEqual(await takeShared({ store: caches }), { words: 'tea', file: null });
  });

  it('goes in the box as its link, if it has one, or else as its words', () => {
    assert.equal(sharedWords({ title: 'Council tax', text: '', url: 'https://example.org/council-tax' }), 'https://example.org/council-tax');
    assert.equal(sharedWords({ title: 'Council tax', text: 'Worth a read: https://example.org/council-tax. Honest', url: '' }), 'https://example.org/council-tax', 'a browser shares a page as words with its link in among them, and a full stop after it is not part of it');
    assert.equal(sharedWords({ title: 'A note', text: '  why is the sky blue  ' }), 'why is the sky blue');
    assert.equal(sharedWords({ title: 'How a mortgage works' }), 'How a mortgage works');
    assert.equal(sharedWords({}), '');
    assert.equal(sharedWords(), '');
  });

  it('is told to a phone as something Pixel Reel takes: a link or words everywhere, a file only where it can make a reel of one', () => {
    const plain = appManifest().share_target, withFiles = appManifest({ files: true }).share_target;
    assert.deepEqual([plain.action, plain.method, plain.enctype], ['/share', 'POST', 'multipart/form-data']);
    assert.deepEqual(plain.params, { title: 'title', text: 'text', url: 'url' }, 'or a phone would offer Pixel Reel for a photo it cannot take');
    assert.deepEqual(withFiles.params.files.map((taken) => taken.name), ['file'], 'the name the worker looks for');
    assert.ok(withFiles.params.files[0].accept.includes('application/pdf') && withFiles.params.files[0].accept.includes('image/*'));
  });

  it('is handed to the make-one box by the page, after the box has been woken', () => {
    const main = readFileSync(root('site/js/main.js'), 'utf8');
    assert.ok(main.indexOf('startMaker();') < main.indexOf('startShared();'), 'the box must be listening first');
    const home = sitePage('home', ORIGIN);
    for (const id of ['maker', 'maker-file', 'maker-said', 'here-said', 'ask-open']) assert.match(home, new RegExp(`id="${id}"`), `the page has the #${id} that shared.js looks for`);
  });
});

describe('what a phone is told about Pixel Reel', () => {
  const told = appManifest();

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

  it('offers a reel of itself, as every part of the site does', () => {
    assert.match(app, /<button class="btn btn-reel" type="button" data-reel="site-phone">Make a pixel reel about this<\/button>/);
  });

  it('lets someone on a computer copy its address, to send to their phone', () => {
    assert.match(app, /<button class="btn btn-paper btn-small" type="button" data-send="Add Pixel Reel to your phone" data-says="#app-sent" hidden>Copy the link to send to it<\/button>\s*<p class="said" id="app-sent" role="status"><\/p>/);
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
