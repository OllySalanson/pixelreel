// My notes, beside a shared reel: questions and thoughts about it, typed or said aloud, kept
// on this device, and then one button that has Claude make the next reel from them. The
// service tells Claude the whole chain of reels that led here, with the notes each was made
// from (service/writer.mjs), so the next reel answers them in context.
import { deviceStorage, mineStorage, rememberMine } from './mine.js';
import { givenFrom, NOTE_MAX, NOTES_MAX, requestFor, TEXT_MAX } from './given.js';
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
 * chosen last (the service keeps a reel it follows in that reel's own).
 */
export function noteRequest(id, notes, { first = false, storage = null } = {}) {
  if (!first) return { next: id, notes };
  let language = null;
  try { language = storage?.getItem(LANGUAGE) || null; } catch { /* nothing kept */ }
  return { notes, ...(language && language !== 'english' ? { language } : {}), ...(storage && readNarrator(storage) ? { narrator: readNarrator(storage) } : {}) };
}

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

/**
 * Wakes My notes on a reel's page, for reel `id`. Gives back { ready(), gone() }: the page
 * says when the reel can be followed (it is ready to play), or has gone or failed.
 */
export function startNotes(id, { first = false } = {}) {
  const panel = document.getElementById('mynotes');
  if (!panel) return { ready() {}, gone() {} };
  const list = document.getElementById('mynotes-list'), form = document.getElementById('mynotes-add'), box = document.getElementById('mynotes-box');
  const mic = document.getElementById('mynotes-mic'), make = document.getElementById('mynotes-make'), says = document.getElementById('mynotes-says');
  const storage = deviceStorage();
  let notes = readNotes(storage, id), followable = false, busy = false, listening = null;   // listening: the microphone, while it is on
  panel.hidden = false;

  const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text ? { textContent: text } : {});
  const button = (text, cls) => Object.assign(el('button', cls, text), { type: 'button' });

  const keep = () => writeNotes(storage, id, notes);
  const full = () => notes.length >= NOTES_MAX;
  function settle() {
    make.disabled = busy || !followable || notes.length === 0 || Boolean(listening);   // a note being said is saved first
    box.disabled = full();
    box.placeholder = full() ? `${NOTES_MAX} notes is the most` : 'Add a note';
    for (const key of form.querySelectorAll('button')) key.disabled = full();
  }

  function draw(focus = null) {
    list.replaceChildren(...notes.map((note, at) => {
      const item = el('li', 'mynotes-note'), words = el('p', null, note);
      const remove = button('', 'mynotes-x');
      remove.setAttribute('aria-label', `Remove this note: ${note}`);
      remove.append(Object.assign(el('span', null, 'X'), { ariaHidden: 'true' }));
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
          keep();
          says.textContent = 'Note removed.';
          draw();
          box.focus();
        });
      });
      return item;
    }));
    settle();
    if (focus !== null) list.children[focus]?.querySelector('.mynotes-x')?.focus();
  }

  function save() {
    const note = tidyNote(box.value, { first });
    box.value = '';
    grow();
    if (!note || full()) return;
    notes = [...notes, note];
    if (!keep()) says.textContent = 'This browser will not keep notes, so they go when the page is left.';
    else says.textContent = '';
    draw();
    list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  // the box grows with what is in it, up to a few lines, then scrolls
  const grow = () => {
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight + 2, 240)}px`;
  };
  box.addEventListener('input', grow);

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

  // Said aloud: the words are written into the box as they are heard, and the note is
  // saved when the microphone is pressed again, or Enter is. The browser's own speech
  // recognition hears it where it works; elsewhere (Brave, Firefox) the page records it and
  // the service writes it down (site/js/hearing.js), where the service can.
  const Speech = speechHere(), serviceHears = panel.closest('[data-mic]')?.dataset.mic === 'on' && canRecord();
  let useService = !Speech, before = '', saveAfter = false;
  mic.hidden = !(Speech || serviceHears);
  const micLabel = mic.querySelector('span');
  const show = (said) => {
    box.value = `${before} ${said}`.trim().slice(0, first ? TEXT_MAX : NOTE_MAX);
    grow();
    box.scrollTop = box.scrollHeight;
  };
  const NO_MIC = 'The microphone is switched off for this page. Type the note instead.', NOT_HEARD = 'That could not be heard. Type the note instead.';
  function stopListening({ thenSave = false } = {}) {
    saveAfter = saveAfter || thenSave;
    listening?.stop();
  }
  function stopped() {
    listening = null;
    mic.disabled = false;
    mic.classList.remove('on');
    mic.setAttribute('aria-pressed', 'false');
    micLabel.textContent = 'Speak';
    panel.classList.remove('is-listening');
    if (saveAfter) save();
    saveAfter = false;
    settle();
  }
  function on(listener) {
    listening = listener;
    says.textContent = '';
    mic.classList.add('on');
    mic.setAttribute('aria-pressed', 'true');
    micLabel.textContent = 'Done';
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
    mic.disabled = true;   // while the browser asks whether the microphone may be used
    let recording, held = null;
    try {
      recording = await recordForService({ onText: (said) => { if (listening === held) show(said); } });
    } catch (err) {
      mic.disabled = false;
      says.textContent = err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? NO_MIC : NOT_HEARD;
      return;
    }
    mic.disabled = false;
    held = {
      stop: async () => {
        if (held.stopping) return;
        held.stopping = true;
        mic.disabled = true;   // the last few words are still being written down
        micLabel.textContent = 'One moment';
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

  // the next reel: made from these notes, with the chain that led here (on the make page, the visitor's first)
  async function makeFrom(given) {
    busy = true;
    settle();
    says.textContent = 'One moment.';
    try {
      const res = await fetch('/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(noteRequest(id, given, { first, storage })) });
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
  make.addEventListener('click', () => makeFrom(notes));
  // on the make page: a PDF or a photo, chosen (or taken, on a phone), made into a reel at once
  const filer = document.getElementById('mynotes-file'), files = document.getElementById('mynotes-files');
  filer?.addEventListener('click', () => files.click());
  files?.addEventListener('change', () => {
    const [file] = files.files;
    files.value = '';   // so the same file can be chosen again
    if (file) makeFromFile(file);
  });
  // a PDF or a photo (shared from a phone, or dropped on the make page) is made into a reel at once, as it is
  async function makeFromFile(file) {
    busy = true;
    settle();
    says.textContent = 'One moment.';
    try {
      const { narrator, language } = noteRequest(id, [], { first: true, storage });
      const request = await requestFor({ file }, { shrink: shrinkPicture, language, narrator });
      const res = await fetch('/try', { method: 'POST', ...request });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok || !answer.watch) throw new Error(answer.error || 'That did not work. Try again in a minute.');
      rememberMine(mineStorage(), answer);
      location.assign(answer.watch);
    } catch (err) {
      says.textContent = err instanceof TypeError ? 'That did not work. Try again in a minute.' : err.message;
      busy = false;
      settle();
    }
  }
  // things to try, on the make page when its reel ends: one press makes a reel of that, and nothing else
  for (const suggestion of document.querySelectorAll('button[data-suggest]')) {
    suggestion.addEventListener('click', () => { if (!busy) makeFrom([suggestion.dataset.suggest]); });
  }
  // coming back to this page with Back finds the button ready again
  addEventListener('pageshow', (e) => { if (e.persisted) { busy = false; says.textContent = ''; settle(); } });

  draw();
  grow();
  return {
    ready() { followable = true; settle(); },
    gone() { stopListening(); panel.hidden = true; },
    /** Adds a note, as if it had been typed in and saved; with `andMake`, makes the reel at once. */
    add(words, { andMake = false } = {}) {
      box.value = words;
      save();
      if (andMake && notes.length) makeFrom(notes);
    },
    /** Makes a reel of a file at once (a PDF or a picture). */
    file: makeFromFile
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
  // anything dropped on the page: a file is made into a reel, a link or some words become a note
  const page = panel.closest('section');
  page.addEventListener('dragover', (e) => e.preventDefault());
  page.addEventListener('drop', (e) => {
    const given = givenFrom(e.dataTransfer);
    if (!given) return;
    e.preventDefault();
    if (given.file) notes.file(given.file);
    else notes.add(given.words);
  });
  return notes;
}
