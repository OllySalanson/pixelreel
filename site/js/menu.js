// The menu: where the bar across the top has no room for its links (a phone, or big letters),
// boot.js lets go of them and a Menu button takes their place. It opens them as a list of big
// rows, with Make it comfy and the way to add Pixel Reel to Claude.
export function startMenu(page = document) {
  const dialog = page.getElementById('menu');
  if (!dialog) return;
  for (const opener of page.querySelectorAll('[data-open="menu"]')) {
    opener.addEventListener('click', () => dialog.showModal());
  }
  // Anything pressed in it closes it, and so does a press on the dimmed page beside it. A
  // link to a part of this page would otherwise scroll there behind it. It listens on the
  // way down, so that it has closed before Make it comfy opens.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('a, button')) dialog.close();
  }, true);
}
