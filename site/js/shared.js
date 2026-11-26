// Things shared to Pixel Reel from a phone's Share menu: Android offers it there once Pixel
// Reel is on the home screen. The phone sends what was shared to /share, where the service
// worker (sw.js) puts it by, on the device, and brings up the page with the make-one box
// (/make). This hands it to My notes there: a link or some words become a note, a file is
// made into a reel, and either way the reel is started at once.
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

/**
 * Call with My notes on the make page (startMaking in notes.js), once it is woken: a link or
 * some words become a note, and the reel is made at once, as if Make my reel were
 * pressed; a file is made into a reel at once.
 */
export async function startShared(notes = null) {
  if (!notes || !new URLSearchParams(location.search).has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);   // so that coming back to the page does not look again
  const given = await takeShared().catch(() => null);
  if (!given) return;
  if (given.file) notes.file(given.file, { andMake: true });
  else if (given.words) notes.add(given.words, { andMake: true });
}
