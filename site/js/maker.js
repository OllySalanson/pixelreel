// Make a pixel reel (the form on its own page, /make): one big box to paste a link into (a
// button does the pasting), one line that says who reads it and in which language, and one
// big button. It turns what someone wants explained into the words to give to Claude, to
// copy across. Nothing is sent anywhere; Claude and the connector do the making.
// Where the service has Make it right here switched on, the box makes the reel itself
// instead: from what is typed or pasted in it, a file that is chosen, or anything dropped
// anywhere on the page (given.js works out what was given, and what to send for it). The
// service answers at once with the reel's own page, which shows it being made (watch.js).
import { calm } from './calm.js';
import { canTake, GivenError, givenFrom, givenFromClipboard, isLink, languageFor, nameOf, PICTURE_SIDE, requestFor } from './given.js';
import { mineStorage, rememberMine } from './mine.js';
import { copyText } from './send.js';
import { keepNarrator, narratorName, readNarrator } from './voice.js';

const EXAMPLE = 'my gas bill';

/** Where the words last asked about are kept, in this tab only, for the way back from a reel that could not be made. */
const ASKED = 'pixelreel-asked';

/** Where the language last chosen for a reel is kept, on this device. */
const LANGUAGE = 'pixelreel-language';

/** The most the box takes when its words are for copying across to Claude. */
const ASK_MAX = 2000;

/**
 * The words to say to Claude for `what`: a web address, or a few words. With `narrator` (a
 * name, such as "Anna") they ask for that narrator to read it, and with `language` (such as
 * 'french') for the reel to be in that language.
 */
