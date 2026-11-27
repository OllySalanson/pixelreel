#!/usr/bin/env node
// Keeps Message in a Bottle's notes safe (docs/deploy.md, "Keeping the notes safe"):
//
//   npm run bottles-safe -- backup     copies everything under bottles/ in the reels' bucket to a
//                                      new folder of the backups bucket, checks the copy holds every
//                                      note, and checks every note in the last backup is still kept
//   npm run bottles-safe -- check      only the second: says LOST for a note no longer kept
//   npm run bottles-safe -- daily      a backup if the last is a day old, then the check: for a
//                                      watch run every few minutes, printing only when something is wrong
//   npm run bottles-safe -- restore <backup>   puts back every file of that backup the bucket no
//                                      longer has; it never replaces or deletes anything there
//   npm run deploy [-- <more gcloud run deploy settings>]   (scripts/deploy.mjs) a backup, the
//                                      deploy, then a check that every note is still there
//
// A note is never deleted by anything in Pixel Reel or the bottle, so a note in an earlier backup
// that the service no longer lists is lost, and is said so. Needs a gcloud signed in to the project.
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROJECT = 'pixelreel-515501';
export const BUCKET = 'gs://pixelreel-515501-reels';
export const BACKUPS = 'gs://pixelreel-515501-bottle-backups';
export const SERVICE = 'https://pixelreel.pro';
const READER_SECRET = 'pixelreel-bottle-reader';

/** A note's folder in a listing: bottles/<id>/note.json, where an id is when it was left and a random part. */
const NOTE = /\/bottles\/(\d{8}-\d{6}-[0-9a-f]{8})\/note\.json$/;
/** A backup's folder: when it was made, in UTC, so they sort by time. */
const BACKUP = /^\d{8}-\d{6}$/;
const DAY = 86400_000;

