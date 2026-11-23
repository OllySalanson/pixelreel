// The player on the website: plays a reel inside the markup service/site.mjs writes for it
// (playerHtml). It is the real player underneath (the same timing, narrator, kit and
// transitions as src/main.js), with the site's own buttons round it, and any number can sit
// on one page. Only one talks at a time, and none makes a sound until it is pressed.
import { calm, onComfortChange } from './calm.js';
import { sentenceAt, sentencesOf } from './follow.js';
import { pacedClock, rateOf } from './pace.js';
import { loadReel } from './reels.js';
import { createKit, H, W } from '../../src/kit.js';
import { createNarrator } from '../../src/narrator.js';
import { Player } from '../../src/player.js';
import { clockTime } from '../../src/timing.js';
import { transitionMs } from '../../src/transitions.js';

const FRAME_MS = 50;                          // about 20 frames a second, as in the player itself
const SILENCE = '/site/art/silence.mp3';
const talkers = new Set();                    // everything on the page that can make a sound

let onPhone = null;   // the player whose reel the phone shows on its lock screen: the one that played last

/**
 * What a phone shows on its lock screen, and a car or a watch beside it, while scene `index`
 * of `reel` plays: the scene, the reel it is from, and Reelie.
 */
export const nowPlaying = (reel, index) => ({
  title: `${index + 1}. ${reel.scenes[index].title}`,
  artist: reel.title,
  album: 'Pixel Reel',
  artwork: [192, 512].map((size) => ({ src: `/site/art/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png' }))
});

/**
 * Whether a screen is a phone held on its side: wider than it is tall, too short for a reel
 * with its words and buttons under it, and with no mouse (`mouse` is whether it has one: a
 * small window on a computer is not a phone). There a reel fills the screen when it is played.
 */
export const onItsSide = ({ width, height, mouse = false }) => !mouse && width > height && height <= 500;

/** Quietens everything on the page that is talking, except `keep`. */
export function hush(keep = null) {
  for (const talker of talkers) if (talker !== keep) talker.pause();
}

/** Adds something with a pause() to the things only one of which talks at a time. */
export function addTalker(talker) { talkers.add(talker); }

/**
 * The browser's own voice, which reads a line that has no recording, made to read at a
 * clock's pace too: whatever rate the narrator gives it is the rate at the usual pace.
 */
const pacedUtterance = (clock) => window.SpeechSynthesisUtterance && class extends window.SpeechSynthesisUtterance {
  get rate() { return super.rate; }
  set rate(value) { super.rate = value * clock.rate; }
};

/** Sizes a canvas showing a 320 x 180 picture so each of its pixels is a whole number of the screen's. */
export function fitCanvas(canvas) {
  const wide = canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1);
  const scale = Math.max(2, Math.min(8, Math.ceil(wide / W)));
  if (canvas.width !== W * scale) { canvas.width = W * scale; canvas.height = H * scale; }
}

export class ReelPlayer {
  /**
   * @param {HTMLElement} root   the .reel element playerHtml wrote
   * @param {{ onEnd?: () => void, onPast?: () => boolean }} [options]   onEnd is called when a reel
   *   has played to its end; onPast when Next is pressed on its last scene, and returns true
   *   if it has dealt with it (by moving on to another reel, say)
   */
  constructor(root, { onEnd = () => {}, onPast = () => false } = {}) {
    const find = (cls) => root.querySelector(`.${cls}`);
    this.root = root;
    this.onEnd = onEnd;
    this.onPast = onPast;
    this.canvas = root.querySelector('canvas');
    this.g = this.canvas.getContext('2d');
    this.px = createKit(this.g);
    this.big = find('reel-big');
    this.seek = find('reel-seek');
    this.fill = find('reel-seek-fill');
    this.title = find('reel-title');
    this.time = find('reel-time');
    this.words = find('reel-words');
    this.live = find('reel-live');
    this.playKey = find('reel-play');
    this.soundKey = find('reel-sound');
    this.fullKey = find('reel-full');
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.clock = pacedClock();   // the reel's own clock, which Peter's pace (Make it comfy) slows or quickens
    this.show = null;          // what is loaded: see loadReel
    this.player = null;
    this.intro = true;         // nobody has pressed anything yet
    this.visible = false;
    this.ticking = false;
    this.scrubbing = null;
    // What the page offers when the reel ends: a .reel-end it writes straight after the
    // player (a way to send the reel on, the next one, how to get one). It goes over the last picture.
    this.end = root.nextElementSibling?.matches('.reel-end') ? root.nextElementSibling : null;
    if (this.end) {
      find('reel-screen').append(this.end);
      this.end.querySelector('[data-again]')?.addEventListener('click', () => this.start());
    }
    talkers.add(this);
    root.pixelreel = this;     // a small window into the player, for automated checks and the curious
    this.wire(find('reel-back'), find('reel-next'));
    new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.wake(); }).observe(root);
    new ResizeObserver(() => { fitCanvas(this.canvas); this.paint(performance.now()); }).observe(this.canvas);
    onComfortChange(() => {
      this.setPace();
      if (this.player) this.changed(this.player.state);   // the words under the picture may have been asked for in full
      this.paint(performance.now());
      this.wake();
    });
    this.setPace();
  }

  /** Reads at the pace chosen in Make it comfy, from this moment on, even in the middle of a line. */
  setPace() {
    const rate = rateOf(document.documentElement.dataset.pace);
    if (rate === this.clock.rate) return;
    const playing = this.player?.playing;
    if (playing) this.player.pause();   // its timers were set at the old pace: it sets them again when it plays
    this.clock.setRate(rate);
    this.audio.defaultPlaybackRate = rate;   // a new recording starts at the default rate
    this.audio.playbackRate = rate;
    if (playing) this.player.play();
  }

  wire(back, next) {
    const act = (fn) => () => { if (!this.player) return; this.intro = false; fn(); };
    this.big.onclick = () => { this.start(); this.fillOnItsSide(); };
    this.canvas.onclick = () => this.toggle();
    this.playKey.onclick = () => this.toggle();
    const onward = act(() => {
      if (this.player.index === this.player.count - 1 && this.onPast()) return;
      this.player.next();
    });
    back.onclick = act(() => this.player.back());
    next.onclick = onward;
    this.soundKey.onclick = () => this.player?.toggleMuted();
    if (this.fullKey) {
      this.fullKey.hidden = false;   // it needs this script, so it is not seen without it
      this.fullKey.onclick = () => this.toggleFull();
      this.root.addEventListener('fullscreenchange', () => this.filled(document.fullscreenElement === this.root));
    }
    this.root.addEventListener('keydown', (e) => {
      if (!this.player || e.altKey || e.ctrlKey || e.metaKey || e.target === this.seek) return;
      const onButton = e.target instanceof HTMLButtonElement;
      if (e.key === ' ' && !onButton) { e.preventDefault(); this.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onward(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); act(() => this.player.back())(); }
      else if (e.key.toLowerCase() === 'm') this.player.toggleMuted();
      else if (e.key.toLowerCase() === 'f' && this.fullKey) this.toggleFull();
      else if (e.key === 'Escape' && this.root.classList.contains('is-filling')) { e.preventDefault(); e.stopPropagation(); this.toggleFull(); }   // not the dialog it may be in
    });

    const toPointer = (e) => {
      const box = this.seek.getBoundingClientRect();
      this.player.seek(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * this.show.line.total);
    };
    this.seek.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.player) return;
      e.preventDefault();
      this.seek.focus();
      this.seek.setPointerCapture(e.pointerId);
      this.intro = false;
      this.scrubbing = { resume: this.player.playing };
      this.player.pause();   // scrub with the picture held, then carry on from wherever it lands
      toPointer(e);
    });
    this.seek.addEventListener('pointermove', (e) => { if (this.scrubbing) toPointer(e); });
    const done = () => {
      if (!this.scrubbing) return;
      const { resume } = this.scrubbing;
      this.scrubbing = null;
      if (resume) this.player.play();
    };
    this.seek.addEventListener('pointerup', done);
    this.seek.addEventListener('pointercancel', done);
    this.seek.addEventListener('keydown', (e) => {
      if (!this.player) return;
      const step = { ArrowLeft: -5000, ArrowDown: -5000, ArrowRight: 5000, ArrowUp: 5000, PageDown: -30000, PageUp: 30000 }[e.key];
      const to = step ? this.player.positionMs + step : e.key === 'Home' ? 0 : e.key === 'End' ? this.show.line.total : null;
      if (to === null) return;
      e.preventDefault();
      this.intro = false;
      this.player.seek(to);
    });
  }

  /**
   * Fills the whole screen with the reel, or puts it back. The browser does it where it can
   * (Escape, or its own button, puts it back); where it cannot, as on an iPhone, the reel is
   * laid over the whole page instead, which looks the same.
   */
  toggleFull() {
    if (document.fullscreenElement === this.root) { document.exitFullscreen(); return; }
    if (this.root.classList.contains('is-filling')) { this.filled(false); return; }
    const over = () => this.filled(true, true);
    if (!this.root.requestFullscreen) { over(); return; }
    // a reel is wider than it is tall: a phone that will turn its screen on its side for it, does
    this.root.requestFullscreen().then(() => screen.orientation?.lock?.('landscape')?.catch(() => {}), over);
  }

  /**
   * On a phone held on its side there is no room for a reel with its words under it, so the
   * press that plays it also fills the screen with it, as the button in the corner would.
   * Call it in that press: a browser fills the screen only when asked by one.
   */
  fillOnItsSide() {
    if (this.fullKey && !this.root.classList.contains('is-full') && onItsSide({ width: innerWidth, height: innerHeight, mouse: matchMedia('(pointer: fine)').matches })) this.toggleFull();
  }

  /** Marks the reel as filling the screen or not: `over` when it is laid over the page because the browser would not do it. */
  filled(on, over = false) {
    this.root.classList.toggle('is-full', on);
    this.root.classList.toggle('is-filling', on && over);
    document.documentElement.classList.toggle('reel-filling', on && over);   // the page under it holds still
    this.fullKey.setAttribute('aria-pressed', String(on));
    this.fullKey.setAttribute('aria-label', on ? 'Leave full screen' : 'Fill the screen');
    for (const icon of this.fullKey.children) icon.classList.toggle('on', (icon === this.fullKey.firstElementChild) !== on);
    this.wake();
  }

  /**
   * Lets this player make a sound later, by starting it (silently) now. Phones only let a
   * page play sound from inside a press, so call this in the press, before any waiting.
   */
  unlock() {
    this.audio.src = SILENCE;
    this.audio.play()?.catch(() => {});
  }

  /** Loads the reel called `name` and shows its first scene, ready to play. */
  async load(name) {
    this.stop();
    this.loading = name;
    let show;
    try {
      show = await loadReel(name);
    } catch (err) {
      if (this.loading === name) { this.title.textContent = 'This reel will not play'; this.setWords([err.message], 0); }
      throw err;
    }
    if (this.loading === name) this.open(show);   // unless another reel was asked for while this one loaded
  }

  /** Shows a reel that is already loaded (see showOf in reels.js), ready to play. */
  open(show) {
    this.stop();
    this.show = show;
    const { reel, clipFor, durations, line } = show;
    this.root.dataset.reel = show.name;
    this.root.dataset.opens = show.opens;
    this.canvas.setAttribute('aria-label', `Pictures for: ${reel.title}`);
    const { timer, now } = this.clock;
    this.narrator = createNarrator({ scenes: reel.scenes, clipFor, audio: this.audio, speech: window.speechSynthesis, Utterance: pacedUtterance(this.clock), timer, now });
    this.player = new Player({ count: reel.scenes.length, narrator: this.narrator, durations, onChange: (state) => this.changed(state), timer, now });
    this.intro = true;
    this.wasEnded = false;
    this.shown = -1;
    this.fade = null;
    this.lastT = 0;
    this.previewStart = performance.now();
    this.warmed = new Set();
    this.allWords = null;   // changed() writes the words in: the short captions, or every word Peter says
    this.seek.setAttribute('aria-valuemax', String(Math.round(line.total / 1000)));
    for (const tick of this.seek.querySelectorAll('.tick')) tick.remove();
    for (const at of line.starts.slice(1)) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = `${(100 * at) / line.total}%`;
      this.seek.appendChild(tick);
    }
    fitCanvas(this.canvas);
    this.changed(this.player.state);
    this.wake();
    this.root.dispatchEvent(new CustomEvent('reelopen', { bubbles: true }));   // for anything on the page that waits for a reel to be ready (kept.js)
  }

  /**
   * Every caption goes in the caption's box at once, one showing, so the box is as tall as
   * the longest and never jumps. With `sentences`, each is written a sentence at a time, so
   * that the one being said can be marked (follow).
   */
  setWords(list, on, sentences = false) {
    this.saying = null;
    this.words.replaceChildren(...list.map((text, i) => {
      const p = document.createElement('p');
      if (sentences && i) p.append(...sentencesOf(text).map((sentence) => Object.assign(document.createElement('span'), { textContent: sentence })));
      else p.textContent = text;
      p.classList.toggle('on', i === on);
      return p;
    }));
  }

  /**
   * Marks the sentence being said, when every word the narrator says is written under the
   * picture, so a reader keeps their place. Nothing is marked before the reel starts or
   * once it has ended.
   */
  follow() {
    if (!this.allWords) return;
    const { index, elapsedMs, ended } = this.player, scene = this.show.reel.scenes[index];
    const line = this.words.children[index + 1], seconds = this.show.clipFor(scene)?.seconds ?? this.show.durations[index] / 1000;
    const now = this.intro || ended || !line?.children.length ? null : line.children[sentenceAt([...line.children].map((span) => span.textContent), seconds, elapsedMs / 1000)];
    if (now === this.saying) return;
    this.saying?.classList.remove('now');
    now?.classList.add('now');
    this.saying = now ?? null;
  }

  /** Plays from the start, or carries on. */
  start() {
    if (!this.player) return;
    hush(this);
    this.intro = false;
    this.player.play();
  }

  toggle() {
    if (!this.player) return;
    if (this.player.playing) this.player.pause(); else this.start();
  }

  pause() { this.player?.pause(); }

  /** Stops, and forgets how far it had got. */
  stop() {
    this.loading = null;
    if (!this.player) return;
    this.player.pause();
    this.player.goTo(0);
    this.intro = true;
    this.changed(this.player.state);
  }

  changed(state) {
    const now = performance.now(), { reel, clipFor } = this.show, scenes = reel.scenes;
    if (state.index !== this.shown) {
      const kind = calm() || this.scrubbing || this.shown < 0 ? 'cut' : scenes[state.index].transition;
      this.fade = transitionMs(kind) ? { from: this.shown, kind, start: now, ms: transitionMs(kind), t: this.lastT } : null;
      this.shown = state.index;
      this.previewStart = now;
      const s = scenes[state.index];
      if (!this.intro) this.live.textContent = `Scene ${state.index + 1} of ${scenes.length}: ${s.title}. ${s.caption}`;
      const next = scenes[state.index + 1], clip = next && clipFor(next);
      if (clip && state.started && !this.warmed.has(clip.url)) { this.warmed.add(clip.url); new Audio().src = clip.url; }   // so it starts at once
    }
    if (state.started && state.playing) this.intro = false;
    const label = (key, text) => { for (const span of key.children) span.classList.toggle('on', span.textContent === text); };
    label(this.playKey, state.playing ? 'Pause' : state.ended ? 'Again' : 'Play');
    label(this.soundKey, state.muted ? 'Sound off' : 'Sound on');
    this.soundKey.setAttribute('aria-pressed', String(!state.muted));
    this.big.hidden = !(this.intro || (state.ended && !this.end));   // at the end, the page's own offer stands in for "Play again"
    this.big.lastElementChild.textContent = state.ended ? 'Play again' : 'Play';
    if (this.end) this.end.hidden = !state.ended;
    this.root.classList.toggle('is-playing', state.playing);
    const scene = scenes[state.index];
    this.title.textContent = this.intro ? reel.title : `${state.index + 1}. ${scene.title}`;
    // Under the picture go a few words, which Peter enlarges on. Every word he says goes
    // there instead for anyone who asks for it in Make it comfy (to read along, or because
    // they cannot hear him). Sound on and off change only the sound: swapping the words with
    // it changed their size and moved everything below them.
    const all = document.documentElement.dataset.words === 'all';
    if (all !== this.allWords) {
      this.allWords = all;
      this.root.classList.toggle('all-words', all);
      this.setWords([reel.intro, ...scenes.map((s) => (all ? s.say ?? s.caption : s.caption))], 0, all);
    }
    [...this.words.children].forEach((p, i) => p.classList.toggle('on', i === (this.intro ? 0 : state.index + 1)));
    if (state.ended && !this.wasEnded) {
      this.live.textContent = 'The end.';
      this.onEnd();
    }
    this.wasEnded = state.ended;
    this.tellPhone(state);
    this.paintProgress();
    this.wake();
  }

  /**
   * Tells the phone what is playing, for its lock screen and for the buttons on headphones:
   * the reel and the scene, and what Play, Pause, Next and Back do. A phone shows one thing
   * at a time, so it is the player that played last. A browser with no such thing is left alone.
   */
  tellPhone(state) {
    const phone = navigator.mediaSession;
    if (!phone || !window.MediaMetadata) return;
    if (state.playing && onPhone !== this) {
      onPhone = this;
      this.told = null;
      const button = (name, press) => { try { phone.setActionHandler(name, press); } catch { /* this phone has no such button */ } };
      button('play', () => this.start());
      button('pause', () => this.pause());
      button('previoustrack', () => { this.intro = false; this.player.back(); });
      button('nexttrack', () => {
        this.intro = false;
        if (!(this.player.index === this.player.count - 1 && this.onPast())) this.player.next();
      });
    }
    if (onPhone !== this) return;
    const scene = `${this.show.name} ${state.index}`;
    if (scene !== this.told) {
      this.told = scene;
      phone.metadata = new window.MediaMetadata(nowPlaying(this.show.reel, state.index));
    }
    phone.playbackState = state.playing ? 'playing' : 'paused';
  }

  paintProgress() {
    this.follow();
    const { line, reel } = this.show, at = this.intro ? 0 : this.player.positionMs;
    this.fill.style.width = `${(100 * at) / line.total}%`;
    const second = Math.floor(at / 1000);
    if (second === this.second && this.intro === this.wasIntro) return;
    this.second = second;
    this.wasIntro = this.intro;
    this.time.textContent = this.intro ? clockTime(line.total) : `${clockTime(at)} / ${clockTime(line.total)}`;
    this.seek.setAttribute('aria-valuenow', String(second));
    this.seek.setAttribute('aria-valuetext', `${clockTime(at)} of ${clockTime(line.total)}, scene ${this.player.index + 1}: ${reel.scenes[this.player.index].title}`);
  }

  /** The picture's clock: the narration's while playing or paused part-way; otherwise a quiet loop through the scene (or, when calm, its finished picture). */
  sceneTime(now) {
    const p = this.player;
    if (p.playing || p.ended || p.held) return p.elapsedMs / 1000;
    if (calm()) return this.show.durations[p.index] / 1000;
    return ((now - this.previewStart) % p.timeline.spans[p.index]) / 1000;
  }

  paint(now) {
    if (!this.player) return;
    const { g, px, canvas } = this, scenes = this.show.reel.scenes;
    const draw = (i, t) => {
      try { scenes[i].draw(t, px, scenes[i]); } catch (err) { console.error(`scene ${i + 1} could not draw:`, err); }
    };
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const i = this.player.index, t = this.sceneTime(now);
    if (this.fade && now - this.fade.start >= this.fade.ms) this.fade = null;
    if (this.fade) {
      const { from, kind, start, ms } = this.fade;
      px.transition(kind, (now - start) / ms, () => draw(from, this.fade.t + (now - start) / 1000), () => draw(i, t));
    } else {
      draw(i, t);
    }
    this.lastT = t;
  }

  /** Whether the picture is moving: playing, changing scene, or looping quietly while it waits (unless calm). */
  get moving() {
    return this.player && (this.player.playing || this.fade || (!calm() && !this.player.held && !this.player.ended));
  }

  /** Starts the drawing loop if there is anything to draw, and one is not already running. */
  wake() {
    if (!this.player) return;
    if (!this.ticking && this.visible && this.moving) {
      this.ticking = true;
      let last = 0;
      const frame = (now) => {
        if (!this.visible || !this.moving) { this.ticking = false; this.paint(now); return; }
        requestAnimationFrame(frame);
        if (now - last < FRAME_MS) return;
        last = now;
        this.paintProgress();
        this.paint(now);
      };
      requestAnimationFrame(frame);
    } else if (!this.ticking) {
      this.paint(performance.now());
    }
  }
}
