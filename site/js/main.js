// Wakes the website up: the players, the theatre, the scenery and pictures, Make it comfy,
// the box that writes what to say to Claude, and the page a shared reel is watched on. Without it the pages still read and link.
import { startComfort } from './comfort.js';
import { startCopying, startMaker } from './maker.js';
import { ReelPlayer } from './player.js';
import { startScenes } from './scenery.js';
import { startSending } from './send.js';
import { startShots } from './shots.js';
import { startSignal } from './signal.js';
import { startHearing, startTheatre } from './theatre.js';
import { startWatching } from './watch.js';

startComfort();
startScenes();
startShots();
startTheatre();
startHearing();
startMaker();
startCopying();
startSending();
startWatching();
startSignal();
for (const root of document.querySelectorAll('main .reel[data-reel]')) {
  new ReelPlayer(root).load(root.dataset.reel).catch((err) => console.error(err));
}
document.documentElement.dataset.ready = 'true';
