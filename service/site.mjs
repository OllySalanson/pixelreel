// The website: what Pixel Reel is, how to add it to Claude, the press kit, privacy, terms
// and credits. Everything it shows lives in site/: one layout (site/layout.html) that every
// page shares, and a page each in site/pages/, written as HTML or, for the plain ones, as
// Markdown. This puts a page together; service/static.mjs serves the files a page loads.
import { existsSync, readFileSync } from 'node:fs';
import { SPRITES } from '../site/js/sprites.js';
import { ICONS } from '../src/icons.js';
import { PALETTE } from '../src/palette.js';

/** Each address the site answers, and the page in site/pages/ it shows. */
export const SITE_PAGES = { '/': 'home', '/claude': 'claude', '/press': 'press', '/privacy': 'privacy', '/terms': 'terms', '/credits': 'credits' };

/** What a page of the site may load: its own files, and nothing from anywhere else. */
export const SITE_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const siteFile = (path) => new URL(`../site/${path}`, import.meta.url);

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

const PLAY_ICON = '<svg class="ico" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="M0 0h2v1h2v1h2v1h1v2h-1v1h-2v1h-2v1h-2z"/></svg>';

/**
 * The player as it stands before its script wakes it (site/js/player.js): the screen, the
 * progress bar, the caption and the buttons. With `name`, it is for that reel in reels/, and
 * says its title; without, it is empty, for the script to fill in.
 */
export function playerHtml(name = null) {
  const reel = name ? JSON.parse(readFileSync(new URL(`../reels/${name}/reel.json`, import.meta.url), 'utf8')) : null;
  const title = escapeHtml(reel?.title ?? 'A pixel reel'), intro = escapeHtml(reel?.intro ?? 'Sound will start. Use Next and Back any time.');
  return `<div class="reel"${name ? ` data-reel="${escapeHtml(name)}"` : ''}>
  <div class="reel-screen">
    <canvas width="960" height="540" role="img" aria-label="Pictures for: ${title}"></canvas>
    <button class="reel-big" type="button">${PLAY_ICON}<span>Play</span></button>
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

/** The link that opens Claude's own "add a connector" box with Pixel Reel's name and address filled in. */
export const addToClaudeLink = (baseUrl) =>
  `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent('Pixel Reel')}&connectorUrl=${encodeURIComponent(`${baseUrl}/mcp`)}`;

/**
 * One of the site's pages, for a service at `baseUrl`. `listed` says whether search engines
 * may list the site: until Pixel Reel is open to everyone, every page asks them not to.
 */
export function sitePage(name, baseUrl, { listed = false } = {}) {
  const path = Object.keys(SITE_PAGES).find((p) => SITE_PAGES[p] === name) ?? '/';
  const markdown = !existsSync(siteFile(`pages/${name}.html`));
  const { facts, body } = pageFacts(readFileSync(siteFile(`pages/${name}.${markdown ? 'md' : 'html'}`), 'utf8'));
  const links = { url: escapeHtml(baseUrl), mcp: escapeHtml(`${baseUrl}/mcp`), add: escapeHtml(addToClaudeLink(baseUrl)) };
  const heading = /^# (.+)$/m.exec(body)?.[1];
  const title = facts.title ?? (heading && heading !== 'Pixel Reel' ? `${heading} - Pixel Reel` : 'Pixel Reel');
  const main = markdown
    ? `<article class="doc${facts.reel ? ' has-reel' : ''}">\n${markdownHtml(fill(body, { url: baseUrl, mcp: `${baseUrl}/mcp` }))}\n${
      facts.reel ? `<p class="doc-reel"><button class="btn btn-reel" type="button" data-reel="${escapeHtml(facts.reel)}">Make a pixel reel about this</button></p>\n` : ''}</article>`
    : fill(dropComments(body), links);
  return fill(dropComments(readFileSync(siteFile('layout.html'), 'utf8')), {
    ...links,
    title: escapeHtml(title),
    description: escapeHtml(facts.description ?? 'Pixel Reel turns anything wordy into a short cartoon, read to you in a warm voice. Free, and made for anyone who would rather watch than read.'),
    page: escapeHtml(name),
    canonical: escapeHtml(`${baseUrl}${path}`),
    robots: listed ? 'index, follow' : 'noindex, nofollow',
    main
  });
}

/** What the site tells search engines' robots: keep out, until it is listed; and never look at people's reels. */
export function robotsTxt(baseUrl, listed = false) {
  return listed ? `User-agent: *\nDisallow: /r/\nDisallow: /mcp\n\nSitemap: ${baseUrl}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
}

/** The pages a search engine may list, once the site is listed. */
export function sitemapXml(baseUrl) {
  const pages = Object.keys(SITE_PAGES).map((path) => `  <url><loc>${escapeHtml(`${baseUrl}${path}`)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.join('\n')}\n</urlset>\n`;
}
