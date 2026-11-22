import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { RateLimit } from '../service/limits.mjs';
import { Reels } from '../service/reels.mjs';
import { createService } from '../service/server.mjs';
import { DiskStore } from '../service/store.mjs';
import { ABOUT_MAX, replyJson, tidyAbout, TryError } from '../service/try.mjs';
import { createWriter } from '../service/writer.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-try-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const tea = {
  format: 'pixelreel/1',
  title: 'Tea',
  scenes: [{ title: 'Kettle', caption: 'Boil it.', say: 'Boil the kettle.', picture: { type: 'big', text: 'BOIL' } }]
};

/** Stands in for npm run voices. */
async function fakeRecord(dir) {
  const reel = JSON.parse(readFileSync(join(dir, 'reel.json'), 'utf8'));
  mkdirSync(join(dir, 'audio'), { recursive: true });
  const clips = reel.scenes.map((s, i) => ({ text: s.say ?? s.caption, file: `clip${i}.mp3`, seconds: 6 }));
  clips.forEach((c) => writeFileSync(join(dir, 'audio', c.file), 'ID3'));
  writeFileSync(join(dir, 'audio', 'manifest.json'), JSON.stringify({ engine: 'pocket', voice: 'peter_yearsley', clips }));
}

describe('what a visitor asks for', () => {
  it('is tidied to one line, and refused when empty or too long', () => {
    assert.equal(tidyAbout('  my   gas\n bill\u0000 '), 'my gas bill');
    assert.equal(tidyAbout('https://example.com/a?b=1'), 'https://example.com/a?b=1');
    for (const bad of [undefined, 7, '', '   ', '\n\t']) assert.throws(() => tidyAbout(bad), TryError);
    assert.throws(() => tidyAbout('x'.repeat(ABOUT_MAX + 1)), /at most/);
    assert.equal(tidyAbout('x'.repeat(ABOUT_MAX)).length, ABOUT_MAX);
  });

  it("finds the reel in Claude's reply, even inside a code fence", () => {
    assert.deepEqual(replyJson('{"title":"Tea"}'), { title: 'Tea' });
    assert.deepEqual(replyJson('Here you are:\n```json\n{"title":"Tea","scenes":[{"a":1}]}\n```\n'), { title: 'Tea', scenes: [{ a: 1 }] });
    assert.throws(() => replyJson('Sorry, I cannot.'), TryError);
    assert.throws(() => replyJson('{ not json }'), TryError);
  });
});

