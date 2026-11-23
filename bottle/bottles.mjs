#!/usr/bin/env node
// Message in a Bottle, the reader: lists the notes left on a site, downloads them with their
// screenshots, and marks them read, asked, fixed or dropped. See README.md.
//
//   node bottle/bottles.mjs list [--state new|read|asked|fixed|dropped|all] [--json]
//   node bottle/bottles.mjs fetch [--state ...] [--out <folder>]   each note's note.json and shot.jpg in <folder>/<id>/
//   node bottle/bottles.mjs show <id>
//   node bottle/bottles.mjs mark <id> <state> [--answer "what was done"]
//
// --site (or BOTTLE_SITE) is the site's address, and the endpoint is at --prefix (default
// /bottle) on it. The reader key is BOTTLE_READER, or, with --gcloud-secret <name> [--project <p>],
// read from Google Secret Manager with gcloud, so it is never typed or kept anywhere.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const STATES = ['new', 'read', 'asked', 'fixed', 'dropped'];

const usage = `Usage: bottles <list|fetch|show|mark> [options]
  list [--state <state|all>] [--json]   the notes, new ones unless --state says otherwise
  fetch [--state <state|all>] [--out <folder>]   download them, each with its screenshot
  show <id>                             one note in full
  mark <id> <${STATES.join('|')}> [--answer <words>]
Options: --site <address> (or BOTTLE_SITE), --prefix </bottle>, and the reader key in BOTTLE_READER
or from --gcloud-secret <name> [--project <project>].`;

/** The reader key: BOTTLE_READER, or the latest version of a Secret Manager secret. */
function readerKey({ env, secret, project, run }) {
  if (env.BOTTLE_READER) return env.BOTTLE_READER.trim();
  if (!secret) throw new Error('No reader key: set BOTTLE_READER, or name the secret that holds it with --gcloud-secret.');
  const args = ['secrets', 'versions', 'access', 'latest', `--secret=${secret}`, ...(project ? [`--project=${project}`] : [])];
  return run('gcloud', args).trim();
}

const age = (at, now) => {
  const minutes = Math.max(0, Math.round((now - Date.parse(at)) / 60000));
  return minutes < 60 ? `${minutes}m` : minutes < 2880 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`;
};
const pathOf = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url; } };
const oneLine = (text, most) => { const line = String(text).replace(/\s+/g, ' ').trim(); return line.length > most ? `${line.slice(0, most - 3)}...` : line; };

/** Runs the reader with `argv`; what it says goes to `out`. Returns the exit code. */
export async function main(argv, { env = process.env, fetch = globalThis.fetch, out = (line) => console.log(line), now = Date.now(),
  run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', cwd: tmpdir(), shell: process.platform === 'win32' }) } = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: { site: { type: 'string' }, prefix: { type: 'string', default: '/bottle' }, state: { type: 'string' }, json: { type: 'boolean' }, out: { type: 'string' },
        answer: { type: 'string' }, 'gcloud-secret': { type: 'string' }, project: { type: 'string' }, help: { type: 'boolean', short: 'h' } }
    });
  } catch (err) {
    out(`${err.message}\n${usage}`);
    return 2;
  }
  const { values: opt, positionals: [command, ...rest] } = parsed;
  if (opt.help || !command) { out(usage); return command || opt.help ? 0 : 2; }
  const site = opt.site ?? env.BOTTLE_SITE;
  if (!site) { out('Name the site with --site or BOTTLE_SITE.'); return 2; }
  const base = `${site.replace(/\/$/, '')}${opt.prefix.replace(/\/$/, '')}`;
  let key;
  try { key = readerKey({ env, secret: opt['gcloud-secret'], project: opt.project, run }); } catch (err) { out(err.message.split('\n')[0]); return 2; }
  const ask = async (path, init = {}) => {
    const res = await fetch(`${base}/${path}`, { ...init, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.json().catch(() => null))?.error ?? res.statusText}`);
    return res;
  };
  const notes = async () => (await (await ask(`notes?state=${encodeURIComponent(opt.state ?? 'new')}`)).json()).notes;

  try {
    if (command === 'list') {
      const found = await notes();
      if (opt.json) { out(JSON.stringify(found, null, 2)); return 0; }
      const which = opt.state ?? 'new';
      if (!found.length) { out(which === 'all' ? 'No notes.' : `No ${which} notes.`); return 0; }
      for (const n of found) out(`${n.id}  ${n.state.padEnd(7)} ${age(n.at, now).padStart(4)}  ${pathOf(n.page.url)}  ${n.target.whole ? '(whole page)' : n.target.tag}: ${oneLine(n.note, 80)}`);
      return 0;
    }
    if (command === 'fetch') {
      const found = await notes(), folder = resolve(opt.out ?? '.bottles');
      for (const n of found) {
        const dir = join(folder, n.id);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'note.json'), `${JSON.stringify(n, null, 2)}\n`);
        if (n.shot) await writeFile(join(dir, 'shot.jpg'), Buffer.from(await (await ask(`notes/${n.id}/shot.jpg`)).arrayBuffer()));
        out(`${dir}  ${oneLine(n.note, 80)}`);
      }
      if (!found.length) out('Nothing to fetch.');
      return 0;
    }
    if (command === 'show') {
      if (!rest[0]) { out(usage); return 2; }
      out(JSON.stringify(await (await ask(`notes/${encodeURIComponent(rest[0])}`)).json(), null, 2));
      return 0;
    }
    if (command === 'mark') {
      const [id, state] = rest;
      if (!id || !STATES.includes(state)) { out(usage); return 2; }
      const note = await (await ask(`notes/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, ...(opt.answer ? { answer: opt.answer } : {}) })
      })).json();
      out(`${note.id} is ${note.state}`);
      return 0;
    }
  } catch (err) {
    out(`The notes could not be reached: ${err.message}`);
    return 1;
  }
  out(usage);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
