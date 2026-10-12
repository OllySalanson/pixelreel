#!/usr/bin/env node
// Records a reel's narration with Kokoro: npm run voices my-reel [-- --voice bf_emma --speed 1 --all]
//
// Writes one small MP3 per scene into reels/<name>/audio/ plus manifest.json, which the
// player reads to find each scene's clip. Clips are named after a hash of their words,
// voice and speed, so a line that has not changed is never recorded twice, and clips
// nothing uses any more are deleted. See "Record the voices" in the README.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { normalizeReel, REEL_NAME } from '../src/reel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULTS = { voice: 'bm_george', speed: 0.92, lang: 'en-gb', bitrate: '48k', threads: 2 };

/** The file name a clip gets: the same words, voice, speed and language always give the same name. */
export function clipFile(text, { voice, speed, lang }) {
  return createHash('sha256').update(`${voice}|${speed}|${lang}|${text}`).digest('hex').slice(0, 16) + '.mp3';
}

/**
 * Works out what to record. Returns { clips, todo, stale }:
 *   clips  the manifest's new clip list, one per distinct line, in scene order
 *   todo   the clips that still need recording
 *   stale  MP3 files in the audio folder that nothing uses any more
 */
export function planClips(scenes, settings, { manifest = null, existing = [], all = false } = {}) {
  const known = new Map((manifest?.clips ?? []).map((c) => [c.file, c]));
  const clips = [], todo = [], seen = new Set();
  for (const scene of scenes) {
    if (seen.has(scene.say)) continue;
    seen.add(scene.say);
    const file = clipFile(scene.say, settings);
    const prev = known.get(file);
    if (!all && prev && existing.includes(file) && prev.seconds > 0) {
      clips.push({ text: scene.say, file, seconds: prev.seconds });
    } else {
      const clip = { text: scene.say, file, seconds: 0 };
      clips.push(clip);
      todo.push(clip);
    }
  }
  const used = new Set(clips.map((c) => c.file));
  const stale = existing.filter((f) => f.endsWith('.mp3') && !used.has(f));
  return { clips, todo, stale };
}

/** Finds the reel folder from a name ("my-reel") or a path ("reels/my-reel" or ".../reel.js"). */
export function reelDir(arg) {
  if (!arg) throw new Error('Which reel? For example: npm run voices what-is-pixelreel');
  if (REEL_NAME.test(arg) && !existsSync(arg)) return join(ROOT, 'reels', arg);
  const full = resolve(arg);
  return basename(full) === 'reel.js' ? dirname(full) : full;
}

function findPython() {
  if (process.env.PIXELREEL_PYTHON) return process.env.PIXELREEL_PYTHON;
  const venv = join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return existsSync(venv) ? venv : 'python3';
}

function findFfmpeg() {
  const candidates = [process.env.FFMPEG, 'ffmpeg', join(homedir(), '.local', 'bin', 'ffmpeg')].filter(Boolean);
  const found = candidates.find((c) => spawnSync(c, ['-version'], { stdio: 'ignore' }).status === 0);
  if (!found) throw new Error('ffmpeg is needed to make the MP3s. Install it (for example: sudo apt install ffmpeg, or brew install ffmpeg), or set FFMPEG to its path.');
  return found;
}

/** Runs Kokoro over `lines` ([{ text, wav }]), calling onDone(wav, seconds) as each finishes. */
function speak(lines, settings, modelDir, onDone) {
  return new Promise((ok, fail) => {
    const child = spawn(findPython(), [join(ROOT, 'scripts', 'kokoro_tts.py')], { stdio: ['pipe', 'pipe', 'inherit'] });
    child.on('error', (err) => fail(new Error(`Could not start Python (${err.message}). Run scripts/setup-voices.sh, or set PIXELREEL_PYTHON.`)));
    let failed = null;
    createInterface({ input: child.stdout }).on('line', (line) => {
      let r;
      try { r = JSON.parse(line); } catch { console.log(line); return; }
      try { onDone(r.wav, r.seconds); } catch (err) { failed ??= err; child.kill(); }
    });
    child.on('close', (code) => {
      if (failed) fail(failed);
      else if (code === 0) ok();
      else fail(new Error(`Kokoro stopped with exit code ${code}; see the message above.`));
    });
    child.stdin.end(JSON.stringify({
      model: join(modelDir, 'kokoro-v1.0.onnx'),
      voices: join(modelDir, 'voices-v1.0.bin'),
      voice: settings.voice, speed: settings.speed, lang: settings.lang, threads: settings.threads,
      lines
    }));
  });
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      voice: { type: 'string', default: DEFAULTS.voice },
      speed: { type: 'string', default: String(DEFAULTS.speed) },
      lang: { type: 'string', default: DEFAULTS.lang },
      bitrate: { type: 'string', default: DEFAULTS.bitrate },
      threads: { type: 'string', default: process.env.THREADS || String(DEFAULTS.threads) },
      all: { type: 'boolean', default: false }
    }
  });
  const dir = reelDir(positionals[0]);
  const reelFile = join(dir, 'reel.js');
  if (!existsSync(reelFile)) throw new Error(`No reel at ${reelFile}`);
  const settings = { voice: values.voice, speed: Number(values.speed), lang: values.lang, threads: Number(values.threads) || 2 };
  if (!(settings.speed > 0)) throw new Error('--speed must be a number above 0, for example 0.92');

  const reel = normalizeReel((await import(pathToFileURL(reelFile).href)).default);
  const audioDir = join(dir, 'audio');
  mkdirSync(audioDir, { recursive: true });
  const manifestPath = join(audioDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const { clips, todo, stale } = planClips(reel.scenes, settings, { manifest, existing: readdirSync(audioDir), all: values.all });

  const save = (list) => {
    writeFileSync(manifestPath, JSON.stringify({ voice: settings.voice, speed: settings.speed, lang: settings.lang, clips: list }, null, 2) + '\n');
  };
  if (todo.length) {
    const ffmpeg = findFfmpeg();
    const modelDir = process.env.KOKORO_HOME || join(ROOT, 'models');
    const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-'));
    const byWav = new Map(todo.map((c, i) => [join(tmp, `${i}.wav`), c]));
    console.log(`Recording ${todo.length} of ${clips.length} clips with ${settings.voice} (about half a minute each)...`);
    try {
      await speak([...byWav].map(([wav, c]) => ({ text: c.text, wav })), settings, modelDir, (wav, seconds) => {
        const clip = byWav.get(wav);
        const enc = spawnSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', values.bitrate, join(audioDir, clip.file)], { stdio: 'inherit' });
        if (enc.status !== 0) throw new Error(`ffmpeg could not encode ${clip.file}`);
        clip.seconds = seconds;
        console.log(`  ${clip.file}  ${seconds.toFixed(1)}s  "${clip.text.slice(0, 60)}${clip.text.length > 60 ? '...' : ''}"`);
      });
    } catch (err) {
      save(clips.filter((c) => c.seconds > 0));   // keep what was recorded, so a rerun carries on from here
      throw err;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  for (const f of stale) rmSync(join(audioDir, f));
  save(clips);
  const total = clips.reduce((s, c) => s + c.seconds, 0);
  console.log(`${clips.length} clips (${todo.length} new, ${stale.length} removed), ${(total / 60).toFixed(1)} minutes of speech.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.message); process.exitCode = 1; });
}
