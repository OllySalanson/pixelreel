#!/usr/bin/env node
// Makes a reel into an MP4: npm run video my-reel [-- --out tea.mp4 --fps 20 --scale 4]
// Every frame is drawn with the player's own kit on the player's own clock (the same scene
// lengths, pauses, transitions and typewriter captions), with the caption under the picture,
// and the recordings are laid on the reel's clock and brought up to phone loudness. For
// sending a reel where a web page will not go: WhatsApp, a slide deck, a video site.
// Needs ffmpeg and @napi-rs/canvas (npm install), and no browser.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createKit, H, W } from '../src/kit.js';
import { clipLookup } from '../src/reel.js';
import { clockTime, GAP_MS, locate, narrationMs, timeline, typedLength } from '../src/timing.js';
import { transitionMs } from '../src/transitions.js';
import { readReel } from './reel-file.mjs';
import { findFfmpeg, reelDir } from './voices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PICTURE_FONT = "'Orange Kid'";
const CAPTION_FONT = "Verdana, 'DejaVu Sans', sans-serif";
const COLOURS = { band: '#13203a', edge: '#ebeac5', title: '#ffcc4d', words: '#f8f7dd', dot: '#33506e' };
/** Loudness the voice is brought to: about what phones and video sites expect. */
const LOUDNESS = 'I=-16:TP=-1.5:LRA=11';

/** Where everything goes in a frame `scale` times the picture's size: the picture on top, the caption under it. */
export function frameLayout(scale) {
  const width = W * scale, picture = H * scale, band = Math.round(picture / 2);
  return { width, height: picture + band, picture, band, pad: Math.round(width / 32) };
}

/** The lines of `text` that fit `maxW` with the context's current font. */
function wrapLines(g, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const longer = line ? `${line} ${word}` : word;
    if (line && g.measureText(longer).width > maxW) { lines.push(line); line = word; } else line = longer;
  }
  if (line) lines.push(line);
  return lines;
}

/** The caption band: the scene's number and title, a dot for each scene, and its caption (typed so far). */
function drawCaption(g, layout, scenes, index, shown) {
  const { width, height, picture, band, pad } = layout, k = width / 1280;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = COLOURS.edge;
  g.fillRect(0, picture, width, Math.max(2, Math.round(6 * k)));
  g.fillStyle = COLOURS.band;
  g.fillRect(0, picture + Math.max(2, Math.round(6 * k)), width, band);
  g.textBaseline = 'top';
  g.textAlign = 'left';
  const titleSize = Math.round(64 * k), titleY = picture + Math.round(24 * k);
  g.font = `${titleSize}px ${PICTURE_FONT}`;
  g.fillStyle = COLOURS.title;
  g.fillText(`${index + 1}. ${scenes[index].title}`, pad, titleY);
  const dot = Math.round(22 * k), gap = Math.round(8 * k);
  scenes.forEach((_, i) => {
    const x = width - pad - (scenes.length - i) * (dot + gap) + gap;
    g.fillStyle = COLOURS.edge;
    g.fillRect(x, titleY + Math.round(14 * k), dot, dot);
    g.fillStyle = i === index ? COLOURS.title : COLOURS.dot;
    g.fillRect(x + Math.round(3 * k), titleY + Math.round(17 * k), dot - Math.round(6 * k), dot - Math.round(6 * k));
  });
  // the caption in full decides the size and the line breaks, so typing never reflows it
  const caption = scenes[index].caption, top = titleY + titleSize + Math.round(16 * k);
  let size = Math.round(44 * k), lines;
  for (; ; size -= 2) {
    g.font = `bold ${size}px ${CAPTION_FONT}`;
    lines = wrapLines(g, caption, width - 2 * pad);
    if (top + lines.length * size * 1.4 <= height - pad / 2 || size <= 16 * k) break;
  }
  g.fillStyle = COLOURS.words;
  let left = shown;
  lines.forEach((line, i) => {
    const part = line.slice(0, Math.max(0, left));
    left -= line.length + 1;
    if (part) g.fillText(part, pad, top + Math.round(i * size * 1.4));
  });
}

