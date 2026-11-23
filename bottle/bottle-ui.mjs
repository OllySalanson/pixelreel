// Message in a Bottle, the button and what it opens: loaded by bottle.js only when this
// browser holds the key. Press the button, click the part of the page the note is about (or
// choose the whole page), write the note, send. With it go a screenshot of what was on the
// screen with that part outlined, the address, a CSS selector and the words of that part, the
// window's size and the browser. Everything it draws is in a shadow root, styled through
// adoptedStyleSheets, so the page's own styles cannot reach it and a strict content security
// policy (no inline styles or scripts) does not stop it.

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.bottle, .banner, .panel, .toast {
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
.bottle {
  left: max(12px, env(safe-area-inset-left)); bottom: max(12px, env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 10px; min-height: 48px; font-weight: 700;
}
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

/** Shows the button, for a browser holding `key` (checked with the service first). */
export async function start({ key, base, fresh, store }) {
  const send = (path, body) => fetch(new URL(path, base), {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-bottle-key': key }, body: JSON.stringify(body ?? {}), credentials: 'omit'
  });
  try {
    const res = await send('check');
    if (res.status === 403 || res.status === 404) {
      try { localStorage.removeItem(store); } catch { /* nothing kept */ }
      return;
    }
    if (res.ok && fresh) {
      try { localStorage.setItem(store, key); } catch { /* kept for this visit only */ }
    }
  } catch {
    // the service cannot be reached just now: show the button anyway, and say so if a note cannot be sent
  }

  const host = make('div', { 'data-bottle': '' });
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  root.adoptedStyleSheets = [sheet];

  const button = make('button', { class: 'bottle', type: 'button', title: 'Leave a note about this page' }, bottleIcon(), 'Note');
  const ring = make('div', { class: 'ring', hidden: true }, make('span'));
  const whole = make('button', { type: 'button' }, 'Whole page');
  const cancelPick = make('button', { type: 'button' }, 'Cancel');
  const banner = make('div', { class: 'banner', hidden: true, role: 'status' }, make('p', {}, `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} the part this is about`), whole, cancelPick);
  const about = make('p', { class: 'about' });
  const box = make('textarea', { name: 'note', 'aria-label': 'Your note', placeholder: 'What should change?' });
  const error = make('p', { class: 'error', hidden: true, role: 'alert' });
  const go = make('button', { class: 'go', type: 'submit' }, 'Send note');
  const cancelNote = make('button', { type: 'button' }, 'Cancel');
  const panel = make('form', { class: 'panel', hidden: true, 'aria-label': 'Leave a note' }, make('h2', {}, 'Note'), about, box, error, make('div', { class: 'row' }, cancelNote, go));
  const toast = make('div', { class: 'toast', hidden: true, role: 'status' });
  root.append(ring, button, banner, panel, toast);
  document.body.append(host);

  let picking = false, hovered = null, chosen = null, shot = null;

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
    event.preventDefault();
    if (picking) stopPicking();
    else if (!panel.hidden) closePanel();
  };
  const PRESSES = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'auxclick', 'dblclick', 'contextmenu'];

  function startPicking() {
    picking = true;
    button.hidden = true;
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
    if (!keepRing) { outline(null); button.hidden = false; button.focus(); }
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
    panel.hidden = false;
    box.focus();
  }

  function closePanel() {
    panel.hidden = true;
    chosen = null;
    shot = null;
    outline(null);
    button.hidden = false;
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
    if (!box.value.trim()) { error.textContent = 'Write the note first.'; error.hidden = false; box.focus(); return; }
    go.disabled = true;
    go.textContent = 'Sending...';
    error.hidden = true;
    const { el, whole: isWhole, rect } = chosen;
    const body = {
      note: box.value,
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

  button.addEventListener('click', startPicking);
  whole.addEventListener('click', () => choose(document.documentElement, true));
  cancelPick.addEventListener('click', () => stopPicking());
  cancelNote.addEventListener('click', closePanel);
  panel.addEventListener('submit', submit);
  addEventListener('keydown', onKey, true);
}
