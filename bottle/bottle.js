// Message in a Bottle, the part every page loads: it does nothing at all unless this browser
// was given the secret link (the page's address with ?bottle=<key>), so no other visitor ever
// sees the button. With the key it loads the rest (bottle-ui.mjs), which shows the button.
// ?bottle=off forgets the key again. A plain script, so any page can load it:
// <script src="/bottle/bottle.js" defer></script>
(() => {
  const STORE = 'bottle-key';
  const base = new URL('.', document.currentScript?.src ?? location.href);
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
  const key = asked || kept;
  if (!key) return;
  import(new URL('bottle-ui.mjs', base).href)
    .then((ui) => ui.start({ key, base, fresh: Boolean(asked), store: STORE }))
    .catch((err) => console.error('bottle:', err));
})();
