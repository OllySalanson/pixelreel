#!/usr/bin/env node
// Message in a Bottle, the admin tool: adds sites and the people on each one's list (and
// prints each person's link), turns a person off, and works through each site's queue of
// notes: lists them, downloads them with their screenshots, marks each one with what came of
// it, and shows the results. See README.md, "Looking after the sites".
//
// --service (or BOTTLE_SERVICE) is the service's address, and the endpoint is at --prefix
// (default /bottle) on it. The admin key is BOTTLE_READER, or, with --gcloud-secret <name>
// [--project <p>], read from Google Secret Manager with gcloud, so it is never typed or kept.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const STATES = ['new', 'in-progress', 'held', 'declined', 'done', 'closed'];

const usage = `Usage: bottles <command> [options]
Notes:
  queue <site> [--json]                 the site's open notes (new, in progress, held), oldest first
  results <site> [--json]               what came of the site's notes, as a table
  list [--site <id>] [--state <state|open|all>] [--json]
  fetch [--site <id>] [--state <state|open|all>] [--out <folder>]   each with its screenshot
  show <id>
  start <id>                            in progress
  done <id> --what <words> --confidence <0-100> [--conflict <words>]
  held <id> --conflict <words> --proposal <words>
  declined <id> --reason "We haven't done this because..."
  close <id>                            its writer says it is right
Sites and people:
  sites                                 every site, with its queue
  site add <id> --name <name> --origin <address> [--origin <address>]
  people <site>
  person add <site> --name <name> --email <address>   prints their link
  person off|on <site> <person>
  person link <site> <person>           a new link for them
  invite <site> <person> [--to <address>]             the "Review your website" email
  outbox                                the emails kept instead of sent
Options: --service <address> (or BOTTLE_SERVICE), --prefix </bottle>, and the admin key in
BOTTLE_READER or from --gcloud-secret <name> [--project <project>].
States: ${STATES.join(', ')}.`;

/** The admin key: BOTTLE_READER, or the latest version of a Secret Manager secret. */
function adminKey({ env, secret, project, run }) {
  if (env.BOTTLE_READER) return env.BOTTLE_READER.trim();
  if (!secret) throw new Error('No admin key: set BOTTLE_READER, or name the secret that holds it with --gcloud-secret.');
  const args = ['secrets', 'versions', 'access', 'latest', `--secret=${secret}`, ...(project ? [`--project=${project}`] : [])];
  return run('gcloud', args).trim();
}

