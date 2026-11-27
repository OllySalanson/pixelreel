// Keeping Message in a Bottle's notes safe (scripts/bottles-safe.mjs): backups, the check that no
// note kept before has gone, and putting back what has, with gcloud and the service stood in for.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BACKUPS, BUCKET, main, missing, noteIds, stampOf } from '../scripts/bottles-safe.mjs';

const A = '20261125-101500-0a1b2c3d', B = '20261126-090000-1a2b3c4d', C = '20261127-080000-2a3b4c5d';

/** The two buckets as folders of file names, and a service listing what the reels' bucket holds. */
function stand(bucket, backups = {}) {
  const files = { bucket: new Set(bucket.flatMap((id) => [`bottles/${id}/note.json`, `bottles/${id}/shot.jpg`]).concat('bottles/sites/client/site.json')), backups };
  const listing = (names, root) => [...names].map((n) => `${root}/${n}`).join('\n');
  const store = {
    reader: () => 'admin',
    backups: () => Object.keys(files.backups).sort(),
    notesIn: (prefix) => noteIds(prefix === BUCKET ? listing(files.bucket, BUCKET) : listing(files.backups[prefix.split('/').pop()] ?? [], prefix)),
    copy: (from, to) => { files.backups[to.replace(/\/$/, '').split('/').pop()] = new Set(files.bucket); },
    putBack: (from) => { for (const name of files.backups[from.split('/').at(-2)]) files.bucket.add(name); }
  };
  const fetch = async (url, { headers }) => {
    assert.equal(headers.authorization, 'Bearer admin');
    const ids = noteIds(listing(files.bucket, BUCKET));
    return new Response(JSON.stringify({ notes: ids.map((id) => ({ id })) }), { status: 200 });
  };
  const run = async (args, now = Date.parse('2026-11-27T09:30:00Z')) => {
    const lines = [];
    const code = await main(args, { store, fetch, now, out: (line) => lines.push(line) });
    return { code, text: lines.join('\n') };
  };
  return { files, run };
}

describe('keeping the notes safe', () => {
  it('reads the notes out of a bucket listing, and names a backup by when it was made', () => {
    const listing = `${BUCKET}/bottles/${A}/note.json\n${BUCKET}/bottles/${A}/shot.jpg\n${BUCKET}/bottles/given/abc.json\n${BUCKET}/bottles/sites/x/site.json\n${BUCKET}/bottles/${B}/note.json\n`;
    assert.deepEqual(noteIds(listing), [A, B]);
    assert.deepEqual(missing([A, B, C], [C, A]), [B]);
    assert.equal(stampOf(Date.parse('2026-11-27T09:30:05Z')), '20261127-093005');
  });

  it('backs up every note, with the sites and people, and checks the copy has them all', async () => {
    const t = stand([A, B]);
    const made = await t.run(['backup']);
    assert.equal(made.code, 0);
    assert.match(made.text, new RegExp(`Backed up 2 notes .* to ${BACKUPS}/20261127-093000`));
    assert.ok(t.files.backups['20261127-093000'].has('bottles/sites/client/site.json'));
    assert.match((await t.run(['check'])).text, /^Every note in the backup of 20261127-093000 is kept \(2 kept now\)\.$/);
  });

  it('says LOST for a note kept before that the service no longer lists, and puts it back without replacing anything', async () => {
    const t = stand([A, B, C]);
    await t.run(['backup']);
    t.files.bucket.delete(`bottles/${B}/note.json`);
    const checked = await t.run(['check']);
    assert.equal(checked.code, 1);
    assert.match(checked.text, new RegExp(`^LOST: 1 note in the backup of 20261127-093000 the service no longer lists: ${B}\nTo put them back .*restore 20261127-093000$`));
    // a backup now would be short of it too: said, and the deploy stops
    assert.equal((await t.run(['backup'], Date.parse('2026-11-27T10:00:00Z'))).code, 1);
    const back = await t.run(['restore', '20261127-093000']);
    assert.deepEqual([back.code, back.text], [0, 'Every note of 20261127-093000 is kept.']);
    assert.equal((await t.run(['restore', '20261101-000000'])).code, 1, 'no such backup');
  });

  it('once a day backs up, and between says nothing unless a note is lost', async () => {
    const t = stand([A]);
    assert.deepEqual(await t.run(['daily']), { code: 0, text: '' }, 'the first backup, quietly');
    assert.equal(Object.keys(t.files.backups).length, 1);
    assert.deepEqual(await t.run(['daily'], Date.parse('2026-11-27T20:00:00Z')), { code: 0, text: '' });
    assert.equal(Object.keys(t.files.backups).length, 1, 'not a day since the last');
    t.files.bucket.delete(`bottles/${A}/note.json`);
    const said = await t.run(['daily'], Date.parse('2026-11-27T21:00:00Z'));
    assert.equal(said.code, 1);
    assert.match(said.text, /^bottles-safe: LOST: 1 note/);
    t.files.bucket.add(`bottles/${A}/note.json`);
    await t.run(['daily'], Date.parse('2026-11-28T10:00:00Z'));
    assert.equal(Object.keys(t.files.backups).length, 2, 'a day on, another');
  });

  it('says so when the service or gcloud cannot be asked, rather than nothing', async () => {
    const t = stand([A]);
    const lines = [];
    const code = await main(['daily'], { store: { backups: () => { throw new Error('gcloud: not signed in'); } }, out: (l) => lines.push(l) });
    assert.deepEqual([code, lines], [1, ['bottles-safe: gcloud: not signed in']]);
    assert.equal((await t.run(['nonsense'])).code, 2);
  });
});
