// A reel as plain data: the reel.json format. It is the reel.js format without the code, so
// a reel can be written by a tool, an AI agent or a web service and played safely, since
// nothing in it ever runs. Every picture comes from the ready-made ones (pictures.js).
// Pure: no DOM, so the same checks run in the browser, in the tools and in the tests.
import { HAIRS, ICON_NAMES, PERSON_ICONS, PICTURES, SKINS, SPRITE_MAX, TABLE_MAX } from './pictures.js';
import { PALETTE } from './palette.js';
import { CAST, MARKS, MOVES, PLACES, SIZES, SPOTS, STAGE_MAX } from './stage.js';
import { CAPTION_STYLES, LANGUAGES, normalizeReel, ReelError } from './reel.js';
import { TRANSITIONS } from './transitions.js';

/** The format a reel.json names in its "format" field. A new number means a change old readers cannot play. */
export const REEL_FORMAT = 'pixelreel/1';

const REEL_KEYS = ['format', 'title', 'intro', 'note', 'transition', 'captions', 'language', 'images', 'scenes'];
const SCENE_KEYS = ['title', 'caption', 'say', 'picture', 'transition', 'captions'];

/** What each ready-made picture shows, for people and agents choosing one. */
export const PICTURE_NOTES = {
  title: 'A big title dropping in over a night sky, with a line typed underneath.',
  list: 'Items arriving one by one with a tick, or a number, every few seconds.',
  terminal: 'A terminal window. Lines starting with "$ " type out; the rest is output.',
  code: 'An editor that types out the code, with simple highlighting.',
  chat: 'Messages arriving with a typing indicator. The first sender sits on the left.',
  big: 'One big word or number on a paper card, punched in, with a line underneath: for the one number or word the reel turns on. Once in a reel is plenty.',
  image: "One of the reel's own images, named in images, slowly pushing in.",
  icons: 'One to four everyday icons dropping in one by one, each with a label underneath.',
  flow: 'One to four icons joined by arrows, arriving in turn: how one thing leads to the next.',
  compare: 'Two cards side by side: the one to avoid, with a cross, then the one to choose, with a tick.',
  table: 'A small table for things set out in rows and columns (a timetable, a bill, prices, dates): rows arrive one by one, the newest lit.',
  sprite: 'Pixel art of your own from rows of palette letters, scaled up to fill the picture, with an optional label.',
  stage: 'Something happening: a place, a few things standing in it, and moves between them (a letter flies, a barrier rises, coins pile up), each as the narrator says it.'
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
/** How a person icon looks; only woman, man, girl, boy and baby take them (reelFromData checks). */
const LOOK_SCHEMAS = {
  skin: { enum: Object.keys(SKINS), description: `For a ${PERSON_ICONS.join(', ')}: their skin. Leave it out when you do not know, and they get a look of their own.` },
  hair: { enum: Object.keys(HAIRS), description: `For a ${PERSON_ICONS.join(', ')}: their hair. Leave it out when you do not know.` }
};
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
  image: { type: 'string', description: "The name of one of the reel's images." },
  item: {
    type: 'object',
    additionalProperties: false,
    required: ['icon', 'label'],
    properties: { icon: { enum: ICON_NAMES }, label: TEXT, ...LOOK_SCHEMAS }
  },
  items: {
    type: 'array',
    minItems: 1,
    maxItems: 4,
    items: { type: 'object', additionalProperties: false, required: ['icon'], properties: { icon: { enum: ICON_NAMES }, label: TEXT, ...LOOK_SCHEMAS } }
  },
  cells: {
    type: 'array',
    minItems: 1,
    maxItems: TABLE_MAX.rows,
    items: { type: 'array', minItems: TABLE_MAX.minCols, maxItems: TABLE_MAX.cols, items: { ...TEXT, maxLength: TABLE_MAX.cell } },
    description: 'The rows of the table, each a list of short cells, every row with the same number: a word or two, a time, an amount. Such as [["High Street", "9:05"], ["Station", "9:20"]].'
  },
  heads: {
    type: 'array',
    minItems: TABLE_MAX.minCols,
    maxItems: TABLE_MAX.cols,
    items: { ...TEXT, maxLength: TABLE_MAX.cell },
    description: 'A heading for each column, such as ["Stop", "Time"].'
  },
  rows: {
    type: 'array',
    minItems: 1,
    maxItems: SPRITE_MAX.rows,
    items: { type: 'string', maxLength: SPRITE_MAX.cols },
    description: `Rows of pixels, one letter each: ${Object.keys(PALETTE).join(' ')} from the palette, a letter of your own from colours, or "." for see-through. Every row the same length.`
  },
  colours: {
    type: 'object',
    propertyNames: { pattern: '^[^. ]$' },
    additionalProperties: { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' },
    description: 'Letters of your own for the rows, and the colours they stand for, such as { "h": "#6b3e2e" }.'
  }
};

/** The fields of a stage picture, as a schema: stage.js is the final word. */
const STAGE_SCHEMAS = {
  place: { enum: Object.keys(PLACES), description: Object.entries(PLACES).map(([name, says]) => `${name}: ${says}`).join(' ') },
  things: {
    type: 'array',
    minItems: 1,
    maxItems: STAGE_MAX.things,
    description: 'What stands on the stage, each in a spot of its own.',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'is', 'spot'],
      properties: {
        id: { ...TEXT, description: 'A short name of its own, for the moves to use.' },
        is: { enum: [...CAST, ...ICON_NAMES], description: `What it is: ${CAST.join(', ')} (the cast), or an icon.` },
        spot: { enum: Object.keys(SPOTS), description: 'Where it stands, left to right.' },
        up: { type: 'boolean', description: 'True to have it in the air (a cloud, the sun, a plane), not on the ground.' },
        size: { enum: Object.keys(SIZES), description: 'medium unless said; a big thing needs the spots either side of it clear.' },
        label: { ...TEXT, description: `${STAGE_MAX.label} words at most.` },
        flip: { type: 'boolean', description: 'True to face it the other way.' },
        ...LOOK_SCHEMAS
      }
    }
  },
  moves: {
    type: 'array',
    minItems: 1,
    maxItems: STAGE_MAX.moves,
    description: 'What happens, in the order it happens.',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['do'],
      properties: {
        do: { enum: Object.keys(MOVES), description: Object.entries(MOVES).map(([name, m]) => `${name}: ${m.says} (takes ${m.needs.join(', ')})`).join('. ') },
        cue: { ...TEXT, description: 'The words the narrator says as it happens, so it happens then.' },
        at: { type: 'number', minimum: 0, description: 'Seconds into the scene; set from the voice when it is recorded.' },
        who: { type: 'string', description: 'The id of the thing that arrives, says, walks or leaves.' },
        on: { type: 'string', description: 'The id of the thing it happens on.' },
        from: { type: 'string', description: 'The id of the thing it starts from.' },
        to: { type: ['string', 'number'], description: 'The id of the thing it goes to; a spot for walk; a number for count, or 0 to 1 for meter.' },
        what: { enum: ICON_NAMES, description: 'The icon that is sent.' },
        count: { type: 'integer', minimum: 1, maximum: STAGE_MAX.coins, description: 'How many coins.' },
        with: { enum: MARKS, description: 'The badge.' },
        text: { ...TEXT, description: `What is said, ${STAGE_MAX.say} words at most.` },
        before: { type: 'string', description: 'Before a counted number, such as £.' },
        after: { type: 'string', description: 'After a counted number, such as " days".' },
        again: { type: 'boolean', description: 'True to send it again and again.' }
      }
    }
  }
};

/**
 * The reel.json format as a JSON Schema (draft 2020-12), built from the ready-made pictures,
 * so it can never drift from what the player draws. Tools can hand it to an AI agent as the
 * shape to write. A few rules are beyond a schema (an image picture must name one of the
 * reel's images, a sprite's letters must be in the palette or its colours, and a table's
 * rows must be as long as each other and not too wide to read), so reelFromData stays the
 * final word.
 */
export function reelSchema() {
  const pictures = Object.entries(PICTURES).map(([type, { fields }]) => {
    const properties = { type: { const: type } }, required = ['type'];
    for (const [key, want] of Object.entries(fields)) {
      properties[key] = type === 'stage' ? STAGE_SCHEMAS[key] : KIND_SCHEMAS[want.replace('?', '')];
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
      language: { enum: LANGUAGES, default: 'english', description: "The language the reel's words are written in. The player's own buttons and words are then in it too, and a browser reads it aloud in a voice of that language." },
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
