// The reading ruler (Make it comfy): a clear band across the page, with the rest dimmed, to
// keep a reader's place on the line. It follows the pointer, a finger, or whatever the
// keyboard has reached, and gets out of the way of a reel that is playing.

/** Where the top of a band `band` tall goes for something at height `y` on a screen `view` tall: centred on it, never off the screen. */
export const rulerTop = (y, band, view) => Math.round(Math.max(0, Math.min(view - band, y - band / 2)));

export function startRuler() {
  const ruler = document.querySelector('.ruler');
  if (!ruler) return;
  const root = document.documentElement;
  let y = innerHeight * 0.4, queued = false;   // it starts two fifths of the way down, where eyes tend to rest
  const place = () => {
    queued = false;
    const on = root.dataset.ruler === 'on' && !document.querySelector('.reel.is-playing');
    ruler.hidden = !on;
    if (on) ruler.style.transform = `translateY(${rulerTop(y, ruler.offsetHeight, innerHeight)}px)`;
  };
  const soon = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  const follow = (e) => { y = e.clientY; soon(); };
  addEventListener('pointermove', follow, { passive: true });
  addEventListener('pointerdown', follow, { passive: true });
  addEventListener('focusin', (e) => {
    if (!(e.target instanceof Element) || !e.target.matches(':focus-visible')) return;   // the keyboard, not a press
    const box = e.target.getBoundingClientRect();
    y = box.top + box.height / 2;
    soon();
  });
  // a press may have started or stopped a reel, and Make it comfy may have switched the ruler
  for (const kind of ['click', 'keyup', 'comfort', 'resize']) addEventListener(kind, soon);
  place();
}
