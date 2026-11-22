// What the service will make, and how often: sizes that keep a reel short enough to watch
// and quick to record, and rate limits so one caller (or a runaway agent) cannot use it all
// up or run up a bill. Local tools have no such limits; these apply only to the service.
import { clockTime, countWords, estimateSpeechMs, GAP_MS } from '../src/timing.js';

export const LIMITS = {
  scenes: 12,          // a reel explains one thing; more scenes means two reels
  sayWords: 70,        // per scene: about 30 seconds of speech
  captionChars: 160,   // per scene: two lines on a phone
  titleChars: 80,
  listItems: 8,        // list, terminal, code and chat pictures
  minutes: 4           // the whole reel, pauses included
};

/** Everything about a checked reel (from reelFromData) and its raw JSON that is past the service's limits. */
export function limitProblems(reel, raw) {
  const problems = [];
  if (reel.scenes.length > LIMITS.scenes) problems.push(`scenes: ${reel.scenes.length} is too many; a reel here has at most ${LIMITS.scenes}. Explain one thing, or make two reels.`);
  if (reel.title.length > LIMITS.titleChars) problems.push(`title: keep it to ${LIMITS.titleChars} characters`);
  if (raw.images && Object.keys(raw.images).length) problems.push('images: a reel made here cannot carry pictures from elsewhere; use the icons, or a sprite of your own');
  let ms = 0;
  reel.scenes.forEach((s, i) => {
    const where = `scene ${i + 1}`;
    if (countWords(s.say) > LIMITS.sayWords) problems.push(`${where}: say has ${countWords(s.say)} words; keep it to ${LIMITS.sayWords}, or split the scene in two`);
    if (s.caption.length > LIMITS.captionChars) problems.push(`${where}: caption has ${s.caption.length} characters; keep it to ${LIMITS.captionChars}`);
    const picture = raw.scenes[i]?.picture;
    for (const key of ['items', 'lines', 'messages']) {
      if (Array.isArray(picture?.[key]) && picture[key].length > LIMITS.listItems) problems.push(`${where}: picture.${key} has ${picture[key].length}; keep it to ${LIMITS.listItems}`);
    }
    ms += estimateSpeechMs(s.say) + GAP_MS;
  });
  if (ms > LIMITS.minutes * 60000) problems.push(`the reel would run about ${clockTime(ms)}; keep it under ${clockTime(LIMITS.minutes * 60000)}, with fewer or shorter scenes`);
  return problems;
}

/**
 * Counts what each caller does in a sliding hour, and what everyone does in a day. hit()
 * says why not, or null and counts it. Kept in memory: a restart forgets, which is fine.
 */
export class RateLimit {
  constructor({ perHour, perDay, now = () => Date.now() }) {
    Object.assign(this, { perHour, perDay, now });
    this.callers = new Map();
    this.day = [];
  }

  hit(caller) {
    const at = this.now();
    this.day = this.day.filter((t) => t > at - 86400000);
    const mine = (this.callers.get(caller) ?? []).filter((t) => t > at - 3600000);
    if (mine.length >= this.perHour) return `That is ${this.perHour} in the last hour from here. Try again in ${Math.ceil((mine[0] + 3600000 - at) / 60000)} minutes.`;
    if (this.day.length >= this.perDay) return 'Pixel Reel has made as many reels as it can today. Try again tomorrow.';
    mine.push(at);
    this.day.push(at);
    this.callers.set(caller, mine);
    if (this.callers.size > 10000) for (const [key, times] of this.callers) if (!times.some((t) => t > at - 3600000)) this.callers.delete(key);
    return null;
  }
}
