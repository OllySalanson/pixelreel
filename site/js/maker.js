// Make a pixel reel now: turns what someone wants explained into the words to give to
// Claude, to copy across. Nothing is sent anywhere; Claude and the connector do the making.
// Where the service has Make it right here switched on, the box makes the reel itself
// instead: from what is typed or pasted in it, a file that is chosen, or anything dropped
// anywhere on the page (given.js works out what was given, and what to send for it). The
// service answers at once with the reel's own page, which shows it being made (watch.js).
import { calm } from './calm.js';
import { canTake, GivenError, givenFrom, isLink, languageFor, nameOf, PICTURE_SIDE, requestFor } from './given.js';
import { mineStorage, rememberMine } from './mine.js';
import { copyText } from './send.js';
import { chosenNarrator } from './voice.js';

const EXAMPLE = 'my gas bill';

/** Where the words last asked about are kept, in this tab only, for the way back from a reel that could not be made. */
const ASKED = 'pixelreel-asked';

/** Where the language last chosen for a reel is kept, on this device. */
const LANGUAGE = 'pixelreel-language';

/** The most the box takes when its words are for copying across to Claude. */
const ASK_MAX = 2000;

/** The words to say to Claude for `what`: a web address, or a few words. With `narrator` (a name, such as "Anna"), they ask for that narrator to read it. */
export function askFor(what, narrator = null) {
  const about = what.trim().replace(/\s+/g, ' ') || EXAMPLE, reel = narrator ? `a pixel reel, read by ${narrator},` : 'a pixel reel';
  return isLink(about) ? `Make me ${reel} about this page: ${about}` : `Make me ${reel} about this: ${about}`;
}

/** Anything with data-copy="#id" copies that element's words when pressed, and says so. */
export function startCopying() {
  for (const el of document.querySelectorAll('[data-copy]')) {
    el.addEventListener('click', async () => {
      const from = document.querySelector(el.dataset.copy);
      if (!from) return;
      const ok = await copyText(from.textContent.trim());
      const says = el.dataset.says ? document.querySelector(el.dataset.says) : el.closest('form, section, article')?.querySelector('.said');
      if (says) says.textContent = ok ? (el.dataset.copied ?? 'Copied.') : 'That did not copy. Press and hold the words to copy them yourself.';
    });
  }
}

export function startMaker() {
  const form = document.getElementById('maker');
  if (!form) return;
  const box = form.querySelector('textarea'), words = document.getElementById('ask-words'), open = document.getElementById('ask-open');
  const here = form.dataset.here === 'on';
  // the box is one line that grows with what is put in it, as far as its styles let it
  const grow = () => { box.style.height = 'auto'; box.style.height = `${box.scrollHeight + box.offsetHeight - box.clientHeight}px`; };
  const update = () => {
    const ask = askFor(box.value, chosenNarrator());
    words.textContent = ask;
    open.href = `https://claude.ai/new?q=${encodeURIComponent(ask)}`;
    for (const said of form.querySelectorAll('.said')) { said.textContent = ''; said.classList.remove('sorry'); }
    grow();
  };
  box.addEventListener('input', update);
  addEventListener('voice', update);   // another narrator has been chosen (voice.js)
  addEventListener('resize', grow);
  for (const chip of form.querySelectorAll('[data-try]')) {
    chip.addEventListener('click', () => { box.value = chip.dataset.try; update(); });
  }
  // Enter in the box does the main thing, as it would in a box of one line; Shift and Enter starts a new line
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
  const make = here ? makeHere(form, box, update) : null;
  if (!here) box.maxLength = ASK_MAX;
  // the main thing: make the reel here, or else copy the words, the same as the first button
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (make) make({ words: box.value });
    else form.querySelector('button[data-copy]').click();
  });
  update();
}

