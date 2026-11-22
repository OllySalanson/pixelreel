// Pictures from the reels, drawn live as illustrations: <canvas class="shot" data-reel="name"
// data-scene="2">. Each plays its scene through once when it first scrolls into view, then
// holds the finished picture. With data-loop it keeps looping; with data-hover it waits for
// the pointer or the keyboard to reach the button it sits in. When calm, all hold still.
import { calm, onComfortChange } from './calm.js';
import { fitCanvas } from './player.js';
import { lengthWords, loadReel } from './reels.js';
import { createKit, H, W } from '../../src/kit.js';

const FRAME_MS = 50;
const HOLD_MS = 1600;   // how long a looping picture rests, finished, before starting again

function makeShot(canvas) {
  const shot = {
    canvas, g: canvas.getContext('2d'), scene: null, span: 0, from: null, visible: false, over: false,
    loop: 'loop' in canvas.dataset, hover: 'hover' in canvas.dataset
  };
  shot.px = createKit(shot.g);
  return shot;
}

/** Draws the shot's scene `ms` into it. */
function draw(shot, ms) {
  const { g, canvas, scene } = shot;
  if (!scene) return;
  g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  try { scene.draw(ms / 1000, shot.px, scene); } catch (err) { console.error('a picture could not draw:', err); }
}

/** Where the shot is in its scene now, in ms, or null if it is holding its finished picture. */
function clock(shot, now) {
  if (calm() || shot.from === null) return null;
  const at = now - shot.from;
  if (shot.loop) return Math.min(shot.span, at % (shot.span + HOLD_MS));
  if (shot.hover) return shot.over ? at % (shot.span + HOLD_MS) : null;
  return at < shot.span ? at : null;
}

export function startShots() {
  const shots = [...document.querySelectorAll('canvas.shot[data-reel]')].map(makeShot);
  let ticking = false;
  const rest = (shot) => { fitCanvas(shot.canvas); draw(shot, shot.span); };
  const tick = () => {
    if (ticking) return;
    ticking = true;
    let last = 0;
    const frame = (now) => {
      const live = shots.filter((s) => s.visible && s.scene && clock(s, now) !== null);
      if (!live.length) { ticking = false; shots.forEach((s) => s.visible && rest(s)); return; }
      requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      for (const shot of live) draw(shot, Math.min(shot.span, clock(shot, now)));
    };
    requestAnimationFrame(frame);
  };

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const shot = shots.find((s) => s.canvas === entry.target);
      shot.visible = entry.isIntersecting;
      if (!shot.visible) continue;
      if (!shot.scene && !shot.asked) {
        shot.asked = true;
        loadReel(shot.canvas.dataset.reel).then(({ reel, durations }) => {
          const i = Math.max(0, Math.min(reel.scenes.length - 1, (Number(shot.canvas.dataset.scene) || 1) - 1));
          shot.scene = reel.scenes[i];
          shot.span = durations[i];
          if (!shot.hover) shot.from = performance.now();
          rest(shot);
          tick();
        }).catch((err) => console.error(err));
      } else {
        tick();
      }
    }
  }, { rootMargin: '80px' });
  const sized = new ResizeObserver((entries) => {
    for (const entry of entries) rest(shots.find((s) => s.canvas === entry.target));
  });
  for (const shot of shots) {
    seen.observe(shot.canvas);
    sized.observe(shot.canvas);
    const holder = shot.hover && shot.canvas.closest('button, a');
    if (!holder) continue;
    const set = (over) => () => { shot.over = over; shot.from = performance.now(); tick(); };
    holder.addEventListener('pointerenter', set(true));
    holder.addEventListener('pointerleave', set(false));
    holder.addEventListener('focus', set(true));
    holder.addEventListener('blur', set(false));
  }
  onComfortChange(() => { shots.forEach((s) => s.visible && rest(s)); tick(); });

  // how long each reel on show lasts, in words
  for (const el of document.querySelectorAll('[data-length]')) {
    loadReel(el.dataset.length).then(({ line }) => { el.textContent = lengthWords(line.total); }).catch(() => {});
  }
}
