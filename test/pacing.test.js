import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fitPace, pacePicture, paceReel, spokenAt, spokenWords } from '../service/pacing.mjs';

const near = (got, want, by, what) => assert.ok(Math.abs(got - want) <= by, `${what}: ${got} is not within ${by} of ${want}`);
const times = (picture, count) => Array.from({ length: count }, (_, i) => picture.start + i * picture.every);

describe('timing pictures to the voice', () => {
  it('knows roughly how far through a line each word is said, pauses included', () => {
    const words = spokenWords('First, find it. Gas meters often live outside.');
    assert.deepEqual(words.map((w) => w.word), ['first', 'find', 'it', 'gas', 'meter', 'often', 'live', 'outside']);
    assert.equal(words[0].at, 0);
    assert.ok(words.every((w, i) => i === 0 || w.at > words[i - 1].at), 'each word is later than the one before');
    assert.ok(words[3].at - words[2].at > 2 * (words[2].at - words[1].at), 'the full stop after "it" takes longer than saying "find"');
    assert.ok(words.at(-1).at < 1);
    assert.deepEqual(spokenWords(''), []);
  });

  it('finds when each label is said, by its telling words, in order', () => {
    const say = 'First, find it. Gas meters often live in a box outside, in the hall, or under the stairs.';
    const [outside, stairs, shed] = spokenAt(['Outside', 'Under the stairs', 'In the shed'], say, 6);
    near(outside, 3.3, 0.5, 'outside');
    near(stairs, 5, 0.7, 'under the stairs');
    assert.equal(shed, null, 'a label nobody says has no time');
    assert.deepEqual(spokenAt(['30 days', 'Then gone'], 'After thirty days, it is gone.', 4).map((t) => t !== null), [true, true], 'a number matches its word');
    assert.deepEqual(spokenAt(['The', 'It is'], 'The cat. It is here.', 4), [null, null], 'small words tell nothing');
    const [pounds, costs, year] = spokenAt(['£142', 'Plus £75', '2026'], 'It was one hundred and forty-two pounds. That would add seventy-five pounds in costs, in twenty twenty-six.', 9);
    near(pounds, 0.7, 0.4, 'a sum of money is found by how it starts when said');
    near(costs, 4.6, 0.8, 'seventy-five');
    assert.equal(year, null, 'a number in the thousands could be said several ways, so it is not guessed');
  });

  it('takes the labels in the order they arrive, even when the line names the second first', () => {
    // "bill" is said before "guess", but the guess card comes first: it cannot wait for the last word
    const [guess, bill] = spokenAt(['A guess', 'The right bill'], 'Why bother? Because then your bill is based on what you really used. Not on a guess.', 5.76);
    assert.equal(guess, null);
    near(bill, 2, 0.6, 'bill');
  });

  it('prefers the place where a whole label is said to a stray word of it', () => {
    const [, writes] = spokenAt(['You ask', 'Claude writes', 'You watch'], 'Do I need Claude? Yes, you do. Claude writes the scenes.', 5);
    assert.ok(writes > 2, `"Claude writes" is the second Claude, not the first: ${writes}`);
  });

  it('brings each item in as it is named', () => {
    const say = 'First, find it. Gas meters often live in a box outside, in the hall, or under the stairs.';
    const picture = pacePicture({ type: 'icons', items: [{ icon: 'house', label: 'Outside' }, { icon: 'question', label: 'Under the stairs' }] }, say, 6);
    const [first, second] = times(picture, 2);
    near(first, 3.1, 0.6, 'outside');
    near(second, 4.7, 0.6, 'under the stairs');
    assert.deepEqual(Object.keys(picture), ['type', 'items', 'start', 'every']);
  });

  it('tells apart labels that share a word by the words they do not share', () => {
    const say = 'If your meter has red numbers, or numbers after a decimal point, leave those out. Just the black ones.';
    const [red, black] = spokenAt(['Red numbers', 'Black numbers'], say, 6);
    near(red, 1, 0.5, 'red');
    assert.ok(black > 4.5, `"Black numbers" waits for "black", not the next "numbers": ${black}`);
  });

  it('keeps to the order on screen when the line names things in another order', () => {
    // "seven days" is said first, but the letter is drawn first: it comes in at once, and the others follow close
    const say = 'They gave you seven days from the date on the letter to pay it. That deadline was the tenth of November.';
    const picture = pacePicture({ type: 'flow', items: [{ icon: 'letter', label: 'Letter' }, { icon: 'clock', label: 'Seven days' }, { icon: 'money', label: 'Pay it' }] }, say, 5.6);
    assert.deepEqual([picture.start, picture.every], [0.3, 0.8]);
  });

  it('never leaves the last item waiting when the line ends, whatever was asked for', () => {
    // every: 3 over a nine second line would bring the fourth item in after the narrator has finished
    const say = 'Read the black numbers from left to right. Write down every digit, including any zeros at the start. Ignore anything in red, and anything after the decimal point.';
    const picture = pacePicture({ type: 'list', every: 3, items: ['Left to right', 'Keep the zeros', 'Skip the red digits', 'Stop at the dot'] }, say, 9.5);
    const at = times(picture, 4);
    assert.ok(at[3] <= 9.5 - 0.9, `the last item is in before the end: ${at}`);
    assert.ok(at[0] >= 0.3 && picture.every >= 0.45);
    near(at[0], 1.5, 1, 'left to right');
  });

  it('does not keep an empty picture waiting for a word said late', () => {
    const say = 'One small thing. To stop anyone making too many reels, it counts requests by internet address. That count is never written down, and it is gone within a day.';
    const picture = pacePicture({ type: 'icons', items: [{ icon: 'clock', label: 'Gone within a day' }] }, say, 9.76);
    assert.equal(picture.start, 3.5);
    assert.equal(pacePicture({ type: 'icons', items: [{ icon: 'tick', label: 'Free' }] }, "Does it cost anything? No. It's free.", 4.16).start, 2.3, 'on a short line, just past half way');
  });

  it('keeps the pace asked for when nothing is named, squeezed to fit the line', () => {
    const unnamed = [{ icon: 'star' }, { icon: 'heart' }, { icon: 'tick' }];
    assert.deepEqual(fitPace([null, null, null], 8, { every: 1.4, start: 0.6 }), { start: 0.6, every: 1.4 });
    assert.deepEqual(pacePicture({ type: 'icons', items: unnamed, every: 0.5, start: 1 }, 'Here are three nice things.', 6), { type: 'icons', items: unnamed, every: 0.5, start: 1 });
    const tight = pacePicture({ type: 'icons', items: unnamed }, 'Three things.', 3);
    assert.deepEqual([tight.start, tight.every], [0.6, 0.8], 'three items in a three second line');
    const tiny = fitPace([null, null, null, null, null, null, null, null], 2, { every: 1.4, start: 0.6 });
    assert.deepEqual(tiny, { start: 0.3, every: 0.5 }, 'never quicker than the eye can follow, even when there is no room');
  });

  it('gives a chat a steady beat with room for its typing dots', () => {
    const messages = [{ from: 'You', text: 'Milk?' }, { from: 'Friend', text: 'Just a splash.' }, { from: 'You', text: 'Coming up.' }];
    const long = pacePicture({ type: 'chat', messages }, 'Milk goes in last. We will not be taking questions on this. None at all, thank you.', 8);
    assert.deepEqual([long.start, long.every], [0.6, 1.8]);
    const short = pacePicture({ type: 'chat', messages }, 'Milk last.', 4);
    assert.deepEqual([short.start, short.every], [0.6, 1.3]);
    assert.ok(pacePicture({ type: 'chat', messages }, 'Milk.', 2).every >= 1, 'the dots always have time to show');
  });

  it('leaves pictures with nothing to time, and scenes with no recording, as they are', () => {
    for (const picture of [{ type: 'title', text: 'TEA' }, { type: 'big', text: '6' }, { type: 'sprite', rows: ['k'] }, { type: 'terminal', lines: ['$ ls'] }]) {
      assert.equal(pacePicture(picture, 'Tea.', 5), picture);
    }
    const list = { type: 'list', items: ['One', 'Two'] };
    assert.equal(pacePicture(list, 'One. Two.', 0), list);
    const raw = {
      format: 'pixelreel/1', title: 'T',
      scenes: [
        { title: 'A', caption: 'One, then two.', picture: list },
        { title: 'B', caption: 'Not recorded.', picture: list },
        { title: 'C', caption: 'No picture.' }
      ]
    };
    const paced = paceReel(raw, { clips: [{ text: 'One, then two.', file: 'a.mp3', seconds: 5 }, { text: 'No picture.', file: 'c.mp3', seconds: 4 }] });
    assert.deepEqual(Object.keys(paced.scenes[0].picture), ['type', 'items', 'start', 'every'], 'timed, from its caption when it has no say');
    assert.equal(paced.scenes[1].picture, list);
    assert.equal(paced.scenes[2], raw.scenes[2]);
    assert.deepEqual(raw.scenes[0].picture, { type: 'list', items: ['One', 'Two'] }, 'the reel it was given is not changed');
    assert.deepEqual(paceReel(raw, null), raw);
  });

  it("lands close to the timings set by hand on the site's own reels", () => {
    // those were set from word timings of the real recordings, so they say how good the guess is
    const usual = { list: 1.4, icons: 1.4, flow: 1.4, compare: 2, chat: 1.8 };
    let items = 0, off = 0;
    for (const name of readdirSync(new URL('../reels', import.meta.url))) {
      let reel, manifest;
      try {
        reel = JSON.parse(readFileSync(new URL(`../reels/${name}/reel.json`, import.meta.url), 'utf8'));
        manifest = JSON.parse(readFileSync(new URL(`../reels/${name}/audio/manifest.json`, import.meta.url), 'utf8'));
      } catch {
        continue;   // a reel.js reel
      }
      for (const scene of reel.scenes) {
        const { start, every, ...bare } = scene.picture ?? {};
        if (!usual[bare.type]) continue;
        const say = scene.say ?? scene.caption, clip = manifest.clips.find((c) => c.text === say);
        const paced = pacePicture(bare, say, clip.seconds);
        const count = bare.type === 'compare' ? 2 : (bare.items ?? bare.messages).length;
        for (let i = 0; i < count; i++) {
          const at = paced.start + i * paced.every;
          assert.ok(at <= Math.max(0.3, clip.seconds - 0.9) + 0.1, `${name}, ${scene.title}: item ${i + 1} arrives at ${at} of ${clip.seconds}`);
          off += Math.abs(at - ((start ?? 0.6) + i * (every ?? usual[bare.type])));
          items++;
        }
      }
    }
    assert.ok(items > 100, 'there are plenty to compare with');
    assert.ok(off / items < 0.65, `on average ${(off / items).toFixed(2)} seconds from where a person put them`);
  });
});
