// Message in a Bottle, the part every page loads: it does nothing at all unless this browser
// holds a key (given by a personal link, the page's address with ?bottle=<key>, or by signing
// in at the site's /review page), so no other visitor ever sees the button. With a key it
// loads the rest (bottle-ui.mjs), which checks the key with the service before showing the
// button. ?bottle=off forgets the key again. A plain script, so any page on any site can load it:
// <script src="https://<the service>/bottle/bottle.js" defer></script>
(() => {
  const STORE = 'bottle-key';
  const script = document.currentScript;
  const base = new URL('.', script?.src ?? location.href);
  const address = new URL(location.href), asked = address.searchParams.get('bottle');
  let kept = null;
  try { kept = localStorage.getItem(STORE); } catch { /* no storage here: the link works for this visit only */ }
  if (asked !== null) {
    // the key comes out of the address at once, so it is not in a link copied from here, or in a screenshot
    address.searchParams.delete('bottle');
    history.replaceState(history.state, '', address);
  }
  if (asked === 'off') {
    try { localStorage.removeItem(STORE); } catch { /* nothing kept */ }
    return;
  }
  const load = (then) => import(new URL('bottle-ui.mjs', base).href).then(then).catch((err) => console.error('bottle:', err));
  // the site's /review page (its line has data-review), where someone on its list asks for a link to switch the button on
  if (script?.hasAttribute('data-review')) {
    if (!document.querySelector('meta[name="robots"]')) document.head.append(Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow' }));
    load((ui) => ui.review({ key: asked || kept, base, store: STORE }));
    return;
  }
  const key = asked || kept;
  if (!key) return;
  load((ui) => ui.start({ key, base, fresh: Boolean(asked), store: STORE }));
})();
