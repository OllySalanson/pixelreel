import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ABOUT_MAX, canTake, fileKind, GivenError, givenFrom, isLink, nameOf, PDF_MAX, PICTURE_MAX, requestFor, SHRINK_OVER, TEXT_MAX } from '../site/js/given.js';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const WEBP = Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1');

/** Stands in for what a browser hands over on a drop or a paste. */
const transfer = (data = {}, files = []) => ({ files, types: [...Object.keys(data), ...(files.length ? ['Files'] : [])], getData: (type) => data[type] ?? '' });

/** A file of `size` bytes that begins with `start`. */
const file = (name, type, start, size = start.length) => new File([start, new Uint8Array(size - start.length)], name, { type });

describe('what someone gives the page', () => {
  it('knows a web address from a few words', () => {
    for (const link of ['https://example.com/a?b=1', 'http://example.com', 'www.example.com/story', ' HTTPS://EXAMPLE.COM ']) assert.ok(isLink(link), link);
    for (const not of ['my gas bill', 'see https://example.com', 'https://example.com and more', 'example.com', '']) assert.ok(!isLink(not), not);
  });

  it('knows a PDF and a picture by how they begin', () => {
    assert.equal(fileKind(PDF), 'application/pdf');
    assert.equal(fileKind(JPEG), 'image/jpeg');
    assert.equal(fileKind(PNG), 'image/png');
    assert.equal(fileKind(Buffer.from('GIF89a')), 'image/gif');
    assert.equal(fileKind(WEBP), 'image/webp');
    for (const other of [Buffer.from('PK\u0003\u0004'), Buffer.from('<svg>'), Buffer.from('RIFF\u0000\u0000\u0000\u0000WAVE'), Buffer.alloc(0)]) assert.equal(fileKind(other), null);
  });

  it('takes a dropped file, a dragged link, or dragged words, in that order', () => {
    const letter = file('letter.pdf', 'application/pdf', PDF);
    assert.deepEqual(givenFrom(transfer({ 'text/plain': 'letter.pdf' }, [letter])), { file: letter });
    assert.deepEqual(givenFrom(transfer({ 'text/uri-list': '# a comment\r\nhttps://example.com/story\r\nhttps://example.com/other', 'text/plain': 'A story' })), { words: 'https://example.com/story' });
    assert.deepEqual(givenFrom(transfer({ 'text/plain': '  Dear Sam,\nPay up.  ' })), { words: 'Dear Sam,\nPay up.' });
    assert.equal(givenFrom(transfer({ 'text/html': '<b>x</b>' })), null);
    assert.equal(givenFrom(null), null);
    // copied from a spreadsheet: its words, and a picture of them
    const sheet = transfer({ 'text/plain': 'Gas\t£41' }, [file('image.png', 'image/png', PNG)]);
    assert.deepEqual(givenFrom(sheet, { words: true }), { words: 'Gas\t£41' }, 'pasted words win over a picture of the same words');
    assert.deepEqual(givenFrom(transfer({}, [letter]), { words: true }), { file: letter });
  });

  it('knows what can be dropped on it', () => {
    assert.ok(canTake(transfer({}, [file('a.pdf', '', PDF)])));
    assert.ok(canTake(transfer({ 'text/uri-list': 'https://example.com' })));
    assert.ok(canTake(transfer({ 'text/plain': 'words' })));
    assert.ok(!canTake(transfer({ 'text/html': '<b>x</b>' })));
    assert.ok(!canTake(null));
  });

  it('names what was given, briefly', () => {
    assert.equal(nameOf({ file: file('gas-bill.pdf', '', PDF) }), 'gas-bill.pdf');
    assert.equal(nameOf({ file: new Blob([PNG]) }), 'your file');
    assert.equal(nameOf({ words: '  my   gas\nbill ' }), 'my gas bill');
    const long = nameOf({ words: 'word '.repeat(40) });
    assert.ok(long.length <= 60 && long.endsWith('...'), long);
  });
});

