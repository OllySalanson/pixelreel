// Make a pixel reel now: turns what someone wants explained into the words to give to
// Claude, to copy across. Nothing is sent anywhere; Claude and the connector do the making.
// Where the service has Make it right here switched on, a second button asks it for the reel.
import { copyText } from './send.js';

const EXAMPLE = 'my gas bill';

/** The words to say to Claude for `what`: a web address, or a few words. */
export function askFor(what) {
  const about = what.trim().replace(/\s+/g, ' ') || EXAMPLE;
  return /^(https?:\/\/|www\.)\S+$/i.test(about) ? `Make me a pixel reel about this page: ${about}` : `Make me a pixel reel about this: ${about}`;
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
  const input = form.querySelector('input'), words = document.getElementById('ask-words'), open = document.getElementById('ask-open');
  const update = () => {
    const ask = askFor(input.value);
    words.textContent = ask;
    open.href = `https://claude.ai/new?q=${encodeURIComponent(ask)}`;
    form.querySelector('.said').textContent = '';
  };
  input.addEventListener('input', update);
  for (const chip of form.querySelectorAll('[data-try]')) {
    chip.addEventListener('click', () => { input.value = chip.dataset.try; update(); });
  }
  // Enter in the box copies the words, the same as the first button
  form.addEventListener('submit', (e) => { e.preventDefault(); form.querySelector('button[data-copy]').click(); });
  update();
  if (form.dataset.here === 'on') makeHere(form, input);
}

/**
 * Make it right here, shown only when the service says it can write a reel itself: asks it
 * for one about what is in the box, then goes to the reel's page, which waits for the voice.
 */
function makeHere(form, input) {
  const box = document.getElementById('maker-here'), button = box.querySelector('button'), said = form.querySelector('.said');
  box.hidden = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    said.textContent = 'Claude is writing the scenes. This takes about half a minute.';
    try {
      const res = await fetch('/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ about: input.value.trim() || EXAMPLE }) });
      const answer = await res.json();
      if (!res.ok) throw new Error(answer.error);
      said.textContent = 'Written. Off we go.';
      location.assign(answer.watch);
    } catch (err) {
      said.textContent = err.message || 'That did not work. Try again in a minute.';
      button.disabled = false;
    }
  });
}
