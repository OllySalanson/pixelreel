import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { frameLayout, renderVideo } from '../scripts/video.mjs';
import { findFfmpeg } from '../scripts/voices.mjs';
import { GAP_MS, MIN_SCENE_MS } from '../src/timing.js';

let ffmpeg = null;
try { ffmpeg = findFfmpeg(); } catch { /* the video tests skip */ }
const canvas = await import('@napi-rs/canvas').then(() => true, () => false);
const skip = (!ffmpeg && 'needs ffmpeg') || (!canvas && 'needs @napi-rs/canvas (npm install)');

/** What ffprobe says about a video's streams and length. */
function probe(file) {
  const ffprobe = ffmpeg.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
  const run = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  return JSON.parse(run.stdout);
}

describe('frameLayout', () => {
  it('puts the picture on top at a whole-number scale, and the caption under it', () => {
    assert.deepEqual(frameLayout(4), { width: 1280, height: 1080, picture: 720, band: 360, pad: 40 });
    assert.deepEqual(frameLayout(1), { width: 320, height: 270, picture: 180, band: 90, pad: 10 });
  });
});

describe('npm run video', { skip }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixelreel-video-'));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const reel = join(dir, 'tea');
  mkdirSync(join(reel, 'audio'), { recursive: true });
  const said = 'The kettle sings.';
  writeFileSync(join(reel, 'reel.json'), JSON.stringify({
    format: 'pixelreel/1',
    title: 'Tea',
    scenes: [
      { title: 'Kettle', caption: 'Boil it.', say: said, picture: { type: 'big', text: 'BOIL' } },
      { title: 'Cup', caption: 'Pour it.', transition: 'fade', captions: 'typewriter', picture: { type: 'icons', items: [{ icon: 'cup', label: 'Tea' }] } }
    ]
  }));
  // one second of tone stands in for a recording of the first scene
  spawnSync(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ac', '1', join(reel, 'audio', 'kettle.mp3')]);
  writeFileSync(join(reel, 'audio', 'manifest.json'), JSON.stringify({ clips: [{ text: said, file: 'kettle.mp3', seconds: 1 }] }));

  it('draws the reel on the player clock, with its recordings, and says which scenes are silent', async () => {
    const out = join(dir, 'tea.mp4');
    const result = await renderVideo(reel, out, { fps: 4, scale: 1 });
    const seconds = (2 * MIN_SCENE_MS + 2 * GAP_MS) / 1000;   // both scenes are shorter than the shortest scene
    assert.deepEqual(result, { frames: Math.ceil(seconds * 4), seconds, silent: [2] });
    const info = probe(out);
    const video = info.streams.find((s) => s.codec_type === 'video'), audio = info.streams.find((s) => s.codec_type === 'audio');
    assert.deepEqual([video.codec_name, video.width, video.height, video.r_frame_rate], ['h264', 320, 270, '4/1']);
    assert.equal(audio?.codec_name, 'aac', 'the recording is in it');
    assert.ok(Math.abs(Number(info.format.duration) - seconds) < 0.5, `about ${seconds}s long, not ${info.format.duration}`);
  });

  it('makes a silent video of a reel with no recordings', async () => {
    const quiet = join(dir, 'quiet');
    mkdirSync(quiet);
    writeFileSync(join(quiet, 'reel.json'), JSON.stringify({ format: 'pixelreel/1', title: 'Hush', scenes: [{ title: 'Hush', caption: 'Shh.' }] }));
    const out = join(dir, 'quiet.mp4');
    assert.deepEqual((await renderVideo(quiet, out, { fps: 2, scale: 1 })).silent, [1]);
    assert.deepEqual(probe(out).streams.map((s) => s.codec_type), ['video']);
  });

  it('says what is wrong with a broken reel instead of making a video', async () => {
    const broken = join(dir, 'broken');
    mkdirSync(broken);
    writeFileSync(join(broken, 'reel.json'), JSON.stringify({ format: 'pixelreel/1', title: 'T', scenes: [{ title: 'A' }] }));
    await assert.rejects(renderVideo(broken, join(dir, 'broken.mp4'), { fps: 2, scale: 1 }), (err) => err.problems?.includes('scene 1: needs a caption'));
  });
});
