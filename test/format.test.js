import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseReelJson, PICTURE_NOTES, REEL_FORMAT, reelFromData, reelSchema } from '../src/format.js';
import { PICTURES } from '../src/pictures.js';
import { CAPTION_STYLES, normalizeReel, ReelError } from '../src/reel.js';
import { TRANSITIONS } from '../src/transitions.js';

const reel = (extra = {}) => ({
  format: REEL_FORMAT,
  title: 'Tea',
  scenes: [
    { title: 'Kettle', caption: 'Boil the water.', picture: { type: 'big', text: '100C', sub: 'and no less' } },
    { title: 'Steep', caption: 'Three minutes.', say: 'Leave it for three minutes.', transition: 'iris' }
  ],
  ...extra
});

const problemsOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ReelError, `a ReelError, not ${err}`);
    return err.problems;
  }
  assert.fail('expected the reel to be refused');
};

describe('reelFromData', () => {
  it('plays a reel.json just as the same reel written in reel.js', () => {
    const fromData = reelFromData(reel(), { base: 'reels/tea/' });
    const fromCode = normalizeReel(reel(), { base: 'reels/tea/' });
    const words = (r) => ({ ...r, scenes: r.scenes.map((s) => ({ ...s, draw: typeof s.draw })) });
    assert.deepEqual(words(fromData), words(fromCode));
    assert.equal(fromData.scenes[0].say, 'Boil the water.', 'with no say, the caption is read aloud');
    assert.equal(typeof fromData.scenes[0].draw, 'function', 'the picture becomes the drawing');
  });

  it('needs the format it reads, and says which', () => {
    assert.deepEqual(problemsOf(() => reelFromData(reel({ format: undefined }))), [`format: say which format this is, "format": "${REEL_FORMAT}"`]);
    assert.deepEqual(problemsOf(() => reelFromData(reel({ format: 'pixelreel/2' }))), [`format: this player reads "${REEL_FORMAT}", not "pixelreel/2"`]);
  });

  it('names fields it does not know, so a typo is not silently ignored', () => {
    const raw = reel({ titel: 'Oops' });
    raw.scenes[0].captoin = 'Oops';
    const problems = problemsOf(() => reelFromData(raw));
    assert.match(problems[0], /^titel: a reel has format, title, .*, not titel$/);
    assert.match(problems[1], /^scene 1: a scene has title, caption, say, picture, transition, captions, not captoin$/);
  });

  it('refuses code, wherever it is', () => {
    const raw = reel({ intro: () => 'hi' });
    raw.scenes[1].draw = () => {};
    assert.deepEqual(problemsOf(() => reelFromData(raw)), [
      'scene 2: draw is code, which a reel.json cannot hold; give the scene a picture instead',
      'intro: a reel.json holds data only, not code',
      'intro: must be text'
    ]);
    const hidden = reel();
    hidden.scenes[0].picture.sub = { toString: () => 'sneaky' };
    assert.ok(problemsOf(() => reelFromData(hidden)).includes('scenes[0].picture.sub.toString: a reel.json holds data only, not code'));
  });

  it('lists every problem at once, its own and the usual ones', () => {
    const problems = problemsOf(() => reelFromData({ format: 'nope', scenes: [{ title: 'A', picture: { type: 'bigg' }, draw: 'x' }] }));
    assert.deepEqual(problems, [
      `format: this player reads "${REEL_FORMAT}", not "nope"`,
      'scene 1: draw is code, which a reel.json cannot hold; give the scene a picture instead',
      'title: give the reel a title',
      'scene 1: needs a caption',
      'scene 1: picture.type must be one of: title, list, terminal, code, chat, big, image, icons, flow, compare, sprite'
    ]);
  });

  it('says plainly when it is not one object', () => {
    for (const bad of [null, [], 'reel', 3]) assert.match(problemsOf(() => reelFromData(bad))[0], /^a reel\.json must be one object/);
  });
});

describe('parseReelJson', () => {
  it('reads the text of a reel.json', () => {
    assert.equal(parseReelJson(JSON.stringify(reel())).title, 'Tea');
  });

  it('says when the text is not JSON', () => {
    assert.match(problemsOf(() => parseReelJson('{ "title": "Tea", }'))[0], /^this is not valid JSON: /);
  });
});

// Just enough of JSON Schema to check reelSchema() means what reelFromData means.
function schemaErrors(schema, value, root = schema, path = '') {
  if (schema.$ref) return schemaErrors(root.$defs[schema.$ref.replace('#/$defs/', '')], value, root, path);
  if (schema.oneOf) {
    const fits = schema.oneOf.filter((s) => schemaErrors(s, value, root, path).length === 0).length;
    return fits === 1 ? [] : [`${path}: fits ${fits} of the choices, not one`];
  }
  const errors = [];
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if ('const' in schema && value !== schema.const) errors.push(`${path}: must be ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of the list`);
  if (schema.type && schema.type !== type) return [...errors, `${path}: must be ${schema.type}`];
  if (type === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: is empty`);
  if (type === 'string' && schema.minLength && value.length < schema.minLength) errors.push(`${path}: is too short`);
  if (type === 'string' && schema.maxLength && value.length > schema.maxLength) errors.push(`${path}: is too long`);
  if (type === 'number' && 'minimum' in schema && value < schema.minimum) errors.push(`${path}: is too small`);
  if (type === 'array') {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${path}: has too few items`);
    if (schema.maxItems && value.length > schema.maxItems) errors.push(`${path}: has too many items`);
    if (schema.items) value.forEach((v, i) => errors.push(...schemaErrors(schema.items, v, root, `${path}[${i}]`)));
  }
  if (type === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: is needed`);
    if (schema.propertyNames) for (const key of Object.keys(value)) errors.push(...schemaErrors({ type: 'string', ...schema.propertyNames }, key, root, `${path}[${key}]`));
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key] ?? (typeof schema.additionalProperties === 'object' ? schema.additionalProperties : null);
      if (sub) errors.push(...schemaErrors(sub, v, root, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: is not allowed`);
    }
  }
  return errors;
}

