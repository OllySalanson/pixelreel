// Message in a Bottle, the button and what it opens: loaded by bottle.js only when this
// browser holds a key, and shown only once the service says the key is right. Press the
// button, click the part of the page the note is about (or choose the whole page), write or
// say the note, send. My notes shows what came of each, and turns the button off. With it go a screenshot of what was on the
// screen with that part outlined, the address, a CSS selector and the words of that part, the
// window's size and the browser. On a site's /review page it draws the box where someone on
// the site's list asks for a link instead (review()). Everything it draws is in a shadow root, styled through
// adoptedStyleSheets, so the page's own styles cannot reach it and a strict content security
// policy (no inline styles or scripts) does not stop it.

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.dock button, .banner, .panel, .toast, .card {
  position: fixed; z-index: 2147483647; font: 18px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #f8f7dd; background: #13203a; border: 3px solid #ffcc4d; border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
}
button { font: inherit; cursor: pointer; border-radius: 8px; min-height: 44px; padding: 6px 16px; border: 2px solid #ffcc4d; background: #0b1220; color: #f8f7dd; }
button:hover { background: #1d2d50; }
button:focus-visible, textarea:focus-visible { outline: 3px solid #7fd4ff; outline-offset: 2px; }
button.go { background: #ffcc4d; color: #0b1220; font-weight: 700; }
button.go:hover { background: #ffe08a; }
button:disabled { opacity: 0.6; cursor: wait; }
.dock {
  position: fixed; z-index: 2147483647; left: max(12px, env(safe-area-inset-left)); bottom: max(12px, env(safe-area-inset-bottom));
  display: flex; gap: 8px;
}
.dock button { position: static; display: flex; align-items: center; gap: 8px; padding: 6px 14px; min-height: 48px; font-weight: 700; }
.dock .bottle { padding-left: 10px; }
.dock button:hover { background: #1d2d50; }
.bottle svg { width: 26px; height: 26px; flex: none; }
.banner {
  left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: max-content; max-width: calc(100vw - 24px);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 12px; padding: 10px 14px;
}
.banner p { margin: 0; font-weight: 700; }
.ring {
  position: fixed; z-index: 2147483646; pointer-events: none; border: 3px solid #ffcc4d; border-radius: 4px;
  box-shadow: 0 0 0 3px rgba(11, 18, 32, 0.85), 0 0 0 9999px rgba(11, 18, 32, 0.18); transition: all 60ms linear;
}
.ring span {
  position: absolute; left: -3px; bottom: 100%; margin-bottom: 3px; padding: 0 6px; border-radius: 4px;
  font: 700 14px/1.6 ui-monospace, Menlo, Consolas, monospace; color: #0b1220; background: #ffcc4d; white-space: nowrap;
}
.ring.low span { bottom: auto; top: 100%; margin: 3px 0 0; }
.panel {
  left: 50%; transform: translateX(-50%); width: min(36rem, calc(100vw - 24px)); padding: 14px 16px 16px;
  display: flex; flex-direction: column; gap: 10px; bottom: max(12px, env(safe-area-inset-bottom));
}
.panel.up { bottom: auto; top: 12px; }
/* on a wide screen the box stands beside the part chosen, not over it */
@media (min-width: 860px) {
  .panel { width: min(26rem, 40vw); transform: none; left: auto; right: max(12px, env(safe-area-inset-right)); }
  .panel.left { right: auto; left: max(12px, env(safe-area-inset-left)); }
  .panel.up { bottom: max(12px, env(safe-area-inset-bottom)); top: auto; }
}
.panel h2 { margin: 0; font-size: 20px; color: #ffcc4d; }
.panel .about { margin: 0; color: #d9d8b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel textarea {
  width: 100%; min-height: 7.5em; max-height: 50vh; resize: vertical; padding: 10px 12px; border-radius: 8px;
  font: 20px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0b1220; background: #fdfcf0; border: 2px solid #ebeac5;
}
.panel .row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; align-items: center; }
.panel .row .speak { margin-right: auto; }
.speak.on { background: #ff2d55; border-color: #ff2d55; color: #fff; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; max-height: min(60vh, 30rem); overflow-y: auto; scrollbar-color: #3a4d78 transparent; }
.list li { padding: 10px 12px; border-radius: 8px; background: #0b1220; display: flex; flex-direction: column; gap: 6px; }
.list p { margin: 0; overflow-wrap: anywhere; }
.list .words { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.list .said { color: #d9d8b8; }
.list button { align-self: flex-start; }
.chip { align-self: flex-start; padding: 0 10px; border-radius: 999px; font-size: 15px; font-weight: 700; line-height: 1.7; color: #0b1220; background: #d9d8b8; }
.chip.done, .chip.closed { background: #8ee6a0; }
.chip.declined { background: #ffb4a8; }
.chip.in-progress { background: #7fd4ff; }
.empty { margin: 0; color: #d9d8b8; }
.review { position: fixed; inset: 0; z-index: 2147483646; background: #0b1220; display: grid; place-items: center; padding: 16px; overflow-y: auto; }
.card { position: static; width: min(28rem, 100%); padding: 22px 20px 20px; display: flex; flex-direction: column; gap: 14px; }
.card h1 { margin: 0; font-size: 26px; line-height: 1.25; color: #ffcc4d; }
.card p { margin: 0; }
.card label { display: flex; flex-direction: column; gap: 6px; font-weight: 700; }
.card input {
  font: 20px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; min-height: 48px; padding: 8px 12px; border-radius: 8px;
  color: #0b1220; background: #fdfcf0; border: 2px solid #ebeac5; width: 100%;
}
.card input:focus-visible { outline: 3px solid #7fd4ff; outline-offset: 2px; }
.card .row { display: flex; flex-wrap: wrap; gap: 10px; }
.card .row > * { flex: 1 1 auto; }
.card a.go { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 6px 16px; border-radius: 8px; font-weight: 700; text-decoration: none; background: #ffcc4d; color: #0b1220; border: 2px solid #ffcc4d; }
.card a.go:focus-visible { outline: 3px solid #7fd4ff; outline-offset: 2px; }
.card .error { color: #ffb4a8; font-weight: 700; }
.panel .error { margin: 0; color: #ffb4a8; font-weight: 700; }
.toast { left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 10px 18px; font-weight: 700; }
[hidden] { display: none !important; }
`;

const SVG = 'http://www.w3.org/2000/svg';

/** A small bottle with a rolled note in it, drawn with no markup, so no policy stops it. */
function bottleIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shape = (name, attrs) => {
    const el = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  };
  shape('rect', { x: '9.5', y: '1.5', width: '5', height: '3', rx: '1', fill: '#c98a4b' });
  shape('path', { d: 'M10 4.5h4v3.2c2.6 1 4 3 4 5.6V20a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 20v-6.7c0-2.6 1.4-4.6 4-5.6z', fill: '#7fd4ff', 'fill-opacity': '0.35', stroke: '#f8f7dd', 'stroke-width': '1.5' });
  shape('rect', { x: '9', y: '12', width: '6', height: '7', rx: '1', fill: '#f8f7dd', transform: 'rotate(-12 12 15.5)' });
  shape('path', { d: 'M10.4 14.2l3.4-.7M10.7 16l3.4-.7', stroke: '#13203a', 'stroke-width': '0.9' });
  return svg;
}

const make = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
};

/**
 * A CSS selector that finds `el` again: from the nearest ancestor with an id only it has (or
 * from <body>), each step a tag, numbered among its kind where it has brothers and sisters.
 */
export function selectorOf(el, doc = document) {
  if (!el || el === doc.documentElement) return 'html';
  const parts = [];
  for (let node = el; node && node.nodeType === 1 && node !== doc.documentElement; node = node.parentElement) {
    if (node.id && doc.querySelectorAll(`#${globalThis.CSS.escape(node.id)}`).length === 1) {
      parts.unshift(`#${globalThis.CSS.escape(node.id)}`);
      break;
    }
    let part = node.localName;
    const kin = node.parentElement ? [...node.parentElement.children].filter((c) => c.localName === node.localName) : [];
    if (kin.length > 1) part += `:nth-of-type(${kin.indexOf(node) + 1})`;
    parts.unshift(part);
  }
  return parts.join(' > ');
}

/** The words a part shows, in one line: what it says, or failing that how it is labelled. */
const wordsOf = (el) => (el.innerText || el.getAttribute?.('aria-label') || el.getAttribute?.('alt') || el.getAttribute?.('title') || el.value || '')
  .replace(/\s+/g, ' ').trim().slice(0, 1000);

/** What a part is, said briefly: its tag and the start of its words. */
const describe = (el, whole) => {
  if (whole) return 'The whole page';
  const words = wordsOf(el);
  return `<${el.localName}>${words ? ` "${words.length > 60 ? `${words.slice(0, 60)}...` : words}"` : ''}`;
};

/** Bytes as a data URL, for a font or picture the screenshot needs inside itself. */
const dataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/**
 * The @font-face rules of every font the page has loaded, each with its file inside it, for
 * the screenshot: a picture drawn from the page cannot fetch fonts of its own. (Left to
 * itself, modern-screenshot gathers these through a <style> element, which a strict content
 * security policy stops.)
 */
async function fontCss() {
  const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/^["']|["']$/g, '')));
  const faces = [];
  const walk = (rules, href) => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        if (loaded.has(rule.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, ''))) faces.push([rule, href]);
      } else if (rule.cssRules) walk(rule.cssRules, href);
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, sheet.href ?? location.href); } catch { /* another site's styles cannot be read */ }
  }
  const css = await Promise.all(faces.map(async ([rule, href]) => {
    let text = rule.cssText;
    for (const [whole, , url] of text.matchAll(/url\((["']?)([^"')]+)\1\)/g)) {
      if (url.startsWith('data:')) continue;
      try {
        const res = await fetch(new URL(url, href));
        if (res.ok) text = text.replace(whole, `url("${await dataUrl(await res.blob())}")`);
      } catch { /* that font is drawn in another */ }
    }
    return text;
  }));
  return css.join('\n');
}

/** The parts of the page on the screen that do not scroll with it (position fixed or sticky), outermost only, leaving out `host`. */
function pinned(host) {
  const found = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el === host || found.some((outer) => outer.contains(el))) continue;
    const position = getComputedStyle(el).position;
    if (position !== 'fixed' && position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) found.push(el);
  }
  return found;
}

/**
 * A screenshot of what was on the screen, as a JPEG data URL, with `rect` (where the chosen
 * part was, in the window) outlined. Made in the browser from the page itself
 * (modern-screenshot, served beside this as shot.mjs), leaving out `host`. Null if it cannot be made.
 */
async function shoot(base, host, rect) {
  try {
    const { domToCanvas } = await import(new URL('shot.mjs', base).href);
    const width = innerWidth, height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 2, 2400 / width);
    // the page is drawn as big as the window, as far down as it was scrolled, so it shows what was seen
    const font = { cssText: await fontCss() };
    const leaveOut = (node) => node !== host && node.nodeName !== 'NOSCRIPT';
    const page = await domToCanvas(document.documentElement, {
      width, height, scale, timeout: 8000, font, filter: leaveOut,
      backgroundColor: [document.body, document.documentElement].map((el) => getComputedStyle(el).backgroundColor).find((c) => c && !/^(transparent|rgba\(.*,\s*0\))$/.test(c)) ?? '#ffffff',
      features: { restoreScrollPosition: true }
    });
    const ctx = page.getContext('2d');
    // what stays put while the page scrolls (a bar across the top, say) is drawn where it was seen, not where it sits in the page
    for (const el of pinned(host)) {
      const r = el.getBoundingClientRect();
      try {
        const part = await domToCanvas(el, { scale, timeout: 4000, font, filter: leaveOut });
        ctx.drawImage(part, r.left * scale, r.top * scale, r.width * scale, r.height * scale);
      } catch { /* drawn where it sits in the page, then */ }
    }
    if (rect) {
      ctx.lineWidth = 4 * scale;
      ctx.strokeStyle = '#ff2d55';
      ctx.strokeRect((rect.x - 3) * scale, (rect.y - 3) * scale, (rect.width + 6) * scale, (rect.height + 6) * scale);
    }
    return page.toDataURL('image/jpeg', 0.8);
  } catch (err) {
    console.warn('bottle: the screenshot could not be made', err);
    return null;
  }
}

/** Asks the service, sending `key`: path is under the bottle's own address, and a body makes it a POST. */
const asker = (base, key) => (path, body) => fetch(new URL(path, base), {
  method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
  headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(key() ? { 'x-bottle-key': key() } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

/**
 * Checks `key` with the service: 'right' (keeping it, or the key of the person's own it was
 * swapped for, if it came from a link), 'wrong' (forgetting it), or 'unknown' if the service
 * cannot be reached. Returns [what, the key to use].
 */
async function checked(base, key, fresh, store) {
  try {
    const res = await asker(base, () => key)('check', {});
    if (res.status === 403 || res.status === 404) {
      try { localStorage.removeItem(store); } catch { /* nothing kept */ }
      return ['wrong', key];
    }
    if (!res.ok) return ['unknown', key];
    const given = (await res.json().catch(() => null))?.key;
    if (given || fresh) {
      try { localStorage.setItem(store, given || key); } catch { /* kept for this visit only */ }
    }
    return ['right', given || key];
  } catch {
    return ['unknown', key];
  }
}

/** A host on the page with a shadow root of its own, styled by CSS. */
function shadowHost() {
  const host = make('div', { 'data-bottle': '' });
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  root.adoptedStyleSheets = [sheet];
  return { host, root };
}

/** What a note's state is called to its writer. */
const STATE_NAMES = { new: 'New', 'in-progress': 'Being done', declined: 'Not done', done: 'Done', closed: 'Done' };

/** Shows the button, for a browser holding `key`, once the service says it is right. */
export async function start({ key: given, base, fresh, store }) {
  const [state, key] = await checked(base, given, fresh, store);
  // only once the service says the key is right: if it cannot be reached just now, the button waits for the next page
  if (state !== 'right') return;
  const send = asker(base, () => key);

  const { host, root } = shadowHost();
  const button = make('button', { class: 'bottle', type: 'button', title: 'Leave a note about this page' }, bottleIcon(), 'Note');
  const yours = make('button', { class: 'mine', type: 'button' }, 'My notes');
  const dock = make('div', { class: 'dock' }, button, yours);
  const ring = make('div', { class: 'ring', hidden: true }, make('span'));
  const whole = make('button', { type: 'button' }, 'Whole page');
  const cancelPick = make('button', { type: 'button' }, 'Cancel');
  const banner = make('div', { class: 'banner', hidden: true, role: 'status' }, make('p', {}, `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} the part this is about`), whole, cancelPick);
  const about = make('p', { class: 'about' });
  const box = make('textarea', { name: 'note', 'aria-label': 'Your note', placeholder: 'What should change?' });
  const error = make('p', { class: 'error', hidden: true, role: 'alert' });
  const go = make('button', { class: 'go', type: 'submit' }, 'Send note');
  const cancelNote = make('button', { type: 'button' }, 'Cancel');
  const Speech = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
  const speak = make('button', { class: 'speak', type: 'button', hidden: !Speech, 'aria-pressed': 'false' }, 'Speak');
  const panel = make('form', { class: 'panel', hidden: true, 'aria-label': 'Leave a note' }, make('h2', {}, 'Note'), about, box, error, make('div', { class: 'row' }, speak, cancelNote, go));
  const list = make('ul', { class: 'list' });
  const off = make('button', { type: 'button' }, 'Turn off');
  const closeList = make('button', { class: 'go', type: 'button' }, 'Close');
  const mine = make('div', { class: 'panel', hidden: true, role: 'dialog', 'aria-label': 'My notes' }, make('h2', {}, 'My notes'), list, make('div', { class: 'row' }, off, closeList));
  const toast = make('div', { class: 'toast', hidden: true, role: 'status' });
  root.append(ring, dock, banner, panel, mine, toast);
  document.body.append(host);

  let picking = false, hovered = null, chosen = null, shot = null, listening = null, spoken = false;

  const ours = (event) => event.composedPath().includes(host);

  const outline = (el) => {
    hovered = el;
    if (!el) { ring.hidden = true; return; }
    const r = el.getBoundingClientRect();
    Object.assign(ring.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
    ring.classList.toggle('low', r.top < 32);
    ring.firstChild.textContent = el.localName;
    ring.hidden = false;
  };

  const onMove = (event) => {
    if (ours(event)) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (el && el !== host && el !== hovered) outline(el);
  };
  // while choosing, the page's own buttons and links do nothing: a press only chooses
  const swallow = (event) => {
    if (ours(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'pointerdown') onMove(event);
    if (event.type === 'click') choose(document.elementFromPoint(event.clientX, event.clientY) ?? hovered, false);
  };
  const onKey = (event) => {
    if (event.key !== 'Escape') return;
    if (picking) { event.preventDefault(); stopPicking(); } else if (!panel.hidden) { event.preventDefault(); closePanel(); } else if (!mine.hidden) { event.preventDefault(); closeMine(); }
  };
  const PRESSES = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'auxclick', 'dblclick', 'contextmenu'];

  function startPicking() {
    picking = true;
    dock.hidden = true;
    banner.hidden = false;
    addEventListener('pointermove', onMove, true);
    for (const type of PRESSES) addEventListener(type, swallow, true);
    whole.focus();
  }

  function stopPicking({ keepRing = false } = {}) {
    picking = false;
    banner.hidden = true;
    removeEventListener('pointermove', onMove, true);
    for (const type of PRESSES) removeEventListener(type, swallow, true);
    if (!keepRing) { outline(null); dock.hidden = false; button.focus(); }
  }

  function choose(el, isWhole) {
    if (!el || el === host) return;
    stopPicking({ keepRing: true });
    const rect = isWhole ? null : el.getBoundingClientRect();
    chosen = { el, whole: isWhole, rect };
    if (isWhole) outline(null);
    else outline(el);
    // what was on the screen, taken now, before the box to write in covers any of it (the button's own parts are left out)
    shot = shoot(base, host, rect);
    about.textContent = describe(el, isWhole);
    about.title = about.textContent;
    // the box goes where it hides least of that part: above or below it on a phone, beside it on a wide screen
    panel.classList.toggle('up', Boolean(rect) && rect.top + rect.height / 2 > innerHeight / 2);
    panel.classList.toggle('left', Boolean(rect) && rect.left + rect.width / 2 > innerWidth / 2);
    error.hidden = true;
    spoken = false;
    panel.hidden = false;
    box.focus();
  }

  function stopListening() {
    listening?.stop();
    listening = null;
    speak.classList.remove('on');
    speak.textContent = 'Speak';
    speak.setAttribute('aria-pressed', 'false');
  }

  // the note said aloud is written into the box as it is heard, where it can be put right before it is sent
  function listen() {
    if (listening) { stopListening(); return; }
    const heard = new Speech();
    heard.lang = document.documentElement.lang || navigator.language || 'en-GB';
    heard.continuous = true;
    heard.interimResults = false;
    heard.onresult = (event) => {
      const words = [...event.results].slice(event.resultIndex).filter((r) => r.isFinal).map((r) => r[0].transcript.trim()).join(' ');
      if (!words) return;
      box.value = `${box.value.trim()} ${words}`.trim();
      spoken = true;
    };
    heard.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') { error.textContent = 'The note could not be heard. Type it instead.'; error.hidden = false; }
    };
    heard.onend = () => { if (listening === heard) stopListening(); };
    try { heard.start(); } catch { return; }
    listening = heard;
    speak.classList.add('on');
    speak.textContent = 'Stop';
    speak.setAttribute('aria-pressed', 'true');
  }

  function closePanel() {
    stopListening();
    panel.hidden = true;
    chosen = null;
    shot = null;
    outline(null);
    dock.hidden = false;
    button.focus();
  }

  const say = (words) => {
    toast.textContent = words;
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 3500);
  };

  async function submit(event) {
    event.preventDefault();
    if (!chosen || go.disabled) return;
    stopListening();
    if (!box.value.trim()) { error.textContent = 'Write the note first.'; error.hidden = false; box.focus(); return; }
    go.disabled = true;
    go.textContent = 'Sending...';
    error.hidden = true;
    const { el, whole: isWhole, rect } = chosen;
    const body = {
      note: box.value,
      spoken,
      page: { url: location.href, title: document.title },
      target: { whole: isWhole, selector: isWhole ? 'html' : selectorOf(el), tag: el.localName, text: isWhole ? '' : wordsOf(el), rect: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height } },
      viewport: { width: innerWidth, height: innerHeight, scale: devicePixelRatio, scrollX, scrollY },
      browser: navigator.userAgent,
      settings: { ...document.documentElement.dataset },
      shot: await shot
    };
    try {
      const res = await send('notes', body);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'The note could not be sent.');
      box.value = '';
      closePanel();
      say('Sent. Thank you.');
    } catch (err) {
      error.textContent = err instanceof TypeError ? 'The note could not be sent. Check the connection and try again.' : err.message;
      error.hidden = false;
    } finally {
      go.disabled = false;
      go.textContent = 'Send note';
    }
  }

  /** One of this person's notes, as they see it: its state, their words, and what came of it. */
  const item = (n) => {
    const li = make('li', {}, make('span', { class: `chip ${n.state}` }, STATE_NAMES[n.state] ?? n.state), make('p', { class: 'words' }, n.note));
    const outcome = n.state === 'declined' ? n.reason : n.what;
    if (outcome) li.append(make('p', { class: 'said' }, outcome));
    if (n.state === 'done') {
      const right = make('button', { type: 'button' }, 'Looks right');
      right.addEventListener('click', async () => {
        right.disabled = true;
        try {
          const res = await send(`mine/${n.id}/closed`, {});
          if (res.ok) li.replaceWith(item(await res.json()));
          else right.disabled = false;
        } catch { right.disabled = false; }
      });
      li.append(right);
    }
    return li;
  };

  async function openMine() {
    dock.hidden = true;
    off.textContent = 'Turn off';
    list.replaceChildren(make('li', {}, make('p', { class: 'empty' }, '...')));
    mine.hidden = false;
    closeList.focus();
    try {
      const res = await send('mine');
      if (!res.ok) throw new Error();
      const { notes } = await res.json();
      list.replaceChildren(...(notes.length ? notes.map(item) : [make('li', {}, make('p', { class: 'empty' }, 'No notes yet.'))]));
    } catch {
      list.replaceChildren(make('li', {}, make('p', { class: 'empty' }, 'Your notes could not be fetched. Try again in a while.')));
    }
  }

  function closeMine() {
    mine.hidden = true;
    dock.hidden = false;
    yours.focus();
  }

  // turning the button off asks once more, then forgets the key: the button goes until the link is opened again
  function turnOff() {
    if (off.textContent === 'Turn off') { off.textContent = 'Turn off now'; return; }
    try { localStorage.removeItem(store); } catch { /* nothing kept */ }
    removeEventListener('keydown', onKey, true);
    host.remove();
  }

  button.addEventListener('click', startPicking);
  yours.addEventListener('click', openMine);
  whole.addEventListener('click', () => choose(document.documentElement, true));
  cancelPick.addEventListener('click', () => stopPicking());
  cancelNote.addEventListener('click', closePanel);
  speak.addEventListener('click', listen);
  panel.addEventListener('submit', submit);
  closeList.addEventListener('click', closeMine);
  off.addEventListener('click', turnOff);
  addEventListener('keydown', onKey, true);
}

/**
 * The site's /review page: whoever is on the site's list gives their email and is sent a link
 * that switches the button on; anyone else is told the same, and nothing more. A browser that
 * holds a key already is told the button is on, and can turn it off.
 */
export async function review({ key, base, store }) {
  const { host, root } = shadowHost();
  const card = make('form', { class: 'card', 'aria-label': 'Review this website' });
  root.append(make('div', { class: 'review' }, card));
  document.body.append(host);
  let submit = null;
  card.addEventListener('submit', (event) => { event.preventDefault(); submit?.(); });

  const on = () => {
    submit = null;
    const off = make('button', { type: 'button' }, 'Turn off');
    off.addEventListener('click', () => {
      try { localStorage.removeItem(store); } catch { /* nothing kept */ }
      ask();
    });
    const go = make('a', { class: 'go', href: '/' }, 'Go to the website');
    card.replaceChildren(make('h1', {}, 'The note button is on'), make('div', { class: 'row' }, go, off));
    go.focus();
  };

  const ask = () => {
    const email = make('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, inputMode: 'email', maxLength: 254 });
    const error = make('p', { class: 'error', hidden: true, role: 'alert' });
    const go = make('button', { class: 'go', type: 'submit' }, 'Send me a link');
    submit = async () => {
      if (go.disabled) return;
      go.disabled = true;
      error.hidden = true;
      try {
        const res = await asker(base, () => null)('signin', { email: email.value });
        if (res.status === 202) {
          submit = null;
          card.replaceChildren(make('h1', {}, 'Thank you'), make('p', { role: 'status' }, 'We\'ll be in touch by email.'));
          return;
        }
        error.textContent = res.status === 429 ? 'Try again in a while.' : (await res.json().catch(() => null))?.error ?? 'That did not work. Try again in a while.';
      } catch {
        error.textContent = 'Check the connection and try again.';
      }
      error.hidden = false;
      go.disabled = false;
    };
    card.replaceChildren(make('h1', {}, 'Review this website'), make('label', {}, 'Email', email), error, go);
    email.focus();
  };

  if (key && (await checked(base, key, true, store))[0] === 'right') on();
  else ask();
}
