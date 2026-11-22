import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, describe, it } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { RateLimit } from '../service/limits.mjs';
import { Reels } from '../service/reels.mjs';
import { ReelError } from '../src/reel.js';
import { createService } from '../service/server.mjs';
import { sitePage, whoChoices } from '../service/site.mjs';
import { DiskStore } from '../service/store.mjs';
import { ABOUT_MAX, AGAIN, bracedIn, languageOf, narratorOf, OWN_NAMES, PDF_MAX, PICTURE_MAX, replyJson, sourceOf, TEXT_MAX, tidyAbout, tidyText, TryError, writtenSoFar } from '../service/try.mjs';
import { createWriter, PAGE_READER, PAGE_TOKENS } from '../service/writer.mjs';

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
    // a video cannot be watched, and Claude cannot load its page: said before it costs anything
    for (const video of ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'youtu.be/jNQXAC9IVRw', 'https://m.youtube.com/shorts/abc123']) {
      assert.throws(() => tidyAbout(video), (err) => err instanceof TryError && /cannot watch a video.*transcript.*paste it here/.test(err.message), video);
    }
    assert.equal(tidyAbout('what is youtube.com/watch about'), 'what is youtube.com/watch about', 'words about a video are still words');
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
    assert.deepEqual(sourceOf('application/json', json({ about: ' my gas  bill ' })), { ...words('my gas bill'), language: undefined, narrator: undefined });
    assert.deepEqual(sourceOf('application/json; charset=utf-8', json({ text: 'Dear Sam,\n\nPay up.' })), { kind: 'text', text: 'Dear Sam,\n\nPay up.', language: undefined, narrator: undefined });
    assert.deepEqual(sourceOf('application/pdf', PDF), { kind: 'pdf', data: PDF.toString('base64') });
    assert.deepEqual(sourceOf('image/jpeg', JPEG), { kind: 'picture', type: 'image/jpeg', data: JPEG.toString('base64') });
    assert.deepEqual(sourceOf('application/pdf', PNG), { kind: 'picture', type: 'image/png', data: PNG.toString('base64') }, 'a picture called a PDF is still a picture');
    assert.deepEqual(sourceOf(undefined, PDF), { kind: 'pdf', data: PDF.toString('base64') });
    assert.throws(() => sourceOf('application/pdf', ZIP), (err) => err instanceof TryError && /PDF, a photo, or plain writing/.test(err.message));
    assert.throws(() => sourceOf('image/png', Buffer.from('<svg onload="x()">')), TryError);
    assert.throws(() => sourceOf('image/jpeg', Buffer.concat([JPEG, Buffer.alloc(PICTURE_MAX)])), /too big/);
    for (const bad of ['{oops', '', 'null', '{"about":7}']) assert.throws(() => sourceOf('application/json', Buffer.from(bad)), TryError);
    // a reel made earlier, to be written again
    assert.deepEqual(sourceOf('application/json', json({ again: 'abcdefghijklmnopqrstuv', how: 'simpler' })), { kind: 'again', id: 'abcdefghijklmnopqrstuv', how: 'simpler' });
    assert.deepEqual(Object.keys(AGAIN), ['simpler', 'shorter']);
    for (const bad of [{ again: 'abcdefghijklmnopqrstuv', how: 'ruder' }, { again: 'abcdefghijklmnopqrstuv' }, { again: '../etc', how: 'shorter' }, { again: 7, how: 'shorter' }, { again: 'abcdefghijklmnopqrstuv', how: 'constructor' }]) {
      assert.throws(() => sourceOf('application/json', json(bad)), (err) => err instanceof TryError && /cannot be made again/.test(err.message));
    }
  });

  it('reads how far a reel has got from as much of it as is written', () => {
    assert.deepEqual(writtenSoFar(''), { title: null, scenes: 0 });
    assert.deepEqual(writtenSoFar('Here you are:\n```json\n{"format": "pixelreel/1", "title": "How a \\"mortg'), { title: null, scenes: 0 }, 'a title is not one until it is finished');
    const start = '{"format": "pixelreel/1", "title": "How a \\"mortgage\\" works", "scenes": [{"title": "Hello", "caption": "It is a loan.", "say": "A mortgage is a loan."}, {"title": "Two", ';
    assert.deepEqual(writtenSoFar(start), { title: 'How a "mortgage" works', scenes: 1 });
    assert.deepEqual(writtenSoFar(`${start}"caption": "You pay it`), { title: 'How a "mortgage" works', scenes: 1 }, 'nor is a scene until its caption is');
    assert.deepEqual(writtenSoFar(`${start}"caption": "You pay it back.", "picture": {"type": "chat", "title": "Bank"}}]}`), { title: 'How a "mortgage" works', scenes: 2 });
    assert.deepEqual(writtenSoFar('{"scenes": [{"title": "Hello", "caption": "One."}], "title": "Late"}'), { title: null, scenes: 1 }, "a scene's title is never taken for the reel's");
    assert.equal(writtenSoFar(`{"title": "${'x'.repeat(200)}"`).title.length, 80);
    assert.deepEqual(writtenSoFar('{"cannot": "That page would not load."}'), { title: null, scenes: 0 });
  });

  it('takes a reel to be in English unless it is asked for in a language Peter can read here', () => {
    for (const none of [undefined, null, '', 'english']) assert.equal(languageOf(none, ['french']), null);
    assert.equal(languageOf('french', ['french', 'spanish']), 'french');
    for (const not of ['german', 'klingon', 7, ['french'], 'French']) assert.throws(() => languageOf(not, ['french']), (err) => err instanceof TryError && /cannot read that language here/.test(err.message));
    assert.throws(() => languageOf('french'), TryError, 'none is offered unless the service says so');
    assert.equal(OWN_NAMES.french, 'Français');
    // what was asked for is carried with the words, as it came
    const json = (value) => Buffer.from(JSON.stringify(value));
    assert.deepEqual(sourceOf('application/json', json({ about: 'le thé', language: 'french' })), { kind: 'words', about: 'le thé', language: 'french', narrator: undefined });
    assert.deepEqual(sourceOf('application/json', json({ text: 'Cher Sam,\n\nPayez.', language: 'french' })), { kind: 'text', text: 'Cher Sam,\n\nPayez.', language: 'french', narrator: undefined });
  });

  it('takes Peter to be reading unless a narrator who reads here is asked for', () => {
    for (const none of [undefined, null, '', 'peter']) assert.equal(narratorOf(none, ['anna']), null);
    assert.equal(narratorOf('anna', ['anna', 'paul']), 'anna');
    for (const not of ['vera', 'Anna', 7, ['anna'], 'constructor']) assert.throws(() => narratorOf(not, ['anna']), (err) => err instanceof TryError && /does not read here/.test(err.message));
    assert.throws(() => narratorOf('anna'), TryError, 'nobody but Peter reads unless the service says so');
    const json = (value) => Buffer.from(JSON.stringify(value));
    assert.deepEqual(sourceOf('application/json', json({ about: 'tea', narrator: 'anna' })), { kind: 'words', about: 'tea', language: undefined, narrator: 'anna' });
  });

  it("finds the reel in Claude's reply, even inside a code fence", () => {
    assert.deepEqual(replyJson('{"title":"Tea"}'), { title: 'Tea' });
    assert.deepEqual(replyJson('Here you are:\n```json\n{"title":"Tea","scenes":[{"a":1}]}\n```\n'), { title: 'Tea', scenes: [{ a: 1 }] });
    assert.throws(() => replyJson('Sorry, I cannot.'), TryError);
    assert.throws(() => replyJson('{ not json }'), TryError);
    // a reel written twice in one reply: the last one is the one Claude means
    const first = '{"format":"pixelreel/1","title":"First go","scenes":[{"say":"A } in what is said, and a { too."}]}', second = '{"format":"pixelreel/1","title":"Second go","scenes":[{"say":"Better."}]}';
    assert.equal(replyJson(first).scenes[0].say, 'A } in what is said, and a { too.', 'a brace inside words is only a brace');
    assert.equal(replyJson(`${first}\n\nOn reflection, a plainer one:\n\n${second}`).title, 'Second go');
    assert.equal(replyJson(`I will use {curly brackets} here. ${second} That is it.`).title, 'Second go', 'and some words in braces are not a reel');
    assert.deepEqual(replyJson(`${second}\n{"note":"sources"}`).title, 'Second go', 'nor is something else in braces after it');
    assert.deepEqual(bracedIn(`a {b} c ${second} {"d": "}"}`), ['{b}', second, '{"d": "}"}']);
    for (const cut of ['{"title":', '{"title":"Tea","scenes":[{"say":"Cut off', '']) assert.throws(() => replyJson(cut), TryError);
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
      // the reply arrives a piece at a time, as it does from the API, and is whole at the end
      beta: { messages: { stream: (request) => {
        asked.push(structuredClone(request));
        const next = replies.shift(), heard = [];
        const stream = {
          on(event, hear) { if (event === 'text') heard.push(hear); return stream; },
          async finalMessage() {
            if (next instanceof Error) throw next;
            const text = next.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
            for (let at = 0; at < text.length; at += 7) for (const hear of heard) hear(text.slice(at, at + 7), text.slice(0, at + 7));
            return next;
          }
        };
        return stream;
      } } }
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

  it('says how far Claude has got, as it writes', async () => {
    const two = { ...tea, scenes: [tea.scenes[0], { title: 'Pour', caption: 'Pour it.', say: 'Pour it out.', picture: { type: 'chat', title: 'Tea?', messages: [{ from: 'Sam', text: 'Tea?' }] } }] };
    const told = [];
    assert.deepEqual(await createWriter({ client: fakeClient(reply(JSON.stringify(two))) })(words('tea'), { onProgress: (so) => told.push(so) }), two);
    assert.deepEqual(told, [{ title: 'Tea', scenes: 0 }, { title: 'Tea', scenes: 1 }, { title: 'Tea', scenes: 2 }], 'its name, then each scene as it is finished, and only when there is news');
    await createWriter({ client: fakeClient(reply(JSON.stringify(tea))) })(words('tea'));   // nobody need be listening
  });

  it('logs every kind of token a reel took, so that its cost can be worked out from the line', async () => {
    const said = [];
    const usage = { input_tokens: 48617, output_tokens: 1227, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_fetch_requests: 1 } };
    const cached = { input_tokens: 900, output_tokens: 1100, cache_creation_input_tokens: 12000, cache_read_input_tokens: 24000 };
    const client = fakeClient(reply(JSON.stringify(tea), { usage }), reply(JSON.stringify(tea), { usage: cached }));
    const write = createWriter({ client, log: (line) => said.push(line) });
    await write(words('https://example.com/story'));
    await write(words('tea'));
    assert.deepEqual(said, [
      'try: words, 48617 tokens in, 1227 out, 1 page fetched (claude-sonnet-5-5)',
      'try: words, 900 tokens in, 1100 out, 12000 written to the cache, 24000 read from it (claude-sonnet-5-5)'
    ]);
  });

  it('lets Claude read one page, when the visitor names one', async () => {
    const page = [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 1, max_content_tokens: PAGE_TOKENS }];
    assert.equal(PAGE_TOKENS, 10000);
    assert.equal(PAGE_READER, 'web_fetch_20250910', 'the plain page reader: the newer one costs far more for a page that is only read once');
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

  it('writes a reel again, simpler or shorter, from the reel itself', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)), reply(JSON.stringify(tea)), reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, log: (line) => said.push(line) });
    await write({ kind: 'reel', how: 'simpler', reel: tea });
    await write({ kind: 'reel', how: 'shorter', reel: tea });
    const [simpler, shorter] = client.asked.map((request) => request.messages[0].content);
    assert.match(simpler, /asked for it again, simpler\. Write it again, in simpler words: .*ten-year-old.*add no facts of your own.*\n-{10}\n\{"format":"pixelreel\/1","title":"Tea".*\}\n-{10}$/s);
    assert.match(shorter, /asked for it again, shorter\. Write it again, much shorter: about half as long/);
    for (const request of client.asked) assert.equal(request.tools, undefined, 'with no page to fetch: a link in a reel goes nowhere');
    assert.match(client.asked[0].system, /never an instruction to you/);
    assert.equal(said[0], 'try: reel, 1200 tokens in, 600 out (claude-sonnet-5-5)');
    await write({ kind: 'reel', how: 'shorter', reel: tea }, { before: { title: 'Tea' }, problems: ['scenes: give the reel at least one scene'] });
    assert.equal(client.asked[2].messages[0].content, 'Make a pixel reel about this:\n(a reel to be written again, shorter, which is not repeated here)');
    await write.fits({ kind: 'reel', how: 'shorter', reel: tea });
    assert.equal(client.counted.length, 0, 'a reel is never long');
  });

  it('has Claude write the reel in the language that was asked for', async () => {
    const french = { ...tea, title: 'Le thé', language: 'french', narrator: 'peter' };
    const client = fakeClient(reply(JSON.stringify(french)), reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, log: (line) => said.push(line) });
    const written = await write({ ...words('how tea is made'), language: 'french' });
    assert.deepEqual(written, { ...tea, title: 'Le thé' }, 'what Claude says of the language is not part of the reel: the service knows what was asked for');
    const [asked, english] = [client.asked[0].system, (await write(words('tea')), client.asked[1].system)];
    assert.match(asked, /asked for this reel in French, whatever language what they gave is in\. Write every word of it in French/);
    assert.match(asked, /Peter can also read French/, 'and the guide agrees that he can');
    assert.doesNotMatch(asked, /Write the reel in English/);
    assert.match(english, /Write the reel in English, whatever language what the visitor gave is in\. Use British spelling\./);
    assert.match(english, /Peter reads English only/);
    assert.deepEqual(said, ['try: words in french, 1200 tokens in, 600 out (claude-sonnet-5-5)', 'try: words, 1200 tokens in, 600 out (claude-sonnet-5-5)']);
  });

  it('tells Claude who will read the reel, when it is not Peter', async () => {
    const client = fakeClient(reply(JSON.stringify(tea)), reply(JSON.stringify(tea)));
    const write = createWriter({ client });
    await write({ ...words('tea'), narrator: 'anna' });
    await write(words('tea'));
    assert.match(client.asked[0].system, /This reel will be read by Anna, not Peter.*Never have the narrator say they are Peter\./);
    assert.doesNotMatch(client.asked[1].system, /will be read by/);
  });

  it('measures a PDF before it is read, and turns away one that is too long, for nothing', async () => {
    const client = fakeClient(reply(JSON.stringify(tea))), said = [];
    const write = createWriter({ client, maxInputTokens: 5000, log: (line) => said.push(line) });
    const pdf = { kind: 'pdf', data: 'JVBERi0=' };
    await write.fits(pdf);
    assert.equal(client.counted.length, 1);
    assert.equal(client.counted[0].model, 'claude-sonnet-5-5');
    await write(pdf);
    assert.deepEqual(client.counted[0].messages, client.asked[0].messages, 'what is measured is what is sent');
    assert.equal(client.counted[0].system, client.asked[0].system);
    assert.equal(client.counted.length, 1, 'and it is measured once, not again when it is read');
    client.size = 5001;
    await assert.rejects(write.fits(pdf), (err) => err instanceof TryError && err.free && /too long for one reel/.test(err.message));
    assert.match(said.at(-1), /^try: a pdf of 5001 tokens was turned away/);
    client.size = Object.create(Anthropic.RateLimitError.prototype);
    await assert.rejects(write.fits(pdf), (err) => err instanceof TryError && err.free && /busy/.test(err.message));
    for (const short of [words('tea'), { kind: 'text', text: 'Dear Sam' }, { kind: 'picture', type: 'image/png', data: 'iVBORw0=' }]) await write.fits(short);
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
  });

  it('sends a reply that cannot be read back once, to be put right, without reading the page again', async () => {
    const cut = '{"format":"pixelreel/1","title":"Tea","scenes":[{"title":"Kettle","caption":"Boil it.","say":"Boil the';
    const client = fakeClient(reply(cut), reply(JSON.stringify(tea))), said = [];
    assert.deepEqual(await createWriter({ client, log: (line) => said.push(line) })(words('https://example.com/tea')), tea);
    assert.equal(client.asked.length, 2);
    const [, again] = client.asked;
    assert.equal(again.tools, undefined, 'the page is not paid for twice');
    assert.deepEqual(again.messages[1], { role: 'assistant', content: cut }, 'Claude is shown what it wrote');
    assert.match(again.messages[2].content, /could not be read as one JSON object\. Reply with the reel as one JSON object and nothing else/);
    assert.equal(said[1], `try: a reply that could not be read: 1 pieces of text, ${cut.length} characters, 0 of them in braces`, 'the log says what it looked like, never what it said');
    // a plain refusal in words is asked for properly, and its reason passed on
    const refusing = fakeClient(reply('I am afraid I cannot read that page.'), reply('{"cannot": "That page would not load."}'));
    await assert.rejects(createWriter({ client: refusing })(words('https://example.com/gone')), (err) => err instanceof TryError && err.message === 'That page would not load.');
    // and it is asked only once
    const stubborn = fakeClient(reply(cut), reply(cut));
    await assert.rejects(createWriter({ client: stubborn })(words('tea')), (err) => err instanceof TryError && /did not write a reel that time/.test(err.message));
    assert.equal(stubborn.asked.length, 2);
    // nothing at all to put right is not sent back
    const silent = fakeClient(reply(''));
    await assert.rejects(createWriter({ client: silent })(words('tea')), TryError);
    assert.equal(silent.asked.length, 1);
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
    await assert.rejects(write(reply('I am afraid not.'), reply('Still not.')), (err) => err instanceof TryError && /did not write a reel that time/.test(err.message));
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

describe('a reel that is still being written', () => {
  const said = [];
  /** A recorder that says each line as it finishes it, as npm run voices does, and waits to be let go half way. */
  const hold = {};
  const record = async (dir, log, onLine) => {
    await fakeRecord(dir);
    onLine(1, 2);
    hold.reached?.();
    await hold.until;
    onLine(2, 2);
  };
  const store = new DiskStore(join(tmp, 'writing'));
  const reels = new Reels({ store, record, video: async () => {}, picture: async () => new Uint8Array([1]), log: (line) => said.push(line) });
  const two = { ...tea, scenes: [tea.scenes[0], { title: 'Pour', caption: 'Pour it.', say: 'Pour it out.', picture: { type: 'big', text: 'POUR' } }] };

  it('has an id and a place in the store before it has any scenes', async () => {
    const begun = await reels.begin('Your reel');
    assert.deepEqual([begun.state, begun.title, begun.scenes, begun.video], ['writing', 'Your reel', 0, 'none']);
    assert.deepEqual(await reels.status(begun.id), begun);
    assert.equal(await reels.reel(begun.id), null);
    assert.equal(await reels.card(begun.id), null, 'and no picture to show yet');
    assert.deepEqual(reels.progress(begun.id), {});
    reels.note(begun.id, { title: null, scenes: 0 });
    assert.deepEqual(reels.progress(begun.id), { written: 0 });
    reels.note(begun.id, { title: 'Tea', scenes: 2 });
    assert.deepEqual(reels.progress(begun.id), { written: 2, title: 'Tea' }, 'how far the writing has got is kept for its page');
    assert.equal((await reels.status(begun.id)).title, 'Your reel', 'and nowhere else, until it is written');
    await assert.rejects(reels.write(begun.id, { title: 'No scenes' }), ReelError);
    assert.equal((await reels.status(begun.id)).state, 'writing', 'scenes with problems leave it waiting for better ones');
    await reels.fail(begun.id, 'That page would not load.');
    assert.deepEqual(await reels.status(begun.id).then((s) => [s.state, s.error]), ['failed', 'That page would not load.']);
    assert.deepEqual(reels.progress(begun.id), {}, 'with nothing more to say of how far it got');
    assert.equal(await reels.write(begun.id, tea), null, 'one that was given up on stays given up on');
    assert.equal(await reels.card(begun.id), null);
    assert.equal(await reels.write('abcdefghijklmnopqrstuv', tea), null);
  });

  it('is recorded once it is written, and says how far that has got', async () => {
    const begun = await reels.begin('Your reel');
    let reached;
    const half = new Promise((ok) => { reached = ok; });
    hold.reached = reached;
    hold.until = new Promise((ok) => { hold.release = ok; });
    const written = await reels.write(begun.id, two);
    assert.deepEqual([written.id, written.state, written.title, written.scenes], [begun.id, 'queued', 'Tea', 2]);
    assert.ok(written.seconds > 0);
    assert.equal(written.expires, begun.expires, 'it is kept from when it was begun');
    const next = await reels.create(tea);
    assert.deepEqual(reels.progress(next.id), { ahead: 1 }, 'one behind it waits its turn');
    await half;
    for (let i = 0; i < 100 && (await reels.status(begun.id)).recorded !== 1; i++) await new Promise((ok) => setTimeout(ok, 5));
    assert.deepEqual(await reels.status(begun.id).then((s) => [s.state, s.recorded, s.lines]), ['recording', 1, 2], 'and its page can say how far Peter has got');
    assert.deepEqual(reels.progress(begun.id), {}, 'it is not waiting any more');
    hold.release();
    hold.reached = null;
    await reels.idle();
    assert.equal((await reels.status(begun.id)).state, 'ready');
    assert.deepEqual(reels.progress(begun.id), {});
    assert.equal(await reels.write(begun.id, tea), null, 'and it is written only once');
  });

  it('gives whoever began it a key, which alone says they own it', async () => {
    const begun = await reels.begin('Your reel', { owned: true });
    assert.match(begun.key, /^[A-Za-z0-9_-]{32}$/);
    assert.equal((await reels.status(begun.id)).key, undefined, 'the key itself is kept nowhere');
    assert.ok(!JSON.stringify(await store.get(`reels/${begun.id}/owner.txt`).then(String)).includes(begun.key));
    assert.equal(await reels.owns(begun.id, begun.key), true);
    for (const wrong of [`${begun.key}x`, 'x', '', undefined, 7, begun.id]) assert.equal(await reels.owns(begun.id, wrong), false);
    const other = await reels.begin('Your reel', { owned: true });
    assert.equal(await reels.owns(other.id, begun.key), false, 'a key opens its own reel only');
    const plain = await reels.begin('Your reel');
    assert.equal(plain.key, undefined);
    assert.equal(await reels.owns(plain.id, ''), false, 'and a reel begun without one is nobody\'s to delete');
    assert.equal(await reels.owns('abcdefghijklmnopqrstuv', begun.key), false);
    for (const each of [begun, other, plain]) await reels.remove(each.id);
  });

  it('is given up on, and whoever is waiting told so, if the service restarts before it is written', async () => {
    const begun = await reels.begin('Your reel');
    const after = new Reels({ store, record: fakeRecord, video: async () => {} });
    await after.resume();
    await after.idle();
    assert.deepEqual(await after.status(begun.id).then((s) => [s.state, s.error]), ['failed', 'Pixel Reel was restarted while it was being written. Make it again.']);
  });

  it('is not begun when too many reels are waiting', async () => {
    const full = new Reels({ store, record: fakeRecord, video: async () => {}, maxQueue: 0 });
    await assert.rejects(full.begin('Your reel'), /busy recording/);
  });
});

describe('make it right here, over HTTP', () => {
  const calls = [];
  let answers = [];
  const writer = async (source, more = {}) => { calls.push([source, more]); const next = await (answers.shift() ?? tea); if (next instanceof Error) throw next; return next; };
  const spoken = [], voices = [];   // the language each reel was recorded in, and the voice it was read in
  const recordIn = async (dir, log, onLine, { language = null, voice = null } = {}) => { spoken.push(language); voices.push(voice); await fakeRecord(dir); };
  const reels = new Reels({ store: new DiskStore(join(tmp, 'store')), record: recordIn, video: async () => {}, languages: ['french', 'spanish'], narrators: ['anna', 'stuart'] });
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
  // a writer that a test is holding back is let go when the test ends, however it ends: a check that fails must not leave the rest waiting for ever
  const holding = [];
  afterEach(() => { for (const release of holding.splice(0)) release(); });
  const ask = (about, headers = {}) => fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://reels.example', ...headers }, body: JSON.stringify({ about }) });
  const give = (type, body, headers = {}) => fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': type, origin: 'https://reels.example', ...headers }, body });

  it('is not there at all unless the service was given a writer', async () => {
    const res = await fetch(`${localOff}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"about":"tea"}' });
    assert.equal(res.status, 404);
    assert.match(await (await fetch(`${localOff}/make`)).text(), /<form class="maker" id="maker" action="\/claude" data-here="off">/, 'and its page does not offer it');
    assert.match(await (await fetch(`${local}/make`)).text(), /<form class="maker" id="maker" action="\/claude" data-here="on">/);
    // the home page has no form: it says what the form does, and has a button that goes to it
    const home = await (await fetch(`${local}/`)).text();
    assert.doesNotMatch(home, /id="maker"/);
    assert.match(home, /<section class="section section-tint" id="make" aria-labelledby="make-title" data-here="on">/);
    assert.match(home, /<a class="btn btn-gold btn-big" href="\/make">Make a pixel reel<\/a>/);
    // and "Want one of your own?" leads to the form on the pages the service sends out: in the theatre, and under one of the site's own reels
    const own = /<p id="theatre-own">Want one of your own\?<\/p>[\s\S]*?<a class="btn btn-gold" href="([^"]*)">([^<]*)<\/a>/;
    assert.deepEqual(own.exec(home).slice(1), ['/make', 'Make a pixel reel']);
    assert.deepEqual(own.exec(await (await fetch(`${localOff}/`)).text()).slice(1), ['/claude', 'Add Pixel Reel to Claude']);
    const under = /<h2 id="own-title">Want one of your own\?<\/h2>[\s\S]*?<a class="btn btn-gold btn-big" href="([^"]*)">([^<]*)<\/a>/;
    assert.deepEqual(under.exec(await (await fetch(`${local}/watch/offside-rule`)).text()).slice(1), ['/make', 'Make a pixel reel']);
    assert.deepEqual(under.exec(await (await fetch(`${localOff}/watch/offside-rule`)).text()).slice(1), ['/claude', 'Add Pixel Reel to Claude']);
  });

  it('tells a phone that a file may be shared to Pixel Reel, only where it can make a reel of one', async () => {
    const on = await fetch(`${local}/site/art/site.webmanifest`), told = await on.json();
    assert.equal(on.headers.get('content-type'), 'application/manifest+json');
    assert.deepEqual(told.share_target.params.files.map((taken) => taken.name), ['file']);
    const plain = await (await fetch(`${localOff}/site/art/site.webmanifest`)).json();
    assert.equal(plain.share_target.params.files, undefined, 'or a phone would offer Pixel Reel for a photo it cannot take');
    assert.deepEqual({ ...told, share_target: plain.share_target }, plain, 'and it is the same in every other way');
  });

  it('keeps its part of the page hidden until the page is told it may, with everything the script looks for', async () => {
    const page = await (await fetch(`${local}/make`)).text();
    assert.match(page, /<div class="maker-here" id="maker-here" hidden>/);
    assert.match(page, /<div class="drop-over" id="drop-over" aria-hidden="true" hidden>/);
    assert.match(page, /<input id="maker-file" type="file" accept="[^"]*application\/pdf[^"]*image\/\*[^"]*" hidden>/);
    const script = readFileSync(new URL('../site/js/maker.js', import.meta.url), 'utf8');
    const looked = [...script.matchAll(/\bid\('([a-z-]+)'\)/g)].map(([, id]) => id);
    assert.ok(looked.length >= 8);
    for (const id of looked) assert.ok(page.includes(` id="${id}"`), `the page has nothing called ${id}`);
  });

  /** Where the reel a request began has ended up, once it is written (or given up on) and recorded. */
  const outcome = async (res) => {
    assert.equal(res.status, 200);
    const { id } = await res.json();
    await server.written();
    await reels.idle();
    return reels.status(id);
  };
  const playOf = async (id) => (await fetch(`${local}/r/${id}/play.json`)).json();

  it('says where to watch at once, and has Claude write the reel while the visitor waits there', async () => {
    let release;
    const held = new Promise((ok) => { release = ok; });
    holding.push(release);
    answers = [held.then(() => tea)];
    const res = await ask('  my gas\n bill ');
    assert.equal(res.status, 200);
    const { id, watch } = await res.json();
    assert.equal(watch, `/r/${id}`);
    assert.deepEqual(calls.at(-1)[0], { ...words('my gas bill'), language: null, narrator: null });
    // Claude has not answered yet, and the reel already has a page to wait on
    assert.deepEqual(await reels.status(id).then((s) => [s.state, s.title]), ['writing', 'Your reel']);
    // and that page shows whoever is sent the reel the form that made it, not how to add a connector
    assert.match(await (await fetch(`${local}/r/${id}`)).text(), /<h2 id="own-title">Want one of your own\?<\/h2>[\s\S]*?<a class="btn btn-gold btn-big" href="\/make">Make a pixel reel<\/a>/);
    calls.at(-1)[1].onProgress({ title: 'Tea', scenes: 3 });
    assert.deepEqual(await playOf(id).then((p) => [p.state, p.title, p.written]), ['writing', 'Tea', 3], 'which is told its name and how many scenes are written, as Claude writes them');
    const page = await fetch(`${local}${watch}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<h1 class="sr-only" id="watch-title">Your reel<\/h1>/);
    assert.equal((await fetch(`${local}${watch}/card.png`, { redirect: 'manual' })).status, 302, 'with nothing of its own to show in a message yet');
    release();
    await server.written();
    await reels.idle();
    const status = await reels.status(id);
    assert.deepEqual([status.state, status.title, status.scenes], ['ready', 'Tea', 1], 'then it is a reel like any other, under its own name');
    assert.equal((await playOf(id)).reel.title, 'Tea');
  });

  it('gives Claude one chance to put a reel right', async () => {
    answers = [{ title: 'No scenes' }, tea];
    assert.equal((await outcome(await ask('tea'))).state, 'ready');
    const [source, more] = calls.at(-1);
    assert.deepEqual(source, { ...words('tea'), language: null, narrator: null });
    assert.deepEqual(more.before, { title: 'No scenes' });
    assert.ok(more.problems.some((p) => /scenes/.test(p)), 'it is told what was wrong');
    answers = [{ title: 'No scenes' }, { title: 'Still none' }];
    const twice = await outcome(await ask('tea'));
    assert.equal(twice.state, 'failed');
    assert.match(twice.error, /could not write that reel/);
  });

  it('takes writing, a PDF or a picture, and has Claude explain it', async () => {
    const writing = await give('application/json', JSON.stringify({ text: 'Dear Sam,\n\nYour bill is due.' }));
    assert.equal(writing.status, 200);
    assert.deepEqual(calls.at(-1)[0], { kind: 'text', text: 'Dear Sam,\n\nYour bill is due.', language: null, narrator: null });
    assert.equal((await give('application/pdf', PDF)).status, 200);
    assert.deepEqual(calls.at(-1)[0], { kind: 'pdf', data: PDF.toString('base64'), language: null, narrator: null });
    assert.equal((await give('image/jpeg', JPEG)).status, 200);
    assert.deepEqual(calls.at(-1)[0], { kind: 'picture', type: 'image/jpeg', data: JPEG.toString('base64'), language: null, narrator: null });
    await server.written();
    await reels.idle();
  });

  it('writes a reel again, simpler or shorter, as a new reel under the same name', async () => {
    // a reel that is ready, with the timings its recording gave its pictures
    const list = { ...tea, title: 'Tea, properly', scenes: [{ title: 'Steps', caption: 'Three steps.', say: 'Boil, pour, wait.', picture: { type: 'list', items: ['Boil', 'Pour', 'Wait'] } }] };
    const first = await reels.create(list);
    await reels.idle();
    await reels.store.put(`reels/${first.id}/reel.json`, JSON.stringify({ ...list, scenes: [{ ...list.scenes[0], picture: { ...list.scenes[0].picture, every: 1.1, start: 0.4 } }] }));
    let release;
    answers = [new Promise((ok) => { release = ok; }).then(() => tea)];
    holding.push(release);
    const res = await give('application/json', JSON.stringify({ again: first.id, how: 'simpler' }));
    assert.equal(res.status, 200);
    const { id } = await res.json();
    assert.notEqual(id, first.id, 'it is a new reel: the first stays as it is');
    assert.deepEqual(calls.at(-1)[0], { kind: 'reel', how: 'simpler', reel: list, language: null, narrator: null }, 'Claude is given the reel as it was written, without the timings of its recording');
    assert.equal((await reels.status(id)).title, 'Tea, properly', 'and it keeps its name while it is written');
    release();
    await server.written();
    await reels.idle();
    assert.deepEqual(await reels.status(id).then((s) => [s.state, s.title]), ['ready', 'Tea']);
    assert.equal((await reels.reel(first.id)).title, 'Tea, properly');
    // only a reel that is there, and ready, can be made again
    const before = calls.length;
    const gone = await give('application/json', JSON.stringify({ again: 'abcdefghijklmnopqrstuv', how: 'shorter' }));
    assert.equal(gone.status, 404);
    assert.deepEqual(await gone.json(), { error: 'That reel has gone, so it cannot be made again.' });
    const begun = await reels.begin('Your reel');
    assert.equal((await give('application/json', JSON.stringify({ again: begun.id, how: 'shorter' }))).status, 404);
    assert.equal((await give('application/json', JSON.stringify({ again: first.id, how: 'ruder' }))).status, 400);
    assert.equal(calls.length, before, 'and none of those reaches Claude');
    await reels.fail(begun.id, 'Given up on.');
  });

  it('lets whoever made a reel delete it for good, and nobody else', async () => {
    const res = await ask('tea');
    const made = await res.clone().json();
    assert.deepEqual(Object.keys(made), ['id', 'watch', 'title', 'expires', 'key'], 'they are given a key with it, and what its page will call it');
    assert.equal(made.title, 'Your reel');
    await outcome(res);
    const forget = (id, headers = {}) => fetch(`${local}/r/${id}`, { method: 'DELETE', headers: { origin: 'https://reels.example', ...headers } });
    assert.equal((await forget(made.id)).status, 403, 'not without the key');
    assert.equal((await forget(made.id, { 'x-reel-key': 'a guess' })).status, 403);
    assert.equal((await forget(made.id, { 'x-reel-key': made.key, origin: 'https://elsewhere.example' })).status, 403, 'nor from another site');
    const connector = await reels.create(tea);
    assert.equal((await forget(connector.id, { 'x-reel-key': made.key })).status, 403, 'nor a reel that was made some other way');
    assert.equal((await reels.status(made.id)).state, 'ready');
    const gone = await forget(made.id, { 'x-reel-key': made.key });
    assert.equal(gone.status, 200);
    assert.deepEqual(await gone.json(), { deleted: true });
    assert.equal(await reels.status(made.id), null);
    assert.equal((await fetch(`${local}/r/${made.id}/play.json`)).status, 404, 'it is gone at once, for everyone');
    assert.equal((await forget(made.id, { 'x-reel-key': made.key })).status, 404);
    // one that is still being written can be deleted too, and what Claude then writes goes nowhere
    let release;
    answers = [new Promise((ok) => { release = ok; }).then(() => tea)];
    holding.push(release);
    const early = await (await ask('tea')).json();
    assert.equal((await forget(early.id, { 'x-reel-key': early.key })).status, 200);
    release();
    await server.written();
    await reels.idle();
    assert.equal(await reels.status(early.id), null);
  });

  it('makes a reel in the language that is asked for, and offers only the languages Peter reads here', async () => {
    const page = await (await fetch(`${local}/make`)).text(), without = await (await fetch(`${localOff}/make`)).text();
    assert.match(page, /<fieldset class="pick maker-language" id="maker-language" hidden>\s*<legend>Read it to me in<\/legend>\s*<label><input type="radio" name="language" value="english" checked><span lang="en">English<\/span><\/label>\s*<label><input type="radio" name="language" value="french"><span lang="fr">Français<\/span><\/label>\s*<label><input type="radio" name="language" value="spanish"><span lang="es">Español<\/span><\/label>\s*<\/fieldset>/);
    assert.match(without, /name="language" value="french"/, 'and the same where the service makes no reels itself: there the words for Claude say which language');
    assert.doesNotMatch(without, /\{\{languages\}\}/);
    assert.doesNotMatch(sitePage('home', 'https://reels.example'), /name="language"|\{\{languages\}\}/, 'none where Peter reads only English');
    // words, with the language in the JSON
    let status = await outcome(await give('application/json', JSON.stringify({ about: 'le thé', language: 'french' })));
    assert.deepEqual(calls.at(-1)[0], { ...words('le thé'), language: 'french', narrator: null });
    assert.deepEqual([status.state, status.language, spoken.at(-1)], ['ready', 'french', 'french'], 'and Peter is asked to read it in French');
    // a file, with the language beside it
    status = await outcome(await give('application/pdf', PDF, { 'x-reel-language': 'spanish' }));
    assert.equal(calls.at(-1)[0].language, 'spanish');
    assert.deepEqual([status.language, spoken.at(-1)], ['spanish', 'spanish']);
    // English, said or unsaid, is the usual way
    status = await outcome(await give('application/json', JSON.stringify({ about: 'tea', language: 'english' })));
    assert.deepEqual([calls.at(-1)[0].language, status.language, spoken.at(-1)], [null, undefined, null]);
    // a language Peter does not read here is turned away before Claude is asked
    const before = calls.length;
    const german = await give('application/json', JSON.stringify({ about: 'Tee', language: 'german' }));
    assert.equal(german.status, 400);
    assert.match((await german.json()).error, /cannot read that language here/);
    assert.equal((await give('image/jpeg', JPEG, { 'x-reel-language': 'klingon' })).status, 400);
    assert.equal(calls.length, before);
  });

  it('offers, on its page, a choice of who reads, where someone besides Peter does', async () => {
    const page = await (await fetch(`${local}/make`)).text();
    assert.match(page, /<fieldset class="pick maker-language" id="maker-who" hidden>\s*<legend>Read by<\/legend>\s*<label><input type="radio" name="who" value="peter" checked><span>Peter<\/span><\/label>\s*<label><input type="radio" name="who" value="anna"><span>Anna<\/span><\/label>\s*<label><input type="radio" name="who" value="stuart"><span>Stuart<\/span><\/label>\s*<\/fieldset>/);
    assert.doesNotMatch(page, /\{\{who\}\}/);
    const alone = sitePage('make', 'https://reels.example');
    assert.doesNotMatch(alone, /name="who"|\{\{who\}\}/, 'none where only Peter reads');
    assert.deepEqual([whoChoices(), whoChoices(['peter']), whoChoices(['nobody'])], ['', '', '']);
  });

  it('has the reel read by whoever was chosen, if they read here', async () => {
    let status = await outcome(await give('application/json', JSON.stringify({ about: 'tea', narrator: 'stuart' })));
    assert.equal(calls.at(-1)[0].narrator, 'stuart');
    assert.deepEqual([status.state, status.narrator, voices.at(-1)], ['ready', 'stuart', 'stuart_bell'], 'and the recorder is asked for that voice');
    assert.equal((await playOf(status.id)).narrator, 'Stuart', 'the reel\'s page says who reads it');
    // a file, with the narrator beside it, in French
    status = await outcome(await give('image/jpeg', JPEG, { 'x-reel-narrator': 'anna', 'x-reel-language': 'french' }));
    assert.deepEqual([status.narrator, status.language, voices.at(-1), spoken.at(-1)], ['anna', 'french', 'anna', 'french']);
    // Peter, said or unsaid, is the usual way
    status = await outcome(await give('application/json', JSON.stringify({ about: 'tea', narrator: 'peter' })));
    assert.deepEqual([calls.at(-1)[0].narrator, status.narrator, voices.at(-1)], [null, undefined, null]);
    // a narrator who does not read here is turned away before Claude is asked
    const before = calls.length;
    const vera = await give('application/json', JSON.stringify({ about: 'tea', narrator: 'vera' }));
    assert.equal(vera.status, 400);
    assert.match((await vera.json()).error, /does not read here/);
    assert.equal(calls.length, before);
    // and a reel written again keeps whoever read it
    const first = await outcome(await give('application/json', JSON.stringify({ about: 'tea', narrator: 'anna' })));
    const again = await outcome(await give('application/json', JSON.stringify({ again: first.id, how: 'simpler', narrator: 'stuart' })));
    assert.deepEqual([calls.at(-1)[0].narrator, again.narrator, voices.at(-1)], ['anna', 'anna', 'anna']);
  });

  it('writes a reel again in the language it is in', async () => {
    const first = await outcome(await give('application/json', JSON.stringify({ about: 'le thé', language: 'french' })));
    const again = await outcome(await give('application/json', JSON.stringify({ again: first.id, how: 'shorter', language: 'spanish' })));
    assert.equal(calls.at(-1)[0].language, 'french', 'whatever language is chosen in the box just now');
    assert.deepEqual([again.language, spoken.at(-1)], ['french', 'french']);
  });

  it('offers to write a reel again only where the service can, once it plays', async () => {
    const made = await reels.create(tea);
    await reels.idle();
    const on = await (await fetch(`${local}/r/${made.id}`)).text(), without = await (await fetch(`${localOff}/r/${made.id}`)).text();
    assert.match(on, /id="watch" data-watch="[A-Za-z0-9_-]{22}" data-here="on"/);
    assert.match(without, /data-here="off"/);
    for (const page of [on, without]) {
      assert.match(page, /<div class="row watch-again" id="watch-again" hidden>/, 'hidden until the script shows it');
      assert.match(page, /<button class="btn btn-teal" type="button" data-remake="simpler">Make it simpler<\/button>/);
      assert.match(page, /<button class="btn btn-teal" type="button" data-remake="shorter">Make it shorter<\/button>/);
    }
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

  it('says on the reel\'s page, in plain words, why it could not be written', async () => {
    answers = [new TryError('That page would not load.')];
    const res = await ask('https://example.com/gone');
    const { id } = await res.clone().json();
    const status = await outcome(res);
    assert.deepEqual([status.state, status.error], ['failed', 'That page would not load.']);
    assert.deepEqual(await playOf(id).then((p) => [p.state, p.error]), ['failed', 'That page would not load.']);
    answers = [new Error('something broke')];
    assert.deepEqual(await outcome(await ask('tea')).then((s) => [s.state, s.error]), ['failed', 'Something went wrong. Try again in a while.'], 'and never what went wrong inside');
  });

  it('says there and then when a PDF is too long, or too much is waiting to be recorded', async () => {
    const before = calls.length;
    writer.fits = async () => { throw new TryError('That is too long for one reel.', { free: true }); };
    const long = await give('application/pdf', PDF);
    assert.equal(long.status, 422);
    assert.deepEqual(await long.json(), { error: 'That is too long for one reel.' });
    delete writer.fits;
    const full = reels.maxQueue;
    reels.maxQueue = 0;
    const busy = await ask('tea');
    reels.maxQueue = full;
    assert.equal(busy.status, 422);
    assert.match((await busy.json()).error, /busy recording/);
    assert.equal(calls.length, before, 'and neither reaches Claude');
  });

  it('turns away anything but a short request from its own page', async () => {
    const before = calls.length;
    assert.equal((await fetch(`${local}/try`)).status, 405);
    assert.equal((await ask('tea', { origin: 'https://elsewhere.example' })).status, 403);
    assert.equal((await fetch(`${local}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"about":"tea"}' })).status, 403, 'nor one that does not say where it is from');
    assert.equal((await ask('tea', { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await ask('')).status, 400);
    const video = await ask('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    assert.equal(video.status, 400);
    assert.match((await video.json()).error, /cannot watch a video/);
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
    await server.written();
    await reels.idle();
  });

  it('does not count a go that cost nothing', async () => {
    limits.tries = new RateLimit({ perHour: 1, perDay: 100 });
    const from = { 'x-forwarded-for': '203.0.113.20' };
    answers = [new TryError('Claude is busy just now. Try again in a minute.', { free: true })];
    assert.equal((await outcome(await ask('tea', from))).state, 'failed');
    assert.equal((await outcome(await ask('tea', from))).state, 'ready', 'Claude never read the first, so the visitor still has their one');
    answers = [new TryError('Claude would not write a reel about that.')];
    assert.equal((await outcome(await ask('tea', { 'x-forwarded-for': '203.0.113.21' }))).state, 'failed');
    assert.equal((await ask('tea', { 'x-forwarded-for': '203.0.113.21' })).status, 429, 'one that Claude read and declined is counted');
    writer.fits = async () => { throw new TryError('That is too long for one reel.', { free: true }); };
    assert.equal((await give('application/pdf', PDF, { 'x-forwarded-for': '203.0.113.22' })).status, 422);
    delete writer.fits;
    assert.equal((await outcome(await ask('tea', { 'x-forwarded-for': '203.0.113.22' }))).state, 'ready', 'nor is a PDF that was too long to read');
  });
});
