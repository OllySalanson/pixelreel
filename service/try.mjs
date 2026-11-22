// Make it right here: what the service needs to take a visitor's request for a reel, whether
// or not it has been given a writer to write one (service/writer.mjs, which needs the Claude
// API and so is only loaded when the feature is switched on). A visitor gives one thing to
// explain: a link or a few words, some writing, a PDF or a picture.
import { ABOUT_MAX, fileKind, PDF_MAX, PICTURE_MAX, TEXT_MAX } from '../site/js/given.js';

export { ABOUT_MAX, PDF_MAX, PICTURE_MAX, TEXT_MAX };

/** The most a request to /try may carry as JSON: the longest writing, in the widest letters, quoted. */
export const MAX_WORDS_BODY = TEXT_MAX * 4 + 1024;

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
 * What a request to /try asks to have explained, from its body, or a TryError saying why it
 * will not do. JSON brings { about } (a link or a few words: { kind: 'words', about }) or
 * { text } (writing: { kind: 'text', text }); anything else is a file's own bytes, which
 * must begin as a PDF ({ kind: 'pdf', data }) or a picture ({ kind: 'picture', type, data })
 * does, whatever it is called. `data` is base64, as the Claude API takes it.
 */
export function sourceOf(type, bytes) {
  if (/^application\/json\b/i.test(type ?? '')) {
    let body;
    try { body = JSON.parse(bytes.toString('utf8')); } catch { body = null; }
    if (typeof body?.text === 'string') return { kind: 'text', text: tidyText(body.text) };
    return { kind: 'words', about: tidyAbout(body?.about) };
  }
  const kind = fileKind(bytes);
  if (!kind) throw new TryError('Pixel Reel can read a PDF, a photo, or plain writing. Save that as a PDF, then give it again.');
  if (kind === 'application/pdf') return { kind: 'pdf', data: bytes.toString('base64') };
  if (bytes.length > PICTURE_MAX) throw new TryError('That picture is too big. Try a smaller one, or a screenshot.');
  return { kind: 'picture', type: kind, data: bytes.toString('base64') };
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

/** The JSON object in Claude's reply, which may come wrapped in a code fence or a few stray words. */
export function replyJson(text) {
  const from = text.indexOf('{'), to = text.lastIndexOf('}');
  if (from < 0 || to < from) throw new TryError('Claude did not write a reel that time. Try again.');
  try {
    return JSON.parse(text.slice(from, to + 1));
  } catch {
    throw new TryError('Claude did not write a reel that time. Try again.');
  }
}
