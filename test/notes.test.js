import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { NOTE_MAX, NOTES_MAX } from '../site/js/given.js';
import { readNotes, speechHere, tidyNote, writeNotes } from '../site/js/notes.js';

/** A stand-in for the browser's own storage. */
const storage = () => {
  const kept = new Map();
  return { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k), kept };
};

describe('My notes', () => {
  it('keeps each reel\'s notes apart on the device, and forgets them when there are none', () => {
    const s = storage();
    assert.deepEqual(readNotes(s, 'a'), []);
    assert.equal(writeNotes(s, 'a', ['why red?', 'and Mars']), true);
    assert.deepEqual(readNotes(s, 'a'), ['why red?', 'and Mars']);
    assert.deepEqual(readNotes(s, 'b'), []);
    writeNotes(s, 'a', []);
    assert.equal(s.kept.size, 0);
  });

  it('copes with a browser that keeps nothing, or with what it kept being spoilt', () => {
    const refuses = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => {} };
    assert.deepEqual(readNotes(refuses, 'a'), []);
    assert.equal(writeNotes(refuses, 'a', ['x']), false);
    assert.deepEqual(readNotes(null, 'a'), []);
    const s = storage();
    s.setItem('pixelreel-notes:a', '{oops');
    assert.deepEqual(readNotes(s, 'a'), []);
    s.setItem('pixelreel-notes:a', JSON.stringify(['ok', 7, '  ', ...Array(NOTES_MAX).fill('more')]));
    assert.deepEqual(readNotes(s, 'a'), ['ok', ...Array(NOTES_MAX - 1).fill('more')]);
  });

  it('keeps a note on one line, no longer than a note may be', () => {
    assert.equal(tidyNote('  why\n is it   red? '), 'why is it red?');
    assert.equal(tidyNote('x'.repeat(NOTE_MAX + 9)).length, NOTE_MAX);
    assert.equal(tidyNote(undefined), '');
  });

  it('hears a note through the browser\'s own speech recognition, but not in Brave, where it never works', () => {
    function Speech() {}
    assert.equal(speechHere({ webkitSpeechRecognition: Speech, navigator: {} }), Speech);
    assert.equal(speechHere({ SpeechRecognition: Speech, navigator: {} }), Speech);
    assert.equal(speechHere({ webkitSpeechRecognition: Speech, navigator: { brave: {} } }), null);
    assert.equal(speechHere({ navigator: {} }), null);
  });

  it('finds everything it looks for on a reel\'s page and the make page', () => {
    const page = readFileSync(new URL('../site/pages/reel.html', import.meta.url), 'utf8');
    const make = readFileSync(new URL('../site/pages/make.html', import.meta.url), 'utf8');
    const lookedIn = (script) => [...readFileSync(new URL(`../site/js/${script}`, import.meta.url), 'utf8').matchAll(/getElementById\('([a-z-]+)'\)/g)].map(([, id]) => id);
    for (const id of lookedIn('watch.js')) assert.ok(page.includes(` id="${id}"`), `watch.js: the page has nothing called ${id}`);
    // the panel's own parts are on both pages; the make page's own (its file chooser, the way to Claude) only there, and looked for with a ?
    const own = ['mynotes-file', 'mynotes-files', 'make-elsewhere'];
    for (const id of lookedIn('notes.js')) {
      assert.ok(make.includes(` id="${id}"`), `notes.js: the make page has nothing called ${id}`);
      if (!own.includes(id)) assert.ok(page.includes(` id="${id}"`), `notes.js: a reel's page has nothing called ${id}`);
    }
    assert.match(page, /<aside class="mynotes" id="mynotes" aria-labelledby="mynotes-title" hidden>/, 'hidden until the script wakes it');
    assert.match(page, new RegExp(`maxlength="${NOTE_MAX}"`));
  });
});
