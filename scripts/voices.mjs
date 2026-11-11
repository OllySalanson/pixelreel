#!/usr/bin/env node
// Records a reel's narration: npm run voices my-reel [-- --voice stuart_bell --all]
// With Pocket TTS by default, Kokoro (--engine kokoro), or any other speech engine:
// --command "piper ... --output_file {out}". A reel keeps the narrator it was recorded with.
//
// Writes one small MP3 per scene into reels/<name>/audio/ plus manifest.json, which the
// player reads to find each scene's clip. Clips are named after a hash of their words,
// voice and speed, so a line that has not changed is never recorded twice, and clips
// nothing uses any more are deleted. See docs/voices.md.
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
/** The speech engines npm run voices runs itself, and each one's own settings. */
export const ENGINES = {
  pocket: { name: 'Pocket TTS', script: 'pocket_speak.py', voice: 'peter_yearsley' },
  kokoro: { name: 'Kokoro', script: 'kokoro_tts.py', voice: 'bm_george', speed: 0.92, lang: 'en-gb' }
};
export const DEFAULTS = { engine: 'pocket', bitrate: '48k', threads: 2 };

/** Kokoro's voices are named like bm_george or af_heart; Pocket TTS's like peter_yearsley. */
const KOKORO_VOICE = /^[a-z][fm]_[a-z]+$/;

/** The file name a clip gets: the same words and the same narrator always give the same name. */
export function clipFile(text, { engine, voice, speed, lang }) {
  // Kokoro and --command clips keep the names they had before there was a choice of engine
  const narrator = engine === 'pocket' ? `pocket|${voice}` : `${voice}|${speed}|${lang}`;
  return createHash('sha256').update(`${narrator}|${text}`).digest('hex').slice(0, 16) + '.mp3';
}

/** The narrator a manifest says its clips were recorded with, or null when it was --command or unknown. */
function recordedWith(manifest) {
  const { engine, voice, speed, lang } = manifest ?? {};
  if (typeof voice !== 'string' || voice.startsWith('command: ')) return null;
  if (engine === 'pocket') return { engine, voice };
  if ((engine ?? 'kokoro') === 'kokoro' && speed > 0 && typeof lang === 'string') return { engine: 'kokoro', voice, speed, lang };
  return null;
}

/**
 * Works out who narrates. `options` are the command line's --engine, --voice, --speed, --lang
 * and --command (each undefined when not given). Without them a reel keeps the narrator its
 * manifest says it was recorded with, so recording one changed line never changes the voice;
 * a new reel gets Pocket TTS's peter_yearsley. A Kokoro voice name picks Kokoro by itself.
 */
export function narrator(options, manifest = null) {
  const { engine: wanted, voice, speed, lang } = options;
  const command = options.command?.trim();
  if (command !== undefined) {
    if (!command.includes('{out}')) {
      throw new Error('--command needs {out} where the audio file should go, for example: --command "piper --model voice.onnx --output_file {out}"');
    }
    if (wanted || voice || speed || lang) throw new Error('--command names its own voice, so it cannot go with --engine, --voice, --speed or --lang.');
    // another engine has no voice or speed of ours: the command itself names the voice
    return { voice: `command: ${command}`, speed: 1, lang: 'any' };
  }
  if (wanted && !ENGINES[wanted]) throw new Error(`--engine must be ${Object.keys(ENGINES).join(' or ')}, or use --command for any other speech engine.`);
  const before = recordedWith(manifest);
  const engine = wanted ?? (voice ? (KOKORO_VOICE.test(voice) ? 'kokoro' : 'pocket') : before?.engine ?? DEFAULTS.engine);
  const base = before?.engine === engine && !voice ? before : ENGINES[engine];
  if (engine === 'pocket') {
    if (speed || lang) throw new Error('Pocket TTS has no --speed or --lang. Those are for Kokoro: add --engine kokoro.');
    return { engine, voice: voice ?? base.voice };
  }
  const settings = { engine, voice: voice ?? base.voice, speed: speed === undefined ? base.speed : Number(speed), lang: lang ?? base.lang };
  if (!(settings.speed > 0)) throw new Error('--speed must be a number above 0, for example 0.92');
  return settings;
}

