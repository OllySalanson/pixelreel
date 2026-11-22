// Getting things out of the page and into someone's hands: copying words, and passing a
// reel on. Nothing here touches the page until it is asked to, so Node can test it.

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
 * the reel's title and address; without, or if that fails, it copies the address with `copy`.
 * Resolves to how it went: 'shared' (the phone has taken over), 'stopped' (they changed
 * their mind), 'copied' or 'failed'.
 */
export async function sendReel(title, url, { share = null, copy = copyText } = {}) {
  if (share) {
    try {
      await share({ title, text: `${title}, as a pixel reel. Press Play.`, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'stopped';
    }
  }
  return (await copy(url)) ? 'copied' : 'failed';
}

/** What to say after sendReel: nothing when a phone took over, or when they changed their mind. */
export const sentWords = (how, url) => ({ copied: 'Link copied. Paste it into a message.', failed: `That did not copy. The link is ${url}` })[how] ?? '';

/** A phone's own way of sending things (to WhatsApp, to a message), or null on a computer, which copies the link. */
export const phoneShare = () => (navigator.share && matchMedia('(pointer: coarse)').matches ? (what) => navigator.share(what) : null);

/**
 * Wakes every <button data-send="A reel's name" data-says="#where-to-say-so">: pressed, it
 * passes on the page it is on, or the page at data-path.
 */
export function startSending() {
  for (const button of document.querySelectorAll('button[data-send]')) {
    const says = document.querySelector(button.dataset.says);
    button.hidden = false;
    button.addEventListener('click', async () => {
      const url = location.origin + (button.dataset.path ?? location.pathname);
      says.textContent = sentWords(await sendReel(button.dataset.send, url, { share: phoneShare() }), url);
    });
  }
}
