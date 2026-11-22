// Who reads the reels someone makes: Peter, unless they choose another narrator on the home
// page, where the service offers any (the cards narratorsHtml writes, in service/site.mjs).
// The choice is kept on this device only. The make-one box asks for it (maker.js), so that
// the words it writes for Claude say who should read.
// The top half touches no page, so Node can test it.

/** Where the choice is kept, in the browser's own storage. */
export const VOICE = 'pixelreel-voice';

/** The narrator kept in `storage` (the browser's localStorage, or anything like it), by first name, or null for Peter. */
export function readNarrator(storage) {
  try {
    const { narrator } = JSON.parse(storage.getItem(VOICE) ?? '{}');
    return typeof narrator === 'string' && /^[a-z]{1,16}$/.test(narrator) && narrator !== 'peter' ? narrator : null;
  } catch {
    return null;   // nothing kept, or nowhere to keep it
  }
}

/** Keeps the choice of narrator: a first name, or null (or 'peter') to go back to Peter. */
export function keepNarrator(storage, narrator) {
  try {
    if (narrator && narrator !== 'peter') storage.setItem(VOICE, JSON.stringify({ narrator }));
    else storage.removeItem(VOICE);
  } catch {
    // nowhere to keep it (private browsing, say): it still lasts until the page is closed
  }
}

/** A narrator's name as it is written: anna is Anna. */
export const narratorName = (narrator) => narrator[0].toUpperCase() + narrator.slice(1);

let chosen = null;   // the narrator chosen on this page, once it has been looked up

/** The narrator chosen on this device, as a name to write ("Anna"), or null for Peter: only ever one this page offers. */
export const chosenNarrator = () => (chosen ? narratorName(chosen) : null);

export function startVoice() {
  const group = document.getElementById('voices');
  if (!group) return;   // nobody but Peter is offered here
  const says = document.getElementById('voices-said'), picks = [...group.querySelectorAll('input[name="narrator"]')];
  const say = () => { says.textContent = `${chosen ? narratorName(chosen) : 'Peter'} will read the reels you make.`; };
  const kept = readNarrator(localStorage);
  // a narrator chosen before who is no longer offered is let go: Peter reads
  chosen = picks.some((pick) => pick.value === kept) ? kept : null;
  for (const pick of picks) pick.checked = pick.value === (chosen ?? 'peter');
  say();
  group.addEventListener('change', (e) => {
    if (e.target.name !== 'narrator') return;
    chosen = e.target.value === 'peter' ? null : e.target.value;
    keepNarrator(localStorage, chosen);
    say();
    dispatchEvent(new Event('voice'));   // the make-one box writes its words for Claude again
  });
}
