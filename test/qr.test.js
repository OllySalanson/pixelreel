import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { codewords, correcting, formatBits, qrCode, qrSvg } from '../site/js/qr.js';

const hex = (list) => list.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
const picture = (rows) => rows.map((row) => row.join(''));

describe('a QR code', () => {
  it('works out the correcting codewords as the standard does in its own worked example', () => {
    // ISO/IEC 18004, annex I: "01234567" at size 1, level M
    const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
    assert.equal(hex(correcting(data, 10)), 'a5 24 d4 c1 ed 36 c7 87 2c 55');
  });

  it('says its level and its mask in the fifteen bits the standard lists', () => {
    const listed = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
    listed.forEach((bits, mask) => assert.equal(formatBits(mask).toString(2).padStart(15, '0'), bits, `mask ${mask}`));
  });

  it('writes the text as bytes: that bytes follow, how many, the bytes, and padding to fill the room', () => {
    const { version, all } = codewords('A');
    assert.equal(version, 1);
    assert.equal(hex(all.slice(0, 16)), '40 14 10 ec 11 ec 11 ec 11 ec 11 ec 11 ec 11 ec');
    assert.equal(all.length, 26, 'sixteen for the text and ten to correct it');
    assert.equal(hex(all.slice(16)), hex(correcting(all.slice(0, 16), 10)));
  });

  it('takes the smallest size that holds the text, up to the sixth', () => {
    const most = [14, 26, 42, 62, 84, 106];   // bytes, at level M
    most.forEach((bytes, i) => {
      assert.equal(qrCode('x'.repeat(bytes)).length, 21 + 4 * i, `${bytes} bytes fit size ${i + 1}`);
      if (i + 1 < most.length) assert.equal(qrCode('x'.repeat(bytes + 1)).length, 25 + 4 * i, `${bytes + 1} need the next`);
    });
    assert.equal(codewords('é'.repeat(7)).version, 1, 'counted in bytes, not letters');
    assert.equal(codewords('é'.repeat(8)).version, 2);
    assert.throws(() => qrCode('x'.repeat(107)), RangeError);
  });

  it('deals the codewords of a code in several blocks out in turn', () => {
    const { version, all } = codewords('w'.repeat(62));   // size 4: two blocks of 32, 18 correcting each
    assert.equal(version, 4);
    assert.equal(all.length, 100);
    const block = (n) => all.slice(0, 64).filter((_, i) => i % 2 === n), more = (n) => all.slice(64).filter((_, i) => i % 2 === n);
    for (const n of [0, 1]) assert.equal(hex(more(n)), hex(correcting(block(n), 18)), `block ${n + 1}`);
  });

  it('has its three corner squares, its dotted lines, its small square and its one dark module', () => {
    for (const text of ['A', 'https://pixelreel.pro/app', 'https://pixelreel.pro/r/abcdefghijklmnopqrstuv', 'u'.repeat(106)]) {
      const rows = qrCode(text), size = rows.length;
      const corner = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
      for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
        assert.deepEqual(rows.slice(y, y + 7).map((row) => row.slice(x, x + 7).join('')), corner, `${text}: the corner at ${x}, ${y}`);
      }
      for (let i = 0; i < 8; i++) {   // a light edge round each corner square
        for (const [x, y] of [[7, i], [i, 7], [size - 8, i], [size - 1 - i, 7], [7, size - 1 - i], [i, size - 8]]) assert.equal(rows[y][x], 0, `${text}: light at ${x}, ${y}`);
      }
      for (let i = 8; i < size - 8; i++) {
        assert.equal(rows[6][i], (i + 1) % 2, `${text}: the dotted line across`);
        assert.equal(rows[i][6], (i + 1) % 2, `${text}: the dotted line down`);
      }
      assert.equal(rows[size - 8][8], 1, `${text}: the dark module`);
      if (size > 21) {
        const small = rows.slice(size - 9, size - 4).map((row) => row.slice(size - 9, size - 4).join(''));
        assert.deepEqual(small, ['11111', '10001', '10101', '10001', '11111'], `${text}: the small square`);
      }
    }
  });

  it('can be made with any of the eight masks, and left to itself takes one of them', () => {
    const text = 'https://pixelreel.pro/watch/pension-letter';
    const each = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => picture(qrCode(text, { mask })).join('\n'));
    assert.equal(new Set(each).size, 8, 'each mask gives a different code');
    assert.ok(each.includes(picture(qrCode(text)).join('\n')));
  });

  // This one, and every size and every mask, was read back by a real reader (zxing-cpp)
  // when it was written. It is kept here so that a change that would spoil it shows.
  it('still makes the code for the page about the phone that a reader read', () => {
    assert.deepEqual(picture(qrCode('https://pixelreel.pro/app')), [
      '1111111010110010101111111',
      '1000001000101110001000001',
      '1011101011011111001011101',
      '1011101000101111001011101',
      '1011101001111100001011101',
      '1000001010000000101000001',
      '1111111010101010101111111',
      '0000000000001000100000000',
      '1010001100011001100100101',
      '1011010001000011101101011',
      '1100101101100011010111101',
      '0111110010011000110001000',
      '1001001111001001101000001',
      '0111110100101101111100011',
      '1100101111101001110001101',
      '0001000111011011000111000',
      '1110001111101011111110010',
      '0000000010100101100010001',
      '1111111011011000101010001',
      '1000001001000011100010010',
      '1011101000110001111110010',
      '1011101001011000010010110',
      '1011101010111110010111011',
      '1000001001100010110110000',
      '1111111011110000101001001'
    ]);
  });

  it('is drawn as a picture with a light margin of four modules, dark on light, and words for a screen reader', () => {
    const svg = qrSvg('https://pixelreel.pro/app', { label: 'A QR code. It opens Pixel Reel on a phone.' });
    assert.match(svg, /^<svg class="qr" viewBox="0 0 33 33" width="132" height="132" shape-rendering="crispEdges" role="img" aria-label="A QR code\. It opens Pixel Reel on a phone\.">/);
    assert.match(svg, /<rect width="33" height="33" fill="#fffcf2"\/><path d="[^"]+" fill="#141b2d"\/><\/svg>$/);
    // every dark module is drawn once, four in from the edge
    const rows = qrCode('https://pixelreel.pro/app'), drawn = rows.map((row) => row.map(() => 0));
    for (const [, x, y, run] of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let i = 0; i < Number(run); i++) drawn[Number(y) - 4][Number(x) - 4 + i] += 1;
    }
    assert.deepEqual(drawn, rows);
  });
});
