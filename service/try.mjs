// Make it right here: what the service needs to take a visitor's request for a reel, whether
// or not it has been given a writer to write one (service/writer.mjs, which needs the Claude
// API and so is only loaded when the feature is switched on). A visitor gives one thing to
// explain: a link or a few words, some writing, a PDF or a picture.
import { ABOUT_MAX, CHAIN_MAX, fileKind, isVideoLink, NOTE_MAX, NOTES_MAX, PDF_MAX, PICTURE_MAX, TEXT_MAX, VIDEO_SAYS } from '../site/js/given.js';

export { ABOUT_MAX, CHAIN_MAX, NOTE_MAX, NOTES_MAX, PDF_MAX, PICTURE_MAX, TEXT_MAX };

/** The most words a request to /try may carry as JSON: the longest writing, in the widest letters, quoted. */
export const MAX_WORDS_BODY = TEXT_MAX * 4 + 1024;

/** The most a request to /try may carry as JSON: those words, and with them the biggest file, written as base64. */
export const MAX_JSON_BODY = MAX_WORDS_BODY + Math.ceil(PDF_MAX / 3) * 4;

/**
 * Something the visitor can be told, in plain words: their request cannot be made into a
 * reel. `free` says Claude was never paid to look at it, so it should not count as one of
 * the visitor's goes.
 */
export class TryError extends Error {
  constructor(message, { free = false } = {}) {
    super(message);
    this.free = free;
  }
}

/** Everything a keyboard cannot type and a page should not hold: control characters, but for `keep`. */
const plain = (words, keep = '') => [...words].filter((ch) => keep.includes(ch) || (ch >= ' ' && ch !== '\u007f')).join('');

/** What the visitor asked for, tidied to one line, or a TryError saying why it will not do. */
export function tidyAbout(about) {
  if (typeof about !== 'string') throw new TryError('Say what you want explained.');
  // control characters would let a request break out of the line it is quoted on
  const words = plain(about).replace(/\s+/g, ' ').trim();
  if (!words) throw new TryError('Say what you want explained.');
  if (words.length > ABOUT_MAX) throw new TryError(`Keep it to a link, or a few words: ${ABOUT_MAX} letters at most.`);
  if (isVideoLink(words)) throw new TryError(VIDEO_SAYS);   // Claude cannot load one: said now, it costs nothing
  return words;
}

/** Writing the visitor pasted or dropped in, tidied but with its lines kept, or a TryError saying why it will not do. */
export function tidyText(text) {
  if (typeof text !== 'string') throw new TryError('Say what you want explained.');
  const words = plain(text.replace(/\r\n?/g, '\n'), '\n\t').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!words) throw new TryError('Say what you want explained.');
  if (words.length > TEXT_MAX) throw new TryError('That is too much for one reel. Give it less: a few pages at most.');
  return words;
}

/**
 * The notes someone left on a reel (My notes), tidied, each to one line, or a TryError
 * saying why they will not do: at least one, at most NOTES_MAX, none longer than NOTE_MAX.
 * With `orNone` there may be none: a file was given with them, and is enough by itself.
 */
export function tidyNotes(notes, { orNone = false } = {}) {
  if (orNone && notes === undefined) return [];
  if (!Array.isArray(notes)) throw new TryError('Add a note first.');
  if (notes.length > NOTES_MAX) throw new TryError(`That is too many notes for one reel: ${NOTES_MAX} at most.`);
  const tidied = notes.map((note) => (typeof note === 'string' ? plain(note).replace(/\s+/g, ' ').trim() : ''));
  if (tidied.some((note) => note.length > NOTE_MAX)) throw new TryError(`A note can be ${NOTE_MAX} letters at most.`);
  const kept = tidied.filter(Boolean);
  if (!kept.length && !orNone) throw new TryError('Add a note first.');
  return kept;
}

/**
 * The notes someone left on the make page for their first reel (My notes beside the reel
 * about making one), tidied, each with its lines kept, or a TryError saying why they will not
 * do: there is no reel before it, so a note may be a link, a question, or a long piece of
 * writing such as a meeting's transcript, so long as all of them together are no more than
 * one piece of writing may be (TEXT_MAX). With `orNone` there may be none: a file was given
 * with them, and is enough by itself.
 */
