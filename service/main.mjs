#!/usr/bin/env node
// Runs the Pixel Reel service: npm run service
// PORT (default 8787) is where it listens; PIXELREEL_URL is the address people reach it at
// (default http://localhost:PORT), used in the links it gives; PIXELREEL_DATA is the folder
// it keeps reels in (default .service-data). Recording needs Pocket TTS set up
// (scripts/setup-voices.sh) and ffmpeg; videos need @napi-rs/canvas.
import { join } from 'node:path';
import { Reels } from './reels.mjs';
import { createService } from './server.mjs';
import { DiskStore } from './store.mjs';

const port = Number(process.env.PORT) || 8787;
const baseUrl = process.env.PIXELREEL_URL || `http://localhost:${port}`;
const data = process.env.PIXELREEL_DATA || join(process.cwd(), '.service-data');
const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

const reels = new Reels({ store: new DiskStore(data), log });
await reels.resume();
const sweep = async () => {
  const gone = await reels.sweep().catch((err) => { log(`sweep failed: ${err.message}`); return []; });
  if (gone.length) log(`deleted ${gone.length} expired reel${gone.length === 1 ? '' : 's'}`);
};
await sweep();
setInterval(sweep, 3600_000).unref();

const server = createService({ reels, baseUrl, log });
server.listen(port, () => log(`Pixel Reel is at ${baseUrl}: connector ${baseUrl}/mcp, reels kept in ${data}`));

const stop = () => {
  log('stopping: finishing the job in hand first');
  server.close();
  reels.stop().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
