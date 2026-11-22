// The Pixel Reel connector: an MCP server whose tools let Claude (or any MCP client) make a
// reel from scenes, see how it is getting on, get its MP4 and delete it. Each request gets
// a fresh server over the stateless Streamable HTTP transport, so nothing is held between
// calls except the reels themselves.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { readFileSync } from 'node:fs';
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { pageHtml } from '../scripts/page.mjs';
import { PICTURE_NOTES, REEL_FORMAT, reelSchema } from '../src/format.js';
import { ICON_NAMES, PICTURES } from '../src/pictures.js';
import { ReelError } from '../src/reel.js';
import { clockTime } from '../src/timing.js';
import { LIMITS } from './limits.mjs';
import { BusyError, KEEP_DAYS } from './reels.mjs';

/** The player shown inside the chat (an MCP App), and how hosts are told to show it. */
export const PLAYER_URI = 'ui://pixelreel/player.html';
const APP_MIME = 'text/html;profile=mcp-app';
const SHOWS_PLAYER = { ui: { resourceUri: PLAYER_URI } };

/** The in-chat player page for a service at `baseUrl`. Built once per address, as it never changes. */
const players = new Map();
export function playerHtml(baseUrl) {
  if (!players.has(baseUrl)) {
    const bridge = readFileSync(new URL('./app-bridge.js', import.meta.url), 'utf8');
    players.set(baseUrl, pageHtml({ title: 'Pixel Reel', app: { service: baseUrl, bridge } }));
  }
  return players.get(baseUrl);
}

const ID_INPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', description: 'The reel id that make_reel gave.' } }
};

/** What Claude is told when it connects, and at the top of make_reel: when a reel is wanted, and how to hand it over. */
const WHEN = 'Use it when someone asks for a pixel reel, or wants something explained so they can watch instead of read: ' +
  'a letter, a bill, a document, a web page, how something works, or the chat so far.';
const HAND_OVER = 'Many people who ask for a reel find reading hard work, so once it is made, answer in one or two short sentences, ' +
  'with the link on a line of its own. Do not list the scenes.';

/** The timing fields, which a reel made here has no use for: the service times every picture to the voice (pacing.mjs). */
const TIMING = ['every', 'start'];

/**
 * The reel.json format as make_reel's input: the format's own schema, without the fields the
 * service sets itself, and saying what makes a reel good where Claude will read it as it writes.
 */
function reelInput() {
  const reel = reelSchema();
  delete reel.$schema;   // a tool's input is a plain object schema
  delete reel.properties.images;   // no pictures from elsewhere (limits.mjs)
  reel.required = reel.required.filter((key) => key !== 'format');   // taken as read (make_reel)
  reel.properties.scenes.description = 'Five to seven scenes, one idea each, in the order a person needs them: about 40 seconds in all.';
  reel.properties.scenes.maxItems = LIMITS.scenes;
  const scene = reel.$defs.scene.properties;
  scene.title.description = 'One to three words.';
  scene.caption.description = 'One short sentence on screen, 12 words at most. Not the same words as say.';
  scene.say.description = 'What Peter, the narrator, says: one or two short sentences, 12 to 25 words, written to be said aloud. Leave it out to read the caption aloud.';
  reel.$defs.picture.description = 'A ready-made picture. Give every scene one, and mix them so the reel moves.';
  reel.$defs.picture.oneOf = reel.$defs.picture.oneOf.filter((picture) => picture.title !== 'image');
  for (const picture of reel.$defs.picture.oneOf) for (const key of TIMING) delete picture.properties[key];
  return reel;
}

