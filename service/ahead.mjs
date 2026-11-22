// When a reel that is still being recorded can start playing. A reel used to wait for its
// last line before anything played, though the first line is ready in a few seconds and the
// recorder reads about as fast as the player plays. So a player may start early, as long as
// the recorder will have each later line ready before the player gets to it. Pure: no files,
// no clock.
import { GAP_MS, MIN_SCENE_MS } from '../src/timing.js';

/** The recorder is taken to be this much slower than it has been so far, to be on the safe side. */
export const MARGIN = 1.25;

/**
 * True if a player that starts now will not catch the recorder up. `lines` are the scenes'
 * lines in order: { seconds, ready }, the length real for a line that is recorded and a guess
 * for one that is not. `pace` is how long the recorder has been taking over a second of
 * speech, and `spent` how long it has been at the line in hand, in seconds. The player
 * reaches a scene after every scene before it (its line, or the least a scene lasts, and the
 * pause after); the recorder has a line ready after the unrecorded lines up to and including
 * it. A recorder that is overdue with the line in hand is not keeping to its pace, so
 * nothing is promised on it.
 */
export function staysAhead(lines, pace, { spent = 0, margin = MARGIN } = {}) {
  if (!lines.length || !lines[0].ready) return false;
  if (lines.every((line) => line.ready)) return true;
  if (!(pace > 0) || !Number.isFinite(pace)) return false;   // nothing to go by yet
  let playAt = 0, readyAt = -Math.max(0, spent);
  for (const line of lines) {
    if (!line.ready) {
      readyAt += line.seconds * pace * margin;
      if (readyAt < 0) return false;   // it should have been done by now
      if (readyAt > playAt) return false;
    }
    playAt += (Math.max(MIN_SCENE_MS, line.seconds * 1000) + GAP_MS) / 1000;
  }
  return true;
}