/** gcloud, run from a folder of no consequence (the Windows gcloud resets the one it is run from). */
const gcloud = (args) => execFileSync('gcloud', [...args, `--project=${PROJECT}`], { encoding: 'utf8', cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The ids of the notes whose note.json is under `prefix` (a folder holding bottles/). */
export function noteIds(listing) {
  return [...new Set(listing.split('\n').map((line) => NOTE.exec(line.trim())?.[1]).filter(Boolean))].sort();
}

/** The ids in `before` that `after` does not have. */
export const missing = (before, after) => { const kept = new Set(after); return before.filter((id) => !kept.has(id)); };

/** A backup's name for `now`: 20261127-093000. */
export const stampOf = (now) => new Date(now).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** Every note the service lists, by its id. */
export async function liveIds({ fetch = globalThis.fetch, service = SERVICE, reader }) {
  const res = await fetch(`${service}/bottle/notes?state=all`, { headers: { authorization: `Bearer ${reader}` } });
  if (!res.ok) throw new Error(`the service would not list its notes: ${res.status}`);
  return (await res.json()).notes.map((n) => n.id).sort();
}

/** What it takes to look after the notes, from a gcloud signed in to the project. */
export function cloud({ run = gcloud } = {}) {
  return {
    reader: () => run(['secrets', 'versions', 'access', 'latest', `--secret=${READER_SECRET}`]).trim(),
    /** The backups made, oldest first. */
    backups: () => run(['storage', 'ls', `${BACKUPS}/`]).split('\n').map((l) => l.trim().replace(/\/$/, '').split('/').pop()).filter((n) => BACKUP.test(n)).sort(),
    notesIn: (prefix) => noteIds(run(['storage', 'ls', '-r', `${prefix}/bottles/`])),
    copy: (from, to) => run(['storage', 'cp', '-r', from, to]),
    /** Copies only what `to` does not have: nothing there is replaced. */
    putBack: (from, to) => run(['storage', 'cp', '-r', '--no-clobber', from, to])
  };
}

/** Says LOST for every note of the last backup the service no longer lists. Gives back what is lost. */
export async function check({ store, out, fetch }) {
  const last = store.backups().at(-1);
  if (!last) { out('There is no backup yet to check against: run npm run bottles-safe -- backup.'); return { lost: [], last: null }; }
  const kept = store.notesIn(`${BACKUPS}/${last}`), live = await liveIds({ fetch, reader: store.reader() });
  const lost = missing(kept, live);
  if (lost.length) {
    out(`LOST: ${lost.length} note${lost.length === 1 ? '' : 's'} in the backup of ${last} the service no longer lists: ${lost.join(', ')}`);
    out(`To put them back (nothing kept now is replaced): npm run bottles-safe -- restore ${last}`);
  }
  return { lost, last, live };
}

/** A backup now: copies bottles/ across, and checks the copy has every note the bucket has. */
export async function backup({ store, out, fetch, now = Date.now() }) {
  const before = await check({ store, out, fetch });
  const stamp = stampOf(now), there = store.notesIn(BUCKET);
  store.copy(`${BUCKET}/bottles`, `${BACKUPS}/${stamp}/`);
  const copied = store.notesIn(`${BACKUPS}/${stamp}`);
  const short = missing(there, copied);
  if (short.length) throw new Error(`the backup ${stamp} is short of ${short.length} notes: ${short.join(', ')}`);
  out(`Backed up ${copied.length} notes (and the sites, people and keys with them) to ${BACKUPS}/${stamp}`);
  return { stamp, notes: copied, lost: before.lost };
}

/** Puts back every file of backup `stamp` the bucket no longer has. */
export async function restore({ store, out, fetch, stamp }) {
  if (!BACKUP.test(stamp ?? '') || !store.backups().includes(stamp)) throw new Error(`there is no backup ${stamp}: npm run bottles-safe -- list`);
  store.putBack(`${BACKUPS}/${stamp}/bottles`, `${BUCKET}/`);
  const lost = missing(store.notesIn(`${BACKUPS}/${stamp}`), await liveIds({ fetch, reader: store.reader() }));
  out(lost.length ? `Still not listed after putting back: ${lost.join(', ')}` : `Every note of ${stamp} is kept.`);
  return lost;
}

export async function main(argv, { store = cloud(), out = (line) => console.log(line), fetch = globalThis.fetch, now = Date.now() } = {}) {
  const [command, stamp] = argv;
  try {
    if (command === 'backup') { const made = await backup({ store, out, fetch, now }); return made.lost.length ? 1 : 0; }
    if (command === 'check') {
      const { lost, last, live } = await check({ store, out, fetch });
      if (last && !lost.length) out(`Every note in the backup of ${last} is kept (${live.length} kept now).`);
      return lost.length ? 1 : 0;
    }
    if (command === 'daily') {
      // quiet unless something is wrong: a backup a day, and a note lost said at once
      const last = store.backups().at(-1);
      const due = !last || now - Date.parse(`${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6, 8)}T${last.slice(9, 11)}:${last.slice(11, 13)}:${last.slice(13, 15)}Z`) >= DAY;
      const said = [];
      const { lost } = due ? await backup({ store, out: (line) => said.push(line), fetch, now }) : await check({ store, out: (line) => said.push(line), fetch });
      for (const line of said.filter((l) => /^LOST|^To put them back/.test(l))) out(`bottles-safe: ${line}`);
      return lost.length ? 1 : 0;
    }
    if (command === 'restore') return (await restore({ store, out, fetch, stamp })).length ? 1 : 0;
    if (command === 'list') { for (const b of store.backups()) out(b); return 0; }
    out('Usage: npm run bottles-safe -- backup | check | daily | restore <backup> | list');
    return 2;
  } catch (err) {
    out(`bottles-safe: ${String(err.message ?? err).split('\n')[0]}`);
    return 1;
  }
}

const real = (file) => { try { return realpathSync(file); } catch { return resolve(file); } };
if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
