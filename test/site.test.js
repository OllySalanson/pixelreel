import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { textArt } from '../scripts/site-art.mjs';
import { addressMeant, addToClaudeLink, EXAMPLES, NARRATORS, narratorsHtml, pageFacts, VOICE_SOURCES, playerHtml, robotsTxt, SITE_PAGES, siteModules, sitemapXml, sitePage, spriteSvg, WATCH, watchPage } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { hopHeight, lookAt, REELIE, SAYINGS, SCENES } from '../site/js/landscape.js';
import { sentenceAt, sentencesOf } from '../site/js/follow.js';
import { createAloud, NOT_READ, pressed, READABLE, voiceFor, wordsOf } from '../site/js/aloud.js';
import { tried } from '../site/js/comfort.js';
import { askFor } from '../site/js/maker.js';
import { startMenu } from '../site/js/menu.js';
import { nowPlaying, onItsSide } from '../site/js/player.js';
import { PACES, pacedClock, rateOf } from '../site/js/pace.js';
import { qrSvg } from '../site/js/qr.js';
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
    assert.match(html.privacy, /<h1>Privacy<\/h1>\n<p class="doc-reel"><button class="btn btn-reel" type="button" data-reel="site-privacy">Make a pixel reel about this<\/button><button /);
    assert.match(html.terms, /data-reel="site-terms"/);
    assert.doesNotMatch(html.credits, /btn-reel/, 'a page with no reel of itself offers none');
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

