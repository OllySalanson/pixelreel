#!/usr/bin/env node
// Keeps Message in a Bottle's notes safe (docs/deploy.md, "Keeping the notes safe"), in both
// places they are kept: Pixel Reel's own (pixelreel.pro, its notes in the reels' bucket under
// bottles/) and the client sites' (ollysalanson.com/bottle on NameHero, its notes in a folder
// reached by SFTP). `--of pixelreel` (the default) or `--of namehero` says which.
//
//   npm run bottles-safe -- backup [--of <place>]   copies everything under bottles/ to a new
//                         folder of the backups bucket, checks the copy holds every note, and
//                         checks every note in the last backup is still kept
//   npm run bottles-safe -- check [--of <place>]    only the second: says LOST for a note no longer kept
//   npm run bottles-safe -- daily                   for both places, a backup if the last is a day
//                         old, then the check: for a watch run every hour or so, printing only
//                         when something is wrong
//   npm run bottles-safe -- restore <backup> [--of <place>]   puts back every file of that backup
//                         the place no longer has; it never replaces or deletes anything there
//   npm run bottles-safe -- list [--of <place>]
//   npm run bottles-safe -- compare <site> [<site> ...]   whether both places hold the same notes of
//                         each site, in the same states (as after a site is copied from one to the other)
//   npm run deploy (scripts/deploy.mjs): a backup, the deploy, then a check that every note is still there
//
// A note is never deleted by anything in Pixel Reel or the bottle, so a note in an earlier backup
// that the service no longer lists is lost, and is said so. Needs a gcloud signed in to the
// project, and for NameHero the SFTP key ~/.ssh/namehero_deploy.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT = 'pixelreel-515501';
export const BUCKET = 'gs://pixelreel-515501-reels';
export const BACKUPS = 'gs://pixelreel-515501-bottle-backups';
export const SERVICE = 'https://pixelreel.pro';
const READER_SECRET = 'pixelreel-bottle-reader';

/** NameHero: where ollysalanson.com's Bottle keeps its notes, and how to reach it. */
export const NAMEHERO = {
  service: 'https://ollysalanson.com', host: 'thelazyn@node613.namehero.net', port: '37980',
  key: join(homedir(), '.ssh', 'namehero_deploy'), data: 'bottle-data', settings: 'bottle-app/settings.env'
};

/** A note's folder in a listing: bottles/<id>/note.json, where an id is when it was left and a random part. */
const NOTE = /(?:^|\/)bottles\/(\d{8}-\d{6}-[0-9a-f]{8})\/note\.json$/;
/** A backup's folder: when it was made, in UTC, so they sort by time. */
const BACKUP = /^\d{8}-\d{6}$/;
const DAY = 86400_000;

