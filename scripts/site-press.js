// Presses through a page of the website in a browser, as a visitor would, and says what
// did not do what it should: the menu, the buttons that try Make it comfy, pressing words
// to hear them, "Read this page to me", a reel opening over the page, the big Play button,
// and Sound on and off. It works whatever of those the page has, so it can be run on any
// page; the home page has the most. No test can do this (the tests never run the pages), and
// scripts/site-fit.js only looks at how a page is laid out. Paste it into the console of a
// page (or hand it to a browser driver), at a phone's width and at a laptop's. It answers
// with what it found, and puts back the settings it changed. It makes no sound: the
// browser's voice is stood in for.
// docs/site/README.md says when to run it.
(async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms)), wrong = [], did = [];
  const check = (what, ok) => { if (!ok) wrong.push(what); };
  const root = document.documentElement, kept = localStorage.getItem('pixelreel-comfort'), before = { ...root.dataset };
  // the browser's voice, stood in for: it keeps what it is given to say, and says nothing
  const said = [], voice = window.speechSynthesis, real = voice && { speak: voice.speak, cancel: voice.cancel };
  if (voice) { voice.speak = (u) => { said.push(u.text); }; voice.cancel = () => {}; }

  // the menu: there when the links across the top are not, and a link in it closes it and goes there
  const menu = document.getElementById('menu'), opener = document.querySelector('.top-menu'), links = document.querySelector('.top-nav');
  check('neither the links across the top nor the Menu button is showing', links.offsetWidth > 0 || opener.offsetWidth > 0);
  if (opener.offsetWidth > 0) {
    did.push('the menu');
    opener.click();
    check('the Menu button did not open the menu', menu.open);
    if (location.pathname === '/') {
      menu.querySelector('a[href="/#questions"]').click();
      await wait(900);
      check('a link in the menu did not close it', !menu.open);
      check('a link in the menu did not go to its part of the page', location.hash === '#questions');
    } else {
      menu.querySelector('[data-close]').click();   // on another page its links lead away: only that it opens and closes
      check('Close did not close the menu', !menu.open);
    }
  }

  // Make it comfy, tried on the page: each button switches its choice on, and off again
  const tiles = [...document.querySelectorAll('.comfy-try')];
  if (tiles.length) did.push(`${tiles.length} ways to try Make it comfy`);
  check('the buttons that try Make it comfy are not showing', !tiles.length || tiles[0].offsetWidth > 0);
  for (const tile of tiles) {
    if (!tile.offsetWidth) continue;   // the one that needs a voice, in a browser with none
    const [key, value] = tile.dataset.comfyTry.split(':'), words = tile.querySelector('.comfy-words').textContent;
    tile.click();
    await wait(60);
    check(`"${words}" did not switch ${key} to ${value}`, root.dataset[key] === value && tile.getAttribute('aria-pressed') === 'true');
    if (key === 'aloud') {
      did.push('words read aloud');
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

  // "Read this page to me": it reads the page, says "Stop reading" while it does, and a second press stops it
  const reader = [...document.querySelectorAll('button[data-read-page]')].find((button) => button.offsetWidth > 0);
  if (reader && voice) {
    did.push('the page read out');
    reader.click();
    await wait(80);
    check('"Read this page to me" read nothing', said.splice(0).length > 0 && document.querySelector('.is-aloud') !== null);
    check('the button did not say "Stop reading" while it read', reader.textContent === 'Stop reading');
    reader.click();
    await wait(80);
    check('a second press did not stop the reading', document.querySelector('.is-aloud') === null && reader.textContent === 'Read this page to me');
    scrollTo({ top: 0, behavior: 'instant' });
  }

  // "Make a pixel reel about this": a reel opens over the page and plays, and closing it stops it
  const theatre = document.getElementById('theatre'), about = [...document.querySelectorAll('main button[data-reel]')].find((button) => button.offsetWidth > 0 && !button.closest('.posters'));
  if (about) {
    did.push('a reel over the page');
    about.click();
    for (let i = 0; i < 40 && !theatre.querySelector('.reel').pixelreel?.player?.playing; i++) await wait(100);
    const over = theatre.querySelector('.reel').pixelreel;
    check('"Make a pixel reel about this" did not open a reel over the page', theatre.open);
    check('the reel over the page did not start to play', over.player?.playing === true);
    theatre.close();
    await wait(300);
    check('closing the reel did not stop it', !over.player?.playing && !over.root.classList.contains('is-full'));
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

  // the big Play button of the first player in the page
  const first = [...document.querySelectorAll('main .reel')].find((reel) => reel.pixelreel?.player && reel.querySelector('.reel-big')?.offsetWidth > 0);
  if (first) {
    did.push('the big Play button');
    first.querySelector('.reel-big').click();
    await wait(500);
    check('the big Play button did not play', first.pixelreel.player.playing === true);
    first.pixelreel.pause();
    if (first.classList.contains('is-full')) first.pixelreel.toggleFull();   // a phone held on its side fills the screen
    await wait(200);
    // Sound on and Sound off change the sound and nothing else: not the words under the
    // picture, not their size, and nothing on the page moves
    const sound = first.querySelector('.reel-sound');
    if (sound?.offsetWidth) {
      did.push('Sound on and off');
      const look = () => JSON.stringify([getComputedStyle(first.querySelector('.reel-words')).fontSize, first.querySelector('.reel-words p.on')?.textContent,
        ...[...document.querySelectorAll('main a, main button')].filter((el) => el.offsetWidth).map((el) => { const box = el.getBoundingClientRect(); return [Math.round(box.left), Math.round(box.top + scrollY)]; })]);
      const was = look();
      for (const press of ['once', 'twice']) {
        sound.click();
        await wait(200);
        check(`pressing Sound ${press} changed more than the sound`, look() === was);
      }
    }
  }

  // put everything back
  if (voice) Object.assign(voice, real);
  for (const key of Object.keys(root.dataset)) if (!(key in before)) delete root.dataset[key];
  if (kept === null) localStorage.removeItem('pixelreel-comfort'); else localStorage.setItem('pixelreel-comfort', kept);
  scrollTo({ top: 0, behavior: 'instant' });
  return wrong.length ? wrong.join('\n') : `All well at ${root.clientWidth} pixels wide: ${did.join(', ') || 'nothing on this page to press'}.`;
})();
