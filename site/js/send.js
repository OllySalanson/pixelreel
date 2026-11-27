// Getting things out of the page and into someone's hands: copying words, and passing a
// reel on. Nothing here touches the page until it is asked to, so Node can test it.
import { count, reelName } from './count.js';

/** Puts `text` on the clipboard. Resolves to whether it worked. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // an older browser, or a page not allowed the clipboard: select it and copy the old way
    const box = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    box.className = 'sr-only';
    document.body.append(box);
    box.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      box.remove();
    }
  }
}

/**
 * Passes a reel on. With `share` (a phone's own way of sending things) it opens that, with
 * the reel's title and address, and `words` to go with them where the page is not a reel;
 * without, or if that fails, it copies the address with `copy`.
 * Resolves to how it went: 'shared' (the phone has taken over), 'stopped' (they changed
 * their mind), 'copied' or 'failed'.
 */
export async function sendReel(title, url, { share = null, copy = copyText, words = null } = {}) {
  if (share) {
    try {
      await share({ title, text: words ?? `${title}, as a pixel reel. Press Play.`, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'stopped';
    }
  }
  return (await copy(url)) ? 'copied' : 'failed';
}

/** Counts a reel passed on (count.js), by the page it is on (`path`): how it went, and which reel, never to whom. */
export function countSent(how, path) {
  if (how !== 'shared' && how !== 'copied') return;
  const reel = /^\/(?:r|watch)\/([^/]+)$/.exec(path)?.[1];
  count('reel_shared', { method: how === 'shared' ? 'share' : 'copy', reel: reel ? reelName(reel) : 'page' });
}

/** What to say after sendReel: nothing when a phone took over, or when they changed their mind. */
export const sentWords = (how, url) => ({ copied: 'Link copied. Paste it into a message.', failed: `That did not copy. The link is ${url}` })[how] ?? '';

/** A phone's own way of sending things (to WhatsApp, to a message), or null on a computer, which copies the link. */
export const phoneShare = () => (navigator.share && matchMedia('(pointer: coarse)').matches ? (what) => navigator.share(what) : null);

/**
 * Wakes every <button data-send="A reel's name" data-says="#where-to-say-so">: pressed, it
 * passes on the page it is on, or the page at data-path, with the words in data-words if it has any.
 */
export function startSending() {
  for (const button of document.querySelectorAll('button[data-send]')) {
    const says = document.querySelector(button.dataset.says);
    button.hidden = false;
    button.addEventListener('click', async () => {
      const path = button.dataset.path ?? location.pathname, url = location.origin + path;
      const how = await sendReel(button.dataset.send, url, { share: phoneShare(), words: button.dataset.words ?? null });
      countSent(how, path);
      says.textContent = sentWords(how, url);
    });
  }
}
