// Things shared to Pixel Reel from a phone's Share menu: Android offers it there once Pixel
// Reel is on the home screen. The phone sends what was shared to /share, where the service
// worker (sw.js) puts it by, on the device, and brings up the page with the make-one box
// (/make). This hands it to the box the way a person would: a link or some words go in the box,
// a file goes to the box's own file chooser. Where the box makes reels itself it starts at
// once, as it does for a drop; where it writes words for Claude, they are ready to copy.
// Nothing that was shared leaves the device unless the box sends it.

/** Where the service worker puts what was shared: the same name as SHARED in sw.js. */
export const SHARED = 'pixelreel-shared-1';

/**
 * What to put in the make-one box for what a phone shared ({ title, text, url }): its link,
 * if it has one, as a page shared from a browser comes as a title and a link, and the link
 * is often in among the words; or else its words.
 */
export function sharedWords({ title = '', text = '', url = '' } = {}) {
  // a link in the middle of a sentence may have the sentence's full stop or bracket on its end
  const link = [url, text].map((words) => /https?:\/\/[^\s<>"']+/i.exec(String(words))?.[0].replace(/[.,;:!?)\]]+$/, '')).find(Boolean);
  return link ?? (String(text).trim() || String(title).trim());
}

/**
 * Takes what was shared out of the store, so that it is handed over once: { words, file }
 * (words may be empty, file may be null), or null if nothing is waiting.
 */
export async function takeShared({ store = caches } = {}) {
  const cache = await store.open(SHARED);
  const [said, sent] = await Promise.all([cache.match('/shared/words'), cache.match('/shared/file')]);
  await Promise.all([cache.delete('/shared/words'), cache.delete('/shared/file')]);
  const words = said ? sharedWords(await said.json()) : '';
  const file = sent ? new File([await sent.blob()], decodeURIComponent(sent.headers.get('x-file-name') ?? '') || 'shared', { type: sent.headers.get('content-type') ?? '' }) : null;
  return words || file ? { words, file } : null;
}

/** Call after the make-one box has been woken (startMaker), so that it hears what it is handed. */
export async function startShared() {
  const form = document.getElementById('maker');
  if (!form || !new URLSearchParams(location.search).has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);   // so that coming back to the page does not look again
  const given = await takeShared().catch(() => null);
  if (!given) return;
  const here = form.dataset.here === 'on', box = form.querySelector('textarea'), said = document.getElementById(here ? 'here-said' : 'maker-said');
  if (given.file && here) {
    // the box's own file chooser, as if the file had been chosen there
    const chooser = document.getElementById('maker-file'), hand = new DataTransfer();
    hand.items.add(given.file);
    chooser.files = hand.files;
    chooser.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (!given.words) {
    said.textContent = 'Pixel Reel can take a link or some words here. For a file, ask Claude.';
    return;
  }
  box.value = given.words;
  box.dispatchEvent(new Event('input', { bubbles: true }));   // the box writes its words for Claude again, and grows to fit
  if (here) {
    form.requestSubmit();   // shared to be made into a reel: no second press, as for a drop
    return;
  }
  said.textContent = 'Here it is. Now press Copy, and open Claude.';
  const next = document.getElementById('ask-open');
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'center' });   // what was shared is in the box above it, and what to press is in the middle of the screen
}
