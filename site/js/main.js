// Wakes the website up: the players, the theatre, the scenery and pictures, Make it comfy, the menu,
// the box that writes what to say to Claude (or makes the reel), the list of reels made here,
// the page a shared reel is watched on, what makes it an app on a phone, and counting visits where the service says to. Without it the pages still read and link.
import { startAloud } from './aloud.js';
import { startApp } from './app.js';
import { startComfort } from './comfort.js';
import { startCounting } from './count.js';
import { startKept } from './kept.js';
import { startCopying, startHere } from './maker.js';
import { startMenu } from './menu.js';
import { startMine } from './mine.js';
import { startMaking } from './notes.js';
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

startCounting();   // first, so that it hears every reel played
startComfort();
startMenu();
startApp();
startRuler();
startAloud();
startScenes();
startShots();
startTheatre();
startHearing();
startVoice();   // before the make-one box, so that its first words say who was chosen
startHere();
startShared(startMaking());   // My notes on the make page, then what a phone shared to it
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
// On paper a closed question has no answer: open them all for the printing, and close again the ones that were.
addEventListener('beforeprint', () => {
  for (const closed of document.querySelectorAll('details:not([open])')) { closed.open = true; closed.dataset.forPaper = ''; }
});
addEventListener('afterprint', () => {
  for (const opened of document.querySelectorAll('details[data-for-paper]')) { opened.open = false; delete opened.dataset.forPaper; }
});
document.documentElement.dataset.ready = 'true';