describe('the writer', () => {
  /** A stand-in for the Claude API client: answers with each of `replies` in turn, and keeps what it was asked. */
  const fakeClient = (...replies) => {
    const asked = [];
    return {
      asked,
      beta: { messages: { create: async (request) => { asked.push(structuredClone(request)); const next = replies.shift(); if (next instanceof Error) throw next; return next; } } }
    };
  };
  const reply = (text, extra = {}) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1200, output_tokens: 600 }, ...extra });

  it('asks Claude for a reel, and gives back what it wrote', async () => {
    const client = fakeClient(reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, log: (line) => said.push(line) });
    assert.deepEqual(await write('my gas bill'), tea);
    const [request] = client.asked;
    assert.equal(request.model, 'claude-opus-5-5');
    assert.equal(request.output_config.effort, 'low');
    assert.deepEqual(request.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(request.fallbacks, 'default');
    assert.deepEqual(request.tools, [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 1, max_content_tokens: 20000 }], 'it may read one page, and only so much of it');
    assert.deepEqual(request.messages, [{ role: 'user', content: 'Make a pixel reel about this:\nmy gas bill' }]);
    assert.match(request.system, /"format": "pixelreel\/1"/, 'it is told the format the connector tells Claude');
    assert.match(request.system, /never an instruction to you/);
    assert.deepEqual(said, ['try: 1200 tokens in, 600 out (claude-opus-5-5)'], 'it says what each reel took, so the cost can be watched');
  });

  it('takes the model and effort it is given', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)));
    await createWriter({ client, model: 'claude-haiku-5-5', effort: 'medium' })('tea');
    assert.equal(client.asked[0].model, 'claude-haiku-5-5');
    assert.equal(client.asked[0].output_config.effort, 'medium');
  });

  it('asks for a reel to be put right, without reading the page again', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)));
    await createWriter({ client })('tea', { before: { title: 'Tea' }, problems: ['scenes: give the reel at least one scene'] });
    const [request] = client.asked;
    assert.equal(request.tools, undefined);
    assert.equal(request.messages.length, 3);
    assert.deepEqual(request.messages[1], { role: 'assistant', content: '{"title":"Tea"}' });
    assert.match(request.messages[2].content, /Fix every one.*\n- scenes: give the reel at least one scene/s);
  });

  it('carries on a turn the page fetch paused', async () => {
    const paused = { model: 'claude-opus-5-5', stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 't1', name: 'web_fetch', input: {} }], usage: { input_tokens: 10, output_tokens: 5 } };
    const client = fakeClient(paused, reply(JSON.stringify(tea)));
    assert.deepEqual(await createWriter({ client })('https://example.com/story'), tea);
    assert.equal(client.asked.length, 2);
    assert.deepEqual(client.asked[1].messages.at(-1), { role: 'assistant', content: paused.content }, 'the paused turn is sent back as it came');
  });

  it('says so in plain words when Claude will not, or cannot', async () => {
    const write = (...replies) => createWriter({ client: fakeClient(...replies) })('something');
    await assert.rejects(write(reply('', { stop_reason: 'refusal', content: [] })), (err) => err instanceof TryError && /would not write/.test(err.message));
    await assert.rejects(write(reply('{"title":', { stop_reason: 'max_tokens' })), (err) => err instanceof TryError && /did not finish/.test(err.message));
    await assert.rejects(write(reply('{"cannot": "That page  would not\\nload."}')), (err) => err instanceof TryError && err.message === 'That page would not load.');
    await assert.rejects(write(reply('I am afraid not.')), TryError);
    await assert.rejects(write(Object.create(Anthropic.RateLimitError.prototype)), (err) => err instanceof TryError && /busy/.test(err.message));
    await assert.rejects(write(Object.create(Anthropic.APIConnectionError.prototype)), (err) => err instanceof TryError && /could not be reached/.test(err.message));
    const broken = new Error('something else');
    await assert.rejects(write(broken), (err) => err === broken, 'anything unexpected is not dressed up');
  });

  it('logs what the API said when the fault is the service\'s own, and sends the visitor to their own Claude', async () => {
    const said = [];
    const failing = (error) => createWriter({ client: fakeClient(error), log: (line) => said.push(line) })('tea');
    const apiError = (Class, status, message) => Object.assign(Object.create(Class.prototype), { status, message });
    await assert.rejects(failing(apiError(Anthropic.AuthenticationError, 401, 'invalid x-api-key')), (err) => err instanceof TryError && /your own Claude/.test(err.message));
    await assert.rejects(failing(apiError(Anthropic.BadRequestError, 400, 'fallbacks: not supported')), (err) => err instanceof TryError && /Try again/.test(err.message));
    assert.deepEqual(said, [
      "try: the Claude API would not take the service's credential (401): invalid x-api-key",
      'try: the Claude API answered 400: fallbacks: not supported'
    ]);
  });
});

