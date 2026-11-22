// Times a reel's pictures to its voice. Whoever writes a reel cannot know how long the
// narrator will take over a line, so the items of a list, a row of icons, a flow, a compare
// or a chat would arrive on a guess: bunched at the start of a long line, or still waiting
// when a short one ends. Once the voice is recorded the service knows how long each line
// lasts, and from the words themselves about when each one is said, so it sets every such
// picture's `start` and `every` to bring each item in as the narrator names it. Pure: no
// files, no clock.
import { clipLookup } from '../src/reel.js';

/** A picture's items never arrive closer together than this, or further apart than SLOWEST, in seconds. */
const QUICKEST = 0.45, SLOWEST = 4;
/** The first item waits at least this long, so the scene's way in has finished. */
const EARLIEST = 0.3;
/** The last item is in at least this long before the narrator finishes, so it can be taken in. */
const TAIL = 0.9;
/** An item lands this long before its word is said: the eye is there when the ear arrives. */
const LEAD = 0.25;
/** The first item never waits longer than this, or this share of the line, whichever is sooner. */
const LONGEST_WAIT = 3.5, WAIT_SHARE = 0.55;
/** The silence at the start of a recording. */
const CLIP_LEAD = 0.12;

/** How far apart a picture's items arrive when its author does not say, as in src/pictures.js. */
const USUAL = { list: 1.4, icons: 1.4, flow: 1.4, compare: 2, chat: 1.8 };
/** A chat shows its typing dots for most of a second before each message. */
const CHAT_QUICKEST = 1;

/** Words too common to tell where in a line a label is spoken. */
const SMALL_WORDS = new Set(('a an and are as at be but by can do for from get go has have how if in into is it its just no not of ' +
  'off on one or our out so than that the their them then there they this to too up was we what when who will with you your').split(' '));

const NUMBER_WORDS = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen',
  20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };

/** The word a number starts with when it is said: 30 is "thirty", 75 "seventy", 142 "one". Null for one too big to guess. */
function numberWord(digits) {
  const n = Number(digits);
  if (n >= 1000) return null;   // "two thousand", or "twenty twenty-six": it depends what it is
  return NUMBER_WORDS[n >= 100 ? Math.floor(n / 100) : n > 20 ? n - (n % 10) : n];
}

/** A word as it is compared: lower case, and without the endings that differ between a label and speech. */
function plain(word) {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w;
}

/** The words of a label that tell where in a line it is said: its numbers as they are spoken, and its words that are not small ones. */
function tellingWords(label) {
  const words = String(label).split(/\s+/).map((word) => {
    const number = /^\D*(\d[\d,]*)/.exec(word);
    if (number) return numberWord(number[1].replace(/,/g, ''));
    const w = plain(word);
    return w.length > 2 && !SMALL_WORDS.has(w) ? w : null;
  });
  return [...new Set(words.filter(Boolean))];
}

/**
 * The words of a line of narration, each with the share of the line (0 to 1) said before it.
 * A letter takes one beat, the gap between words a little, and a comma or a full stop a
 * pause, which is close to how a steady narrator spends the time.
 */
export function spokenWords(say) {
  const words = [];
  let beats = 0;
  // letters of any alphabet: a word with an accent in it is one word
  for (const [, word, after] of String(say ?? '').matchAll(/([\p{L}\p{N}'’]+)([^\p{L}\p{N}'’]*)/gu)) {
    words.push({ word: plain(word), at: beats });
    beats += word.length + 0.6;
    if (/[.!?]/.test(after)) beats += 7;
    else if (/[,;:]|\s-\s/.test(after)) beats += 3.5;
  }
  return words.map((w) => ({ word: w.word, at: beats ? w.at / beats : 0 }));
}

/** What each item of a picture says, in the order they arrive, or null for a picture with nothing to time. */
function labelsOf(picture) {
  switch (picture?.type) {
    case 'list': return picture.items;
    case 'icons':
    case 'flow': return picture.items.map((item) => item.label ?? '');
    case 'compare': return [picture.bad.label, picture.good.label];
    case 'chat': return picture.messages.map(() => '');   // a chat is not read out: its messages keep a steady beat
    default: return null;
  }
}

/**
 * When each label is said, in seconds into a line lasting `seconds`, or null for one the
 * narrator never names. The labels are said in the order they arrive, so the places chosen
 * run forwards through the line: as many of a label's telling words together as can be
 * found, and where that leaves a choice, the earliest.
 */
