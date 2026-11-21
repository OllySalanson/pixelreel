// A reel as plain data: the reel.json format. It is the reel.js format without the code, so
// a reel can be written by a tool, an AI agent or a web service and played safely, since
// nothing in it ever runs. Every picture comes from the ready-made ones (pictures.js).
// Pure: no DOM, so the same checks run in the browser, in the tools and in the tests.
import { PICTURES } from './pictures.js';
import { CAPTION_STYLES, normalizeReel, ReelError } from './reel.js';
import { TRANSITIONS } from './transitions.js';

/** The format a reel.json names in its "format" field. A new number means a change old readers cannot play. */
export const REEL_FORMAT = 'pixelreel/1';

const REEL_KEYS = ['format', 'title', 'intro', 'note', 'transition', 'captions', 'images', 'scenes'];
const SCENE_KEYS = ['title', 'caption', 'say', 'picture', 'transition', 'captions'];

/** What each ready-made picture shows, for people and agents choosing one. */
export const PICTURE_NOTES = {
  title: 'A big title dropping in over a night sky, with a line typed underneath.',
  list: 'Items arriving one by one with a tick, or a number, every few seconds.',
  terminal: 'A terminal window. Lines starting with "$ " type out; the rest is output.',
  code: 'An editor that types out the code, with simple highlighting.',
  chat: 'Messages arriving with a typing indicator. The first sender sits on the left.',
  big: 'One huge word or number, punched in, with a line underneath.',
  image: "One of the reel's own images, named in images, slowly pushing in."
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every place in `value` that holds code (a function), as paths such as "scenes[2].draw". */
function codePaths(value, path = '', found = []) {
  if (typeof value === 'function') found.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => codePaths(v, `${path}[${i}]`, found));
  else if (isPlainObject(value)) for (const [key, v] of Object.entries(value)) codePaths(v, path ? `${path}.${key}` : key, found);
  return found;
}

/**
 * Everything that makes `raw` not a reel.json in its own right, beyond the checks every reel
 * gets: the format it names, fields it does not know, and code. Empty when it is fine.
 */
function dataProblems(raw) {
  const problems = [];
  if (raw.format === undefined) problems.push(`format: say which format this is, "format": "${REEL_FORMAT}"`);
  else if (raw.format !== REEL_FORMAT) problems.push(`format: this player reads "${REEL_FORMAT}", not ${JSON.stringify(raw.format)}`);
  for (const key of Object.keys(raw)) {
    if (!REEL_KEYS.includes(key)) problems.push(`${key}: a reel has ${REEL_KEYS.join(', ')}, not ${key}`);
  }
  if (Array.isArray(raw.scenes)) {
    raw.scenes.forEach((s, i) => {
      if (!isPlainObject(s)) return;
      for (const key of Object.keys(s)) {
        if (key === 'draw') problems.push(`scene ${i + 1}: draw is code, which a reel.json cannot hold; give the scene a picture instead`);
        else if (!SCENE_KEYS.includes(key)) problems.push(`scene ${i + 1}: a scene has ${SCENE_KEYS.join(', ')}, not ${key}`);
      }
    });
  }
  for (const path of codePaths(raw)) {
    if (!/^scenes\[\d+\]\.draw$/.test(path)) problems.push(`${path}: a reel.json holds data only, not code`);
  }
  return problems;
}

/**
 * Checks a reel.json (already parsed) and returns it ready to play, exactly as normalizeReel
 * does for a reel.js. Throws a ReelError listing every problem found, not just the first.
 */
export function reelFromData(raw, { base = '' } = {}) {
  if (!isPlainObject(raw)) {
    throw new ReelError([`a reel.json must be one object, such as { "format": "${REEL_FORMAT}", "title": "Tea", "scenes": [ ... ] }`]);
  }
  const problems = dataProblems(raw);
  // Only the fields a reel.json may have go on to the usual checks, so nothing is said twice.
  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map((s) => (isPlainObject(s) ? Object.fromEntries(SCENE_KEYS.filter((k) => k in s).map((k) => [k, s[k]])) : s))
    : raw.scenes;
  try {
    const reel = normalizeReel({ ...raw, scenes }, { base });
    if (!problems.length) return reel;
  } catch (err) {
    if (!(err instanceof ReelError)) throw err;
    problems.push(...err.problems);
  }
  throw new ReelError(problems);
}

/** Reads the text of a reel.json and checks it. Throws a ReelError if it is not JSON or not a reel. */
export function parseReelJson(text, options) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ReelError([`this is not valid JSON: ${err.message}`]);
  }
  return reelFromData(raw, options);
}

const TEXT = { type: 'string', pattern: '\\S' };
const KIND_SCHEMAS = {
  text: TEXT,
  list: { type: 'array', minItems: 1, items: { type: 'string' } },
  messages: {
    type: 'array',
    minItems: 1,
    items: { type: 'object', additionalProperties: false, required: ['from', 'text'], properties: { from: TEXT, text: TEXT } }
  },
  number: { type: 'number', minimum: 0, description: 'Seconds.' },
  flag: { type: 'boolean' },
  image: { type: 'string', description: "The name of one of the reel's images." }
};

/**
 * The reel.json format as a JSON Schema (draft 2020-12), built from the ready-made pictures,
 * so it can never drift from what the player draws. Tools can hand it to an AI agent as the
 * shape to write. A few rules are beyond a schema (an image picture must name one of the
 * reel's images), so reelFromData stays the final word.
 */
export function reelSchema() {
  const pictures = Object.entries(PICTURES).map(([type, { fields }]) => {
    const properties = { type: { const: type } }, required = ['type'];
    for (const [key, want] of Object.entries(fields)) {
      properties[key] = KIND_SCHEMAS[want.replace('?', '')];
      if (!want.endsWith('?')) required.push(key);
    }
    return { title: type, description: PICTURE_NOTES[type], type: 'object', additionalProperties: false, required, properties };
  });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'pixelreel reel',
    description: 'A narrated pixel-art explainer: a list of scenes, each with a title, a caption, words to say and a ready-made picture.',
    type: 'object',
    additionalProperties: false,
    required: ['format', 'title', 'scenes'],
    properties: {
      format: { const: REEL_FORMAT },
      title: { ...TEXT, description: "The reel's name, shown above the player." },
      intro: { type: 'string', description: 'Shown before anyone presses Play.' },
      note: { type: 'string', description: 'Small print under the player.' },
      transition: { enum: TRANSITIONS, default: 'cut', description: 'How every scene enters, unless it says otherwise.' },
      captions: { enum: CAPTION_STYLES, default: 'plain', description: 'Captions all at once, or typed out as the narrator speaks.' },
      images: {
        type: 'object',
        description: 'Pictures the scenes can show, as name: path or URL.',
        additionalProperties: { type: 'string', minLength: 1 }
      },
      scenes: { type: 'array', minItems: 1, items: { $ref: '#/$defs/scene' } }
    },
    $defs: {
      scene: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'caption'],
        properties: {
          title: { ...TEXT, description: 'The heading over the caption.' },
          caption: { ...TEXT, description: 'The words on screen. Short sentences read best.' },
          say: { ...TEXT, description: 'What the narrator says. Leave it out to read the caption aloud.' },
          picture: { $ref: '#/$defs/picture' },
          transition: { enum: TRANSITIONS, description: "How this scene enters, overriding the reel's." },
          captions: { enum: CAPTION_STYLES, description: "Overrides the reel's caption style." }
        }
      },
      picture: { description: 'A ready-made picture. Leave it out for a plain title card.', oneOf: pictures }
    }
  };
}
