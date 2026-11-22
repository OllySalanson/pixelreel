// Make it right here: what the service needs to take a visitor's request for a reel, whether
// or not it has been given a writer to write one (service/writer.mjs, which needs the Claude
// API and so is only loaded when the feature is switched on).

/** The most a visitor may type: a link, or a few words. Not a place to paste a whole document. */
export const ABOUT_MAX = 600;

/** Something the visitor can be told, in plain words: their request cannot be made into a reel. */
export class TryError extends Error {}

/** What the visitor asked for, tidied, or a TryError saying why it will not do. */
export function tidyAbout(about) {
  if (typeof about !== 'string') throw new TryError('Say what you want explained.');
  // control characters would let a request break out of the line it is quoted on
  const words = [...about].filter((ch) => ch >= ' ' && ch !== '\u007f').join('').replace(/\s+/g, ' ').trim();
  if (!words) throw new TryError('Say what you want explained.');
  if (words.length > ABOUT_MAX) throw new TryError(`Keep it to a link, or a few words: ${ABOUT_MAX} letters at most.`);
  return words;
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
