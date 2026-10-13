// Wires a reel to the page: loads it, then draws scenes on the canvas and keeps the
// caption, progress bar, buttons and dots in step with the player.
import { createKit, W, H } from './kit.js';
import { loadReel } from './load.js';
import { createNarrator } from './narrator.js';
import { noSignal } from './pictures.js';
import { Player } from './player.js';
import { clockTime, narrationMs, typedLength } from './timing.js';
import { transitionMs } from './transitions.js';

const FRAME_MS = 50;   // about 20 frames a second: plenty for pixel art, and easy on the machine

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)');

function showError(message) {
  $('heading').textContent = 'This reel could not be played';
  $('cap-title').textContent = 'Something is wrong';
  $('cap-typed').textContent = message;
  $('cap-body').removeAttribute('aria-hidden');
  $('cap').classList.add('error');
  for (const el of [document.querySelector('.controls'), $('seek')]) el.hidden = true;
  const canvas = $('stage'), g = canvas.getContext('2d'), px = createKit(g);
  canvas.setAttribute('aria-label', 'No signal: the reel could not be played');
  canvas.style.cursor = 'default';
  const born = performance.now();
  let last = -Infinity;
  const card = (now) => {
    if (!calm.matches) requestAnimationFrame(card);
    if (now - last < FRAME_MS) return;
    last = now;
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    noSignal(calm.matches ? 0 : (now - born) / 1000, px);
  };
  // the font first, so the sign is not drawn in a stand-in
  (document.fonts ? document.fonts.load("12px 'Orange Kid'").catch(() => {}) : Promise.resolve()).then(() => requestAnimationFrame(card));
}

