import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calledMine, deleteMine, forgetMine, MINE, MOST, openedMine, readMine, rememberMine, updateMine } from '../site/js/mine.js';

/** Stands in for the browser's localStorage. */
const fakeStorage = (kept = {}) => ({
  kept,
  getItem: (key) => kept[key] ?? null,
  setItem: (key, value) => { kept[key] = String(value); }
});
const id = (n) => `reel${String(n).padStart(18, '0')}`;
const NOW = Date.parse('2026-11-22T12:00:00Z'), LATER = '2026-12-22T12:00:00.000Z';

describe('your reels, kept on this device', () => {
  it('lists the reels opened here too, with no key, and puts the one opened last at the top', () => {
    const storage = fakeStorage();
    rememberMine(storage, { id: id(1), title: 'Mine', expires: LATER, key: 'key-one' }, NOW);
    rememberMine(storage, { id: id(2), title: 'Mine too', expires: LATER, key: 'key-two' }, NOW + 1000);
    // one someone was sent: on the list, at the top, with no key, so it can be taken off but not deleted
    let reels = openedMine(storage, { id: id(3), title: 'Sent to me', expires: LATER }, NOW + 2000);
    assert.deepEqual(reels.map((reel) => [reel.id, reel.key]), [[id(3), ''], [id(2), 'key-two'], [id(1), 'key-one']]);
    // opening one made here brings it to the top, and keeps its key and its name
    updateMine(storage, id(1), { name: 'Gas bill' }, NOW + 2500);
    reels = openedMine(storage, { id: id(1), title: 'Mine', expires: LATER }, NOW + 3000);
    assert.deepEqual(reels.map((reel) => reel.id), [id(1), id(3), id(2)]);
    assert.deepEqual([reels[0].key, reels[0].name, reels[0].made, reels[0].seen], ['key-one', 'Gas bill', NOW, NOW + 3000]);
    assert.deepEqual(openedMine(storage, { id: 'nonsense' }, NOW + 4000).length, 3, 'and nothing that is not a reel');
  });

  it('lists the reels made here, newest first, each with the key that deletes it', () => {
    const storage = fakeStorage();
    assert.deepEqual(readMine(storage, NOW), []);
    rememberMine(storage, { id: id(1), watch: `/r/${id(1)}`, title: 'Your reel', expires: LATER, key: 'key-one' }, NOW);
    const reels = rememberMine(storage, { id: id(2), title: '  Tea,\n properly ', expires: LATER, key: 'key-two' }, NOW + 1000);
    assert.deepEqual(reels, [
      { id: id(2), title: 'Tea, properly', name: '', key: 'key-two', made: NOW + 1000, seen: 0, expires: LATER },
      { id: id(1), title: 'Your reel', name: '', key: 'key-one', made: NOW, seen: 0, expires: LATER }
    ]);
    assert.deepEqual(readMine(storage, NOW + 2000), reels, 'and it is there the next time the page is opened');
    assert.equal(rememberMine(storage, { id: id(1), title: 'Again', key: 'key-one' }, NOW + 3000)[0].id, id(1), 'one remembered twice is listed once, at the top');
    assert.equal(readMine(storage, NOW + 4000).length, 2);
    assert.deepEqual(rememberMine(storage, { id: 'not an id', title: 'x' }, NOW).map((reel) => reel.id), [id(1), id(2)], 'what is not a reel is not listed');
  });

  it('learns a reel\'s name once it is written, and keeps the name its maker gives it', () => {
    const storage = fakeStorage();
    rememberMine(storage, { id: id(1), title: 'Your reel', expires: LATER, key: 'k' }, NOW);
    updateMine(storage, id(1), { title: 'How a mortgage works' }, NOW);
    assert.equal(calledMine(readMine(storage, NOW)[0]), 'How a mortgage works');
    updateMine(storage, id(1), { name: '  The  mortgage one ' }, NOW);
    updateMine(storage, id(1), { title: 'How a mortgage works, simply' }, NOW);
    const [reel] = readMine(storage, NOW);
    assert.deepEqual([reel.title, reel.name, calledMine(reel), reel.key], ['How a mortgage works, simply', 'The mortgage one', 'The mortgage one', 'k']);
    assert.equal(calledMine(updateMine(storage, id(1), { name: '   ' }, NOW)[0]), 'How a mortgage works, simply', 'a name rubbed out gives it back its own');
    // nothing is written when nothing has changed, and a reel that is someone else's is never added
    const before = storage.kept[MINE];
    let writes = 0;
    const counting = { ...storage, setItem: (key, value) => { writes++; storage.setItem(key, value); } };
    updateMine(counting, id(1), { title: 'How a mortgage works, simply', expires: LATER }, NOW);
    updateMine(counting, id(9), { title: 'Not mine' }, NOW);
    assert.equal(writes, 0);
    assert.equal(storage.kept[MINE], before);
  });

  it('lets go of a reel past the day it is kept until, one that is forgotten, and the oldest of too many', () => {
    const storage = fakeStorage();
    rememberMine(storage, { id: id(1), title: 'Old', expires: '2026-11-23T00:00:00.000Z', key: 'k' }, NOW);
    rememberMine(storage, { id: id(2), title: 'New', expires: LATER, key: 'k' }, NOW + 1);
    assert.deepEqual(readMine(storage, Date.parse('2026-11-24T00:00:00Z')).map((reel) => reel.title), ['New']);
    assert.deepEqual(forgetMine(storage, id(2), NOW).map((reel) => reel.title), ['Old']);
    assert.deepEqual(forgetMine(storage, id(7), NOW).map((reel) => reel.title), ['Old']);
    for (let n = 10; n < 10 + MOST + 5; n++) rememberMine(storage, { id: id(n), title: `Reel ${n}`, expires: LATER, key: 'k' }, NOW + n);
    const reels = readMine(storage, NOW + 100);
    assert.equal(reels.length, MOST);
    assert.equal(reels[0].title, `Reel ${10 + MOST + 4}`);
  });

  it('makes do with a browser that keeps nothing, or keeps nonsense', () => {
    const nowhere = { getItem: () => null, setItem: () => { throw new Error('no room'); } };
    assert.deepEqual(rememberMine(nowhere, { id: id(1), title: 'Tea', key: 'k' }, NOW).map((reel) => reel.title), ['Tea'], 'the reel is made all the same');
    assert.deepEqual(readMine(nowhere, NOW), []);
    for (const nonsense of ['{oops', '"words"', '{"a":1}', '[null, 7, {"id":"short"}, {"id":7}]']) assert.deepEqual(readMine(fakeStorage({ [MINE]: nonsense }), NOW), []);
    const odd = readMine(fakeStorage({ [MINE]: JSON.stringify([{ id: id(1), title: 7, name: ['x'], key: 9, made: 'then', expires: 'never' }]) }), NOW);
    assert.deepEqual(odd, [{ id: id(1), title: 'A pixel reel', name: '', key: '', made: 0, seen: 0, expires: null }]);
  });

  it('deletes a reel for good with its key, and only then takes it off the list', async () => {
    const storage = fakeStorage(), asked = [];
    rememberMine(storage, { id: id(1), title: 'Tea', expires: LATER, key: 'key-one' }, Date.now());
    const [reel] = readMine(storage);
    const answering = (status) => async (address, options) => { asked.push([address, options]); return { status }; };
    assert.equal(await deleteMine(storage, reel, { ask: answering(403) }), 'failed');
    assert.equal(await deleteMine(storage, reel, { ask: async () => { throw new TypeError('offline'); } }), 'failed');
    assert.equal(readMine(storage).length, 1, 'it is still there, so it is still listed');
    assert.equal(await deleteMine(storage, reel, { ask: answering(200) }), 'deleted');
    assert.deepEqual(asked.at(-1), [`/r/${id(1)}`, { method: 'DELETE', headers: { 'x-reel-key': 'key-one' } }]);
    assert.deepEqual(readMine(storage), []);
    rememberMine(storage, { id: id(2), title: 'Gone', expires: LATER, key: 'k' }, Date.now());
    assert.equal(await deleteMine(storage, readMine(storage)[0], { ask: answering(404) }), 'gone');
    assert.deepEqual(readMine(storage), [], 'one that had gone already comes off the list too');
  });
});
