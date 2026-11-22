// The menu: where the bar across the top has no room for its links (a phone, or big letters),
// boot.js lets go of them and a Menu button takes their place. It opens them as a list of big
// rows, with Make it comfy and the way to add Pixel Reel to Claude.
/**
 * Whether a link in the menu leads to the page someone is on: the same page, and not to a
 * part of it (a link to "/#how" leads somewhere on the home page, which is not where they are).
 */
export const leadsHere = (href, path) => !href.includes('#') && href.replace(/\/$/, '') === path.replace(/\/$/, '');

export function startMenu(page = document) {
  const dialog = page.getElementById('menu');
  if (!dialog) return;
  // the row for the page they are on says so, to the eye and to a screen reader
  for (const link of dialog.querySelectorAll?.('a[href]') ?? []) {
    if (leadsHere(link.getAttribute('href'), page.location?.pathname ?? '')) link.setAttribute('aria-current', 'page');
  }
  for (const opener of page.querySelectorAll('[data-open="menu"]')) {
    // Written as a link to the links at the foot, which is where it leads if this script
    // never runs. With it, it is a button that opens the menu, and says so.
    opener.setAttribute('role', 'button');
    opener.setAttribute('aria-haspopup', 'dialog');
    const open = (e) => { e.preventDefault(); dialog.showModal(); };
    opener.addEventListener('click', open);
    opener.addEventListener('keydown', (e) => { if (e.key === ' ') open(e); });   // a button answers to Space, which a link does not
  }
  // Anything pressed in it closes it, and so does a press on the dimmed page beside it. A
  // link to a part of this page would otherwise scroll there behind it. It listens on the
  // way down, so that it has closed before Make it comfy opens.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('a, button')) dialog.close();
  }, true);
}
