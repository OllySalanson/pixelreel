// The website: what Pixel Reel is, how to add it to Claude, the press kit, privacy, terms
// and credits. Everything it shows lives in site/: one layout (site/layout.html) that every
// page shares, and a page each in site/pages/, written as HTML or, for the plain ones, as
// Markdown. This puts a page together; service/static.mjs serves the files a page loads.
import { existsSync, readFileSync } from 'node:fs';
import { SPRITES } from '../site/js/sprites.js';
import { ICONS } from '../src/icons.js';
import { PALETTE } from '../src/palette.js';

/** Each address the site answers, and the page in site/pages/ it shows. */
export const SITE_PAGES = { '/': 'home', '/claude': 'claude', '/app': 'app', '/press': 'press', '/privacy': 'privacy', '/terms': 'terms', '/credits': 'credits', '/offline': 'offline' };

/** Pages that are no use to a search engine: the one shown when there is no internet (see site/js/sw.js). */
const UNLISTED_PAGES = new Set(['/offline']);

/** The example reels on the home page, in order: the scene each one's poster shows, and what kind of thing it explains. */
export const EXAMPLES = [
  { name: 'gas-meter', scene: 3, kind: 'A chore' },
  { name: 'pension-letter', scene: 2, kind: 'A letter' },
  { name: 'volcano', scene: 4, kind: 'Homework' },
  { name: 'cup-of-tea', scene: 2, kind: 'Important' },
  { name: 'offside-rule', scene: 4, kind: 'An argument' },
  { name: 'blue-sky', scene: 2, kind: 'A good question' }
];

/** The reel that explains Pixel Reel, at the top of the home page, as a poster among the examples. */
const EXPLAINER = { name: 'pixel-reel', scene: 3, kind: 'Start here' };

/** Every reel with a page of its own to send to someone (/watch/<name>): the one that explains Pixel Reel, and the examples. */
export const WATCH = [EXPLAINER, ...EXAMPLES].map((reel) => reel.name);

/** What a page of the site may load: its own files, and nothing from anywhere else. */
export const SITE_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const siteFile = (path) => new URL(`../site/${path}`, import.meta.url);

/**
 * Every narrator the site knows, by first name: the reel in reels/ whose first line is their
 * hello, for "Hear Anna", and a few words on the voice. Peter comes first, and is who reads
 * unless someone chooses otherwise.
 */
export const NARRATORS = {
  peter: { hello: 'site-peter', kind: "A man's voice" },
  anna: { hello: 'voice-anna', kind: "A woman's voice" },
  vera: { hello: 'voice-vera', kind: "A woman's voice" },
  stuart: { hello: 'voice-stuart', kind: "A man's voice" },
  charles: { hello: 'voice-charles', kind: "A man's voice" },
  paul: { hello: 'voice-paul', kind: "A man's voice" }
};

const named = (narrator) => narrator[0].toUpperCase() + narrator.slice(1);

/** Names as a sentence lists them: "Anna", "Anna or Vera", "Anna, Vera or Stuart". */
const oneOf = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`);

/**
 * The part of the home page where someone chooses who reads to them: a card for Peter and
 * one for each of `narrators` (first names, as the service offers them), each with a button
 * to hear them say hello. Nothing at all where the service offers nobody but Peter.
 * site/js/voice.js remembers the choice.
 */
export function narratorsHtml(narrators = []) {
  const offered = narrators.filter((narrator) => narrator !== 'peter' && NARRATORS[narrator]);
  if (!offered.length) return '';
  const cards = ['peter', ...offered].map((narrator) => {
    const name = named(narrator), { hello, kind } = NARRATORS[narrator];
    return `      <li class="voice">
        <p class="voice-name">${name}</p>
        <p class="voice-kind">${kind}</p>
        <button class="btn btn-teal btn-small" type="button" data-hear="${hello}">Hear ${name}</button>
        <label class="voice-pick"><input type="radio" name="narrator" value="${narrator}"${narrator === 'peter' ? ' checked' : ''}><span><span class="voice-off">Choose<span class="sr-only"> ${name}</span></span><span class="voice-on">Chosen<span class="sr-only">: ${name}</span></span></span></label>
      </li>`;
  });
  return `  <fieldset class="wrap voices" id="voices">
    <legend>Or choose who reads to you</legend>
    <p class="voices-lead">Press Hear to listen to each of them. Then choose the one you like best. Your choice is kept on this device.</p>
    <ul class="voices-list">
