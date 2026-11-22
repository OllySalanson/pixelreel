#!/usr/bin/env node
// Runs the Pixel Reel service: npm run service
// PORT (default 8787) is where it listens; PIXELREEL_URL is the address people reach it at
// (default http://localhost:PORT), used in the links it gives; PIXELREEL_DATA is the folder
// it keeps reels in (default .service-data), unless PIXELREEL_S3_BUCKET names a bucket to keep
// them in instead (with PIXELREEL_S3_ENDPOINT, _REGION, _KEY_ID and _SECRET; see
// docs/deploy.md). PIXELREEL_TRUST_PROXY=1 behind a proxy that sets X-Forwarded-For (or how
// many proxies, if more than one); PIXELREEL_REELS_PER_HOUR (each caller, default 10),
// PIXELREEL_REELS_PER_DAY (everyone, default 300) and PIXELREEL_VIDEOS_PER_HOUR (default 10) set
// the rate limits, and PIXELREEL_CLAUDE_PER_HOUR (default 60) what everyone using Claude may
// make between them, as they all call from the few addresses in PIXELREEL_CLAUDE_ADDRESSES
// (default Anthropic's published ones).
// PIXELREEL_LISTED=1 lets search engines list the website (never the reels); without it every
// page asks them not to, for as long as Pixel Reel is by invitation. Unless NODE_ENV is
// production (as it is in the image), browsers check for a newer copy of the site's files
// every time, so a change shows on the next reload. PIXELREEL_TRY=1 switches on Make it
// right here, where the service has Claude write a reel for a visitor (it needs a credential
// for the Claude API, such as ANTHROPIC_API_KEY, and costs money a reel: docs/service.md);
// PIXELREEL_TRY_MODEL, PIXELREEL_TRY_EFFORT, PIXELREEL_TRIES_PER_HOUR (each visitor, default 3)
// and PIXELREEL_TRIES_PER_DAY (everyone, default 20) set which model, how hard it thinks, and how many.
// Recording needs Pocket TTS set up (scripts/setup-voices.sh) and ffmpeg; videos need
// @napi-rs/canvas.
import { join } from 'node:path';
import { CLAUDE_ADDRESSES, RateLimit } from './limits.mjs';
import { Reels } from './reels.mjs';
import { createService } from './server.mjs';
import { DiskStore, S3Store } from './store.mjs';

const port = Number(process.env.PORT) || 8787;
const baseUrl = process.env.PIXELREEL_URL || `http://localhost:${port}`;
const data = process.env.PIXELREEL_DATA || join(process.cwd(), '.service-data');
const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

const store = process.env.PIXELREEL_S3_BUCKET ? S3Store.fromEnv(process.env) : new DiskStore(data);
const reels = new Reels({ store, log });
await reels.resume();
const sweep = async () => {
  const gone = await reels.sweep().catch((err) => { log(`sweep failed: ${err.message}`); return []; });
  if (gone.length) log(`deleted ${gone.length} expired reel${gone.length === 1 ? '' : 's'}`);
};
await sweep();
setInterval(sweep, 3600_000).unref();

const setting = (name, fallback) => Number(process.env[name]) || fallback;
// everyone using Claude calls from a few addresses of Anthropic's, so they share one, bigger, allowance
const ranges = process.env.PIXELREEL_CLAUDE_ADDRESSES === undefined ? CLAUDE_ADDRESSES : process.env.PIXELREEL_CLAUDE_ADDRESSES.split(',').map((r) => r.trim()).filter(Boolean);
const shared = { ranges, perHour: setting('PIXELREEL_CLAUDE_PER_HOUR', 60) };
const limits = {
  reels: new RateLimit({ perHour: setting('PIXELREEL_REELS_PER_HOUR', 10), perDay: setting('PIXELREEL_REELS_PER_DAY', 300), shared }),
  videos: new RateLimit({ perHour: setting('PIXELREEL_VIDEOS_PER_HOUR', 10), perDay: setting('PIXELREEL_REELS_PER_DAY', 300), shared }),
  tries: new RateLimit({ perHour: setting('PIXELREEL_TRIES_PER_HOUR', 3), perDay: setting('PIXELREEL_TRIES_PER_DAY', 20) })
};

// Make it right here: off unless asked for, because each reel it writes is paid for
let writer = null;
if (process.env.PIXELREEL_TRY === '1') {
  try {
    const { createWriter } = await import('./writer.mjs');
    writer = createWriter({ model: process.env.PIXELREEL_TRY_MODEL || undefined, effort: process.env.PIXELREEL_TRY_EFFORT || undefined, log });
    log(`Make it right here is on: at most ${limits.tries.perDay} reels a day, ${limits.tries.perHour} an hour for each visitor`);
  } catch (err) {
    log(`Make it right here stays off: ${err.message}`);   // no credential for the Claude API, most likely
  }
}

const server = createService({ reels, baseUrl, log, limits, writer, trustProxy: Number(process.env.PIXELREEL_TRUST_PROXY) || 0, listed: process.env.PIXELREEL_LISTED === '1', fresh: process.env.NODE_ENV !== 'production' });
server.listen(port, () => log(`Pixel Reel is at ${baseUrl}: connector ${baseUrl}/mcp, reels kept in ${store}`));

const stop = () => {
  log('stopping: finishing the job in hand first');
  server.close();
  reels.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
