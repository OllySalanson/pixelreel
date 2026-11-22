// Press words to hear them: a choice in Make it comfy. With it on, a press on any heading,
// paragraph or line of the site reads it aloud, in the device's own voice (the reels keep
// Peter's), and a press on a question reads the question and its answer. A second press,
// or anything else that starts to talk, stops it. Sound still only ever starts on a press.
// A page can also have a button, "Read this page to me", that reads the whole of it from
// top to bottom whether or not that choice is on.
// Only startAloud touches the page, so Node can test the rest.
import { calm } from './calm.js';
import { sentencesOf } from './follow.js';
import { rateOf } from './pace.js';
import { addTalker, hush } from './player.js';
import { speechWatchdogMs } from '../../src/timing.js';

/** What can be pressed to be read: the nearest of these round the press. */
export const READABLE = 'h1, h2, h3, p, li, summary, dt, dd, figcaption';
/** What is never read on a press: things that do something of their own when pressed, the players, and what is not for reading. */
export const NOT_READ = 'a, button, input, textarea, select, label, canvas, .reel, dialog, .letter, [aria-hidden="true"]';

const BLOCKS = new Set(['H1', 'H2', 'H3', 'P', 'LI', 'DIV', 'SUMMARY', 'DT', 'DD', 'FIGCAPTION', 'UL', 'OL', 'DETAILS']);
// what has no words to see, and what does something when pressed: a button's words are what it does, not something to read out with the words round it
// (nor is a set of choices: the make page's "Read by Peter in English" opens one, and is read without it)
const UNSEEN = new Set(['SCRIPT', 'STYLE', 'SVG', 'CANVAS', 'NOSCRIPT', 'BUTTON', 'LABEL', 'INPUT', 'SELECT', 'TEXTAREA', 'FIELDSET']);

/**
 * The words of a part of the page as they are read aloud: what someone looking at it can
 * see, in order, with a full stop after a heading or a line that has none, so that the
 * voice stops there for breath. Takes a node of the page, or anything shaped like one.
 */
export function wordsOf(node) {
  let words = '';
  const walk = (part) => {
    if (part.nodeType === 3) { words += part.data; return; }
    if (part.nodeType !== 1) return;
    const tag = String(part.tagName).toUpperCase();
    if (UNSEEN.has(tag) || part.hidden || part.getAttribute?.('aria-hidden') === 'true' || part.classList?.contains('sr-only')) return;
    for (const child of part.childNodes ?? []) walk(child);
    if (BLOCKS.has(tag) && /[^\s.!?:;,]\s*$/.test(words)) words = `${words.trimEnd()}. `;
    else if (BLOCKS.has(tag)) words += ' ';
  };
  walk(node);
  return words.replace(/\s+/g, ' ').trim();
}

/**
 * What a press on `target` reads, or null for a press that is not on words: the nearest
 * heading, paragraph or line round it (`block`) and its `words`. For a question, the block
 * is the question with its answer: both are read by the press that opens it, and the press
 * that closes it has no words.
 */
export function pressed(target) {
  if (!target?.closest || target.closest(NOT_READ)) return null;
  const block = target.closest(READABLE);
  if (!block || block.closest(NOT_READ)) return null;
  const details = block.matches('summary') ? block.parentElement : null;
  return { block: details ?? block, words: details?.open ? '' : wordsOf(details ?? block) };
}

/**
 * A whole page as the parts it is read in, top to bottom: each heading, paragraph and line
 * that can be seen, and each question with its answer, open or not. `scope` is the page's
 * main part. What a press would not read (buttons, players, things out of sight) is left out.
 */
export function partsOf(scope) {
  const parts = [];
  for (const block of scope.querySelectorAll(READABLE)) {
    const question = block.matches('summary');
    if (block.closest(NOT_READ) || block.closest('[hidden]') || block.offsetParent === null) continue;   // not for reading, or not on show
    if (!question && (block.closest('details') || block.querySelector(READABLE))) continue;   // read with its question, or part by part
    const part = question ? block.parentElement : block, words = wordsOf(part);
    if (words) parts.push({ words, about: part });
  }
  return parts;
}

/** The voice for a language among the device's voices: that language exactly, else the same tongue, else the device's choice. */
export function voiceFor(voices, lang) {
  const base = lang.split('-')[0].toLowerCase();
  return voices.find((v) => v.lang?.replace('_', '-').toLowerCase() === lang.toLowerCase())
    ?? voices.find((v) => v.lang?.toLowerCase().startsWith(base))
    ?? null;
}

/**
 * Reads words aloud with the browser's voice, one thing at a time. `say(words, about)`
 * starts, and calls `onChange(about)` then, and `onChange(null)` when it is over or
 * stopped; `about` is what it is reading now, and `sentences` how many it is holding.
 * `sayAll(parts)` reads several things one after another, each with its `words` and what
 * it is `about`, and calls `onChange` as it comes to each. The words go a sentence at a
 * time, since some browsers cut a long speech short, and all of them are handed over at
 * once, in the press that asked: a browser may refuse a voice that starts later.
 * `speech` is speechSynthesis, `Utterance` SpeechSynthesisUtterance, `rate()` the pace chosen.
 */