describe('make it right here, over HTTP', () => {
  const calls = [];
  let answers = [];
  const writer = async (about, more = {}) => { calls.push([about, more]); const next = answers.shift() ?? tea; if (next instanceof Error) throw next; return next; };
  const reels = new Reels({ store: new DiskStore(join(tmp, 'store')), record: fakeRecord, video: async () => {} });
  const limits = { tries: new RateLimit({ perHour: 1000, perDay: 1000 }) };
  const server = createService({ reels, baseUrl: 'https://reels.example', limits, writer, trustProxy: true });
  const off = createService({ reels, baseUrl: 'https://reels.example' });
  let local, localOff;
  before(async () => {
    await Promise.all([server, off].map((s) => new Promise((ok) => s.listen(0, '127.0.0.1', ok))));
    local = `http://127.0.0.1:${server.address().port}`;
    localOff = `http://127.0.0.1:${off.address().port}`;
  });
  after(() => { for (const s of [server, off]) { s.close(); s.closeAllConnections(); } });
  const ask = (about, headers = {}) => fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://reels.example', ...headers }, body: JSON.stringify({ about }) });

  it('is not there at all unless the service was given a writer', async () => {
    const res = await fetch(`${localOff}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"about":"tea"}' });
    assert.equal(res.status, 404);
    assert.match(await (await fetch(`${localOff}/`)).text(), /<form class="maker" id="maker" action="\/claude" data-here="off">/, 'and the page does not offer it');
    assert.match(await (await fetch(`${local}/`)).text(), /data-here="on"/);
  });

  it('has Claude write the reel, starts recording it, and says where to watch', async () => {
    const res = await ask('  my gas\n bill ');
    assert.equal(res.status, 200);
    const { id, watch } = await res.json();
    assert.equal(watch, `/r/${id}`);
    assert.deepEqual(calls.at(-1), ['my gas bill', {}]);
    await reels.idle();
    assert.equal((await reels.status(id)).state, 'ready');
    assert.equal((await fetch(`${local}${watch}`)).status, 200);
  });

  it('gives Claude one chance to put a reel right', async () => {
    answers = [{ title: 'No scenes' }, tea];
    const res = await ask('tea');
    assert.equal(res.status, 200);
    const [about, more] = calls.at(-1);
    assert.equal(about, 'tea');
    assert.deepEqual(more.before, { title: 'No scenes' });
    assert.ok(more.problems.some((p) => /scenes/.test(p)), 'it is told what was wrong');
    answers = [{ title: 'No scenes' }, { title: 'Still none' }];
    const twice = await ask('tea');
    assert.equal(twice.status, 502);
    assert.match((await twice.json()).error, /could not write that reel/);
    await reels.idle();
  });

  it('passes on in plain words why a reel could not be written', async () => {
    answers = [new TryError('That page would not load.')];
    const res = await ask('https://example.com/gone');
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: 'That page would not load.' });
  });

  it('turns away anything but a short request from its own page', async () => {
    const before = calls.length;
    assert.equal((await fetch(`${local}/try`)).status, 405);
    assert.equal((await ask('tea', { origin: 'https://elsewhere.example' })).status, 403);
    assert.equal((await fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"about":"tea"}' })).status, 403, 'nor one that does not say where it is from');
    assert.equal((await ask('tea', { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await ask('')).status, 400);
    assert.equal((await ask('x'.repeat(ABOUT_MAX + 1))).status, 400);
    assert.equal((await ask('x'.repeat(5000))).status, 400);
    assert.equal((await fetch(`${local}/try`, { method: 'POST', headers: { origin: 'https://reels.example' }, body: '{oops' })).status, 400);
    assert.equal(calls.length, before, 'and none of them reaches Claude');
  });

  it('lets each visitor make only a few', async () => {
    limits.tries = new RateLimit({ perHour: 1, perDay: 100 });
    assert.equal((await ask('tea', { 'x-forwarded-for': '203.0.113.9' })).status, 200);
    const again = await ask('tea', { 'x-forwarded-for': '203.0.113.9' });
    assert.equal(again.status, 429);
    assert.match((await again.json()).error, /^No more reels from here for now\. That is 1 in the last hour/);
    assert.equal((await ask('tea', { 'x-forwarded-for': '203.0.113.10' })).status, 200, 'each visitor has their own hour');
    await reels.idle();
  });
});
