import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sitePage } from '../service/site.mjs';
import { describe, it } from 'node:test';
import { NOTE_MAX, NOTES_MAX, TEXT_MAX } from '../site/js/given.js';
import { canMake, keyAfter, noteRequest, readNotes, speechHere, tidyNote, writeNotes } from '../site/js/notes.js';

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
    // on the make page a note may be a pasted transcript: its lines are kept, and it may be as long as a piece of writing
    assert.equal(tidyNote('  Monday:\r\n\r\n\r\n\r\nwe   agreed. ', { first: true }), 'Monday:\n\nwe agreed.');
    assert.equal(tidyNote('x'.repeat(TEXT_MAX + 9), { first: true }).length, TEXT_MAX);
  });

  it('shows one key after the line: the microphone, or the arrow once there are words to add', () => {
    assert.equal(keyAfter({ words: false, hears: true }), 'mic');
    assert.equal(keyAfter({ words: true, hears: true }), 'save', 'the arrow takes the microphone\'s place');
    assert.equal(keyAfter({ words: true, hears: true, listening: true }), 'mic', 'the microphone stays while it is writing what it hears, to be pressed again');
    assert.equal(keyAfter({ words: false, hears: true, listening: true }), 'mic');
    // where nothing can hear, there is no microphone, and no key at all until there are words
    assert.equal(keyAfter({ words: false, hears: false }), null);
    assert.equal(keyAfter({ words: true, hears: false }), 'save');
    assert.equal(keyAfter(), null);
  });

  it('can make a reel from a note, from a photo or a PDF alone, or from words still in the line', () => {
    assert.ok(!canMake());
    assert.ok(!canMake({ notes: 0, clipped: false, words: false }));
    assert.ok(canMake({ notes: 1 }));
    assert.ok(canMake({ clipped: true }));
    assert.ok(canMake({ words: true }));
  });

  it('sends the notes for the next reel after this one, or for a first, with the photo or PDF clipped to them', () => {
    assert.deepEqual(noteRequest('abc', ['why red?']), { next: 'abc', notes: ['why red?'] });
    assert.deepEqual(noteRequest('abc', ['why red?'], { data: 'JVBERi0=' }), { next: 'abc', notes: ['why red?'], file: { data: 'JVBERi0=' } });
    assert.deepEqual(noteRequest('abc', [], { data: 'JVBERi0=' }), { next: 'abc', notes: [], file: { data: 'JVBERi0=' } }, 'a photo alone is enough');
    // a first reel, from the make page: read by whoever was chosen on this device, in the language chosen last
    const s = storage();
    assert.deepEqual(noteRequest('make', ['tea'], { first: true, storage: s }), { notes: ['tea'] });
    s.setItem('pixelreel-language', 'french');
    assert.deepEqual(noteRequest('make', ['le thé'], { first: true, storage: s, data: '/9j/' }), { notes: ['le thé'], file: { data: '/9j/' }, language: 'french' });
    s.setItem('pixelreel-language', 'english');
    assert.deepEqual(noteRequest('make', ['tea'], { first: true, storage: s }), { notes: ['tea'] });
    assert.deepEqual(noteRequest('make', ['tea'], { first: true }), { notes: ['tea'] }, 'with nowhere to keep a choice');
  });

  it('hears a note through the browser\'s own speech recognition, but not in Brave, where it never works', () => {
    function Speech() {}
    assert.equal(speechHere({ webkitSpeechRecognition: Speech, navigator: {} }), Speech);
    assert.equal(speechHere({ SpeechRecognition: Speech, navigator: {} }), Speech);
    assert.equal(speechHere({ webkitSpeechRecognition: Speech, navigator: { brave: {} } }), null);
    assert.equal(speechHere({ navigator: {} }), null);
  });

  it('finds everything it looks for on a reel\'s page and the make page', () => {
    const page = sitePage('reel', 'https://reels.example', { values: { reelid: 'abcdefghijklmnopqrstuv', reeltitle: 'Tea' } });
    const make = sitePage('make', 'https://reels.example');
    const lookedIn = (script) => [...readFileSync(new URL(`../site/js/${script}`, import.meta.url), 'utf8').matchAll(/getElementById\('([a-z-]+)'\)/g)].map(([, id]) => id);
    for (const id of lookedIn('watch.js')) assert.ok(page.includes(` id="${id}"`), `watch.js: the page has nothing called ${id}`);
    // the panel is the same on both pages (notesHtml in service/site.mjs); only the way to Claude is the make page's own
    const own = ['make-elsewhere'];
    for (const id of lookedIn('notes.js')) {
      assert.ok(make.includes(` id="${id}"`), `notes.js: the make page has nothing called ${id}`);
      if (!own.includes(id)) assert.ok(page.includes(` id="${id}"`), `notes.js: a reel's page has nothing called ${id}`);
    }
    assert.match(page, /<aside class="mynotes" id="mynotes" aria-labelledby="mynotes-title" hidden>/, 'hidden until the script wakes it');
    assert.match(page, new RegExp(`maxlength="${NOTE_MAX}"`));
  });
});