/** Runs ffmpeg with `args`, failing with what it said. Returns its stderr. */
function ffmpegSync(ffmpeg, args) {
  const run = spawnSync(ffmpeg, ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return run.stderr;
}

/**
 * The soundtrack: each scene's clip from the moment its scene starts, as a WAV `totalMs` long,
 * brought to phone loudness in two passes so it is one steady gain. Null if nothing is recorded.
 */
function soundtrack(ffmpeg, clips, starts, totalMs, tmp) {
  const placed = clips.map((clip, i) => clip && { file: clip.url, at: starts[i] }).filter(Boolean);
  if (!placed.length) return null;
  const mix = join(tmp, 'mix.wav'), out = join(tmp, 'voice.wav');
  const inputs = placed.flatMap((p) => ['-i', p.file]);
  const delays = placed.map((p, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${p.at}|${p.at}[a${i}]`).join(';');
  const mixed = `${placed.map((_, i) => `[a${i}]`).join('')}amix=inputs=${placed.length}:normalize=0:duration=longest,apad[m]`;
  ffmpegSync(ffmpeg, ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${delays};${mixed}`, '-map', '[m]', '-t', String(totalMs / 1000), mix]);
  const said = ffmpegSync(ffmpeg, ['-i', mix, '-af', `loudnorm=${LOUDNESS}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(said.slice(said.lastIndexOf('{'), said.lastIndexOf('}') + 1));
  const level = `loudnorm=${LOUDNESS}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ffmpegSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', mix, '-af', `${level},aresample=48000`, '-t', String(totalMs / 1000), out]);
  return out;
}

/**
 * Renders the reel in folder `dir` to the MP4 `out`. Returns { frames, seconds, silent }:
 * how many frames, how long, and which scenes (numbered from 1) had no recording.
 */
export async function renderVideo(dir, out, { fps = 20, scale = 4, log = () => {} } = {}) {
  const canvasLib = await import('@napi-rs/canvas').catch(() => null);
  if (!canvasLib) throw new Error('npm run video needs @napi-rs/canvas: run npm install first.');
  const { createCanvas, GlobalFonts, loadImage } = canvasLib;
  GlobalFonts.registerFromPath(join(ROOT, 'fonts', 'orange-kid.woff2'), 'Orange Kid');
  const ffmpeg = findFfmpeg();

  const reel = await readReel(dir);
  const manifestFile = join(dir, 'audio', 'manifest.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null;
  const clipFor = clipLookup(manifest, join(dir, 'audio') + '/');
  const clips = reel.scenes.map((s) => {
    const clip = clipFor(s);
    return clip && existsSync(clip.url) ? clip : null;
  });
  const durations = reel.scenes.map((s, i) => narrationMs(s, clips[i]));
  const line = timeline(durations, GAP_MS);
  const silent = clips.map((c, i) => (c ? null : i + 1)).filter(Boolean);

  const images = {};
  for (const [name, src] of Object.entries(reel.images)) {
    images[name] = await loadImage(/^[a-z][a-z0-9+.-]*:/i.test(src) ? src : resolve(dir, src));
  }

  const layout = frameLayout(scale);
  const canvas = createCanvas(layout.width, layout.height), g = canvas.getContext('2d');
  const px = createKit(g, images);
  const paint = (i, t) => {
    try {
      reel.scenes[i].draw(t, px, reel.scenes[i]);
    } catch (err) {
      throw new Error(`scene ${i + 1} could not draw: ${err.message}`, { cause: err });
    }
  };

  const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-video-'));
  try {
    const voice = soundtrack(ffmpeg, clips, line.starts, line.total, tmp);
    const frames = Math.ceil((line.total / 1000) * fps);
    const encoder = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${layout.width}x${layout.height}`, '-r', String(fps), '-i', '-',
      ...(voice ? ['-i', voice, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-movflags', '+faststart', '-shortest', out
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let said = '';
    encoder.stderr.on('data', (d) => { said += d; });
    const finished = new Promise((ok, fail) => {
      encoder.on('error', fail);
      encoder.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg could not make the video: ${said.trim()}`))));
    });
    const write = (buf) => new Promise((ok, fail) => encoder.stdin.write(buf, (err) => (err ? fail(err) : ok())));

    for (let n = 0; n < frames; n++) {
      const { index, offset } = locate(line, (n * 1000) / fps);
      const t = offset / 1000, kind = reel.scenes[index].transition, ms = transitionMs(kind);
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, H);
      if (index > 0 && ms && offset < ms) {
        const oldT = (line.spans[index - 1] + offset) / 1000;
        px.transition(kind, offset / ms, () => paint(index - 1, oldT), () => paint(index, t));
      } else {
        paint(index, t);
      }
      const scene = reel.scenes[index];
      const shown = scene.captions === 'typewriter' ? typedLength(scene.caption, offset, durations[index]) : scene.caption.length;
      drawCaption(g, layout, reel.scenes, index, shown);
      await write(Buffer.from(g.getImageData(0, 0, layout.width, layout.height).data.buffer));
      if (n % (fps * 10) === 0) log(`  ${Math.round((100 * n) / frames)}%`);
    }
    encoder.stdin.end();
    await finished;
    return { frames, seconds: line.total / 1000, silent };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, fps: { type: 'string', default: '20' }, scale: { type: 'string', default: '4' } }
  });
  const dir = reelDir(positionals[0]);
  const fps = Number(values.fps), scale = Number(values.scale);
  if (!(fps >= 1 && fps <= 60)) throw new Error('--fps must be a number from 1 to 60');
  if (!Number.isInteger(scale) || scale < 1 || scale > 8) throw new Error('--scale must be a whole number from 1 to 8 (4 makes 1280 x 1080)');
  const out = resolve(values.out ?? `${basename(dir)}.mp4`);
  console.log(`Drawing ${basename(dir)} at ${fps} frames a second...`);
  const { frames, seconds, silent } = await renderVideo(dir, out, { fps, scale, log: console.log });
  console.log(`Wrote ${out}: ${frames} frames, ${clockTime(seconds * 1000)}.`);
  if (silent.length) console.log(`Scenes with no up-to-date recording are silent: ${silent.join(', ')}. Record them with: npm run voices ${basename(dir)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.problems ? `This reel has problems:\n- ${err.problems.join('\n- ')}` : err.message); process.exitCode = 1; });
}
