// How long things take. Pure functions, shared by the player and the tests.

/** Pause after a scene's narration ends, before the next scene starts. */
export const GAP_MS = 1200;

/** Speaking rate used to guess how long a line takes when no recording exists. */
export const WORDS_PER_SECOND = 2.5;

/** No scene is shorter than this, even one with very few words. */
export const MIN_SCENE_MS = 4000;

/** Counts the words in a line of narration. */
export function countWords(text) {
  const trimmed = String(text ?? '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** A guess at how long `text` takes to say aloud, in milliseconds. */
export function estimateSpeechMs(text) {
  return Math.max(MIN_SCENE_MS, Math.round((countWords(text) / WORDS_PER_SECOND) * 1000));
}

/**
 * How long a scene's narration lasts: the recorded clip's length when there is one,
 * otherwise a guess from the number of words. Never shorter than MIN_SCENE_MS.
 */
export function narrationMs(scene, clip) {
  if (clip && Number.isFinite(clip.seconds) && clip.seconds > 0) {
    return Math.max(MIN_SCENE_MS, Math.round(clip.seconds * 1000));
  }
  return estimateSpeechMs(scene.say);
}

/**
 * The longest we wait for the browser's own voice to say it has finished. Some browsers
 * never fire the end event, so the player moves on after this rather than stalling.
 */
export function speechWatchdogMs(text) {
  return estimateSpeechMs(text) * 2 + 5000;
}

/**
 * Lays the scenes end to end: where each one starts on the reel's clock and how long it
 * lasts, its narration plus the pause after it. `durations` are narration lengths in ms.
 * Returns { starts, spans, total }, all in milliseconds.
 */
export function timeline(durations, gapMs = GAP_MS) {
  const starts = [], spans = [];
  let at = 0;
  for (const d of durations) {
    starts.push(at);
    const span = Math.max(0, Number(d) || 0) + gapMs;
    spans.push(span);
    at += span;
  }
  return { starts, spans, total: at };
}

/** Which scene is playing `ms` into the reel, and how far into it: { index, offset }. */
export function locate(line, ms) {
  const { starts, total } = line;
  if (!starts.length) return { index: 0, offset: 0 };
  const at = Math.max(0, Math.min(total, Number(ms) || 0));
  let index = starts.length - 1;
  while (index > 0 && starts[index] > at) index--;
  return { index, offset: at - starts[index] };
}

/** A time for people: 83000 becomes "1:23". */
export function clockTime(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Typewriter captions finish typing at this share of the narration, so the words lead the voice. */
export const TYPE_SHARE = 0.7;

/** ...but never type slower than this many characters a second. */
export const TYPE_MIN_CPS = 12;

/** How many characters of `text` a typewriter caption shows `elapsedMs` into narration lasting `narrationMs`. */
export function typedLength(text, elapsedMs, narrationMs) {
  const len = String(text ?? '').length;
  if (!len) return 0;
  const typingMs = Math.min(narrationMs * TYPE_SHARE, (len / TYPE_MIN_CPS) * 1000);
  if (!(typingMs > 0)) return len;
  return Math.max(0, Math.min(len, Math.ceil((len * elapsedMs) / typingMs)));
}
