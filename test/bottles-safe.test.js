// Keeping Message in a Bottle's notes safe (scripts/bottles-safe.mjs): backups, the check that no
// note kept before has gone, and putting back what has, with gcloud and the service stood in for.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { BACKUPS, BUCKET, main, missing, namehero, noteIds, stampOf } from '../scripts/bottles-safe.mjs';

const A = '20261125-101500-0a1b2c3d', B = '20261126-090000-1a2b3c4d', C = '20261127-080000-2a3b4c5d';

/** A place's notes as file names, its backups as copies of them, and a service listing what it holds. */
function stand(kept, backups = {}, name = 'pixelreel') {
  const files = { place: new Set(kept.flatMap((id) => [`bottles/${id}/note.json`, `bottles/${id}/shot.jpg`]).concat('bottles/sites/client/site.json')), backups };
  const store = {
    name, service: `https://${name}.example`,
    reader: () => 'admin',
    backups: () => Object.keys(files.backups).sort(),
    liveNotes: () => noteIds([...files.place].join('\n')),
    backupNotes: (stamp) => noteIds([...(files.backups[stamp] ?? [])].join('\n')),
    copy: (stamp) => { files.backups[stamp] = new Set(files.place); },
    putBack: (stamp) => { for (const f of files.backups[stamp]) files.place.add(f); }
  };
  return { files, store };
}

/** Runs the tool on `places`, with a service for each listing what that place holds. */
function tool(...stands) {
  const places = Object.fromEntries(stands.map((t) => [t.store.name, t.store]));
  const fetch = async (url, { headers }) => {
    assert.equal(headers.authorization, 'Bearer admin');
    const t = stands.find((x) => url.startsWith(x.store.service));
    if (!t) throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ notes: t.store.liveNotes().map((id) => ({ id })) }), { status: 200 });
  };
  return async (args, now = Date.parse('2026-11-27T09:30:00Z')) => {
    const lines = [];
    const code = await main(args, { places, fetch, now, out: (line) => lines.push(line) });
    return { code, text: lines.join('\n') };
  };
}