/** A smaller copy of a picture, as a JPEG no more than PICTURE_SIDE pixels along its longest side. */
async function shrinkPicture(file) {
  const picture = await createImageBitmap(file);
  const scale = Math.min(1, PICTURE_SIDE / Math.max(picture.width, picture.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(picture.width * scale), height: Math.round(picture.height * scale) });
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';   // a JPEG has no see-through: what was, is white paper
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(picture, 0, 0, canvas.width, canvas.height);
  picture.close();
  return new Promise((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
}

/**
 * Make it right here, shown only when the service says it can write a reel itself. Gives
 * back make(given), which asks the service for a reel about { words } or { file }, then goes
 * to the reel's page, which shows it being written and recorded. It also takes anything dropped on the page,
 * a file that is chosen, and what is pasted when the pointer is not in a box.
 */
function makeHere(form, box, update) {
  const id = (name) => document.getElementById(name);
  const said = id('here-said'), wait = id('maker-wait'), over = id('drop-over'), file = id('maker-file'), own = id('maker-own'), ownOpen = id('maker-own-open');
  const lead = id('make-lead');
  id('maker-here').hidden = false;
  lead.textContent = lead.dataset.here;
  // giving the words to their own Claude is still there, behind a button
  own.hidden = true;
  ownOpen.addEventListener('click', () => {
    own.hidden = !own.hidden;
    ownOpen.setAttribute('aria-expanded', String(!own.hidden));
  });

  // While Claude writes, the box shows only that: what was given, and that it is being made.
  // what the box says back: a nudge, or with `sorry`, why something could not be made
  const say = (words, sorry = false) => {
    said.textContent = words;
    said.classList.toggle('sorry', sorry);
  };
  // The words last asked about are kept, on this device and only until the tab is closed, so
  // that someone sent back here from a reel that could not be made finds them in the box.
  const keep = (asked) => {
    try {
      if (asked) sessionStorage.setItem(ASKED, asked); else sessionStorage.removeItem(ASKED);
    } catch {
      // nowhere to keep them: the box starts empty, as it always did
    }
  };
  try {
    const asked = sessionStorage.getItem(ASKED);
    if (asked && !box.value) { box.value = asked; update(); }
  } catch {
    // as above
  }
  // The language Peter reads the reel in, where he can read more than English: the one chosen
  // last time on this device, or else the one the browser says its reader prefers.
  const choices = [...form.querySelectorAll('input[name="language"]')];
  const language = () => { const chosen = choices.find((choice) => choice.checked)?.value; return chosen && chosen !== 'english' ? chosen : null; };
  if (choices.length) {
    const offered = choices.map((choice) => choice.value);
    let last = null;
    try { last = localStorage.getItem(LANGUAGE); } catch { /* nowhere to keep it */ }
    const start = offered.includes(last) ? last : languageFor(navigator.languages ?? [navigator.language], offered);
    for (const choice of choices) {
      choice.checked = choice.value === start;
      choice.addEventListener('change', () => { try { localStorage.setItem(LANGUAGE, choice.value); } catch { /* as above */ } });
    }
    id('maker-language').hidden = false;
  }
  let busy = false;
  const setBusy = (on) => {
    busy = on;
    form.style.minHeight = on ? `${form.offsetHeight}px` : '';   // the box keeps its size, so the page does not jump
    form.toggleAttribute('data-busy', on);
    wait.hidden = !on;
    for (const el of form.elements) el.disabled = on;
  };
  // brings what has just changed to the middle of the screen: a drop can land anywhere on the page
  const show = (el) => el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });

  async function make(given) {
    if (busy) return;
    if (!given.file && !given.words.trim()) {
      say('Say what you want explained.', true);
      box.focus();
      return;
    }
    // dropped words go in the box too, to be seen, and to be put right if they do not work
    if (!given.file && box.value !== given.words) { box.value = given.words; update(); }
    const from = document.activeElement;   // the keyboard's place, to put back if this does not work
    id('maker-wait-name').textContent = nameOf(given);
    say('');
    setBusy(true);
    wait.focus({ preventScroll: true });
    show(wait);
    try {
      const request = await requestFor(given, { shrink: shrinkPicture, language: language() });
      const res = await fetch('/try', { method: 'POST', ...request });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok || !answer.watch) throw new GivenError(answer.error || 'That did not work. Try again in a minute.');
      keep(given.file ? '' : given.words);
      rememberMine(mineStorage(), answer);   // so it can be found again, renamed and deleted, from this device
      location.assign(answer.watch);   // the reel's own page, which shows it being written and recorded
    } catch (err) {
      setBusy(false);
      say(err instanceof GivenError ? err.message : navigator.onLine === false ? 'You are not online. Check your internet, then try again.' : 'That did not work. Try again in a minute.', true);
      if (form.contains(from)) from.focus({ preventScroll: true });
      show(said);
    }
  }

  id('maker-choose').addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    if (file.files[0]) make({ file: file.files[0] });
    file.value = '';   // so the same file can be chosen again
  });

  // Anything dragged in from outside the page can be dropped anywhere on it. What is dragged
  // from the page itself (a link, a picture) is left alone.
  let ours = false, depth = 0;   // how many things on the page the drag is over just now: none once it has left the window
  const taking = (e) => !ours && canTake(e.dataTransfer);
  const lift = () => { depth = 0; over.hidden = true; };
  addEventListener('dragstart', () => { ours = true; });
  addEventListener('dragend', () => { ours = false; lift(); });
  addEventListener('dragenter', (e) => { if (taking(e)) { e.preventDefault(); depth++; over.hidden = busy; } });
  addEventListener('dragover', (e) => { if (taking(e)) { e.preventDefault(); e.dataTransfer.dropEffect = busy ? 'none' : 'copy'; } });
  addEventListener('dragleave', (e) => { if (taking(e) && --depth <= 0) lift(); });
  addEventListener('drop', (e) => {
    if (!taking(e)) return;
    e.preventDefault();   // or the browser would leave this page to open what was dropped
    lift();
    const given = givenFrom(e.dataTransfer);
    if (given && !busy) make(given);
  });

  // Pasted with the pointer outside any box: a picture or a file is made into a reel at
  // once; words go into the box to be looked over first, as a clipboard can hold anything.
  document.addEventListener('paste', (e) => {
    const given = givenFrom(e.clipboardData, { words: true });
    if (!given || busy) return;
    const inBox = e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]');
    if (!given.file && inBox) return;
    e.preventDefault();
    if (given.file) { make(given); return; }
    box.value = given.words;
    update();
    say('Pasted. Now press Make my reel.');
    id('maker-go').focus({ preventScroll: true });
    show(id('maker-go'));
  });

  // coming back to this page with Back finds it as it was left: ready, not still waiting
  addEventListener('pageshow', (e) => { if (e.persisted) { setBusy(false); say(''); } });
  return make;
}