describe('an address that is nearly right', () => {
  const isId = (id) => /^[A-Za-z0-9_-]{22}$/.test(id), id = 'aB3_efgh-jklmnopqrstuv';

  it('gives the reel that was meant, whatever was picked up after its link', () => {
    for (const tail of ['.', ',', ';', ':', '!', ')', ']', ').', '>', '"', "'", '*', '**', '_', '-', '…', ' ', '%20', '%22', '%E2%80%A6', '/', '//', './']) {
      assert.equal(addressMeant(`/r/${id}${tail}`, isId), `/r/${id}`, JSON.stringify(tail));
    }
    assert.equal(addressMeant(`/R/${id}`, isId), `/r/${id}`);
    assert.equal(addressMeant(`/r/${id}`, isId), null, 'a link that is right is left alone');
  });

  it('never changes a reel\'s id, in which capitals count, or guesses at one', () => {
    assert.equal(addressMeant(`/r/${id.toLowerCase()}.`, isId), `/r/${id.toLowerCase()}`, 'the id as it was typed: that reel, or none');
    for (const not of [`/r/${id}x`, `/r/${id}.x`, `/r/${id}_x`, `/r/${id.slice(1)}.`, `/r/.${id}`, '/r/short.', '/r/', '/r', `/r/${id}/play.json`, `/r/${id}/play.json.`, `/r/${id}/audio/x.mp3/`]) {
      assert.equal(addressMeant(not, isId), null, not);
    }
    assert.equal(addressMeant(`/r/${id}.`, () => false), null, 'what an id looks like is for the service to say');
  });

  it('gives the page that was meant, typed with capitals, something on the end, or as a file', () => {
    for (const [typed, meant] of [['/Claude', '/claude'], ['/CLAUDE', '/claude'], ['/claude/', '/claude'], ['/claude.', '/claude'], ['/claude).', '/claude'], ['/claude.html', '/claude'],
      ['/Claude.HTML', '/claude'], ['/claude/index.html', '/claude'], ['/index.html', '/'], ['/index', '/'], ['/App/', '/app'], ['/Press,', '/press'], ['/credits%20', '/credits'],
      ['/Add', '/add'], ['/add/', '/add'], ['/watch/Volcano', '/watch/volcano'], ['/watch/volcano/', '/watch/volcano'], ['/cla%75de/', '/claude']]) {
      assert.equal(addressMeant(typed, isId), meant, typed);
    }
    for (const path of [...Object.keys(SITE_PAGES), '/add', ...WATCH.map((name) => `/watch/${name}`)]) {
      assert.equal(addressMeant(path, isId), null, `${path} is right already`);
      if (path !== '/') assert.equal(addressMeant(`${path.toUpperCase()}/`, isId), path, `${path}, in capitals with a slash`);
    }
  });

  it('guesses at nothing, and only ever gives one of the site\'s own addresses', () => {
    for (const not of ['/claud', '/claudes', '/claude/x', '/x/claude', '/added', '/watch/nope/', '/watch/', '/watch/volcano/card.png', '/site/css/site.css', '/Site/CSS/site.css', '/mcp/', '/try/', '/health/', '/%E0%A4%A', '/%']) {
      assert.equal(addressMeant(not, isId), null, not);
    }
    // nothing that would send a browser somewhere else, or put a line of its own in the answer
    for (const sly of ['//evil.example/claude/', '/%2F%2Fevil.example/Claude', '/\\evil.example/claude/', '/claude%0D%0Aset-cookie:x', '/https://evil.example/claude/', `//evil.example/r/${id}.`, `/r/${id}%0D%0Ax`]) {
      assert.equal(addressMeant(sly, isId), null, sly);
    }
    assert.equal(addressMeant('/Claude%0D%0A', isId), '/claude', 'what is dropped from the end is dropped, never passed on');
    assert.equal(addressMeant(`/r/${id}%0D%0A`, isId), `/r/${id}`);
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

describe('making a reel has a page of its own', () => {
  it('is in the menu across the top and at the foot of every page', () => {
    for (const name of pages) {
      assert.match(html[name], /<nav class="top-nav" aria-label="Main">\s*<a href="\/make">Make a pixel reel<\/a>/, `${name}: first in the menu across the top`);
      assert.match(html[name], /<nav class="foot-nav"[^>]*>[\s\S]*?<a href="\/make">Make a pixel reel<\/a>/, `${name}: and at the foot`);
      assert.doesNotMatch(html[name], /href="\/?#make"/, `${name}: nothing still points at the old place on the home page`);
    }
  });

  it('is a form to fill in, with nothing on the page that plays', () => {
    assert.match(html.make, /<h1 id="make-title">Make a pixel reel<\/h1>/);
    assert.match(html.make, /<form class="maker" id="maker" action="\/claude" data-here="off">/);
    for (const id of ['maker-what', 'maker-paste', 'maker-read', 'maker-go', 'maker-photo', 'maker-choose', 'maker-file', 'mine', 'drop-over']) assert.match(html.make, new RegExp(`id="${id}"`), id);
    // the part of the page that is the page's own: the bar, the foot and the theatre are on every page
    const own = html.make.slice(html.make.indexOf('<main'), html.make.indexOf('</main>'));
    assert.ok(own.includes('id="maker"'));
    assert.doesNotMatch(own, /class="reel"|data-reels?=|<canvas/, 'no player, no reel button, no moving picture');
  });

  it('says what goes in its one big box, and has the big button straight after it', () => {
    const form = html.make.slice(html.make.indexOf('<form class="maker"'), html.make.indexOf('</form>'));
    // the box is named for the commonest thing put in it, with a picture of a link beside the words
    // (a line of words that names the box, not a label: a label cannot be pressed to be read aloud)
    assert.match(form, /<p class="maker-label" id="maker-label"><span class="tile tile-gold"><svg class="px"[^>]*>.*?<\/svg><\/span><span>Paste a link here<\/span><\/p>/);
    assert.match(form, /<textarea id="maker-what" name="about" aria-labelledby="maker-label" /);
    assert.doesNotMatch(form, /<label[^>]*for="maker-what"/);
    assert.match(form, /<textarea id="maker-what" name="about" [^>]*enterkeyhint="go" placeholder="Or type a question"><\/textarea>\s*<div class="maker-box-keys">\s*<button class="btn btn-paper maker-paste" id="maker-paste" type="button" hidden><svg class="px"[^>]*>.*?<\/svg><span>Paste<\/span><\/button>/);
    assert.match(form, /<button class="btn btn-paper maker-clear" id="maker-clear" type="button" hidden>Clear<\/button>\s*<\/div>\s*<\/div>/, 'and a way to empty the box, hidden while it is empty');
    // in the order someone meets them: the box, who reads it (one line, folded shut), the big button, then every other way in
    const order = ['id="maker-what"', 'id="maker-paste"', 'id="maker-clear"', '<details class="maker-read" id="maker-read" hidden>', 'id="maker-who"', 'id="maker-language"', 'id="maker-go"', 'id="maker-photo"', 'id="maker-choose"', 'class="tries"', 'id="maker-own-open"', 'id="ask-words"'];
    const places = order.map((part) => form.indexOf(part));
    assert.ok(places.every((at) => at >= 0), `all there: ${places}`);
    assert.deepEqual(places, [...places].sort((a, b) => a - b), 'and in that order');
    assert.doesNotMatch(form, /<details[^>]* open/, 'the choices start folded away, so there is nothing to decide before the big button');
    // one thing between the box and the button, and that is a line of words, not a row of choices
    const between = form.slice(form.indexOf('</details>'), form.indexOf('<button class="btn btn-gold btn-big" id="maker-go" type="submit">Make my reel</button>'));
    assert.ok(between.length > 20 && between.length < 400, 'the big button is where it is looked for');
    assert.doesNotMatch(between, /<button|<input|<fieldset/);
    // a photo and a PDF have a button each, which says what it does, and the chooser shows only that kind
    assert.match(form, /<button class="btn btn-paper" id="maker-photo" type="button" data-accept="image\/\*">/);
    assert.match(form, /<button class="btn btn-paper" id="maker-choose" type="button" data-accept="application\/pdf,[^"]*">.*?<span>Choose a PDF<\/span><\/button>/);
    for (const [, accept] of form.matchAll(/data-accept="([^"]*)"/g)) {
      const whole = /<input id="maker-file" type="file" accept="([^"]*)"/.exec(form)[1].split(',');
      for (const kind of accept.split(',')) assert.ok(whole.includes(kind), `${kind} is a kind the chooser takes`);
    }
  });

  it('wakes the box with everything its script looks for, and reads the clipboard only on a press', () => {
    const script = readFileSync(root('site/js/maker.js'), 'utf8');
    const looked = [...script.matchAll(/\bid\('([a-z-]+)'\)/g)].map(([, id]) => id);
    assert.ok(looked.length >= 12);
    for (const id of looked) assert.ok(html.make.includes(` id="${id}"`), `the page has nothing called ${id}`);
    assert.equal([...script.matchAll(/givenFromClipboard\(/g)].length, 1);
    assert.match(script, /paste\.addEventListener\('click', async \(\) => \{\s*let given;\s*try \{\s*given = await givenFromClipboard\(navigator\.clipboard\);/, 'inside the press, where a browser allows it');
  });

  it('leaves the home page its words about it, and a big button that goes there', () => {
    assert.doesNotMatch(html.home, /id="maker"|id="mine"|id="drop-over"/);
    assert.match(html.home, /<a class="btn btn-gold btn-big" href="\/make">Make a pixel reel<\/a>/);
    assert.match(html.home, /<p class="lead" data-here-says="[^"]{20,}">Say what you want explained\./);
    assert.match(html.home, /id="make-reel" data-reel="site-make" data-reel-here="site-make-here"/);
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
    assert.match(html.reel, /<a class="btn btn-gold" id="watch-retry" href="\/make" hidden>Try something else<\/a>/);
    // and a way back to the form from a reel that did work, shown only to whoever made it there
    assert.match(html.reel, /<a class="btn btn-paper" id="watch-another" href="\/make" hidden>Make another reel<\/a>/);
    assert.match(readFileSync(root('site/js/watch.js'), 'utf8'), /if \(holder\.dataset\.here === 'on'\) \{[^}]*if \(readMine\(mine\)\.some\(\(reel\) => reel\.id === id\)\) \{\s*document\.getElementById\('watch-another'\)\.hidden = false;[^}]*sessionStorage\.removeItem\(ASKED\)/, 'and the box it leads back to starts empty');
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
    assert.match(print, /\n {2}\.page-reel main > :not\(\.sheet-part\), \.page-watch main > :not\(\.sheet-part\), #sheet-print \{ display: none !important; \}/);
    assert.match(print, /body \{ background: #fff; color: #000; \}/);
    assert.match(print, /\.storyboard \.step \{ break-inside: avoid;/);
    assert.match(print, /\.sheet-made \{ display: block;/, 'and it says where it came from');
    assert.match(css, /\n\.sheet-made \{ display: none; \}/, 'which the screen does not');
  });
});

describe('the colour of the paper', () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8'), layout = readFileSync(root('site/layout.html'), 'utf8');
  const papers = [...layout.matchAll(/<input type="radio" name="paper" value="([a-z]+)"( checked)?><span class="p-([a-z]+)">(\w+)<\/span>/g)].map(([, value, usual, swatch, name]) => ({ value, usual: Boolean(usual), swatch, name }));
  /** How much brighter one colour is than another, as the rules for readable text count it: 1 (the same) to 21 (black on white). */
  const contrast = (a, b) => {
    const light = (hex) => {
      const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [light(a), light(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const root0 = /:root \{([^}]*)\}/.exec(css)[1];
  const coloursOf = (value) => {
    const rule = value === 'cream' ? root0 : new RegExp(`html\\[data-paper="${value}"\\] \\{([^}]*)\\}`).exec(css)?.[1];
    const colour = (name) => new RegExp(`--${name}: (#[0-9a-f]{6})`).exec(rule ?? '')?.[1] ?? new RegExp(`--${name}: (#[0-9a-f]{6})`).exec(root0)[1];
    return rule && { paper: colour('paper'), tint: colour('tint'), card: colour('card'), ink: colour('ink'), soft: colour('ink-soft') };
  };

  it('offers cream, which is the usual one, five tints and dark', () => {
    assert.deepEqual(papers.map(({ name }) => name), ['Cream', 'Blue', 'Peach', 'Mint', 'Rose', 'Lilac', 'Dark']);
    assert.deepEqual(papers.filter(({ usual }) => usual).map(({ value }) => value), ['cream']);
  });

  it('has its colours for every paper that can be chosen, and shows each choice in its own colour', () => {
    for (const { value, swatch, name } of papers) {
      const colours = coloursOf(value);
      assert.ok(colours, `${name} has no colours in the stylesheet`);
      assert.equal(swatch, value, `${name}'s swatch is its own`);
      assert.match(css, new RegExp(`\\.pick \\.p-${value} \\{ background: ${colours.paper};`), `${name}'s swatch is the colour of its paper`);
    }
  });

  it('keeps the words standing out on every paper: far more than the least that is called readable', () => {
    for (const { value, name } of papers) {
      const { paper, tint, card, ink, soft } = coloursOf(value);
      for (const [ground, called] of [[paper, 'paper'], [tint, 'tinted paper'], [card, 'a card']]) {
        assert.ok(contrast(ink, ground) >= 12, `${name}: ink on ${called} is ${contrast(ink, ground).toFixed(1)} to 1`);
        assert.ok(contrast(soft, ground) >= 6, `${name}: the quieter ink on ${called} is ${contrast(soft, ground).toFixed(1)} to 1`);
      }
    }
  });
});

describe('following the words', () => {
  const line = "It's free. There's nothing to sign up for. No account, no name, no email address.";

  it('takes a line a sentence at a time, losing nothing of it', () => {
    const sentences = sentencesOf(line);
    assert.deepEqual(sentences, ["It's free. ", "There's nothing to sign up for. ", 'No account, no name, no email address.']);
    assert.equal(sentences.join(''), line);
    assert.deepEqual(sentencesOf('It runs 2.5 times faster! Really? "Yes." Fine'), ['It runs 2.5 times faster! ', 'Really? ', '"Yes." ', 'Fine'], 'a full stop inside a number ends nothing');
    assert.deepEqual(sentencesOf('One thing'), ['One thing']);
    assert.deepEqual(sentencesOf(''), []);
    for (const name of ['gas-meter', 'pension-letter', 'site-phone']) {
      for (const scene of parseReelJson(readFileSync(root(`reels/${name}/reel.json`), 'utf8')).scenes) assert.equal(sentencesOf(scene.say).join(''), scene.say, `${name}: ${scene.title}`);
    }
  });

  it('marks each sentence for a share of the line in proportion to its letters, and the last to the end', () => {
    const sentences = sentencesOf(line);
    assert.deepEqual([0, 0.5, 1.2, 2.5, 4, 6.5, 99].map((elapsed) => sentenceAt(sentences, 6.6, elapsed)), [0, 0, 1, 1, 2, 2, 2]);
    assert.equal(sentenceAt(['One thing'], 3, 0), 0);
    assert.equal(sentenceAt(['One thing'], 3, 30), 0);
    assert.equal(sentenceAt([], 3, 1), -1, 'a line with no sentences has none to mark');
  });

  it('is done by the player only where every word is written, and never before a reel starts or after it ends', () => {
    const code = readFileSync(root('site/js/player.js'), 'utf8'), css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(code, /follow\(\) \{\s*if \(!this\.allWords\) return;/);
    assert.match(code, /const now = this\.intro \|\| ended \|\| !line\?\.children\.length \? null :/);
    assert.match(code, /paintProgress\(\) \{\s*this\.follow\(\);/, 'as often as the bar that shows where you are is drawn');
    assert.match(css, /\.reel-words span\.now \{ color: var\(--gold\); \}/);
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

  it('no longer says there is only Peter, but still says Pixel Reel cannot copy anybody else', () => {
    assert.match(home, /<summary>Can someone else read it\?<\/summary>\s*<p>Yes\. Peter reads it unless you choose Anna, Vera, Stuart, Charles or Paul\. Pixel Reel cannot copy anybody else's voice\.<\/p>/);
    assert.match(sitePage('home', 'https://reels.example', { narrators: ['anna'] }), /unless you choose Anna\. Pixel Reel/);
    assert.match(plain, /<summary>Can someone else read it\?<\/summary>\s*<p>Not here, yet\. Peter reads every reel\. Pixel Reel cannot copy anybody's voice\.<\/p>/);
    for (const page of [home, plain, html.press, html.terms]) assert.doesNotMatch(page, /one voice|only me|always the same voice/i);
    assert.match(home, /Peter reads your pixel reel, unless you would rather hear someone else\./);
    const peter = parseReelJson(readFileSync(root('reels/site-peter/reel.json'), 'utf8'));
    assert.doesNotMatch(peter.scenes.map((scene) => `${scene.title} ${scene.caption} ${scene.say}`).join(' '), /there's only me|one voice|every pixel reel/i);
  });

  it('credits where every narrator\'s voice comes from, with the licence it is used under', () => {
    const credits = html.credits;
    for (const [narrator, { from }] of Object.entries(NARRATORS)) {
      const source = VOICE_SOURCES[from];
      assert.ok(source, `${narrator} says where their voice comes from`);
      assert.ok(credits.includes(narratorName(narrator)), `the credits name ${narratorName(narrator)}`);
      assert.ok(credits.includes(source.name), `the credits name ${source.name}, where ${narratorName(narrator)}'s voice comes from`);
      assert.ok(credits.includes(source.licence), `and its licence, ${source.licence}`);
    }
    // the VCTK corpus's licence asks for credit: who made it, and a way to find it
    assert.match(credits, /Junichi Yamagishi,\s+Christophe Veaux and Kirsten MacDonald/);
    assert.match(credits, /<a href="https:\/\/doi\.org\/10\.7488\/ds\/2645">CSTR VCTK Corpus<\/a>/);
    assert.match(credits, /<a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/">CC BY 4\.0<\/a>/);
    assert.deepEqual(Object.entries(NARRATORS).filter(([, { from }]) => from === 'vctk').map(([narrator]) => narrator), ['anna', 'vera', 'charles', 'paul']);
  });

  it('never says of every narrator what is true only of some, or that a voice is not modelled on a real person', () => {
    const everywhere = [home, plain, html.press, html.terms, html.credits, html.privacy, html.claude, html.app].join(' ');
    assert.doesNotMatch(everywhere, /All are computer voices built from public domain/i, 'only Peter\'s and Stuart\'s are from public domain readings');
    assert.doesNotMatch(everywhere, /copy a real person|sound like a real person/i, 'every narrator is modelled on a real person\'s recording: what Pixel Reel cannot do is copy anyone else');
    assert.match(html.press, /All are computer voices, modelled on recordings that are free for anyone to use: <a href="\/credits">the credits<\/a> say whose\. Pixel Reel cannot be made to copy anyone else's voice\./);
    assert.match(html.terms, /The narrators are computer voices, and\s+Pixel Reel cannot be made to copy anyone else's voice\./);
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
    assert.equal(askFor('Council Tax: how it works\nhttps://www.gov.uk/council-tax'), 'Make me a pixel reel about this page: https://www.gov.uk/council-tax', 'a link copied with its headline is asked about as the link');
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
    for (const step of [1, 2, 3, 4, 5]) assert.equal(boot({ fitsFrom: step }).bar.dataset.tight, String(step));
    assert.equal(boot({ fitsFrom: 9 }).bar.dataset.tight, '5', 'and stops at the last step');
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

describe('getting the site onto a phone with no address to type', () => {
  const code = qrSvg('https://reels.example/app', { label: 'A QR code. It opens Pixel Reel on a phone.' });

  it('shows a QR code for the page about the phone, on that page and on the home page', () => {
    assert.ok(html.app.includes(code), 'in the steps for a computer');
    assert.match(html.app, /<details data-device="computer">[\s\S]*?<svg class="qr"[\s\S]*?<\/details>/);
    assert.ok(html.home.includes(`<div class="scan">\n        ${code}`), 'with a few words beside it');
    assert.match(html.home, /<h3>On a computer now\?<\/h3>\s*<p>Point your phone's camera at this square\./);
  });

  it('keeps the code with its words from a phone, which has no use for it', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(css, /\n\.scan \{ display: none;/);
    assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\n {2}\.scan \{ display: flex; \}\n\}/);
  });
});

describe('any page on paper', () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8');
  const print = css.slice(css.indexOf('@media print {\n  .top'));

  it('prints: only the page a reel is watched on is cut down to its sheet', () => {
    // the rule that hides everything but the sheet used to apply to every page, which printed blank
    assert.doesNotMatch(css, /[,{]\s*main > :not\(\.sheet-part\)/, 'never without saying which page');
    assert.match(html.reel, /<body class="page-reel">/);
    assert.match(html['watch/offside-rule'], /<body class="page-watch">/);
    for (const name of ['home', 'claude', 'privacy', 'terms', 'credits', 'press', 'app', 'make']) assert.doesNotMatch(html[name], /<body class="page-(reel|watch)">/, name);
  });

  it('leaves off what only works on a screen, and is black on white whatever paper was chosen', () => {
    assert.match(print, /\n {2}\.top, \.foot, \.skip, dialog, \.scene, \.reel, \.reel-end, button, /);
    assert.match(print, /\n {2}:root:root \{ --paper: #fff; --tint: #fff; --card: #fff; --ink: #000;/, 'over Dark paper too');
    assert.match(print, /\n {2}\.night \{ background: #fff; color: #000; \}/);
    assert.match(print, /\.doc a\[href\^="http"\]::after \{ content: ' \(' attr\(href\) '\)';/, 'and a link that leads off the site says where to');
  });

  it('opens closed questions for the printing, and closes them again after', () => {
    const main = readFileSync(root('site/js/main.js'), 'utf8');
    assert.match(main, /addEventListener\('beforeprint', \(\) => \{\s*for \(const closed of document\.querySelectorAll\('details:not\(\[open\]\)'\)\) \{ closed\.open = true; closed\.dataset\.forPaper = ''; \}/);
    assert.match(main, /addEventListener\('afterprint', \(\) => \{\s*for \(const opened of document\.querySelectorAll\('details\[data-for-paper\]'\)\) \{ opened\.open = false;/);
  });

  it('leaves out a picture that has not been drawn yet, but never the scenes under a reel', () => {
    assert.match(print, /\n {2}canvas\.shot\[data-reel\]:not\(\[data-drawn\]\) \{ display: none !important; \}/);
    assert.match(readFileSync(root('site/js/shots.js'), 'utf8'), /if \(shot\.scene\) shot\.canvas\.dataset\.drawn = '';/, 'drawn means its scene is in it');
    // the scenes under a reel are drawn by sheet.js with no data-reel, so the rule above cannot touch them
    assert.doesNotMatch(readFileSync(root('site/js/sheet.js'), 'utf8'), /dataset\.reel|data-reel/);
  });
});

describe('on a tablet, steps as many across as fit', () => {
  it('lays the three steps, and the scenes under a reel, out across the page, not down one side of it', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    const tablet = css.slice(css.indexOf('@media (max-width: 60rem) {'), css.indexOf('@media (max-width: 40rem) {'));
    assert.match(tablet, /\n {2}\.steps \{ grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 13rem\), 1fr\)\);/, 'in rem, so bigger letters take fewer across');
    assert.doesNotMatch(tablet, /\.steps \{[^}]*max-width/, 'and nothing holds them to the left half');
    assert.doesNotMatch(css.slice(css.indexOf('@media (max-width: 40rem) {')), /\n {2}\.steps \{/, 'a phone gets one across by the same rule, with no rule of its own');
  });
});

describe('on a phone, posters and narrators two across', () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 40rem) {'), css.indexOf('@media (max-width: 23.5rem) {'));

  it('lays posters out as many across as fit with their words whole, not one to a row', () => {
    assert.match(phone, /\n {2}\.posters \{ grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 9\.25rem\), 1fr\)\);/, 'in rem, so bigger letters bring it back to one');
    assert.doesNotMatch(phone, /\.posters[^{]*\{ grid-template-columns: minmax\(0, 1fr\); \}/, 'no rule left that puts them one to a row');
    assert.doesNotMatch(phone, /\.facts, \.points, \.posters/);
  });

  it('does the same for the narrators, with each card\'s buttons at its foot so that they line up along a row', () => {
    assert.match(phone, /\n {2}\.voices-list \{ --gap: 0\.5rem; grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 13ch\), 1fr\)\); \}/, 'in ch, so wider letters bring it back to one');
    assert.match(phone, /\n {2}\.voice \{ display: grid; grid-template-rows: auto 1fr auto auto;/);
    // the rows are a card's four parts, in this order
    assert.match(narratorsHtml(['anna']), /<li class="voice">\s*<p class="voice-name">[^<]+<\/p>\s*<p class="voice-kind">[^<]+<\/p>\s*<button [^>]*>[^<]+<\/button>\s*<label class="voice-pick">/);
  });
});

describe('a phone held on its side', () => {
  it('is a screen wider than it is tall, too short for a reel with its words under it, and with no mouse', () => {
    assert.equal(onItsSide({ width: 844, height: 390 }), true, 'a phone on its side');
    assert.equal(onItsSide({ width: 667, height: 375 }), true, 'a small one');
    assert.equal(onItsSide({ width: 390, height: 844 }), false, 'a phone held upright');
    assert.equal(onItsSide({ width: 1024, height: 768 }), false, 'a tablet has room');
    assert.equal(onItsSide({ width: 1280, height: 720 }), false, 'so has a computer');
    assert.equal(onItsSide({ width: 900, height: 400, mouse: true }), false, 'a small window on a computer is not a phone');
  });

  it('fills the screen with a reel in the press that plays it: the big Play button, and a reel opened over the page', () => {
    const player = readFileSync(root('site/js/player.js'), 'utf8'), theatre = readFileSync(root('site/js/theatre.js'), 'utf8');
    assert.match(player, /this\.big\.onclick = \(\) => \{ this\.start\(\); this\.fillOnItsSide\(\); \};/);
    assert.match(player, /fillOnItsSide\(\) \{\s*if \(this\.fullKey && !this\.root\.classList\.contains\('is-full'\) && onItsSide\(/, 'only where it can fill the screen, and has not already');
    assert.match(theatre, /dialog\.showModal\(\);[\s\S]*?player\.fillOnItsSide\(\);[^\n]*\n\s*play\(run, 0\);/, 'before the reel is fetched, while the press still counts');
    assert.match(theatre, /if \(player\.root\.classList\.contains\('is-full'\)\) player\.toggleFull\(\);/, 'and closing it gives the page back');
  });

  it('keeps a player in the page no taller than the screen there, so its picture and its Play button can be seen', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\) \{\n {2}\.hero-reel \.reel, \.way-watch \.reel \{ width: min\(100%, calc\(\(100svh - 6\.5rem\) \* 16 \/ 9\)\); margin-inline: auto; \}\n\}/);
  });
});

describe('the foot of every page', () => {
  it('has nine links, three across where there is room, so that none is left over', () => {
    const links = [.../<nav class="foot-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html.home)[1].matchAll(/<a href="[^"]+">([^<]+)<\/a>/g)];
    assert.equal(links.length % 3, 0, `${links.length} links: a number that makes whole rows of three`);
    assert.match(readFileSync(root('site/css/site.css'), 'utf8'), /\n\.foot-nav \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(13rem, 1fr\)\);/);
  });
});

describe('the design log', () => {
  const log = readFileSync(root('docs/site/README.md'), 'utf8');

  it('numbers its versions one after another, none twice', () => {
    // three of us add to its end, and a rebase can leave two entries under one number without any conflict
    const numbers = [...log.matchAll(/^### Version (\d+)$/gm)].map((found) => Number(found[1]));
    assert.ok(numbers.length > 50);
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
  });

  it('shows only pictures that are there', () => {
    for (const [, picture] of log.matchAll(/\]\((log\/[^)]+)\)/g)) assert.ok(existsSync(root(`docs/site/${picture}`)), picture);
  });
});

describe('what the make-one box takes, on the home page', () => {
  const gives = /<ul class="people gives">([\s\S]*?)<\/ul>/.exec(html.home)?.[1] ?? '';

  it('shows four cards under Make a pixel reel now: a link, a letter, a photo and a question', () => {
    const cards = [...gives.matchAll(/<li class="person"><span class="tile tile-[a-z]+"><svg[\s\S]*?<\/svg><\/span><div class="words"><h3>([^<]+)<\/h3><p>([^<]+)<\/p><\/div><\/li>/g)];
    assert.deepEqual(cards.map((card) => card[1]), ['A link', 'A letter', 'A photo', 'A question']);
    assert.ok(html.home.indexOf('id="make-title"') < html.home.indexOf('class="people gives"') && html.home.indexOf('class="people gives"') < html.home.indexOf('id="good"'), 'in that part of the page');
  });

  it('shows them only where the service makes the reel itself, since only there does it take all four', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(css, /\n#make:not\(\[data-here="on"\]\) \.gives \{ display: none; \}/);
    assert.match(html.home, /<section class="section section-tint" id="make" aria-labelledby="make-title" data-here="off">/, 'off unless the service says otherwise');
    assert.match(sitePage('home', 'https://reels.example', { values: { here: 'on' } }), /id="make" aria-labelledby="make-title" data-here="on">/);
  });

  it('promises nothing the make page does not take', () => {
    // each card stands for something the make page has: if one of these goes, so must its card
    assert.match(html.make, /Paste a link here/, 'a link');
    assert.match(html.make, /id="maker-choose"[^>]*data-accept="application\/pdf,text\/plain/, 'a letter, as a PDF or as writing');
    assert.match(html.make, /id="maker-photo"[^>]*data-accept="image\/\*"/, 'a photo');
    assert.match(html.make, /placeholder="Or type a question"/, 'a question');
  });
});

describe('Make it comfy, tried on the home page', () => {
  const part = html.home.slice(html.home.indexOf('<section class="section" id="comfy"'), html.home.indexOf('<section class="section night cinema" id="examples"'));
  const tiles = [...part.matchAll(/<li( data-needs-speech hidden)?><button class="comfy-try" type="button" data-comfy-try="([a-z]+):([a-z0-9]+)" aria-pressed="false">[\s\S]*?<span class="comfy-words">([^<]+)<\/span><span class="comfy-on" aria-hidden="true">On<\/span><\/button><\/li>/g)];

  it('has a part of its own, between who it is for and the examples, with its reel', () => {
    assert.ok(part.length > 0, 'it is there, and before the examples');
    assert.ok(html.home.indexOf('id="who"') < html.home.indexOf('id="comfy"'));
    assert.match(part, /<h2 id="comfy-title">Hard on the eyes\? Change it\.<\/h2>/);
    assert.match(part, /<button class="btn btn-reel" type="button" data-reel="site-comfy">Make a pixel reel about this<\/button>/);
    assert.match(html.home, /data-reels="[^"]*site-who site-comfy site-peter[^"]*"/, 'and Watch this whole page plays it in its place');
  });

  it('offers six choices as big buttons, each one a choice that Make it comfy really has', () => {
    assert.deepEqual(tiles.map((tile) => tile[4]), ['Bigger letters', 'Letters made for dyslexia', 'Dark paper', 'A ruler to keep your place', 'Hear any words you press', 'A slower voice']);
    for (const [, , key, value, words] of tiles) {
      assert.match(html.home, new RegExp(`<input type="radio" name="${key}" value="${value}"(?! checked)>`), `${words}: ${key} can be ${value}, and is not already`);
    }
    assert.deepEqual(tiles.filter((tile) => tile[1]).map((tile) => tile[3] + tile[2]), ['onaloud'], 'the one that needs a voice is out of sight where the browser has none');
  });

  it('leaves the make page\'s own "Or try one of these" buttons alone', () => {
    // Both once answered to data-try, so Make it comfy took the make page's four buttons for
    // its own and told a screen reader that each was a button that had been pressed.
    const tries = [...html.make.matchAll(/<button type="button" data-try="([^"]+)">/g)];
    assert.ok(tries.length >= 4, 'the make page still has them');
    for (const [button] of tries) assert.doesNotMatch(button, /aria-pressed/);
    const comfort = readFileSync(root('site/js/comfort.js'), 'utf8');
    assert.match(comfort, /querySelectorAll\('button\[data-comfy-try\]'\)/);
    assert.doesNotMatch(comfort, /\[data-try\]|dataset\.try\b/, 'Make it comfy looks only for buttons of its own');
    for (const name of pages) if (name !== 'home') assert.doesNotMatch(html[name], /data-comfy-try/, name);
  });

  it('keeps the buttons out of sight until the script that works them is there', () => {
    assert.match(part, /<ul class="comfy-list" data-comfy hidden>/);
    assert.match(part, /<div class="row comfy-more" data-comfy hidden>\s*<button class="btn btn-paper" type="button" data-open="comfort">See every choice<\/button>/);
    assert.match(readFileSync(root('site/js/comfort.js'), 'utf8'), /querySelectorAll\('\[data-comfy\]'\)\) part\.hidden = false;/);
  });

  it('switches a choice on with one press, and puts it back with the next', () => {
    assert.equal(tried({ size: '1', paper: 'cream' }, 'size', '2'), '2');
    assert.equal(tried({ size: '2', paper: 'cream' }, 'size', '2'), '1', 'back to the usual size');
    assert.equal(tried({ size: '3' }, 'size', '2'), '2', 'from another choice it goes to the one on the button');
    assert.equal(tried({ paper: 'blue' }, 'paper', 'night'), 'night');
    assert.equal(tried({ paper: 'night' }, 'paper', 'night'), 'cream');
    assert.equal(tried({ aloud: 'on' }, 'aloud', 'on'), 'off');
  });

  it('shows which choices are in force, and says aloud that words can now be pressed however that was chosen', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(css, /\n\.comfy-try\[aria-pressed="true"\] \{ background: var\(--gold\);/);
    assert.match(css, /\n\.comfy-try\[aria-pressed="true"\] \.comfy-on \{ display: block; \}/, 'in words as well as in colour');
    assert.match(readFileSync(root('site/js/comfort.js'), 'utf8'), /addEventListener\('comfort', show\);/, 'a change made in the panel shows on the buttons too');
    assert.match(readFileSync(root('site/js/aloud.js'), 'utf8'), /if \(now && !was\) \{ hush\(\); aloud\.say\('On\. Press any words to hear them\.'/);
  });
});

describe('press words to hear them', () => {
  // a pretend part of a page: text, or an element with children
  const text = (data) => ({ nodeType: 3, data });
  const el = (tagName, children = [], { hidden = false, attrs = {}, classes = [] } = {}) => ({
    nodeType: 1, tagName, hidden, childNodes: children.map((child) => (typeof child === 'string' ? text(child) : child)),
    getAttribute: (name) => attrs[name] ?? null, classList: { contains: (name) => classes.includes(name) }
  });

  it('reads what can be seen, in order, and stops for breath after a heading with no full stop', () => {
    const card = el('LI', [el('SPAN', [el('SVG', ['a picture'])]), el('DIV', [el('H3', ['Reading is hard work']), el('P', ['Dyslexia, or just   tired eyes.\n Let the reel do the reading.'])])]);
    assert.equal(wordsOf(card), 'Reading is hard work. Dyslexia, or just tired eyes. Let the reel do the reading.');
    assert.equal(wordsOf(el('H1', ['Watch it. ', el('SPAN', ["Don't read it."])])), "Watch it. Don't read it.");
    assert.equal(wordsOf(el('SUMMARY', ['Does it cost anything?'])), 'Does it cost anything?', 'a question keeps its own mark');
  });

  it('leaves out what is hidden, what is only for a screen reader or only a picture, and the words on buttons', () => {
    const part = el('P', [
      'Rather not read the rest? ', el('BUTTON', ['Watch this whole page']), el('SPAN', ['unseen'], { hidden: true }), el('SPAN', ['for show'], { attrs: { 'aria-hidden': 'true' } }),
      el('SPAN', ['said to a screen reader'], { classes: ['sr-only'] }), el('LABEL', [el('INPUT'), el('SPAN', ['Choose'])]), el('A', ['Show me how'])
    ]);
    assert.equal(wordsOf(part), 'Rather not read the rest? Show me how.');
    assert.equal(wordsOf(el('P', [el('CANVAS')])), '');
  });

  // a pretend press: what was pressed, and what is round it
  const target = ({ inside = [], block = null }) => ({ closest: (selector) => (selector === NOT_READ ? (inside.length ? {} : null) : selector === READABLE ? block : null) });
  const block = (tagName, words, more = {}) => ({ ...el(tagName, [words]), matches: (selector) => selector === 'summary' && tagName === 'SUMMARY', closest: () => null, ...more });

  it('reads the nearest heading, paragraph or line round a press', () => {
    const p = block('P', 'It is free.');
    assert.deepEqual(pressed(target({ block: p })), { block: p, words: 'It is free.' });
    assert.equal(pressed(target({})), null, 'a press on nothing with words');
    assert.equal(pressed(null), null);
  });

  it('leaves alone what does something of its own when pressed, the players, and what is not for reading', () => {
    assert.equal(pressed(target({ inside: ['button'], block: block('P', 'x') })), null);
    assert.equal(pressed(target({ block: block('P', 'in a dialog', { closest: (selector) => (selector === NOT_READ ? {} : null) }) })), null, 'words inside something that is left alone');
    for (const kind of ['a', 'button', 'label', 'input', '.reel', 'dialog', '[aria-hidden="true"]']) assert.ok(NOT_READ.split(', ').includes(kind), kind);
    for (const kind of ['h1', 'h2', 'h3', 'p', 'li', 'summary']) assert.ok(READABLE.split(', ').includes(kind), kind);
  });

  it('reads a question and its answer when the press opens it, and has no words for the press that closes it', () => {
    const details = { ...el('DETAILS', [el('SUMMARY', ['Does it cost anything?']), el('P', ['No. It is free.'])]), open: false };
    const question = block('SUMMARY', 'Does it cost anything?', { parentElement: details });
    assert.deepEqual(pressed(target({ block: question })), { block: details, words: 'Does it cost anything? No. It is free.' });
    details.open = true;
    assert.deepEqual(pressed(target({ block: question })), { block: details, words: '' });
  });

  it('reads the make page\'s line about who reads, without the choices it opens', () => {
    const choice = (name) => el('LABEL', [el('INPUT'), el('SPAN', [name])]);
    const details = { ...el('DETAILS', [
      el('SUMMARY', [el('SPAN', ['Read by ', el('B', ['Peter']), ' in ', el('B', ['English'])])]),
      el('FIELDSET', [el('LEGEND', ['Read by']), choice('Peter'), choice('Anna')]),
      el('FIELDSET', [el('LEGEND', ['Read it to me in']), choice('English'), choice('Français')])
    ]), open: false };
    const line = block('SUMMARY', 'Read by Peter in English', { parentElement: details });
    assert.deepEqual(pressed(target({ block: line })), { block: details, words: 'Read by Peter in English.' });
    // and the name of its box is words that can be pressed, where a label could not
    const page = sitePage('make', 'https://reels.example');
    assert.match(page, /<p class="maker-label" id="maker-label">/);
    assert.equal(wordsOf(el('P', [el('SPAN', [el('SVG', ['a link'])]), el('SPAN', ['Paste a link here'])])), 'Paste a link here.');
  });

  it('takes a voice in the page\'s own language, or one of the same tongue, or leaves it to the device', () => {
    const voices = [{ lang: 'fr-FR' }, { lang: 'en-US' }, { lang: 'en_GB' }];
    assert.equal(voiceFor(voices, 'en-GB'), voices[2], 'some devices write en_GB');
    assert.equal(voiceFor(voices.slice(0, 2), 'en-GB'), voices[1]);
    assert.equal(voiceFor([{ lang: 'fr-FR' }], 'en-GB'), null);
  });

  // a pretend voice: it keeps what it is given to say, and `end()` has it finish the last of them
  const voice = () => {
    const speech = { said: [], cancelled: 0, getVoices: () => [{ lang: 'en-GB', name: 'Daniel' }], speak(u) { this.said.push(u); }, cancel() { this.cancelled++; } };
    class Utterance { constructor(words) { this.text = words; } }
    const changes = [], timers = [];
    const aloud = createAloud({ speech, Utterance, rate: () => 1.25, onChange: (about) => changes.push(about), timer: { set: (fn, ms) => timers.push({ fn, ms }) - 1, clear: (id) => { timers[id].cleared = true; } } });
    return { speech, aloud, changes, timers };
  };

  it('says the words a sentence at a time, in a British voice, at the pace chosen in Make it comfy', () => {
    const { speech, aloud, changes } = voice();
    aloud.say('That is a pixel reel. No waffle. Just the bits that matter.', 'a paragraph');
    assert.deepEqual(speech.said.map((u) => u.text), ['That is a pixel reel.', 'No waffle.', 'Just the bits that matter.']);
    for (const u of speech.said) assert.deepEqual([u.lang, u.voice.name, u.rate], ['en-GB', 'Daniel', 0.95 * 1.25]);
    assert.deepEqual(changes, ['a paragraph']);
    assert.equal(aloud.about, 'a paragraph');
    assert.equal(aloud.sentences, 3, 'and holds on to them until they are said');
  });

  it('is over when the last sentence has been said, and not before', () => {
    const { speech, aloud, changes, timers } = voice();
    aloud.say('One. Two.', 'a line');
    assert.equal(speech.said[0].onend, undefined);
    speech.said[1].onend();
    assert.deepEqual(changes, ['a line', null]);
    assert.deepEqual([aloud.about, aloud.sentences], [null, 0]);
    assert.ok(timers[0].cleared, 'and stops waiting');
  });

  it('stops when told to, and takes no notice when the voice it stopped says it has finished', () => {
    const { speech, aloud, changes } = voice();
    aloud.say('One. Two.', 'the first');
    const old = speech.said[1];
    aloud.say('Three.', 'the second');
    assert.deepEqual(changes, ['the first', null, 'the second']);
    old.onend();
    old.onerror();
    assert.equal(aloud.about, 'the second', 'still reading the second');
    aloud.stop();
    assert.deepEqual(changes, ['the first', null, 'the second', null]);
    aloud.stop();
    assert.equal(changes.length, 4, 'stopping twice says so once');
  });

  it('gives up marking the words if a voice fails, or never says that it has finished', () => {
    const failing = voice();
    failing.aloud.say('One. Two.', 'a line');
    failing.speech.said[0].onerror();
    assert.equal(failing.aloud.about, null);
    const silent = voice();
    silent.aloud.say('One. Two.', 'a line');
    assert.ok(silent.timers[0].ms > 1000, 'it waits a good while first');
    silent.timers[0].fn();
    assert.deepEqual(silent.changes, ['a line', null]);
  });

  it('reads several things one after another, all handed over in the one press, and says which it has come to', () => {
    const { speech, aloud, changes } = voice();
    aloud.sayAll([{ words: 'Privacy', about: 'the heading' }, { words: 'It keeps little. For a short time.', about: 'a paragraph' }, { words: '  ', about: 'nothing' }, { words: 'Questions', about: 'the last' }]);
    assert.deepEqual(speech.said.map((u) => u.text), ['Privacy', 'It keeps little.', 'For a short time.', 'Questions'], 'a browser may refuse a voice that starts later than the press');
    assert.deepEqual(changes, ['the heading']);
    assert.deepEqual(speech.said.map((u) => typeof u.onstart), ['undefined', 'function', 'undefined', 'function'], 'only the first sentence of a later part says so');
    speech.said[1].onstart();
    assert.deepEqual([changes.at(-1), aloud.about], ['a paragraph', 'a paragraph']);
    speech.said[3].onstart();
    assert.equal(aloud.about, 'the last');
    assert.equal(speech.said[2].onend, undefined, 'it is not over until the last of them');
    speech.said[3].onend();
    assert.deepEqual(changes, ['the heading', 'a paragraph', 'the last', null]);
  });

  it('takes no notice of a part starting once it has been stopped, or once something else is being read', () => {
    const { speech, aloud, changes } = voice();
    aloud.sayAll([{ words: 'One.', about: 'first' }, { words: 'Two.', about: 'second' }]);
    const late = speech.said[1];
    aloud.stop();
    late.onstart();
    assert.deepEqual(changes, ['first', null]);
    aloud.say('Three.', 'third');
    late.onstart();
    assert.equal(aloud.about, 'third');
  });

  it('offers to read the whole page on the plain pages and the pages of steps, out of sight where the browser has no voice', () => {
    const read = '<button class="btn btn-paper" type="button" data-read-page data-needs-speech hidden>Read this page to me</button>';
    for (const name of ['privacy', 'terms']) assert.ok(html[name].includes(`Make a pixel reel about this</button>${read}</p>`), `${name}: beside its reel`);
    assert.ok(html.credits.includes(`<p class="doc-reel">${read}</p>`), 'credits: on its own, since it has no reel');
    for (const name of ['claude', 'app']) assert.match(html[name], new RegExp(`<div class="row">\\s*<button class="btn btn-reel"[^>]*>Make a pixel reel about this</button>\\s*${read.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</div>`), name);
    assert.ok(!html.home.includes('data-read-page'), 'the home page has Watch this whole page');
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(css, /\n\.doc \.doc-reel:not\(:has\(> :not\(\[hidden\]\)\)\) \{ display: none; \}/, 'and leaves no gap where it is not shown');
  });

  it('reads a page in the parts a press would read, with each question and its answer together', () => {
    const aloud = readFileSync(root('site/js/aloud.js'), 'utf8');
    assert.match(aloud, /if \(block\.closest\(NOT_READ\) \|\| block\.closest\('\[hidden\]'\) \|\| block\.offsetParent === null\) continue;/, 'nothing that is not for reading, or not on show');
    assert.match(aloud, /if \(!question && \(block\.closest\('details'\) \|\| block\.querySelector\(READABLE\)\)\) continue;/, 'an answer goes with its question, and a card is read part by part');
    assert.match(aloud, /button\.textContent = wholePage \? 'Stop reading' : 'Read this page to me';/);
    assert.match(aloud, /if \(wholePage\) block\.scrollIntoView\(/, 'and what it is reading is kept in sight');
  });

  it('tells the voice to stop only when it is talking or has more waiting', () => {
    const quiet = voice();
    Object.assign(quiet.speech, { speaking: false, pending: false });
    quiet.aloud.say('One.', 'a line');
    assert.equal(quiet.speech.cancelled, 0, 'nothing was being said: nothing to stop');
    assert.equal(quiet.speech.said.length, 1);
    quiet.speech.speaking = true;
    quiet.aloud.say('Two.', 'another');
    assert.ok(quiet.speech.cancelled > 0, 'the first is stopped for the second');
    const waiting = voice();
    Object.assign(waiting.speech, { speaking: false, pending: true });
    waiting.aloud.say('One.', 'a line');
    assert.ok(waiting.speech.cancelled > 0, 'something was waiting to be said');
  });

  it('says nothing for no words', () => {
    const { speech, aloud, changes } = voice();
    aloud.say('   ', 'nothing');
    assert.deepEqual([speech.said.length, changes.length], [0, 0]);
  });

  it('is a choice in Make it comfy on every page, out of sight where the browser has no voice, and off until it is chosen', () => {
    for (const name of pages) {
      const choice = /<fieldset class="pick" data-needs-speech hidden>([\s\S]*?)<\/fieldset>/.exec(html[name])?.[1] ?? '';
      assert.match(choice, /<legend>Press words to hear them<\/legend>/, name);
      const picks = [...choice.matchAll(/<input type="radio" name="aloud" value="([a-z]+)"( checked)?>/g)].map((found) => [found[1], Boolean(found[2])]);
      assert.deepEqual(picks, [['off', true], ['on', false]], name);
      assert.match(choice, /In your device's own voice, not Peter's\./, `${name}: and it says whose voice it is`);
    }
    assert.match(readFileSync(root('site/js/boot.js'), 'utf8'), /'ruler', 'aloud'\]/, 'it is put back before the page is drawn');
    assert.match(readFileSync(root('site/js/comfort.js'), 'utf8'), /aloud: 'off'/);
  });

  it('shows a hand over words that a press reads, and marks what is being read', () => {
    const css = readFileSync(root('site/css/site.css'), 'utf8');
    assert.match(css, /\nhtml\[data-aloud="on"\] :is\(h1, h2, h3, p, li, summary, dt, dd, figcaption\):not\([^{]*\) \{ cursor: pointer; \}/, 'which is also what has a phone send the press');
    assert.match(css, /\n\.is-aloud \{ outline: var\(--u\) solid var\(--gold-lip\);/);
  });
});

describe('adding it to Claude from a phone', () => {
  it('tells someone on a phone that a computer is easier at the first step, under the big button, not at the foot of the page', () => {
    const first = html.claude.slice(html.claude.indexOf('<li class="walk-step">'), html.claude.indexOf('</li>', html.claude.indexOf('<li class="walk-step">')));
    assert.match(first, /Open Claude and add it<\/a>[\s\S]*<div class="walk-note" data-on-phone hidden>[\s\S]*<strong>On a phone\?<\/strong> It is easiest to add it on a computer\./);
    assert.match(first, /<\/div>\s*<canvas class="shot"/, "and the step's picture is still the step's");
    assert.match(html.claude, /<li data-not-phone><svg[\s\S]*?<\/svg><p><strong>On a phone\?<\/strong>/, 'the note at the foot is for someone who is not on one');
    const app = readFileSync(root('site/js/app.js'), 'utf8');
    assert.match(app, /querySelectorAll\('\[data-on-phone\]'\)\) part\.hidden = device === 'computer';/);
    assert.match(app, /querySelectorAll\('\[data-not-phone\]'\)\) part\.hidden = device !== 'computer';/);
  });

  it('offers to send the page to their computer, with words that say what the page is', async () => {
    assert.match(html.claude, /<button class="btn btn-paper btn-small" type="button" data-send="Add Pixel Reel to Claude" data-words="How to add Pixel Reel to Claude\. It takes about a minute\." data-says="#claude-sent" hidden>Send it to my computer<\/button>\s*<p class="said" id="claude-sent" role="status"><\/p>/);
    const shared = [];
    assert.equal(await sendReel('Add Pixel Reel to Claude', 'https://reels.example/claude', { share: async (what) => { shared.push(what); }, words: 'How to add Pixel Reel to Claude.' }), 'shared');
    assert.deepEqual(shared, [{ title: 'Add Pixel Reel to Claude', text: 'How to add Pixel Reel to Claude.', url: 'https://reels.example/claude' }], 'not "as a pixel reel. Press Play.", which it is not');
    assert.match(readFileSync(root('site/js/send.js'), 'utf8'), /words: button\.dataset\.words \?\? null/);
  });
});

describe('every page is put together whole', () => {
  it('closes everything it opens', () => {
    const tags = ['div', 'section', 'ul', 'ol', 'li', 'p', 'button', 'a', 'span', 'nav', 'figure', 'details', 'summary', 'dialog', 'form', 'fieldset', 'label', 'h1', 'h2', 'h3', 'svg', 'canvas', 'main', 'header', 'footer'];
    for (const name of pages) {
      for (const tag of tags) {
        const opened = (html[name].match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length, closed = (html[name].match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
        assert.equal(opened, closed, `${name}: <${tag}> opened ${opened} times and closed ${closed}`);
      }
    }
  });
});

describe('on Dark paper, which is chosen so that nothing dazzles', () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8');

  it('dims the letter that is there to be hard to read, which was the one white thing on the page', () => {
    assert.match(css, /\n\.letter \{[^}]*--sheet: #fffefa;[^}]*background: var\(--sheet\);/);
    assert.match(css, /\nhtml\[data-paper="night"\] \.letter \{ --sheet: #c9c5b4;/);
    assert.match(css, /\.letter::after \{[^}]*linear-gradient\(var\(--sheet-clear\), var\(--sheet\) 85%\)/, 'and it fades out into the same colour');
  });

  it('gives the picture of a phone a light edge, since the phone is nearly black', () => {
    const rule = /\nhtml\[data-paper="night"\] \.handset \.px \{ filter: ([^}]*) \}/.exec(css)?.[1] ?? '';
    assert.equal(rule.split('var(--line))').length - 1, 4, 'an edge on each of its four sides');
  });
});

describe("a reel's own QR code", () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8');
  const label = 'A QR code. It opens this page on a phone.';

  it("is on the page a reel is watched on, and opens that reel's own address", () => {
    assert.ok(html.reel.includes(`<div class="scan sheet-scan">\n        ${qrSvg('https://reels.example/r/abcdefghijklmnopqrstuv', { label })}`), 'a made reel');
    assert.ok(html['watch/offside-rule'].includes(`<div class="scan sheet-scan">\n        ${qrSvg('https://reels.example/watch/offside-rule', { label })}`), "one of the site's own");
    for (const name of ['reel', 'watch/offside-rule']) {
      assert.match(html[name], /<h3 class="on-screen">Watch it on your phone<\/h3>\s*<p class="on-screen">Point its camera at this square\.<\/p>/, name);
      assert.match(html[name], /<p class="on-paper">To hear it read out, point a phone's camera at this square\.<\/p>/, name);
    }
  });

  it('says on paper until when a made reel can be heard, and nothing of the kind for a reel of the site\'s own', () => {
    assert.match(html.reel, /<p class="on-paper" id="sheet-until" hidden>It works until <span><\/span>\.<\/p>/);
    assert.doesNotMatch(html['watch/offside-rule'], /sheet-until/);
    assert.match(readFileSync(root('site/js/watch.js'), 'utf8'), /getElementById\('sheet-until'\)/, 'the page a reel is watched on fills in the day');
  });

  it('always shows on the printed page, with the words for paper and not the words for a screen', () => {
    const print = css.slice(css.indexOf('@media print {\n  .top'));
    assert.match(print, /\.sheet-scan:has\(\.qr\) \{ display: flex;/);
    assert.match(print, /\.on-screen \{ display: none; \}/);
    assert.match(print, /\.on-paper:not\(\[hidden\]\) \{ display: block; \}/, 'but not a line that has nothing to say yet');
    assert.match(css.slice(0, css.indexOf('@media print {\n  .top')), /\n\.on-paper \{ display: none; \}/);
  });

  it('is made only for a page that shows one', () => {
    for (const name of ['claude', 'make', 'privacy', 'press']) assert.doesNotMatch(html[name], /class="qr"/, name);
  });

  it('is left out, words and all, where the address is too long to make a code of', () => {
    const long = `https://${'a-very-long-name-for-a-service.'.repeat(4)}example`;
    const page = sitePage('reel', long, forReel);
    assert.doesNotMatch(page, /class="qr"/);
    assert.match(page, /<div class="scan sheet-scan">\s*<div class="words">/, 'the page is still made');
    assert.match(css, /\n\.scan:not\(:has\(\.qr\)\) \{ display: none; \}/);
    assert.match(sitePage('home', long), /<div class="scan">\s*<div class="words">/, 'and so is the home page');
  });
});

describe('the menu, where the bar has no room for its links', () => {
  const css = readFileSync(root('site/css/site.css'), 'utf8');
  const SVG = '<svg class="px"[^>]*>[\\s\\S]*?</svg>';
  const menuOf = (page) => /<dialog class="menu" id="menu"[^>]*>([\s\S]*?)<\/dialog>/.exec(page)?.[1] ?? '';

  it('has a Menu button on every page, shown only when the links are not', () => {
    for (const name of pages) assert.match(html[name], /<button class="top-menu" type="button" data-open="menu" aria-haspopup="dialog">Menu<\/button>/, name);
    assert.match(css, /\n\.top-menu \{ display: none; \}/, 'out of sight while the links have room');
    assert.match(css, /\.top-in\[data-tight\] \.top-menu \{ display: inline-flex; \}/, 'there when boot.js lets go of the links');
    // every rule that hides the links for a width of screen shows the button in the same breath
    const hidden = [...css.matchAll(/\n {2}\.top-nav \{ display: none; \}\n( {2}\.top-menu \{ display: inline-flex; \})?/g)];
    assert.ok(hidden.length > 0);
    for (const found of hidden) assert.ok(found[1], 'the links are hidden and nothing takes their place');
  });

  it('holds every link the bar has, and more, each with a picture and its words', () => {
    for (const name of pages) {
      const menu = menuOf(html[name]), bar = /<nav class="top-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html[name])[1];
      const links = [...bar.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
      assert.ok(links.length >= 4, name);
      for (const [, href, words] of links) assert.match(menu, new RegExp(`<a href="${href}">${SVG}<span>${words}</span></a>`), `${name}: ${words}`);
      assert.match(menu, new RegExp(`<a href="/">${SVG}<span>Home</span></a>`), name);
      assert.match(menu, new RegExp(`<a href="/app" data-not-app>${SVG}<span>Add to your phone</span></a>`), `${name}: not for someone who already has it there`);
      assert.match(menu, /<a class="btn btn-gold btn-big" href="\/claude">Add Pixel Reel to Claude<\/a>/, name);
    }
  });

  it('holds Make it comfy, since the bar lets go of that button last of all', () => {
    assert.match(menuOf(html.home), /<button type="button" data-open="comfort"><span class="aa" aria-hidden="true">Aa<\/span><span>Make it comfy<\/span><\/button>/);
    assert.ok(css.includes('.top-in[data-tight="5"] .top-comfort { display: none; }'));
    assert.match(css, /:where\(\.menu-list > \*\) \{ display: flex; \}/, 'a row that is no use on a home screen can still be hidden');
  });

  // a pretend page: a Menu button, and a dialog with a link, a button and some words in it
  const pretend = () => {
    const heard = {}, dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; }, addEventListener: (name, run, onTheWayDown) => { heard[name] = run; heard.onTheWayDown = onTheWayDown; } };
    const opener = { addEventListener: (name, run) => { opener.press = run; } };
    startMenu({ getElementById: (id) => (id === 'menu' ? dialog : null), querySelectorAll: (selector) => (selector === '[data-open="menu"]' ? [opener] : []) });
    const inside = (pressable) => ({ closest: (selector) => (selector === 'a, button' && pressable ? {} : null) });
    return { dialog, opener, heard, inside };
  };

  it('opens on a press of the button', () => {
    const { dialog, opener } = pretend();
    opener.press();
    assert.equal(dialog.open, true);
  });

  it('closes when anything in it is pressed, or the dimmed page beside it, and not for a press on its words', () => {
    const { dialog, opener, heard, inside } = pretend();
    opener.press();
    heard.click({ target: inside(false) });
    assert.equal(dialog.open, true, 'a press on the heading leaves it open');
    heard.click({ target: inside(true) });
    assert.equal(dialog.open, false, 'a link or a button');
    opener.press();
    heard.click({ target: dialog });
    assert.equal(dialog.open, false, 'the dimmed page');
    assert.equal(heard.onTheWayDown, true, 'and it has closed before Make it comfy hears the press and opens');
  });

  it('does nothing on a page with no menu', () => {
    assert.doesNotThrow(() => startMenu({ getElementById: () => null, querySelectorAll: () => [] }));
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