export function createAloud({ speech, Utterance, lang = 'en-GB', rate = () => 1, onChange = () => {}, timer = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) } }) {
  let turn = 0, about = null, watchdog = null;
  let saying = [];   // kept until they are said: a browser may throw away what nothing holds on to, and never say it has finished
  const over = (mine) => {
    if (mine !== turn || about === null) return;
    timer.clear(watchdog);
    about = null;
    saying = [];
    onChange(null);
  };
  // Told to stop only when it is talking, or has more to say. A precaution: a browser may
  // lose the next thing it is given if it is told to stop just before it (not checked here).
  const hushVoice = () => { if (speech.speaking !== false || speech.pending) speech.cancel(); };
  const stop = () => {
    if (about === null) return;
    const mine = turn;
    hushVoice();
    over(mine);
  };
  const sayAll = (parts) => {
    stop();
    const mine = ++turn, pace = rate(), voice = voiceFor(speech.getVoices?.() ?? [], lang);
    // each sentence, what it is part of, and whether it is the first of that part
    const lines = parts.flatMap(({ words, about: what }) => sentencesOf(words).map((sentence) => sentence.trim()).filter(Boolean).map((sentence, i) => ({ sentence, what, first: i === 0 })));
    if (!lines.length) return;
    about = lines[0].what;
    onChange(about);
    hushVoice();   // anything else the browser's voice was saying
    saying = lines.map(({ sentence, what, first }, i) => {
      const u = new Utterance(sentence);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? lang;
      u.rate = 0.95 * pace;
      // as the voice comes to the next part, that is what it is reading
      if (first && i > 0) u.onstart = () => { if (mine === turn && about !== null) { about = what; onChange(what); } };
      u.onerror = () => over(mine);   // a voice that fails says no more
      if (i === lines.length - 1) u.onend = () => over(mine);
      speech.speak(u);
      return u;
    });
    // some browsers never say that the voice has finished: never leave it marked for ever
    watchdog = timer.set(() => over(mine), speechWatchdogMs(lines.map((line) => line.sentence).join(' ')) / pace);
  };
  const say = (words, what) => sayAll([{ words, about: what }]);
  return { say, sayAll, stop, get about() { return about; }, get sentences() { return saying.length; } };
}

export function startAloud() {
  const root = document.documentElement, speech = window.speechSynthesis, Utterance = window.SpeechSynthesisUtterance;
  if (!speech || !Utterance) return;   // a browser with no voice: the choice stays out of sight
  for (const choice of document.querySelectorAll('[data-needs-speech]')) choice.hidden = false;
  speech.getVoices();   // some browsers only start fetching their voices when first asked
  const on = () => root.dataset.aloud === 'on';
  // "Read this page to me": the buttons that read the whole page, and whether one of them is
  const readers = [...document.querySelectorAll('button[data-read-page]')];
  let wholePage = false;
  const label = () => { for (const button of readers) button.textContent = wholePage ? 'Stop reading' : 'Read this page to me'; };
  const aloud = createAloud({
    speech, Utterance, lang: root.lang || 'en-GB', rate: () => rateOf(root.dataset.pace),
    onChange: (block) => {
      for (const was of document.querySelectorAll('.is-aloud')) was.classList.remove('is-aloud');
      if (block === null && wholePage) { wholePage = false; label(); }
      if (!(block instanceof Element)) return;
      block.classList.add('is-aloud');
      // reading the whole page, it keeps what it is reading in sight
      if (wholePage) block.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
    }
  });
  for (const button of readers) {
    button.addEventListener('click', () => {
      if (wholePage) { aloud.stop(); return; }
      const parts = partsOf(document.querySelector('main'));
      if (!parts.length) return;
      hush();   // any reel that is talking
      wholePage = true;
      label();
      aloud.sayAll(parts);
    });
  }
  addTalker({ pause: aloud.stop });   // a reel that starts to play stops it
  document.addEventListener('click', (e) => {
    if (!on() || String(getSelection?.() ?? '')) return;   // someone selecting words is not asking to hear them
    const found = pressed(e.target);
    if (!found) return;
    if (aloud.about === found.block || !found.words) { aloud.stop(); return; }   // pressed again, or a question closed: stop
    hush();   // any reel that is talking
    if (wholePage) { wholePage = false; label(); }   // a press on some words takes over from the whole page
    aloud.say(found.words, found.block);
  });
  // Choosing it, in Make it comfy or with a button on the page, says so aloud, so it is plain
  // at once that it works; switching it off stops it. (A choice is always a press.)
  let was = on();
  addEventListener('comfort', () => {
    const now = on();
    if (now && !was) { hush(); aloud.say('On. Press any words to hear them.', 'the choice'); } else if (!now) aloud.stop();
    was = now;
  });
  addEventListener('pagehide', () => speech.cancel());   // a voice left talking carries on into the next page
}
