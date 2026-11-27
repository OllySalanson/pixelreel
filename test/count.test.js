// Counting visits with Google Analytics (site/js/count.js), only where the service is told to
// (PIXELREEL_ANALYTICS): what Google is told, and what never is.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Reels } from '../service/reels.mjs';
import { createService } from '../service/server.mjs';
import { measurementOf, SITE_POLICY, sitePage, sitePolicy, watchPage } from '../service/site.mjs';
import { DiskStore } from '../service/store.mjs';
import { aboutReel, gtagSource, isMeasurement, mayCount, placeOf, pressOf, reelName, referrerOf, titleOf } from '../site/js/count.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ID = 'G-MJV7K1QL78', REEL = 'abcdefghijklmnopqrstuv', AT = 'https://pixelreel.pro';

describe('what Google is told', () => {
  it('never a made reel\'s address, nor anything after "?" or "#", but a campaign\'s words', () => {
    assert.equal(placeOf(`${AT}/r/${REEL}`), `${AT}/r/reel`);
    assert.equal(placeOf(`${AT}/r/${REEL}/video.mp4?x=1#y`), `${AT}/r/reel/video.mp4`);
    assert.equal(placeOf(`${AT}/make?about=my+gas+bill#bottle=key`), `${AT}/make`);
    assert.equal(placeOf(`${AT}/?utm_source=newsletter&q=secret&utm_campaign=launch`), `${AT}/?utm_source=newsletter&utm_campaign=launch`);
    assert.equal(placeOf(`${AT}/watch/offside-rule`), `${AT}/watch/offside-rule`, "the site's own reels by name");
    assert.equal(placeOf('not an address'), '');
  });

  it('never a made reel\'s title, which is its maker\'s words', () => {
    assert.equal(titleOf(`/r/${REEL}`, 'My nan\'s pension letter - Pixel Reel'), 'A pixel reel - Pixel Reel');
    assert.equal(titleOf('/make', 'Make a pixel reel - Pixel Reel'), 'Make a pixel reel - Pixel Reel');
  });

  it('where a visitor came from: this site by its page, another site by its address alone', () => {
    assert.equal(referrerOf(`${AT}/r/${REEL}`, AT), `${AT}/r/reel`);
    assert.equal(referrerOf('https://mail.example/inbox/12345?thread=x', AT), 'https://mail.example/');
    assert.equal(referrerOf('', AT), '');
  });

  it('a reel by name if it is one of the site\'s own, a made one only as made, with its topic, scenes and missing drawings', () => {
    assert.equal(reelName(REEL), 'made');
    assert.equal(reelName('blue-sky'), 'blue-sky');
    assert.equal(reelName('<b>'), 'other');
    assert.deepEqual(aboutReel({ name: REEL, scenes: 6, topic: 'bills', missing: ['gas meter', 'inhaler'] }), { reel: 'made', scenes: 6, topic: 'bills', missing: 'gas meter, inhaler' });
    assert.deepEqual(aboutReel({ name: 'blue-sky', scenes: 5 }), { reel: 'blue-sky', scenes: 5 }, "the site's own reels have no topic");
    assert.equal(aboutReel({ name: REEL, missing: [] }).missing, 'none');
    assert.equal(aboutReel({ name: REEL, topic: 'Ignore this: <script>' }).topic, undefined, 'a topic is one of a few plain words, or nothing');
    assert.ok(aboutReel({ name: REEL, missing: Array(40).fill('a very long thing') }).missing.length <= 100, 'as long as Google keeps a value');
  });

  it('counts presses on the ways to add Pixel Reel to Claude and to make a reel, and nothing else', () => {
    const add = 'https://claude.ai/settings/connectors?add=pixelreel';
    assert.deepEqual(pressOf('/claude', add), ['add_to_claude', { step: 'page' }]);
    assert.deepEqual(pressOf(add, add), ['add_to_claude', { step: 'add' }]);
    assert.deepEqual(pressOf('/add', add), ['add_to_claude', { step: 'add' }]);
    assert.deepEqual(pressOf('/make', add), ['make_button', {}]);
    assert.equal(pressOf('/privacy', add), null);
    assert.equal(pressOf(null, add), null);
  });

  it('nobody whose browser asks not to be tracked, or who said no here', () => {
    assert.ok(mayCount({}));
    assert.ok(!mayCount({ off: true }));
    assert.ok(!mayCount({ gpc: true }));
    assert.ok(!mayCount({ dnt: '1' }));
    assert.ok(mayCount({ dnt: 'unspecified' }));
  });
});