export function tidyFirstNotes(notes, { orNone = false } = {}) {
  if (orNone && notes === undefined) return [];
  if (!Array.isArray(notes)) throw new TryError('Add a note first.');
  if (notes.length > NOTES_MAX) throw new TryError(`That is too many notes for one reel: ${NOTES_MAX} at most.`);
  const kept = notes.filter((note) => typeof note === 'string' && note.trim()).map((note) => tidyText(note));
  if (!kept.length && !orNone) throw new TryError('Add a note first.');
  if (kept.join('\n').length > TEXT_MAX) throw new TryError('That is too much for one reel. Give it less: a few pages at most.');
  return kept;
}

/**
 * The ways a reel can be asked for again, once it has been watched, and what Claude is told
 * for each: the rest of "Write it again, ...".
 */
export const AGAIN = {
  simpler: 'in simpler words: shorter sentences, everyday words, and one small idea a scene. Leave out, or explain, any word a ten-year-old might not know. It may have a scene or two more, if that keeps each one simple.',
  shorter: 'much shorter: about half as long, with only the three or four scenes that matter most.'
};

const UNREADABLE_FILE = 'Pixel Reel can read a PDF, a photo, or plain writing. Save that as a PDF, then give it again.';

/**
 * A file the visitor gave, from its own bytes, which must begin as a PDF ({ kind: 'pdf', data })
 * or a picture ({ kind: 'picture', type, data }) does, whatever it is called, or a TryError
 * saying why it will not do. `data` is base64, as the Claude API takes it.
 */
export function fileOf(bytes) {
  const kind = fileKind(bytes);
  if (!kind) throw new TryError(UNREADABLE_FILE);
  if (kind === 'application/pdf') {
    if (bytes.length > PDF_MAX) throw new TryError('That file is too big. Give it a shorter one, or only the pages that matter.');
    return { kind: 'pdf', data: bytes.toString('base64') };
  }
  if (bytes.length > PICTURE_MAX) throw new TryError('That picture is too big. Try a smaller one, or a screenshot.');
  return { kind: 'picture', type: kind, data: bytes.toString('base64') };
}

