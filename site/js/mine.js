// Your reels: the reels someone has made or opened on this website, listed on their own
// device, the latest first, so that they can find them again, call them what they like, and
// delete the ones they made for good (or take one they were sent off the list). The list is
// kept in the browser and never sent anywhere. A reel they made has the key the service gave
// when it was begun, which is what lets its maker, and nobody else, delete it.
// The top half touches no page, so Node can test it.
import { forgetReel } from './kept.js';

/** Where the list is kept, in the browser's own storage. */
export const MINE = 'pixelreel-mine';

/** The most reels listed: older ones drop off the end (they are still where they were, until their 30 days are up). */
export const MOST = 30;

const isId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(id);
const words = (value, most) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, most) : '');

/** One reel of the list, tidied, or null if it is not one: { id, title, name, key, made, seen, expires }. `seen` is when it was last opened. */
function tidy(reel) {
  if (!reel || !isId(reel.id)) return null;
  const expires = typeof reel.expires === 'string' && !Number.isNaN(Date.parse(reel.expires)) ? reel.expires : null;
  return {
    id: reel.id,
    title: words(reel.title, 120) || 'A pixel reel',
    name: words(reel.name, 80),   // what its maker calls it, if they have named it
    key: typeof reel.key === 'string' ? reel.key.slice(0, 200) : '',
    made: Number.isFinite(reel.made) ? reel.made : 0,
    seen: Number.isFinite(reel.seen) ? reel.seen : 0,
    expires
  };
}

/**
 * The list, newest first, without any reel past the day it is kept until. `storage` is the
 * browser's localStorage, or anything like it; a browser that will not keep things has no list.
 */
export function readMine(storage, now = Date.now()) {
  let kept;
  try { kept = JSON.parse(storage.getItem(MINE) ?? '[]'); } catch { kept = []; }
  const seen = new Set();
  return (Array.isArray(kept) ? kept : []).map(tidy)
    .filter((reel) => reel && !seen.has(reel.id) && seen.add(reel.id) && !(reel.expires && Date.parse(reel.expires) <= now))
    .sort((a, b) => Math.max(b.made, b.seen) - Math.max(a.made, a.seen)).slice(0, MOST);
}

/** Keeps `reels` as the list. Says whether it could. */
function writeMine(storage, reels) {
  try {
    storage.setItem(MINE, JSON.stringify(reels.slice(0, MOST)));
    return true;
  } catch {
    return false;   // private browsing, or no room: the reel is still made, just not listed
  }
}

/** Adds a reel that has just been begun to the top of the list: { id, title, key, expires }. Gives back the list. */
export function rememberMine(storage, reel, now = Date.now()) {
  const added = tidy({ ...reel, made: now });
  if (!added) return readMine(storage, now);
  const reels = [added, ...readMine(storage, now).filter((each) => each.id !== added.id)];
  writeMine(storage, reels);
  return reels.slice(0, MOST);
}

/**
 * Changes what is known of a reel that is in the list (its `title` once Claude has written
 * it, the `name` its maker gives it, the day it `expires`). A reel that is not in the list
 * is not added: it is someone else's. Gives back the list.
 */
export function updateMine(storage, id, changes, now = Date.now()) {
  const reels = readMine(storage, now), at = reels.findIndex((reel) => reel.id === id);
  if (at < 0) return reels;
  const changed = tidy({ ...reels[at], ...changes });
  // nothing is written when nothing has changed: a page that is waiting asks every two seconds
  if (JSON.stringify(changed) !== JSON.stringify(reels[at])) { reels[at] = changed; writeMine(storage, reels); }
  return reels;
}

/**
 * Notes that a reel has been opened, on its own page: it goes to the top of the list, and
 * joins it if it was not there (one someone was sent, say), with no key, so it can be taken
 * off the list but not deleted. Gives back the list.
 */
export function openedMine(storage, reel, now = Date.now()) {
  const reels = readMine(storage, now), at = reels.findIndex((each) => each.id === reel.id);
  const opened = tidy(at < 0 ? { ...reel, key: '', made: 0, seen: now } : { ...reels[at], ...(reel.title ? { title: reel.title } : {}), expires: reel.expires ?? reels[at].expires, seen: now });
  if (!opened) return reels;
  writeMine(storage, [opened, ...reels.filter((each) => each.id !== opened.id)]);
  return readMine(storage, now);
}

/** Takes a reel off the list. Gives back the list. */
export function forgetMine(storage, id, now = Date.now()) {
  const before = readMine(storage, now), reels = before.filter((reel) => reel.id !== id);
  if (reels.length !== before.length) writeMine(storage, reels);
  return reels;
}

/** What a reel is called in the list: the name its maker gave it, or else its own title. */
export const calledMine = (reel) => reel.name || reel.title;

