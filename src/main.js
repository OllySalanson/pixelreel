// Wires a reel to the page: loads reels/<name>/reel.js and its audio manifest, then
// draws scenes on the canvas and keeps the caption, buttons and dots in step.
import { createKit, W, H } from './kit.js';
import { normalizeReel, clipLookup, REEL_NAME } from './reel.js';
import { createNarrator } from './narrator.js';
import { Player } from './player.js';

const FRAME_MS = 50;   // about 20 frames a second: plenty for pixel art, and easy on the machine

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

async function loadManifest(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;   // no recordings yet (or opened from disk): the browser's voice reads instead
  }
}

function showError(message) {
  $('heading').textContent = 'This reel could not be played';
  const cap = $('cap');
  cap.querySelector('.title').textContent = 'Something is wrong';
  cap.querySelector('.body').textContent = message;
  cap.classList.add('error');
  document.querySelector('.controls').hidden = true;
}

async function start() {
  const name = params.get('reel') || document.body.dataset.reel;
  if (!REEL_NAME.test(name ?? '')) throw new Error(`"${name}" is not a reel name. Use lowercase letters, digits and dashes, for example ?reel=my-reel.`);
  const base = `reels/${name}/`;

  let mod;
  try {
    mod = await import(new URL(base + 'reel.js', location.href).href);
  } catch (err) {
    console.error(err);
    throw new Error(`Could not load ${base}reel.js. Check the reel name, and look in the browser console for a typo in the file.`, { cause: err });
  }
  const reel = normalizeReel(mod.default, { base });
  const clipFor = clipLookup(await loadManifest(base + 'audio/manifest.json'), base + 'audio/');
  const scenes = reel.scenes;

  const images = {};
  for (const [key, src] of Object.entries(reel.images)) {
    const im = new Image();
    im.onerror = () => console.warn(`picture "${key}" did not load from ${src}`);
    im.src = src;
    images[key] = im;
  }

  const canvas = $('stage'), g = canvas.getContext('2d');
  const px = createKit(g, images);
  const cap = $('cap'), dots = $('dots'), playBtn = $('play'), muteBtn = $('mute');
  document.title = reel.title + ' - pixelreel';
  $('heading').textContent = reel.title;
  $('note').textContent = reel.note;
  canvas.setAttribute('aria-label', 'Pictures for: ' + reel.title);

  const narrator = createNarrator({
    scenes,
    clipFor,
    audio: new Audio(),
    speech: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance
  });

  let sceneStart = performance.now(), introShowing = !params.has('scene');
  const player = new Player({ count: scenes.length, narrator, onChange: render });

  scenes.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'dot';
    d.title = `${i + 1}. ${s.title}`;
    d.setAttribute('aria-label', `Scene ${i + 1}: ${s.title}`);
    d.onclick = () => player.goTo(i);
    dots.appendChild(d);
  });

  let shownIndex = -1;
  function render(state) {
    if (state.index !== shownIndex) { shownIndex = state.index; sceneStart = performance.now(); }
    if (state.playing || state.index > 0) introShowing = false;
    const s = scenes[state.index];
    cap.querySelector('.title').textContent = introShowing ? 'Press Play' : `${state.index + 1}. ${s.title}`;
    cap.querySelector('.body').textContent = introShowing ? reel.intro : s.caption;
    [...dots.children].forEach((d, j) => {
      d.classList.toggle('on', j === state.index);
      if (j === state.index) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    playBtn.textContent = state.playing ? 'Pause' : state.ended ? 'Play again' : 'Play';
    muteBtn.textContent = state.muted ? 'Sound: off' : 'Sound: on';
    muteBtn.setAttribute('aria-pressed', String(!state.muted));
    const next = scenes[state.index + 1];
    const nextClip = next && clipFor(next);
    if (nextClip) new Audio().src = nextClip.url;   // warm the next clip so it starts at once
  }

  playBtn.onclick = () => player.toggle();
  $('next').onclick = () => player.next();
  $('back').onclick = () => player.back();
  muteBtn.onclick = () => player.toggleMuted();
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); player.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); player.back(); }
    else if (e.key.toLowerCase() === 'm') player.toggleMuted();
  });

  // ?scene=N&t=S opens scene N (counting from 1), S seconds in: handy for checking a picture
  player.goTo((Number(params.get('scene')) || 1) - 1);
  sceneStart -= (Number(params.get('t')) || 0) * 1000;

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const s = scenes[player.index];
    try { s.draw((now - sceneStart) / 1000, px, s); } catch (err) { console.error(`scene ${player.index + 1} could not draw:`, err); }
  }
  await (document.fonts ? document.fonts.load("12px 'Orange Kid'").catch(() => {}) : null);
  requestAnimationFrame(frame);

  // a small window into the player, for automated checks and the curious
  window.pixelreel = {
    reel, player,
    get source() { return narrator.lastSource; },
    clipFor: (i) => clipFor(scenes[i])
  };
  document.body.dataset.ready = 'true';
}

start().catch((err) => {
  console.error(err);
  showError(err.message || String(err));
});
