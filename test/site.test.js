import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { textArt } from '../scripts/site-art.mjs';
import { addToClaudeLink, pageFacts, playerHtml, robotsTxt, SITE_PAGES, siteModules, sitePage, spriteSvg } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { SCENES } from '../site/js/landscape.js';
import { askFor } from '../site/js/maker.js';
import { lengthWords } from '../site/js/reels.js';
import { SPRITES } from '../site/js/sprites.js';
import { parseReelJson } from '../src/format.js';
import { createKit } from '../src/kit.js';
import { PALETTE } from '../src/palette.js';
import { fakeContext } from './fake-canvas.js';

const root = (path) => new URL(`../${path}`, import.meta.url);
const pages = [...Object.values(SITE_PAGES), 'not-found'];
const html = Object.fromEntries(pages.map((name) => [name, sitePage(name, 'https://reels.example')]));

describe('putting a page together', () => {
  it('reads the facts in the comment at the top of a page', () => {
    assert.deepEqual(pageFacts('<!--\ntitle: Hello - there\ndescription: A page.\n-->\n<p>Body</p>'), { facts: { title: 'Hello - there', description: 'A page.' }, body: '<p>Body</p>' });
    assert.deepEqual(pageFacts('# Plain'), { facts: {}, body: '# Plain' });
  });

  it('draws pixel art as SVG, one run of a colour at a time', () => {
    assert.equal(spriteSvg(['.kk.', 'kyyk'], { scale: 4 }),
      '<svg class="px" width="16" height="8" viewBox="0 0 4 2" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
      '<path fill="#1a1a1a" d="M1 0h2v1h-2zM0 1h1v1h-1zM3 1h1v1h-1z"/><path fill="#ffcc4d" d="M1 1h2v1h-2z"/></svg>');
    assert.match(spriteSvg(['h'], { colours: { h: '#123456' } }), /fill="#123456"/, 'a sprite can bring colours of its own');
  });

  it('gives every page its own title and description, and the layout round it', () => {
    const titles = new Set();
    for (const name of pages) {
      const title = /<title>([^<]+)<\/title>/.exec(html[name])[1];
      assert.ok(!titles.has(title), `${name} shares its title, "${title}"`);
      titles.add(title);
      assert.match(html[name], /<meta name="description" content="[^"]{20,}">/, name);
      assert.match(html[name], new RegExp(`<body class="page-${name}">`), name);
      assert.match(html[name], /<a class="skip" href="#main">/, `${name} lets a keyboard skip the bar across the top`);
      assert.match(html[name], /<dialog class="comfort" id="comfort"/, `${name} has Make it comfy`);
      assert.doesNotMatch(html[name], /\sstyle="/, `${name} has no inline styles: the site's policy would block them`);
    }
    assert.match(html.home, /<link rel="canonical" href="https:\/\/reels\.example\/">/);
    assert.match(html.press, /<link rel="canonical" href="https:\/\/reels\.example\/press">/);
  });

  it('asks for every script at once, and the first reel with them', () => {
    const modules = siteModules();
    assert.ok(modules.includes('/site/js/main.js') && modules.includes('/site/js/player.js') && modules.includes('/src/kit.js') && modules.includes('/src/icons.js'));
    for (const path of modules) assert.ok(html.home.includes(`<link rel="modulepreload" href="${path}">`), path);
    assert.match(html.home, /<link rel="preload" as="fetch" crossorigin href="\/reels\/pixel-reel\/reel\.json">/);
    assert.doesNotMatch(html.press, /rel="preload" as="fetch"/, 'a page with no player fetches no reel ahead');
  });

  it('gives every button a name a screen reader can say', () => {
    for (const name of pages) {
      for (const [button, inside] of html[name].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)) {
        const words = inside.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]*aria-hidden="true"[^>]*>[^<]*<\/[a-z]+>/g, '').replace(/<[^>]+>/g, '').trim();
        assert.ok(words || /aria-label="[^"]+"/.test(button), `${name}: a button has no name: ${button.slice(0, 80)}`);
      }
    }
  });

  it('says when a page asks for a picture that does not exist', () => {
    assert.match(spriteSvg(SPRITES.reelie.rows, SPRITES.reelie), /^<svg/);
    assert.throws(() => playerHtml('no-such-reel'));
  });

  it('writes the player with its title, before any script has run', () => {
    const player = playerHtml('pixel-reel');
    assert.match(player, /<div class="reel" data-reel="pixel-reel">/);
    assert.match(player, /aria-label="Pictures for: What is Pixel Reel\?"/);
    assert.match(player, /<p class="reel-title">What is Pixel Reel\?<\/p>/);
    assert.match(player, /role="slider" tabindex="0" aria-label="Where you are in the reel"/);
  });

  it('makes the link that opens Claude with the connector filled in', () => {
    assert.equal(addToClaudeLink('https://pixelreel.pro'),
      'https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Pixel%20Reel&connectorUrl=https%3A%2F%2Fpixelreel.pro%2Fmcp');
  });

  it('keeps robots out until the site is listed', () => {
    assert.equal(robotsTxt('https://reels.example'), 'User-agent: *\nDisallow: /\n');
    assert.match(robotsTxt('https://reels.example', true), /^User-agent: \*\nDisallow: \/r\/\n/);
  });
});

