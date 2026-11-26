import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { daySummary, entryOf, handleDaybook, hadRight, NO_MAIL, plainName, sendSummary, summaryText, wantedOver } from '../service/daybook.mjs';
import { EXAMPLE_REEL, EXAMPLE_STAGE_REEL } from '../service/mcp.mjs';
import { DiskStore } from '../service/store.mjs';
import { addToLibrary, drawingProblems, libraryHas, libraryName, LIBRARY_FILE, recognised } from '../scripts/drawer.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-daybook-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** A store with a day's book: one reel with the right drawings, one that wished for two. */
async function bookedStore() {
  const store = new DiskStore(join(tmp, `s${Math.random()}`));
  await store.put('daybook/2026-11-26/a.json', JSON.stringify({ id: 'a', at: '2026-11-26T09:00:00Z', ...entryOf(EXAMPLE_STAGE_REEL, { how: 'website' }), critic: { faults: 2, mended: true, wishes: [] } }));
  await store.put('daybook/2026-11-26/b.json', JSON.stringify({ id: 'b', at: '2026-11-26T10:00:00Z', ...entryOf(EXAMPLE_REEL, { wishes: ['Gas Meter', 'inhaler', '<b>'] }), critic: { faults: 1, mended: false, wishes: ['inhaler'] } }));
  await store.put('daybook/2026-11-24/c.json', JSON.stringify({ id: 'c', at: '2026-11-24T10:00:00Z', ...entryOf(EXAMPLE_REEL, { wishes: ['inhaler'] }) }));
  return store;
}

/** Calls the day book's handler as a request would. */
async function ask(store, path, { method = 'GET', key = 'secret', mail = null } = {}) {
  let status = 0, headers = {}, body = '';
  const req = { url: path, method, headers: key ? { authorization: `Bearer ${key}` } : {} };
  const res = { writeHead(s, h) { status = s; headers = h; return this; }, end(b) { body = String(b ?? ''); } };
  const handled = await handleDaybook(req, res, { store, reader: 'secret', mail, to: 'olly@example.com', now: () => Date.parse('2026-11-26T20:00:00Z') });
  return { handled, status, headers, body };
}

