// The Pixel Reel connector: an MCP server whose tools let Claude (or any MCP client) make a
// reel from scenes, see how it is getting on, get its MP4 and delete it. Each request gets
// a fresh server over the stateless Streamable HTTP transport, so nothing is held between
// calls except the reels themselves.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { readFileSync } from 'node:fs';
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { pageHtml } from '../scripts/page.mjs';
import { PICTURE_NOTES, REEL_FORMAT, reelSchema } from '../src/format.js';
import { ICON_GROUPS } from '../src/icons.js';
import { HAIRS, PICTURES, SKINS, TABLE_MAX } from '../src/pictures.js';
import { PEOPLE, THING_GROUPS, WEARS } from '../src/library.js';
import { MARKS, MOVES, OWN_MAX, PLACES, SPOTS, STAGE_MAX } from '../src/stage.js';
import { ReelError } from '../src/reel.js';
import { APP_WORDS, LANG_CODES } from '../src/words.js';
import { clockTime } from '../src/timing.js';
import { LIMITS } from './limits.mjs';
import { promptList, promptMessages, WHAT_TO_PUT_IN } from './prompts.mjs';
import { BusyError, KEEP_DAYS, languageName } from './reels.mjs';

/** The player shown inside the chat (an MCP App), and how hosts are told to show it. */
export const PLAYER_URI = 'ui://pixelreel/player.html';
const APP_MIME = 'text/html;profile=mcp-app';
const SHOWS_PLAYER = { ui: { resourceUri: PLAYER_URI } };

/** The in-chat player page for a service at `baseUrl`. Built once per address, as it never changes. */
const players = new Map();
export function playerHtml(baseUrl) {
  if (!players.has(baseUrl)) {
    // the page's own words for while a reel is recorded, in every language a reel can be in, then the page's side of the protocol
    const bridge = `window.pixelreelAppWords = ${JSON.stringify(APP_WORDS).replace(/</g, '\\u003c')};\nwindow.pixelreelLangCodes = ${JSON.stringify(LANG_CODES)};\n${readFileSync(new URL('./app-bridge.js', import.meta.url), 'utf8')}`;
    players.set(baseUrl, pageHtml({ title: 'Pixel Reel', app: { service: baseUrl, bridge } }));
  }
  return players.get(baseUrl);
}

const ID_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', description: "The reel's id, as make_reel gave it, or the reel's link." } }
};

/** A reel's id from what a person or Claude has to hand: the id itself, or the reel's link (https://.../r/<id>, with or without more after it). */
export function reelId(given) {
  const said = typeof given === 'string' ? given.trim() : '';
  return /\/r\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/.exec(said)?.[1] ?? said;
}

/** A kept reel as make_reel takes it: without the timings the service gave its pictures. */
function asWritten(raw) {
  return {
    ...raw,
    scenes: raw.scenes.map((scene) => {
      if (!scene.picture) return scene;
      const picture = { ...scene.picture };
      for (const key of TIMING) delete picture[key];
      if (Array.isArray(picture.moves)) picture.moves = picture.moves.map((move) => Object.fromEntries(Object.entries(move).filter(([key]) => key !== 'at')));
      return { ...scene, picture };
    })
  };
}

/** What Claude is told when it connects, and at the top of make_reel: when a reel is wanted, and how to hand it over. */
const WHEN = 'Use it when someone asks for a pixel reel, or wants something explained so they can watch instead of read: ' +
  'a letter, a bill, a document, a web page, how something works, or the chat so far.';
const HAND_OVER = 'Many people who ask for a reel find reading hard work, so once it is made, answer in one or two short sentences, ' +
  'with the link on a line of its own. Do not list the scenes.';

/**
 * What Claude is told to picture a reel with (PIXELREEL_PICTURES): 'stage', where most scenes
 * show something happening on a stage built from the library, or 'cards', the ready-made cards
 * alone, exactly as Claude was told before the stage (test/fixtures/cards-told.json). Reels
 * already made with a stage play either way.
 */
export const PICTURE_MODES = ['stage', 'cards'];

/** Pictures Claude is not told of: an image (no pictures from elsewhere, limits.mjs), and with cards, the stage. */
const untold = (pictures) => (pictures === 'cards' ? ['image', 'stage'] : ['image']);

/** The timing fields, which a reel made here has no use for: the service times every picture to the voice (pacing.mjs). */
const TIMING = ['every', 'start'];

/**
 * The reel.json format as make_reel's input: the format's own schema, without the fields the
 * service sets itself, and saying what makes a reel good where Claude will read it as it writes.
 */