describe('what the pages point at', () => {
  const reelNames = readdirSync(root('reels'));

  it('plays only reels that exist, are plain data, and are fully recorded', () => {
    const named = new Set();
    for (const name of pages) {
      for (const [, reel] of html[name].matchAll(/data-(?:reel|hear|length)="([^"]+)"/g)) named.add(reel);
    }
    assert.ok(named.size >= 12, 'the site plays a reel for each part of the page, and the examples');
    for (const reel of named) {
      assert.ok(reelNames.includes(reel), `there is no reel called ${reel}`);
      const scenes = parseReelJson(readFileSync(root(`reels/${reel}/reel.json`), 'utf8')).scenes;
      const { clips } = JSON.parse(readFileSync(root(`reels/${reel}/audio/manifest.json`), 'utf8'));
      for (const scene of scenes) {
        const clip = clips.find((c) => c.text === scene.say);
        assert.ok(clip && existsSync(root(`reels/${reel}/audio/${clip.file}`)), `${reel}: "${scene.title}" has no recording`);
        assert.ok(staticFile(`/reels/${reel}/audio/${clip.file}`), `${reel}: the site can serve ${clip.file}`);
      }
    }
  });

  it('shows only scenes its reels have', () => {
    for (const name of pages) {
      for (const [, reel, scene] of html[name].matchAll(/<canvas class="shot" data-reel="([^"]+)" data-scene="(\d+)"/g)) {
        const { scenes } = parseReelJson(readFileSync(root(`reels/${reel}/reel.json`), 'utf8'));
        assert.ok(Number(scene) >= 1 && Number(scene) <= scenes.length, `${name}: ${reel} has no scene ${scene}`);
      }
    }
  });

  it('loads only files the site serves', () => {
    for (const name of pages) {
      for (const [, path] of html[name].matchAll(/(?:src|href)="(\/(?:site|src|fonts|reels)\/[^"]+)"/g)) {
        assert.ok(staticFile(path), `${name} asks for ${path}, which the site does not serve`);
      }
    }
    for (const file of readdirSync(root('site/js'))) {
      const code = readFileSync(root(`site/js/${file}`), 'utf8');
      assert.ok(staticFile(`/site/js/${file}`), file);
      for (const [, from] of code.matchAll(/from '(\.[^']+)'/g)) {
        assert.ok(staticFile(new URL(from, `http://x/site/js/${file}`).pathname), `${file} imports ${from}, which the site does not serve`);
      }
    }
    for (const [, font] of readFileSync(root('site/css/site.css'), 'utf8').matchAll(/url\('([^']+)'\)/g)) {
      assert.ok(staticFile(new URL(font, 'http://x/site/css/site.css').pathname), `site.css asks for ${font}`);
    }
  });

  it('links between its own pages only to pages that exist', () => {
    for (const name of pages) {
      for (const [, path] of html[name].matchAll(/href="(\/[a-z-]*)(?:#[a-z-]+)?"/g)) {
        assert.ok(path in SITE_PAGES, `${name} links to ${path}`);
      }
      for (const [, id] of html[name].matchAll(/href="\/#([a-z-]+)"/g)) {
        assert.match(html.home, new RegExp(`id="${id}"`), `${name} links to /#${id}`);
      }
    }
  });
});

describe('the site\'s own pictures', () => {
  it('uses only letters with a colour', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      const width = sprite.rows[0].length;
      for (const row of sprite.rows) {
        assert.equal(row.length, width, `${name}: every row is as wide as the first`);
        for (const ch of row) assert.ok(ch === '.' || ch in PALETTE || ch in (sprite.colours ?? {}), `${name} uses "${ch}", which has no colour`);
      }
    }
  });

  it('draws every landscape at any size, moving or still, without leaving the picture', () => {
    for (const [name, draw] of Object.entries(SCENES)) {
      for (const [w, h] of [[98, 220], [360, 234], [640, 120], [40, 60]]) {
        for (const still of [false, true]) {
          const g = fakeContext();
          draw(createKit(g), w, h, 6.5, { quiet: [[0, 0, 30, 30]], paper: '#faf3e1', still });
          assert.ok(g.rects.length > 0, `${name} drew something at ${w} x ${h}`);
          assert.ok(g.rects.every((r) => [r.x, r.y, r.w, r.h].every(Number.isFinite)), `${name} at ${w} x ${h}: every shape has a place`);
          assert.equal(g.depth, 0, `${name} left the canvas as it found it`);
        }
      }
    }
  });

  it('keeps stars away from where the words are', () => {
    const g = fakeContext();
    SCENES.cinema(createKit(g), 200, 100, 3, { quiet: [[20, 10, 100, 60]] });
    const stars = g.rects.filter((r) => r.w === 1 && r.h === 1);
    assert.ok(stars.length > 10);
    assert.ok(!stars.some((r) => r.x >= 20 && r.x < 120 && r.y >= 10 && r.y < 70));
  });

  it('has its icons and manifest drawn from the sprites as they are now (npm run site-art)', () => {
    for (const [name, text] of Object.entries(textArt())) {
      assert.equal(readFileSync(root(`site/art/${name}`), 'utf8'), text, `site/art/${name} is out of date: run npm run site-art`);
    }
  });
});

describe('the words for Claude', () => {
  it('asks about a few words, or about a page when given a link', () => {
    assert.equal(askFor('  my   gas bill '), 'Make me a pixel reel about this: my gas bill');
    assert.equal(askFor('https://example.com/news/story'), 'Make me a pixel reel about this page: https://example.com/news/story');
    assert.equal(askFor('www.example.com/a'), 'Make me a pixel reel about this page: www.example.com/a');
    assert.equal(askFor('how https://example.com works'), 'Make me a pixel reel about this: how https://example.com works');
    assert.equal(askFor(''), 'Make me a pixel reel about this: my gas bill', 'with nothing typed, it shows an example');
  });

  it('says how long a reel lasts in words', () => {
    assert.equal(lengthWords(39400), '39 seconds');
    assert.equal(lengthWords(60000), '1 minute');
    assert.equal(lengthWords(76000), '1 minute 16');
    assert.equal(lengthWords(125000), '2 minutes 5');
  });
});