describe('keeping the notes safe', () => {
  it('reads the notes out of a bucket listing, and names a backup by when it was made', () => {
    const listing = `${BUCKET}/bottles/${A}/note.json\n${BUCKET}/bottles/${A}/shot.jpg\n${BUCKET}/bottles/given/abc.json\n${BUCKET}/bottles/sites/x/site.json\n${BUCKET}/bottles/${B}/note.json\nbottles/${C}/note.json\n`;
    assert.deepEqual(noteIds(listing), [A, B, C]);
    assert.deepEqual(missing([A, B, C], [C, A]), [B]);
    assert.equal(stampOf(Date.parse('2026-11-27T09:30:05Z')), '20261127-093005');
  });

  it('backs up every note, with the sites and people, and checks the copy has them all', async () => {
    const t = stand([A, B]), run = tool(t);
    const made = await run(['backup']);
    assert.equal(made.code, 0);
    assert.match(made.text, new RegExp(`Backed up 2 of pixelreel's notes .* to ${BACKUPS}/20261127-093000$`));
    assert.ok(t.files.backups['20261127-093000'].has('bottles/sites/client/site.json'));
    assert.match((await run(['check'])).text, /^Every note in pixelreel's backup of 20261127-093000 is kept \(2 kept now\)\.$/);
    const other = stand([C], {}, 'namehero');
    assert.match((await tool(t, other)(['backup', '--of', 'namehero'])).text, new RegExp(`Backed up 1 of namehero's notes .* to ${BACKUPS}/namehero/20261127-093000$`));
    assert.equal((await run(['backup', '--of', 'elsewhere'])).code, 2);
  });

  it('says LOST for a note kept before that the service no longer lists, and puts it back without replacing anything', async () => {
    const t = stand([A, B, C], {}, 'namehero'), run = tool(t);
    await run(['backup', '--of', 'namehero']);
    t.files.place.delete(`bottles/${B}/note.json`);
    const checked = await run(['check', '--of', 'namehero']);
    assert.equal(checked.code, 1);
    assert.match(checked.text, new RegExp(`^LOST: 1 note in namehero's backup of 20261127-093000 that https://namehero.example no longer lists: ${B}\nTo put them back .*restore 20261127-093000 --of namehero$`));
    // a backup now would be short of it too: said, and the deploy stops
    assert.equal((await run(['backup', '--of', 'namehero'], Date.parse('2026-11-27T10:00:00Z'))).code, 1);
    const back = await run(['restore', '20261127-093000', '--of', 'namehero']);
    assert.deepEqual([back.code, back.text], [0, "Every note of namehero's 20261127-093000 is kept."]);
    assert.equal((await run(['restore', '20261101-000000', '--of', 'namehero'])).code, 1, 'no such backup');
  });

  it('once a day backs up both places, and between says nothing unless a note is lost', async () => {
    const t = stand([A]), nh = stand([B, C], {}, 'namehero'), run = tool(t, nh);
    assert.deepEqual(await run(['daily']), { code: 0, text: '' }, 'the first backups, quietly');
    assert.deepEqual([Object.keys(t.files.backups).length, Object.keys(nh.files.backups).length], [1, 1]);
    assert.deepEqual(await run(['daily'], Date.parse('2026-11-27T20:00:00Z')), { code: 0, text: '' });
    assert.equal(Object.keys(t.files.backups).length, 1, 'not a day since the last');
    nh.files.place.delete(`bottles/${C}/note.json`);
    const said = await run(['daily'], Date.parse('2026-11-27T21:00:00Z'));
    assert.equal(said.code, 1);
    assert.match(said.text, /^bottles-safe: LOST: 1 note in namehero's/);
    nh.files.place.add(`bottles/${C}/note.json`);
    await run(['daily'], Date.parse('2026-11-28T10:00:00Z'));
    assert.equal(Object.keys(t.files.backups).length, 2, 'a day on, another');
  });

  it('says so when a place or gcloud cannot be asked, rather than nothing, and still looks at the other', async () => {
    const t = stand([A]);
    const broken = { ...stand([B], {}, 'namehero').store, backups: () => { throw new Error('sftp: connection refused'); } };
    const lines = [];
    const code = await main(['daily'], { places: { pixelreel: t.store, namehero: broken }, fetch: async () => new Response(JSON.stringify({ notes: [{ id: A }] })), now: Date.parse('2026-11-27T09:30:00Z'), out: (l) => lines.push(l) });
    assert.deepEqual([code, lines], [1, ['bottles-safe: namehero: sftp: connection refused']]);
    assert.equal(Object.keys(t.files.backups).length, 1, 'Pixel Reel is backed up all the same');
    assert.equal((await tool(t)(['nonsense'])).code, 2);
  });

  it('copies NameHero\'s notes by SFTP into the backups bucket, and puts back only what it lacks', async () => {
    const there = mkdtempSync(join(tmpdir(), 'namehero-')), bucket = mkdtempSync(join(tmpdir(), 'backups-'));
    const add = (root, rel, text = 'x') => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), text); };
    add(there, `bottle-data/bottles/${A}/note.json`); add(there, `bottle-data/bottles/${A}/shot.jpg`); add(there, 'bottle-data/bottles/sites/client/site.json', 'now');
    add(there, 'bottle-app/settings.env', 'BOTTLE_DATA=/x\nBOTTLE_READER=nh-admin\n');
    const sent = [];
    // SFTP as far as the tool uses it: get, get -r, -mkdir and put -p
    const sftp = (batch) => {
      sent.push(batch);
      for (const line of batch.split('\n').filter(Boolean)) {
        const [cmd, ...args] = line.split(' ');
        if (cmd === 'get' && args[0] === '-r') cpSync(join(there, args[1]), join(args[2], 'bottles'), { recursive: true });
        else if (cmd === 'get') cpSync(join(there, args[0]), args[1]);
        else if (cmd === '-mkdir') mkdirSync(join(there, args[0]), { recursive: true });
        else if (cmd === 'put') cpSync(args[1], join(there, args[2]));
      }
    };
    // gcloud storage as far as the tool uses it, with the bucket a folder
    const local = (url) => join(bucket, url.replace(`${BACKUPS}/`, ''));
    const run = (args) => {
      if (args[1] === 'ls' && args[2] === '-r') return existsSync(local(args[3])) ? walk(local(args[3])).map((f) => `${args[3]}${f}`).join('\n') : '';
      if (args[1] === 'ls') {
        if (!existsSync(local(args[2]))) throw Object.assign(new Error('Command failed'), { stderr: 'ERROR: (gcloud.storage.ls) One or more URLs matched no objects.' });
        return readdirSync(local(args[2])).map((n) => `${args[2]}${n}/`).join('\n');
      }
      if (args[1] === 'cp') { const [from, to] = args.slice(-2); const src = from.startsWith('gs://') ? local(from) : from; const dst = to.startsWith('gs://') ? local(to) : to; mkdirSync(dst, { recursive: true }); cpSync(src, join(dst, 'bottles'), { recursive: true }); return ''; }
      throw new Error(`gcloud ${args.join(' ')}`);
    };
    const walk = (dir, under = '') => readdirSync(join(dir, under), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir, `${under}${e.name}/`) : [`${under}${e.name}`]));
    const store = namehero({ run, sftp, env: {} });
    assert.deepEqual(store.backups(), [], 'none yet');
    assert.equal(store.reader(), 'nh-admin');
    assert.deepEqual(store.liveNotes(), [A]);
    store.copy('20261127-093000');
    assert.deepEqual(store.backups(), ['20261127-093000']);
    assert.deepEqual(store.backupNotes('20261127-093000'), [A]);
    // lost on NameHero, and the site's list changed since: only the lost files go back
    rmSync(join(there, `bottle-data/bottles/${A}`), { recursive: true });
    writeFileSync(join(there, 'bottle-data/bottles/sites/client/site.json'), 'changed since');
    store.putBack('20261127-093000');
    assert.deepEqual(store.liveNotes(), [A]);
    assert.equal(readFileSync(join(there, 'bottle-data/bottles/sites/client/site.json'), 'utf8'), 'changed since', 'nothing there is replaced');
    assert.ok(!sent.at(-1).includes('site.json'));
    for (const dir of [there, bucket]) rmSync(dir, { recursive: true, force: true });
  });

  it('says whether both places hold the same notes of a site, in the same states', async () => {
    const lists = {
      'https://pixelreel.example': [{ id: A, site: 'client', state: 'closed' }, { id: B, site: 'client', state: 'new' }, { id: C, site: 'own', state: 'new' }],
      'https://namehero.example': [{ id: A, site: 'client', state: 'closed' }, { id: B, site: 'client', state: 'new' }]
    };
    const places = { pixelreel: stand([]).store, namehero: stand([], {}, 'namehero').store };
    const fetch = async (url) => new Response(JSON.stringify({ notes: lists[new URL(url).origin] }));
    const lines = [];
    assert.equal(await main(['compare', 'client'], { places, fetch, out: (l) => lines.push(l) }), 0);
    assert.deepEqual(lines, ['client: 2 notes on pixelreel, 2 on namehero, the same notes in the same states']);
    lists['https://namehero.example'][1].state = 'done';
    lists['https://namehero.example'].push({ id: C, site: 'client', state: 'new' });
    lines.length = 0;
    assert.equal(await main(['compare', 'client'], { places, fetch, out: (l) => lines.push(l) }), 1);
    assert.deepEqual(lines, [`client: 2 notes on pixelreel, 3 on namehero; DIFFER: ${C} only on namehero; ${B} is new on pixelreel, done on namehero`]);
  });
});