export function spokenAt(labels, say, seconds) {
  const words = spokenWords(say), speech = Math.max(0, seconds - CLIP_LEAD - 0.3);
  // a word that several labels share ("Red numbers", "Black numbers") tells less about where each one is said
  const wanted = labels.map(tellingWords), shared = new Map();
  for (const word of wanted.flat()) shared.set(word, (shared.get(word) ?? 0) + 1);
  // for each label, every place it could be: [index of the word, how much of the label is said there]
  const places = wanted.map((mine) => {
    const found = [];
    words.forEach(({ word }, i) => {
      if (!mine.includes(word)) return;
      const near = new Set(words.slice(i, i + mine.length + 2).map((w) => w.word));
      found.push([i, mine.filter((w) => near.has(w)).reduce((sum, w) => sum + 1 / shared.get(w), 0)]);
    });
    return found;
  });
  // the best way through: each state is the last word used, with its score, how early it is, and the places chosen
  let ways = [{ last: -1, score: 0, early: 0, picks: [] }];
  for (const found of places) {
    const next = new Map();
    const keep = (way) => {
      const held = next.get(way.last);
      if (!held || way.score > held.score || (way.score === held.score && way.early < held.early)) next.set(way.last, way);
    };
    for (const way of ways) {
      keep({ ...way, picks: [...way.picks, null] });
      for (const [i, weight] of found) {
        if (i > way.last) keep({ last: i, score: way.score + weight, early: way.early + i, picks: [...way.picks, i] });
      }
    }
    ways = [...next.values()];
  }
  const best = ways.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.early < a.early) ? b : a));
  return best.picks.map((i) => (i === null ? null : CLIP_LEAD + words[i].at * speech));
}

const round = (n) => Math.round(n * 10) / 10;

/**
 * The `start` and `every` that bring `count` items in over a line lasting `seconds`. `said`
 * holds when each is named, or null; the items the narrator names set the pace, and the rest
 * fall in step. With none named they keep the pace asked for (`every`, `start`). Either way
 * the first is not kept waiting long, and the last is in before the line ends.
 */
export function fitPace(said, seconds, { every, start, quickest = QUICKEST } = {}) {
  const count = said.length, last = Math.max(EARLIEST, seconds - TAIL);
  const points = said.map((t, i) => [i, t]).filter(([, t]) => t !== null).map(([i, t]) => [i, t - LEAD]);
  let a = start, b = every;
  if (points.length >= 2) {
    // the straight line nearest the items that are named: item i arrives at a + b * i
    const n = points.length, mi = points.reduce((s, [i]) => s + i, 0) / n, mt = points.reduce((s, [, t]) => s + t, 0) / n;
    b = points.reduce((s, [i, t]) => s + (i - mi) * (t - mt), 0) / points.reduce((s, [i]) => s + (i - mi) ** 2, 0);
    b = Math.min(SLOWEST, Math.max(quickest, b));
    a = mt - b * mi;
  } else if (points.length === 1) {
    const [i, t] = points[0];
    if (i > 0) b = Math.min(b, Math.max(quickest, (t - EARLIEST) / i));   // the ones before it fit in before it
    a = t - b * i;
  }
  // an empty picture is dull, so the first item comes in good time; and nothing arrives before the scene has
  const soonest = Math.min(LONGEST_WAIT, seconds * WAIT_SHARE);
  if (a > soonest || a < EARLIEST) {
    a = Math.max(EARLIEST, Math.min(soonest, a));
    // with the first item's time settled, the pace nearest the items that are named
    const later = points.filter(([i]) => i > 0);
    if (later.length) b = Math.min(SLOWEST, Math.max(quickest, later.reduce((s, [i, t]) => s + i * (t - a), 0) / later.reduce((s, [i]) => s + i * i, 0)));
  }
  if (count > 1 && a + b * (count - 1) > last) {
    b = Math.max(quickest, (last - a) / (count - 1));
    a = Math.max(EARLIEST, Math.min(a, last - b * (count - 1)));
  }
  return { start: round(Math.min(a, last)), every: round(b) };
}

/** A picture with its items timed to the `seconds` the narrator takes over `say`. Pictures with nothing to time come back as they are. */
export function pacePicture(picture, say, seconds) {
  const labels = labelsOf(picture);
  if (!labels || !(seconds > 0)) return picture;
  const usual = USUAL[picture.type];
  const pace = fitPace(spokenAt(labels, say, seconds), seconds, {
    every: picture.every ?? usual,
    start: picture.start ?? 0.6,
    quickest: picture.type === 'chat' ? CHAT_QUICKEST : QUICKEST
  });
  return { ...picture, ...pace };
}

/**
 * A reel (reel.json, parsed) with every picture timed to its recording. `manifest` is the
 * recordings' manifest; a scene with no recording keeps its picture as it is.
 */
export function paceReel(raw, manifest) {
  const clipFor = clipLookup(manifest);
  return {
    ...raw,
    scenes: raw.scenes.map((scene) => {
      const say = String(scene.say ?? scene.caption ?? '').trim(), clip = clipFor({ say });
      return scene.picture && clip?.seconds > 0 ? { ...scene, picture: pacePicture(scene.picture, say, clip.seconds) } : scene;
    })
  };
}
