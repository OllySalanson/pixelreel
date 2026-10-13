// Checks a reel (the object a reel.js file exports) and fills in its defaults.
// Pure: no DOM, so the same checks run in the browser, in the tools and in the tests.
import { drawPicture, pictureProblems } from './pictures.js';
import { TRANSITIONS } from './transitions.js';

/** A reel name doubles as its folder name under reels/, so keep it URL- and file-safe. */
export const REEL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class ReelError extends Error {
  constructor(problems) {
    super('This reel has problems:\n- ' + problems.join('\n- '));
    this.name = 'ReelError';
    this.problems = problems;
  }
}

/** How captions appear: all at once, or typed out as the narrator speaks. */
export const CAPTION_STYLES = ['plain', 'typewriter'];

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const oneOf = (list) => list.map((v) => `'${v}'`).join(', ');

/**
 * Returns a clean copy of `raw`:
 *   { title, intro, note, transition, captions, images: { name: url },
 *     scenes: [{ title, caption, say, draw, transition, captions }] }
 * `base` is put in front of relative image paths (the reel's folder, for example
 * "reels/my-reel/"). Throws a ReelError listing every problem found, not just the first.
 */
export function normalizeReel(raw, { base = '' } = {}) {
  const problems = [];
  if (!raw || typeof raw !== 'object') throw new ReelError(['the reel file must export an object (export default { ... })']);

  if (!isText(raw.title)) problems.push('title: give the reel a title');
  for (const key of ['intro', 'note']) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') problems.push(`${key}: must be text`);
  }
  const transition = raw.transition ?? 'cut', captions = raw.captions ?? 'plain';
  if (!TRANSITIONS.includes(transition)) problems.push(`transition: must be one of ${oneOf(TRANSITIONS)}`);
  if (!CAPTION_STYLES.includes(captions)) problems.push(`captions: must be one of ${oneOf(CAPTION_STYLES)}`);

  const images = {};
  if (raw.images !== undefined) {
    if (!raw.images || typeof raw.images !== 'object' || Array.isArray(raw.images)) {
      problems.push('images: must be an object of { name: "path/to/picture.png" }');
    } else {
      for (const [name, src] of Object.entries(raw.images)) {
        if (!isText(src)) { problems.push(`images.${name}: must be a path to a picture`); continue; }
        images[name] = /^([a-z][a-z0-9+.-]*:|\/)/i.test(src) ? src : base + src;
      }
    }
  }

  const scenes = [];
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    problems.push('scenes: give the reel at least one scene');
  } else {
    raw.scenes.forEach((s, i) => {
      const where = `scene ${i + 1}`;
      if (!s || typeof s !== 'object') { problems.push(`${where}: must be an object`); return; }
      if (!isText(s.title)) problems.push(`${where}: needs a title`);
      if (!isText(s.caption)) problems.push(`${where}: needs a caption`);
      if (s.say !== undefined && !isText(s.say)) problems.push(`${where}: say must be text (or leave it out to read the caption)`);
      if (s.draw !== undefined && typeof s.draw !== 'function') problems.push(`${where}: draw must be a function draw(t, px)`);
      if (s.transition !== undefined && !TRANSITIONS.includes(s.transition)) problems.push(`${where}: transition must be one of ${oneOf(TRANSITIONS)}`);
      if (s.captions !== undefined && !CAPTION_STYLES.includes(s.captions)) problems.push(`${where}: captions must be one of ${oneOf(CAPTION_STYLES)}`);
      let draw = typeof s.draw === 'function' ? s.draw : defaultDraw;
      if (s.picture !== undefined) {
        const wrong = s.draw !== undefined ? ['give it draw or picture, not both'] : pictureProblems(s.picture, Object.keys(images));
        for (const p of wrong) problems.push(`${where}: ${p}`);
        if (!wrong.length) draw = (t, px) => drawPicture(s.picture, t, px);
      }
      scenes.push({
        title: s.title,
        caption: s.caption,
        say: isText(s.say) ? s.say.trim() : String(s.caption ?? '').trim(),
        draw,
        transition: s.transition ?? transition,
        captions: s.captions ?? captions
      });
    });
  }

  if (problems.length) throw new ReelError(problems);
  return {
    title: raw.title.trim(),
    intro: raw.intro ?? 'Sound will start. Use Next and Back any time.',
    note: raw.note ?? '',
    transition,
    captions,
    images,
    scenes
  };
}

/** A plain title card, for scenes that do not draw their own picture. */
export function defaultDraw(t, px, scene) {
  px.rect('#13203a', 0, 0, px.W, px.H);
  px.sign(scene ? scene.title.toUpperCase() : '', px.W / 2, px.H / 2 - 10, 16);
}

/**
 * Turns an audio manifest (written by npm run voices) into a lookup from a
 * scene's narration text to its clip. Clips are matched by their words, not their
 * position, so reordering scenes keeps their recordings, and a scene whose words have
 * changed since the last render has no clip (the browser's own voice reads it instead).
 */
export function clipLookup(manifest, base = '') {
  const byText = new Map();
  for (const c of manifest?.clips ?? []) {
    if (c && isText(c.text) && isText(c.file)) byText.set(c.text.trim(), { url: base + c.file, seconds: Number(c.seconds) || 0 });
  }
  return (scene) => byText.get(scene.say) ?? null;
}
