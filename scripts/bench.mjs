#!/usr/bin/env node
// The test bench: ten fixed topics (bench/topics), written into reels by the website's own
// writer and drawn side by side, so a change to the pictures, or to what Claude is told, is
// seen and not guessed. See bench/README.md.
//
//   npm run bench -- write <run> [--pictures stage|cards] [--model m] [--effort e] [--only topic,topic]
//       has the writer (service/writer.mjs) write every topic, with the service's own checks
//       and its one round of putting a reel right, and keeps each reel, its time and its
//       cost in bench/runs/<run>/. It costs money: about 2 to 10 US cents a topic. It needs
//       ANTHROPIC_API_KEY.
//   npm run bench -- look <run>
//       has the critic (service/critic.mjs) look at every reel of a run, as the service does
//       while Peter records, and keeps what it made of them in bench/runs/<run>-looked/.
//   npm run bench -- sheet <before> <after> [--out file.png] [--only ...]
//       draws both runs' reels a scene at a time, one topic under another, before above
//       after, and says what each run cost and which pictures it chose.
//   npm run bench -- sheet <run> [--out file.png]
//       draws one run by itself.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { reelFromData } from '../src/format.js';
import { ReelError } from '../src/reel.js';
import { H, W } from '../src/kit.js';
import { drawScenes } from '../service/frames.mjs';
import { limitProblems } from '../service/limits.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TOPICS = join(ROOT, 'bench', 'topics');
export const RUNS = join(ROOT, 'bench', 'runs');

/** List prices in US dollars for a million tokens in and out, as firstmate had them on 3 Nov 2026. */
export const PRICES = { 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20], 'claude-haiku-5-5': [0.1, 0.5] };

/** The topics, by name, in a steady order. */
export function topicNames() {
  return readdirSync(TOPICS).filter((f) => f.endsWith('.txt')).map((f) => basename(f, '.txt')).sort();
}

/** Tokens in and out from the writer's log lines ("try: text, 4610 tokens in, 1197 out ..."). */
export function tokensFrom(lines) {
  let inTokens = 0, outTokens = 0;
  for (const line of lines) {
    const m = /(\d+) tokens in, (\d+) out/.exec(line);
    if (m) { inTokens += Number(m[1]); outTokens += Number(m[2]); }
  }
  return { in: inTokens, out: outTokens };
}

/** What `tokens` cost on `model`, in US cents. */
export function cents(model, tokens) {
  const [inPrice, outPrice] = PRICES[model] ?? PRICES['claude-sonnet-5-5'];
  return Math.round(((tokens.in * inPrice + tokens.out * outPrice) / 1e6) * 1000) / 10;
}

/** What the service would say is wrong with a reel the writer gave: [] when it would take it. */
export function benchProblems(raw) {
  try {
    const reel = reelFromData(raw);
    return limitProblems(reel, raw);
  } catch (err) {
    if (err instanceof ReelError) return err.problems;
    throw err;
  }
}

/** A reel the writer gave, and the things it wished the library had, apart. */
const apart = ({ wishes = [], ...reel }) => ({ reel, wishes });

/** The kinds of picture a reel chose, a scene at a time. */
export const kindsOf = (reel) => (reel?.scenes ?? []).map((scene) => scene.picture?.type ?? 'card');

async function write(run, { model, effort, only, pictures }) {
  const { createWriter } = await import('../service/writer.mjs');
  const dir = join(RUNS, run);
  mkdirSync(dir, { recursive: true });
  for (const topic of only ?? topicNames()) {
    const text = readFileSync(join(TOPICS, `${topic}.txt`), 'utf8');
    const logs = [];
    const writer = createWriter({ model, effort, pictures, log: (line) => logs.push(line) });
    const source = { kind: 'text', text };
    const started = Date.now();
    let reel = null, problems = [], rounds = 1, error = null, wishes = [], firstProblems = [];
    try {
      reel = await writer(source);
      ({ reel, wishes } = apart(reel));
      problems = benchProblems({ format: 'pixelreel/1', ...reel });
      if (problems.length) {
        rounds = 2;   // as the service does: one chance to put it right
        firstProblems = problems;
        ({ reel, wishes } = apart(await writer(source, { before: reel, problems })));
        problems = benchProblems({ format: 'pixelreel/1', ...reel });
      }
    } catch (err) {
      error = err.message;
    }
    const seconds = Math.round((Date.now() - started) / 100) / 10, tokens = tokensFrom(logs);
    const kept = { topic, model, effort, pictures, seconds, rounds, firstProblems, tokens, wishes, cents: cents(model, tokens), problems, ...(error ? { error } : {}), reel: reel && { format: 'pixelreel/1', ...reel } };
    writeFileSync(join(dir, `${topic}.json`), `${JSON.stringify(kept, null, 1)}\n`);
    console.log(`${topic.padEnd(20)} ${String(seconds).padStart(5)} s ${String(kept.cents).padStart(5)} c  ${error ? `FAILED: ${error}` : `${kindsOf(reel).join(' ')}${problems.length ? `  (${problems.length} problems left)` : ''}`}`);
  }
}