function reelInput(languages = [], narrators = [], pictures = 'stage') {
  const UNTOLD = untold(pictures);
  const reel = reelSchema();
  delete reel.$schema;   // a tool's input is a plain object schema
  delete reel.properties.images;   // no pictures from elsewhere (limits.mjs)
  reel.required = reel.required.filter((key) => key !== 'format');   // taken as read (make_reel)
  reel.properties.scenes.description = 'Five to seven scenes, one idea each, in the order a person needs them: about 40 seconds in all. If the person asked for a number of scenes or a length, that many.';
  reel.properties.scenes.maxItems = LIMITS.scenes;
  const scene = reel.$defs.scene.properties;
  scene.title.description = 'One to three words.';
  scene.caption.description = 'One short sentence on screen, 12 words at most. Not the same words as say.';
  scene.say.description = 'What Peter, the narrator, says: one or two short sentences, 12 to 25 words, written to be said aloud. Leave it out to read the caption aloud.';
  reel.$defs.picture.description = pictures === 'cards' ? 'A ready-made picture. Give every scene one, and mix them so the reel moves.'
    : 'A ready-made picture. Give every scene one: a stage for whatever can be seen happening, which is most scenes, and a card only for what a card is for.';
  reel.$defs.picture.oneOf = reel.$defs.picture.oneOf.filter((picture) => !UNTOLD.includes(picture.title));
  for (const picture of reel.$defs.picture.oneOf) for (const key of TIMING) delete picture.properties[key];
  const stage = reel.$defs.picture.oneOf.find((picture) => picture.title === 'stage');
  if (stage) delete stage.properties.moves.items.properties.at;   // the service times every move to the voice
  // where Claude picks an icon, what an icon is for: left to itself it made an apple stand for cracking an egg
  for (const picture of reel.$defs.picture.oneOf) {
    if (picture.title === 'icons' || picture.title === 'flow') picture.description += ' Only for things that each have an icon of their own: for anything else (ingredients, steps in words) a list is the better picture.';
    for (const key of ['items', 'bad', 'good']) {
      const slot = picture.properties[key];
      if (slot?.items?.properties?.icon || slot?.properties?.icon) {
        picture.properties[key] = { ...slot, description: 'An icon must show the very thing its label names: a sun for the sun, not for "gentle heat". If no icon shows it, use a list instead. A person is shown as who they are: a woman as woman, not person or man.' };
      }
    }
  }
  if (languages.length) {
    reel.properties.language = {
      enum: ['english', ...languages],
      description: 'The language every word of the reel is written in, for Peter to read it in. Leave it out for English.'
    };
  } else {
    delete reel.properties.language;   // the format lets a reel name its language, but here only English can be read
  }
  if (narrators.length) {
    reel.properties.narrator = {
      enum: ['peter', ...narrators],
      description: 'Who reads the reel aloud. Leave it out for Peter; set it only when the person asks for another voice.'
    };
  }
  if (pictures !== 'cards') reel.properties.wishes = WISHES_INPUT;
  reel.properties.improves = {
    type: 'string',
    description: 'To change a reel: the id of that reel, or its link. Send the whole reel again with the changes; the lines you leave word for word as they were keep their recordings, so it is ready sooner. If you do not have its scenes (it was made in another chat), get_reel gives them.'
  };
  return reel;
}

/** What the guide says about languages: `languages` are the ones besides English that Peter can read here. */
function languageAdvice(languages) {
  const elsewhere = 'write the reel in English, and tell the person so in their own language';
  if (!languages.length) return `Peter reads English only. If the person asked in another language, ${elsewhere}.`;
  return `Peter can also read ${languages.map(languageName).join(', ')}. For a reel in one of those, write every word of it in that language ` +
    `(titles, captions, what he says, the pictures' words) and set "language". In any other language, ${elsewhere}.`;
}

/** What the guide says about who reads: `narrators` are the ones besides Peter that may be asked for here. */
function narratorAdvice(narrators) {
  return `The narrator is Peter. If the person asks for a different voice, they can have ${narrators.map(languageName).join(', ')}: set "narrator". ` +
    'Do not offer the choice unless they ask about the voice.';
}