${cards.join('\n')}
    </ul>
    <p class="said" id="voices-said" role="status"></p>
  </fieldset>`;
}

/** The answer to "Can someone else read it?", for the narrators the service offers besides Peter. */
export const whoReads = (narrators = []) => {
  const offered = narrators.filter((narrator) => narrator !== 'peter' && NARRATORS[narrator]).map(named);
  return offered.length
    ? `Yes. Peter reads it unless you choose ${oneOf(offered)}. None of them can copy a real person's voice.`
    : "Not here, yet. Peter reads every reel. He cannot copy a real person's voice.";
};

/** Inline Markdown: `code`, **bold**, *emphasis* and [links](address), on escaped text. */
function inline(text) {
  return escapeHtml(text)
    // a web address gets a line of its own, and breaks after a slash if it must
    .replace(/`([^`]+)`/g, (_, code) => (/^https?:/.test(code) ? `<code class="address">${code.replace(/\//g, '/<wbr>')}</code>` : `<code>${code}</code>`))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, words, href) => `<a href="${href}">${words}</a>`);
}

/** The Markdown these pages use (headings, paragraphs, lists) as HTML. Comments are dropped. */
export function markdownHtml(source) {
  const html = [];
  let para = [], list = null;
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    para = [];
    list = null;
  };
  for (const line of source.replace(/<!--[\s\S]*?-->\n?/g, '').split('\n')) {
    const heading = /^(#{1,3}) (.+)$/.exec(line), item = /^(-|\d+\.) (.+)$/.exec(line);
    if (heading) { flush(); html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); }
    else if (item) {
      const tag = item[1] === '-' ? 'ul' : 'ol';
      if (para.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(item[2]);
    } else if (/^\s+\S/.test(line) && list) list.items[list.items.length - 1] += ` ${line.trim()}`;
    else if (line.trim()) { if (list) flush(); para.push(line.trim()); }
    else flush();
  }
  flush();
  return html.join('\n');
}

/**
 * Splits a page's source into the facts in the comment at its top (`key: value` lines, such
 * as its title and description) and the rest.
 */
export function pageFacts(source) {
  const facts = {};
  const top = /^<!--\n([\s\S]*?)\n-->\n?/.exec(source);
  for (const line of top ? top[1].split('\n') : []) {
    const fact = /^([a-z]+):\s*(.+)$/.exec(line.trim());
    if (fact) facts[fact[1]] = fact[2];
  }
  return { facts, body: top ? source.slice(top[0].length) : source };
}

/**
 * Pixel art as an SVG picture: rows of palette letters (see src/palette.js), each letter
 * `scale` pixels big. Crisp at any size, and there before any script has run.
 */
export function spriteSvg(rows, { colours = {}, scale = 4 } = {}) {
  const width = Math.max(...rows.map((r) => r.length)), shapes = new Map();
  rows.forEach((row, y) => {
    for (let x = 0, n; x < row.length; x += n) {
      const ch = row[x];
      for (n = 1; row[x + n] === ch;) n++;
      if (ch === '.' || ch === ' ') continue;
      const colour = colours[ch] ?? PALETTE[ch];
      shapes.set(colour, `${shapes.get(colour) ?? ''}M${x} ${y}h${n}v1h-${n}z`);
    }
  });
  const paths = [...shapes].map(([colour, d]) => `<path fill="${colour}" d="${d}"/>`).join('');
  return `<svg class="px" width="${width * scale}" height="${rows.length * scale}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** Four corners pointing outwards, and four pointing inwards: to fill the screen with a reel, and to put it back. */
const FULL_ICONS = '<svg class="ico on" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M0 0h3v1h-2v2h-1zM6 0h3v3h-1v-2h-2zM0 6h1v2h2v1h-3zM8 6h1v3h-3v-1h2z"/></svg>' +
  '<svg class="ico" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M2 0h1v3h-3v-1h2zM6 0h1v2h2v1h-3zM0 6h3v3h-1v-2h-2zM6 6h3v1h-2v2h-1z"/></svg>';

const PLAY_ICON = '<svg class="ico" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M0 0h2v1h2v1h2v1h1v2h-1v1h-2v1h-2v1h-2z"/></svg>';

/**
 * The player as it stands before its script wakes it (site/js/player.js): the screen, the
 * progress bar, the caption and the buttons, and in the corner of the screen a button that
 * fills the whole screen with the reel. With `name`, it is for that reel in reels/, and
 * says its title; without, it is empty, for the script to fill in.
 */
export function playerHtml(name = null) {
  const reel = name ? JSON.parse(readFileSync(new URL(`../reels/${name}/reel.json`, import.meta.url), 'utf8')) : null;
  const title = escapeHtml(reel?.title ?? 'A pixel reel'), intro = escapeHtml(reel?.intro ?? 'Sound will start. Use Next and Back any time.');
  return `<div class="reel"${name ? ` data-reel="${escapeHtml(name)}"` : ''}>
  <div class="reel-screen">
    <canvas width="960" height="540" role="img" aria-label="Pictures for: ${title}"></canvas>
    <button class="reel-big" type="button">${PLAY_ICON}<span>Play</span></button>
    <button class="reel-full" type="button" aria-label="Fill the screen" aria-pressed="false" hidden>${FULL_ICONS}</button>
  </div>
  <div class="reel-seek" role="slider" tabindex="0" aria-label="Where you are in the reel" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><div class="reel-seek-fill"></div></div>
  <div class="reel-cap">
    <p class="reel-title">${title}</p>
    <p class="reel-time" aria-hidden="true"></p>
    <div class="reel-words" aria-hidden="true"><p class="on">${intro}</p></div>
  </div>
  <p class="sr-only reel-live" aria-live="polite"></p>
  <div class="reel-keys">
    <button class="reel-back" type="button">Back</button>
    <button class="reel-play" type="button"><span class="on">Play</span><span>Pause</span><span>Again</span></button>
    <button class="reel-next" type="button">Next</button>
    <button class="reel-sound" type="button" aria-pressed="true"><span class="on">Sound on</span><span>Sound off</span></button>
  </div>
  <noscript><p class="reel-off">This reel needs JavaScript switched on to play.</p></noscript>
</div>`;
}

/** The picture for {{icon:name:scale}} (an everyday icon) or {{sprite:name:scale}} (one of the site's own). */
function art(kind, name, scale) {
  if (kind === 'player') return playerHtml(name === 'empty' ? null : name);
  const sprite = kind === 'icon' ? ICONS[name] && { rows: ICONS[name] } : SPRITES[name];
  if (!sprite) throw new Error(`the site has no ${kind} called "${name}"`);
  return spriteSvg(sprite.rows, { colours: sprite.colours, scale: Number(scale) || 4 });
}

/**
 * Puts `values` where `text` says {{name}}, pixel art where it says {{icon:name:scale}} or
 * {{sprite:name:scale}}, and a player where it says {{player:reel-name}}. A name with no
 * value is left as it is, to be noticed.
 */
const fill = (text, values) => text.replace(/\{\{([a-z]+)(?::([A-Za-z0-9-]+))?(?::(\d+))?\}\}/g, (all, key, name, scale) =>
  (name ? art(key, name, scale) : key in values ? values[key] : all));

const dropComments = (html) => html.replace(/<!--[\s\S]*?-->\n?/g, '');

/**
 * Every script the site's pages load, as addresses: site/js/main.js and all it imports, and
 * all they import. The layout asks for them all at once, so a browser does not have to
 * fetch one to learn about the next.
 */
export function siteModules(entry = '/site/js/main.js') {
  const found = new Set();
  const visit = (path) => {
    if (found.has(path)) return;
    found.add(path);
    const code = readFileSync(new URL(`..${path}`, import.meta.url), 'utf8');
    for (const [, from] of code.matchAll(/^import [^'\n]*'(\.[^']+)';$/gm)) visit(new URL(from, `http://site${path}`).pathname);
  };
  visit(entry);
  return [...found].sort();
}

