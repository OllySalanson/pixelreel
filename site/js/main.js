// Wakes the website up: the players, the theatre, the scenery and pictures, Make it comfy,
// and the box that writes what to say to Claude. Without it the pages still read and link.
import { startComfort } from './comfort.js';
import { startCopying, startMaker } from './maker.js';
import { ReelPlayer } from './player.js';
import { startScenes } from './scenery.js';
import { startShots } from './shots.js';
import { startHearing, startTheatre } from './theatre.js';

startComfort();
startScenes();
startShots();
startTheatre();
startHearing();
startMaker();
startCopying();
for (const root of document.querySelectorAll('main .reel[data-reel]')) {
  new ReelPlayer(root).load(root.dataset.reel).catch((err) => console.error(err));
}
document.documentElement.dataset.ready = 'true';