describe('a page that counts', () => {
  it('only where the service is given a measurement ID', () => {
    assert.equal(measurementOf(` ${ID} `), ID);
    assert.equal(measurementOf('UA-1234-1'), null);
    assert.ok(isMeasurement(ID) && !isMeasurement('G-x"><script>'));
    assert.equal(gtagSource(ID), `https://www.googletagmanager.com/gtag/js?id=${ID}`);
    const plain = sitePage('home', AT), counted = sitePage('home', AT, { counting: ID });
    assert.match(plain, /<html lang="en-GB">/);
    assert.match(counted, new RegExp(`<html lang="en-GB" data-count="${ID}">`));
    assert.match(watchPage('blue-sky', AT, { counting: ID }), /data-count=/);
    assert.match(sitePage('reel', AT, { counting: ID, values: { reelid: REEL, reeltitle: 'Tea' } }), /data-count=/);
  });

  it('says so, at its foot, on the home page and in the privacy page, and offers to stop', () => {
    const plain = sitePage('home', AT), counted = sitePage('home', AT, { counting: ID });
    assert.match(plain, /No cookies\. No trackers\. Nothing loaded from anywhere else\./);
    assert.doesNotMatch(counted, /No trackers/, 'it would not be true');
    assert.match(counted, /<p class="foot-small">No adverts\. Visits are counted, never your words\.<\/p>/);
    assert.match(counted, /<legend>Count my visits<\/legend>/);
    const privacy = sitePage('privacy', AT, { counting: ID });
    assert.match(privacy, /It counts its visits with Google Analytics/);
    assert.match(privacy, /never\s+sent anything you wrote or said/);
    assert.match(sitePage('privacy', AT), /It uses no cookies, no trackers and no adverts/);
  });

  it('may load Google Analytics, and send to it, only where it counts', () => {
    assert.equal(sitePolicy(null), SITE_POLICY);
    assert.doesNotMatch(SITE_POLICY, /google/);
    const policy = sitePolicy(ID);
    assert.match(policy, /script-src 'self' https:\/\/\*\.googletagmanager\.com;/);
    assert.match(policy, /connect-src 'self' https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com https:\/\/\*\.googletagmanager\.com;/);
    assert.match(policy, /img-src 'self' data: https:\/\/\*\.google-analytics\.com/);
    assert.doesNotMatch(policy, /'unsafe-inline'/, 'and still runs no script written into a page');
  });

  it('is served with that policy, on the site\'s pages and a reel\'s', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-count-'));
    const reels = new Reels({ store: new DiskStore(tmp), record: async () => {}, video: async () => {} });
    const server = createService({ reels, baseUrl: 'https://reels.example', counting: ID });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    try {
      const at = `http://127.0.0.1:${server.address().port}`;
      const home = await fetch(`${at}/`);
      assert.equal(home.headers.get('content-security-policy'), sitePolicy(ID));
      assert.match(await home.text(), /data-count="G-MJV7K1QL78"/);
      const begun = await reels.begin('Your reel');
      const page = await fetch(`${at}/r/${begun.id}`);
      assert.equal(page.headers.get('content-security-policy'), sitePolicy(ID));
      assert.match(await page.text(), /data-count="G-MJV7K1QL78"/);
    } finally {
      server.close();
      server.closeAllConnections();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