async function start() {
  if (params.has('embed')) document.body.classList.add('embed');
  const { reel, clipFor, images } = await loadReel(params.get('reel') || document.body.dataset.reel);
  const scenes = reel.scenes;
  const durations = scenes.map((s) => narrationMs(s, clipFor(s)));

  const canvas = $('stage'), g = canvas.getContext('2d');
  const px = createKit(g, images);
  const dots = $('dots'), playBtn = $('play'), muteBtn = $('mute'), bigPlay = $('bigplay'), seek = $('seek');
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
  const player = new Player({ count: scenes.length, narrator, onChange: render, durations });
  const total = player.timeline.total;
  seek.setAttribute('aria-valuemax', String(Math.round(total / 1000)));
  for (const at of player.timeline.starts.slice(1)) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = `${(100 * at) / total}%`;
    seek.appendChild(tick);
  }

  dots.classList.toggle('many', scenes.length > 10);
  scenes.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'dot';
    d.title = `${i + 1}. ${s.title}`;
    d.setAttribute('aria-label', `Scene ${i + 1}: ${s.title}`);
    d.onclick = () => { leaveIntro(); player.goTo(i); };
    dots.appendChild(d);
  });

  let intro = !params.has('scene');        // the "Press Play" card, until anyone does anything
  let shownIndex = -1, previewStart = performance.now(), lastT = 0;
  let fade = null;                          // a transition in progress: { from, kind, start, ms, t }
  let scrubbing = null;                     // dragging the progress bar: { resume }
  let typed = 0, typedText = null;          // typewriter captions: how much of which caption is typed
  let shownCaption = null;
  const warmed = new Set(), broken = new Set();

  function leaveIntro() { intro = false; }

  // The picture's clock: the narration's while playing or paused part-way; a preview that
  // loops through the scene for one that has not started (before Play, or browsing paused).
  function sceneTime(now) {
    if (player.playing || player.ended || player.held) return player.elapsedMs / 1000;
    return ((now - previewStart) % player.timeline.spans[player.index]) / 1000;
  }

  function render(state) {
    const now = performance.now();
    if (state.index !== shownIndex) {
      const kind = calm.matches || scrubbing || shownIndex < 0 ? 'cut' : scenes[state.index].transition;
      fade = transitionMs(kind) ? { from: shownIndex, kind, start: now, ms: transitionMs(kind), t: lastT } : null;
      shownIndex = state.index;
      previewStart = now;
      typedText = null;
      const s = scenes[state.index];
      $('cap-live').textContent = `Scene ${state.index + 1} of ${scenes.length}: ${s.title}. ${s.caption}`;
      const next = scenes[state.index + 1], nextClip = next && clipFor(next);
      if (nextClip && !warmed.has(nextClip.url)) { warmed.add(nextClip.url); new Audio().src = nextClip.url; }   // so it starts at once
    }
    if (state.started) intro = false;
    [...dots.children].forEach((d, j) => {
      d.classList.toggle('on', j === state.index);
      if (j === state.index) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    playBtn.textContent = state.playing ? 'Pause' : state.ended ? 'Play again' : 'Play';
    muteBtn.textContent = state.muted ? 'Sound: off' : 'Sound: on';
    muteBtn.setAttribute('aria-pressed', String(!state.muted));
    bigPlay.hidden = !(intro || state.ended);
    $('bigplay-label').textContent = state.ended ? 'Play again' : 'Play';
    paintCaption();
  }

  // The caption, typed out as the narrator speaks when the scene asks for it. It never
  // un-types, and shows in full whenever the reel is not playing, so it can be read.
  function paintCaption() {
    const s = scenes[player.index];
    const title = intro ? 'Press Play' : `${player.index + 1}. ${s.title}`;
    const text = intro ? reel.intro : s.caption;
    if (text !== typedText) { typedText = text; typed = 0; }
    let n = text.length;
    if (!intro && s.captions === 'typewriter' && !calm.matches && player.playing) {
      n = Math.max(typed, typedLength(text, player.elapsedMs, durations[player.index]));
    }
    typed = n;
    const key = `${title}|${text}|${n}`;
    if (key === shownCaption) return;
    shownCaption = key;
    $('cap-title').textContent = title;
    $('cap-typed').textContent = text.slice(0, n);
    $('cap-rest').textContent = text.slice(n);
    $('cap').classList.toggle('typing', n < text.length);
  }

  // Every caption gets the room the longest one needs, so the buttons below never jump as
  // the scenes change, and the picture shrinks to keep that room on screen. Measured with
  // each caption in full, then once more at the width that leaves.
  function fitCaption() {
    const cap = $('cap'), main = document.querySelector('main');
    cap.style.minHeight = '';
    main.style.removeProperty('--caption-extra');
    const least = parseFloat(getComputedStyle(cap).minHeight) || 0;
    const all = [['Press Play', reel.intro], ...scenes.map((s, i) => [`${i + 1}. ${s.title}`, s.caption])];
    cap.classList.remove('typing');
    $('cap-rest').textContent = '';
    let room = least;
    for (let pass = 0; pass < 3; pass++) {
      cap.style.minHeight = '0px';
      let tallest = least;
      for (const [title, text] of all) {
        $('cap-title').textContent = title;
        $('cap-typed').textContent = text;
        tallest = Math.max(tallest, cap.offsetHeight);
      }
      cap.style.minHeight = `${tallest}px`;
      if (tallest === room) break;
      room = tallest;
      main.style.setProperty('--caption-extra', `${room - least}px`);
    }
    shownCaption = null;
    paintCaption();
  }
  let fitting = false;
  addEventListener('resize', () => {
    if (fitting) return;
    fitting = true;
    requestAnimationFrame(() => { fitting = false; fitCaption(); });
  });

  let shownSecond = -1;
  function paintProgress() {
    const at = player.positionMs;
    $('seek-fill').style.width = `${(100 * at) / total}%`;
    const second = Math.floor(at / 1000);
    if (second === shownSecond) return;
    shownSecond = second;
    $('time').textContent = `${clockTime(at)} / ${clockTime(total)}`;
    seek.setAttribute('aria-valuenow', String(second));
    seek.setAttribute('aria-valuetext', `${clockTime(at)} of ${clockTime(total)}, scene ${player.index + 1}: ${scenes[player.index].title}`);
  }

  function seekToPointer(e) {
    const r = seek.getBoundingClientRect();
    player.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total);
  }
  seek.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    seek.focus();
    seek.setPointerCapture(e.pointerId);
    leaveIntro();
    scrubbing = { resume: player.playing };
    player.pause();   // scrub with the picture held, then carry on from wherever it lands
    seekToPointer(e);
  });
  seek.addEventListener('pointermove', (e) => { if (scrubbing) seekToPointer(e); });
  const stopScrubbing = () => {
    if (!scrubbing) return;
    const { resume } = scrubbing;
    scrubbing = null;
    if (resume) player.play();
  };
  seek.addEventListener('pointerup', stopScrubbing);
  seek.addEventListener('pointercancel', stopScrubbing);
  seek.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -5000, ArrowDown: -5000, ArrowRight: 5000, ArrowUp: 5000, PageDown: -30000, PageUp: 30000 }[e.key];
    const to = step ? player.positionMs + step : e.key === 'Home' ? 0 : e.key === 'End' ? total : null;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();   // the arrow keys move a whole scene everywhere else
    leaveIntro();
    player.seek(to);
  });

  const play = () => { leaveIntro(); player.toggle(); };
  playBtn.onclick = play;
  bigPlay.onclick = () => { leaveIntro(); player.play(); };
  canvas.onclick = play;
  $('next').onclick = () => { leaveIntro(); player.next(); };
  $('back').onclick = () => { leaveIntro(); player.back(); };
  muteBtn.onclick = () => player.toggleMuted();
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ') { e.preventDefault(); play(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); leaveIntro(); player.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); leaveIntro(); player.back(); }
    else if (e.key.toLowerCase() === 'm') player.toggleMuted();
  });

  // ?scene=N&t=S holds scene N (counting from 1) at S seconds in: handy for checking a picture
  player.goTo((Number(params.get('scene')) || 1) - 1, (Number(params.get('t')) || 0) * 1000);

  function paint(s, t, i) {
    try {
      s.draw(t, px, s);
    } catch (err) {
      if (!broken.has(i)) { broken.add(i); console.error(`scene ${i + 1} could not draw:`, err); }
    }
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    paintCaption();
    paintProgress();
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const i = player.index, t = sceneTime(now);
    if (fade && now - fade.start >= fade.ms) fade = null;
    if (fade) {
      const { from, kind, start, ms } = fade, oldT = fade.t + (now - start) / 1000;
      px.transition(kind, (now - start) / ms, () => paint(scenes[from], oldT, from), () => paint(scenes[i], t, i));
    } else {
      paint(scenes[i], t, i);
    }
    lastT = t;
  }
  await (document.fonts ? document.fonts.load("12px 'Orange Kid'").catch(() => {}) : null);
  fitCaption();
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