/**
 * What a phone needs to know to keep Pixel Reel on its home screen as an app: its name and
 * icons, that it opens on a screen of its own, the things to offer when its icon is pressed
 * and held, and that things can be shared to it from the phone's Share menu, which sends
 * them to /share (site/js/sw.js takes them there). A "maskable" icon keeps Reelie well
 * inside the middle, as a phone may cut its icons into a circle. With `files`, a PDF, a
 * picture or some writing can be shared to it as well as a link or words: only where the
 * service can make a reel of one itself (Make it right here), or the phone would offer
 * Pixel Reel for things it cannot take.
 */
export function appManifest({ files = false } = {}) {
  const night = '#0b1220';
  const icon = (size, purpose) => ({ src: `/site/art/icon-${purpose === 'maskable' ? 'maskable-' : ''}${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose });
  return {
    name: 'Pixel Reel',
    short_name: 'Pixel Reel',
    description: "Short cartoons with a warm voice, each explaining one thing. Watch it. Don't read it.",
    id: '/',
    start_url: '/',
    scope: '/',
    lang: 'en-GB',
    dir: 'ltr',
    display: 'standalone',
    background_color: night,
    theme_color: night,
    categories: ['education', 'productivity'],
    icons: [icon(192, 'any'), icon(512, 'any'), icon(192, 'maskable'), icon(512, 'maskable')],
    shortcuts: [
      { name: 'Make a pixel reel', short_name: 'Make a reel', url: '/#make' },
      { name: 'Watch an example', short_name: 'Examples', url: '/#examples' },
      { name: 'Add Pixel Reel to Claude', short_name: 'Add to Claude', url: '/claude' }
    ],
    share_target: {
      action: '/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title', text: 'text', url: 'url',
        ...(files ? { files: [{ name: 'file', accept: ['application/pdf', 'image/*', 'text/plain', '.pdf', '.txt', '.md'] }] } : {})
      }
    }
  };
}

/** The link that opens Claude's own "add a connector" box with Pixel Reel's name and address filled in. */
export const addToClaudeLink = (baseUrl) =>
  `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent('Pixel Reel')}&connectorUrl=${encodeURIComponent(`${baseUrl}/mcp`)}`;

const reelTitle = (name) => JSON.parse(readFileSync(new URL(`../reels/${name}/reel.json`, import.meta.url), 'utf8')).title;

/**
 * Reels as posters, each named by its reel. On the home page they are the examples, and a
 * poster plays its reel over the page. With `links` each is a link to its reel's own page,
 * the reel that explains Pixel Reel is among them, and `except` (the page they are on) is not.
 */
export function postersHtml({ links = false, except = null } = {}) {
  return (links ? [EXPLAINER, ...EXAMPLES] : EXAMPLES).filter(({ name }) => name !== except).map(({ name, scene, kind }) => `      <li>
        ${links ? `<a class="poster" href="/watch/${name}">` : `<button class="poster" type="button" data-reel="${name}" data-kicker="Now showing">`}
          <canvas class="shot" data-reel="${name}" data-scene="${scene}" data-hover width="960" height="540" aria-hidden="true"></canvas>
          <span class="poster-title">${escapeHtml(reelTitle(name))}</span>
          <span class="poster-meta"><span class="poster-kind">${kind}</span><span data-length="${name}">About a minute</span></span>
        ${links ? '</a>' : '</button>'}
      </li>`).join('\n');
}

/**
 * One of the site's pages, for a service at `baseUrl`. `listed` says whether search engines
 * may list it: until Pixel Reel is open to everyone, every page asks them not to. `values`
 * fills names of the page's own (already safe to put in HTML), such as `here` ("on" when the
 * service can write a reel for a visitor itself) and `languages` (the choices of language it
 * can write one in, as HTML); `title`, `description`, `path`, `image` (a
 * whole address), `imagealt` and `fetch` (files to ask for early) replace the page's own,
 * for a page that stands for many, such as a reel's.
 */
export function sitePage(name, baseUrl, { listed = false, values = {}, title = null, description = null, path = null, image = null, imagealt = null, fetch = null, narrators = [] } = {}) {
  path ??= Object.keys(SITE_PAGES).find((p) => SITE_PAGES[p] === name) ?? '/';
  const markdown = !existsSync(siteFile(`pages/${name}.html`));
  const { facts, body } = pageFacts(readFileSync(siteFile(`pages/${name}.${markdown ? 'md' : 'html'}`), 'utf8'));
  // the connector's address is long and has no spaces: <wbr> lets a narrow screen break it before "/mcp", not mid-word
  const links = { url: escapeHtml(baseUrl), mcp: `${escapeHtml(baseUrl)}<wbr>/mcp`, add: escapeHtml(addToClaudeLink(baseUrl)), here: 'off', languages: '', posters: postersHtml(), voices: narratorsHtml(narrators), whoreads: whoReads(narrators), ...values };
  const heading = /^# (.+)$/m.exec(body)?.[1];
  title ??= facts.title ?? (heading && heading !== 'Pixel Reel' ? `${heading} - Pixel Reel` : 'Pixel Reel');
  // a plain page that has a reel of itself offers it straight under its heading
  const watch = facts.reel ? `\n<p class="doc-reel"><button class="btn btn-reel" type="button" data-reel="${escapeHtml(facts.reel)}">Make a pixel reel about this</button></p>` : '';
  const main = markdown
    ? `<article class="doc">\n${markdownHtml(fill(body, { url: baseUrl, mcp: `${baseUrl}/mcp` })).replace('</h1>', () => `</h1>${watch}`)}\n</article>`
    : fill(dropComments(body), links);
  const ahead = [
    ...siteModules().map((module) => `<link rel="modulepreload" href="${module}">`),
    ...(fetch ?? facts.fetch ?? '').split(/\s+/).filter(Boolean).map((file) => `<link rel="preload" as="fetch" crossorigin href="${escapeHtml(file)}">`)
  ];
  return fill(dropComments(readFileSync(siteFile('layout.html'), 'utf8')), {
    ...links,
    ahead: ahead.join('\n'),
    title: escapeHtml(title),
    description: escapeHtml(description ?? facts.description ?? 'Pixel Reel turns anything wordy into a short cartoon, read to you in a warm voice. Free, and made for anyone who would rather watch than read.'),
    image: escapeHtml(image ?? `${baseUrl}/site/art/${facts.image ?? 'share.png'}`),
    imagealt: escapeHtml(imagealt ?? facts.imagealt ?? "Pixel Reel. Watch it. Don't read it. A pixel-art film reel with a smiling face stands under a night sky."),
    page: escapeHtml(name),
    watchable: WATCH.join(' '),
    canonical: escapeHtml(`${baseUrl}${path}`),
    robots: listed && !UNLISTED_PAGES.has(path) ? 'index, follow' : 'noindex, nofollow',
    main
  });
}

/** What the site tells search engines' robots: keep out, until it is listed; and never look at people's reels. */
export function robotsTxt(baseUrl, listed = false) {
  return listed ? `User-agent: *\nDisallow: /r/\nDisallow: /mcp\n\nSitemap: ${baseUrl}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
}

/** The pages a search engine may list, once the site is listed. */
export function sitemapXml(baseUrl) {
  const pages = [...Object.keys(SITE_PAGES).filter((path) => !UNLISTED_PAGES.has(path)), ...WATCH.map((name) => `/watch/${name}`)].map((path) => `  <url><loc>${escapeHtml(`${baseUrl}${path}`)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.join('\n')}\n</urlset>\n`;
}

/**
 * The page of one of the reels in WATCH, to send to someone: the reel, as large as the
 * screen allows, a way to pass it on, and the other examples. A message that is sent its
 * address shows the reel's own picture (/watch/<name>/card.png).
 */
export function watchPage(name, baseUrl, { listed = false } = {}) {
  const title = reelTitle(name), next = WATCH[(WATCH.indexOf(name) + 1) % WATCH.length];
  return sitePage('watch', baseUrl, {
    listed,
    path: `/watch/${name}`,
    title: `${title} - Pixel Reel`,
    description: `${title}. A pixel reel: a short cartoon with a warm voice. Press Play, and Peter will read it to you.`,
    image: `${baseUrl}/watch/${name}/card.png`,
    imagealt: `${title}: a pixel reel. Press Play.`,
    fetch: `/reels/${name}/reel.json /reels/${name}/audio/manifest.json`,
    values: {
      reeltitle: escapeHtml(title), theplayer: playerHtml(name), others: postersHtml({ links: true, except: name }),
      // when it ends it offers the next one round: after the last example, the reel that explains Pixel Reel
      nextname: next, nexttitle: escapeHtml(reelTitle(next))
    }
  });
}
