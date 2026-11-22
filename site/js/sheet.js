// The whole reel on one page: every scene as its finished picture with its few words, under
// the player on the page a reel is watched on. It is there to glance back over, and to
// print: how to read the gas meter, stuck on the fridge. It fills itself in once the reel
// is ready to play, from the reel the page's own player has loaded.
// The top half touches no page, so Node can test it.
import { createKit, H, W } from '../../src/kit.js';

/** What the page says for each scene of a reel that is ready to play (see showOf in reels.js): its number, its title, its few words, and the moment its picture is finished, in seconds. */
export const sheetOf = (show) => show.reel.scenes.map((scene, i) => ({ n: i + 1, title: scene.title, words: scene.caption, at: show.durations[i] / 1000 }));

export function startSheet() {
  const part = document.getElementById('sheet'), holder = document.querySelector('main .reel');
  if (!part || !holder) return;
  const list = document.getElementById('sheet-list'), title = document.getElementById('sheet-title');
  let shown = null;
  const fill = () => {
    const show = holder.pixelreel?.show;
    if (!show || show === shown) return;
    shown = show;
    title.textContent = show.reel.title;
    list.replaceChildren(...sheetOf(show).map(({ n, title: name, words, at }) => {
      const item = Object.assign(document.createElement('li'), { className: 'step' });
      const picture = Object.assign(document.createElement('canvas'), { className: 'shot', width: W * 3, height: H * 3 });
      picture.setAttribute('aria-hidden', 'true');
      const number = Object.assign(document.createElement('p'), { className: 'step-n', textContent: String(n) });
      number.setAttribute('aria-hidden', 'true');
      item.append(picture, number, Object.assign(document.createElement('h3'), { textContent: name }), Object.assign(document.createElement('p'), { textContent: words }));
      // the scene as it stands when Peter has finished saying it
      const g = picture.getContext('2d'), scene = show.reel.scenes[n - 1];
      g.setTransform(3, 0, 0, 3, 0, 0);
      g.imageSmoothingEnabled = false;
      try { scene.draw(at, createKit(g), scene); } catch (err) { console.error(`scene ${n} could not draw:`, err); }
      return item;
    }));
    part.hidden = false;
  };
  document.addEventListener('reelopen', (e) => { if (e.target === holder) fill(); });
  fill();   // the reel may have been ready before this was
  document.getElementById('sheet-print')?.addEventListener('click', () => print());
  // the pixel font may arrive after the pictures are drawn: draw them again with it
  document.fonts?.ready.then(() => { shown = null; fill(); });
}