/** The tools, as tools/list shows them. */
export function toolList() {
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
        'The reel is this tool\'s input: 5 to 7 scenes, about 40 seconds in all. Each scene has a title, one short caption, what Peter says (12 to 25 plain words) and a picture. ' +
        'Open on a title picture, mix the pictures, and label a picture\'s items with words Peter says, so each arrives as he says it. reel_format has the full guide and a finished reel.\n' +
        'It answers at once with a link. The voice takes about as long to record as the reel lasts; the reel then plays by itself, in the chat where the player shows, and at the link. ' +
        `Do not wait or check on it. ${HAND_OVER}`,
      inputSchema: reelInput(),
      annotations: { title: 'Make a pixel reel', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: SHOWS_PLAYER
    },
    {
      name: 'get_reel',
      title: 'Check on a pixel reel',
      description: 'Says whether a reel is still being recorded, ready to watch, or failed, with its links. Only for when the person asks: a reel plays by itself once it is ready.',
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
function exampleJson() {
  const { scenes, ...rest } = EXAMPLE_REEL;
  const line = (scene) => {
    const rows = scene.picture.rows;
    const flat = JSON.stringify(scene);
    return rows ? flat.replace(JSON.stringify(rows), `[\n      ${rows.map((r) => JSON.stringify(r)).join(',\n      ')}\n    ]`) : flat;
  };
  return `${JSON.stringify(rest).slice(0, -1)},"scenes":[\n  ${scenes.map(line).join(',\n  ')}\n]}`;
}

/** The guide reel_format returns: built from the pictures themselves, so it never drifts. */
export function formatGuide() {
  const pictures = Object.entries(PICTURES).filter(([type]) => type !== 'image').map(([type, { fields }]) => {
    const list = Object.entries(fields).filter(([key]) => !TIMING.includes(key)).map(([key, kind]) => `${key}${kind.endsWith('?') ? ' (optional)' : ''}`).join(', ');
    return `- ${type}: ${PICTURE_NOTES[type]} Fields: ${list}.`;
  });
  return [
    `A reel is JSON: { "format": "${REEL_FORMAT}", "title": "...", "scenes": [ ... ] }, and optionally "intro" (shown before Play) and "transition".`,
    'Each scene has "title" (one to three words), "caption" (one short sentence on screen, 12 words at most), "say" (what the narrator says: one or two short sentences, 12 to 25 words; leave it out to have the caption read) and "picture".',
    '',
    'What makes a good reel:',
    '- It is short: 5 to 7 scenes, about 40 seconds in all. One idea a scene, in the order a person needs them. Leave out whatever does not change what they understand or do.',
    '- It sounds like Peter, the narrator: warm, plain, British, a little dry. Short everyday words, written to be said aloud ("It isn\'t." "That\'s it."). No jargon unless the scene explains it.',
    '- It opens on a title picture, and ends on what to do next, or the one thing to remember.',
    '- It is honest: every claim is true to what the person gave you. For money, health or the law, say to check with whoever sent the original.',
    '- It keeps private things private. Anyone with the link can watch, so when you explain someone\'s letter, bill or chat, leave out names, addresses and account or reference numbers unless they ask for them.',
    '- Plain dashes, no emoji.',
    '',
    'Pictures (give every scene one, and mix them so the reel moves):',
    ...pictures,
    `Icons: ${ICON_NAMES.join(', ')}. Pick the one that means the thing, and keep labels to two or three words.`,
    'The pictures are timed to the voice for you. Label the items of a list, icons, flow or compare with words the narrator says, in the order they are said, and each one arrives as it is spoken.',
    'In a title or big picture, keep "text" short: a word or two in capitals, or a number.',
    'A sprite is drawn from rows of letters, one a pixel: k black, w white, r red, g green, b blue, y yellow, o orange, p purple, t teal, s skin, n brown, e grey, c cream, B R N G darker blue, red, brown, green, and . see-through. ' +
      'Draw one only to show the thing itself (the numbers on a meter, a volcano), 12 to 24 pixels across, outlined in k, with every row the same length. If nobody would know what it is, use icons instead.',
    '',
    'Transitions: cut (default), fade, dissolve, wipe, slide, blinds, iris, flash, star. One for the whole reel is plenty.',
    `Limits here: at most ${LIMITS.scenes} scenes, ${LIMITS.sayWords} spoken words and ${LIMITS.captionChars} caption characters a scene, ${LIMITS.listItems} items in a picture, under ${LIMITS.minutes} minutes in all, and no images from elsewhere.`,
    `Reels are kept for ${KEEP_DAYS} days, unlisted: only people with the link can watch.`,
    '',
    'A finished reel, to show the shape and the voice (write your own; do not copy its words):',
    exampleJson()
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
  const about = `${status.scenes} scenes, about ${clockTime(status.seconds * 1000)}`;
  const plays = `It plays by itself as soon as the voice is ready, in the chat where the player shows, and at ${watch}`;
  const said = {
    queued: `"${status.title}" is made (${about}) and waiting its turn to be recorded. ${plays}\n${HAND_OVER} There is no need to check on it.`,
    recording: `"${status.title}" is made (${about}) and Peter is recording the voice now, which takes about as long as the reel lasts. ${plays}\n${HAND_OVER} There is no need to check on it.`,
    ready: `"${status.title}" is ready: ${status.scenes} scenes, ${clockTime(status.seconds * 1000)}. Watch it at ${watch}`,
    failed: `"${status.title}" could not be made. ${status.error ?? ''}`.trim()
  }[status.state];
  const extra = status.state === 'ready' && status.video === 'ready' ? ` The video is at ${video}` : '';
  return told(said + extra + `\n(reel id ${status.id}; kept until ${status.expires.slice(0, 10)}, and only people with the link can watch.)`,
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
      icons: [{ src: `${art}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] }, { src: `${art}/icon-512.png`, mimeType: 'image/png', sizes: ['512x512'] }]
    },
    {
      capabilities: { tools: {}, resources: {} },
      instructions: `Pixel Reel makes short pixel-art explainers, read aloud by a warm recorded British narrator. ${WHEN} ` +
        `Write the reel with make_reel; reel_format has the full guide. ${HAND_OVER}`
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList() }));
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
    switch (params.name) {
      case 'reel_format':
        return text(formatGuide());
      case 'make_reel': {
        const refused = limits?.reels.check(client);
        if (refused) return failure(`No more reels for now. ${refused}`);
        try {
          // every reel made here is in the one format, so one that does not say is not sent back for it
          const made = await reels.create(args.format === undefined ? { format: REEL_FORMAT, ...args } : args);
          limits?.reels.count(client);   // only a reel that is made counts: one sent back to be fixed does not
          return describe(made, baseUrl);
        } catch (err) {
          if (err instanceof ReelError) return failure(`This reel has problems. Fix them all, then call make_reel again:\n- ${err.problems.join('\n- ')}`);
          if (err instanceof BusyError) return failure(err.message);
          throw err;
        }
      }
      case 'get_reel': {
        const status = await reels.status(args.id);
        return status ? describe(status, baseUrl) : failure(`There is no reel with the id "${args.id}". It may have been deleted, or kept past its ${KEEP_DAYS} days.`);
      }
      case 'get_reel_video': {
        const before = await reels.status(args.id);
        if (before?.state === 'ready' && (before.video === 'none' || before.video === 'failed')) {
          const refused = limits?.videos.hit(client);
          if (refused) return failure(`No more videos for now. ${refused}`);
        }
        const status = await reels.requestVideo(args.id);
        if (!status) return failure(`There is no reel with the id "${args.id}".`);
        if (status.state === 'failed') return failure(`"${status.title}" could not be made, so it has no video.`);
        if (status.state !== 'ready') return text(`"${status.title}" is still being recorded. Ask for the video once it is ready.`);
        if (status.video === 'ready') return told(`The video of "${status.title}" is ready: ${links(baseUrl, status.id).video}`, { id: status.id, video: links(baseUrl, status.id).video });
        return text(`The video of "${status.title}" is being made. It takes about a minute; ask again for the link.`);
      }
      case 'delete_reel':
        return (await reels.remove(args.id)) ? text('Deleted. The reel, its recordings and its video are gone, and its links no longer work.')
          : failure(`There is no reel with the id "${args.id}".`);
      default:
        return failure(`There is no tool called ${params.name}.`);
    }
  });
  return server;
}