const age = (at, now) => {
  const minutes = Math.max(0, Math.round((now - Date.parse(at)) / 60000));
  return minutes < 60 ? `${minutes}m` : minutes < 2880 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`;
};
const pathOf = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url; } };
const oneLine = (text, most) => { const line = String(text ?? '').replace(/\s+/g, ' ').trim(); return line.length > most ? `${line.slice(0, most - 3)}...` : line; };
const cell = (text) => oneLine(text, 200).replace(/\|/g, '\\|') || ' ';

/** A note in one line: its id, state, age, page, the part it is about and its words. */
const noteLine = (n, now) => `${n.id}  ${n.state.padEnd(11)} ${age(n.at, now).padStart(4)}  ${n.site ? `${n.site} ` : ''}${pathOf(n.page.url)}  ${n.target.whole ? '(whole page)' : n.target.tag}: ${oneLine(n.note, 80)}`;

/** The results as a table: the request, what was done, how sure, and any conflict. */
function resultsTable(notes) {
  const rows = notes.map((n) => {
    const o = n.outcome ?? {};
    const done = n.state === 'declined' ? o.reason : n.state === 'held' ? `Held: ${o.proposal ?? ''}` : o.what;
    return `| ${cell(n.note)} | ${cell(n.state)} | ${cell(done)} | ${Number.isFinite(o.confidence) && (n.state === 'done' || n.state === 'closed') ? `${o.confidence}%` : ' '} | ${cell(o.conflict)} |`;
  });
  return ['| Request | State | What was done | Confidence | Conflict |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}

/** Runs the tool with `argv`; what it says goes to `out`. Returns the exit code. */
export async function main(argv, { env = process.env, fetch = globalThis.fetch, out = (line) => console.log(line), now = Date.now(),
  run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', cwd: tmpdir(), shell: process.platform === 'win32' }) } = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        service: { type: 'string' }, prefix: { type: 'string', default: '/bottle' }, site: { type: 'string' }, state: { type: 'string' }, json: { type: 'boolean' },
        out: { type: 'string' }, what: { type: 'string' }, confidence: { type: 'string' }, conflict: { type: 'string' }, proposal: { type: 'string' }, reason: { type: 'string' },
        name: { type: 'string' }, email: { type: 'string' }, origin: { type: 'string', multiple: true }, to: { type: 'string' },
        'gcloud-secret': { type: 'string' }, project: { type: 'string' }, help: { type: 'boolean', short: 'h' }
      }
    });
  } catch (err) {
    out(`${err.message}\n${usage}`);
    return 2;
  }
  const { values: opt, positionals: [command, ...rest] } = parsed;
  if (opt.help || !command) { out(usage); return command || opt.help ? 0 : 2; }
  const service = opt.service ?? env.BOTTLE_SERVICE;
  if (!service) { out('Name the service with --service or BOTTLE_SERVICE.'); return 2; }
  const base = `${service.replace(/\/$/, '')}${opt.prefix.replace(/\/$/, '')}`;
  let key;
  try { key = adminKey({ env, secret: opt['gcloud-secret'], project: opt.project, run }); } catch (err) { out(err.message.split('\n')[0]); return 2; }
  const ask = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(`${base}/${path}`, {
      method, headers: { authorization: `Bearer ${key}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!res.ok) throw Object.assign(new Error(`${res.status}: ${(await res.json().catch(() => null))?.error ?? res.statusText}`), { answered: true });
    return res;
  };
  const askJson = async (path, init) => (await ask(path, init)).json();
  const notes = async (state, site) => (await askJson(`notes?state=${encodeURIComponent(state)}${site ? `&site=${encodeURIComponent(site)}` : ''}`)).notes;
  const mark = async (id, state, fields = {}) => {
    const note = await askJson(`notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: { state, ...fields } });
    out(`${note.id} is ${note.state}`);
    return 0;
  };
  const show = (value) => { out(JSON.stringify(value, null, 2)); return 0; };
  const wants = (n) => { if (rest.length < n) { out(usage); return false; } return true; };
  const enc = encodeURIComponent;

  try {
    switch (command) {
      case 'list':
      case 'queue': {
        const site = command === 'queue' ? rest[0] : opt.site;
        if (command === 'queue' && !wants(1)) return 2;
        const which = command === 'queue' ? 'open' : opt.state ?? 'new';
        const found = await notes(which, site);
        if (opt.json) return show(found);
        if (!found.length) { out(which === 'all' ? 'No notes.' : `No ${which} notes${site ? ` on ${site}` : ''}.`); return 0; }
        for (const n of found) out(noteLine(n, now));
        return 0;
      }
      case 'results': {
        if (!wants(1)) return 2;
        const found = (await notes('all', rest[0])).filter((n) => ['held', 'declined', 'done', 'closed'].includes(n.state));
        if (opt.json) return show(found.map((n) => ({ id: n.id, request: n.note, state: n.state, ...n.outcome })));
        out(found.length ? resultsTable(found) : `Nothing has come of ${rest[0]}'s notes yet.`);
        return 0;
      }
      case 'fetch': {
        const found = await notes(opt.state ?? 'new', opt.site), folder = resolve(opt.out ?? '.bottles');
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
      case 'show': return wants(1) ? show(await askJson(`notes/${enc(rest[0])}`)) : 2;
      case 'start': return wants(1) ? await mark(rest[0], 'in-progress') : 2;
      case 'close': return wants(1) ? await mark(rest[0], 'closed') : 2;
      case 'done': return wants(1) ? await mark(rest[0], 'done', { what: opt.what, confidence: opt.confidence === undefined ? undefined : Number(opt.confidence), conflict: opt.conflict }) : 2;
      case 'held': return wants(1) ? await mark(rest[0], 'held', { conflict: opt.conflict, proposal: opt.proposal }) : 2;
      case 'declined': return wants(1) ? await mark(rest[0], 'declined', { reason: opt.reason }) : 2;
      case 'mark': {
        const [id, state] = rest;
        if (!id || !STATES.includes(state)) { out(usage); return 2; }
        return await mark(id, state, { what: opt.what, confidence: opt.confidence === undefined ? undefined : Number(opt.confidence), conflict: opt.conflict, proposal: opt.proposal, reason: opt.reason });
      }
      case 'sites': {
        const { sites } = await askJson('sites');
        if (opt.json) return show(sites);
        for (const s of sites) {
          const counts = STATES.filter((st) => s.counts[st]).map((st) => `${s.counts[st]} ${st}`).join(', ') || 'no notes';
          out(`${s.id.padEnd(16)} ${s.name}  ${s.origins.join(' ')}  ${s.people.length} on the list  ${counts}`);
        }
        return 0;
      }
      case 'site': {
        if (rest[0] !== 'add' || !rest[1]) { out(usage); return 2; }
        const site = await askJson('sites', { method: 'POST', body: { id: rest[1], name: opt.name, origins: opt.origin ?? [] } });
        out(`${site.id} is ${site.name}, at ${site.origins.join(' ')}`);
        return 0;
      }
      case 'people': {
        if (!wants(1)) return 2;
        const site = await askJson(`sites/${enc(rest[0])}`);
        if (opt.json) return show(site.people);
        if (!site.people.length) { out(`Nobody is on ${site.name}'s list.`); return 0; }
        for (const p of site.people) out(`${p.id.padEnd(16)} ${(p.on ? 'on' : 'off').padEnd(4)} ${p.name}  ${p.email}${p.owner ? '  (the service\'s own key)' : ''}`);
        return 0;
      }
      case 'person': {
        const [act, site, person] = rest;
        if (act === 'add' && site) {
          const made = await askJson(`sites/${enc(site)}/people`, { method: 'POST', body: { name: opt.name, email: opt.email } });
          out(`${made.person.name} (${made.person.id}) is on ${site}'s list. Their link:\n${made.link}`);
          return 0;
        }
        if ((act === 'off' || act === 'on') && site && person) {
          const p = await askJson(`sites/${enc(site)}/people/${enc(person)}`, { method: 'PATCH', body: { on: act === 'on' } });
          out(`${p.name} is ${p.on ? 'on' : 'off'}`);
          return 0;
        }
        if (act === 'link' && site && person) { out((await askJson(`sites/${enc(site)}/people/${enc(person)}/link`, { method: 'POST', body: {} })).link); return 0; }
        out(usage);
        return 2;
      }
      case 'invite': {
        if (!wants(2)) return 2;
        const sent = await askJson(`sites/${enc(rest[0])}/people/${enc(rest[1])}/invite`, { method: 'POST', body: opt.to ? { to: opt.to } : {} });
        out(sent.sent ? `The invitation was sent to ${sent.to}.` : `The invitation to ${sent.to} is in the outbox, not sent.`);
        return 0;
      }
      case 'outbox': {
        const { mails } = await askJson('outbox');
        if (opt.json) return show(mails);
        if (!mails.length) { out('The outbox is empty.'); return 0; }
        for (const m of mails) out(`${m.at}  to ${m.to}  "${m.subject}"\n${m.text.replace(/^(?=.)/gm, '    ')}\n`);
        return 0;
      }
      default:
        out(usage);
        return 2;
    }
  } catch (err) {
    out(err.answered ? err.message : `The service could not be reached: ${err.message}`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await main(process.argv.slice(2));
