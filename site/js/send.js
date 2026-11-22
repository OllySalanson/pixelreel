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
 * Resolves to what to say afterwards, which is nothing when the phone has taken over.
 */
export async function sendReel(title, url, { share = null, copy = copyText } = {}) {
  if (share) {
    try {
      await share({ title, text: `${title}, as a pixel reel. Press Play.`, url });
      return '';
    } catch (err) {
      if (err?.name === 'AbortError') return '';   // they changed their mind
    }
  }
  return (await copy(url)) ? 'Link copied. Paste it into a message.' : `That did not copy. The link is ${url}`;
}
