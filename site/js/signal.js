// The test card on a page that is not there: <canvas data-signal>. The player's own "no
// signal" picture, flickering; held still when calm.
import { calm, onComfortChange } from './calm.js';
import { fitCanvas } from './player.js';
import { createKit, H, W } from '../../src/kit.js';
import { noSignal } from '../../src/pictures.js';

const FRAME_MS = 80;

export function startSignal() {
  const canvas = document.querySelector('canvas[data-signal]');
  if (!canvas) return;
  const g = canvas.getContext('2d'), px = createKit(g), born = performance.now();
  let last = 0, ticking = false;
  const paint = (now) => {
    fitCanvas(canvas);
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    noSignal(calm() ? 0 : (now - born) / 1000, px);
  };
  const frame = (now) => {
    if (calm() || document.hidden) { ticking = false; paint(now); return; }
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    paint(now);
  };
  const wake = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  onComfortChange(wake);
  document.addEventListener('visibilitychange', wake);
  // the pixel font arrives after the first frame: draw again with it
  document.fonts?.ready.then(() => paint(performance.now()));
  wake();
}
