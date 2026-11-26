// A reel's pictures as still frames, drawn in Node with @napi-rs/canvas and the player's own
// kit, as the videos and link cards are: for the test bench's sheets (scripts/bench.mjs), and
// for anything that has to look at a reel's pictures without a browser. Each scene is drawn
// as it stands part of the way through its line, with its pictures timed as they would be to
// a recording of about the right length (pacing.mjs), so what is seen is what a viewer sees.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reelFromData } from '../src/format.js';
import { createKit, H, W } from '../src/kit.js';
import { MIN_SCENE_MS } from '../src/timing.js';
import { peterMs } from './limits.mjs';
import { pacePicture } from './pacing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** How long Peter will take over a scene, in seconds, before it is recorded. */
export const sceneSeconds = (scene) => Math.max(MIN_SCENE_MS, peterMs(scene.say ?? scene.caption)) / 1000;

/** A reel (reel.json, parsed) with each picture timed to how long Peter will take over its line. */
export function pacedForPeter(raw) {
  return {
    ...raw,
    scenes: raw.scenes.map((scene) => (scene.picture
      ? { ...scene, picture: pacePicture(scene.picture, String(scene.say ?? scene.caption), sceneSeconds(scene)) }
      : scene))
  };
}

let canvasModule = null;
async function canvas() {
  if (!canvasModule) {
    canvasModule = await import('@napi-rs/canvas');
    canvasModule.GlobalFonts.registerFromPath(join(ROOT, 'fonts', 'orange-kid.woff2'), 'Orange Kid');
  }
  return canvasModule;
}

/**
 * Every scene of a reel (reel.json, parsed) drawn at each of `parts` of the way through its
 * line, `scale` canvas pixels to a picture pixel (a whole number, so it stays crisp). Resolves
 * to [{ title, say, seconds, frames: [canvas, ...] }], one a scene; a frame is an @napi-rs/canvas
 * canvas, so it can be drawn onto another or turned into a PNG. A drawing that throws is drawn
 * as far as it got, and its scene says what went wrong in `broken`.
 */
export async function drawScenes(raw, { parts = [0.85], scale = 1 } = {}) {
  const { createCanvas } = await canvas();
  const paced = pacedForPeter(raw), reel = reelFromData(paced);
  return reel.scenes.map((scene, i) => {
    const seconds = sceneSeconds(paced.scenes[i]);
    let broken = null;
    const frames = parts.map((part) => {
      const c = createCanvas(W * scale, H * scale), g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      try { scene.draw(seconds * part, createKit(g), scene); } catch (err) { broken ??= err.message; }
      return c;
    });
    return { title: scene.title, say: scene.say, seconds, frames, ...(broken ? { broken } : {}) };
  });
}
