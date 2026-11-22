// The page a shared reel is watched on (/r/<id>): asks the service for the reel, waits with
// Reelie while Peter is still recording it, then hands it to the player.
import { calm } from './calm.js';
import { reelie } from './landscape.js';
import { fitCanvas, ReelPlayer } from './player.js';
import { showOf } from './reels.js';
import { createKit, H, W } from '../../src/kit.js';

const AGAIN_MS = 3000;   // how often to ask whether the voice is recorded yet

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

export function startWatching() {
  const holder = document.getElementById('watch');
  if (!holder) return;
  const id = holder.dataset.watch, root = holder.querySelector('.reel');
  const player = new ReelPlayer(root), says = document.getElementById('watch-says');
  const big = root.querySelector('.reel-big'), words = root.querySelector('.reel-words p');
  big.hidden = true;   // nothing to play yet
  root.querySelector('.reel-title').textContent = document.getElementById('watch-title').textContent;

  // while waiting, Reelie keeps the screen warm
  const canvas = root.querySelector('canvas'), g = canvas.getContext('2d'), px = createKit(g);
  let waiting = true;
  const born = performance.now();
  const wait = (now) => {
    if (!waiting) return;
    const t = calm() ? 3 : (now - born) / 1000;
    fitCanvas(canvas);
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    px.sky('#0b1220', '#24476b');
    px.stars(t);
    px.zoom(3, W / 2, 62, () => reelie(px, W / 2 - 13, 48, t, { still: calm() }));
    px.sign(`RECORDING${'.'.repeat(calm() ? 3 : 1 + (Math.floor(t * 1.5) % 3))}`, W / 2, 132, 16, '#ffcc4d');
    if (!calm()) setTimeout(() => requestAnimationFrame(wait), 120);
  };
  requestAnimationFrame(wait);

  const say = (text) => { says.textContent = text; words.textContent = text; };

  async function look() {
    let play;
    try {
      play = await (await fetch(`/r/${id}/play.json`, { cache: 'no-store' })).json();
    } catch {
      play = { state: 'unreachable' };
    }
    if (play.state === 'ready') {
      waiting = false;
      says.textContent = '';
      // the recordings come from this address, wherever the service says it lives
      const clips = play.clips.map((clip) => ({ ...clip, file: new URL(clip.file).pathname }));
      player.open(showOf(id, play.reel, { clips }));
      if (play.expires) {
        document.getElementById('watch-until').textContent = DAY.format(new Date(play.expires));
        document.getElementById('watch-kept').hidden = false;
      }
      if (play.video) document.getElementById('watch-video').hidden = false;
      return;
    }
    if (play.state === 'failed') { waiting = false; say(`Sorry, this reel could not be made. ${play.error ?? ''}`.trim()); return; }
    if (play.state === 'gone') { waiting = false; say('This reel has gone. Reels are kept for 30 days.'); return; }
    say(play.state === 'unreachable' ? 'Trying to reach Pixel Reel. One moment.' : 'Peter is still recording this one. It will be ready to play here in a moment.');
    setTimeout(look, AGAIN_MS);
  }
  look();
}
