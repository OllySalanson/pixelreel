// The theatre: "Make a pixel reel about this" opens it over the page and plays the reel
// that was made earlier for that part of the page. Any <button data-reel="name"> opens it.
// Also "Hear Peter say hello", which plays one line.
import { addTalker, hush, ReelPlayer } from './player.js';
import { loadReel } from './reels.js';

export function startTheatre() {
  const dialog = document.getElementById('theatre');
  if (!dialog) return;
  const player = new ReelPlayer(dialog.querySelector('.reel'));
  const title = document.getElementById('theatre-title'), kicker = document.getElementById('theatre-kicker');

  async function open(button) {
    const name = button.dataset.reel;
    player.unlock();   // in the press itself, so a phone lets the voice start once the reel has loaded
    hush(player);
    kicker.textContent = button.dataset.kicker ?? "Here's one we made earlier";
    title.textContent = 'One moment';
    dialog.showModal();
    player.playKey.focus();   // so Space pauses, and Tab moves on to Next and Sound
    try {
      await player.load(name);
      if (!dialog.open || player.show?.name !== name) return;
      title.textContent = player.show.reel.title;
      player.start();
    } catch {
      title.textContent = 'Sorry, that one will not play';
    }
  }

  document.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-reel]');
    if (button) open(button);
  });
  // fetch a reel as soon as its button is pointed at or reached, so it plays the moment it is pressed
  for (const kind of ['pointerenter', 'focusin']) {
    document.addEventListener(kind, (e) => {
      const button = e.target instanceof Element && e.target.closest('button[data-reel]');
      if (button) loadReel(button.dataset.reel).catch(() => {});
    }, true);
  }
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => player.stop());
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
        await audio.play();
        button.textContent = 'Stop';
        stage?.classList.add('playing');
      } catch {
        quiet();
      }
    });
  }
}