async function look(run, { model, effort, only }) {
  const { createCritic } = await import('../service/critic.mjs');
  const dir = join(RUNS, `${run}-looked`), kept = readRun(run);
  mkdirSync(dir, { recursive: true });
  for (const topic of only ?? Object.keys(kept)) {
    const one = kept[topic];
    if (!one?.reel) continue;
    const logs = [], started = Date.now();
    const critic = createCritic({ model, effort, log: (line) => logs.push(line) });
    const { raw, faults } = await critic(one.reel, { id: topic });
    const seconds = Math.round((Date.now() - started) / 100) / 10, tokens = tokensFrom(logs);
    const looked = { ...one, looked: { model, effort, seconds, tokens, cents: cents(model, tokens), faults, mended: raw !== one.reel, log: logs }, reel: raw, cents: Math.round((one.cents + cents(model, tokens)) * 10) / 10, problems: benchProblems(raw) };
    writeFileSync(join(dir, `${topic}.json`), `${JSON.stringify(looked, null, 1)}\n`);
    console.log(`${topic.padEnd(20)} ${String(seconds).padStart(5)} s ${String(cents(model, tokens)).padStart(5)} c  ${faults.length} faults${raw !== one.reel ? ', mended' : ''}`);
  }
}

/** A run's reels, by topic. */
export function readRun(run) {
  const dir = join(RUNS, run);
  if (!existsSync(dir)) throw new Error(`there is no run called ${run} in ${RUNS}`);
  return Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [basename(f, '.json'), JSON.parse(readFileSync(join(dir, f), 'utf8'))]));
}

/** One line about a run's reel of a topic: its time, its cost and the pictures it chose. */
const about = (kept) => (kept.reel ? `${kept.seconds} s, ${kept.cents} c, ${kept.reel.scenes.length} scenes: ${kindsOf(kept.reel).join(' ')}${kept.problems.length ? ` (${kept.problems.length} problems)` : ''}` : `failed: ${kept.error}`);

const SHEET = { gap: 12, head: 30, label: 20, max: 8, bg: '#0d1b2a', gold: '#ffcc4d', grey: '#9fb3c8', words: '#ebeac5' };

/**
 * The sheet: for each topic its name, then each run's reel as a strip of its scenes, a scene's
 * picture as it stands near the end of its line, at the picture's own size (one picture pixel
 * to one of the sheet's), so its pixels and words are seen as they are.
 */
async function sheet(runs, { out, only }) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const kept = runs.map(readRun);
  const topics = (only ?? topicNames()).filter((t) => kept.some((k) => k[t]));
  const stripH = SHEET.label + H + SHEET.gap, blockH = SHEET.head + runs.length * stripH;
  const width = SHEET.gap + SHEET.max * (W + SHEET.gap);
  const c = createCanvas(width, SHEET.gap + topics.length * blockH), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = SHEET.bg;
  g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = 'top';
  const totals = runs.map(() => ({ cents: 0, seconds: 0, scenes: 0, kinds: {} }));
  for (const [n, topic] of topics.entries()) {
    const top = SHEET.gap + n * blockH;
    g.fillStyle = SHEET.gold;
    g.font = 'bold 20px Verdana, sans-serif';
    g.fillText(topic, SHEET.gap, top + 4);
    for (const [r, run] of runs.entries()) {
      const y = top + SHEET.head + r * stripH, one = kept[r][topic];
      g.fillStyle = SHEET.grey;
      g.font = '14px Verdana, sans-serif';
      g.fillText(`${run}: ${one ? about(one) : 'not in this run'}`, SHEET.gap, y);
      if (!one?.reel) continue;
      totals[r].cents += one.cents; totals[r].seconds += one.seconds; totals[r].scenes += one.reel.scenes.length;
      for (const kind of kindsOf(one.reel)) totals[r].kinds[kind] = (totals[r].kinds[kind] ?? 0) + 1;
      const scenes = await drawScenes(one.reel);
      scenes.slice(0, SHEET.max).forEach((scene, i) => {
        const x = SHEET.gap + i * (W + SHEET.gap);
        g.drawImage(scene.frames[0], x, y + SHEET.label);
        if (scene.broken) { g.fillStyle = '#d63a3a'; g.fillText(`broken: ${scene.broken}`, x + 4, y + SHEET.label + 4); }
      });
    }
  }
  const file = out ?? join(RUNS, `${runs.join('-vs-')}.png`);
  writeFileSync(file, c.toBuffer('image/png'));
  console.log(`${file} (${c.width} x ${c.height})`);
  for (const [r, run] of runs.entries()) {
    const t = totals[r], kinds = Object.entries(t.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(`${run}: ${topics.length} reels, ${t.scenes} scenes, ${Math.round(t.cents * 10) / 10} c in all, ${Math.round((t.seconds / topics.length) * 10) / 10} s a reel; pictures: ${kinds}`);
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { pictures: { type: 'string', default: 'stage' }, model: { type: 'string', default: 'claude-sonnet-5-5' }, effort: { type: 'string', default: 'low' }, only: { type: 'string' }, out: { type: 'string' } }
  });
  const [command, ...names] = positionals, only = values.only?.split(',').map((t) => t.trim()).filter(Boolean);
  for (const topic of only ?? []) if (!topicNames().includes(topic)) throw new Error(`there is no topic called ${topic}; there are ${topicNames().join(', ')}`);
  if (command === 'write' && names.length === 1) return write(names[0], { ...values, only });
  if (command === 'look' && names.length === 1) return look(names[0], { ...values, only });
  if (command === 'sheet' && names.length >= 1) return sheet(names, { out: values.out, only });
  console.error('npm run bench -- write <run> [--model m] [--effort e] [--only topics]\nnpm run bench -- sheet <run> [<run> ...] [--out file.png] [--only topics]');
  process.exitCode = 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
