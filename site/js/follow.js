// Following the words. When every word the narrator says is written under the picture (the
// sound is off, or "Every word" is chosen in Make it comfy), the sentence being said is
// marked as it is said, so a reader keeps their place without hunting for it. A recording
// does not say when each sentence starts, so it is worked out: each sentence is given a
// share of the line's time in proportion to its letters. That is near enough for a
// sentence, though it would not be for a word.
// Nothing here touches the page, so Node can test it.

/** The silence at the start of a recording, in seconds. */
const LEAD = 0.12;

/**
 * A line of narration as its sentences, each with the space that follows it: joined, they
 * are the line again. A full stop inside a number ("2.5") ends nothing.
 */
export function sentencesOf(text) {
  const line = String(text), sentences = [], ends = /[.!?]+["')\]]*\s+/g;
  let from = 0;
  for (let end = ends.exec(line); end; end = ends.exec(line)) {
    sentences.push(line.slice(from, end.index + end[0].length));
    from = end.index + end[0].length;
  }
  if (from < line.length) sentences.push(line.slice(from));
  return sentences;
}

/**
 * Which of a line's `sentences` is being said `elapsed` seconds into a line that takes
 * `seconds` to say. The last one, once it is reached, for as long as the scene lasts; -1 for
 * a line with no sentences.
 */
export function sentenceAt(sentences, seconds, elapsed) {
  const letters = sentences.map((sentence) => sentence.replace(/\s+/g, '').length || 1), all = letters.reduce((sum, n) => sum + n, 0);
  const speaking = Math.max(0, seconds - LEAD);
  let until = LEAD;
  for (let i = 0; i < letters.length - 1; i++) {
    until += (letters[i] / all) * speaking;
    if (elapsed < until) return i;
  }
  return sentences.length - 1;
}
