// Who does the talking. A recorded clip when the reel has one for the scene; otherwise
// the browser's own voice; otherwise (or with the sound off) a quiet timer that takes
// about as long as the words would.
import { estimateSpeechMs, narrationMs, speechWatchdogMs } from './timing.js';

/**
 * @param {object} o
 * @param {Array<{ say: string }>} o.scenes
 * @param {(scene: object) => ({ url: string, seconds: number } | null)} o.clipFor
 * @param {HTMLAudioElement} [o.audio]        plays recorded clips
 * @param {SpeechSynthesis} [o.speech]        the browser's voice, if it has one
 * @param {Function} [o.Utterance]            SpeechSynthesisUtterance
 * @param {string} [o.lang]                   preferred voice language for the browser voice
 * @param {{ set: Function, clear: Function }} [o.timer]
 * @param {() => number} [o.now]              a clock in milliseconds
 * @returns {import('./player.js').Narrator & { lastSource: string }}
 */
export function createNarrator({ scenes, clipFor, audio, speech, Utterance, lang = 'en-GB', timer, now = () => Date.now() }) {
  timer ??= { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
  const narrator = { lastSource: 'none', speak };
  let loaded = null;   // the clip the audio element has loaded, so resuming it does not fetch it again

  function quietly(ms, done) {
    const id = timer.set(done, Math.max(0, ms));
    return () => timer.clear(id);
  }

  function pickVoice() {
    const voices = speech.getVoices?.() ?? [];
    const base = lang.split('-')[0].toLowerCase();
    return voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase())
      ?? voices.find((v) => v.lang?.toLowerCase().startsWith(base))
      ?? null;
  }

  /** Reads the scene with the browser's voice, which can only start a line from the top. */
  function aloud(scene, done) {
    const u = new Utterance(scene.say);
    narrator.lastSource = 'browser-voice';
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? lang;
    u.rate = 0.95;
    let over = false, hold = null;
    const startedAt = now();
    const finish = () => { if (!over) { over = true; timer.clear(watchdog); timer.clear(hold); done(); } };
    // A browser with no voices ends (or fails) at once without saying a word. Nobody can say
    // the line faster than this, so an earlier end waits out the rest quietly instead of skipping.
    const finishNoSooner = (ms) => () => {
      const left = ms - (now() - startedAt);
      if (left > 0) { timer.clear(hold); hold = timer.set(finish, left); } else finish();
    };
    // some browsers never report the end of speech at all, so never wait forever
    const watchdog = timer.set(finish, speechWatchdogMs(scene.say));
    u.onend = finishNoSooner(Math.round(estimateSpeechMs(scene.say) * 0.4));
    u.onerror = finishNoSooner(narrationMs(scene, null));
    speech.cancel();
    speech.speak(u);
    return () => { over = true; timer.clear(watchdog); timer.clear(hold); u.onend = u.onerror = null; speech.cancel(); };
  }

  function unrecorded(scene, from, done) {
    if (speech && Utterance) return { stop: aloud(scene, done), from: 0 };
    narrator.lastSource = 'timer';
    return { stop: quietly(narrationMs(scene, null) - from, done), from };
  }

  function speak(index, { muted, from = 0 }, done) {
    const scene = scenes[index];
    const clip = clipFor(scene);
    if (muted) { narrator.lastSource = 'muted'; return { stop: quietly(narrationMs(scene, clip) - from, done), from }; }
    if (!clip || !audio) return unrecorded(scene, from, done);

    narrator.lastSource = 'clip';
    let stopped = false, fallback = null;
    const fail = () => {
      if (stopped || fallback) return;
      loaded = null;
      fallback = unrecorded(scene, 0, done).stop;   // the clip is missing or would not play: read it aloud instead
    };
    audio.onended = () => { if (!stopped && !fallback) done(); };
    audio.onerror = fail;
    if (loaded !== clip.url) { audio.src = clip.url; loaded = clip.url; }
    audio.currentTime = from / 1000;
    const playing = audio.play();
    if (playing?.catch) playing.catch((err) => { if (err?.name !== 'AbortError') fail(); });
    return {
      from,
      stop() {
        stopped = true;
        audio.onended = audio.onerror = null;
        audio.pause();
        if (fallback) fallback();
      }
    };
  }

  return narrator;
}
