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

  function quietly(ms, done) {
    const id = timer.set(done, ms);
    return () => timer.clear(id);
  }

  function pickVoice() {
    const voices = speech.getVoices?.() ?? [];
    const base = lang.split('-')[0].toLowerCase();
    return voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase())
      ?? voices.find((v) => v.lang?.toLowerCase().startsWith(base))
      ?? null;
  }

  function aloud(scene, done) {
    if (!speech || !Utterance) { narrator.lastSource = 'timer'; return quietly(narrationMs(scene, null), done); }
    narrator.lastSource = 'browser-voice';
    const u = new Utterance(scene.say);
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

  function speak(index, { muted }, done) {
    const scene = scenes[index];
    const clip = clipFor(scene);
    if (muted) { narrator.lastSource = 'muted'; return quietly(narrationMs(scene, clip), done); }
    if (!clip || !audio) return aloud(scene, done);

    narrator.lastSource = 'clip';
    let stopped = false, fallback = null;
    const fail = () => {
      if (stopped || fallback) return;
      fallback = aloud(scene, done);   // the clip is missing or would not play: read it aloud instead
    };
    audio.onended = () => { if (!stopped && !fallback) done(); };
    audio.onerror = fail;
    audio.src = clip.url;
    audio.currentTime = 0;
    const playing = audio.play();
    if (playing?.catch) playing.catch((err) => { if (err?.name !== 'AbortError') fail(); });
    return () => {
      stopped = true;
      audio.onended = audio.onerror = null;
      audio.pause();
      if (fallback) fallback();
    };
  }

  return narrator;
}