describe('the day book', () => {
  it('keeps no words of a reel: its title cut short, its pictures, its drawings and its wishes', () => {
    const entry = entryOf(EXAMPLE_STAGE_REEL, { wishes: ['Gas meter', 'not a <name>', 'x'.repeat(50)] });
    assert.equal(entry.title, 'Your gas bill');
    assert.equal(entry.kinds.stage, 4);
    assert.ok(entry.things.includes('gas-meter') && !entry.things.includes('reelie'));
    assert.deepEqual(entry.wishes, ['gas meter']);
    for (const scene of EXAMPLE_STAGE_REEL.scenes) assert.ok(!JSON.stringify(entry).includes(scene.say));
    assert.equal(plainName('Smart  Meter'), 'smart meter');
    assert.equal(plainName('<script>'), null);
  });

  it('sums up a day: how many reels, which had the right drawings, and what to draw', async () => {
    const s = await daySummary(await bookedStore(), '2026-11-26');
    assert.equal(s.reels, 2);
    assert.equal(s.right, 1);
    assert.deepEqual(s.wanted, [{ name: 'gas meter', reels: 1 }, { name: 'inhaler', reels: 1 }]);
    assert.ok(hadRight({ wishes: [], own: [], critic: { faults: 3, mended: true } }), 'faults the critic mended still leave the right drawings');
    const text = summaryText(s);
    assert.match(text, /2 reels made/);
    assert.match(text, /1 of 2 had the right drawings/);
    assert.match(text, /- inhaler \(1 reel\)/);
    const week = await wantedOver(await bookedStore(), '2026-11-26', 7);
    assert.deepEqual(week.wanted[0], { name: 'inhaler', reels: 2 });
  });

  it('shows the summary only to whoever holds the admin key, and never takes the key from the address', async () => {
    const store = await bookedStore();
    assert.equal((await ask(store, '/day', { key: '' })).status, 401);
    assert.equal((await ask(store, '/day?key=secret', { key: '' })).status, 401);
    assert.equal((await ask(store, '/day', { key: 'wrong!' })).status, 401);
    const page = await ask(store, '/day');
    assert.equal(page.status, 200);
    assert.match(page.body, /<title>Pixel Reel, 2026-11-26<\/title>/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.equal(JSON.parse((await ask(store, '/day.json')).body).reels, 2, 'today, as JSON');
    const json = JSON.parse((await ask(store, '/day/2026-11-24.json')).body);
    assert.equal(json.reels, 1);
    assert.equal(JSON.parse((await ask(store, '/day/wanted?days=3')).body).wanted[0].name, 'inhaler');
    assert.equal((await ask(store, '/reels')).handled, false);
    assert.equal((await ask(store, '/daylight')).handled, false);
  });

  it('emails the summary once a day where email is set up, and says what is needed where it is not', async () => {
    const store = await bookedStore();
    const refused = await ask(store, '/day/send?day=2026-11-26', { method: 'POST' });
    assert.equal(refused.status, 503);
    assert.equal(JSON.parse(refused.body).error, NO_MAIL);
    const sent = [];
    const mail = async (m) => { sent.push(m); return { id: 'x' }; };
    assert.deepEqual(await sendSummary(store, '2026-11-26', { mail, to: 'olly@example.com' }), { sent: true });
    assert.deepEqual(await sendSummary(store, '2026-11-26', { mail, to: 'olly@example.com' }), { sent: false, already: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].subject, 'Pixel Reel today: 2 reels, 1 with the right drawings');
    assert.match(sent[0].text, /Drawings to make/);
  });
});

describe('the weekly drawer', () => {
  it('names a wish as the library would, and knows what the library has', () => {
    assert.equal(libraryName('Gas Meter'), 'gas-meter');
    assert.equal(libraryName('<x>'), null);
    assert.ok(libraryHas('gas-meter') && libraryHas('guitars') && libraryHas('letter') && libraryHas('reelie'));
    assert.ok(!libraryHas('inhaler'));
  });

  it('checks a drawing before it goes on the sheet', () => {
    assert.deepEqual(drawingProblems({ rows: ['.kkkk.', 'kwwwwk', 'kwwwwk', 'kwwwwk', 'kwwwwk', '.kkkk.'], says: 'a box' }), []);
    const wrong = drawingProblems({ rows: ['.kkkk.', 'kwwwwkk', 'kwQwwk', 'kwwwwk', 'kwwwwk', '.kkkk.'], says: '' });
    for (const bit of ['same length', 'not palette letters', '"says"']) assert.ok(wrong.some((p) => p.includes(bit)), bit);
  });

  it('takes a blind look\'s answer as knowing the thing only when it names it', () => {
    assert.ok(recognised('smart-meter', 'a smart energy meter', 'An energy meter'));
    assert.ok(recognised('inhaler', 'an asthma inhaler', 'Asthma inhaler (puffer)'));
    assert.ok(!recognised('violin', 'a violin', 'Acoustic guitar, pixel art'));
  });

  it('writes the drawings said yes to into the library', async () => {
    const copy = join(tmp, 'library.js');
    copyFileSync(LIBRARY_FILE, copy);
    const added = addToLibrary({ inhaler: { group: 'Health', says: "a doctor's inhaler", rows: ['.kkkk.', 'kbbbbk', 'kbbbbk', 'kwwwwk', 'kwwwwk', '.kkkk.'] }, letter: { group: 'x', says: 'x', rows: ['k'] } }, { file: copy, day: '2026-11-30' });
    assert.deepEqual(added, ['inhaler']);
    const text = readFileSync(copy, 'utf8');
    assert.match(text, /said yes to on the weekly sheet, 2026-11-30\n {2}inhaler: \{\n {4}group: 'Health', says: 'a doctor\\'s inhaler',/);
    const library = await import(`${copy}?v=1`).catch((err) => err);
    assert.ok(library.THINGS?.inhaler ?? /Cannot find module/.test(String(library)), 'the library still reads');
  });
});