/** True for a clip file this tool named, as opposed to a recording someone added by hand. */
export const isMadeClip = (file) => /^[0-9a-f]{16}\.mp3$/.test(file);

/**
 * Works out what to record. Returns { clips, todo, stale }:
 *   clips  the manifest's new clip list, one per distinct line, in scene order
 *   todo   the clips that still need recording
 *   stale  MP3 files this tool made that nothing uses any more
 * A line with a recording someone added themselves (any other file name) keeps it, even
 * with `all`, and such files are never cleared away.
 */
export function planClips(scenes, settings, { manifest = null, existing = [], all = false } = {}) {
  const known = new Map((manifest?.clips ?? []).map((c) => [c.file, c]));
  const ownVoice = new Map((manifest?.clips ?? []).filter((c) => c?.file && !isMadeClip(c.file) && existing.includes(c.file) && c.seconds > 0).map((c) => [c.text, c]));
  const clips = [], todo = [], seen = new Set();
  for (const scene of scenes) {
    if (seen.has(scene.say)) continue;
    seen.add(scene.say);
    const own = ownVoice.get(scene.say);
    if (own) { clips.push({ text: scene.say, file: own.file, seconds: own.seconds }); continue; }
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
  const stale = existing.filter((f) => isMadeClip(f) && !used.has(f));
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

export function findFfmpeg() {
  const candidates = [process.env.FFMPEG, 'ffmpeg', join(homedir(), '.local', 'bin', 'ffmpeg')].filter(Boolean);
  const found = candidates.find((c) => spawnSync(c, ['-version'], { stdio: 'ignore' }).status === 0);
  if (!found) throw new Error('ffmpeg is needed to make the MP3s. Install it (for example: sudo apt install ffmpeg, or brew install ffmpeg), or set FFMPEG to its path.');
  return found;
}

/** How long an audio file lasts, in seconds, worked out by decoding it with ffmpeg. */
export function audioSeconds(ffmpeg, file) {
  const r = spawnSync(ffmpeg, ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${String(r.stderr).trim()}`);
  return Math.round((r.stdout.length / 32000) * 100) / 100;   // 16000 two-byte samples a second
}

/**
 * Runs another speech engine once per line: `command` gets the words on its standard input
 * and must write an audio file where {out} says. Calls onDone(wav) as each finishes.
 */
export function speakWithCommand(lines, command, onDone) {
  for (const { text, wav } of lines) {
    const r = spawnSync(command.replaceAll('{out}', `"${wav}"`), { shell: true, input: text, stdio: ['pipe', 'inherit', 'inherit'] });
    if (r.error) throw new Error(`Could not run the speech command (${r.error.message}).`);
    if (r.status !== 0) throw new Error(`The speech command stopped with exit code ${r.status} on "${text.slice(0, 40)}...".`);
    if (!existsSync(wav)) throw new Error(`The speech command finished but wrote nothing at {out}. It must save its audio where {out} says.`);
    onDone(wav);
  }
}

/** Runs Pocket TTS or Kokoro over `lines` ([{ text, wav }]), calling onDone(wav, seconds) as each finishes. */
function speak(lines, settings, threads, onDone) {
  const engine = ENGINES[settings.engine];
  const modelDir = process.env.KOKORO_HOME || join(ROOT, 'models');
  const job = settings.engine === 'kokoro'
    ? { model: join(modelDir, 'kokoro-v1.0.onnx'), voices: join(modelDir, 'voices-v1.0.bin'), voice: settings.voice, speed: settings.speed, lang: settings.lang, threads, lines }
    : { voice: settings.voice, threads, lines };
  return new Promise((ok, fail) => {
    const child = spawn(findPython(), [join(ROOT, 'scripts', engine.script)], { stdio: ['pipe', 'pipe', 'inherit'] });
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
      else fail(new Error(`${engine.name} stopped with exit code ${code}; see the message above.`));
    });
    child.stdin.end(JSON.stringify(job));
  });
}

/** Records the clips a reel needs. `args` are the command line arguments after npm run voices. */
export async function main(args = process.argv.slice(2), { log = console.log } = {}) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      engine: { type: 'string' },
      voice: { type: 'string' },
      speed: { type: 'string' },
      lang: { type: 'string' },
      bitrate: { type: 'string', default: DEFAULTS.bitrate },
      threads: { type: 'string', default: process.env.THREADS || String(DEFAULTS.threads) },
      command: { type: 'string' },
      all: { type: 'boolean', default: false }
    }
  });
  const dir = reelDir(positionals[0]);
  const reelFile = join(dir, 'reel.js');
  if (!existsSync(reelFile)) throw new Error(`No reel at ${reelFile}`);
  const audioDir = join(dir, 'audio');
  const manifestPath = join(audioDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const settings = narrator(values, manifest);
  const command = settings.engine ? null : values.command.trim();

  const reel = normalizeReel((await import(pathToFileURL(reelFile).href)).default);
  mkdirSync(audioDir, { recursive: true });
  const { clips, todo, stale } = planClips(reel.scenes, settings, { manifest, existing: readdirSync(audioDir), all: values.all });

  const save = (list, header = settings) => {
    writeFileSync(manifestPath, JSON.stringify({ ...header, clips: list }, null, 2) + '\n');
  };
  if (todo.length) {
    const ffmpeg = findFfmpeg();
    const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-'));
    const byWav = new Map(todo.map((c, i) => [join(tmp, `${i}.wav`), c]));
    const lines = [...byWav].map(([wav, c]) => ({ text: c.text, wav }));
    const encode = (wav, seconds) => {
      const clip = byWav.get(wav);
      const enc = spawnSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', values.bitrate, join(audioDir, clip.file)], { stdio: 'inherit' });
      if (enc.status !== 0) throw new Error(`ffmpeg could not encode ${clip.file}`);
      clip.seconds = seconds ?? audioSeconds(ffmpeg, wav);
      log(`  ${clip.file}  ${clip.seconds.toFixed(1)}s  "${clip.text.slice(0, 60)}${clip.text.length > 60 ? '...' : ''}"`);
    };
    log(`Recording ${todo.length} of ${clips.length} clips with ${command ? 'your speech command' : `${ENGINES[settings.engine].name}, voice ${settings.voice}`}...`);
    try {
      if (command) speakWithCommand(lines, command, (wav) => encode(wav));
      else await speak(lines, settings, Number(values.threads) || DEFAULTS.threads, encode);
    } catch (err) {
      // keep what was recorded, and the old recordings of lines it did not reach, so the reel
      // still plays and a rerun carries on from here; until the new narrator has recorded
      // something, the manifest goes on naming the old one
      const recorded = clips.filter((c) => c.seconds > 0), done = new Set(recorded.map((c) => c.text));
      const kept = (manifest?.clips ?? []).filter((c) => c?.text && !done.has(c.text) && c.file && existsSync(join(audioDir, c.file)));
      const before = Object.fromEntries(Object.entries(manifest ?? {}).filter(([key]) => key !== 'clips'));
      save([...recorded, ...kept], todo.some((c) => c.seconds > 0) ? settings : before);
      throw err;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  for (const f of stale) rmSync(join(audioDir, f));
  save(clips);
  const total = clips.reduce((s, c) => s + c.seconds, 0);
  log(`${clips.length} clips (${todo.length} new, ${stale.length} removed), ${(total / 60).toFixed(1)} minutes of speech.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.message); process.exitCode = 1; });
}
