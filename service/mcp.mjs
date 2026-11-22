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

/** The tools, as tools/list shows them. */
export function toolList() {
  const reel = reelSchema();
  delete reel.$schema;   // a tool's input is a plain object schema
  return [
    {
      name: 'reel_format',
      title: 'How to write a pixel reel',
      description: 'How to write a reel for make_reel: the fields, every ready-made picture and icon, and how to write for people who find reading hard.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: { title: 'How to write a pixel reel', readOnlyHint: true, openWorldHint: false }
    },
    {
      name: 'make_reel',
      title: 'Make a pixel reel',
      description: 'Makes a pixel reel: a short pixel-art explainer, one idea per scene, narrated by a warm recorded British voice. ' +
        'Takes the reel as JSON (see reel_format) and returns a link to watch it. The voice takes about as long to record as the reel lasts.',
      inputSchema: reel,
      annotations: { title: 'Make a pixel reel', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: SHOWS_PLAYER
    },
    {
      name: 'get_reel',
      title: 'Check on a pixel reel',
      description: 'Says whether a reel is still being recorded, ready to watch, or failed, with its links.',
      inputSchema: ID_INPUT,
      annotations: { title: 'Check on a pixel reel', readOnlyHint: true, openWorldHint: false },
      _meta: SHOWS_PLAYER
    },
    {
      name: 'get_reel_video',
      title: 'Get a pixel reel as a video',
      description: 'Asks for a ready reel as an MP4 file, to send where a web page will not go. Making it takes about a minute; call again to get the link.',
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

/** The guide reel_format returns: built from the pictures themselves, so it never drifts. */
export function formatGuide() {
  const pictures = Object.entries(PICTURES).filter(([type]) => type !== 'image').map(([type, { fields }]) => {
    const list = Object.entries(fields).map(([key, kind]) => `${key}${kind.endsWith('?') ? ' (optional)' : ''}`).join(', ');
    return `- ${type}: ${PICTURE_NOTES[type]} Fields: ${list}.`;
  });
  return [
    `A reel is JSON: { "format": "${REEL_FORMAT}", "title": "...", "scenes": [ ... ] }, and optionally "intro" (shown before Play) and "transition".`,
    'Each scene has "title" (one to three words), "caption" (one short sentence on screen), "say" (one or two short spoken sentences, 15 to 45 words; leave it out to have the caption read) and "picture".',
    '',
    'Write for people who find reading hard: 4 to 10 scenes, one idea each, short everyday words, honest claims only. Plain dashes, no emoji.',
    '',
    'Pictures (every scene should have one; mix them so the reel moves):',
    ...pictures,
    `Icons: ${ICON_NAMES.join(', ')}.`,
    'A sprite is drawn from rows of letters, one a pixel: k black, w white, r red, g green, b blue, y yellow, o orange, p purple, t teal, s skin, n brown, e grey, c cream, B R N G darker blue, red, brown, green, and . see-through. Keep sprites about 8 to 16 pixels across.',
    '',
    'Transitions: cut (default), fade, dissolve, wipe, slide, blinds, iris, flash, star.',
    `Limits here: at most ${LIMITS.scenes} scenes, ${LIMITS.sayWords} spoken words and ${LIMITS.captionChars} caption characters a scene, ${LIMITS.listItems} items in a picture, under ${LIMITS.minutes} minutes in all, and no images from elsewhere.`,
    `Reels are kept for ${KEEP_DAYS} days, unlisted: only people with the link can watch.`
  ].join('\n');
}

const text = (str) => ({ content: [{ type: 'text', text: str }] });
const failure = (str) => ({ ...text(str), isError: true });

/** The links for a reel. */
const links = (baseUrl, id) => ({ watch: `${baseUrl}/r/${id}`, video: `${baseUrl}/r/${id}/video.mp4` });

/** A reel's status in plain words, with its links, as a tool result. */
function describe(status, baseUrl) {
  const { watch, video } = links(baseUrl, status.id);
  const said = {
    queued: `"${status.title}" is waiting its turn to be recorded. The page will play it as soon as the voice is ready: ${watch}`,
    recording: `The voice for "${status.title}" is being recorded now. The page will play it as soon as it is ready: ${watch}`,
    ready: `"${status.title}" is ready: ${status.scenes} scenes, ${clockTime(status.seconds * 1000)}. Watch it at ${watch}`,
    failed: `"${status.title}" could not be made. ${status.error ?? ''}`.trim()
  }[status.state];
  const extra = status.state === 'ready' && status.video === 'ready' ? ` The video is at ${video}` : '';
  return {
    ...text(said + extra + ` (reel id ${status.id}; kept until ${status.expires.slice(0, 10)}.)`),
    structuredContent: { ...status, watch, ...(status.video === 'ready' ? { video } : {}) }
  };
}

/**
 * An MCP server for `reels` (a Reels), giving links on `baseUrl` (such as https://pixelreel.example).
 * `limits` ({ reels, videos }, each a RateLimit) count what `client` (the caller's address) asks for.
 */
export function createMcpServer({ reels, baseUrl, client = 'local', limits = null, version = '0.1.0' }) {
  const server = new Server(
    { name: 'pixelreel', title: 'Pixel Reel', version },
    { capabilities: { tools: {}, resources: {} }, instructions: 'Pixel Reel makes short narrated pixel-art explainers from a list of scenes. reel_format explains how to write one.' }
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
        const refused = limits?.reels.hit(client);
        if (refused) return failure(`No more reels for now. ${refused}`);
        try {
          return describe(await reels.create(args), baseUrl);
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
        if (status.video === 'ready') return { ...text(`The video of "${status.title}" is ready: ${links(baseUrl, status.id).video}`), structuredContent: { id: status.id, video: links(baseUrl, status.id).video } };
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
