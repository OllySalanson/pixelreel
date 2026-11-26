import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { createCritic, freeChecks, mendedReel } from '../service/critic.mjs';
import { EXAMPLE_STAGE_REEL } from '../service/mcp.mjs';
import { Reels } from '../service/reels.mjs';
import { DiskStore } from '../service/store.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-critic-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** A stand-in for the Claude API that gives `replies` in turn, and keeps what it was asked. */
function standIn(replies) {
  const asked = [];
  return {
    asked,
    messages: {
      async create(request) {
        asked.push(request);
        const reply = replies[Math.min(asked.length - 1, replies.length - 1)];
        if (reply instanceof Error) throw reply;
        return { model: 'stand-in', usage: { input_tokens: 1000, output_tokens: 100 }, content: [{ type: 'text', text: typeof reply === 'string' ? reply : JSON.stringify(reply) }] };
      }
    }
  };
}

const reel = structuredClone(EXAMPLE_STAGE_REEL);
/** The example's pictures, with scene 2's moved spot, as a critic might mend it. */
const better = () => reel.scenes.map((s, i) => (i === 1 ? { ...s.picture, things: s.picture.things.map((th) => (th.id === 'reelie' ? { ...th, spot: 'far-left' } : th)) } : s.picture));

describe('the free checks', () => {
  it('find what a rule can tell: a missing cue, a cue Peter never says, a long label, the cast moving', () => {
    const raw = structuredClone(reel);
    raw.scenes[1].picture.moves[0] = { do: 'flow', from: 'gas', to: 'home' };
    raw.scenes[1].picture.moves[1].cue = 'the post arrives';
    raw.scenes[2].picture.things[0].spot = 'far-left';
    const found = freeChecks(raw);
    for (const bit of ['scene 2: move 1 (flow) has no cue', 'scene 2: the cue "the post arrives"', 'scene 3: "Your home" stood left in scene 2 and stands far-left']) {
      assert.ok(found.some((f) => f.startsWith(bit)), `${bit}: ${found.join(' | ')}`);
    }
    raw.scenes[2].picture.things[1] = { id: 'x', is: 'car', spot: 'left', label: 'A very long label' };
    assert.ok(freeChecks(raw).some((f) => f.includes('too long to sit under')));
  });

  it('find nothing wrong with the guide\'s own example', () => {
    assert.deepEqual(freeChecks(reel), []);
  });
});

describe('the critic', () => {
  it('mends pictures, never words', async () => {
    const client = standIn([{ faults: ['scene 2: Reelie should not stand by the gas company'], pictures: better() }]);
    const look = createCritic({ client });
    const { raw, faults } = await look(reel);
    assert.equal(faults.length, 1);
    assert.equal(raw.scenes[1].picture.things.find((th) => th.id === 'reelie').spot, 'far-left');
    assert.deepEqual(raw.scenes.map((s) => [s.title, s.caption, s.say]), reel.scenes.map((s) => [s.title, s.caption, s.say]));
    const shown = client.asked[0].messages[0].content;
    assert.equal(shown.filter((c) => c.type === 'image').length, reel.scenes.length * 2, 'two frames a scene');
    assert.match(client.asked[0].system, /Change pictures only: never a scene's title, caption or say/);
  });

  it('keeps the words even when the reply changes them', () => {
    const reply = { faults: ['x'], pictures: better() };
    const { mended } = mendedReel(reel, { ...reply });
    assert.equal(mended.scenes[1].say, reel.scenes[1].say);
    assert.deepEqual(mendedReel(reel, { pictures: better().slice(1) }).problems, ['"pictures" must have one picture for each of the 6 scenes, in order']);
  });

  it('gives its pictures one chance to be put right, and otherwise leaves the reel as it was', async () => {
    const broken = better().map((p, i) => (i === 1 ? { ...p, place: 'moon' } : p));
    const fixed = standIn([{ faults: ['a'], pictures: broken }, { faults: ['a'], pictures: better() }]);
    assert.equal((await createCritic({ client: fixed })(reel)).raw.scenes[1].picture.things.at(-1).spot, 'far-left');
    assert.match(fixed.asked[1].messages.at(-1).content, /picture.place must be one of/);
    // still broken the second time: the pictures that play are kept, and scene 2 keeps its own
    const lines = [];
    const moved = better().map((p, i) => (i === 4 ? { ...p, things: p.things.map((th) => (th.id === 'you' ? { ...th, label: 'Sam' } : th)) } : i === 1 ? { ...p, place: 'moon' } : p));
    const stuck = standIn([{ faults: ['a'], pictures: moved }]);
    const { raw } = await createCritic({ client: stuck, log: (l) => lines.push(l) })(reel);
    assert.equal(raw.scenes[1].picture, reel.scenes[1].picture);
    assert.equal(raw.scenes[4].picture.things.find((th) => th.id === 'you').label, 'Sam');
    assert.match(lines[0], /all but one picture that would not do \(scene 2: picture.place must be one of/);
    const hopeless = standIn([{ faults: ['a'], pictures: reel.scenes.map((s) => ({ ...s.picture, place: 'moon' })) }]);
    assert.equal((await createCritic({ client: hopeless })(reel)).raw, reel, 'and with none that play, the reel stays as it was');
  });

  it('leaves the reel as it was when Claude cannot be reached, or the day\'s looks are spent', async () => {
    assert.equal((await createCritic({ client: standIn([new Error('down')]) })(reel)).raw, reel);
    const client = standIn([{ faults: [], pictures: [] }]);
    const look = createCritic({ client, perDay: 1 });
    await look(reel);
    await look(reel);
    assert.equal(client.asked.length, 1);
  });

  it('looks while Peter records, and the reel that plays has its mended pictures, timed to the voice', async () => {
    const record = async (dir) => {
      const r = JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8'));
      mkdirSync(join(dir, 'audio'), { recursive: true });
      const clips = r.scenes.map((s, i) => ({ text: s.say ?? s.caption, file: `c${i}.mp3`, seconds: 6 }));
      clips.forEach((c) => writeFileSync(join(dir, 'audio', c.file), 'ID3'));
      writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ engine: 'pocket', voice: 'peter_yearsley', clips }));
    };
    const looked = [];
    const critic = async (raw) => { looked.push(raw.title); return { raw: { ...raw, scenes: raw.scenes.map((s, i) => ({ ...s, picture: better()[i] })) }, faults: ['one'] }; };
    const reels = new Reels({ store: new DiskStore(join(tmp, 'a')), record, critic, video: async () => {}, picture: async () => Buffer.from('') });
    const made = await reels.create(reel);
    await reels.idle();
    const kept = await reels.reel(made.id);
    assert.equal(kept.scenes[1].picture.things.at(-1).spot, 'far-left');
    assert.ok(kept.scenes[1].picture.moves.every((m) => typeof m.at === 'number'));
    assert.equal((await reels.status(made.id)).state, 'ready');
    const cards = new Reels({ store: new DiskStore(join(tmp, 'b')), record, critic, pictures: 'cards', video: async () => {}, picture: async () => Buffer.from('') });
    const { format, ...plain } = reel;
    await cards.create({ format, ...plain, scenes: [plain.scenes[0], plain.scenes[3]] });
    await cards.idle();
    assert.deepEqual(looked, [reel.title], 'with the cards, nobody looks');
  });
});
