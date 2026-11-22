// Puts the pixel landscapes (landscape.js) behind the site's night bands:
// <canvas class="scene" data-scene="hero">. Each is drawn small (one of its pixels is UNIT of
// the page's) and scaled up crisply, a few times a second, and only while it is on screen.
// When calm, each is drawn once and holds still.
import { calm, onComfortChange } from './calm.js';
import { SCENES } from './landscape.js';
import { createKit } from '../../src/kit.js';

const UNIT = 4;         // page pixels to one pixel of scenery, the same as --u in site.css
const FRAME_MS = 125;   // 8 frames a second: slow, calm movement

const paper = () => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#faf3e1';

export function startScenes() {
  const scenes = [...document.querySelectorAll('canvas.scene[data-scene]')].map((canvas) => ({
    canvas, g: canvas.getContext('2d'), draw: SCENES[canvas.dataset.scene], visible: false, w: 0, h: 0, quiet: []
  })).filter((scene) => scene.draw);
  for (const scene of scenes) scene.px = createKit(scene.g);
  const born = performance.now();

  const paint = (scene, now) => {
    if (!scene.w) return;
    scene.g.setTransform(1, 0, 0, 1, 0, 0);
    scene.g.imageSmoothingEnabled = false;
    const still = calm();
    scene.draw(scene.px, scene.w, scene.h, still ? 6.5 : (now - born) / 1000, { quiet: scene.quiet, paper: paper(), still });
  };
  // where the words are, in the scene's own pixels, with a little room round them
  const quietZones = (scene, box) => [...scene.canvas.parentElement.querySelectorAll('[data-quiet]')].map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.floor((r.left - box.left) / UNIT) - 3, Math.floor((r.top - box.top) / UNIT) - 3, Math.ceil(r.width / UNIT) + 6, Math.ceil(r.height / UNIT) + 6];
  });
  const size = (scene) => {
    const box = scene.canvas.getBoundingClientRect();
    const w = Math.ceil(box.width / UNIT), h = Math.ceil(box.height / UNIT);
    scene.quiet = quietZones(scene, box);
    if (w === scene.w && h === scene.h) return;
    Object.assign(scene, { w, h });
    Object.assign(scene.canvas, { width: w, height: h });
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
  document.addEventListener('visibilitychange', tick);
  onComfortChange(() => { scenes.forEach((s) => paint(s, performance.now())); tick(); });
  // the pixel font arrives after the first frame: draw again with it
  document.fonts?.ready.then(() => scenes.forEach((s) => paint(s, performance.now())));
}
