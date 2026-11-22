#!/usr/bin/env node
// Runs the Pixel Reel service: npm run service
// PORT (default 8787) is where it listens; PIXELREEL_URL is the address people reach it at
// (default http://localhost:PORT), used in the links it gives; PIXELREEL_DATA is the folder
// it keeps reels in (default .service-data), unless PIXELREEL_S3_BUCKET names a bucket to keep
// them in instead (with PIXELREEL_S3_ENDPOINT, _REGION, _KEY_ID and _SECRET; see
// docs/deploy.md). PIXELREEL_TRUST_PROXY=1 behind a proxy that sets
// X-Forwarded-For; PIXELREEL_REELS_PER_HOUR (each caller, default 10), PIXELREEL_REELS_PER_DAY
// (everyone, default 300) and PIXELREEL_VIDEOS_PER_HOUR (default 10) set the rate limits.
// Recording needs Pocket TTS set up (scripts/setup-voices.sh) and ffmpeg; videos need
// @napi-rs/canvas.
import { join } from 'node:path';
import { RateLimit } from './limits.mjs';
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
const limits = {
  reels: new RateLimit({ perHour: setting('PIXELREEL_REELS_PER_HOUR', 10), perDay: setting('PIXELREEL_REELS_PER_DAY', 300) }),
  videos: new RateLimit({ perHour: setting('PIXELREEL_VIDEOS_PER_HOUR', 10), perDay: setting('PIXELREEL_REELS_PER_DAY', 300) })
};
const server = createService({ reels, baseUrl, log, limits, trustProxy: process.env.PIXELREEL_TRUST_PROXY === '1' });
server.listen(port, () => log(`Pixel Reel is at ${baseUrl}: connector ${baseUrl}/mcp, reels kept in ${store}`));

const stop = () => {
  log('stopping: finishing the job in hand first');
  server.close();
  reels.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