export function askFor(what, narrator = null, language = null) {
  const about = what.trim().replace(/\s+/g, ' ') || EXAMPLE;
  const reel = `a pixel reel${language ? ` in ${language[0].toUpperCase()}${language.slice(1)}` : ''}${narrator ? `, read by ${narrator},` : ''}`;
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

/**
 * Where the service makes reels itself, the pages say so: words marked data-here-says say
 * what they say then, and the reel about the make-one box (the button #make-reel, and
 * "Watch this whole page") is the one that explains the box as it is then.
 */
export function startHere() {
  if (!document.querySelector('[data-here="on"]')) return;
  for (const words of document.querySelectorAll('[data-here-says]')) words.textContent = words.dataset.hereSays;
  const about = document.getElementById('make-reel');
  if (!about) return;
  for (const button of document.querySelectorAll('button[data-reels]')) {
    button.dataset.reels = button.dataset.reels.split(/\s+/).map((name) => (name === about.dataset.reel ? about.dataset.reelHere : name)).join(' ');
  }
  about.dataset.reel = about.dataset.reelHere;
}

/** Brings what has just changed onto the screen: to the middle of it, or (`block` 'start') to the top. */
const show = (el, block = 'center') => el.scrollIntoView({ block, behavior: calm() ? 'auto' : 'smooth' });

export function startMaker() {
  const form = document.getElementById('maker');
  if (!form) return;
  const id = (name) => document.getElementById(name);
  const box = form.querySelector('textarea'), words = id('ask-words'), open = id('ask-open');
  const here = form.dataset.here === 'on';
  // what the box says back: a nudge, or with `sorry`, why something could not be done
  const said = id(here ? 'here-said' : 'maker-said');
  const say = (text, sorry = false) => {
    said.textContent = text;
    said.classList.toggle('sorry', sorry);
  };
  // the box is one line that grows with what is put in it, as far as its styles let it
  const grow = () => { box.style.height = 'auto'; box.style.height = `${box.scrollHeight + box.offsetHeight - box.clientHeight}px`; };
  // The language the reel is read in, where more than English can be read here: the one chosen
  // last time on this device, or else the one the browser says its reader prefers.
  const choices = [...form.querySelectorAll('input[name="language"]')];
  const language = () => { const chosen = choices.find((choice) => choice.checked)?.value; return chosen && chosen !== 'english' ? chosen : null; };
  // Who reads the reel, where someone besides Peter reads here: the narrator chosen before
  // on this device, here or on the cards under Meet Peter, which keep it in the same place.
  const readers = [...form.querySelectorAll('input[name="who"]')];
  const narrator = () => { const chosen = readers.find((reader) => reader.checked)?.value; return chosen && chosen !== 'peter' ? chosen : null; };
  // Both choices are folded away under one line that says what is chosen ("Read by Peter in
  // English"), so that nobody has to decide anything before the big button: it opens to change them.
  const reads = id('maker-read-says');
  const named = (group) => {
    const name = group.find((one) => one.checked)?.nextElementSibling;
    if (!name) return null;
    const chip = document.createElement('b');
    chip.textContent = name.textContent;
    if (name.lang) chip.lang = name.lang;   // "Français" is said as French
    return chip;
  };
  const sayRead = () => {
    const who = named(readers), tongue = named(choices);
    reads.replaceChildren(...(who ? ['Read by ', who] : ['Read']), ...(tongue ? [' in ', tongue] : []));
  };
  const update = () => {
    const who = narrator(), ask = askFor(box.value, who ? narratorName(who) : null, language());
    words.textContent = ask;
    open.href = `https://claude.ai/new?q=${encodeURIComponent(ask)}`;
    for (const said of form.querySelectorAll('.said')) { said.textContent = ''; said.classList.remove('sorry'); }
    grow();
  };
  box.addEventListener('input', update);
  addEventListener('resize', grow);
  // Words that arrive on a press (pasted, or one of the things to try) go into the box to be
  // looked over, and the keyboard goes to the button that is next: a clipboard can hold anything.
  const next = here ? id('maker-go') : form.querySelector('button[data-copy]');
  const ready = (text, note) => {
    box.value = text;
    update();
    say(note);
    next.focus({ preventScroll: true });
    // the box and the button are seen together: the page moves only if one of them is off the screen (the things to try are under them)
    const bar = document.querySelector('.top')?.getBoundingClientRect().bottom ?? 0;
    if (form.getBoundingClientRect().top < bar || next.getBoundingClientRect().bottom > innerHeight) show(form, 'start');
  };
  const pasted = (text) => ready(text, here ? 'Pasted. Now press Make my reel.' : 'Pasted. Now press Copy the words.');
  for (const chip of form.querySelectorAll('[data-try]')) {
    // where the box makes the reel itself, the things to try sit under the big button, so the way back up to it is said
    chip.addEventListener('click', () => { if (here) ready(chip.dataset.try, 'Now press Make my reel.'); else { box.value = chip.dataset.try; update(); } });
  }
  // Enter in the box does the main thing, as it would in a box of one line; Shift and Enter starts a new line
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    form.requestSubmit();
  });
  if (choices.length) {
    const offered = choices.map((choice) => choice.value);
    let last = null;
    try { last = localStorage.getItem(LANGUAGE); } catch { /* nowhere to keep it */ }
    const start = offered.includes(last) ? last : languageFor(navigator.languages ?? [navigator.language], offered);
    for (const choice of choices) {
      choice.checked = choice.value === start;
      choice.addEventListener('change', () => {
        try { localStorage.setItem(LANGUAGE, choice.value); } catch { /* as above */ }
        sayRead();
        update();   // the words for Claude say which language
      });
    }
    id('maker-language').hidden = false;
  }
  if (readers.length) {
    let kept = null;
    try { kept = readNarrator(localStorage); } catch { /* nowhere to keep it */ }
    const start = readers.some((reader) => reader.value === kept) ? kept : 'peter';   // one chosen before who no longer reads here is let go
    for (const reader of readers) {
      reader.checked = reader.value === start;
      reader.addEventListener('change', () => {
        try { keepNarrator(localStorage, reader.value); } catch { /* as above */ }
        sayRead();
        update();   // the words for Claude say who
      });
    }
    id('maker-who').hidden = false;
  }
  if (choices.length || readers.length) {
    sayRead();
    id('maker-read').hidden = false;
  }
  const make = here ? makeHere(form, box, { update, say, pasted, language, narrator }) : null;
  // The button that pastes: one press puts what was copied into the box, with no pressing
  // and holding on a phone. Only where the browser lets a page read the clipboard on a press.
  const paste = id('maker-paste');
  if (navigator.clipboard?.read || navigator.clipboard?.readText) {
    paste.hidden = false;
    paste.addEventListener('click', async () => {
      let given;
      try {
        given = await givenFromClipboard(navigator.clipboard);
      } catch {
        // the browser would not hand it over, or the person said no: the box still takes a paste of its own
        update();
        say('That did not paste. Press in the box, then paste there.', true);
        box.focus({ preventScroll: true });
        return;
      }
      if (given?.words) pasted(given.words);
      else if (given?.file && make) make(given);   // a copied picture, such as a screenshot of a letter
      else { update(); say(given ? 'That is a picture. Copy a link or some words, then press Paste.' : 'Nothing to paste yet. Copy a link first, then press Paste.', true); }
    });
  }
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
function makeHere(form, box, { update, say, pasted, language, narrator }) {
  const id = (name) => document.getElementById(name);
  const wait = id('maker-wait'), over = id('drop-over'), file = id('maker-file'), own = id('maker-own'), ownOpen = id('maker-own-open');
  id('maker-here').hidden = false;
  // giving the words to their own Claude is still there, behind a button
  id('maker-other').hidden = false;
  own.hidden = true;
  ownOpen.addEventListener('click', () => {
    own.hidden = !own.hidden;
    ownOpen.setAttribute('aria-expanded', String(!own.hidden));
  });

  // While Claude writes, the box shows only that: what was given, and that it is being made.
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
  let busy = false;
  const setBusy = (on) => {
    busy = on;
    form.style.minHeight = on ? `${form.offsetHeight}px` : '';   // the box keeps its size, so the page does not jump
    form.toggleAttribute('data-busy', on);
    wait.hidden = !on;
    for (const el of form.elements) el.disabled = on;
  };

  async function make(given) {
    if (busy) return;
    if (!given.file && !given.words.trim()) {
      say('Paste a link, or type a question, first.', true);
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
      // read by whoever was chosen on this page ("Anna will read the reels you make"), in the language chosen in the box
      const request = await requestFor(given, { shrink: shrinkPicture, language: language(), narrator: narrator() });
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
      show(id('here-said'));
    }
  }

  // a photo, or a PDF: a button each, and the chooser opens showing only that kind
  for (const way of [id('maker-photo'), id('maker-choose')]) {
    way.addEventListener('click', () => { file.accept = way.dataset.accept; file.click(); });
  }
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
    if (given.file) make(given); else pasted(given.words);
  });

  // coming back to this page with Back finds it as it was left: ready, not still waiting
  addEventListener('pageshow', (e) => { if (e.persisted) { setBusy(false); say(''); } });
  return make;
}
