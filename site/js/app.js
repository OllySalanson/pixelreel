// Pixel Reel as an app on a phone's home screen. This starts the service worker (/sw.js,
// which is site/js/sw.js) that keeps pages and recordings for when there is no internet,
// and works the buttons that add Pixel Reel to the home screen: anything with data-install.
// Where the browser will do the adding itself (Chrome on Android, and on a computer), the
// button does it in one press. Where it will not (an iPhone), the button is a plain link
// to the page that shows how (/app), which opens at the steps for the phone in hand.
// Nothing here touches the page until it is asked to, so Node can test it.

/** The kind of device a browser says it is on: 'iphone' (or an iPad), 'android' or 'computer'. */
export function deviceOf({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  // an iPad says it is a Mac, but a Mac has no touch screen
  if (/iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'iphone';
  return /Android/.test(userAgent) ? 'android' : 'computer';
}

/** What to call the device in hand, in a sentence: 'phone', 'iPad', 'tablet' or 'computer'. */
export function deviceName({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPad/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'iPad';
  if (/iPhone|iPod/.test(userAgent)) return 'phone';
  if (/Android/.test(userAgent)) return /Mobile/.test(userAgent) ? 'phone' : 'tablet';   // an Android phone says it is mobile; a tablet does not
  return 'computer';
}

/** The site's own pages that `links` (a list of addresses) lead to, each once, as paths: for the service worker to keep. */
export function pagesAmong(links, origin) {
  const paths = new Set();
  for (const link of links) {
    let url;
    try { url = new URL(link, origin); } catch { continue; }
    if (url.origin === origin && !/\.[a-z0-9]+$/i.test(url.pathname)) paths.add(url.pathname);
  }
  return [...paths];
}

export function startApp() {
  const root = document.documentElement;
  // opened from the home screen, on a screen of its own: an iPhone says so in its own way
  const onHomeScreen = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (onHomeScreen()) root.dataset.app = 'on';
  const device = deviceOf(navigator);
  // the page that shows how opens at the steps for this device, with them first
  for (const steps of document.querySelectorAll(`details[data-device="${device}"]`)) {
    steps.open = true;
    steps.parentElement.prepend(steps);   // first, so nobody has to look for theirs
  }

  // what is said only to someone on a phone or a tablet, and what is said only to someone who is not
  for (const part of document.querySelectorAll('[data-on-phone]')) part.hidden = device === 'computer';
  for (const part of document.querySelectorAll('[data-not-phone]')) part.hidden = device !== 'computer';

  // Pages are kept for when there is no internet: this one, and for someone who has Pixel
  // Reel on their home screen, every page it leads to, so that the whole of it is there.
  const keep = async (all) => {
    try {
      const { active } = await navigator.serviceWorker.ready;
      const linked = all ? pagesAmong([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')), location.origin) : [];
      active?.postMessage({ keep: [location.pathname, ...linked] });
    } catch {
      // nothing to keep them: the site works as it always did
    }
  };
  if ('serviceWorker' in navigator) {
    const wake = () => navigator.serviceWorker.register('/sw.js').then(() => keep(onHomeScreen())).catch(() => {});
    // once the page has everything it needs for itself
    if (document.readyState === 'complete') wake(); else addEventListener('load', wake, { once: true });
    // a page shown in place of one there was no internet for: have another go as soon as there is some
    if (document.body.classList.contains('page-offline')) addEventListener('online', () => location.reload());
  }

  let offer = null;   // the browser's own way of adding Pixel Reel to the home screen, when it has said it will
  const say = (words) => { for (const el of document.querySelectorAll('[data-install-says]')) el.textContent = words; };
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();   // it is asked for when the button is pressed, not sprung on anyone
    offer = e;
  });
  addEventListener('appinstalled', () => {
    offer = null;
    say('Done. Look for Reelie on your home screen.');
    keep(true);
  });
  document.addEventListener('click', async (e) => {
    const button = e.target instanceof Element && e.target.closest('[data-install]');
    if (!button || !offer) return;   // with nothing to offer, the link leads to the page that shows how
    e.preventDefault();
    const asked = offer;
    offer = null;   // a browser lets its offer be made once
    try {
      await asked.prompt();
      await asked.userChoice;   // if they say yes, 'appinstalled' says so; if no, there is nothing to say
    } catch {
      location.assign(button.getAttribute('href'));   // the browser would not ask after all: show how instead
    }
  });
}
