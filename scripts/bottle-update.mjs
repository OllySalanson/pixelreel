#!/usr/bin/env node
// Remakes Pixel Reel's copy of Message in a Bottle from its own repository
// (github.com/OllySalanson/message-in-a-bottle, private): npm run bottle-update [-- <tag>]
// clones it at the tag (the newest v* tag if none is named), runs its checks there, packs it
// with npm pack into vendor/, and points package.json at the new copy. The copy is committed,
// so the image builds without reaching a private repository (docs/deploy.md).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/OllySalanson/message-in-a-bottle.git';
const NAME = 'message-in-a-bottle';
const VENDOR = join(ROOT, 'vendor');

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

/** The newest v<major>.<minor>.<patch> tag of the repository. */
function newestTag() {
  const tags = run('git', ['ls-remote', '--tags', '--refs', REPO]).split('\n').map((line) => line.split('refs/tags/')[1]).filter((t) => /^v\d+\.\d+\.\d+$/.test(t ?? ''));
  const parts = (t) => t.slice(1).split('.').map(Number);
  tags.sort((a, b) => parts(a).reduce((d, n, i) => d || n - parts(b)[i], 0));
  if (!tags.length) throw new Error(`${REPO} has no v* tags`);
  return tags.at(-1);
}

const tag = process.argv[2] ?? newestTag();
const work = mkdtempSync(join(tmpdir(), 'bottle-update-'));
try {
  run('git', ['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', tag, REPO, work]);
  run('npm', ['ci', '--no-audit', '--no-fund'], work);
  run('npm', ['run', 'check'], work);
  for (const old of readdirSync(VENDOR).filter((f) => f.startsWith(`${NAME}-`) && f.endsWith('.tgz'))) rmSync(join(VENDOR, old));
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', VENDOR], work))[0].filename;
  const file = join(ROOT, 'package.json'), pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.dependencies[NAME] = `file:vendor/${packed}`;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  run('npm', ['install', '--no-audit', '--no-fund'], ROOT);
  console.log(`Message in a Bottle is ${tag} (${run('git', ['rev-parse', '--short', 'HEAD'], work)}), in vendor/${packed}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
