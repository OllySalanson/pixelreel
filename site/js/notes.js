// My notes, beside a shared reel: questions and thoughts about it, typed or said aloud, kept
// on this device, and then one button that has Claude make the next reel from them. The
// service tells Claude the whole chain of reels that led here, with the notes each was made
// from (service/writer.mjs), so the next reel answers them in context.
// It is one line to write in, with a paperclip before it for a photo or a PDF, which waits
// in the list like a note, and a microphone after it. Its markup is notesHtml in service/site.mjs.
import { deviceStorage, mineStorage, rememberMine } from './mine.js';
import { base64Of, fileGiven, GivenError, givenFrom, NOTE_MAX, NOTES_MAX, TEXT_MAX } from './given.js';
import { shrinkPicture } from './maker.js';
import { canRecord, recordForService } from './hearing.js';
import { readNarrator } from './voice.js';

/** Where a reel's notes are kept on this device. */
const keyOf = (id) => `pixelreel-notes:${id}`;

/** The notes kept for reel `id`: a list of strings, oldest first. Nothing kept, or nowhere to keep it, is an empty list. */
export function readNotes(storage, id) {
  try {
    const kept = JSON.parse(storage?.getItem(keyOf(id)) ?? '[]');
    return Array.isArray(kept) ? kept.filter((note) => typeof note === 'string' && note.trim()).slice(0, NOTES_MAX) : [];
  } catch {
    return [];
  }
}

/** Keeps `notes` for reel `id`. False if they could not be kept (they still show until the page is left). */
export function writeNotes(storage, id, notes) {
  try {
    if (notes.length) storage.setItem(keyOf(id), JSON.stringify(notes));
    else storage.removeItem(keyOf(id));
    return true;
  } catch {
    return false;
  }
}

/**
 * A note as it is kept: one line, no longer than a note may be. Empty for nothing worth
 * keeping. With `first` (the make page, where a note may be a pasted transcript), its lines
 * are kept, and it may be as long as a piece of writing.
 */
export const tidyNote = (words, { first = false } = {}) => (first
  ? String(words ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, TEXT_MAX)
  : String(words ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX));

/** Where the language last chosen for a reel is kept (the same as maker.js keeps it in). */
const LANGUAGE = 'pixelreel-language';

/**
 * What to send to make a reel from `notes`: the next reel after reel `id`, or with `first`, a
 * first reel from the make page, read by whoever was chosen on this device, in the language
 * chosen last (the service keeps a reel it follows in that reel's own). `data` is the photo
 * or PDF clipped to the notes, if there is one: its bytes in base64.
 */
export function noteRequest(id, notes, { first = false, storage = null, data = null } = {}) {
  const clipped = data ? { file: { data } } : {};
  if (!first) return { next: id, notes, ...clipped };
  let language = null;
  try { language = storage?.getItem(LANGUAGE) || null; } catch { /* nothing kept */ }
  return { notes, ...clipped, ...(language && language !== 'english' ? { language } : {}), ...(storage && readNarrator(storage) ? { narrator: readNarrator(storage) } : {}) };
}

/**
 * Which key shows after the line: 'mic' while there is nothing in it to add (where the
 * microphone can hear: `hears`) and for as long as it is listening, 'save' (the arrow that
 * adds the note) once there are `words` in it, or null. Only ever one of them, as in the
 * chat boxes people know.
 */
export function keyAfter({ words = false, hears = false, listening = false } = {}) {
  if (hears && (listening || !words)) return 'mic';
  return words ? 'save' : null;
}

/** True when there is something to make a reel from: a note, a photo or a PDF, or words still in the line. */
export const canMake = ({ notes = 0, clipped = false, words = false } = {}) => notes > 0 || clipped || words;

/**
 * How the microphone hears a note, in this browser: the browser's own speech recognition,
 * or null where it has none that works, and the service must hear it instead. Brave has the
 * name but no service behind it: every go ends in a network error, so it is treated as
 * having none.
 */
