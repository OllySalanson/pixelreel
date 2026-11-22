// Wires a reel to the page: loads it, then draws scenes on the canvas and keeps the
// caption, progress bar, buttons and dots in step with the player.
import { createKit, W, H } from './kit.js';
import { inlineReel, loadReel } from './load.js';
import { createNarrator } from './narrator.js';
import { noSignal } from './pictures.js';
import { Player } from './player.js';
import { INTRO, QUIET_INTRO } from './reel.js';
import { clockTime, narrationMs, typedLength } from './timing.js';
import { transitionMs } from './transitions.js';

const FRAME_MS = 50;   // about 20 frames a second: plenty for pixel art, and easy on the machine

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/** Shows the one of a button's stacked labels that reads `text`; the rest keep their room, so it never changes width. */
function showLabel(button, text) {
  for (const span of button.children) span.classList.toggle('on', span.textContent === text);
}

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

/** What the caption says at a scene whose recording has not come yet, in a reel that plays while it is being recorded. */
const STILL_RECORDING = 'Peter is still recording this line. It plays in a moment.';

async function start() {
  if (params.has('embed')) document.body.classList.add('embed');
  // A one-file reel carries its reel (and any recordings) in the page; any other loads by name.
  const inline = $('reel-data');
  const { reel, clipFor, images } = inline ? inlineReel(inline.textContent, $('reel-audio')?.textContent)
    : await loadReel(params.get('reel') || document.body.dataset.reel);
  const scenes = reel.scenes;
  // Recordings that arrive after the player has started: a reel that plays while its voice
  // is still being recorded (the player in a chat) leaves them in window.pixelreelClips,
  // { clips: [{ text, file, seconds }], more, guesses }, and says so with a "pixelreel:clips"
  // event. `more` is true while others are still on their way, and `guesses` ([{ text,
  // seconds }]) say about how long those will last, for the reel's clock until they come.
  const late = new Map(), guessed = new Map();
  let coming = false;   // true while recordings are still on their way
  const clipNow = (scene) => late.get(scene.say) ?? clipFor(scene);
  const lengths = () => scenes.map((s) => narrationMs(s, clipNow(s) ?? guessed.get(s.say) ?? null));
  let durations = lengths();

  const canvas = $('stage'), g = canvas.getContext('2d');
  const px = createKit(g, images);
  const dots = $('dots'), playBtn = $('play'), muteBtn = $('mute'), bigPlay = $('bigplay'), seek = $('seek');
  document.title = reel.title + ' - pixelreel';
  document.body.dataset.opens = reel.opens;
  $('heading').textContent = reel.title;
  $('note').textContent = reel.note;
  canvas.setAttribute('aria-label', 'Pictures for: ' + reel.title);

  const narrator = createNarrator({
    scenes,
    clipFor: clipNow,
    audio: new Audio(),
    speech: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
    expecting: (scene) => coming && !clipNow(scene),
    onArrive: () => player.resync()
  });
  const player = new Player({ count: scenes.length, narrator, onChange: render, durations });
  let total = player.timeline.total;

  // The progress bar's ticks, one where each scene after the first starts, and how long the reel is.
  function markScenes() {
    total = player.timeline.total;
    seek.setAttribute('aria-valuemax', String(Math.round(total / 1000)));
    for (const old of seek.querySelectorAll('.tick')) old.remove();
    for (const at of player.timeline.starts.slice(1)) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = `${(100 * at) / total}%`;
      seek.appendChild(tick);
    }
  }
  markScenes();

  // Takes the recordings left in window.pixelreelClips: scenes they are for now last as long as their recordings.
  function takeClips() {
    const box = window.pixelreelClips;
    if (!box) return;
    coming = Boolean(box.more);
    for (const clip of box.clips ?? []) {
      if (typeof clip?.text === 'string' && typeof clip.file === 'string') late.set(clip.text.trim(), { url: clip.file, seconds: Number(clip.seconds) || 0 });
    }
    guessed.clear();
    for (const guess of box.guesses ?? []) {
      if (typeof guess?.text === 'string' && guess.seconds > 0) guessed.set(guess.text.trim(), { seconds: Number(guess.seconds) });
    }
    durations = lengths();
    player.retime(durations);
    markScenes();
    shownSecond = -1;   // the time shown is out of date
  }
  document.addEventListener('pixelreel:clips', takeClips);

  dots.classList.toggle('many', scenes.length > 10);
  scenes.forEach((s, i) => {
    const d = document.createElement('button');
    d.className = 'dot';
    d.title = `${i + 1}. ${s.title}`;
    d.setAttribute('aria-label', `Scene ${i + 1}: ${s.title}`);
    d.onclick = () => { leaveIntro(); player.goTo(i); };
    dots.appendChild(d);
  });

  let shownSecond = -1;                     // the second the time under the picture shows
  let intro = !params.has('scene');        // the "Press Play" card, until anyone does anything
  let shownIndex = -1, previewStart = performance.now(), lastT = 0;
  let fade = null;                          // a transition in progress: { from, kind, start, ms, t }
  let scrubbing = null;                     // dragging the progress bar: { resume }
  let typed = 0, typedText = null;          // typewriter captions: how much of which caption is typed
  let shownCaption = null;
  const warmed = new Set(), broken = new Set();

  function leaveIntro() { intro = false; }

  // What is said before Play is pressed. With the sound off (as a page with no recordings
  // starts) the usual words would promise sound that does not come, so they say how to get it.
  function introWords() {
    return reel.intro === INTRO && player.muted ? QUIET_INTRO : reel.intro;
  }

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
      const next = scenes[state.index + 1], nextClip = next && clipNow(next);
      if (nextClip && !warmed.has(nextClip.url)) { warmed.add(nextClip.url); new Audio().src = nextClip.url; }   // so it starts at once
    }
    if (state.started) intro = false;
    [...dots.children].forEach((d, j) => {
      d.classList.toggle('on', j === state.index);
      if (j === state.index) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    showLabel(playBtn, state.playing ? 'Pause' : state.ended ? 'Replay' : 'Play');
    showLabel(muteBtn, state.muted ? 'Sound: off' : 'Sound: on');
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
    // a scene skipped to before its recording has come: say why it is quiet, until the voice begins
    const text = intro ? introWords() : player.playing && narrator.lastSource === 'waiting' ? STILL_RECORDING : s.caption;
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
  // each caption in full, then again at the width that leaves. If the page still needs a
  // scrollbar (the buttons wrap onto a second row in a narrower player, say), the picture
  // shrinks a little more, but only when that makes the whole page fit: a window too short
  // for any size of player keeps the bigger picture and scrolls.
  function fitCaption() {
    const cap = $('cap'), main = document.querySelector('main'), page = document.documentElement;
    cap.style.minHeight = '';
    const least = parseFloat(getComputedStyle(cap).minHeight) || 0;
    const all = [['Press Play', reel.intro], ...(reel.intro === INTRO ? [['Press Play', QUIET_INTRO]] : []), ...(coming ? [['Press Play', STILL_RECORDING]] : []), ...scenes.map((s, i) => [`${i + 1}. ${s.title}`, s.caption])];
    cap.classList.remove('typing');
    $('cap-rest').textContent = '';
    // Sizes the caption for the player as wide as it can be with `more` pixels taken off the
    // picture's height, and says by how much the page is then too tall for the window.
    const fit = (more) => {
      main.style.setProperty('--caption-extra', `${more}px`);
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
        if (tallest === room && pass > 0) break;
        room = tallest;
        main.style.setProperty('--caption-extra', `${room - least + more}px`);
      }
      return Math.ceil(page.scrollHeight - page.clientHeight);
    };
    let over = fit(0), more = 0;
    for (let pass = 0; pass < 4 && over > 0; pass++) {
      const width = main.offsetWidth;
      more += over;
      over = fit(more);
      if (main.offsetWidth === width) break;   // as small as the player goes
    }
    if (over > 0 && more > 0) fit(0);
    shownCaption = null;
    paintCaption();
  }
  let fitting = false;
  addEventListener('resize', () => {
    if (fitting) return;
    fitting = true;
    requestAnimationFrame(() => { fitting = false; fitCaption(); });
  });

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
  if (document.body.dataset.sound === 'off') player.setMuted(true);   // a one-file reel with no recordings starts quiet

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
  takeClips();   // any that were left before the player was ready to take them
  fitCaption();
  requestAnimationFrame(frame);

  // a small window into the player, for automated checks and the curious
  window.pixelreel = {
    reel, player,
    get source() { return narrator.lastSource; },
    clipFor: (i) => clipNow(scenes[i])
  };
  document.body.dataset.ready = 'true';
}

start().catch((err) => {
  console.error(err);
  showError(err.message || String(err));
});