describe('reelSchema', () => {
  const schema = reelSchema();

  it('is plain JSON, ready to hand to a tool or an agent', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(schema)), schema);
    assert.equal(schema.properties.format.const, REEL_FORMAT);
    assert.deepEqual(schema.properties.transition.enum, TRANSITIONS);
    assert.deepEqual(schema.properties.captions.enum, CAPTION_STYLES);
  });

  it('has every ready-made picture, with its fields and what it shows', () => {
    const pictures = schema.$defs.picture.oneOf;
    assert.deepEqual(pictures.map((p) => p.title), Object.keys(PICTURES));
    for (const p of pictures) {
      const { fields } = PICTURES[p.title];
      assert.deepEqual(Object.keys(p.properties), ['type', ...Object.keys(fields)]);
      assert.deepEqual(p.required, ['type', ...Object.keys(fields).filter((k) => !fields[k].endsWith('?'))]);
      assert.ok(PICTURE_NOTES[p.title] && p.description === PICTURE_NOTES[p.title], `${p.title} says what it shows`);
    }
  });

  it('accepts what reelFromData accepts, every picture included', () => {
    const scenes = [
      { title: 'A', caption: 'a', picture: { type: 'title', text: 'TEA', sub: 'From the bush to the cup' } },
      { title: 'B', caption: 'b', picture: { type: 'list', heading: 'YOU NEED', items: ['Kettle', 'Pot'], numbered: true, every: 1.5, start: 0 } },
      { title: 'C', caption: 'c', picture: { type: 'terminal', title: 'bash', lines: ['$ boil'] } },
      { title: 'D', caption: 'd', picture: { type: 'code', lines: ['brew()'] } },
      { title: 'E', caption: 'e', picture: { type: 'chat', messages: [{ from: 'Kettle', text: 'Ready.' }], every: 2 } },
      { title: 'F', caption: 'f', picture: { type: 'big', text: '3 MIN' }, captions: 'typewriter' },
      { title: 'G', caption: 'g', picture: { type: 'image', name: 'garden' }, transition: 'star' },
      { title: 'H', caption: 'h', say: 'Thanks.' },
      { title: 'I', caption: 'i', picture: { type: 'icons', heading: 'NEED', items: [{ icon: 'letter', label: 'Letter' }, { icon: 'phone' }], every: 1 } },
      { title: 'J', caption: 'j', picture: { type: 'flow', items: [{ icon: 'person' }, { icon: 'heart', label: 'Love' }] } },
      { title: 'K', caption: 'k', picture: { type: 'compare', bad: { icon: 'car', label: 'Drive' }, good: { icon: 'phone', label: 'Ring' } } },
      { title: 'L', caption: 'l', picture: { type: 'sprite', rows: ['.hh.', 'hyyh'], colours: { h: '#6b3e2e' }, label: 'Hi' } }
    ];
    const good = { format: REEL_FORMAT, title: 'Tea', intro: 'Hi.', note: 'Made with tea.', transition: 'fade', captions: 'plain', images: { garden: 'garden.png' }, scenes };
    assert.doesNotThrow(() => reelFromData(good));
    assert.deepEqual(schemaErrors(schema, good), []);
  });

  it('refuses what reelFromData refuses', () => {
    const bad = [
      reel({ format: 'pixelreel/0' }),
      reel({ title: '  ' }),
      reel({ scenes: [] }),
      reel({ transition: 'spin' }),
      reel({ extra: true }),
      reel({ scenes: [{ title: 'A' }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', draw: 'x' }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'big' } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'list', items: [] } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'list', items: ['x'], every: -1 } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'chat', messages: [{ from: 'A' }] } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'title', text: 'T', colour: 'red' } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'icons', items: [{ icon: 'castle' }] } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'icons', items: Array(5).fill({ icon: 'tick' }) } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'compare', bad: { icon: 'car' }, good: { icon: 'tick', label: 'Yes' } } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'sprite', rows: ['y'], colours: { '.': '#fff' } } }] }),
      reel({ scenes: [{ title: 'A', caption: 'a', picture: { type: 'sprite', rows: ['y'], colours: { h: 'brown' } } }] })
    ];
    for (const raw of bad) {
      assert.throws(() => reelFromData(raw), ReelError, JSON.stringify(raw));
      assert.notDeepEqual(schemaErrors(schema, raw), [], JSON.stringify(raw));
    }
  });
});
