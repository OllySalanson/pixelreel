import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { textArt } from '../scripts/site-art.mjs';
import { addToClaudeLink, pageFacts, playerHtml, robotsTxt, SITE_PAGES, siteModules, sitePage, spriteSvg } from '../service/site.mjs';
import { staticFile } from '../service/static.mjs';
import { SCENES } from '../site/js/landscape.js';
import { askFor } from '../site/js/maker.js';
import { lengthWords, showOf } from '../site/js/reels.js';
import { sendReel } from '../site/js/send.js';
import { SPRITES } from '../site/js/sprites.js';
import { parseReelJson } from '../src/format.js';
import { createKit } from '../src/kit.js';
import { PALETTE } from '../src/palette.js';
import { fakeContext } from './fake-canvas.js';

const root = (path) => new URL(`../${path}`, import.meta.url);
const pages = [...Object.values(SITE_PAGES), 'not-found', 'reel-gone', 'reel'];
const forReel = { values: { reelid: 'abcdefghijklmnopqrstuv', reeltitle: 'Tea' }, title: 'Tea - Pixel Reel', path: '/r/abcdefghijklmnopqrstuv' };
const html = Object.fromEntries(pages.map((name) => [name, sitePage(name, 'https://reels.example', name === 'reel' ? forReel : {})]));

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
      for (const [, reels] of html[name].matchAll(/data-(?:reels?|hear|length)="([^"]+)"/g)) reels.split(' ').forEach((reel) => named.add(reel));
    }
    assert.ok(named.size >= 15, 'the site plays a reel for each part of the page, the examples, and the privacy and terms pages');
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

describe('passing a reel on', () => {
  const link = 'https://reels.example/r/abc';
  const copies = (works) => { const copied = []; return { copied, copy: async (text) => { copied.push(text); return works; } }; };

  it('opens the phone\'s own way of sending, with the title and the link, and says nothing more', async () => {
    const shared = [], { copied, copy } = copies(true);
    assert.equal(await sendReel('Your gas bill', link, { share: async (what) => { shared.push(what); }, copy }), '');
    assert.deepEqual(shared, [{ title: 'Your gas bill', text: 'Your gas bill, as a pixel reel. Press Play.', url: link }]);
    assert.deepEqual(copied, []);
  });

  it('says nothing when they change their mind, and copies the link if sending fails', async () => {
    const stopped = Object.assign(new Error('no'), { name: 'AbortError' }), { copied, copy } = copies(true);
    assert.equal(await sendReel('A reel', link, { share: async () => { throw stopped; }, copy }), '');
    assert.deepEqual(copied, []);
    assert.equal(await sendReel('A reel', link, { share: async () => { throw new Error('not allowed'); }, copy }), 'Link copied. Paste it into a message.');
    assert.deepEqual(copied, [link]);
  });

  it('copies the link on a computer, and gives it in words if that cannot be done', async () => {
    assert.equal(await sendReel('A reel', link, copies(true)), 'Link copied. Paste it into a message.');
    assert.equal(await sendReel('A reel', link, copies(false)), `That did not copy. The link is ${link}`);
  });

  it('has its button on a reel\'s page, out of sight until the script that works it has woken', () => {
    assert.match(html.reel, /<button class="btn btn-gold" type="button" id="watch-send" hidden>Send it to someone<\/button>/);
    assert.match(html.reel, /<p class="watch-sent" id="watch-sent" role="status"><\/p>/);
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
    assert.deepEqual(boot({ saved: '{"font":"opendyslexic","size":"3","paper":"<b>","colour":"red"}' }).page.html.dataset, { font: 'opendyslexic', size: '3' });
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
    assert.equal(lengthWords(125000), '2 minutes 5');
  });
});
