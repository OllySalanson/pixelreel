// The page a shared reel is watched on (/r/<id>): asks the service for the reel, waits with
// Reelie while Claude is still writing it or Peter is still recording it, saying which and
// how far along, then hands it to the player.
import { calm, onComfortChange } from './calm.js';
import { reelie } from './landscape.js';
import { forgetMine, mineStorage, rememberMine, updateMine } from './mine.js';
import { fitCanvas, ReelPlayer } from './player.js';
import { showOf, waitingFor } from './reels.js';
import { createKit, H, W } from '../../src/kit.js';

const AGAIN_MS = 2000;   // how often to ask how far the reel has got

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

export function startWatching() {
  const holder = document.getElementById('watch');
  if (!holder) return;
  const id = holder.dataset.watch, root = holder.querySelector('.reel');
  const player = new ReelPlayer(root), says = document.getElementById('watch-says');
  const big = root.querySelector('.reel-big'), words = root.querySelector('.reel-words p');
  const heading = document.getElementById('watch-title'), name = root.querySelector('.reel-title');
  const mine = mineStorage();
  const keys = root.querySelectorAll('.reel-keys button');
  // nothing to play yet: the buttons say so by being switched off, and the words keep room for two lines
  const playable = (on) => {
    big.hidden = true;
    root.classList.toggle('is-waiting', !on);
    for (const key of keys) key.disabled = !on;
  };
  playable(false);
  name.textContent = heading.textContent;

  // send.js works the buttons that pass the reel on: its link is good as soon as it is written, even while Peter is still recording
  const sends = holder.querySelectorAll('button[data-send]');

  // A reel made here is called something else until Claude has written it: then its own name goes everywhere the first one was
  const called = (title) => {
    if (!title || title === heading.textContent) return;
    heading.textContent = name.textContent = title;
    document.title = `${title} - Pixel Reel`;
    for (const send of sends) send.dataset.send = title;
  };

  // While waiting, Reelie keeps the screen warm, under a sign that says what is being done
  // and a bar that fills as it is. `now` is what the service last said of the reel.
  const canvas = root.querySelector('canvas'), g = canvas.getContext('2d'), px = createKit(g);
  let waiting = true, now = { state: 'unreachable' }, part = 0, sorry = null, again = null;
  const born = performance.now();
  const draw = (at) => {
    clearTimeout(again);   // however often it is asked to draw, one picture follows another, not several at once
    if (!waiting && !sorry) return;   // the reel is playing: the screen is the player's now
    const still = calm() || !waiting, t = still ? 3 : (at - born) / 1000;
    fitCanvas(canvas);
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    g.imageSmoothingEnabled = false;
    px.sky('#0b1220', '#24476b');
    px.stars(t);
    px.zoom(3, W / 2, 54, () => reelie(px, W / 2 - 13, 40, t, { still }));
    if (sorry) {
      px.sign(sorry, W / 2, 126, 16, '#ebeac5');
      return;
    }
    const wait = waitingFor(now, (at - born) / 1000);
    if (wait.part !== null) part = Math.max(part, wait.part);   // it never goes backwards
    px.sign(`${wait.sign}${'.'.repeat(still ? 3 : 1 + (Math.floor(t * 1.5) % 3))}`, W / 2, 120, 16, '#ffcc4d');
    px.window(W / 2 - 82, 148, 164, 12, '#0b1220');
    px.rect('#ffcc4d', W / 2 - 80, 150, Math.round(160 * part), 8);
    if (!still) again = setTimeout(() => requestAnimationFrame(draw), 120);
  };
  requestAnimationFrame(draw);
  onComfortChange(() => { if (waiting || sorry) requestAnimationFrame(draw); });

  // said aloud to a screen reader only when it changes, not every time the service is asked
  const say = (text) => {
    if (says.textContent !== text) says.textContent = text;
    words.textContent = text;
  };

  // The same reel written again, simpler or shorter, where the service can write one itself:
  // it is a new reel with a page of its own, and this one stays as it is.
  const remakes = holder.querySelectorAll('button[data-remake]'), remakeSays = document.getElementById('watch-again-says');
  for (const button of remakes) {
    button.addEventListener('click', async () => {
      for (const each of remakes) each.disabled = true;
      remakeSays.textContent = 'One moment.';
      try {
        const res = await fetch('/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ again: id, how: button.dataset.remake }) });
        const answer = await res.json().catch(() => ({}));
        if (!res.ok || !answer.watch) throw new Error(answer.error || 'That did not work. Try again in a minute.');
        rememberMine(mine, answer);
        location.assign(answer.watch);
      } catch (err) {
        remakeSays.textContent = err instanceof TypeError ? (navigator.onLine === false ? 'You are not online. Check your internet, then try again.' : 'That did not work. Try again in a minute.') : err.message;
        for (const each of remakes) each.disabled = false;
      }
    });
  }
  // coming back to this page with Back finds its buttons ready again
  addEventListener('pageshow', (e) => { if (e.persisted) { for (const each of remakes) each.disabled = false; remakeSays.textContent = ''; } });

  async function look() {
    let play;
    try {
      play = await (await fetch(`/r/${id}/play.json`, { cache: 'no-store' })).json();
    } catch {
      play = { state: 'unreachable' };
    }
    called(play.title);
    // if whoever is watching made this reel, their list of reels learns its name and how long it is kept; one that came to nothing comes off it
    if (play.state === 'failed' || play.state === 'gone') forgetMine(mine, id);
    else if (play.state !== 'unreachable' && play.state !== 'writing') updateMine(mine, id, { title: play.title, expires: play.expires });
    if (play.state === 'ready') {
      waiting = false;
      says.textContent = '';
      // the recordings come from this address, wherever the service says it lives
      const clips = play.clips.map((clip) => ({ ...clip, file: new URL(clip.file).pathname }));
      playable(true);
      player.open(showOf(id, play.reel, { clips }));
      for (const send of sends) send.hidden = false;
      if (play.expires) {
        document.getElementById('watch-until').textContent = DAY.format(new Date(play.expires));
        document.getElementById('watch-kept').hidden = false;
      }
      if (play.video) document.getElementById('watch-video').hidden = false;
      if (holder.dataset.here === 'on') document.getElementById('watch-again').hidden = false;
      return;
    }
    if (play.state === 'failed' || play.state === 'gone') {
      waiting = false;
      sorry = play.state === 'gone' ? 'THIS REEL HAS GONE' : 'NO REEL THIS TIME';
      root.classList.add('is-sorry');   // there is nothing to play, so the buttons that play it go
      requestAnimationFrame(draw);
      for (const send of sends) send.hidden = true;   // nothing to pass on
      say(play.state === 'gone' ? 'This reel has gone. Reels are kept for 30 days.' : `Sorry, this reel could not be made. ${play.error ?? ''}`.trim());
      if (play.state === 'failed') document.getElementById('watch-retry').hidden = false;
      return;
    }
    now = play;
    if (calm()) requestAnimationFrame(draw);   // held still, the picture is drawn again only when there is news
    for (const send of sends) send.hidden = play.state === 'writing';   // there is nothing to send until it is written
    say(waitingFor(play).words);
    setTimeout(look, play.state === 'unreachable' ? AGAIN_MS * 2 : AGAIN_MS);
  }
  look();
}
