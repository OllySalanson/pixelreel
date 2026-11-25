// Message in a Bottle, the part every page loads: it does nothing at all unless this browser
// holds a key (kept once a link from an email has been opened and its button pressed, or once
// signed in at the site's /review page) or the page was opened from such a link
// (#bottle=<code>, or ?bottle=<code> in links sent before), so no other visitor ever sees the
// button. Then it loads the rest (bottle-ui.mjs), which checks with the service before showing
// anything. #bottle=off forgets the key again. On a site that is a preview, its line says
// data-preview and the button is there for anyone (bottle-ui.mjs asks the service first). A plain
// script, so any page on any site can load it: <script src="https://<the service>/bottle/bottle.js" defer></script>
(() => {
  const STORE = 'bottle-key';
  // a link opened in a tab already on its page changes only the part after #, which loads nothing: load it, so it is seen
  addEventListener('hashchange', () => { if (new URLSearchParams(location.hash.slice(1)).has('bottle')) location.reload(); });
  const script = document.currentScript;
  const base = new URL('.', script?.src ?? location.href);
  const address = new URL(location.href);
  const hash = new URLSearchParams(address.hash.slice(1));
  const asked = hash.get('bottle') ?? address.searchParams.get('bottle');
  let kept = null;
  try { kept = localStorage.getItem(STORE); } catch { /* no storage here: the link works for this visit only */ }
  if (asked !== null) {
    // the code comes out of the address at once, so it is not in a link copied from here, in a screenshot, or seen by the page's own scripts later
    address.searchParams.delete('bottle');
    if (hash.has('bottle')) {
      hash.delete('bottle');
      address.hash = hash.toString();
    }
    history.replaceState(history.state, '', address);
  }
  if (asked === 'off') {
    try { localStorage.removeItem(STORE); } catch { /* nothing kept */ }
    return;
  }
  const link = asked || null;
  const load = (then) => import(new URL('bottle-ui.mjs', base).href).then(then).catch((err) => console.error('bottle:', err));
  // the site's /review page (its line has data-review), where someone on its list asks for a link to switch the button on
  if (script?.hasAttribute('data-review')) {
    if (!document.querySelector('meta[name="robots"]')) document.head.append(Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow' }));
    load((ui) => ui.review({ link, kept, base, store: STORE }));
    return;
  }
  // a site that is a preview (data-preview) offers the button to anyone, who gives their name once
  const preview = Boolean(script?.hasAttribute('data-preview'));
  if (!link && !kept) {
    if (preview) load((ui) => ui.visit({ base, store: STORE }));
    return;
  }
  load((ui) => ui.start({ link, kept, base, store: STORE, preview }));
})();
