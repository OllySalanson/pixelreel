// The banner maker (export.html): draws a few seconds of a scene, frame by frame, and wraps
// them in an animated SVG for a README or a web page, with a link back to the reel.
import { flipbookSvg } from './flipbook.js';
import { createKit, W, H } from './kit.js';
import { loadReel } from './load.js';
import { base64, palettePng } from './png.js';

const FRAME_MS = 50;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const status = (text) => { $('status').textContent = text; };
const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

let loaded = null;   // { name, reel, images } once a reel has loaded
let preview = null;  // the pixel kit for the preview canvas
let made = null;     // the address of the last banner, so it can be let go

/** A pixel Watch button in the corner that bobs gently, so the banner says "press me". */
function watchBadge(px, t) {
  const w = px.textW('WATCH', 16) + 34, h = 25;
  const x = px.W - w - 8, y = px.H - h - 8 - (px.blink(t, 0.75) ? 1 : 0);
  px.rect('#0b1220', x + 2, y + 3, w, h);
  px.rect('#ebeac5', x + 1, y, w - 2, h);
  px.rect('#ebeac5', x, y + 1, w, h - 2);
  px.rect('#2e7d32', x + 2, y + 2, w - 4, h - 4);
  for (let i = 0; i < 6; i++) px.rect('#fdf6e3', x + 10 + i, y + 6 + i, 1, 13 - i * 2);
  px.text('WATCH', x + 21, y + 4, 16, '#fdf6e3');
}

function choices() {
  return {
    scene: Number($('scene').value) || 0,
    from: Math.max(0, Number($('from').value) || 0),
    length: Math.min(12, Math.max(0.5, Number($('length').value) || 4)),
    fps: Number($('fps').value) || 15,
    detail: Number($('detail').value) || 2,
    badge: $('badge').checked
  };
}

/** Draws frame `t` of the chosen scene, and the Watch button if wanted. */
function draw(g, px, k, t, { scene, badge }) {
  g.setTransform(k, 0, 0, k, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  const s = loaded.reel.scenes[scene];
  s.draw(t, px, s);
  if (badge) watchBadge(px, t);
}

async function load(name) {
  status('Loading...');
  $('result').hidden = true;
  try {
    loaded = await loadReel(name);
  } catch (err) {
    loaded = null;
    status(err.message);
    return;
  }
  $('reel').value = name;
  const select = $('scene');
  select.replaceChildren(...loaded.reel.scenes.map((s, i) => new Option(`${i + 1}. ${s.title}`, String(i))));
  const wanted = Number(params.get('scene')) - 1;
  if (wanted >= 0 && wanted < loaded.reel.scenes.length) select.value = String(wanted);
  const canvas = $('preview');
  preview = createKit(canvas.getContext('2d'), loaded.images);
  document.title = `Banner maker: ${loaded.reel.title} - pixelreel`;
  status('');
}

async function make() {
  const c = choices(), k = c.detail, scene = loaded.reel.scenes[c.scene];
  const canvas = document.createElement('canvas');
  canvas.width = W * k;
  canvas.height = H * k;
  const g = canvas.getContext('2d', { willReadFrequently: true }), px = createKit(g, loaded.images);
  const count = Math.max(1, Math.round(c.length * c.fps)), frames = [];
  for (let i = 0; i < count; i++) {
    status(`Drawing frame ${i + 1} of ${count}...`);
    draw(g, px, k, c.from + i / c.fps, c);
    const png = await palettePng(canvas.width, canvas.height, g.getImageData(0, 0, canvas.width, canvas.height).data);
    frames.push('data:image/png;base64,' + base64(png));
    if (i % 4 === 3) await new Promise((ok) => requestAnimationFrame(ok));   // let the page breathe
  }
  const svg = flipbookSvg(frames, {
    width: canvas.width, height: canvas.height, fps: c.fps, scale: 3 / k,
    title: loaded.reel.title,
    desc: `A few seconds of the scene "${scene.title}" from the pixelreel "${loaded.reel.title}".`
  });
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  if (made) URL.revokeObjectURL(made);
  made = URL.createObjectURL(blob);
  const file = `${loaded.name}-banner.svg`, watch = new URL(`./?reel=${loaded.name}`, location.href).href;
  $('out').src = made;
  $('download').href = made;
  $('download').download = file;
  $('download').textContent = `Download ${file} (${kb(blob.size)})`;
  $('snippet').value = `[![Watch: ${loaded.reel.title}](${file})](${watch})`;
  $('result').hidden = false;
  status(`Done: ${count} frames, ${kb(blob.size)}.`);
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!loaded || now - last < FRAME_MS) return;
  last = now;
  const c = choices(), canvas = $('preview');
  try {
    draw(canvas.getContext('2d'), preview, canvas.width / W, c.from + ((now / 1000) % c.length), c);
  } catch (err) {
    status(`This scene could not draw: ${err.message}`);
  }
}

$('load').onclick = () => load($('reel').value.trim());
$('reel').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); load($('reel').value.trim()); } };
$('form').onsubmit = async (e) => {
  e.preventDefault();
  if (!loaded) return;
  const button = $('make');
  button.disabled = true;
  try { await make(); } catch (err) { console.error(err); status(`Something went wrong: ${err.message}`); } finally { button.disabled = false; }
};

await (document.fonts ? document.fonts.load("12px 'Orange Kid'").catch(() => {}) : null);
await load(params.get('reel') || document.body.dataset.reel);
requestAnimationFrame(frame);