/** The tools, as tools/list shows them. `languages` are the ones besides English that Peter can read here, and `narrators` who else may read. */
export function toolList(languages = [], narrators = [], { pictures = 'stage' } = {}) {
  return [
    {
      name: 'reel_format',
      title: 'How to write a pixel reel',
      description: 'The full guide to writing a reel for make_reel, with a finished reel to learn from: what makes a good one, every ready-made picture and icon, and how to draw a sprite. Read it before your first reel.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: { title: 'How to write a pixel reel', readOnlyHint: true, openWorldHint: false }
    },
    {
      name: 'make_reel',
      title: 'Make a pixel reel',
      description: 'Makes a pixel reel: a short pixel-art explainer that plays like a little cartoon, one idea a scene, read aloud by Peter, a warm recorded British narrator. ' +
        `${WHEN}\n` +
        'The reel is this tool\'s input: 5 to 7 scenes, about 40 seconds in all, or the number or length the person asked for. Each scene has a title, one short caption, what Peter says (12 to 25 plain words) and a picture. ' +
        (pictures === 'cards' ? 'Open on a title picture, mix the pictures, and label a picture\'s items with words Peter says, so each arrives as he says it. reel_format has the full guide and a finished reel.\n'
          : 'Open on a title picture, then show each idea happening on a stage: a place, the people and things in it, and moves between them, each cued to the words Peter says. reel_format has the full guide, the library and a finished reel.\n') +
        'To change a reel you made, send the whole reel again with "improves" set to its id: only the lines you changed are recorded again.\n' +
        'It answers at once with a link. The reel can be played within seconds in the chat, where the player shows, while the rest of the voice is recorded; at the link it plays once the voice is finished, which takes about as long as the reel lasts. ' +
        `Do not wait or check on it. ${HAND_OVER}`,
      inputSchema: reelInput(languages, narrators, pictures),
      annotations: { title: 'Make a pixel reel', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: SHOWS_PLAYER
    },
    {
      name: 'get_reel',
      title: 'Check on a pixel reel',
      description: 'Says whether a reel is still being recorded, ready to watch, or failed, with its links and its scenes. Takes the reel\'s id or its link. For when the person asks how a reel is getting on, or gives you the link of one to change: a reel you have just made plays by itself, so there is no need to check on it.',
      inputSchema: ID_INPUT,
      annotations: { title: 'Check on a pixel reel', readOnlyHint: true, openWorldHint: false },
      _meta: SHOWS_PLAYER
    },
    {
      name: 'get_reel_video',
      title: 'Get a pixel reel as a video',
      description: 'Asks for a ready reel as an MP4 file, to send where a web page will not go, such as WhatsApp. Making it takes about a minute; call again to get the link.',
      inputSchema: ID_INPUT,
      annotations: { title: 'Get a pixel reel as a video', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    {
      name: 'delete_reel',
      title: 'Delete a pixel reel',
      description: `Deletes a reel and its recordings and video now, instead of after ${KEEP_DAYS} days. Its links stop working.`,
      inputSchema: ID_INPUT,
      annotations: { title: 'Delete a pixel reel', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    }
  ];
}

/** How to show people, in the guide: as they are, and never a man, or white, by default. */
const PEOPLE_ADVICE = `People are shown as who they are. woman, man, girl and boy are one person each, and an item can give them "skin" (${Object.keys(SKINS).join(', ')}) and "hair" (${Object.keys(HAIRS).join(', ')}), such as { "icon": "woman", "label": "Laura", "hair": "ginger" }. ` +
  'A woman, or anyone called she, is a woman; a girl a girl. Set skin and hair only from what you were told or were shown; otherwise leave them out, and each person gets a look of their own, the same in every scene for the same label. ' +
  'When you do not know who someone is, do not make them a man: use person (anyone at all, a plain outline), or people (a woman and a man) or children (a girl and a boy) for more than one. In what the narrator says, call each person what they call themselves: she, he or they.';

/** A finished reel for the guide: short, in Peter's voice, with the pictures mixed and a sprite worth drawing. */
export const EXAMPLE_REEL = {
  format: REEL_FORMAT,
  title: 'How to book a doctor\'s appointment',
  transition: 'wipe',
  scenes: [
    { title: 'See a doctor', caption: 'Booking is easier than it sounds.',
      say: 'Need to see a doctor? Booking an appointment is easier than it sounds.',
      picture: { type: 'title', text: 'SEE A DOCTOR', sub: 'How to book' } },
    { title: 'Three ways', caption: 'Ring up, go online, or walk in.',
      say: 'There are three ways to book. Ring up, go online, or just walk in and ask.',
      picture: { type: 'icons', heading: 'THREE WAYS', items: [{ icon: 'phone', label: 'Ring up' }, { icon: 'computer', label: 'Go online' }, { icon: 'house', label: 'Walk in' }] } },
    { title: 'Ring early', caption: 'Phone lines often open at eight.',
      say: 'If you ring, ring early. Many surgeries open their phone lines at eight in the morning.',
      picture: { type: 'big', text: '8 AM', sub: 'ring early' } },
    { title: 'Have ready', caption: 'Your name, your date of birth, and what is wrong.',
      say: 'Have a few things ready. Your name, your date of birth, and a word or two about what is wrong.',
      picture: { type: 'list', heading: 'HAVE READY', items: ['Your name', 'Date of birth', 'What is wrong'] } },
    { title: 'Write it down', caption: 'Write the time down straight away.',
      say: 'When they give you a time, don\'t trust your memory. Write it down, straight away.',
      picture: { type: 'compare', bad: { icon: 'question', label: 'Memory' }, good: { icon: 'calendar', label: 'Write it down' } } },
    { title: 'All booked', caption: 'Turn up a few minutes early.',
      say: 'And that\'s it. Turn up a few minutes early, and let them look after you.',
      picture: { type: 'sprite', label: 'ALL BOOKED', rows: [
        '.....kkkkkk.....',
        '....k......k....',
        '.kkkkkkkkkkkkkk.',
        'kwwwwwwwwwwwwwwk',
        'kwwwwwwrrwwwwwwk',
        'kwwwwwwrrwwwwwwk',
        'kwwwwrrrrrrwwwwk',
        'kwwwwrrrrrrwwwwk',
        'kwwwwwwrrwwwwwwk',
        'kwwwwwwrrwwwwwwk',
        'kwwwwwwwwwwwwwwk',
        '.kkkkkkkkkkkkkk.'
      ] } }
  ]
};

/** The example as the guide shows it: a scene a line, and the sprite's rows under each other so the drawing can be seen. */
function exampleJson(example = EXAMPLE_REEL) {
  const { scenes, ...rest } = example;
  const line = (scene) => {
    const rows = scene.picture.type === 'sprite' ? scene.picture.rows : null;
    const flat = JSON.stringify(scene);
    return rows ? flat.replace(JSON.stringify(rows), `[\n      ${rows.map((r) => JSON.stringify(r)).join(',\n      ')}\n    ]`) : flat;
  };
  return `${JSON.stringify(rest).slice(0, -1)},"scenes":[\n  ${scenes.map(line).join(',\n  ')}\n]}`;
}

/** What Claude may say it wished the library had: a few short names. */
const WISHES_INPUT = {
  type: 'array',
  maxItems: 5,
  items: { type: 'string', maxLength: 40 },
  description: 'Things you wanted on a stage that the library does not have (you drew your own, or used something near it), such as "gas meter" or "wheelchair": they are drawn for later reels. Leave it out when the library had all you needed.'
};

/** What Claude is told about the stage: the one question, the rules, and the library. Built from the library itself, so it never drifts. */
function STAGE_GUIDE() {
  return [
    'Pictures: show what is happening, not a sign for it. For every scene ask one question: what is happening here? Then show it on a stage: a place, the people and things in it, and what passes between them. Most scenes are a stage.',
    '- Something travels: send it across (a letter flies from the bank to the house; money from you to the shop).',
    '- Someone speaks or calls: a wave from one to the other. Someone says a word or two: say, in a bubble.',
    '- Someone waits: a meter fills over them, or a clock is marked.',
    '- Something is stopped: block it, and send the thing anyway, so it bounces back off the barrier.',
    '- It costs money: pile coins, small or tall; or count the amount up, once, on the thing it belongs to.',
    '- A choice: the things side by side, then a tick on the one to choose and a cross on the other.',
    '- Something works, rings or is switched on: pulse it. Something new turns up: arrive. Something goes: leave. Someone goes somewhere: walk.',
    'Use a card only for what a card is for: a title picture to open; a table for what really is a table (a timetable, the lines of a bill, prices, dates); a list for steps in words that nothing can show; a big picture once at most, for the one number the reel turns on.',
    'Keep one cast and one place for the reel where you can: the same people in the same spots from scene to scene, so it reads as one story. Reelie, the film reel who presents Pixel Reel, can stand at the side (far-left or far-right) and say a word or two in some scenes; never let Reelie stand for anything else.',
    `Words on a stage are labels only: ${STAGE_MAX.label} words at most under a thing, ${STAGE_MAX.say} in a bubble. Never a sentence in a picture: Peter says the sentences.`,
    'Use a thing only for what it really is: a house is a home, never a computer; a music note is music, never an answer. If the library has nothing that is the thing, draw a small one yourself (a thing with "rows" instead of "is"), and put its name in "wishes", so it is drawn for later reels.',
    'Give every move a "cue": the words Peter says as it happens, copied from "say". The service times the move to them, so the letter flies as Peter says "sends a letter".',
    '',
    `A stage is { "type": "stage", "place", "things", "moves" }:`,
    `- place, one of: ${Object.entries(PLACES).map(([name, says]) => `${name} (${says.replace(/\.$/, '')})`).join('; ')}.`,
    `- things: 1 to ${STAGE_MAX.things}, each { "id": a short name of its own, "is": what it is, "spot": ${Object.keys(SPOTS).join(', ')} }, one thing to a spot on the ground, and one more in the air above it with "up": true (a cloud, a letter on its way, a plane). Optional: "label" (${STAGE_MAX.label} words at most), "size": "big" (needs the spots either side clear, and not at either end), "flip": true to face the other way.`,
    `- People are ${Object.keys(PEOPLE).join(', ')} (person is an outline: anyone at all). A person takes "skin" (${Object.keys(SKINS).join(', ')}), "hair" (${Object.keys(HAIRS).join(', ')}) and "wears", which says what they do: ${Object.entries(WEARS).filter(([, w]) => w).map(([name, w]) => `${name} (${w.says})`).join(', ')}. Show people as who they are: a woman as woman, a man as man, an older person as older-woman or older-man. Set skin and hair only from what you were told; left out, each gets a look of their own, the same in every scene for the same label. When you do not know who someone is, use person, never a man by default.`,
    `- The library, by what things are about: ${Object.entries(THING_GROUPS).map(([group, names]) => `${group}: ${names.join(', ')}`).join('. ')}. Any icon (below) can stand on a stage too. And reelie.`,
    `- A thing of your own: instead of "is", "rows" (and "colours" for letters of your own), as a sprite's, at most ${OWN_MAX.cols} across and ${OWN_MAX.rows} down, outlined in k.`,
    `- moves: 1 to ${STAGE_MAX.moves}, in the order they happen, each { "do", "cue", ... }:`,
    ...Object.entries(MOVES).map(([name, m]) => `  - ${name} (${m.needs.join(', ')}): ${m.says}.`),
    `  "who", "on" and "from" are a thing's id; "to" is a thing's id (a spot for walk, a number for count, 0 to 1 for meter); "what" is a thing from the library or an icon; "with" is ${MARKS.join(', ')}.`,
    ''
  ];
}

/** A finished reel for the guide, with the stage: one cast and one place, each move on Peter's words. */
export const EXAMPLE_STAGE_REEL = {
  format: REEL_FORMAT,
  title: 'Your gas bill',
  transition: 'wipe',
  scenes: [
    { title: 'Your gas bill', caption: 'What it says, and what to do.',
      say: 'Your gas bill has come. Here\'s what it says, and what to do about it.',
      picture: { type: 'title', text: 'GAS BILL', sub: 'What to do' } },
    { title: 'It arrives', caption: 'The bill covers three months.',
      say: 'Every three months, the gas company sends you a bill for the gas you used.',
      picture: { type: 'stage', place: 'street', things: [
        { id: 'home', is: 'house', spot: 'left', label: 'Your home' }, { id: 'meter', is: 'gas-meter', spot: 'middle' },
        { id: 'gas', is: 'bank', spot: 'right', label: 'Gas company' }, { id: 'reelie', is: 'reelie', spot: 'far-right' }],
      moves: [{ do: 'flow', from: 'gas', to: 'home', cue: 'gas you used' }, { do: 'send', what: 'bill', from: 'gas', to: 'home', cue: 'sends you a bill' }] } },
    { title: 'You owe', caption: 'You paid less than you used.',
      say: 'You paid a hundred and eighty pounds, but used more, so you owe eighty one pounds.',
      picture: { type: 'stage', place: 'street', things: [
        { id: 'home', is: 'house', spot: 'left', label: 'Your home' }, { id: 'gas', is: 'bank', spot: 'right', label: 'Gas company' }],
      moves: [{ do: 'send', what: 'banknote', from: 'home', to: 'gas', again: true, cue: 'You paid' }, { do: 'count', on: 'home', to: 81, before: '£', cue: 'you owe' }] } },
    { title: 'The lines', caption: 'What makes up the bill.',
      say: 'The gas came to two hundred and twenty, the standing charge to twenty nine, and VAT to twelve.',
      picture: { type: 'table', columns: ['What', 'Cost'], rows: [['Gas', '£219.91'], ['Standing charge', '£28.80'], ['VAT', '£12.44']] } },
    { title: 'Read the meter', caption: 'Send a real reading by 20 November.',
      say: 'The reading was a guess. Send them a real one by the twentieth, and the bill is put right.',
      picture: { type: 'stage', place: 'home', things: [
        { id: 'you', is: 'woman', spot: 'left', label: 'You' }, { id: 'meter', is: 'gas-meter', spot: 'middle' },
        { id: 'phone', is: 'phone', spot: 'right', up: true }, { id: 'gas', is: 'bank', spot: 'far-right', label: 'Gas company' }],
      moves: [{ do: 'mark', on: 'meter', with: 'question', cue: 'was a guess' }, { do: 'send', what: 'document', from: 'you', to: 'gas', cue: 'Send them a real one' }, { do: 'mark', on: 'gas', with: 'tick', cue: 'put right' }] } },
    { title: 'Talk to them', caption: 'Hard to pay? Ring them.',
      say: 'Finding it hard to pay? Ring them. They can spread the cost, so don\'t wait.',
      picture: { type: 'stage', place: 'home', things: [
        { id: 'reelie', is: 'reelie', spot: 'far-left' }, { id: 'you', is: 'woman', spot: 'left', label: 'You' },
        { id: 'gas', is: 'woman', wears: 'suit', spot: 'far-right', label: 'Gas company' }],
      moves: [{ do: 'wave', from: 'you', to: 'gas', cue: 'Ring them' }, { do: 'say', who: 'gas', text: 'We can help', cue: 'spread the cost' }, { do: 'say', who: 'reelie', text: 'Don\'t wait!', cue: 'don\'t wait' }] } }
  ]
};

/** The guide reel_format returns: built from the pictures themselves, so it never drifts. `languages` are the ones besides English that Peter can read here. */
export function formatGuide(languages = [], narrators = [], { pictures: mode = 'stage' } = {}) {
  const UNTOLD = untold(mode), staged = mode !== 'cards';
  const pictures = Object.entries(PICTURES).filter(([type]) => !UNTOLD.includes(type) && type !== 'stage').map(([type, { fields }]) => {
    const list = Object.entries(fields).filter(([key]) => !TIMING.includes(key)).map(([key, kind]) => `${key}${kind.endsWith('?') ? ' (optional)' : ''}`).join(', ');
    return `- ${type}: ${PICTURE_NOTES[type]} Fields: ${list}.`;
  });
  return [
    `A reel is JSON: { "format": "${REEL_FORMAT}", "title": "...", "scenes": [ ... ] }, and optionally "intro" (shown before Play) and "transition".`,
    'Each scene has "title" (one to three words), "caption" (one short sentence on screen, 12 words at most), "say" (what the narrator says: one or two short sentences, 12 to 25 words; leave it out to have the caption read) and "picture".',
    '',
    'What makes a good reel:',
    '- It is short: 5 to 7 scenes, about 40 seconds in all. If the person asks for a number of scenes or a length ("three scenes", "under half a minute"), give them that, not more. One idea a scene, in the order a person needs them. Leave out whatever does not change what they understand or do.',
    '- It sounds like Peter, the narrator: warm, plain, British, a little dry. Short everyday words, written to be said aloud ("It isn\'t." "That\'s it."). No jargon unless the scene explains it.',
    '- It opens on a title picture, and ends on what to do next, or the one thing to remember.',
    '- It is honest: every claim is true to what the person gave you. For money, health or the law, say to check with whoever sent the original.',
    '- It keeps private things private. Anyone with the link can watch, so when you explain someone\'s letter, bill or chat, leave out names, addresses and account or reference numbers unless they ask for them.',
    '- Plain dashes, no emoji.',
    `- ${languageAdvice(languages)}`,
    ...(narrators.length ? [`- ${narratorAdvice(narrators)}`] : []),
    '',
    'What to put in, by what you are given:',
    ...Object.values(WHAT_TO_PUT_IN).map((line) => `- ${line}`),
    '',
    ...(staged ? STAGE_GUIDE() : []),
    staged ? 'The cards, for what a card is for:' : 'Pictures (give every scene one, and mix them so the reel moves):',
    ...pictures,
    'Icons, by what they are about:',
    ...Object.entries(ICON_GROUPS).map(([group, names]) => `- ${group}: ${names.join(', ')}.`),
    'Pick the icon that means the thing, and keep labels to two or three words. If no icon means it, do not make one stand for it: use a list, a table or a sprite instead.',
    PEOPLE_ADVICE,
    'The pictures are timed to the voice for you. Label the items of a list, icons, flow or compare with words the narrator says, in the order they are said, and each one arrives as it is spoken. A table\'s rows do the same: say them in order, naming what is in each.',
    `A table is for what is set out in rows and columns: a timetable, a bill, prices, dates, opening hours. "rows" is 1 to ${TABLE_MAX.rows} rows, each a list of ${TABLE_MAX.minCols} to ${TABLE_MAX.cols} short cells, every row the same length, such as [["High Street", "9:05"], ["Station", "9:20"]]; "columns" gives a heading for each column. Keep a cell to a word or two, a time or an amount. Do not make icons stand for days, times or amounts: put them in a table.`,
    'In a title or big picture, keep "text" short: a word or two in capitals, or a number. A big picture is for the one number or word the whole reel turns on (the amount to pay, the date): use it once at most, where that number is said, and not as the usual second scene.',
    'A sprite is drawn from rows of letters, one a pixel: k black, w white, r red, g green, b blue, y yellow, o orange, p purple, t teal, s S d skin (light, medium, deep), n brown, e grey, c cream, B R N G darker blue, red, brown, green, and . see-through. ' +
      'Draw one only to show the thing itself (the numbers on a meter, a volcano, someone doing what the reel is about), 12 to 24 pixels across, outlined in k, with every row the same length. If nobody would know what it is, use icons instead. ' +
      'A person in a sprite is drawn as the people icons are: who they are at a glance (a woman as a woman, such as with longer hair or a dress), and their skin and hair as you were told, or a mix when you were not.',
    '',
    'Transitions: cut (default), fade, dissolve, wipe, slide, blinds, iris, flash, star. One for the whole reel is plenty.',
    'To change a reel, call make_reel again with the whole reel and "improves" set to the earlier reel\'s id or link. Lines left word for word as they were keep their recordings, so change only what was asked for. For a reel from another chat, where you have only its link, get_reel gives its scenes.',
    `Limits here: at most ${LIMITS.scenes} scenes, ${LIMITS.sayWords} spoken words and ${LIMITS.captionChars} caption characters a scene, ${LIMITS.listItems} items in a picture, under ${LIMITS.minutes} minutes in all, and no images from elsewhere.`,
    `Reels are kept for ${KEEP_DAYS} days, unlisted: only people with the link can watch.`,
    '',
    'A finished reel, to show the shape and the voice (write your own; do not copy its words):',
    staged ? exampleJson(EXAMPLE_STAGE_REEL) : exampleJson()
  ].join('\n');
}

const text = (str) => ({ content: [{ type: 'text', text: str }] });
const failure = (str) => ({ ...text(str), isError: true });

/** The links for a reel. */
const links = (baseUrl, id) => ({ watch: `${baseUrl}/r/${id}`, video: `${baseUrl}/r/${id}/video.mp4` });

/** A tool result that says `words`, and carries `data` for clients that read data: some show Claude only that, so the words go in it too. */
const told = (words, data) => ({ ...text(words), structuredContent: { ...data, message: words } });

/** A reel's status in plain words, with its links, as a tool result. */
function describe(status, baseUrl) {
  const { watch, video } = links(baseUrl, status.id);
  const about = `${status.scenes} scenes, about ${clockTime(status.seconds * 1000)}${status.language ? `, in ${languageName(status.language)}` : ''}`;
  const who = status.narrator ? languageName(status.narrator) : 'Peter';
  const plays = `In the chat, where the player shows, it can be played within seconds, while the rest is recorded. At ${watch} it plays once the voice is finished, in about ${clockTime(status.seconds * 1000)}.`;
  const said = {
    writing: `"${status.title}" is still being written. It plays by itself, once it is written and recorded, at ${watch}`,
    queued: `"${status.title}" is made (${about}) and waiting its turn: another reel is being recorded first. ${plays}\n${HAND_OVER} There is no need to check on it.`,
    recording: `"${status.title}" is made (${about}) and ${who} is recording the voice now${status.lines ? ` (${status.recorded} of ${status.lines} lines done)` : ''}. ${plays}\n${HAND_OVER} There is no need to check on it.`,
    ready: `"${status.title}" is ready: ${status.scenes} scenes, ${clockTime(status.seconds * 1000)}. Watch it at ${watch}`,
    failed: `"${status.title}" could not be made. ${status.error ?? ''}`.trim()
  }[status.state];
  const kept = status.kept && status.state !== 'ready' && status.state !== 'failed'
    ? `\n${status.kept} of its lines keep their recordings from the earlier reel, so it will be ready sooner. The earlier reel is still at its own link: delete_reel removes it, if the person no longer wants it.` : '';
  const extra = status.state === 'ready' && status.video === 'ready' ? ` The video is at ${video}` : '';
  return told(said + kept + extra + `\n(reel id ${status.id}; kept until ${status.expires.slice(0, 10)}, and only people with the link can watch.)`,
    { ...status, watch, ...(status.video === 'ready' ? { video } : {}) });
}

/**
 * An MCP server for `reels` (a Reels), giving links on `baseUrl` (such as https://pixelreel.example).
 * `limits` ({ reels, videos }, each a RateLimit) count what `client` (the caller's address) asks for.
 */
export function createMcpServer({ reels, baseUrl, client = 'local', limits = null, version = '0.1.0' }) {
  const art = `${baseUrl}/site/art`;
  const server = new Server(
    {
      name: 'pixelreel', title: 'Pixel Reel', version, websiteUrl: baseUrl,
      description: 'Turns anything wordy into a short pixel-art cartoon, read aloud by a warm recorded narrator: for anyone who would rather watch than read.',
      icons: [{ src: `${art}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] }, { src: `${art}/icon-512.png`, mimeType: 'image/png', sizes: ['512x512'] }]
    },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: `Pixel Reel makes short pixel-art explainers, read aloud by a warm recorded British narrator. ${WHEN} ` +
        `Write the reel with make_reel; reel_format has the full guide. ${HAND_OVER}`
    }
  );
  const languages = reels.languages ?? [], narrators = reels.narrators ?? [], pictures = reels.pictures ?? 'stage';
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList(languages, narrators, { pictures }) }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: promptList({ narrators, languages }) }));
  server.setRequestHandler(GetPromptRequestSchema, async ({ params }) => {
    const prompt = promptMessages(params.name, params.arguments, { narrators, languages });
    if (!prompt) throw new Error(`There is no prompt called ${params.name}`);
    return prompt;
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: PLAYER_URI, name: 'player', title: 'Pixel Reel player', description: 'Plays a reel inside the chat.', mimeType: APP_MIME }]
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
    if (params.uri !== PLAYER_URI) throw new Error(`There is no resource ${params.uri}`);
    const origin = new URL(baseUrl).origin;
    return {
      contents: [{
        uri: PLAYER_URI,
        mimeType: APP_MIME,
        text: playerHtml(baseUrl),
        // it may ask the service whether a reel is ready, and play its recordings; nothing else
        _meta: { ui: { csp: { connectDomains: [origin], resourceDomains: [origin] }, prefersBorder: false } }
      }]
    };
  });
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const args = params.arguments ?? {};
    const id = reelId(args.id);   // the tools that take a reel take its id or its link
    switch (params.name) {
      case 'reel_format':
        return text(formatGuide(languages, narrators, { pictures }));
      case 'make_reel': {
        const refused = limits?.reels.check(client);
        if (refused) return failure(`No more reels for now. ${refused}`);
        try {
          // every reel made here is in the one format, so one that does not say is not sent back for it
          // not part of the reel: which earlier reel this one is a change to, the language it is in, and who reads it
          const { improves, language, narrator, ...reel } = args;
          // with the stage, the things Claude wished the library had: not part of the reel, and kept for the weekly sheet
          const wishes = pictures === 'cards' ? null : reel.wishes;
          if (pictures !== 'cards') delete reel.wishes;
          const word = (value) => (typeof value === 'string' ? value : null);
          const made = await reels.create(reel.format === undefined ? { format: REEL_FORMAT, ...reel } : reel,
            { improves: word(improves) && reelId(improves), language: word(language), narrator: word(narrator), wishes });
          limits?.reels.count(client);   // only a reel that is made counts: one sent back to be fixed does not
          return describe(made, baseUrl);
        } catch (err) {
          if (err instanceof ReelError) return failure(`This reel has problems. Fix them all, then call make_reel again:\n- ${err.problems.join('\n- ')}`);
          if (err instanceof BusyError) return failure(err.message);
          throw err;
        }
      }
      case 'get_reel': {
        const status = await reels.status(id);
        if (!status) return failure(`There is no reel with the id "${id}". It may have been deleted, or kept past its ${KEEP_DAYS} days.`);
        const result = describe(status, baseUrl), raw = status.scenes ? await reels.reel(id) : null;
        if (!raw) return result;
        // its scenes too, so a reel from another chat can be changed: Claude has only its link to go on there
        const reel = asWritten(raw);
        const words = `${result.content[0].text}\nTo change it, send these scenes to make_reel with your changes and "improves": "${id}":\n${JSON.stringify(reel)}`;
        return told(words, { ...result.structuredContent, reel });
      }
      case 'get_reel_video': {
        const before = await reels.status(id);
        if (before?.state === 'ready' && (before.video === 'none' || before.video === 'failed')) {
          const refused = limits?.videos.hit(client);
          if (refused) return failure(`No more videos for now. ${refused}`);
        }
        const status = await reels.requestVideo(id);
        if (!status) return failure(`There is no reel with the id "${id}".`);
        if (status.state === 'failed') return failure(`"${status.title}" could not be made, so it has no video.`);
        if (status.state !== 'ready') return text(`"${status.title}" is still being recorded. Ask for the video once it is ready.`);
        if (status.video === 'ready') return told(`The video of "${status.title}" is ready: ${links(baseUrl, status.id).video}`, { id: status.id, video: links(baseUrl, status.id).video });
        return text(`The video of "${status.title}" is being made. It takes about a minute; ask again for the link.`);
      }
      case 'delete_reel':
        return (await reels.remove(id)) ? text('Deleted. The reel, its recordings and its video are gone, and its links no longer work.')
          : failure(`There is no reel with the id "${id}".`);
      default:
        return failure(`There is no tool called ${params.name}.`);
    }
  });
  return server;
}
