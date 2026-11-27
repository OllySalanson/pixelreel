// The theatre: "Make a pixel reel about this" opens it over the page and plays the reel
// that was made earlier for that part of the page. Any <button data-reel="name"> opens it.
// Also "Hear Peter say hello", which plays one line.
import { rateOf } from './pace.js';
import { addTalker, hush, ReelPlayer } from './player.js';
import { loadReel } from './reels.js';
import { countSent, phoneShare, sendReel, sentWords } from './send.js';

const COPIED_MS = 4000;   // how long the send button says "Link copied"

export function startTheatre() {
  const dialog = document.getElementById('theatre');
  if (!dialog) return;
  const title = document.getElementById('theatre-title'), kicker = document.getElementById('theatre-kicker');
  // the reels with a page of their own (/watch/<name>) can be sent to someone from here
  const send = document.getElementById('theatre-send'), sent = document.getElementById('theatre-sent'), own = document.getElementById('theatre-own');
  const pages = (dialog.dataset.pages ?? '').split(' '), sendLabel = send.textContent;
  let run = null;   // what is showing: { queue: [reel names], at }
  const more = () => dialog.open && run && run.at < run.queue.length - 1;
  const player = new ReelPlayer(dialog.querySelector('.reel'), {
    onEnd() { if (more()) play(run, run.at + 1); },
    // in a run of reels, Next on a reel's last scene goes on to the next reel
    onPast() {
      if (!more()) return false;
      play(run, run.at + 1);
      return true;
    }
  });

  /** Plays reel `at` of a run: one reel, or one after another for "Watch this whole page". */
  async function play(mine, at) {
    mine.at = at;
    const name = mine.queue[at];
    title.textContent = 'One moment';
    send.hidden = !pages.includes(name);
    own.hidden = !send.hidden;   // there is room for one or the other beside the button to add it
    try {
      await player.load(name);
      if (!dialog.open || run !== mine || mine.at !== at) return;   // closed, or moved on, while it loaded
      title.textContent = mine.queue.length > 1 ? `${at + 1} of ${mine.queue.length}: ${player.show.reel.title}` : player.show.reel.title;
      player.start();
    } catch {
      title.textContent = 'Sorry, that one will not play';
    }
  }

  function open(button) {
    player.unlock();   // in the press itself, so a phone lets the voice start once the reel has loaded
    hush(player);
    kicker.textContent = button.dataset.kicker ?? "Here's one we made earlier";
    run = { queue: (button.dataset.reels ?? button.dataset.reel).split(/\s+/).filter(Boolean), at: 0 };
    dialog.showModal();
    player.playKey.focus();   // so Space pauses, and Tab moves on to Next and Sound
    player.fillOnItsSide();   // in the press itself: on a phone held on its side the reel fills the screen
    play(run, 0);
  }

  const opener = (target) => target instanceof Element && target.closest('button[data-reel], button[data-reels]');
  document.addEventListener('click', (e) => {
    const button = opener(e.target);
    if (button) open(button);
  });
  // fetch a reel as soon as its button is pointed at or reached, so it plays the moment it is pressed
  for (const kind of ['pointerenter', 'focusin']) {
    document.addEventListener(kind, (e) => {
      const button = opener(e.target);
      if (button) loadReel((button.dataset.reels ?? button.dataset.reel).split(/\s+/)[0]).catch(() => {});
    }, true);
  }
  send.addEventListener('click', async () => {
    const path = `/watch/${run.queue[run.at]}`, url = location.origin + path;
    const how = await sendReel(player.show?.reel.title ?? 'A pixel reel', url, { share: phoneShare() });
    countSent(how, path);
    sent.textContent = sentWords(how, url);
    if (how === 'failed') { location.assign(path); return; }   // its own page, where the address can be copied by hand
    if (how !== 'copied') return;
    send.textContent = 'Link copied';
    setTimeout(() => { send.textContent = sendLabel; }, COPIED_MS);
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    run = null;
    player.stop();
    if (player.root.classList.contains('is-full')) player.toggleFull();   // closed while it filled the screen: the page comes back
  });
}

/** <button data-hear="reel-name">: plays that reel's first line, and stops it if pressed again. */
export function startHearing() {
  for (const button of document.querySelectorAll('button[data-hear]')) {
    const audio = new Audio(), label = button.textContent, stage = button.closest('section')?.querySelector('.wireless');
    const quiet = () => { button.textContent = label; stage?.classList.remove('playing'); };
    const talker = { pause() { audio.pause(); audio.currentTime = 0; quiet(); } };
    addTalker(talker);
    audio.addEventListener('ended', quiet);
    button.addEventListener('click', async () => {
      if (!audio.paused) { talker.pause(); return; }
      hush(talker);
      try {
        const { reel, clipFor } = await loadReel(button.dataset.hear);
        audio.src = clipFor(reel.scenes[0]).url;
        audio.playbackRate = rateOf(document.documentElement.dataset.pace);   // at the pace chosen in Make it comfy
        await audio.play();
        button.textContent = 'Stop';
        stage?.classList.add('playing');
      } catch {
        quiet();
      }
    });
  }
}
