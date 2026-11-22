// Make it comfy: lets a reader change the letters, their size and spacing, the colour of the
// paper, and whether pictures move. Each choice is an attribute on <html> that site.css
// answers to. Choices are kept on this device only (boot.js puts them back before the page
// is drawn), and nothing is ever sent anywhere.
const DEFAULTS = { font: 'lexend', size: '1', space: '1', paper: 'cream', motion: 'on' };
const KEYS = Object.keys(DEFAULTS);
const root = document.documentElement;

const chosen = () => Object.fromEntries(KEYS.map((key) => [key, root.dataset[key] ?? DEFAULTS[key]]));

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
    if (value === DEFAULTS[name]) delete root.dataset[name]; else root.dataset[name] = value;
    keep();
  });
  dialog.querySelector('[data-comfort-reset]').addEventListener('click', () => {
    for (const key of KEYS) delete root.dataset[key];
    tick();
    keep();
  });
  // a press on the dimmed page beside the panel closes it
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  for (const opener of document.querySelectorAll('[data-open="comfort"]')) {
    opener.addEventListener('click', () => { tick(); dialog.showModal(); });
  }
}
