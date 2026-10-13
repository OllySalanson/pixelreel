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
