#!/usr/bin/env node
// Puts a new version of Pixel Reel online, keeping Message in a Bottle's notes safe on the way
// (docs/deploy.md): npm run deploy [-- <more gcloud run deploy settings, such as --update-env-vars X=1>]
//
// 1. stops if this checkout has changes not committed (gcloud uploads the folder as it is);
// 2. backs up every note, with the sites and people (scripts/bottles-safe.mjs), and stops if a
//    note in the last backup is no longer kept;
// 3. deploys with `gcloud run deploy --source .`, keeping every other setting;
// 4. once the new version answers, checks it lists every note it listed before, and says LOST,
//    with how to put them back, if not.
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, check, cloud, liveIds, missing, PROJECT, SERVICE } from './bottles-safe.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (line) => console.log(line);

const changed = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
if (changed) { out(`Not deploying: this checkout has changes not committed, and gcloud would upload them:\n${changed}`); process.exit(1); }

const store = cloud();
const made = await backup({ store, out });
if (made.lost.length) { out('Not deploying: put the lost notes back first.'); process.exit(1); }
const before = await liveIds({ reader: store.reader() });
out(`The service lists ${before.length} notes. Deploying...`);

// from the checkout itself, as docs/deploy.md does it, since --source uploads the folder it names
const deployed = spawnSync('gcloud', ['run', 'deploy', 'pixelreel', '--source', '.', '--region', 'europe-west1', `--project=${PROJECT}`, '--quiet', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
if (deployed.status !== 0) out('gcloud did not say the deploy went (the build may still finish: docs/deploy.md). Checking the notes anyway.');

// the new version may take a moment to answer for itself
let after = null;
for (let i = 0; i < 30 && !after; i++) {
  try { after = await liveIds({ reader: store.reader() }); } catch { await new Promise((ok) => setTimeout(ok, 10_000)); }
}
if (!after) { out(`LOST?: ${SERVICE} would not list its notes after the deploy. Check it now: npm run bottles-safe -- check`); process.exit(1); }
const lost = missing(before, after);
if (lost.length) {
  out(`LOST: the new version does not list ${lost.length} of the notes it listed before: ${lost.join(', ')}`);
  out(`To put them back (nothing kept now is replaced): npm run bottles-safe -- restore ${made.stamp}`);
  process.exit(1);
}
out(`Every note is still kept: ${after.length} now, ${before.length} before.`);
await check({ store, out });
process.exit(deployed.status === 0 ? 0 : 1);
