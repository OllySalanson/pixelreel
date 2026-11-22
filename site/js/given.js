// Make it right here: working out what someone has given the page to explain (typed,
// pasted, dropped or chosen) and what to send the service for it. Nothing here touches the
// page, so Node can test it, and the service reads its limits from here too (service/try.mjs).

/** The most a visitor may type as a request: a link, or a few words. */
export const ABOUT_MAX = 600;

/** The most writing that may be pasted or dropped in: about 10,000 words, which is a long article. */
export const TEXT_MAX = 60_000;

/** The biggest PDF, in bytes. How much of it Claude will read is counted in the service (service/writer.mjs). */
export const PDF_MAX = 10 * 1024 * 1024;

/** The biggest picture, in bytes. The page makes a phone's photo smaller than this before sending it. */
export const PICTURE_MAX = 5 * 1024 * 1024;

/** A picture bigger than this, in bytes, is made smaller before it is sent, when the browser can. */
export const SHRINK_OVER = 1024 * 1024;

/** The longest side, in pixels, of a picture made smaller: enough to read the small print of a letter. */
export const PICTURE_SIDE = 2000;

const SAYS = {
  nothing: 'Say what you want explained.',
  long: 'That is too much for one reel. Give it less: a few pages at most.',
  other: 'Pixel Reel can read a PDF, a photo, or plain writing. Save that as a PDF, then give it again.',
  video: 'Pixel Reel cannot watch a video. If it has a transcript, copy that and paste it here.',
  bigPdf: 'That PDF is too big. Give it a shorter one, or only the pages that matter.',
  bigPicture: 'That picture is too big. Try a smaller one, or a screenshot.'
};

/** Something the person can be told, in plain words: what they gave cannot be made into a reel. */
export class GivenError extends Error {}

/**
 * True for words that are the address of a YouTube video and nothing else. Claude's page
 * reader cannot load one (tried, on the live site: it cost 5 cents and came to nothing), so
 * such a link is turned away before it costs anything, with what to do instead.
 */
export const isVideoLink = (words) => /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)\S*$/i.test(words.trim());

/** What to say of a link that is a video. */
export const VIDEO_SAYS = SAYS.video;

/** True for words that are a web address and nothing else. */
export const isLink = (words) => /^(https?:\/\/|www\.)\S+$/i.test(words.trim());

/** The most a headline may run to, for a link copied with its headline to be taken as the link alone. */
export const TITLE_MAX = 200;

/**
 * The link in words that are a link with its headline: what many apps copy when someone
 * presses Share, then Copy ("Council Tax: how it works" on one line, the address on the
 * next). The page is what was meant, so the link alone is asked about: sent as it came, it
 * would be taken for a few lines of writing, and the reel would explain the headline.
 * Null for anything else: one line, more than one link, or more than a headline round it.
 */
export function linkWithTitle(words) {
  const lines = words.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const links = lines.filter(isLink), rest = lines.filter((line) => !isLink(line));
  if (lines.length < 2 || links.length !== 1 || rest.length > 3 || rest.join(' ').length > TITLE_MAX) return null;
  return /(https?:\/\/|\bwww\.)\S/i.test(rest.join(' ')) ? null : links[0];   // a second address in among the words makes it writing, not a headline
}

const starts = (bytes, ...codes) => codes.every((code, i) => bytes[i] === code);

/**
 * What kind of file these bytes are, from how they begin and never from a name: 'application/pdf',
 * one of the pictures Claude can look at, or null for anything else.
 */
