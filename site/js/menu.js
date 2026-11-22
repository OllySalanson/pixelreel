// The menu: where the bar across the top has no room for its links (a phone, or big letters),
// boot.js lets go of them and a Menu button takes their place. It opens them as a list of big
// rows, with Make it comfy and the way to add Pixel Reel to Claude.
export function startMenu(page = document) {
  const dialog = page.getElementById('menu');
  if (!dialog) return;
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
