// Puts the pixel landscapes (landscape.js) behind the site's night bands:
// <canvas class="scene" data-scene="hero">. Each is drawn on a coarse grid (one of its pixels
// is UNIT of the page's), a few times a second, and only while it is on screen.
// When calm, each is drawn once and holds still.
import { calm, onComfortChange } from './calm.js';
import { ROOM, SCENES } from './landscape.js';
import { createKit } from '../../src/kit.js';

const UNIT = 4;         // page pixels to one pixel of scenery, the same as --u in site.css
const FRAME_MS = 125;   // 8 frames a second: slow, calm movement
const FOOT = 96;        // how much of a scene's foot must show before it counts as seen, in page pixels
const WATCH_MS = 6000;  // how long Reelie goes on looking at a pointer that has stopped moving
const HOP_MS = 600;     // how long to draw every frame after Reelie is pressed

const paper = () => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#faf3e1';

export function startScenes() {
  const scenes = [...document.querySelectorAll('canvas.scene[data-scene]')].map((canvas) => ({
    canvas, g: canvas.getContext('2d'), draw: SCENES[canvas.dataset.scene], visible: false, w: 0, h: 0, quiet: [], met: null,
    spot: null, poked: null, pokes: 0   // where Reelie stands in it, if it does, and when it was last pressed
  })).filter((scene) => scene.draw);
  for (const scene of scenes) scene.px = createKit(scene.g);
  const born = performance.now();

  // where the words are, in the scene's own pixels, with room round them: enough for the
  // tall letters of OpenDyslexic, which reach well above and below their own line
  const quietZones = (scene, box) => [...scene.canvas.parentElement.querySelectorAll('[data-quiet]')].map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.floor((r.left - box.left) / UNIT) - ROOM, Math.floor((r.top - box.top) / UNIT) - ROOM, Math.ceil(r.width / UNIT) + ROOM * 2, Math.ceil(r.height / UNIT) + ROOM * 2];
  });
  // Reelie is only painted on a canvas, behind the page, so the page watches the pointer for
  // it: its eyes follow, and a press on it (that is not a press on anything else) makes it hop.
  let pointerAt = null;
  const inScene = (scene, x, y) => {
    const box = scene.canvas.getBoundingClientRect();
    return [(x - box.left) / UNIT, (y - box.top) / UNIT];
  };
  const onReelie = (e) => (e.target instanceof Element && e.target.closest('a, button, input, label, summary, dialog, .reel') ? null : scenes.find((scene) => {
    if (!scene.spot || !scene.visible) return false;
    const [x, y] = inScene(scene, e.clientX, e.clientY), [left, top, w, h] = scene.spot;
    return x >= left - 2 && x < left + w + 2 && y >= top - 2 && y < top + h + 2;
  }) ?? null);
  const paint = (scene, now) => {
    if (!scene.w) return;
    // where the words are now: they move when the letters change, without the scene changing size
    scene.quiet = quietZones(scene, scene.canvas.getBoundingClientRect());
    scene.g.setTransform(UNIT, 0, 0, UNIT, 0, 0);   // drawn at the page's own resolution, so its words are crisp
    scene.g.imageSmoothingEnabled = false;
    const still = calm();
    // a scene's foot, where anyone in it stands, can be a long scroll below its top
    if (scene.met === null && scene.visible && scene.canvas.getBoundingClientRect().bottom - FOOT <= innerHeight) scene.met = now;
    const met = scene.met === null ? null : (now - scene.met) / 1000;
    const pointer = pointerAt && now - pointerAt.when < WATCH_MS ? inScene(scene, pointerAt.x, pointerAt.y) : null;
    const poked = scene.poked === null ? null : (now - scene.poked) / 1000;
    scene.spot = scene.draw(scene.px, scene.w, scene.h, still ? 6.5 : (now - born) / 1000, { quiet: scene.quiet, paper: paper(), still, met, pointer, poked, pokes: scene.pokes })?.reelie ?? null;
  };
  const size = (scene) => {
    const box = scene.canvas.getBoundingClientRect();
    const width = Math.round(box.width), height = Math.round(box.height);
    if (width === scene.canvas.width && height === scene.canvas.height && scene.w) return;
    // the canvas holds exactly the pixels it shows, so nothing is squeezed; the scene is
    // drawn in whole units, and what hangs over the edge of the last one is cut off
    Object.assign(scene.canvas, { width, height });
    Object.assign(scene, { w: Math.ceil(width / UNIT), h: Math.ceil(height / UNIT) });
    paint(scene, performance.now());
  };

  let ticking = false;
  const tick = () => {
    if (ticking || calm()) return;
    ticking = true;
    let last = 0;
    const frame = (now) => {
      const live = scenes.filter((s) => s.visible);
      if (!live.length || calm() || document.hidden) { ticking = false; return; }
      requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      for (const scene of live) paint(scene, now);
    };
    requestAnimationFrame(frame);
  };

  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) scenes.find((s) => s.canvas === entry.target).visible = entry.isIntersecting;
    tick();
  });
  const sized = new ResizeObserver((entries) => {
    for (const entry of entries) size(scenes.find((s) => s.canvas === entry.target));
  });
  for (const scene of scenes) { seen.observe(scene.canvas); sized.observe(scene.canvas); }
  addEventListener('pointermove', (e) => {
    pointerAt = { x: e.clientX, y: e.clientY, when: performance.now() };
    document.documentElement.classList.toggle('on-reelie', !calm() && Boolean(onReelie(e)));
  }, { passive: true });
  addEventListener('click', (e) => {
    const scene = calm() ? null : onReelie(e);
    if (!scene) return;
    scene.poked = performance.now();
    scene.pokes++;
    // the hop is over in half a second: draw every frame of it, not the scenery's usual few a second
    const hop = (now) => { paint(scene, now); if (now - scene.poked < HOP_MS) requestAnimationFrame(hop); };
    requestAnimationFrame(hop);
  });
  document.addEventListener('visibilitychange', tick);
  onComfortChange(() => { scenes.forEach((s) => paint(s, performance.now())); tick(); });
  // the pixel font arrives after the first frame: draw again with it
  document.fonts?.ready.then(() => scenes.forEach((s) => paint(s, performance.now())));
}
