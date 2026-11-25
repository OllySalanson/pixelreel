// What is left of the old make-one form, now that the make page is a reel with My notes beside
// it (notes.js): the words to give to Claude for something (askFor), the buttons that copy
// words, the words a page says where the service makes reels itself, and the photo made
// smaller before it is sent.
import { isLink, linkWithTitle, PICTURE_SIDE } from './given.js';
import { copyText } from './send.js';

const EXAMPLE = 'my gas bill';

/**
 * The words to say to Claude for `what`: a web address, or a few words. With `narrator` (a
 * name, such as "Anna") they ask for that narrator to read it, and with `language` (such as
 * 'french') for the reel to be in that language.
 */
export function askFor(what, narrator = null, language = null) {
  const about = (linkWithTitle(what) ?? what).trim().replace(/\s+/g, ' ') || EXAMPLE;   // a link copied with its headline is asked about as the link
  const reel = `a pixel reel${language ? ` in ${language[0].toUpperCase()}${language.slice(1)}` : ''}${narrator ? `, read by ${narrator},` : ''}`;
  return isLink(about) ? `Make me ${reel} about this page: ${about}` : `Make me ${reel} about this: ${about}`;
}

/** Anything with data-copy="#id" copies that element's words when pressed, and says so. */
export function startCopying() {
  for (const el of document.querySelectorAll('[data-copy]')) {
    el.addEventListener('click', async () => {
      const from = document.querySelector(el.dataset.copy);
      if (!from) return;
      const ok = await copyText(from.textContent.trim());
      const says = el.dataset.says ? document.querySelector(el.dataset.says) : el.closest('form, section, article')?.querySelector('.said');
      if (says) says.textContent = ok ? (el.dataset.copied ?? 'Copied.') : 'That did not copy. Press and hold the words to copy them yourself.';
    });
  }
}

/**
 * Where the service makes reels itself, the pages say so: words marked data-here-says say
 * what they say then, and the reel about the make-one box (the button #make-reel, and
 * "Watch this whole page") is the one that explains the box as it is then.
 */
export function startHere() {
  if (!document.querySelector('[data-here="on"]')) return;
  for (const words of document.querySelectorAll('[data-here-says]')) words.textContent = words.dataset.hereSays;
  const about = document.getElementById('make-reel');
  if (!about) return;
  for (const button of document.querySelectorAll('button[data-reels]')) {
    button.dataset.reels = button.dataset.reels.split(/\s+/).map((name) => (name === about.dataset.reel ? about.dataset.reelHere : name)).join(' ');
  }
  about.dataset.reel = about.dataset.reelHere;
}

/** A smaller copy of a picture, as a JPEG no more than PICTURE_SIDE pixels along its longest side. */
export async function shrinkPicture(file) {
  const picture = await createImageBitmap(file);
  const scale = Math.min(1, PICTURE_SIDE / Math.max(picture.width, picture.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(picture.width * scale), height: Math.round(picture.height * scale) });
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';   // a JPEG has no see-through: what was, is white paper
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(picture, 0, 0, canvas.width, canvas.height);
  picture.close();
  return new Promise((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
}
