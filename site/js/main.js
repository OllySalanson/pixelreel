// Wakes the website up: the players, the theatre, the scenery and pictures, Make it comfy,
// the box that writes what to say to Claude, the page a shared reel is watched on, and what
// makes it an app on a phone. Without it the pages still read and link.
import { startApp } from './app.js';
import { startComfort } from './comfort.js';
import { startKept } from './kept.js';
import { startCopying, startMaker } from './maker.js';
import { ReelPlayer } from './player.js';
import { startRuler } from './ruler.js';
import { startScenes } from './scenery.js';
import { startSending } from './send.js';
import { startShared } from './shared.js';
import { startShots } from './shots.js';
import { startSignal } from './signal.js';
import { startHearing, startTheatre } from './theatre.js';
import { startWatching } from './watch.js';

startComfort();
startApp();
startRuler();
startScenes();
startShots();
startTheatre();
startHearing();
startMaker();
startShared();   // after the box, so that it hears what it is handed
startCopying();
startSending();
startKept();   // before the page a reel is watched on asks for its reel, so it hears when that is ready
startWatching();
startSignal();
for (const root of document.querySelectorAll('main .reel[data-reel]')) {
  new ReelPlayer(root).load(root.dataset.reel).catch((err) => console.error(err));
}
document.documentElement.dataset.ready = 'true';
