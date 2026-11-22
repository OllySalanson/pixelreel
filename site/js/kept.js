// Reels kept on this device, to play with no internet. A made reel (/r/<id>) belongs to
// whoever has its link, so nothing of it is kept unless someone asks: by pressing the
// button on its page, or by having Pixel Reel on their home screen, where every reel they
// open is kept for them. A kept reel is three things in the browser's own store: its page,
// what its player asks the service for (play.json), and its recordings. The service worker
// (sw.js) answers from them when the service cannot be reached. A kept reel goes when the
// service's own copy does: on the day it says it is kept until, or sooner if it is deleted.
// The top half touches no page, so Node can test it.
import { deviceName } from './app.js';
import { haveReel, lengthWords, showOf } from './reels.js';
import { startShots } from './shots.js';

/** The store kept reels are in: the same name as REELS in sw.js. */
export const KEPT = 'pixelreel-reels-1';

const pathOf = (address) => new URL(address, 'http://reel').pathname;

/**
 * Keeps reel `id` on this device: asks the service for all of it, then puts its page, its
 * recordings and its play.json in the store. Nothing is kept unless all of it can be had:
 * half a reel is no use on a train. A reel kept before is kept afresh, as it is now, and
 * what the older copy alone had is let go. Resolves to { id, title, expires }; throws if
 * the reel is not ready yet, or cannot all be fetched, leaving any older copy as it was.
 */
export async function keepReel(id, { store = caches, get = fetch } = {}) {
  const asked = await get(`/r/${id}/play.json`, { cache: 'no-store' });
  const play = await asked.clone().json();
  if (asked.status !== 200 || play.state !== 'ready') throw new Error('this reel is not ready to be kept');
  const files = [`/r/${id}`, ...play.clips.map((clip) => pathOf(clip.file))];
  const got = await Promise.all(files.map(async (file) => {
    const res = await get(file);
    if (res.status !== 200) throw new Error(`${file} could not be fetched`);
    return [file, res];
  }));
  await forgetReel(id, { store });
  const cache = await store.open(KEPT);
  for (const [file, res] of got) await cache.put(file, res);
  await cache.put(`/r/${id}/play.json`, asked);   // last, as it is what says the reel is kept
  return { id, title: play.title, expires: play.expires ?? null };
}

/** Forgets reel `id`: everything of it that was kept on this device. */
export async function forgetReel(id, { store = caches } = {}) {
  const cache = await store.open(KEPT);
  for (const request of await cache.keys()) {
    const path = pathOf(request.url);
    if (path === `/r/${id}` || path.startsWith(`/r/${id}/`)) await cache.delete(request);
  }
}

/** Whether reel `id` is kept on this device. */
export const isKept = async (id, { store = caches } = {}) => Boolean(await (await store.open(KEPT)).match(`/r/${id}/play.json`));

/**
 * The reels kept on this device, the newest first: [{ id, title, expires, play }], where
 * `play` is what the service said of the reel. One whose time is up is forgotten, not listed.
 */
export async function keptReels({ store = caches, now = Date.now() } = {}) {
  const cache = await store.open(KEPT), reels = [];
  for (const request of await cache.keys()) {
    const id = /^\/r\/([^/]+)\/play\.json$/.exec(pathOf(request.url))?.[1];
    if (!id) continue;
    const play = await (await cache.match(request)).json();
    if (play.expires && Date.parse(play.expires) <= now) await forgetReel(id, { store });
    else reels.unshift({ id, title: play.title, expires: play.expires ?? null, play });
  }
  return reels;
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

/** What a kept reel's poster says under its name: how long it runs, and the day it goes. */
export const keptWords = (ms, expires) => (expires ? `${lengthWords(ms)}, until ${DAY.format(new Date(expires))}` : lengthWords(ms));

/**
 * The button on a made reel's page that keeps it, or lets it go: <button id="watch-keep">,
 * which says what happened in #watch-keep-says. It is not seen until the reel is ready to
 * play. Someone with Pixel Reel on their home screen has the reel kept without asking.
 */
function startKeeping(holder) {
  const id = holder.dataset.watch, button = document.getElementById('watch-keep'), says = document.getElementById('watch-keep-says');
  if (!button) return;
  const here = `this ${deviceName(navigator)}`;
  let kept = false, busy = false;
  const show = () => { button.textContent = kept ? `Remove it from ${here}` : `Keep it on ${here}`; };
  const keep = async () => {
    await keepReel(id);
    kept = true;
    says.textContent = `Kept on ${here}. It will play with no internet.`;
  };
  holder.addEventListener('reelopen', async () => {
    try {
      kept = await isKept(id);
      // kept before, or Pixel Reel is on the home screen: kept now, afresh, as a reel can be changed after it is made
      if (kept || document.documentElement.dataset.app === 'on') await keep();
    } catch {
      // it could not be kept just now: an older copy is still there, and so is the button, to try again
    }
    if (kept) says.textContent = `Kept on ${here}. It will play with no internet.`;
    show();
    button.hidden = false;
  }, { once: true });
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try {
      if (kept) {
        await forgetReel(id);
        kept = false;
        says.textContent = `Removed from ${here}.`;
      } else {
        says.textContent = 'Keeping it. One moment.';
        await keep();
      }
    } catch {
      says.textContent = 'That did not work. Check your internet, then try again.';
    }
    busy = false;
    show();
  });
}

/**
 * Fills <ul data-kept> with a poster for each reel kept on this device, each a link to its
 * page, and shows the part of the page it is in (hidden until there is something to show).
 */
async function fillShelf(list) {
  const reels = await keptReels().catch(() => []);
  if (!reels.length) return;
  for (const { id, title, expires, play } of reels) {
    let show;
    try {
      show = showOf(id, play.reel, { clips: play.clips.map((clip) => ({ ...clip, file: pathOf(clip.file) })) });
    } catch {
      continue;   // kept by an older version of the site, in a shape this one cannot play
    }
    haveReel(show);
    const item = document.createElement('li'), poster = Object.assign(document.createElement('a'), { className: 'poster', href: `/r/${id}` });
    const shot = Object.assign(document.createElement('canvas'), { className: 'shot', width: 960, height: 540 });
    Object.assign(shot.dataset, { reel: id, scene: '2', hover: '' });   // its first picture after the title, which tells one reel from another at a glance
    shot.setAttribute('aria-hidden', 'true');
    const name = Object.assign(document.createElement('span'), { className: 'poster-title', textContent: title });
    const meta = Object.assign(document.createElement('span'), { className: 'poster-meta' });
    meta.append(Object.assign(document.createElement('span'), { className: 'poster-kind', textContent: 'Yours' }), Object.assign(document.createElement('span'), { textContent: keptWords(show.line.total, expires) }));
    poster.append(shot, name, meta);
    item.append(poster);
    list.append(item);
  }
  if (!list.children.length) return;
  list.closest('section').hidden = false;
  startShots(list);
}

export function startKept() {
  if (!('caches' in window)) return;   // nowhere to keep anything: the button stays out of sight
  const holder = document.getElementById('watch');
  if (holder?.dataset.watch) startKeeping(holder);
  for (const list of document.querySelectorAll('ul[data-kept]')) fillShelf(list);
}