/** gcloud, run from a folder of no consequence (the Windows gcloud resets the one it is run from). */
const gcloud = (args) => execFileSync('gcloud', [...args, `--project=${PROJECT}`], { encoding: 'utf8', cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

/** The ids of the notes in a listing of files, one a line, that holds bottles/<id>/note.json. */
export function noteIds(listing) {
  return [...new Set(listing.split('\n').map((line) => NOTE.exec(line.trim())?.[1]).filter(Boolean))].sort();
}

/** The ids in `before` that `after` does not have. */
export const missing = (before, after) => { const kept = new Set(after); return before.filter((id) => !kept.has(id)); };

/** A backup's name for `now`: 20261127-093000. */
export const stampOf = (now) => new Date(now).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const timeOf = (stamp) => Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`);

/** Every note a service lists, whole. */
async function liveNotes({ fetch = globalThis.fetch, service, reader }) {
  const res = await fetch(`${service}/bottle/notes?state=all`, { headers: { authorization: `Bearer ${reader}` } });
  if (!res.ok) throw new Error(`${service} would not list its notes: ${res.status}`);
  return (await res.json()).notes;
}

/**
 * Says, for each of `sites`, whether the two places hold the same notes in the same states: how
 * many each has, and every note only one has or whose state differs. Gives back how many differ.
 */
export async function compare({ places, sites, out, fetch }) {
  const [a, b] = Object.values(places);
  const [left, right] = await Promise.all([a, b].map(async (p) => liveNotes({ fetch, service: p.service, reader: p.reader() })));
  let differ = 0;
  for (const site of sites) {
    const mine = (list) => new Map(list.filter((n) => n.site === site).map((n) => [n.id, n]));
    const x = mine(left), y = mine(right);
    const only = (m, other) => [...m.keys()].filter((id) => !other.has(id));
    const states = [...x.keys()].filter((id) => y.has(id) && x.get(id).state !== y.get(id).state);
    const wrong = [...only(x, y).map((id) => `${id} only on ${a.name}`), ...only(y, x).map((id) => `${id} only on ${b.name}`), ...states.map((id) => `${id} is ${x.get(id).state} on ${a.name}, ${y.get(id).state} on ${b.name}`)];
    differ += wrong.length;
    out(`${site}: ${x.size} notes on ${a.name}, ${y.size} on ${b.name}${wrong.length ? `; DIFFER: ${wrong.join('; ')}` : ', the same notes in the same states'}`);
  }
  return differ;
}

/** Every note a service lists, by its id. */
export async function liveIds({ fetch = globalThis.fetch, service = SERVICE, reader }) {
  const res = await fetch(`${service}/bottle/notes?state=all`, { headers: { authorization: `Bearer ${reader}` } });
  if (!res.ok) throw new Error(`${service} would not list its notes: ${res.status}`);
  return (await res.json()).notes.map((n) => n.id).sort();
}

/** Every file under `dir`, as paths relative to it. */
function filesIn(dir, under = '') {
  if (!existsSync(join(dir, under))) return [];
  return readdirSync(join(dir, under)).flatMap((name) => {
    const rel = under ? `${under}/${name}` : name;
    return statSync(join(dir, rel)).isDirectory() ? filesIn(dir, rel) : [rel];
  });
}

/** The backups made of `prefix` in the backups bucket, oldest first (none yet, when gcloud finds nothing there). */
function backupsUnder(run, prefix) {
  let listing;
  try { listing = run(['storage', 'ls', `${BACKUPS}/${prefix}`]); } catch (err) {
    if (/matched no objects/.test(`${err.stderr ?? ''}${err.message}`)) return [];
    throw err;
  }
  return listing.split('\n').map((l) => l.trim().replace(/\/$/, '').split('/').pop()).filter((n) => BACKUP.test(n)).sort();
}

/** Pixel Reel's own notes, in the reels' bucket, backed up to the top of the backups bucket. */
export function cloud({ run = gcloud } = {}) {
  return {
    name: 'pixelreel', service: SERVICE,
    reader: () => run(['secrets', 'versions', 'access', 'latest', `--secret=${READER_SECRET}`]).trim(),
    backups: () => backupsUnder(run, ''),
    liveNotes: () => noteIds(run(['storage', 'ls', '-r', `${BUCKET}/bottles/`])),
    backupNotes: (stamp) => noteIds(run(['storage', 'ls', '-r', `${BACKUPS}/${stamp}/bottles/`])),
    copy: (stamp) => run(['storage', 'cp', '-r', `${BUCKET}/bottles`, `${BACKUPS}/${stamp}/`]),
    /** Copies only what the bucket does not have: nothing there is replaced. */
    putBack: (stamp) => run(['storage', 'cp', '-r', '--no-clobber', `${BACKUPS}/${stamp}/bottles`, `${BUCKET}/`])
  };
}

/**
 * The client sites' notes on NameHero (no shell there: SFTP only), backed up to namehero/ in the
 * backups bucket. A copy is made by fetching the whole folder, which is small (notes and their
 * screenshots), and putting it in the bucket.
 */
export function namehero({ run = gcloud, sftp = (batch) => execFileSync('sftp', ['-i', NAMEHERO.key, '-P', NAMEHERO.port, '-o', 'BatchMode=yes', '-q', '-b', '-', NAMEHERO.host], { input: batch, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }), env = process.env } = {}) {
  /** NameHero's bottles/ fetched into a new folder here: give back the folder, and remove it once done with. */
  const fetched = () => {
    const dir = mkdtempSync(join(tmpdir(), 'bottles-namehero-'));
    sftp(`get -r ${NAMEHERO.data}/bottles ${dir}/\n`);
    if (!existsSync(join(dir, 'bottles'))) throw new Error('NameHero\'s bottles folder could not be fetched');
    return dir;
  };
  const withFetched = (work) => { const dir = fetched(); try { return work(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };
  return {
    name: 'namehero', service: NAMEHERO.service,
    reader: () => {
      if (env.NAMEHERO_BOTTLE_READER) return env.NAMEHERO_BOTTLE_READER.trim();
      const dir = mkdtempSync(join(tmpdir(), 'bottles-namehero-'));
      try {
        sftp(`get ${NAMEHERO.settings} ${dir}/settings.env\n`);
        return /^BOTTLE_READER=(.*)$/m.exec(readFileSync(join(dir, 'settings.env'), 'utf8'))?.[1].trim() ?? '';
      } finally { rmSync(dir, { recursive: true, force: true }); }
    },
    backups: () => backupsUnder(run, 'namehero/'),
    liveNotes: () => withFetched((dir) => noteIds(filesIn(dir).join('\n'))),
    backupNotes: (stamp) => noteIds(run(['storage', 'ls', '-r', `${BACKUPS}/namehero/${stamp}/bottles/`])),
    copy: (stamp) => withFetched((dir) => run(['storage', 'cp', '-r', join(dir, 'bottles'), `${BACKUPS}/namehero/${stamp}/`])),
    /** Puts back every file of the backup NameHero does not have, and nothing else. */
    putBack: (stamp) => withFetched((there) => {
      const from = mkdtempSync(join(tmpdir(), 'bottles-backup-'));
      try {
        run(['storage', 'cp', '-r', `${BACKUPS}/namehero/${stamp}/bottles`, `${from}/`]);
        const have = new Set(filesIn(there));
        const lacking = filesIn(from).filter((rel) => !have.has(rel));
        if (!lacking.length) return;
        const folders = [...new Set(lacking.flatMap((rel) => rel.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))))].sort();
        const batch = [...folders.map((f) => `-mkdir ${NAMEHERO.data}/${f}`), ...lacking.map((rel) => `put -p ${join(from, rel)} ${NAMEHERO.data}/${rel}`)].join('\n');
        sftp(`${batch}\n`);
      } finally { rmSync(from, { recursive: true, force: true }); }
    })
  };
}

const prefixOf = (store, stamp) => `${BACKUPS}/${store.name === 'pixelreel' ? '' : `${store.name}/`}${stamp}`;

/** Says LOST for every note of the last backup the service no longer lists. Gives back what is lost. */
export async function check({ store, out, fetch }) {
  const last = store.backups().at(-1);
  if (!last) { out(`There is no backup of ${store.name} yet to check against: run npm run bottles-safe -- backup --of ${store.name}.`); return { lost: [], last: null }; }
  const kept = store.backupNotes(last), live = await liveIds({ fetch, service: store.service, reader: store.reader() });
  const lost = missing(kept, live);
  if (lost.length) {
    out(`LOST: ${lost.length} note${lost.length === 1 ? '' : 's'} in ${store.name}'s backup of ${last} that ${store.service} no longer lists: ${lost.join(', ')}`);
    out(`To put them back (nothing kept now is replaced): npm run bottles-safe -- restore ${last} --of ${store.name}`);
  }
  return { lost, last, live };
}