describe('what the page sends for it', () => {
  const sent = async (given, options) => {
    const { headers, body } = await requestFor(given, options);
    return { type: headers['content-type'], body: typeof body === 'string' ? JSON.parse(body) : body };
  };

  it('sends a link or a few words as a request, and anything longer as writing', async () => {
    assert.deepEqual(await sent({ words: '  my gas bill ' }), { type: 'application/json', body: { about: 'my gas bill' } });
    assert.deepEqual(await sent({ words: 'https://example.com/story' }), { type: 'application/json', body: { about: 'https://example.com/story' } });
    assert.deepEqual(await sent({ words: 'Dear Sam,\r\n\r\nPay up.' }), { type: 'application/json', body: { text: 'Dear Sam,\n\nPay up.' } });
    assert.deepEqual((await sent({ words: 'x'.repeat(ABOUT_MAX + 1) })).body, { text: 'x'.repeat(ABOUT_MAX + 1) });
    await assert.rejects(requestFor({ words: '  \n ' }), (err) => err instanceof GivenError && /Say what you want explained/.test(err.message));
    await assert.rejects(requestFor({ words: 'x'.repeat(TEXT_MAX + 1) }), (err) => err instanceof GivenError && /too much for one reel/.test(err.message));
  });

  it('sends a PDF as it is, whatever it is called', async () => {
    const letter = file('letter', '', PDF);
    assert.deepEqual(await sent({ file: letter }), { type: 'application/pdf', body: letter });
    await assert.rejects(requestFor({ file: file('big.pdf', 'application/pdf', PDF, PDF_MAX + 1) }), (err) => err instanceof GivenError && /too big\. Give it a shorter one/.test(err.message));
  });

  it('sends a small picture as it is, and makes a big one smaller first', async () => {
    const small = file('shot.png', 'image/png', PNG), big = file('photo.jpg', 'image/jpeg', JPEG, SHRINK_OVER + 1);
    const shrunk = new Blob([JPEG]), asked = [];
    const shrink = async (picture) => { asked.push(picture); return shrunk; };
    assert.deepEqual(await sent({ file: small }, { shrink }), { type: 'image/png', body: small });
    assert.deepEqual(asked, [], 'a small picture is left alone');
    assert.deepEqual(await sent({ file: big }, { shrink }), { type: 'image/jpeg', body: shrunk });
    assert.deepEqual(asked, [big]);
    // a browser that cannot make it smaller sends it as it came
    assert.deepEqual(await sent({ file: big }, { shrink: async () => { throw new Error('cannot open'); } }), { type: 'image/jpeg', body: big });
    assert.deepEqual(await sent({ file: big }, { shrink: async () => null }), { type: 'image/jpeg', body: big });
    assert.deepEqual(await sent({ file: big }), { type: 'image/jpeg', body: big });
    await assert.rejects(requestFor({ file: file('huge.png', 'image/png', PNG, PICTURE_MAX + 1) }, { shrink: async () => null }), (err) => err instanceof GivenError && /picture is too big/.test(err.message));
  });

  it('has the browser turn a picture Claude cannot read into one it can, or says it cannot', async () => {
    const heic = file('IMG_0001.heic', 'image/heic', Buffer.from('\u0000\u0000\u0000\u0018ftypheic'));
    const shrunk = new Blob([JPEG]);
    assert.deepEqual(await sent({ file: heic }, { shrink: async () => shrunk }), { type: 'image/jpeg', body: shrunk });
    await assert.rejects(requestFor({ file: heic }, { shrink: async () => { throw new Error('cannot open'); } }), (err) => err instanceof GivenError && /PDF, a photo, or plain writing/.test(err.message));
  });

  it('sends a file of plain writing as its words, and says so for any other file', async () => {
    assert.deepEqual(await sent({ file: new File(['Dear Sam,\n\nPay up.'], 'letter.txt', { type: 'text/plain' }) }), { type: 'application/json', body: { text: 'Dear Sam,\n\nPay up.' } });
    assert.deepEqual(await sent({ file: new File(['https://example.com/story\n'], 'link.md', { type: '' }) }), { type: 'application/json', body: { about: 'https://example.com/story' } });
    await assert.rejects(requestFor({ file: new File(['PK\u0003\u0004'], 'letter.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) }),
      (err) => err instanceof GivenError && /Save that as a PDF/.test(err.message));
    await assert.rejects(requestFor({ file: new File(['x'.repeat(TEXT_MAX * 4 + 1)], 'book.txt', { type: 'text/plain' }) }), (err) => err instanceof GivenError && /too much for one reel/.test(err.message));
  });
});
