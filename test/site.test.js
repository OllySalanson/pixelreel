import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { textArt } from '../scripts/site-art.mjs';
import { addToClaudeLink, EXAMPLES, NARRATORS, narratorsHtml, pageFacts, playerHtml, robotsTxt, SITE_PAGES, siteModules, sitemapXml, sitePage, spriteSvg, WATCH, watchPage } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { hopHeight, lookAt, REELIE, SAYINGS, SCENES } from '../site/js/landscape.js';
import { askFor } from '../site/js/maker.js';
import { nowPlaying } from '../site/js/player.js';
import { PACES, pacedClock, rateOf } from '../site/js/pace.js';
import { lengthWords, showOf, waitingFor } from '../site/js/reels.js';
import { rulerTop } from '../site/js/ruler.js';
import { sendReel, sentWords } from '../site/js/send.js';
import { sheetOf } from '../site/js/sheet.js';
import { SPRITES } from '../site/js/sprites.js';
import { keepNarrator, narratorName, readNarrator, VOICE } from '../site/js/voice.js';
import { parseReelJson } from '../src/format.js';
import { createKit } from '../src/kit.js';
import { PALETTE } from '../src/palette.js';
import { fakeContext } from './fake-canvas.js';

const root = (path) => new URL(`../${path}`, import.meta.url);
const pages = [...Object.values(SITE_PAGES), 'not-found', 'reel-gone', 'reel'];
const forReel = { values: { reelid: 'abcdefghijklmnopqrstuv', reeltitle: 'Tea' }, title: 'Tea - Pixel Reel', path: '/r/abcdefghijklmnopqrstuv' };
const html = Object.fromEntries(pages.map((name) => [name, sitePage(name, 'https://reels.example', name === 'reel' ? forReel : {})]));
// the page of one of the site's own reels stands in for all of them where every page is looked over
html['watch/offside-rule'] = watchPage('offside-rule', 'https://reels.example');
pages.push('watch/offside-rule');

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
      assert.match(html[name], new RegExp(`<body class="page-${name.split('/')[0]}">`), name);   // "watch/<reel>" is the watch page
      assert.match(html[name], /<a class="skip" href="#main">/, `${name} lets a keyboard skip the bar across the top`);
      assert.match(html[name], /<dialog class="comfort" id="comfort"/, `${name} has Make it comfy`);
      assert.doesNotMatch(html[name], /\sstyle="/, `${name} has no inline styles: the site's policy would block them`);
    }
    assert.match(html.reel, /<h1 class="sr-only" id="watch-title">Tea<\/h1>/);
    assert.doesNotMatch(html.reel, /\{\{/, 'a reel page has every name filled in');
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

  it('offers a plain page as a reel, straight under its heading, when it has one', () => {
    assert.match(html.privacy, /<h1>Privacy<\/h1>\n<p class="doc-reel"><button class="btn btn-reel" type="button" data-reel="site-privacy">Make a pixel reel about this<\/button><\/p>/);
    assert.match(html.terms, /data-reel="site-terms"/);
    assert.doesNotMatch(html.credits, /doc-reel/);
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
      for (const [, reels] of html[name].matchAll(/data-(?:reels?|reel-here|hear|length)="([^"]+)"/g)) reels.split(' ').forEach((reel) => named.add(reel));
    }
    assert.ok(named.size >= 15, 'the site plays a reel for each part of the page, the examples, and the privacy and terms pages');
    assert.ok(named.has('site-make') && named.has('site-make-here'), 'the make-one box has a reel for each way it works: words for Claude, and making the reel itself');
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

  it('has Reelie say hello once, when first seen, and never when held still', () => {
    const said = (options) => {
      const g = fakeContext();
      SCENES.hero(createKit(g), 360, 234, 30, { paper: '#faf3e1', ...options });
      return g.texts.some((text) => text.str === 'Hello!');
    };
    assert.equal(said({}), false, 'not before it has been seen');
    assert.equal(said({ met: 0.1 }), false, 'not the instant it is seen');
    assert.equal(said({ met: 2 }), true, 'soon after it is seen');
    assert.equal(said({ met: 2, still: true }), false, 'never when pictures are held still');
    assert.equal(said({ met: 60 }), false, 'and not for ever');
    assert.equal(said({ met: 2, quiet: [[0, 0, 360, 234]] }), false, 'nor on top of any words');
  });

  it('keeps stars away from where the words are, and out of the strips of film', () => {
    const g = fakeContext();
    SCENES.cinema(createKit(g), 200, 100, 3, { quiet: [[20, 10, 100, 60]] });
    const stars = g.rects.filter((r) => r.w === 1 && r.h === 1);
    assert.ok(stars.length > 10);
    assert.ok(!stars.some((r) => r.x >= 20 && r.x < 120 && r.y >= 10 && r.y < 70));
    // the strips are 5 units deep, 4 in from the top and the foot (.cinema in site.css)
    assert.ok(stars.every((r) => r.y > 9 && r.y < 100 - 10), 'no star in among the holes');
  });

  it('has Reelie look towards the pointer, and straight ahead when it is close', () => {
    assert.deepEqual(lookAt(50, 50, 200, 50), [1, 0]);
    assert.deepEqual(lookAt(50, 50, 0, 0), [-1, -1]);
    assert.deepEqual(lookAt(50, 50, 55, 300), [0, 1]);
    assert.deepEqual(lookAt(50, 50, 52, 47), [0, 0]);
    // its eyes are drawn over where the pointer is, and left alone when pictures are held still
    const eyes = (options) => {
      const g = fakeContext();
      const { reelie: [x, y] } = SCENES.hero(createKit(g), 360, 234, 30, { paper: '#faf3e1', ...options });
      return g.rects.filter((r) => r.w === 1 && r.h === 2 && r.c === '#1a1a1a' && r.y >= y && r.y < y + REELIE.h).map((r) => r.x - x).sort((a, b) => a - b);
    };
    assert.deepEqual(eyes({ pointer: [300, 200] }), [11, 17], 'both eyes one pixel to the right');
    assert.deepEqual(eyes({ pointer: [0, 200] }), [9, 15], 'and to the left');
    assert.deepEqual(eyes({ pointer: [300, 200], still: true }), []);
  });

  it('has Reelie hop when it is pressed, and say something new each time', () => {
    assert.equal(hopHeight(-1), 0);
    assert.equal(hopHeight(0), 0);
    assert.ok(hopHeight(0.25) >= 6, 'up');
    assert.equal(hopHeight(0.5), 0, 'and down again in half a second');
    const pressed = (options) => {
      const g = fakeContext();
      const spot = SCENES.hero(createKit(g), 360, 234, 30, { paper: '#faf3e1', ...options });
      return { said: g.texts.map((text) => text.str).filter((str) => SAYINGS.includes(str)), spot };
    };
    assert.deepEqual(pressed({}).said, []);
    assert.deepEqual(pressed({ poked: 0.3, pokes: 1 }).said, [SAYINGS[1]]);
    assert.deepEqual(pressed({ poked: 0.3, pokes: 2 }).said, [SAYINGS[2]]);
    assert.deepEqual(pressed({ poked: 0.3, pokes: SAYINGS.length }).said, [SAYINGS[0]], 'round again');
    assert.deepEqual(pressed({ poked: 10, pokes: 1 }).said, [], 'not for long');
    assert.deepEqual(pressed({ poked: 0.3, pokes: 1, still: true }).said, [], 'and not when pictures are held still');
    assert.ok(SAYINGS.every((words) => words.length <= 12), 'each short enough to fit beside it on a phone');
    const [x, y, w, h] = pressed({}).spot.reelie;
    assert.deepEqual([w, h], [REELIE.w, REELIE.h]);
    assert.ok(x >= 0 && x + w <= 360 && y >= 0 && y + h <= 234, 'the page is told where Reelie stands');
  });

  it('wakes sleeping Reelie for a moment when it is pressed', () => {
    const footer = (options) => {
      const g = fakeContext();
      SCENES.footer(createKit(g), 200, 120, 3, options);
      return g.texts.map((text) => text.str);
    };
    assert.ok(footer({}).includes('z'), 'asleep');
    assert.deepEqual(footer({ poked: 0.5 }), ['Mmm?'], 'woken: no Zs');
    assert.deepEqual(footer({ poked: 3 }), ['Night night.']);
    assert.ok(footer({ poked: 5 }).includes('z') && !footer({ poked: 5 }).includes('Night night.'), 'asleep again');
    assert.ok(footer({ poked: 0.5, still: true }).includes('z'), 'left to sleep when pictures are held still');
  });

  it('lets sleeping Reelie\'s Zs drift up only as far as the words in the footer', () => {
    const zs = (quiet) => {
      const found = [];
      for (let t = 0; t < 8; t += 0.25) {
        const g = fakeContext();
        SCENES.footer(createKit(g), 100, 120, t, { quiet });
        found.push(...g.texts.filter((text) => text.str === 'z'));
      }
      return found;
    };
    const free = zs([]);
    assert.ok(free.length > 20 && Math.min(...free.map((z) => z.y)) < 70, 'they rise well above Reelie when nothing is in the way');
    const words = [0, 0, 100, 80];   // the footer's words reach down to row 80
    assert.ok(zs([words]).length > 0, 'the low ones are still drawn');
    assert.ok(zs([words]).every((z) => z.y >= 80), 'and none over the words');
  });

  it('ends the dusk at the foot of the page above the words, so they never sit on its pattern', () => {
    const NIGHT = '#0b1220';
    // the lowest row with anything in it but night sky and stars
    const duskEnds = (quiet) => {
      const g = fakeContext();
      SCENES.finale(createKit(g), 100, 200, 3, { quiet, paper: '#faf3e1' });
      return Math.max(...g.rects.filter((r) => r.c.toLowerCase() !== NIGHT && !(r.w === 1 && r.h === 1) && !(r.h === 1 && r.w === 3) && !(r.w === 1 && r.h === 3)).map((r) => r.y + r.h));
    };
    assert.equal(duskEnds([]), 52, 'as deep as it likes when nothing is in its way');
    assert.ok(duskEnds([[4, 30, 80, 60]]) <= 30, 'and no deeper than where the words begin');
  });

  it('sends its shooting stars behind the words and clear of the film, never across them', () => {
    // a shooting star's trail is the only thing in these skies drawn two pixels wide and one deep
    const trails = (name, quiet) => {
      const found = [];
      for (let t = 0; t < 60; t += 0.125) {
        const g = fakeContext();
        SCENES[name](createKit(g), 200, 120, t, { quiet });
        found.push(...g.rects.filter((r) => r.w === 2 && r.h === 1));
      }
      return found;
    };
    for (const name of ['hero', 'cinema']) {
      const free = trails(name, []);
      assert.ok(free.length > 10, `${name} has shooting stars`);
      assert.ok(free.every((r) => Number.isInteger(r.x) && Number.isInteger(r.y)), `${name}: on whole pixels, so they stay crisp`);
      const words = [40, 0, 120, 60];
      assert.ok(free.some((r) => r.x + 2 > 40 && r.x < 160 && r.y < 60), `${name}: some would cross the words`);
      assert.ok(!trails(name, [words]).some((r) => r.x + 2 > 40 && r.x < 160 && r.y < 60), `${name}: none does`);
    }
    assert.ok(trails('cinema', []).every((r) => r.y > 9 && r.y < 120 - 10), 'none in among the holes of the film');
  });

  it('has its icons and manifest drawn from the sprites as they are now (npm run site-art)', () => {
    for (const [name, text] of Object.entries(textArt())) {
      assert.equal(readFileSync(root(`site/art/${name}`), 'utf8'), text, `site/art/${name} is out of date: run npm run site-art`);
    }
  });
});

describe('a page for each example reel', () => {
  const title = (name) => JSON.parse(readFileSync(root(`reels/${name}/reel.json`), 'utf8')).title;

  it('shows the six examples on the home page, each named by its reel and opening it over the page', () => {
    assert.equal(EXAMPLES.length, 6);
    for (const { name, scene, kind } of EXAMPLES) {
      const poster = new RegExp(`<button class="poster" type="button" data-reel="${name}" data-kicker="Now showing">\\s*<canvas class="shot" data-reel="${name}" data-scene="${scene}" data-hover [^>]*></canvas>\\s*<span class="poster-title">([^<]*)</span>\\s*<span class="poster-meta"><span class="poster-kind">${kind}</span>`);
      assert.equal(poster.exec(html.home)?.[1], title(name).replace(/&/g, '&amp;'), name);
      assert.ok(scene <= JSON.parse(readFileSync(root(`reels/${name}/reel.json`), 'utf8')).scenes.length, `${name} has a scene ${scene}`);
    }
  });

  it('gives the reel that explains Pixel Reel, and every example, a page of its own', () => {
    assert.deepEqual(WATCH, ['pixel-reel', ...EXAMPLES.map((example) => example.name)]);
    for (const name of WATCH) {
      const page = watchPage(name, 'https://reels.example');
      assert.ok(page.includes(`<title>${title(name)} - Pixel Reel</title>`), name);
      assert.ok(page.includes(`<h1 class="sr-only" id="watch-title">${title(name)}</h1>`), name);
      assert.ok(page.includes(`<div class="reel" data-reel="${name}">`), `${name}: its player is on the page`);
      assert.ok(page.includes(`<link rel="canonical" href="https://reels.example/watch/${name}">`), name);
      assert.ok(page.includes(`<meta property="og:image" content="https://reels.example/watch/${name}/card.png">`), `${name}: a message shows its own picture`);
      assert.ok(page.includes(`<link rel="preload" as="fetch" crossorigin href="/reels/${name}/reel.json">`), `${name}: its reel is asked for early`);
      assert.ok(page.includes(`data-send="${title(name)}" data-says="#watch-sent"`), `${name}: it can be sent on`);
      assert.doesNotMatch(page, /\{\{/, `${name}: every name is filled in`);
      // the others, as links to their own pages, and never itself: six, so they fill two rows of three
      const links = [...page.matchAll(/<a class="poster" href="\/watch\/([a-z-]+)">/g)].map((found) => found[1]);
      assert.deepEqual(links, WATCH.filter((other) => other !== name), name);
      assert.equal(links.length, 6);
    }
  });

  it('tells the player over the page which reels have a page to send, and search engines where they are', () => {
    assert.ok(html.home.includes(`<dialog class="theatre" id="theatre" aria-labelledby="theatre-title" data-pages="${WATCH.join(' ')}">`));
    assert.match(html.home, /<button class="btn btn-paper" type="button" id="theatre-send" hidden>Send it to someone<\/button>/);
    for (const name of WATCH) assert.ok(sitemapXml('https://reels.example').includes(`<loc>https://reels.example/watch/${name}</loc>`), name);
  });
});

describe('when a reel ends', () => {
  // the player takes what follows it on the page, if it is a .reel-end, and shows it over the last picture
  const offer = (page) => /<\/noscript>\s*<\/div>\s*<div class="reel-end" hidden>([\s\S]*?)<\/div>/.exec(page)?.[1];

  it('offers something to do next, straight after the player, out of sight until then', () => {
    for (const [name, wants] of [['home', /<a class="btn btn-gold" href="\/claude">Add Pixel Reel to Claude<\/a>/], ['reel', /<button class="btn btn-gold" type="button" data-send="Tea" data-says="#watch-sent">Send it to someone<\/button>/]]) {
      assert.match(offer(html[name]) ?? '', wants, name);
      assert.match(offer(html[name]), /<button class="btn btn-paper" type="button" data-again>Watch it again<\/button>/, name);
    }
  });

  it('offers the next reel round on an example\'s page, and never the same one', () => {
    const title = (name) => JSON.parse(readFileSync(root(`reels/${name}/reel.json`), 'utf8')).title;
    WATCH.forEach((name, i) => {
      const next = WATCH[(i + 1) % WATCH.length];
      assert.notEqual(next, name);
      assert.ok((offer(watchPage(name, 'https://reels.example')) ?? '').includes(`<a class="btn btn-gold" href="/watch/${next}">${title(next)}</a>`), `${name} leads on to ${next}`);
    });
  });
});

describe('waiting for a reel that is being made', () => {
  it('says which of the two jobs is being done, in a word for the screen and a plain sentence', () => {
    assert.deepEqual(waitingFor({ state: 'writing' }), { sign: 'WRITING', words: 'Claude is reading it and writing the scenes. This takes about half a minute.', part: 0 });
    assert.deepEqual(waitingFor({ state: 'writing', written: 0 }), waitingFor({ state: 'writing' }));
    assert.equal(waitingFor({ state: 'writing', written: 1 }).words, 'Claude is writing it: one scene so far.');
    assert.equal(waitingFor({ state: 'writing', written: 4 }).words, 'Claude is writing it: 4 scenes so far.');
    assert.deepEqual(waitingFor({ state: 'queued', ahead: 0 }), { sign: 'WRITTEN', words: 'It is written. Peter is about to record it.', part: 0.5 });
    assert.equal(waitingFor({ state: 'queued', ahead: 1 }).words, 'It is written. Peter has one reel to record first.');
    assert.equal(waitingFor({ state: 'queued', ahead: 3 }).words, 'It is written. Peter has 3 reels to record first.');
    assert.deepEqual(waitingFor({ state: 'recording', lines: 6, recorded: 0 }), { sign: 'RECORDING', words: 'Peter is recording scene 1 of 6.', part: 0.5 });
    assert.deepEqual(waitingFor({ state: 'recording', lines: 6, recorded: 3 }), { sign: 'RECORDING', words: 'Peter is recording scene 4 of 6.', part: 0.75 });
    assert.deepEqual(waitingFor({ state: 'recording', lines: 6, recorded: 9 }), { sign: 'RECORDING', words: 'Peter is recording scene 6 of 6.', part: 1 }, 'never past the last scene');
    assert.deepEqual(waitingFor({ state: 'recording' }), { sign: 'RECORDING', words: 'Peter is recording it. It will play here in a moment.', part: 0.75 }, 'a recorder that does not say how far it has got');
    assert.deepEqual(waitingFor({ state: 'unreachable' }), { sign: 'ONE MOMENT', words: 'Trying to reach Pixel Reel. One moment.', part: null });
  });

  it('fills the bar towards half way while Claude writes, and never reaches it by waiting', () => {
    const parts = [0, 5, 15, 30, 60, 600].map((waited) => waitingFor({ state: 'writing' }, waited).part);
    parts.forEach((part, i) => assert.ok(i === 0 || part > parts[i - 1], 'it only ever moves on'));
    assert.ok(parts[3] > 0.35 && parts.at(-1) < 0.5, `about ${parts[3].toFixed(2)} of the way after half a minute`);
    assert.equal(waitingFor({ state: 'writing' }, -3).part, 0);
    // each scene Claude has written moves it on for certain, however short the wait has been
    const scenes = [1, 2, 4, 6, 9].map((written) => waitingFor({ state: 'writing', written }, 1).part);
    scenes.forEach((part, i) => assert.ok(i === 0 || part >= scenes[i - 1]));
    assert.ok(scenes[0] > 0.1 && scenes[2] > 0.3 && scenes.at(-1) < 0.5, 'and still never past half way: the recording is the other half');
    assert.ok(waitingFor({ state: 'writing', written: 1 }, 600).part >= waitingFor({ state: 'writing', written: 1 }, 1).part, 'nor does it go back when the wait has been long');
  });

  it('offers a way back from a reel that could not be made', () => {
    assert.match(html.reel, /<a class="btn btn-gold" id="watch-retry" href="\/#make" hidden>Try something else<\/a>/);
  });
});

describe('passing a reel on', () => {
  const link = 'https://reels.example/r/abc';
  const copies = (works) => { const copied = []; return { copied, copy: async (text) => { copied.push(text); return works; } }; };

  it('opens the phone\'s own way of sending, with the title and the link, and says nothing more', async () => {
    const shared = [], { copied, copy } = copies(true);
    assert.equal(await sendReel('Your gas bill', link, { share: async (what) => { shared.push(what); }, copy }), 'shared');
    assert.deepEqual(shared, [{ title: 'Your gas bill', text: 'Your gas bill, as a pixel reel. Press Play.', url: link }]);
    assert.deepEqual(copied, []);
    assert.equal(sentWords('shared', link), '');
  });

  it('says nothing when they change their mind, and copies the link if sending fails', async () => {
    const stopped = Object.assign(new Error('no'), { name: 'AbortError' }), { copied, copy } = copies(true);
    assert.equal(await sendReel('A reel', link, { share: async () => { throw stopped; }, copy }), 'stopped');
    assert.deepEqual(copied, []);
    assert.equal(sentWords('stopped', link), '');
    assert.equal(await sendReel('A reel', link, { share: async () => { throw new Error('not allowed'); }, copy }), 'copied');
    assert.deepEqual(copied, [link]);
  });

  it('copies the link on a computer, and gives it in words if that cannot be done', async () => {
    assert.equal(await sendReel('A reel', link, copies(true)), 'copied');
    assert.equal(await sendReel('A reel', link, copies(false)), 'failed');
    assert.equal(sentWords('copied', link), 'Link copied. Paste it into a message.');
    assert.equal(sentWords('failed', link), `That did not copy. The link is ${link}`);
  });

  it('has its button on a reel\'s page, out of sight until the script that works it has woken', () => {
    assert.match(html.reel, /<button class="btn btn-gold" type="button" data-send="Tea" data-says="#watch-sent" hidden>Send it to someone<\/button>/);
    assert.match(html.reel, /<p class="watch-sent" id="watch-sent" role="status"><\/p>/);
  });
});

describe('the reading ruler', () => {
  it('sits with its middle on the pointer, and never off the screen', () => {
    assert.equal(rulerTop(400, 80, 800), 360);
    assert.equal(rulerTop(5, 80, 800), 0, 'at the top');
    assert.equal(rulerTop(799, 80, 800), 720, 'at the foot');
  });

  it('is on every page, out of sight and off until it is chosen in Make it comfy', () => {
    for (const name of pages) {
      assert.match(html[name], /<div class="ruler" aria-hidden="true" hidden><\/div>/, name);
      const picks = [...html[name].matchAll(/<input type="radio" name="ruler" value="([a-z]+)"( checked)?>/g)].map((found) => [found[1], Boolean(found[2])]);
      assert.deepEqual(picks, [['off', true], ['on', false]], name);
    }
    assert.match(readFileSync(root('site/css/site.css'), 'utf8'), /\.ruler \{[^}]*pointer-events: none;/, 'and nothing can press it, so it never gets in the way of a press');
  });
});

describe("Peter's pace", () => {
  it('has a slower and a quicker rate either side of the usual one', () => {
    assert.ok(PACES.slow < 1 && PACES.usual === 1 && PACES.quick > 1);
    assert.equal(rateOf('slow'), PACES.slow);
    assert.equal(rateOf(undefined), 1);
    assert.equal(rateOf('ludicrous'), 1, 'an odd name is the usual pace');
  });

  it("runs the reel's clock slower or quicker than the wall's, without a jump when the rate changes", () => {
    let wall = 1000;
    const clock = pacedClock({ now: () => wall });
    assert.equal(clock.now(), 0);
    wall += 2000;
    assert.equal(clock.now(), 2000, 'at the usual pace a second is a second');
    clock.setRate(0.5);
    assert.equal(clock.now(), 2000, 'changing the rate does not move the clock');
    wall += 2000;
    assert.equal(clock.now(), 3000, 'read at half the pace, two seconds on the wall is one of the reel');
    clock.setRate(2);
    wall += 1000;
    assert.equal(clock.now(), 5000);
    assert.equal(clock.rate, 2);
  });

  it("waits a timer's time on the reel's clock", () => {
    const waits = [], cleared = [];
    const clock = pacedClock({ now: () => 0, set: (fn, ms) => { waits.push(ms); return waits.length; }, clear: (id) => cleared.push(id) });
    clock.timer.set(() => {}, 1000);
    clock.setRate(0.8);
    const id = clock.timer.set(() => {}, 1000);
    clock.setRate(1.25);
    clock.timer.set(() => {}, 1000);
    assert.deepEqual(waits, [1000, 1250, 800]);
    clock.timer.clear(id);
    assert.deepEqual(cleared, [2]);
  });

  it('can have every word he says written under the pictures, chosen in Make it comfy', () => {
    for (const name of pages) {
      const picks = [...html[name].matchAll(/<input type="radio" name="words" value="([a-z]+)"( checked)?>/g)].map((found) => [found[1], Boolean(found[2])]);
      assert.deepEqual(picks, [['few', true], ['all', false]], name);
    }
    // the player reads the choice from <html data-words>, and writes each scene's "say" in place of its caption
    const player = readFileSync(root('site/js/player.js'), 'utf8');
    assert.match(player, /state\.muted \|\| document\.documentElement\.dataset\.words === 'all'/, 'with the sound off too, when nobody can hear him');
    for (const name of ['pixel-reel', 'gas-meter']) {
      const reel = parseReelJson(readFileSync(root(`reels/${name}/reel.json`), 'utf8'));
      assert.ok(reel.scenes.some((scene) => (scene.say ?? scene.caption).length > scene.caption.length), `${name} has more to say than its captions`);
    }
  });

  it('is chosen in Make it comfy, on every page, and starts as usual', () => {
    for (const name of pages) {
      const picks = [...html[name].matchAll(/<input type="radio" name="pace" value="([a-z]+)"( checked)?>/g)].map((found) => [found[1], Boolean(found[2])]);
      assert.deepEqual(picks, [['slow', false], ['usual', true], ['quick', false]], name);
      for (const [value] of picks) assert.ok(value in PACES, `${value} is a pace the players know`);
    }
  });
});

describe('a reel that fills the screen', () => {
  const player = playerHtml('gas-meter'), css = readFileSync(root('site/css/site.css'), 'utf8'), code = readFileSync(root('site/js/player.js'), 'utf8');

  it('has a button for it in the corner of the picture, with a name, out of sight until its script has woken', () => {
    assert.match(player, /<button class="reel-full" type="button" aria-label="Fill the screen" aria-pressed="false" hidden><svg class="ico on"[^>]*>.*?<\/svg><svg class="ico"[^>]*>.*?<\/svg><\/button>\s*<\/div>\s*<div class="reel-seek"/s);
    assert.match(code, /this\.fullKey\.hidden = false;/);
    for (const name of pages) if (html[name].includes('class="reel"')) assert.match(html[name], /class="reel-full"/, `${name}: every player has it`);
  });

  it('is laid over the whole page where the browser will not make it the whole screen, as on an iPhone', () => {
    assert.match(code, /if \(!this\.root\.requestFullscreen\) \{ over\(\); return; \}/);
    assert.match(code, /this\.root\.requestFullscreen\(\)\.then\([^;]*, over\);/, 'and where the browser refuses');
    assert.match(css, /:root \.reel\.is-filling \{ position: fixed; inset: 0; z-index: 200;/);
    assert.match(css, /html\.reel-filling \{ overflow: hidden; \}/, 'with the page under it held still');
  });

  it('gives the picture all the room its words and buttons leave, and puts the words beside the buttons on a phone on its side', () => {
    assert.match(css, /:root \.reel\.is-full \{ display: grid; grid-template-rows: minmax\(0, 1fr\) auto auto auto;/);
    assert.match(css, /\.reel\.is-full canvas \{ width: min\(100cqw, 100cqh \* 16 \/ 9\); \}/);
    assert.match(css, /@media \(max-height: 34rem\) and \(orientation: landscape\) \{\s*:root \.reel\.is-full \{ grid-template-columns: minmax\(0, 1fr\) auto;/);
  });

  it('is left with the same button, with F, or with Escape', () => {
    assert.match(code, /aria-label', on \? 'Leave full screen' : 'Fill the screen'\)/);
    assert.match(code, /e\.key\.toLowerCase\(\) === 'f' && this\.fullKey\) this\.toggleFull\(\)/);
    assert.match(code, /e\.key === 'Escape' && this\.root\.classList\.contains\('is-filling'\)/);
  });
});

describe('what a phone is told while a reel plays', () => {
  const reel = parseReelJson(readFileSync(root('reels/gas-meter/reel.json'), 'utf8')), code = readFileSync(root('site/js/player.js'), 'utf8');

  it('names the scene and the reel it is from, for the lock screen, with a picture the site serves', () => {
    const told = nowPlaying(reel, 2);
    assert.deepEqual([told.title, told.artist, told.album], [`3. ${reel.scenes[2].title}`, 'How to read your gas meter', 'Pixel Reel']);
    assert.deepEqual(told.artwork.map((picture) => picture.sizes), ['192x192', '512x512']);
    for (const picture of told.artwork) assert.ok(staticFile(picture.src), `${picture.src} is there to be shown`);
  });

  it('has the buttons on a lock screen and on headphones do what the player\'s own do', () => {
    for (const name of ['play', 'pause', 'previoustrack', 'nexttrack']) assert.ok(code.includes(`button('${name}',`), name);
    assert.match(code, /if \(!phone \|\| !window\.MediaMetadata\) return;/, 'and leaves alone a browser that has no such thing');
    assert.match(code, /this\.tellPhone\(state\);/, 'told again whenever the scene, or playing, changes');
  });
});

describe('the whole reel on one page', () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8');

  it('has, for every scene, its number, its title, its few words and the moment its picture is finished', () => {
    const source = readFileSync(root('reels/gas-meter/reel.json'), 'utf8'), manifest = JSON.parse(readFileSync(root('reels/gas-meter/audio/manifest.json'), 'utf8'));
    const show = showOf('gas-meter', source, manifest, '/reels/gas-meter/audio/'), page = sheetOf(show);
    assert.equal(page.length, show.reel.scenes.length);
    assert.deepEqual(page.map(({ n }) => n), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual([page[2].title, page[2].words], ['Read left to right', 'Write down the numbers, left to right.']);
    for (const [i, { at }] of page.entries()) assert.equal(at, show.durations[i] / 1000, 'the end of the scene, when everything in its picture has arrived');
  });

  it('is on the page a reel is watched on, out of sight until the reel is ready, with a button to print it', () => {
    for (const name of ['reel', 'watch/offside-rule']) {
      assert.match(html[name], /<section class="section sheet-part" id="sheet" aria-labelledby="sheet-title" hidden>/, name);
      assert.match(html[name], /<button class="btn btn-gold" type="button" id="sheet-print">Print it<\/button>/, name);
      assert.match(html[name], /<ol class="steps storyboard" id="sheet-list"><\/ol>/, name);
    }
    assert.ok(!html.home.includes('id="sheet"'), 'and nowhere else');
  });

  it('is the only thing on paper, black on white, with no scene cut in two by the end of a sheet', () => {
    const print = css.slice(css.indexOf('@media print {\n  .top'));
    assert.match(print, /main > :not\(\.sheet-part\), #sheet-print \{ display: none !important; \}/);
    assert.match(print, /body \{ background: #fff; color: #000; \}/);
    assert.match(print, /\.storyboard \.step \{ break-inside: avoid;/);
    assert.match(print, /\.sheet-made \{ display: block;/, 'and it says where it came from');
    assert.match(css, /\n\.sheet-made \{ display: none; \}/, 'which the screen does not');
  });
});

describe('who reads', () => {
  const others = ['anna', 'vera', 'stuart', 'charles', 'paul'];
  const home = sitePage('home', 'https://reels.example', { narrators: others }), plain = sitePage('home', 'https://reels.example');

  it('offers a card for Peter and for each narrator the service has, each to hear and to choose, Peter chosen', () => {
    const cards = [...home.matchAll(/<li class="voice">\s*<p class="voice-name">(\w+)<\/p>\s*<p class="voice-kind">([^<]+)<\/p>\s*<button class="btn btn-teal btn-small" type="button" data-hear="([a-z-]+)">Hear (\w+)<\/button>\s*<label class="voice-pick"><input type="radio" name="narrator" value="([a-z]+)"( checked)?>/g)];
    assert.deepEqual(cards.map(([, name]) => name), ['Peter', 'Anna', 'Vera', 'Stuart', 'Charles', 'Paul']);
    assert.deepEqual(cards.map(([, , , , , value]) => value), ['peter', ...others]);
    assert.deepEqual(cards.filter(([, , , , , , checked]) => checked).map(([, name]) => name), ['Peter'], 'Peter reads unless someone chooses otherwise');
    for (const [, name, kind, hello, heard, value] of cards) {
      assert.equal(heard, name);
      assert.equal(hello, NARRATORS[value].hello);
      assert.match(kind, /^A (wo)?man's voice$/);
    }
    assert.match(home, /<legend>Or choose who reads to you<\/legend>/);
    assert.match(home, /<p class="said" id="voices-said" role="status"><\/p>/, 'somewhere to say who was chosen');
  });

  it('has a hello recorded in their own voice for every narrator it knows', () => {
    for (const [narrator, { hello }] of Object.entries(NARRATORS)) {
      const { voice } = JSON.parse(readFileSync(root(`reels/${hello}/audio/manifest.json`), 'utf8'));
      assert.ok(voice.startsWith(narrator), `${hello} is read by ${voice}, not ${narrator}`);
      const first = parseReelJson(readFileSync(root(`reels/${hello}/reel.json`), 'utf8')).scenes[0];
      assert.match(first.say, new RegExp(`^Hello\\. I'm ${narratorName(narrator)}\\.`), `${hello} starts with their name`);
    }
  });

  it('offers only narrators the service has, and nothing at all where there is only Peter', () => {
    assert.equal(narratorsHtml(), '');
    assert.equal(narratorsHtml(['peter']), '');
    assert.equal(narratorsHtml(['nobody']), '');
    assert.ok(!plain.includes('id="voices"') && !plain.includes('{{voices}}'));
    const two = narratorsHtml(['stuart', 'zebedee', 'anna']);
    assert.deepEqual([...two.matchAll(/value="([a-z]+)"/g)].map(([, value]) => value), ['peter', 'stuart', 'anna']);
  });

  it('no longer says there is only Peter, but still says no voice can copy a real person', () => {
    assert.match(home, /<summary>Can someone else read it\?<\/summary>\s*<p>Yes\. Peter reads it unless you choose Anna, Vera, Stuart, Charles or Paul\. None of them can copy a real person's voice\.<\/p>/);
    assert.match(sitePage('home', 'https://reels.example', { narrators: ['anna'] }), /unless you choose Anna\. None/);
    assert.match(plain, /<summary>Can someone else read it\?<\/summary>\s*<p>Not here, yet\. Peter reads every reel\. He cannot copy a real person's voice\.<\/p>/);
    for (const page of [home, plain, html.press, html.terms]) assert.doesNotMatch(page, /one voice|only me|always the same voice/i);
    assert.match(home, /Peter reads your pixel reel, unless you would rather hear someone else\./);
    const peter = parseReelJson(readFileSync(root('reels/site-peter/reel.json'), 'utf8'));
    assert.doesNotMatch(peter.scenes.map((scene) => `${scene.title} ${scene.caption} ${scene.say}`).join(' '), /there's only me|one voice|every pixel reel/i);
  });

  it('keeps the choice on the device, and takes nothing odd from it', () => {
    const kept = new Map(), storage = { getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => kept.set(key, value), removeItem: (key) => kept.delete(key) };
    assert.equal(readNarrator(storage), null, 'Peter, until someone chooses');
    keepNarrator(storage, 'anna');
    assert.equal(kept.get(VOICE), '{"narrator":"anna"}');
    assert.equal(readNarrator(storage), 'anna');
    keepNarrator(storage, 'peter');
    assert.equal(kept.has(VOICE), false, 'choosing Peter keeps nothing');
    for (const odd of ['not json', '{"narrator":"<b>"}', '{"narrator":7}', '{"narrator":"peter"}', '[]', 'null']) {
      kept.set(VOICE, odd);
      assert.equal(readNarrator(storage), null, odd);
    }
    assert.equal(readNarrator({ getItem() { throw new Error('no storage here'); } }), null);
    assert.doesNotThrow(() => keepNarrator({ setItem() { throw new Error('full'); } }, 'anna'));
    assert.equal(narratorName('stuart'), 'Stuart');
  });

  it('has the words for Claude ask for the narrator who was chosen', () => {
    assert.equal(askFor('my gas bill', 'Anna'), 'Make me a pixel reel, read by Anna, about this: my gas bill');
    assert.equal(askFor('https://example.com/a', 'Stuart'), 'Make me a pixel reel, read by Stuart, about this page: https://example.com/a');
    assert.equal(askFor('my gas bill'), 'Make me a pixel reel about this: my gas bill', 'and say nothing of it for Peter');
    assert.equal(askFor('my gas bill', null, 'french'), 'Make me a pixel reel in French about this: my gas bill', 'and for the language that was chosen');
    assert.equal(askFor('https://example.com/a', 'Anna', 'spanish'), 'Make me a pixel reel in Spanish, read by Anna, about this page: https://example.com/a');
    assert.equal(askFor('my gas bill', 'Anna', null), 'Make me a pixel reel, read by Anna, about this: my gas bill');
    const main = readFileSync(root('site/js/main.js'), 'utf8');
    assert.ok(main.indexOf('startVoice();') < main.indexOf('startMaker();'), 'the choice is looked up before the box writes its first words');
  });

  it('names whoever is reading while a reel is recorded', () => {
    assert.equal(waitingFor({ state: 'recording', recorded: 2, lines: 6, narrator: 'Anna' }).words, 'Anna is recording scene 3 of 6.');
    assert.equal(waitingFor({ state: 'recording', narrator: 'Vera' }).words, 'Vera is recording it. It will play here in a moment.');
    assert.equal(waitingFor({ state: 'queued', ahead: 0, narrator: 'Paul' }).words, 'It is written. Paul is about to record it.');
    assert.equal(waitingFor({ state: 'queued', ahead: 2, narrator: 'Paul' }).words, 'It is written. There are 2 reels to record first.');
    assert.equal(waitingFor({ state: 'queued', ahead: 1, narrator: 'Paul' }).words, 'It is written. There is one reel to record first.');
    assert.equal(waitingFor({ state: 'recording', recorded: 0, lines: 4 }).words, 'Peter is recording scene 1 of 4.', 'Peter, when nobody is named');
    assert.equal(waitingFor({ state: 'recording', recorded: 0, lines: 4, narrator: '<b>x</b>' }).words, 'Peter is recording scene 1 of 4.', 'and nothing odd is taken for a name');
  });
});

describe('before the page is drawn', () => {
  // Runs site/js/boot.js on a pretend page. Its bar holds a name, some links that are not
  // shown, and a button that drops to a second row until the bar is at step `fitsFrom`.
  const boot = ({ saved = null, fitsFrom = 0 } = {}) => {
    const bar = {
      dataset: {},
      get children() {
        const wrapped = Number(this.dataset.tight ?? 0) < fitsFrom;
        return [{ offsetWidth: 120, offsetTop: 10, offsetHeight: 30 }, { offsetWidth: 0, offsetTop: 0, offsetHeight: 0 }, { offsetWidth: 130, offsetTop: wrapped ? 58 : 4, offsetHeight: 44 }];
      }
    };
    const page = {
      watchers: [], heard: {}, html: { dataset: {} },
      localStorage: { getItem: () => saved },
      MutationObserver: class { constructor(run) { this.run = run; page.watchers.push(this); } observe() {} disconnect() {} },
      addEventListener: (name, run) => { page.heard[name] = run; }
    };
    page.document = {
      documentElement: page.html, querySelector: (selector) => (selector === '.top-in' ? bar : null), getElementById: () => ({}),
      fonts: { addEventListener: (name, run) => { page.heard[name] = run; } }
    };
    runInNewContext(readFileSync(root('site/js/boot.js'), 'utf8'), page);
    page.watchers[0].run();   // the page has been read as far as the bar
    return { bar, page };
  };

  it('puts back the comfort settings chosen last time, and nothing odd', () => {
    assert.deepEqual(boot({ saved: '{"font":"opendyslexic","size":"3","paper":"<b>","colour":"red","pace":"slow","words":"all","ruler":"on"}' }).page.html.dataset, { font: 'opendyslexic', size: '3', pace: 'slow', words: 'all', ruler: 'on' });
    assert.deepEqual(boot({ saved: 'not json' }).page.html.dataset, {});
  });

  it('lets go of one thing at a time until the bar across the top is on one row', () => {
    assert.equal(boot().bar.dataset.tight, undefined, 'nothing goes when everything fits');
    for (const step of [1, 2, 3, 4]) assert.equal(boot({ fitsFrom: step }).bar.dataset.tight, String(step));
    assert.equal(boot({ fitsFrom: 9 }).bar.dataset.tight, '4', 'and stops at the last step');
  });

  it('fits the bar again when the room or the letters change', () => {
    const { bar, page } = boot({ fitsFrom: 2 });
    for (const again of [page.heard.resize, page.heard.loadingdone, page.watchers[1].run]) {
      bar.dataset.tight = '4';
      again();
      assert.equal(bar.dataset.tight, '2');
    }
  });

  it('has a rule in the stylesheet for every step, and the stylesheet in before it measures', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8'), layout = readFileSync(root('site/layout.html'), 'utf8');
    const steps = Number(/const STEPS = (\d+);/.exec(readFileSync(root('site/js/boot.js'), 'utf8'))[1]);
    for (let step = 2; step <= steps; step++) assert.ok(css.includes(`[data-tight="${step}"]`), `step ${step}`);
    assert.ok(css.includes('.top-in[data-tight] .top-nav'));
    assert.ok(layout.indexOf('rel="stylesheet"') < layout.indexOf('/site/js/boot.js'), 'boot.js waits for the stylesheet only if it comes first');
    // one span round the words, so the button lays them out as one run of text with its usual spaces
    assert.match(layout, /class="[^"]*top-add"[^>]*><span>Add<span class="top-add-more"> to Claude<\/span><\/span><\/a>/);
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

  it('gets a reel ready to play from its data and its recordings', () => {
    const reel = { format: 'pixelreel/1', title: 'Tea', scenes: [{ title: 'Kettle', caption: 'Boil it.', picture: { type: 'title', text: 'TEA' } }, { title: 'Cup', caption: 'Pour it.', say: 'Pour away.' }] };
    const show = showOf('tea', reel, { clips: [{ text: 'Pour away.', file: 'b.mp3', seconds: 7.5 }] }, '/r/x/audio/');
    assert.equal(show.reel.title, 'Tea');
    assert.equal(show.opens, 'title', 'it says what kind of picture it opens on');
    assert.deepEqual(show.durations, [4000, 7500], 'a recorded scene lasts as long as its clip; the other is a guess');
    assert.equal(show.clipFor(show.reel.scenes[1]).url, '/r/x/audio/b.mp3');
    assert.equal(showOf('tea', JSON.stringify(reel), null).clipFor(show.reel.scenes[1]), null, 'it takes the JSON as text too');
    assert.throws(() => showOf('bad', { title: 'No scenes' }, null), /problems/);
  });

  it('says how long a reel lasts in words', () => {
    assert.equal(lengthWords(39400), '39 seconds');
    assert.equal(lengthWords(60000), '1 minute');
    assert.equal(lengthWords(76000), '1 minute 16');
    assert.equal(lengthWords(75900), '1 minute 15', 'whole seconds, as the clock in the player counts them');
    assert.equal(lengthWords(125000), '2 minutes 5');
  });
});
