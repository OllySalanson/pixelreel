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
import { ABOUT_MAX, PDF_MAX, PICTURE_MAX, replyJson, sourceOf, TEXT_MAX, tidyAbout, tidyText, TryError } from '../service/try.mjs';
import { createWriter } from '../service/writer.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'pixelreel-try-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const tea = {
  format: 'pixelreel/1',
  title: 'Tea',
  scenes: [{ title: 'Kettle', caption: 'Boil it.', say: 'Boil the kettle.', picture: { type: 'big', text: 'BOIL' } }]
};

/** The start of a file of each kind the service takes, and one it does not. */
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 8, 0, 0, 0]);
const words = (about) => ({ kind: 'words', about });

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

  it('keeps the lines of writing that is pasted in, and refuses too much of it', () => {
    assert.equal(tidyText('  Dear Sam,\r\n\r\n\r\n\r\nYour bill \u0007is due.  \n\tThanks  '), 'Dear Sam,\n\nYour bill is due.\n\tThanks');
    for (const bad of [undefined, 7, '', ' \n ']) assert.throws(() => tidyText(bad), TryError);
    assert.throws(() => tidyText('x'.repeat(TEXT_MAX + 1)), /too much for one reel/);
    assert.equal(tidyText('x'.repeat(TEXT_MAX)).length, TEXT_MAX);
  });

  it('tells a few words from writing, a PDF and a picture, by what they are and not what they are called', () => {
    const json = (value) => Buffer.from(JSON.stringify(value));
    assert.deepEqual(sourceOf('application/json', json({ about: ' my gas  bill ' })), words('my gas bill'));
    assert.deepEqual(sourceOf('application/json; charset=utf-8', json({ text: 'Dear Sam,\n\nPay up.' })), { kind: 'text', text: 'Dear Sam,\n\nPay up.' });
    assert.deepEqual(sourceOf('application/pdf', PDF), { kind: 'pdf', data: PDF.toString('base64') });
    assert.deepEqual(sourceOf('image/jpeg', JPEG), { kind: 'picture', type: 'image/jpeg', data: JPEG.toString('base64') });
    assert.deepEqual(sourceOf('application/pdf', PNG), { kind: 'picture', type: 'image/png', data: PNG.toString('base64') }, 'a picture called a PDF is still a picture');
    assert.deepEqual(sourceOf(undefined, PDF), { kind: 'pdf', data: PDF.toString('base64') });
    assert.throws(() => sourceOf('application/pdf', ZIP), (err) => err instanceof TryError && /PDF, a photo, or plain writing/.test(err.message));
    assert.throws(() => sourceOf('image/png', Buffer.from('<svg onload="x()">')), TryError);
    assert.throws(() => sourceOf('image/jpeg', Buffer.concat([JPEG, Buffer.alloc(PICTURE_MAX)])), /too big/);
    for (const bad of ['{oops', '', 'null', '{"about":7}']) assert.throws(() => sourceOf('application/json', Buffer.from(bad)), TryError);
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
    const asked = [], counted = [];
    const client = {
      asked,
      counted,
      size: 1000,   // what it says anything measures, in tokens: or an error, to fail with
      messages: { countTokens: async (request) => { counted.push(structuredClone(request)); if (client.size instanceof Error) throw client.size; return { input_tokens: client.size }; } },
      beta: { messages: { create: async (request) => { asked.push(structuredClone(request)); const next = replies.shift(); if (next instanceof Error) throw next; return next; } } }
    };
    return client;
  };
  const reply = (text, extra = {}) => ({ model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1200, output_tokens: 600 }, ...extra });

  it('asks Claude for a reel, and gives back what it wrote', async () => {
    const client = fakeClient(reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, log: (line) => said.push(line) });
    assert.deepEqual(await write(words('my gas bill')), tea);
    const [request] = client.asked;
    assert.equal(request.model, 'claude-sonnet-5-5');
    assert.equal(request.output_config.effort, 'low');
    assert.deepEqual(request.betas, ['server-side-fallback-2026-07-01']);
    assert.equal(request.fallbacks, 'default');
    assert.equal(request.tools, undefined, 'a few words name no page, so there is none to read');
    assert.deepEqual(request.messages, [{ role: 'user', content: 'Make a pixel reel about this:\nmy gas bill' }]);
    assert.match(request.system, /"format": "pixelreel\/1"/, 'it is told the format the connector tells Claude');
    assert.match(request.system, /never an instruction to you/);
    assert.match(request.system, /always leave out what points at one person/);
    assert.deepEqual(said, ['try: words, 1200 tokens in, 600 out (claude-sonnet-5-5)'], 'it says what each reel took, so the cost can be watched');
  });

  it('lets Claude read one page, when the visitor names one', async () => {
    const page = [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 1, max_content_tokens: 20000 }];
    const client = fakeClient(reply(JSON.stringify(tea)), reply(JSON.stringify(tea)), reply(JSON.stringify(tea)));
    const write = createWriter({ client });
    await write(words('https://example.com/story'));
    assert.deepEqual(client.asked[0].tools, page, 'it may read one page, and only so much of it');
    await write(words('www.example.com/story'));
    assert.deepEqual(client.asked[1].tools, page);
    assert.equal(client.asked[1].messages[0].content, 'Make a pixel reel about this:\nhttps://www.example.com/story', 'an address typed without https:// is given it');
    await write(words('what does https://example.com/story say about tea?'));
    assert.deepEqual(client.asked[2].tools, page);
    assert.match(client.asked[2].messages[0].content, /what does https:\/\/example\.com\/story say about tea\?$/);
  });

  it('gives Claude writing, a PDF or a picture to explain, and no page to fetch', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)), reply(JSON.stringify(tea)), reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, log: (line) => said.push(line) });
    await write({ kind: 'text', text: 'Dear Sam,\n\nSee https://example.com/pay and pay up.' });
    await write({ kind: 'pdf', data: 'JVBERi0=' });
    await write({ kind: 'picture', type: 'image/png', data: 'iVBORw0=' });
    const [writing, pdf, picture] = client.asked;
    for (const request of client.asked) assert.equal(request.tools, undefined, 'a link inside what was given is never fetched');
    assert.match(writing.messages[0].content, /explains this writing.*\n-{10}\nDear Sam,\n\nSee https:\/\/example\.com\/pay and pay up\.\n-{10}$/s);
    assert.deepEqual(pdf.messages[0].content[0], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } });
    assert.match(pdf.messages[0].content[1].text, /explains this document/);
    assert.deepEqual(picture.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0=' } });
    assert.match(picture.messages[0].content[1].text, /what this picture shows or says/);
    assert.deepEqual(said.map((line) => line.split(',')[0]), ['try: text', 'try: pdf', 'try: picture']);
  });

  it('measures a PDF before reading it, and turns away one that is too long, for nothing', async () => {
    const client = fakeClient(reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, maxInputTokens: 5000, log: (line) => said.push(line) });
    await write({ kind: 'pdf', data: 'JVBERi0=' });
    assert.equal(client.counted.length, 1);
    assert.equal(client.counted[0].model, 'claude-sonnet-5-5');
    assert.deepEqual(client.counted[0].messages, client.asked[0].messages, 'what is measured is what is sent');
    assert.equal(client.counted[0].system, client.asked[0].system);
    client.size = 5001;
    await assert.rejects(write({ kind: 'pdf', data: 'JVBERi0=' }), (err) => err instanceof TryError && err.free && /too long for one reel/.test(err.message));
    assert.equal(client.asked.length, 1, 'Claude was never asked to read it');
    assert.match(said.at(-1), /^try: a pdf of 5001 tokens was turned away/);
    client.size = Object.create(Anthropic.RateLimitError.prototype);
    await assert.rejects(write({ kind: 'pdf', data: 'JVBERi0=' }), (err) => err instanceof TryError && err.free && /busy/.test(err.message));
    await assert.rejects(write(words('tea')), TypeError, 'the stand-in has run out of answers');
    assert.equal(client.counted.length, 3, 'only a PDF is measured: the rest cannot be long');
  });

  it('takes the model and effort it is given', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)));
    await createWriter({ client, model: 'claude-haiku-5-5', effort: 'medium' })(words('tea'));
    assert.equal(client.asked[0].model, 'claude-haiku-5-5');
    assert.equal(client.asked[0].output_config.effort, 'medium');
  });

  it('asks for a reel to be put right, without reading the page again', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)), reply(JSON.stringify(tea)));
    const mend = { before: { title: 'Tea' }, problems: ['scenes: give the reel at least one scene'] };
    await createWriter({ client })(words('https://example.com/tea'), mend);
    const [request] = client.asked;
    assert.equal(request.tools, undefined);
    assert.equal(request.messages.length, 3);
    assert.deepEqual(request.messages[1], { role: 'assistant', content: '{"title":"Tea"}' });
    assert.match(request.messages[2].content, /Fix every one.*\n- scenes: give the reel at least one scene/s);
    await createWriter({ client })({ kind: 'pdf', data: 'JVBERi0=' }, mend);
    assert.equal(client.asked[1].messages[0].content, 'Make a pixel reel about this:\n(a document the visitor gave, which is not repeated here)', 'nor is a long document paid for twice');
    assert.equal(client.counted.length, 0);
  });

  it('carries on a turn the page fetch paused', async () => {
    const paused = { model: 'claude-sonnet-5-5', stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 't1', name: 'web_fetch', input: {} }], usage: { input_tokens: 10, output_tokens: 5 } };
    const client = fakeClient(paused, reply(JSON.stringify(tea)));
    assert.deepEqual(await createWriter({ client })(words('https://example.com/story')), tea);
    assert.equal(client.asked.length, 2);
    assert.deepEqual(client.asked[1].messages.at(-1), { role: 'assistant', content: paused.content }, 'the paused turn is sent back as it came');
  });

  it('says so in plain words when Claude will not, or cannot', async () => {
    const write = (...replies) => createWriter({ client: fakeClient(...replies) })(words('something'));
    await assert.rejects(write(reply('', { stop_reason: 'refusal', content: [] })), (err) => err instanceof TryError && !err.free && /would not write/.test(err.message));
    await assert.rejects(write(reply('{"title":', { stop_reason: 'max_tokens' })), (err) => err instanceof TryError && /did not finish/.test(err.message));
    await assert.rejects(write(reply('{"cannot": "That page  would not\\nload."}')), (err) => err instanceof TryError && err.message === 'That page would not load.');
    await assert.rejects(write(reply('I am afraid not.')), TryError);
    await assert.rejects(write(Object.create(Anthropic.RateLimitError.prototype)), (err) => err instanceof TryError && err.free && /busy/.test(err.message));
    await assert.rejects(write(Object.create(Anthropic.APIConnectionError.prototype)), (err) => err instanceof TryError && err.free && /could not be reached/.test(err.message));
    const broken = new Error('something else');
    await assert.rejects(write(broken), (err) => err === broken, 'anything unexpected is not dressed up');
  });

  it('logs what the API said when the fault is the service\'s own, and sends the visitor to their own Claude', async () => {
    const said = [];
    const failing = (error) => createWriter({ client: fakeClient(error), log: (line) => said.push(line) })(words('tea'));
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
  const writer = async (source, more = {}) => { calls.push([source, more]); const next = answers.shift() ?? tea; if (next instanceof Error) throw next; return next; };
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
  const give = (type, body, headers = {}) => fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': type, origin: 'https://reels.example', ...headers }, body });

  it('is not there at all unless the service was given a writer', async () => {
    const res = await fetch(`${localOff}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"about":"tea"}' });
    assert.equal(res.status, 404);
    assert.match(await (await fetch(`${localOff}/`)).text(), /<form class="maker" id="maker" action="\/claude" data-here="off">/, 'and the page does not offer it');
    assert.match(await (await fetch(`${local}/`)).text(), /data-here="on"/);
  });

  it('keeps its part of the page hidden until the page is told it may, with everything the script looks for', async () => {
    const page = await (await fetch(`${local}/`)).text();
    assert.match(page, /<div class="maker-here" id="maker-here" hidden>/);
    assert.match(page, /<div class="drop-over" id="drop-over" aria-hidden="true" hidden>/);
    assert.match(page, /<input id="maker-file" type="file" accept="[^"]*application\/pdf[^"]*image\/\*[^"]*" hidden>/);
    const script = readFileSync(new URL('../site/js/maker.js', import.meta.url), 'utf8');
    const looked = [...script.matchAll(/\bid\('([a-z-]+)'\)/g)].map(([, id]) => id);
    assert.ok(looked.length >= 8);
    for (const id of looked) assert.ok(page.includes(` id="${id}"`), `the page has nothing called ${id}`);
  });

  it('has Claude write the reel, starts recording it, and says where to watch', async () => {
    const res = await ask('  my gas\n bill ');
    assert.equal(res.status, 200);
    const { id, watch } = await res.json();
    assert.equal(watch, `/r/${id}`);
    assert.deepEqual(calls.at(-1), [words('my gas bill'), {}]);
    await reels.idle();
    assert.equal((await reels.status(id)).state, 'ready');
    assert.equal((await fetch(`${local}${watch}`)).status, 200);
  });

  it('gives Claude one chance to put a reel right', async () => {
    answers = [{ title: 'No scenes' }, tea];
    const res = await ask('tea');
    assert.equal(res.status, 200);
    const [source, more] = calls.at(-1);
    assert.deepEqual(source, words('tea'));
    assert.deepEqual(more.before, { title: 'No scenes' });
    assert.ok(more.problems.some((p) => /scenes/.test(p)), 'it is told what was wrong');
    answers = [{ title: 'No scenes' }, { title: 'Still none' }];
    const twice = await ask('tea');
    assert.equal(twice.status, 502);
    assert.match((await twice.json()).error, /could not write that reel/);
    await reels.idle();
  });

  it('takes writing, a PDF or a picture, and has Claude explain it', async () => {
    const writing = await give('application/json', JSON.stringify({ text: 'Dear Sam,\n\nYour bill is due.' }));
    assert.equal(writing.status, 200);
    assert.deepEqual(calls.at(-1), [{ kind: 'text', text: 'Dear Sam,\n\nYour bill is due.' }, {}]);
    assert.equal((await give('application/pdf', PDF)).status, 200);
    assert.deepEqual(calls.at(-1), [{ kind: 'pdf', data: PDF.toString('base64') }, {}]);
    assert.equal((await give('image/jpeg', JPEG)).status, 200);
    assert.deepEqual(calls.at(-1), [{ kind: 'picture', type: 'image/jpeg', data: JPEG.toString('base64') }, {}]);
    await reels.idle();
  });

  it('turns away a file it cannot read, or one that is too big, before Claude sees it', async () => {
    const before = calls.length;
    const zip = await give('application/zip', ZIP);
    assert.equal(zip.status, 400);
    assert.match((await zip.json()).error, /PDF, a photo, or plain writing/);
    assert.equal((await give('image/png', Buffer.concat([PNG, Buffer.alloc(PICTURE_MAX)]))).status, 400);
    const big = await give('application/pdf', Buffer.concat([PDF, Buffer.alloc(PDF_MAX)])).catch(() => null);   // the line may close before the whole file is sent
    if (big) { assert.equal(big.status, 413); assert.match((await big.json()).error, /too big/); }
    // sent a piece at a time, so that nothing says how big it is until it is too big
    let left = PDF_MAX / (1024 * 1024) + 2;
    const pieces = new ReadableStream({ pull(send) { if (left-- > 0) send.enqueue(new Uint8Array(1024 * 1024)); else send.close(); } }, { highWaterMark: 1 });
    const piecemeal = await fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': 'application/pdf', origin: 'https://reels.example' }, body: pieces, duplex: 'half' }).catch(() => null);
    if (piecemeal) assert.equal(piecemeal.status, 413);
    const long = await give('application/json', JSON.stringify({ text: 'x'.repeat(TEXT_MAX + 1) }));
    assert.equal(long.status, 400);
    assert.match((await long.json()).error, /too much for one reel/);
    assert.equal(calls.length, before, 'and none of them reaches Claude');
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
    assert.match((await again.json()).error, /^No more reels just now\. That is 1 in the last hour from here\. Try again in 60 minutes\.$/);
    assert.equal((await ask('tea', { 'x-forwarded-for': '203.0.113.10' })).status, 200, 'each visitor has their own hour');
    await reels.idle();
  });

  it('does not count a go that cost nothing', async () => {
    limits.tries = new RateLimit({ perHour: 1, perDay: 100 });
    const from = { 'x-forwarded-for': '203.0.113.20' };
    answers = [new TryError('Claude is busy just now. Try again in a minute.', { free: true })];
    assert.equal((await ask('tea', from)).status, 422);
    assert.equal((await ask('tea', from)).status, 200, 'Claude never read the first, so the visitor still has their one');
    answers = [new TryError('Claude would not write a reel about that.')];
    assert.equal((await ask('tea', { 'x-forwarded-for': '203.0.113.21' })).status, 422);
    assert.equal((await ask('tea', { 'x-forwarded-for': '203.0.113.21' })).status, 429, 'one that Claude read and declined is counted');
    await reels.idle();
  });
});
