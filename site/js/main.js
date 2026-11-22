// Wakes the website up: the players, the theatre, the scenery and pictures, Make it comfy, the menu,
// the box that writes what to say to Claude (or makes the reel), the list of reels made here,
// the page a shared reel is watched on, and what makes it an app on a phone. Without it the pages still read and link.
import { startApp } from './app.js';
import { startComfort } from './comfort.js';
import { startKept } from './kept.js';
import { startCopying, startHere, startMaker } from './maker.js';
import { startMenu } from './menu.js';
import { startMine } from './mine.js';
import { ReelPlayer } from './player.js';
import { startRuler } from './ruler.js';
import { startScenes } from './scenery.js';
import { startSending } from './send.js';
import { startShared } from './shared.js';
import { startSheet } from './sheet.js';
import { startShots } from './shots.js';
import { startSignal } from './signal.js';
import { startHearing, startTheatre } from './theatre.js';
import { startVoice } from './voice.js';
import { startWatching } from './watch.js';

startComfort();
startMenu();
startApp();
startRuler();
startScenes();
startShots();
startTheatre();
startHearing();
startVoice();   // before the make-one box, so that its first words say who was chosen
startHere();
startMaker();
startShared();   // after the box, so that it hears what it is handed
startMine();
startCopying();
startSending();
startSheet();   // before the players load their reels, so it hears when one is ready
startKept();   // before the page a reel is watched on asks for its reel, so it hears when that is ready
startWatching();
startSignal();
for (const root of document.querySelectorAll('main .reel[data-reel]')) {
  new ReelPlayer(root).load(root.dataset.reel).catch((err) => console.error(err));
}
document.documentElement.dataset.ready = 'true';
