import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { LEGS, PEOPLE, personRows, THING_GROUPS, THINGS, TOPS, WEARS } from '../src/library.js';
import { PALETTE } from '../src/palette.js';
import { HAIRS, pictureProblems, SKINS, stageLook } from '../src/pictures.js';
import { SPOTS } from '../src/stage.js';
import { fakeContext } from './fake-canvas.js';

const PERSON_LETTERS = ['S', 'H', 'C', 'T', 'U'];

describe('the library', () => {
  it('draws every thing from rows of one length, in colours it knows', () => {
    for (const [name, thing] of [...Object.entries(PEOPLE), ...Object.entries(THINGS)]) {
      assert.equal(new Set(thing.rows.map((r) => r.length)).size, 1, `${name}: every row the same length`);
      const known = new Set([...Object.keys(PALETTE), ...Object.keys(thing.colours ?? {}), ...(PEOPLE[name] ? PERSON_LETTERS : []), '.']);
      for (const row of thing.rows) for (const ch of row) assert.ok(known.has(ch), `${name}: "${ch}" is a colour it knows`);
      // drawn three picture pixels to one of its own, it fits three spots at most, and stands below the top of the picture
      assert.ok(thing.rows[0].length * 3 <= 186, `${name} fits three spots`);
      assert.ok(thing.rows.length * 3 <= 84, `${name} is not too tall`);
    }
  });

  it('says what every thing is, and groups them', () => {
    for (const [name, thing] of Object.entries(THINGS)) assert.ok(thing.says && thing.group, name);
    assert.deepEqual(Object.values(THING_GROUPS).flat().sort(), Object.keys(THINGS).sort());
    assert.ok(Object.keys(THINGS).length >= 80, 'a library of eighty things and more');
  });

  it('draws people as who they are, in any skin and hair, and the same person the same every time', () => {
    for (const name of ['woman', 'man', 'girl', 'boy', 'baby', 'older-woman', 'older-man']) {
      for (const skin of Object.keys(SKINS)) {
        for (const hair of Object.keys(HAIRS)) {
          const look = stageLook({ id: 'a', is: name, skin, hair });
          assert.equal(look.S, SKINS[skin]);
          assert.equal(look.H, HAIRS[hair]);
        }
      }
      assert.deepEqual(stageLook({ id: 'x', is: name, label: 'Laura' }), stageLook({ id: 'y', is: name, label: 'Laura' }), 'a look of their own, kept by their label');
    }
    const skins = new Set(['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida'].map((label) => stageLook({ id: 'p', is: 'woman', label }).S));
    assert.ok(skins.size > 1, 'nobody is one skin by default');
    assert.equal(stageLook({ id: 'g', is: 'older-man', label: 'Grandad' }).H, HAIRS.grey, 'an older person has grey hair unless told');
    assert.equal(stageLook({ id: 'p', is: 'person' }).S, undefined, 'a person is an outline: anyone at all');
    assert.ok(TOPS.includes(stageLook({ id: 'p', is: 'person' }).C), 'in a colour of their own');
    assert.equal(stageLook({ id: 'h', is: 'house' }), null);
  });

  it('dresses people for what they do, and in everyday clothes otherwise', () => {
    for (const [wears, colours] of Object.entries(WEARS)) {
      const look = stageLook({ id: 'a', is: 'man', wears });
      assert.equal(look.C, colours?.C ?? look.C, wears);
      if (!colours?.C) assert.ok(TOPS.includes(look.C), `${wears}: an everyday top`);
      if (!colours?.T) assert.ok(LEGS.includes(look.T), `${wears}: everyday trousers`);
      for (const name of ['woman', 'man', 'girl', 'boy', 'older-woman', 'older-man']) {
        const rows = personRows(name, wears === 'everyday' ? null : wears);
        assert.equal(new Set(rows.map((r) => r.length)).size, 1, `${name} in ${wears}: rows of one length`);
        assert.ok(rows.length * 3 <= 84, `${name} in ${wears} is not too tall`);
        if (colours?.A) assert.ok(rows.join('').includes('A') || colours.hat, `${name} in ${wears} shows its accent`);
      }
    }
    assert.ok(pictureProblems({ type: 'stage', place: 'home', things: [{ id: 'h', is: 'house', spot: 'left', wears: 'suit' }], moves: [{ do: 'pulse', on: 'h' }] })
      .some((p) => p.includes('only a person wears')));
  });

  it('can put every thing and every person on a stage', () => {
    const names = [...Object.keys(PEOPLE), ...Object.keys(THINGS)], spots = Object.keys(SPOTS);
    for (let i = 0; i < names.length; i += 3) {
      const things = names.slice(i, i + 3).map((is, n) => ({ id: `t${n}`, is, spot: spots[n * 2], label: is }));
      const p = { type: 'stage', place: 'street', things, moves: [{ do: 'send', what: 'parcel', from: 't0', to: things.at(-1).id === 't0' ? 't0' : things.at(-1).id }] };
      if (things.length === 1) p.moves = [{ do: 'pulse', on: 't0' }];
      assert.deepEqual(pictureProblems(p), [], names.slice(i, i + 3).join(', '));
      const g = fakeContext(), px = createKit(g);
      for (const t of [0, 1, 3]) px.picture(p, t);
    }
  });
});
