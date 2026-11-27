// Counting visits with Google Analytics, only where the service is told to (PIXELREEL_ANALYTICS,
// docs/service.md "Counting visits"): the layout's <html data-count="G-..."> says so. Google's
// script is fetched once the page has finished loading and the browser is idle, so it never
// holds up a reel. What Google is told is cut down first: never a made reel's address (its id
// is what lets someone watch it), never its title or anything a visitor wrote, and never the
// words after "?" or "#". A made reel is counted by its topic (one word the writer chose from
// a fixed list), how many scenes it has and which drawings the library was missing.
// Nothing is counted for anyone whose browser asks not to be tracked, or who switched counting
// off in Make it comfy; and nothing in a browser cookie is used for adverts (consent mode).
// The top half touches no page, so Node can test it.

/** Where a visitor's "do not count me" is kept, on their own device. */
export const COUNT_OFF = 'pixelreel-count';

/** Google's script, for one measurement ID. */
export const gtagSource = (id) => `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;

/** A measurement ID as Google gives one. */
export const isMeasurement = (id) => typeof id === 'string' && /^G-[A-Z0-9]{4,16}$/.test(id);

/** A made reel's id (service/reels.mjs): never sent anywhere. */
const isReelId = (name) => typeof name === 'string' && /^[A-Za-z0-9_-]{22}$/.test(name);

/**
 * Where Google may be told cookies are not to be used for counting without asking first
 * (the EU, the rest of the EEA and Switzerland): there only cookieless pings are sent. The
 * site asks nobody, so visitors there are counted without cookies, as Google's consent mode does.
 */
export const ASK_FIRST = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH'];

/** The campaign words a link may carry (utm_source and the rest): the only part after "?" that is kept. */
const CAMPAIGN = /^utm_(?:source|medium|campaign|term|content|id)$/;

/** A page's address as Google is told it: a made reel's id, and anything after "?" (but a campaign's words) or "#", taken out. */
export function placeOf(href) {
  let url;
  try { url = new URL(href); } catch { return ''; }
  const path = url.pathname.replace(/^\/r\/[^/]+/, '/r/reel');
  const kept = new URLSearchParams([...url.searchParams].filter(([key]) => CAMPAIGN.test(key)));
  return `${url.origin}${path}${kept.size ? `?${kept}` : ''}`;
}

/** A page's title as Google is told it: a made reel's is its maker's words, so it is never sent. */
export const titleOf = (path, title) => (/^\/r\//.test(path) ? 'A pixel reel - Pixel Reel' : String(title ?? '').slice(0, 100));

/** Where a visitor came from, as Google is told it: this site's pages as placeOf says them, another site by its address alone. */
export function referrerOf(referrer, origin) {
  let url;
  try { url = new URL(referrer); } catch { return ''; }
  return url.origin === origin ? placeOf(url.href) : `${url.origin}/`;
}

/** Whether a visitor may be counted: not if they said no here, nor if their browser asks every site not to track them. */
export const mayCount = ({ off = false, gpc = false, dnt = null } = {}) => !off && !gpc && dnt !== '1' && dnt !== 'yes';

/** What a reel is called to Google: one of the site's own by its name, a made one only as "made". */
export const reelName = (name) => (isReelId(name) ? 'made' : /^[a-z0-9-]{1,40}$/.test(name ?? '') ? name : 'other');

/**
 * What Google is told of a reel being played or made: { reel, topic, scenes, missing }, from
 * the player's event (`name`, `scenes`) and what the service said of a made reel (`topic`,
 * `missing`). Each is short, and none is anything the visitor wrote.
 */
export function aboutReel({ name, scenes, topic = null, missing = null } = {}) {
  const about = { reel: reelName(name) };
  if (Number.isFinite(scenes)) about.scenes = scenes;
  if (typeof topic === 'string' && /^[a-z ]{1,30}$/.test(topic)) about.topic = topic;
  if (Array.isArray(missing)) about.missing = missing.filter((m) => typeof m === 'string').join(', ').slice(0, 100) || 'none';
  return about;
}

/** Which part of a page something pressed is in, for Google: the bar across the top, the menu, the foot, a reel laid over the page, or the page itself. */
export function whereOf(el) {
  if (el.closest('.theatre')) return 'theatre';
  if (el.closest('.menu')) return 'menu';
  if (el.closest('header.top')) return 'bar';
  if (el.closest('footer')) return 'foot';
  if (el.closest('.reel-end')) return 'reel end';
  return 'page';
}

/** What a press on a link is counted as, if anything: [event, params]. `href` is the link's own (as written), `add` the address that adds Pixel Reel to Claude. */
export function pressOf(href, add) {
  if (!href) return null;
  if (href === '/claude' || href.startsWith('/claude#')) return ['add_to_claude', { step: 'page' }];
  if (href === '/add' || (add && href === add)) return ['add_to_claude', { step: 'add' }];
  if (href === '/make' || href.startsWith('/make#')) return ['make_button', {}];
  return null;
}

// What follows works the page.

let counting = null;   // { id } while this page is being counted

const root = () => document.documentElement;

function gtag() {
  // Google's script reads these as they were given: an `arguments`, not an array
  (window.dataLayer = window.dataLayer || []).push(arguments); 
}

/** Whether this visitor has said not to be counted, on this device. */
export function countedOff() {
  try { return localStorage.getItem(COUNT_OFF) === 'off'; } catch { return false; }
}

/**
 * Counts `name` with `params`, if this page is counted. Resolves once Google has it, or after
 * a second whatever happens: wait for it before leaving the page, or the count is lost.
 */
export function count(name, params = {}) {
  if (!counting) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);
    gtag('event', name, { ...params, event_callback: () => { clearTimeout(timer); resolve(); } });
  });
}

/** Makes `id` (a made reel's) counted as made only once on this device, however often its page is opened. True the first time. */
export function firstTime(id) {
  try {
    const seen = JSON.parse(localStorage.getItem('pixelreel-counted') ?? '[]');
    if (!Array.isArray(seen) || seen.includes(id)) return false;
    localStorage.setItem('pixelreel-counted', JSON.stringify([...seen, id].slice(-30)));
    return true;
  } catch {
    return true;   // a browser that keeps nothing counts it each time its page is opened
  }
}

/** The switch in Make it comfy: shown only where visits are counted, and it is the visitor's to keep. */
function startSwitch(id) {
  const part = document.querySelector('[data-needs-count]');
  if (!part) return;
  part.hidden = false;
  const tick = () => { const on = part.querySelector(`input[name="count"][value="${countedOff() ? 'off' : 'on'}"]`); if (on) on.checked = true; };
  tick();
  part.addEventListener('change', (e) => {
    if (e.target.name !== 'count') return;
    const off = e.target.value === 'off';
    try { if (off) localStorage.setItem(COUNT_OFF, 'off'); else localStorage.removeItem(COUNT_OFF); } catch { /* it lasts until the page is closed */ }
    window[`ga-disable-${id}`] = off;
    if (off) counting = null;
    else if (!counting) begin(id);
  });
}

/** Starts counting this page: what Google may do first, then the page itself, then Google's script once the page has loaded. */
function begin(id) {
  counting = { id };
  window[`ga-disable-${id}`] = false;
  const no = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  gtag('consent', 'default', { ...no, analytics_storage: 'denied', region: ASK_FIRST });
  gtag('consent', 'default', { ...no, analytics_storage: 'granted' });
  gtag('set', 'ads_data_redaction', true);
  // for every event on the page, not only the first: a made reel's page changes its own title once the reel has one
  gtag('set', { page_location: placeOf(location.href), page_title: titleOf(location.pathname, document.title), page_referrer: referrerOf(document.referrer, location.origin) });
  gtag('js', new Date());
  gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  if (document.querySelector(`script[src="${gtagSource(id)}"]`)) return;
  const fetchIt = () => document.head.append(Object.assign(document.createElement('script'), { src: gtagSource(id), async: true }));
  const later = () => (window.requestIdleCallback ? requestIdleCallback(fetchIt, { timeout: 4000 }) : setTimeout(fetchIt, 200));
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
}

/** Wakes counting on a page that asks for it, and the events counted on every page: reels played to the end, and presses on the ways to make one or add Pixel Reel to Claude. */
export function startCounting() {
  const id = root().dataset.count;
  if (!isMeasurement(id)) return;
  // a browser that asks every site not to track it is not counted, and has nothing to switch
  if (!mayCount({ gpc: navigator.globalPrivacyControl === true, dnt: navigator.doNotTrack ?? window.doNotTrack })) return;
  startSwitch(id);
  if (!countedOff()) begin(id);
  const page = document.body.className.replace(/^page-/, '').split(' ')[0];
  document.addEventListener('reelplay', (e) => count('reel_played', { ...aboutReel(e.detail), page }));
  document.addEventListener('reelend', (e) => count('reel_completed', { ...aboutReel(e.detail), page }));
  const add = document.querySelector('a[href^="https://claude.ai/"]')?.getAttribute('href') ?? null;
  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
    const press = link && pressOf(link.getAttribute('href'), add);
    if (press) count(press[0], { ...press[1], where: whereOf(link), page });
  }, true);
}