/** A backup now: copies bottles/ across, and checks the copy has every note the place has. */
export async function backup({ store, out, fetch, now = Date.now() }) {
  const before = await check({ store, out, fetch });
  const stamp = stampOf(now), there = store.liveNotes();
  store.copy(stamp);
  const copied = store.backupNotes(stamp);
  const short = missing(there, copied);
  if (short.length) throw new Error(`${store.name}'s backup ${stamp} is short of ${short.length} notes: ${short.join(', ')}`);
  out(`Backed up ${copied.length} of ${store.name}'s notes (and the sites, people and keys with them) to ${prefixOf(store, stamp)}`);
  return { stamp, notes: copied, lost: before.lost };
}

/** Puts back every file of backup `stamp` the place no longer has. */
export async function restore({ store, out, fetch, stamp }) {
  if (!BACKUP.test(stamp ?? '') || !store.backups().includes(stamp)) throw new Error(`there is no backup ${stamp} of ${store.name}: npm run bottles-safe -- list --of ${store.name}`);
  store.putBack(stamp);
  const lost = missing(store.backupNotes(stamp), await liveIds({ fetch, service: store.service, reader: store.reader() }));
  out(lost.length ? `Still not listed after putting back: ${lost.join(', ')}` : `Every note of ${store.name}'s ${stamp} is kept.`);
  return lost;
}