/** A file that came inside JSON, as { data } (its bytes in base64), with notes beside it: see fileOf. */
function fileIn(file) {
  if (typeof file?.data !== 'string' || !file.data || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw new TryError(UNREADABLE_FILE);
  return fileOf(Buffer.from(file.data, 'base64'));
}

/**
 * What a request to /try asks to have explained, from its body, or a TryError saying why it
 * will not do. JSON brings { about } (a link or a few words: { kind: 'words', about }),
 * { text } (writing: { kind: 'text', text }), { again, how } (a reel made earlier, to be
 * written again simpler or shorter: { kind: 'again', id, how }) or { next, notes } (the notes
 * left on a reel, for the next reel to answer: { kind: 'follow', id, notes }), or { notes }
 * alone (the notes left on the make page, for a first reel: { kind: 'notes', notes }); anything else
 * is a file's own bytes (fileOf: { kind: 'pdf', data } or { kind: 'picture', type, data }).
 * Notes may come with one file, a PDF or a picture clipped to them: { file: { data } }, its
 * bytes in base64. It goes with them as `file` (as fileOf gives it), and then there need be
 * no notes at all; a file with no notes and no reel before it is the file alone.
 */
export function sourceOf(type, bytes) {
  if (/^application\/json\b/i.test(type ?? '')) {
    let body;
    try { body = JSON.parse(bytes.toString('utf8')); } catch { body = null; }
    const file = body?.file === undefined ? null : fileIn(body.file), withFile = file ? { file } : {};
    if (body?.next !== undefined) {
      // the next reel, made from the notes left on this one (the service finds the chain of reels before it, in service/server.mjs)
      if (typeof body.next !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(body.next)) throw new TryError('That reel cannot be followed.');
      return { kind: 'follow', id: body.next, notes: tidyNotes(body.notes, { orNone: Boolean(file) }), ...withFile };
    }
    if (body?.notes !== undefined || file) {
      // a first reel, from the notes left on the make page: there is no reel before it
      const notes = tidyFirstNotes(body.notes, { orNone: Boolean(file) });
      if (!notes.length) return { ...file, language: body.language, narrator: body.narrator };   // the file alone, as if its own bytes had been sent
      return { kind: 'notes', notes, ...withFile, language: body.language, narrator: body.narrator };
    }
    if (body?.again !== undefined) {
      // a reel to write again: which one, and how (the service finds the reel itself, in service/server.mjs)
      if (typeof body.again !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(body.again) || !Object.hasOwn(AGAIN, body.how)) throw new TryError('That reel cannot be made again.');
      return { kind: 'again', id: body.again, how: body.how };
    }
    // `language` and `narrator` are what was asked for, as they came: the service knows which it offers (languageOf, narratorOf)
    if (typeof body?.text === 'string') return { kind: 'text', text: tidyText(body.text), language: body.language, narrator: body.narrator };
    return { kind: 'words', about: tidyAbout(body?.about), language: body?.language, narrator: body?.narrator };
  }
  return fileOf(bytes);
}

/**
 * How far Claude has got with a reel, from as much of its reply as has arrived: { title,
 * scenes }. `title` is the reel's own (null until it is written whole), and `scenes` is how
 * many scenes are written so far: one for each caption that is finished, since every scene
 * has one, and nothing else in a reel is called a caption.
 */
export function writtenSoFar(text) {
  const quoted = '"((?:[^"\\\\]|\\\\.)*)"';
  // only a title that comes before the scenes is the reel's: a scene has one too, and so have some pictures
  const named = new RegExp(`"title"\\s*:\\s*${quoted}`).exec(text.split(/"scenes"\s*:/)[0]);
  let title = null;
  try {
    if (named) title = String(JSON.parse(`"${named[1]}"`)).replace(/\s+/g, ' ').trim().slice(0, 80) || null;
  } catch {
    // an escape Claude has only half written: the title is not there yet
  }
  return { title, scenes: (text.match(new RegExp(`"caption"\\s*:\\s*${quoted}`, 'g')) ?? []).length };
}

/** What each language Peter can read is called by the people who speak it, for the box's choice of language. */
export const OWN_NAMES = { english: 'English', french: 'Français', german: 'Deutsch', spanish: 'Español', italian: 'Italiano', portuguese: 'Português', dutch: 'Nederlands' };

/**
 * The language a visitor asked for their reel in, as the recorder knows it: null for
 * English, or for none asked for. `offered` are the languages besides English that Peter
 * can read here; anything else is a TryError.
 */
export function languageOf(asked, offered = []) {
  if (asked === undefined || asked === null || asked === '' || asked === 'english') return null;
  if (typeof asked !== 'string' || !offered.includes(asked)) throw new TryError('Peter cannot read that language here. Choose another.');
  return asked;
}

/**
 * Who a visitor asked to have read their reel, by first name: null for Peter, or for nobody
 * asked for. `offered` are the narrators besides Peter that read here; anyone else is a TryError.
 */
export function narratorOf(asked, offered = []) {
  if (asked === undefined || asked === null || asked === '' || asked === 'peter') return null;
  if (typeof asked !== 'string' || !offered.includes(asked)) throw new TryError('That narrator does not read here. Choose another.');
  return asked;
}

/**
 * Everything in `text` that is written between a pair of braces at the top level, in order:
 * each a candidate for a JSON object. A brace inside a quoted string does not count.
 */
export function bracedIn(text) {
  const found = [];
  let depth = 0, from = -1, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"' && depth > 0) quoted = true;
    else if (ch === '{') { if (depth++ === 0) from = i; }
    else if (ch === '}' && depth > 0 && --depth === 0) found.push(text.slice(from, i + 1));
  }
  return found;
}

/**
 * The reel in Claude's reply (or its { cannot }), which may come wrapped in a code fence or
 * a few stray words, or more than once: Claude sometimes writes a reel and then writes it
 * again, better, in the same reply, and the last one is the one it means.
 */
export function replyJson(text) {
  const objects = [];
  for (const braced of bracedIn(text)) {
    try { objects.push(JSON.parse(braced)); } catch { /* not JSON: some words in braces */ }
  }
  const reel = objects.findLast((object) => Array.isArray(object?.scenes) || typeof object?.cannot === 'string') ?? objects.at(-1);
  if (reel === undefined) throw new TryError('Claude did not write a reel that time. Try again.');
  return reel;
}
