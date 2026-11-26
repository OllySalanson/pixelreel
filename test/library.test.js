import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createKit } from '../src/kit.js';
import { LEGS, PEOPLE, THING_GROUPS, THINGS, TOPS, WEARS } from '../src/library.js';
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
      // drawn two picture pixels to one of its own, it fits a spot, and stands no taller than the picture's ground allows
      assert.ok(thing.rows[0].length * 2 <= 62, `${name} fits its spot`);
      assert.ok(thing.rows.length * 2 <= 60, `${name} is not too tall`);
    }
  });

  it('says what every thing is, and groups them', () => {
    for (const [name, thing] of Object.entries(THINGS)) assert.ok(thing.says && thing.group, name);
    assert.deepEqual(Object.values(THING_GROUPS).flat().sort(), Object.keys(THINGS).sort());
    assert.ok(Object.keys(THINGS).length >= 40, 'a starter library of about forty things');
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
    assert.equal(stageLook({ id: 'h', is: 'house' }), null);
  });

  it('dresses people for what they do, and in everyday clothes otherwise', () => {
    for (const [wears, colours] of Object.entries(WEARS)) {
      const look = stageLook({ id: 'a', is: 'man', wears });
      if (colours) assert.equal(look.C, colours.C, wears);
      else assert.ok(TOPS.includes(look.C) && LEGS.includes(look.T));
    }
    assert.ok(pictureProblems({ type: 'stage', place: 'home', things: [{ id: 'h', is: 'house', spot: 'left', wears: 'suit' }], moves: [{ do: 'pulse', on: 'h' }] })
      .some((p) => p.includes('only a person wears')));
  });

  it('can put every thing and every person on a stage', () => {
    const names = [...Object.keys(PEOPLE), ...Object.keys(THINGS)], spots = Object.keys(SPOTS);
    for (let i = 0; i < names.length; i += 5) {
      const things = names.slice(i, i + 5).map((is, n) => ({ id: `t${n}`, is, spot: spots[n], label: is }));
      const p = { type: 'stage', place: 'street', things, moves: [{ do: 'send', what: 'parcel', from: 't0', to: things.at(-1).id === 't0' ? 't0' : things.at(-1).id }] };
      if (things.length === 1) p.moves = [{ do: 'pulse', on: 't0' }];
      assert.deepEqual(pictureProblems(p), [], names.slice(i, i + 5).join(', '));
      const g = fakeContext(), px = createKit(g);
      for (const t of [0, 1, 3]) px.picture(p, t);
    }
  });
});
