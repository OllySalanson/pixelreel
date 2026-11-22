// Peter's pace: how fast a reel is read, chosen in Make it comfy (Slower, Usual, Quicker).
// A player keeps time on a clock of its own, the reel's. Read slower, a second of the reel
// takes longer than a second on the wall; the voice is played at the same rate, so the
// pictures stay with the words. Nothing here touches the page, so Node can test it.

/** How many seconds of a reel pass in one second, at each pace. */
export const PACES = { slow: 0.8, usual: 1, quick: 1.25 };

/** The rate for a pace's name (as kept on <html data-pace>), or the usual one. */
export const rateOf = (pace) => PACES[pace] ?? PACES.usual;

/**
 * A clock and timers for a reel read at a rate that can change. `now()` is the reel's time
 * in milliseconds, which runs `rate` times as fast as the wall's; `timer.set(fn, ms)` waits
 * `ms` of the reel's time. A timer already set keeps the wait it was given, so pause the
 * player round a change of rate: it sets its timers again when it plays.
 */
export function pacedClock({ now = () => performance.now(), set = (fn, ms) => setTimeout(fn, ms), clear = (id) => clearTimeout(id) } = {}) {
  let rate = 1, wallThen = now(), reelThen = 0;
  const reelNow = () => reelThen + (now() - wallThen) * rate;
  return {
    now: reelNow,
    timer: { set: (fn, ms) => set(fn, ms / rate), clear },
    get rate() { return rate; },
    setRate(next) {
      reelThen = reelNow();
      wallThen = now();
      rate = next;
    }
  };
}
