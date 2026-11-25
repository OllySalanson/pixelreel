// My notes, beside a shared reel: questions and thoughts about it, typed or said aloud, kept
// on this device, and then one button that has Claude make the next reel from them. The
// service tells Claude the whole chain of reels that led here, with the notes each was made
// from (service/writer.mjs), so the next reel answers them in context.
import { deviceStorage, mineStorage, rememberMine } from './mine.js';
import { NOTE_MAX, NOTES_MAX } from './given.js';

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

/** A note as it is kept: one line, no longer than a note may be. Empty for nothing worth keeping. */
export const tidyNote = (words) => String(words ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

/**
 * How the microphone hears a note, in this browser: the browser's own speech recognition,
 * or null where it has none that works. Brave has the name but no service behind it: every
 * go ends in a network error, so it is treated as having none.
 */
export function speechHere(scope = globalThis) {
  if (scope.navigator?.brave) return null;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/**
 * Wakes My notes on a reel's page, for reel `id`. Gives back { ready(), gone() }: the page
 * says when the reel can be followed (it is ready to play), or has gone or failed.
 */
export function startNotes(id) {
  const panel = document.getElementById('mynotes');
  if (!panel) return { ready() {}, gone() {} };
  const list = document.getElementById('mynotes-list'), form = document.getElementById('mynotes-add'), box = document.getElementById('mynotes-box');
  const mic = document.getElementById('mynotes-mic'), make = document.getElementById('mynotes-make'), says = document.getElementById('mynotes-says');
  const storage = deviceStorage();
  let notes = readNotes(storage, id), followable = false, busy = false;
  panel.hidden = false;

  const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text ? { textContent: text } : {});
  const button = (text, cls) => Object.assign(el('button', cls, text), { type: 'button' });

  const keep = () => writeNotes(storage, id, notes);
  const full = () => notes.length >= NOTES_MAX;
  function settle() {
    make.disabled = busy || !followable || notes.length === 0;
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
    const note = tidyNote(box.value);
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
  // saved when the microphone is pressed again, or Enter is
  const Speech = speechHere();
  let listening = null, before = '', saveAfter = false;
  mic.hidden = !Speech;
  const micLabel = mic.querySelector('span');
  function stopListening({ thenSave = false } = {}) {
    saveAfter = saveAfter || thenSave;
    listening?.stop();
  }
  function stopped() {
    listening = null;
    mic.classList.remove('on');
    mic.setAttribute('aria-pressed', 'false');
    micLabel.textContent = 'Speak';
    panel.classList.remove('is-listening');
    if (saveAfter) save();
    saveAfter = false;
  }
  mic.addEventListener('click', () => {
    if (listening) { stopListening({ thenSave: true }); return; }
    const heard = new Speech();
    heard.lang = navigator.language || 'en-GB';   // the speaker's own English (en-IE, en-GB), which hears an accent better
    heard.continuous = true;
    heard.interimResults = true;
    before = box.value.trim();
    heard.onresult = (event) => {
      const said = [...event.results].map((result) => result[0].transcript).join('').replace(/\s+/g, ' ').trim();
      box.value = `${before} ${said}`.trim().slice(0, NOTE_MAX);
      grow();
      box.scrollTop = box.scrollHeight;
    };
    heard.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') says.textContent = 'The microphone is switched off for this page. Type the note instead.';
      else if (event.error !== 'aborted' && event.error !== 'no-speech') says.textContent = 'That could not be heard. Type the note instead.';
    };
    heard.onend = () => { if (listening === heard) stopped(); };
    try { heard.start(); } catch { return; }
    listening = heard;
    says.textContent = '';
    mic.classList.add('on');
    mic.setAttribute('aria-pressed', 'true');
    micLabel.textContent = 'Done';
    panel.classList.add('is-listening');
  });

  // the next reel: made from these notes, with the chain that led here
  make.addEventListener('click', async () => {
    if (listening) stopListening({ thenSave: true });
    busy = true;
    settle();
    says.textContent = 'One moment.';
    try {
      const res = await fetch('/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ next: id, notes }) });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok || !answer.watch) throw new Error(answer.error || 'That did not work. Try again in a minute.');
      rememberMine(mineStorage(), answer);
      location.assign(answer.watch);
    } catch (err) {
      says.textContent = err instanceof TypeError ? (navigator.onLine === false ? 'You are not online. Check your internet, then try again.' : 'That did not work. Try again in a minute.') : err.message;
      busy = false;
      settle();
    }
  });
  // coming back to this page with Back finds the button ready again
  addEventListener('pageshow', (e) => { if (e.persisted) { busy = false; says.textContent = ''; settle(); } });

  draw();
  grow();
  return {
    ready() { followable = true; settle(); },
    gone() { stopListening(); panel.hidden = true; }
  };
}
