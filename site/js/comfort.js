// Make it comfy: lets a reader change the letters, their size and spacing, the colour of the
// paper, whether pictures move, how fast Peter reads, whether every word he says is written
// under the pictures, whether a ruler keeps their place, and whether a press on any words
// reads them aloud (aloud.js). Each choice is an attribute on
// <html> that site.css answers to (or the players, for Peter's pace and his words: see
// pace.js and player.js; or ruler.js). Choices are kept on this device only (boot.js puts them back before the page
// is drawn), and nothing is ever sent anywhere.
const DEFAULTS = { font: 'lexend', size: '1', space: '1', paper: 'cream', motion: 'on', pace: 'usual', words: 'few', ruler: 'off', aloud: 'off' };
const KEYS = Object.keys(DEFAULTS);
const root = () => document.documentElement;   // asked for when needed, so that Node can load this to test it

/**
 * What a "try it" button for `key` and `value` leaves that setting at, given what is
 * `chosen` now: its value, or the usual one if it was already that (a second press puts it back).
 */
export const tried = (chosen, key, value) => (chosen[key] === value ? DEFAULTS[key] : value);

const chosen = () => Object.fromEntries(KEYS.map((key) => [key, root().dataset[key] ?? DEFAULTS[key]]));

function keep() {
  const changed = Object.fromEntries(Object.entries(chosen()).filter(([key, value]) => value !== DEFAULTS[key]));
  try {
    if (Object.keys(changed).length) localStorage.setItem('pixelreel-comfort', JSON.stringify(changed));
    else localStorage.removeItem('pixelreel-comfort');
  } catch {
    // nowhere to keep it (private browsing, say): it still lasts until the page is closed
  }
  dispatchEvent(new Event('comfort'));
}

export function startComfort() {
  const dialog = document.getElementById('comfort');
  if (!dialog) return;
  const tick = () => {
    for (const [key, value] of Object.entries(chosen())) {
      const input = dialog.querySelector(`input[name="${key}"][value="${value}"]`);
      if (input) input.checked = true;
    }
  };
  dialog.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (!KEYS.includes(name)) return;
    if (value === DEFAULTS[name]) delete root().dataset[name]; else root().dataset[name] = value;
    keep();
  });
  dialog.querySelector('[data-comfort-reset]').addEventListener('click', () => {
    for (const key of KEYS) delete root().dataset[key];
    tick();
    keep();
  });
  // a press on the dimmed page beside the panel closes it
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  for (const opener of document.querySelectorAll('[data-open="comfort"]')) {
    opener.addEventListener('click', () => { tick(); dialog.showModal(); });
  }
  // The buttons on a page that switch one choice on, and off again: <button data-comfy-try="size:2">.
  // Each shows whether its choice is the one in force, however that came about. (The name is
  // its own: the make page's "Or try one of these" buttons are data-try, and are maker.js's.)
  const tries = [...document.querySelectorAll('button[data-comfy-try]')].map((button) => [button, ...button.dataset.comfyTry.split(':')]);
  const show = () => {
    const now = chosen();
    for (const [button, key, value] of tries) button.setAttribute('aria-pressed', String(now[key] === value));
  };
  for (const [button, key, value] of tries) {
    button.addEventListener('click', () => {
      const next = tried(chosen(), key, value);
      if (next === DEFAULTS[key]) delete root().dataset[key]; else root().dataset[key] = next;
      keep();
    });
  }
  addEventListener('comfort', show);
  show();
  for (const part of document.querySelectorAll('[data-comfy]')) part.hidden = false;
}
