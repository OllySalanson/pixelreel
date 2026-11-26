// The pictures switch (PIXELREEL_PICTURES): the stage, or the cards alone exactly as before the
// stage. Both positions, through the connector itself.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { EXAMPLE_REEL, EXAMPLE_STAGE_REEL, formatGuide, toolList } from '../service/mcp.mjs';
import { Reels } from '../service/reels.mjs';
import { createService } from '../service/server.mjs';
import { DiskStore } from '../service/store.mjs';
import { instructions } from '../service/writer.mjs';
import { reelFromData } from '../src/format.js';
import { THINGS } from '../src/library.js';
import { told } from './told.js';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-switch-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let stores = 0;

async function fakeRecord(dir) {
  const reel = JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8'));
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const clips = reel.scenes.map((s, i) => ({ text: s.say ?? s.caption, file: `clip${i}.mp3`, seconds: 6 }));
  clips.forEach((c) => writeFileSync(join(dir, 'audio', c.file), 'ID3'));
  writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ engine: 'pocket', voice: 'peter_yearsley', clips }));
}

/** A service with the pictures switched to `pictures`, and a connector client for it. */
async function serviceWith(pictures) {
  const store = new DiskStore(join(tmp, `store-${++stores}`));
  const reels = new Reels({ store, pictures, record: fakeRecord, video: async () => {}, picture: async () => Buffer.from('') });
  const server = createService({ reels, baseUrl: 'https://reels.example' });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`)));
  const stop = async () => { await client.close().catch(() => {}); server.close(); server.closeAllConnections(); };
  return { reels, store, client, stop };
}
const words = (result) => result.content.map((c) => c.text).join('\n');

describe('the pictures switch', () => {
  it('with the cards, tells Claude exactly what it was told before the stage', () => {
    assert.deepEqual(told({ pictures: 'cards' }), JSON.parse(readFileSync(new URL('./fixtures/cards-told.json', import.meta.url), 'utf8')));
  });

  it('with the stage, tells Claude to show what is happening, and offers the library', () => {
    const guide = formatGuide([], [], { pictures: 'stage' }), website = instructions(null, null, { pictures: 'stage' });
    for (const text of [guide, website]) {
      assert.match(text, /what is happening here\?/);
      assert.match(text, /A stage is \{ "type": "stage"/);
      for (const name of Object.keys(THINGS)) assert.ok(text.includes(name), `offers ${name}`);
      assert.ok(text.includes(JSON.stringify(EXAMPLE_STAGE_REEL.scenes[1].picture.things[0])), 'shows the stage example');
    }
    assert.match(website, /"wishes"/);
    assert.ok(!instructions(null, null, { pictures: 'cards' }).includes('wishes'));
    const make = toolList([], [], { pictures: 'stage' }).find((t) => t.name === 'make_reel').inputSchema;
    const stage = make.$defs.picture.oneOf.find((p) => p.title === 'stage');
    assert.ok(stage, 'make_reel takes a stage');
    assert.equal(stage.properties.moves.items.properties.at, undefined, 'the service times the moves itself');
    assert.ok(make.properties.wishes);
    assert.deepEqual(reelFromData(EXAMPLE_STAGE_REEL).scenes.length, EXAMPLE_STAGE_REEL.scenes.length, 'the example is a reel');
    assert.ok(reelFromData(EXAMPLE_REEL));
  });

  it('with the stage, makes a stage reel, keeps its wishes apart from it, and times its moves to the voice', async () => {
    const { reels, store, client, stop } = await serviceWith('stage');
    after(stop);
    const { format, ...reel } = EXAMPLE_STAGE_REEL;
    const made = await client.callTool({ name: 'make_reel', arguments: { ...reel, wishes: ['Gas Meter', 'smart meter', '<script>'] } });
    assert.ok(!made.isError, words(made));
    const id = made.structuredContent.id;
    await reels.idle();
    const kept = await reels.reel(id);
    assert.equal(kept.wishes, undefined, 'the wishes are not part of the reel');
    assert.ok(kept.scenes[1].picture.moves.every((m) => typeof m.at === 'number'), 'each move is timed');
    const wishes = (await store.list('wishes')).filter((key) => key.endsWith(`${id}.json`));
    assert.equal(wishes.length, 1);
    assert.deepEqual(JSON.parse(await store.get(wishes[0])).wishes, ['gas meter', 'smart meter']);
    const again = await client.callTool({ name: 'get_reel', arguments: { id } });
    assert.ok(again.structuredContent.reel.scenes[1].picture.moves.every((m) => m.at === undefined), 'get_reel gives the moves as written');
    assert.equal(format, 'pixelreel/1');
  });

  it('with the cards, turns a stage away as it did before the stage, and takes no wishes, while old stage reels still play', async () => {
    const { reels, client, stop } = await serviceWith('cards');
    after(stop);
    const { format, ...reel } = EXAMPLE_STAGE_REEL;
    const refused = await client.callTool({ name: 'make_reel', arguments: reel });
    assert.equal(refused.isError, true);
    assert.match(words(refused), /scene 2: picture\.type must be one of: title, list, terminal, code, chat, big, image, icons, flow, compare, table, sprite\n/);
    const wished = await client.callTool({ name: 'make_reel', arguments: { ...EXAMPLE_REEL, wishes: ['gas meter'] } });
    assert.match(words(wished), /wishes: a reel has format/);
    const made = await client.callTool({ name: 'make_reel', arguments: EXAMPLE_REEL });
    assert.ok(!made.isError, words(made));
    assert.ok(reelFromData({ format, ...reel }), 'a reel made with a stage still plays');
    await reels.idle();
  });
});