export function fileKind(bytes) {
  if (starts(bytes, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';   // %PDF-
  if (starts(bytes, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(bytes, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';   // GIF8
  if (starts(bytes, 0x52, 0x49, 0x46, 0x46) && starts(bytes.subarray(8), 0x57, 0x45, 0x42, 0x50)) return 'image/webp';   // RIFF....WEBP
  return null;
}

/** True for a file that is plain writing, going by what the browser says it is, or its name. */
const isWriting = (file) => /^text\//.test(file.type) || /\.(txt|text|md|markdown|csv|html?|json|rtf)$/i.test(file.name ?? '');

/**
 * What was dropped or pasted, from the browser's DataTransfer: { file }, { words } or null.
 * A file wins over words (a dragged picture brings both), unless `words` says otherwise: a
 * spreadsheet or a letter copied from its own program brings a picture of itself along with
 * its words, and the words are what was meant. A link wins over the words round it.
 */
export function givenFrom(transfer, { words: wordsFirst = false } = {}) {
  const file = transfer?.files?.[0];
  const link = (transfer?.getData('text/uri-list') ?? '').split(/\r?\n/).find((line) => line && !line.startsWith('#'));
  const words = (link || transfer?.getData('text/plain') || '').trim();
  if (file && !(wordsFirst && words)) return { file };
  return words ? { words } : null;
}

/**
 * What is on the clipboard, for a button that pastes: { words }, { file } for a copied
 * picture, or null when there is nothing there to use. `clipboard` is the browser's
 * navigator.clipboard, read on a press. A link wins over words, as it does for a drop (a
 * browser may hand over a copied link as a link alone, with no words at all), and words win
 * over a picture, as they do for a paste from the keyboard. Throws when the browser, or the
 * person, will not let the page read it.
 */
export async function givenFromClipboard(clipboard) {
  if (clipboard.read) {
    let items = null;
    try {
      items = await clipboard.read();
    } catch (err) {
      // refused: asking again another way would only ask the person twice. Anything else (some browsers say so of an empty clipboard) is worth one go as plain words.
      if (err?.name === 'NotAllowedError' || !clipboard.readText) throw err;
    }
    if (items) {
      // one kind that cannot be read is passed over, so that it does not cost the kinds that can
      const held = async (item, kind) => (item.types.includes(kind) ? item.getType(kind).catch(() => null) : null);
      const said = async (item, kind) => (await (await held(item, kind))?.text().catch(() => '') ?? '').trim();
      for (const item of items) {
        const link = (await said(item, 'text/uri-list')).split(/\r?\n/).find((line) => line && !line.startsWith('#'));
        if (link) return { words: link.trim() };
      }
      for (const item of items) {
        const words = await said(item, 'text/plain');
        if (words) return { words };
      }
      for (const item of items) {
        const type = item.types.find((kind) => /^image\//.test(kind)), picture = type ? await held(item, type) : null;
        if (picture) return { file: new File([picture], 'A copied picture', { type }) };
      }
      return null;
    }
  }
  const words = (await clipboard.readText()).trim();
  return words ? { words } : null;
}

/** True while something that could be dropped is being dragged over the page: a file, a link or some writing. */
export const canTake = (transfer) => [...(transfer?.types ?? [])].some((type) => type === 'Files' || type === 'text/uri-list' || type === 'text/plain');

/** A few words to show for what was given, so the person can see it arrived: a file's name, or how the words begin. */
export function nameOf(given) {
  if (given.file) return given.file.name || 'your file';
  const line = given.words.replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}...` : line;
}

const json = (value) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

/** What to send for words: a short line is a request (a link, or a few words); anything longer is writing to explain. */
function wordsRequest(words, language, narrator) {
  const whole = words.replace(/\r\n?/g, '\n').trim();
  if (!whole) throw new GivenError(SAYS.nothing);
  const tidy = linkWithTitle(whole) ?? whole;   // a link copied with its headline is asked about as the link
  if (tidy.length > TEXT_MAX) throw new GivenError(SAYS.long);
  if (isVideoLink(tidy)) throw new GivenError(SAYS.video);
  const more = { ...(language ? { language } : {}), ...(narrator ? { narrator } : {}) };
  return tidy.length <= ABOUT_MAX && !tidy.includes('\n') ? json({ about: tidy, ...more }) : json({ text: tidy, ...more });
}

/**
 * Which of the languages on offer suits a browser: the first of the languages it says its
 * reader prefers (`preferred`, such as ['fr-FR', 'en']) that is among `offered` (such as
 * ['english', 'french']), or English.
 */
export function languageFor(preferred = [], offered = []) {
  const codes = { en: 'english', fr: 'french', de: 'german', es: 'spanish', it: 'italian', pt: 'portuguese', nl: 'dutch' };
  for (const tag of preferred) {
    const language = codes[String(tag).toLowerCase().split('-')[0]];
    if (language && offered.includes(language)) return language;
  }
  return 'english';
}

/**
 * What to send the service (the headers and body of a POST to /try) for what was given:
 * { words } or { file }. A PDF or a picture goes as it is, the picture made smaller first by
 * `shrink` (a browser's job: see maker.js) when it is a big one; a file of plain writing
 * goes as its words. `language` is the language the reel is asked for in, if not English,
 * and `narrator` who is asked to read it, by first name, if not Peter.
 * Throws a GivenError, to show the person, for anything else.
 */
export async function requestFor(given, { shrink = null, language = null, narrator = null } = {}) {
  if (!given.file) return wordsRequest(given.words ?? '', language, narrator);
  // a file goes as its own bytes, so the language and the narrator asked for go beside it
  const beside = { ...(language ? { 'x-reel-language': language } : {}), ...(narrator ? { 'x-reel-narrator': narrator } : {}) };
  let file = given.file;
  const kind = fileKind(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (kind === 'application/pdf') {
    if (file.size > PDF_MAX) throw new GivenError(SAYS.bigPdf);
    return { headers: { 'content-type': kind, ...beside }, body: file };
  }
  if (kind || /^image\//.test(file.type)) {
    // a phone's photo is several megabytes: a smaller copy uploads faster and reads just as well
    if (shrink && (!kind || file.size > SHRINK_OVER)) file = (await shrink(file).catch(() => null)) ?? file;
    const now = file === given.file ? kind : 'image/jpeg';
    if (!now) throw new GivenError(SAYS.other);   // a kind of picture this browser cannot open, and Claude cannot either
    if (file.size > PICTURE_MAX) throw new GivenError(SAYS.bigPicture);
    return { headers: { 'content-type': now, ...beside }, body: file };
  }
  if (!isWriting(file)) throw new GivenError(SAYS.other);
  if (file.size > TEXT_MAX * 4) throw new GivenError(SAYS.long);
  return wordsRequest(await file.text(), language, narrator);
}