/** The browser's own storage, or a stand-in that keeps nothing, where a browser will not let a page keep things. */
export function deviceStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const NOWHERE = { getItem: () => null, setItem: () => { throw new Error('nowhere to keep it'); } };

/** The list's storage on this device. */
export const mineStorage = () => deviceStorage() ?? NOWHERE;

/**
 * Deletes a reel for good: asks the service, with the key its maker was given, then takes it
 * off the list. Resolves to 'deleted', 'gone' (it had gone already: off the list it comes),
 * or 'failed' (it is still there, and still listed).
 */
export async function deleteMine(storage, reel, { ask = fetch } = {}) {
  let status;
  try {
    status = (await ask(`/r/${reel.id}`, { method: 'DELETE', headers: { 'x-reel-key': reel.key } })).status;
  } catch {
    return 'failed';
  }
  if (status !== 200 && status !== 404) return 'failed';
  forgetMine(storage, reel.id);
  return status === 200 ? 'deleted' : 'gone';
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

/**
 * Shows the list on the page of your reels (/yours), in the block <div id="mine">, with
 * #mine-none instead while it is empty: each reel a link to its page, with the day it is kept until, a button to call it
 * something else and a button to delete it, which asks once more before it does.
 */
export function startMine() {
  const block = document.getElementById('mine');
  if (!block) return;
  const list = document.getElementById('mine-list'), said = document.getElementById('mine-said'), storage = mineStorage();
  const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text ? { textContent: text } : {});
  const button = (text, cls = 'plain-btn') => Object.assign(el('button', cls, text), { type: 'button' });

  function draw(reels = readMine(storage)) {
    block.hidden = reels.length === 0;
    const none = document.getElementById('mine-none');
    if (none) none.hidden = reels.length > 0;
    list.replaceChildren(...reels.map((reel) => {
      const item = el('li', 'mine-reel'), name = Object.assign(el('a', 'mine-name', calledMine(reel)), { href: `/r/${reel.id}` });
      const until = el('span', 'mine-until', reel.expires ? `Kept until ${DAY.format(new Date(reel.expires))}` : '');
      // one made here can be deleted for good; one only opened here can be taken off the list
      const keys = el('span', 'mine-keys'), rename = button('Rename'), remove = button(reel.key ? 'Delete' : 'Remove');
      keys.append(rename, remove);
      item.append(name, until, keys);

      // call it something else: the link becomes a box, with what it is called now in it
      rename.addEventListener('click', () => {
        said.textContent = '';
        const form = el('form', 'mine-rename'), box = Object.assign(el('input'), { type: 'text', value: calledMine(reel), maxLength: 80, autocomplete: 'off' });
        box.setAttribute('aria-label', `A name for ${calledMine(reel)}`);
        const save = Object.assign(el('button', 'btn btn-gold btn-small', 'Save'), { type: 'submit' }), cancel = button('Cancel');
        form.append(box, save, cancel);
        item.replaceChildren(form);
        box.focus();
        box.select();
        const done = (words) => {
          said.textContent = words;
          draw();
          list.querySelector(`a[href="/r/${reel.id}"]`)?.focus();
        };
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          updateMine(storage, reel.id, { name: box.value });
          done('Renamed.');
        });
        cancel.addEventListener('click', () => done(''));
        box.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(''); });
      });

      // delete it for good: asked twice, since it cannot be put back
      remove.addEventListener('click', () => {
        said.textContent = '';
        if (!reel.key) {
          const sure = el('span', 'mine-sure'), yes = button('Yes, remove it', 'btn btn-gold btn-small'), no = button('No, keep it');
          sure.append(el('span', null, 'Take it off your list?'), yes, no);
          keys.replaceWith(sure);
          yes.focus();
          no.addEventListener('click', () => { said.textContent = ''; draw(); });
          yes.addEventListener('click', () => {
            forgetMine(storage, reel.id);
            said.textContent = `Removed: ${calledMine(reel)}.`;
            draw();
          });
          return;
        }
        const sure = el('span', 'mine-sure'), yes = button('Yes, delete it', 'btn btn-gold btn-small'), no = button('No, keep it');
        sure.append(el('span', null, 'Delete it for good?'), yes, no);
        keys.replaceWith(sure);
        yes.focus();
        no.addEventListener('click', () => { said.textContent = ''; draw(); });
        yes.addEventListener('click', async () => {
          yes.disabled = no.disabled = true;
          const how = await deleteMine(storage, reel);
          if (how !== 'failed') await forgetReel(reel.id).catch(() => {});   // and any copy kept here to play with no internet
          said.textContent = how === 'failed' ? 'That did not work. It is still there. Try again in a minute.' : `Deleted: ${calledMine(reel)}. It is gone for good.`;
          draw();
        });
      });
      return item;
    }));
  }
  draw();
  // coming back to this page with Back finds the reel just made in the list
  addEventListener('pageshow', (e) => { if (e.persisted) draw(); });
}