/** The daily look at one place: a backup once a day, and only what is wrong said. */
async function daily({ store, out, fetch, now }) {
  const last = store.backups().at(-1);
  const said = [];
  const { lost } = !last || now - timeOf(last) >= DAY ? await backup({ store, out: (line) => said.push(line), fetch, now }) : await check({ store, out: (line) => said.push(line), fetch });
  for (const line of said.filter((l) => /^LOST|^To put them back/.test(l))) out(`bottles-safe: ${line}`);
  return lost.length ? 1 : 0;
}

export async function main(argv, { places = { pixelreel: cloud(), namehero: namehero() }, out = (line) => console.log(line), fetch = globalThis.fetch, now = Date.now() } = {}) {
  const of = argv.includes('--of') ? argv[argv.indexOf('--of') + 1] : 'pixelreel';
  const [command, stamp] = argv.filter((a, i) => a !== '--of' && argv[i - 1] !== '--of');
  const store = places[of];
  if (!store) { out(`--of is one of ${Object.keys(places).join(', ')}`); return 2; }
  try {
    if (command === 'backup') { const made = await backup({ store, out, fetch, now }); return made.lost.length ? 1 : 0; }
    if (command === 'check') {
      const { lost, last, live } = await check({ store, out, fetch });
      if (last && !lost.length) out(`Every note in ${store.name}'s backup of ${last} is kept (${live.length} kept now).`);
      return lost.length ? 1 : 0;
    }
    if (command === 'daily') {
      // each place on its own, so one that cannot be reached is said and the other still looked at
      let code = 0;
      for (const place of Object.values(places)) {
        try { code = Math.max(code, await daily({ store: place, out, fetch, now })); } catch (err) { out(`bottles-safe: ${place.name}: ${String(err.message ?? err).split('\n')[0]}`); code = 1; }
      }
      return code;
    }
    if (command === 'restore') return (await restore({ store, out, fetch, stamp })).length ? 1 : 0;
    if (command === 'list') { for (const b of store.backups()) out(b); return 0; }
    if (command === 'compare') {
      const sites = argv.slice(1).filter((a, i, all) => a !== '--of' && all[i - 1] !== '--of');
      if (!sites.length) { out('Name the sites to compare.'); return 2; }
      return (await compare({ places, sites, out, fetch })) ? 1 : 0;
    }
    out('Usage: npm run bottles-safe -- backup | check | daily | restore <backup> | list   [--of pixelreel|namehero]');
    return 2;
  } catch (err) {
    out(`bottles-safe: ${String(err.message ?? err).split('\n')[0]}`);
    return 1;
  }
}

const real = (file) => { try { return realpathSync(file); } catch { return resolve(file); } };
if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