export function speechHere(scope = globalThis) {
  if (scope.navigator?.brave) return null;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** A small square picture of a photo, to show it in the list, or null if this browser cannot draw it. */
async function thumbOf(file) {
  try {
    const picture = await createImageBitmap(file), side = 88;
    const canvas = Object.assign(document.createElement('canvas'), { width: side, height: side, className: 'mynotes-thumb' });
    const scale = Math.max(side / picture.width, side / picture.height), wide = picture.width * scale, high = picture.height * scale;
    canvas.getContext('2d').drawImage(picture, (side - wide) / 2, (side - high) / 2, wide, high);
    picture.close();
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Wakes My notes on a reel's page, for reel `id`. Gives back { ready(), gone() }: the page
 * says when the reel can be followed (it is ready to play), or has gone or failed.
 */
export function startNotes(id, { first = false } = {}) {
  const panel = document.getElementById('mynotes');
  if (!panel) return { ready() {}, gone() {} };
  const list = document.getElementById('mynotes-list'), form = document.getElementById('mynotes-add'), box = document.getElementById('mynotes-box');
  const mic = document.getElementById('mynotes-mic'), saver = document.getElementById('mynotes-save'), make = document.getElementById('mynotes-make'), says = document.getElementById('mynotes-says');
  const filer = document.getElementById('mynotes-file'), files = document.getElementById('mynotes-files');
  const paper = document.getElementById('mynotes-paper'), crossed = document.getElementById('mynotes-cross');
  const storage = deviceStorage();
  let notes = readNotes(storage, id), followable = false, busy = false;
  let clipped = null;     // the photo or PDF waiting with the notes: { file, type, name, thumb, after }, `after` being how many notes are above it
  let listening = null;   // the microphone, while it is on
  let micBusy = false;    // while the browser asks whether it may be used, and while the last words said are written down
  panel.hidden = false;

  const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text ? { textContent: text } : {});
  const button = (text, cls) => Object.assign(el('button', cls, text), { type: 'button' });
  /** A note's X, named for a screen reader by what it removes. */
  const cross = (removes) => {
    const remove = button('', 'mynotes-key mynotes-x');
    remove.setAttribute('aria-label', removes);
    remove.append(crossed.content.firstElementChild.cloneNode(true));
    return remove;
  };

  const keep = () => writeNotes(storage, id, notes);
  const full = () => notes.length >= NOTES_MAX;
  function settle() {
    const words = Boolean(box.value.trim());
    // What is still in the line goes with the rest; so does a note being said, once its last
    // words are written down. With nothing to make a reel from yet, the button is not gold,
    // but it can still be pressed: that puts the cursor in the line, which is what is wanted next.
    make.disabled = busy || !followable || micBusy;
    make.setAttribute('aria-disabled', String(!canMake({ notes: notes.length, clipped: Boolean(clipped), words })));
    box.disabled = full();
    box.placeholder = full() ? `${NOTES_MAX} notes is the most` : 'Add a note';
    const after = keyAfter({ words, hears, listening: Boolean(listening) || micBusy });
    const held = document.activeElement;
    mic.hidden = after !== 'mic';
    saver.hidden = after !== 'save';
    mic.disabled = full() || micBusy;
    saver.disabled = full();
    filer.disabled = busy;
    if ((held === mic && mic.hidden) || (held === saver && saver.hidden)) (after === 'mic' ? mic : after === 'save' ? saver : box).focus();   // the key in hand gave way to the other
  }

  function noteItem(note, at) {
    const item = el('li', 'mynotes-note'), words = el('p', null, note);
    const remove = cross(`Remove this note: ${note}`);
    item.append(words, remove);
    // taken off only once it is asked twice, since it cannot be put back
    remove.addEventListener('click', () => {
      const sure = el('div', 'mynotes-sure'), yes = button('Yes, remove it', 'btn btn-gold btn-small'), no = button('No, keep it', 'btn btn-paper btn-small');
      sure.append(el('p', null, 'Remove this note?'), yes, no);
      remove.replaceWith(sure);
      item.classList.add('is-asking');
      yes.focus({ preventScroll: true });
      item.scrollIntoView({ block: 'nearest' });   // the whole question, with both its answers
      no.addEventListener('click', () => draw(at));
      yes.addEventListener('click', () => {
        notes = notes.filter((_, i) => i !== at);
        if (clipped && at < clipped.after) clipped.after -= 1;
        keep();
        says.textContent = 'Note removed.';
        draw();
        box.focus();
      });
    });
    return item;
  }

  /** The photo or PDF, in the list where it was added. It is still in hand, so its X takes it off at once. */
  function clipItem() {
    const pdf = clipped.type === 'application/pdf', what = pdf ? 'PDF' : 'Photo';
    const item = el('li', 'mynotes-note is-file'), words = el('p', null, pdf ? clipped.name || what : what);
    const remove = cross(`Remove this ${pdf ? 'PDF' : 'photo'}`);
    item.append(clipped.thumb ?? paper.content.firstElementChild.cloneNode(true), words, remove);
    remove.addEventListener('click', () => {
      clipped = null;
      says.textContent = `${what} removed.`;
      draw();
      box.focus();
    });
    return item;
  }

  function draw(focus = null) {
    const items = notes.map(noteItem);
    if (clipped) items.splice(Math.min(clipped.after, items.length), 0, clipItem());
    list.replaceChildren(...items);
    settle();
    if (focus !== null) list.querySelectorAll('.mynotes-note:not(.is-file) .mynotes-x')[focus]?.focus();
  }

  function save() {
    const note = tidyNote(box.value, { first });
    box.value = '';
    grow();
    if (!note || full()) { settle(); return; }
    notes = [...notes, note];
    if (!keep()) says.textContent = 'This browser will not keep notes, so they go when the page is left.';
    else says.textContent = '';
    draw();
    list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  // The line grows with what is in it, up to a few lines, then scrolls. Empty, it is as tall
  // as the words that say what it is for, which take two lines on a small phone with the
  // biggest letters (a browser does not count those words, so they are put in to be measured).
  const grow = () => {
    const empty = !box.value;
    if (empty) box.value = box.placeholder;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 240)}px`;
    if (empty) box.value = '';
  };
  box.addEventListener('input', () => { grow(); settle(); });
  // and it is measured again when its width or its letters change (the screen is turned, Make it comfy, a font arriving)
  if (typeof ResizeObserver === 'function') new ResizeObserver(grow).observe(form);
  new MutationObserver(grow).observe(document.documentElement, { attributes: true, attributeFilter: ['data-font', 'data-size', 'data-space'] });
  document.fonts?.ready.then(grow);

  // Enter saves the note; Shift and Enter starts a new line in it
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (listening) stopListening({ thenSave: true });
    else save();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (listening) stopListening({ thenSave: true });
    else save();
    box.focus();
  });

  // Said aloud: the words are written into the line as they are heard, and the note is
  // saved when the microphone is pressed again, or Enter is. The browser's own speech
  // recognition hears it where it works; elsewhere (Brave, Firefox) the page records it and
  // the service writes it down (site/js/hearing.js), where the service can.
  const Speech = speechHere(), serviceHears = panel.closest('[data-mic]')?.dataset.mic === 'on' && canRecord();
  const hears = Boolean(Speech || serviceHears);
  let useService = !Speech, before = '', saveAfter = false, makeAfter = false;
  /** What the microphone does when pressed, for a screen reader and for a mouse held over it: it has no word on it. */
  const nameMic = (does) => { mic.setAttribute('aria-label', does); mic.title = does; };
  const show = (said) => {
    box.value = `${before} ${said}`.trim().slice(0, first ? TEXT_MAX : NOTE_MAX);
    grow();
    box.scrollTop = box.scrollHeight;
    settle();   // with words heard, there is something to make a reel from
  };
  const NO_MIC = 'The microphone is switched off for this page. Type the note instead.', NOT_HEARD = 'That could not be heard. Type the note instead.';
  function stopListening({ thenSave = false } = {}) {
    saveAfter = saveAfter || thenSave;
    listening?.stop();
  }
  function stopped() {
    listening = null;
    micBusy = false;
    mic.classList.remove('on');
    mic.setAttribute('aria-pressed', 'false');
    nameMic('Speak');
    panel.classList.remove('is-listening');
    if (saveAfter) save();
    saveAfter = false;
    settle();
    if (makeAfter) { makeAfter = false; if (!make.disabled && canMake({ notes: notes.length, clipped: Boolean(clipped) })) makeFrom(notes, clipped); }
  }
  function on(listener) {
    listening = listener;
    micBusy = false;
    says.textContent = '';
    mic.classList.add('on');
    mic.setAttribute('aria-pressed', 'true');
    nameMic('Done');
    panel.classList.add('is-listening');
    settle();
  }

  function listenInBrowser() {
    const heard = new Speech();
    heard.lang = navigator.language || 'en-GB';   // the speaker's own English (en-IE, en-GB), which hears an accent better
    heard.continuous = true;
    heard.interimResults = true;
    heard.onresult = (event) => show([...event.results].map((result) => result[0].transcript).join('').replace(/\s+/g, ' '));
    heard.onerror = (event) => {
      // a browser with the name and no service behind it: the service hears instead, from now on
      if (event.error === 'network' && serviceHears && !useService) { useService = true; heard.onend = null; listening = null; stopped(); listenWithService(); return; }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') says.textContent = NO_MIC;
      else if (event.error !== 'aborted' && event.error !== 'no-speech') says.textContent = NOT_HEARD;
    };
    heard.onend = () => { if (listening === heard) stopped(); };
    try { heard.start(); } catch { return; }
    on(heard);
  }

  async function listenWithService() {
    micBusy = true;   // while the browser asks whether the microphone may be used
    settle();
    let recording, held = null;
    try {
      recording = await recordForService({ onText: (said) => { if (listening === held) show(said); } });
    } catch (err) {
      micBusy = false;
      says.textContent = err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? NO_MIC : NOT_HEARD;
      settle();
      return;
    }
    held = {
      stop: async () => {
        if (held.stopping) return;
        held.stopping = true;
        micBusy = true;   // the last few words are still being written down
        nameMic('One moment');
        settle();
        try {
          show(await recording.stop());
        } catch {
          says.textContent = NOT_HEARD;
        }
        if (listening === held) stopped();
      }
    };
    on(held);
  }

  mic.addEventListener('click', () => {
    if (listening) { stopListening({ thenSave: true }); return; }
    before = box.value.trim();
    if (useService) listenWithService();
    else listenInBrowser();
  });

  // the next reel: made from these notes, and the photo or PDF with them, with the chain that led here (on the make page, the visitor's first)
  async function makeFrom(given, clip = null) {
    busy = true;
    settle();
    says.textContent = 'One moment.';
    try {
      const data = clip ? await base64Of(clip.file) : null;
      const res = await fetch('/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(noteRequest(id, given, { first, storage, data })) });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok || !answer.watch) throw new Error(answer.error || 'That did not work. Try again in a minute.');
      rememberMine(mineStorage(), answer);
      location.assign(answer.watch);
    } catch (err) {
      says.textContent = err instanceof TypeError ? (navigator.onLine === false ? 'You are not online. Check your internet, then try again.' : 'That did not work. Try again in a minute.') : err.message;
      busy = false;
      settle();
    }
  }
  let clipping = Promise.resolve();   // a photo or PDF that is still being looked at: the reel waits for it
  make.addEventListener('click', async () => {
    await clipping;
    // pressed while a note is being said: the note is finished and saved first, then the reel is made
    if (listening) { makeAfter = true; stopListening({ thenSave: true }); return; }
    if (box.value.trim()) save();   // what is still in the line is a note too
    if (canMake({ notes: notes.length, clipped: Boolean(clipped) })) makeFrom(notes, clipped);
    else box.focus();   // nothing to make a reel from yet: here is where to write it
  });

  // A photo or a PDF, chosen with the paperclip (or taken, on a phone), dropped on the page
  // or pasted into the line: it waits in the list, like a note, until the reel is made. One
  // at a time: another takes its place. A file of plain writing is its words, so it is a note.
  async function clip(file, { andMake = false } = {}) {
    says.textContent = '';
    let held;
    try {
      held = await fileGiven(file, { shrink: shrinkPicture });
    } catch (err) {
      says.textContent = err instanceof GivenError ? err.message : 'That could not be read. Try another.';
      return;
    }
    if (held.file) {
      clipped = { file: held.file, type: held.type, name: file.name ?? '', thumb: held.type === 'application/pdf' ? null : await thumbOf(held.file), after: clipped?.after ?? notes.length };
      draw();
      list.querySelector('.is-file')?.scrollIntoView({ block: 'nearest' });
    } else {
      box.value = held.words;
      save();
    }
    if (andMake && canMake({ notes: notes.length, clipped: Boolean(clipped) })) makeFrom(notes, clipped);
  }
  /** Clips `file` on, and has the button that makes the reel wait until it is. */
  const clipOn = (file, more) => { clipping = clip(file, more); return clipping; };
  filer.addEventListener('click', () => files.click());
  files.addEventListener('change', () => {
    const [file] = files.files;
    files.value = '';   // so the same file can be chosen again
    if (file) clipOn(file);
  });
  // anything dropped on the page: a photo or a PDF is clipped on, a link or some words become a note
  const page = panel.closest('section');
  page?.addEventListener('dragover', (e) => e.preventDefault());
  page?.addEventListener('drop', (e) => {
    const given = givenFrom(e.dataTransfer);
    if (!given) return;
    e.preventDefault();
    if (given.file) clipOn(given.file);
    else add(given.words);
  });
  // a picture pasted into the line (a screenshot, say) is clipped on; words are pasted as words
  box.addEventListener('paste', (e) => {
    const given = givenFrom(e.clipboardData, { words: true });
    if (!given?.file) return;
    e.preventDefault();
    clipOn(given.file);
  });
  // things to try, on the make page when its reel ends: one press makes a reel of that, and nothing else
  for (const suggestion of document.querySelectorAll('button[data-suggest]')) {
    suggestion.addEventListener('click', () => { if (!busy) makeFrom([suggestion.dataset.suggest]); });
  }
  // coming back to this page with Back finds the button ready again
  addEventListener('pageshow', (e) => { if (e.persisted) { busy = false; says.textContent = ''; settle(); } });

  /** Adds a note, as if it had been typed in and saved; with `andMake`, makes the reel at once. */
  function add(words, { andMake = false } = {}) {
    box.value = words;
    save();
    if (andMake && notes.length) makeFrom(notes, clipped);
  }

  draw();
  grow();
  return {
    ready() { followable = true; settle(); },
    gone() { stopListening(); panel.hidden = true; },
    add,
    /** Clips a photo or a PDF to the notes; with `andMake`, makes the reel at once (something shared from a phone). */
    file: clipOn
  };
}

/**
 * The make page: a reel about how to make one, with My notes beside it. Where the service
 * cannot write a reel itself, the way to make one is through Claude instead. Gives back the
 * notes (see startNotes), or null.
 */
export function startMaking() {
  const panel = document.getElementById('mynotes');
  if (!panel?.hasAttribute('data-first')) return null;
  if (panel.closest('[data-here]')?.dataset.here !== 'on') {
    document.getElementById('make-elsewhere').hidden = false;
    for (const suggestion of document.querySelectorAll('.suggest')) suggestion.hidden = true;
    return null;
  }
  const notes = startNotes('make', { first: true });
  notes.ready();
  return notes;
}
