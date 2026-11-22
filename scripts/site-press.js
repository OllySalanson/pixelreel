// Presses through the home page of the website in a browser, as a visitor would, and says
// what did not do what it should: the menu, the buttons that try Make it comfy, pressing
// words to hear them, a reel opening over the page, and the big Play button. No test can do
// this (the tests never run the pages), and scripts/site-fit.js only looks at how a page is
// laid out. Paste it into the console of the home page (or hand it to a browser driver), at
// a phone's width and at a laptop's. It answers with what it found, and puts back the
// settings it changed. It makes no sound: the browser's voice is stood in for.
// docs/site/README.md says when to run it.
(async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms)), wrong = [];
  const check = (what, ok) => { if (!ok) wrong.push(what); };
  const root = document.documentElement, kept = localStorage.getItem('pixelreel-comfort'), before = { ...root.dataset };
  // the browser's voice, stood in for: it keeps what it is given to say, and says nothing
  const said = [], voice = window.speechSynthesis, real = voice && { speak: voice.speak, cancel: voice.cancel };
  if (voice) { voice.speak = (u) => { said.push(u.text); }; voice.cancel = () => {}; }

  // the menu: there when the links across the top are not, and a link in it closes it and goes there
  const menu = document.getElementById('menu'), opener = document.querySelector('.top-menu'), links = document.querySelector('.top-nav');
  check('neither the links across the top nor the Menu button is showing', links.offsetWidth > 0 || opener.offsetWidth > 0);
  if (opener.offsetWidth > 0) {
    opener.click();
    check('the Menu button did not open the menu', menu.open);
    menu.querySelector('a[href="/#questions"]').click();
    await wait(900);
    check('a link in the menu did not close it', !menu.open);
    check('a link in the menu did not go to its part of the page', location.hash === '#questions');
  }

  // Make it comfy, tried on the page: each button switches its choice on, and off again
  const tiles = [...document.querySelectorAll('.comfy-try')];
  check('the buttons that try Make it comfy are not showing', tiles.length > 0 && tiles[0].offsetWidth > 0);
  for (const tile of tiles) {
    if (!tile.offsetWidth) continue;   // the one that needs a voice, in a browser with none
    const [key, value] = tile.dataset.comfyTry.split(':'), words = tile.querySelector('.comfy-words').textContent;
    tile.click();
    await wait(60);
    check(`"${words}" did not switch ${key} to ${value}`, root.dataset[key] === value && tile.getAttribute('aria-pressed') === 'true');
    if (key === 'aloud') {
      check('choosing to hear words did not say so aloud', said.splice(0).join(' ') === 'On. Press any words to hear them.');
      const words = document.querySelector('#what .lead');
      words.click();
      await wait(60);
      check('a press on some words did not read them', said.splice(0).length > 0 && words.classList.contains('is-aloud'));
      words.click();
      await wait(60);
      check('a second press did not stop the reading', !words.classList.contains('is-aloud'));
    }
    tile.click();
    await wait(60);
    check(`a second press on "${words}" did not put ${key} back`, root.dataset[key] === undefined && tile.getAttribute('aria-pressed') === 'false');
  }
  check('trying Make it comfy left something changed on this device', localStorage.getItem('pixelreel-comfort') === kept);

  // "Make a pixel reel about this": a reel opens over the page and plays, and closing it stops it
  const theatre = document.getElementById('theatre'), about = document.querySelector('#what button[data-reel]');
  about.click();
  for (let i = 0; i < 40 && !theatre.querySelector('.reel').pixelreel?.player?.playing; i++) await wait(100);
  const over = theatre.querySelector('.reel').pixelreel;
  check('"Make a pixel reel about this" did not open a reel over the page', theatre.open);
  check('the reel over the page did not start to play', over.player?.playing === true);
  theatre.close();
  await wait(300);
  check('closing the reel did not stop it', !over.player?.playing && !over.root.classList.contains('is-full'));
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});

  // the big Play button at the top
  const top = document.querySelector('.hero .reel').pixelreel;
  document.querySelector('.hero .reel-big').click();
  await wait(500);
  check('the big Play button at the top did not play', top.player?.playing === true);
  top.pause();
  if (top.root.classList.contains('is-full')) top.toggleFull();   // a phone held on its side fills the screen
  await wait(200);

  // put everything back
  if (voice) Object.assign(voice, real);
  for (const key of Object.keys(root.dataset)) if (!(key in before)) delete root.dataset[key];
  if (kept === null) localStorage.removeItem('pixelreel-comfort'); else localStorage.setItem('pixelreel-comfort', kept);
  scrollTo({ top: 0, behavior: 'instant' });
  return wrong.length ? wrong.join('\n') : `All well at ${root.clientWidth} pixels wide: the menu, ${tiles.length} ways to try Make it comfy, words read aloud, a reel over the page, and the big Play button.`;
})();
