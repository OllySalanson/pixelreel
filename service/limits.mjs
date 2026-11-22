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
 * The addresses Claude calls a connector from: Anthropic's published outbound ranges
 * (platform.claude.com/docs/en/api/ip-addresses). Everyone who uses Pixel Reel from Claude
 * reaches the service from one of these, so they cannot be told apart, and are counted together.
 */
export const CLAUDE_ADDRESSES = ['160.79.104.0/21', '153.61.208.0/20'];

/** An IPv4 address (alone, or as IPv6 writes one: ::ffff:192.0.2.1) as a number, or null for anything else. */
function ipv4Number(address) {
  const parts = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(String(address).trim())?.slice(1).map(Number);
  return parts && parts.every((n) => n <= 255) ? parts.reduce((sum, n) => sum * 256 + n, 0) : null;
}

/** True if `address` is in one of `ranges`, each written like 192.0.2.0/24 (or one address). */
export function inRanges(address, ranges) {
  const ip = ipv4Number(address);
  if (ip === null) return false;
  return ranges.some((range) => {
    const [base, bits = '32'] = String(range).split('/'), start = ipv4Number(base), size = 2 ** (32 - Number(bits));
    return start !== null && size >= 1 && Math.floor(ip / size) === Math.floor(start / size);
  });
}

/**
 * Counts what each caller does in a sliding hour, and what everyone does in a day. check()
 * says why not, or null; count() counts one; hit() does both. Callers in `shared.ranges`
 * (many people behind a few addresses, as with Claude) are counted together, against
 * `shared.perHour`. Kept in memory: a restart forgets, which is fine.
 */
export class RateLimit {
  constructor({ perHour, perDay, shared = null, now = () => Date.now() }) {
    Object.assign(this, { perHour, perDay, shared, now });
    this.callers = new Map();
    this.day = [];
  }

  /** Who a caller is counted as, and how many they may make in an hour. */
  bucket(caller) {
    return this.shared && inRanges(caller, this.shared.ranges) ? { key: 'shared', most: this.shared.perHour, together: true } : { key: caller, most: this.perHour, together: false };
  }

  check(caller) {
    const at = this.now(), { key, most, together } = this.bucket(caller);
    this.day = this.day.filter((t) => t > at - 86400000);
    const mine = (this.callers.get(key) ?? []).filter((t) => t > at - 3600000);
    if (mine.length >= most) {
      const wait = `Try again in ${Math.ceil((mine[0] + 3600000 - at) / 60000)} minutes.`;
      return together ? `People using Claude have made ${most} in the last hour between them, which is as many as Pixel Reel can make. ${wait}`
        : `That is ${most} in the last hour from here. ${wait}`;
    }
    if (this.day.length >= this.perDay) return 'Pixel Reel has made as many reels as it can today. Try again tomorrow.';
    return null;
  }

  count(caller) {
    const at = this.now(), { key } = this.bucket(caller);
    this.callers.set(key, [...(this.callers.get(key) ?? []).filter((t) => t > at - 3600000), at]);
    this.day.push(at);
    if (this.callers.size > 10000) for (const [k, times] of this.callers) if (!times.some((t) => t > at - 3600000)) this.callers.delete(k);
  }

  hit(caller) {
    const refused = this.check(caller);
    if (!refused) this.count(caller);
    return refused;
  }
}
