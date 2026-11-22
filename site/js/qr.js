// A QR code: the square of pixels a phone's camera reads as a link, so that nobody has to
// type an address. Made here, with nothing loaded from anywhere else, as the standard
// (ISO/IEC 18004) lays down: the address as bytes, with error correction at level M (a
// code still reads with about a seventh of it spoiled), in the smallest of the first six
// sizes that holds it. That is room for 106 bytes, which is any address of this site's.
// It is DOM-free: the service draws it into a page as SVG, and the tests check it in Node.

// For each size (its "version"): how many codewords hold the address, in how many blocks,
// and how many correcting codewords each block gets, at level M.
const SIZES = [null, [16, 1, 10], [28, 1, 16], [44, 1, 26], [64, 2, 18], [86, 2, 24], [108, 4, 16]];
const FORMAT_M = 0;   // the two bits that say "level M" in the format information

// Multiplying in the field the correcting codewords are worked out in (GF(256), on x^8 + x^4 + x^3 + x^2 + 1).
function times(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** The correcting codewords (Reed-Solomon) for one block of `data`. */
export function correcting(data, count) {
  const divisor = new Array(count).fill(0);
  divisor[count - 1] = 1;
  for (let i = 0, root = 1; i < count; i++, root = times(root, 2)) {
    for (let j = 0; j < count; j++) {
      divisor[j] = times(divisor[j], root);
      if (j + 1 < count) divisor[j] ^= divisor[j + 1];
    }
  }
  const left = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ left.shift();
    left.push(0);
    divisor.forEach((coefficient, i) => { left[i] ^= times(coefficient, factor); });
  }
  return left;
}

/** The fifteen bits that tell a reader the level and which mask was used. */
export function formatBits(mask) {
  const data = (FORMAT_M << 3) | mask;
  let rest = data;
  for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  return ((data << 10) | rest) ^ 0x5412;
}

/** Every codeword of the finished message: the text's, padded out, then each block's correcting ones, dealt out in turn. */
export function codewords(text) {
  const bytes = [...new TextEncoder().encode(text)];
  const version = SIZES.findIndex((size) => size && bytes.length + 2 <= size[0]);
  if (version < 0) throw new RangeError(`too long for a QR code here: ${bytes.length} bytes, and the most is ${SIZES.at(-1)[0] - 2}`);
  const [room, blocks, extra] = SIZES[version];
  // "bytes follow" (0100), how many, the bytes themselves, and four noughts to end
  const bits = [0, 1, 0, 0];
  const put = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(bytes.length, 8);
  for (const byte of bytes) put(byte, 8);
  put(0, Math.min(4, room * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(Number.parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < room; pad ^= 0xec ^ 0x11) data.push(pad);
  const each = room / blocks, split = [];
  for (let i = 0; i < blocks; i++) {
    const block = data.slice(i * each, (i + 1) * each);
    split.push([block, correcting(block, extra)]);
  }
  const all = [];
  for (let i = 0; i < each; i++) for (const [block] of split) all.push(block[i]);
  for (let i = 0; i < extra; i++) for (const [, more] of split) all.push(more[i]);
  return { version, all };
}

// The eight patterns a code may be masked with, so that it has no big plain patches.
const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
];

// How hard a finished code is to read, as the standard scores it: long runs of one colour,
// blocks of one colour, shapes that look like the corner squares, and too much dark or light.
function penalty(rows) {
  const size = rows.length, lines = [...rows.map((row) => row.join(''))];
  for (let x = 0; x < size; x++) lines.push(rows.map((row) => row[x]).join(''));
  let score = 0, dark = 0;
  for (const line of lines) {
    for (const run of line.match(/0{5,}|1{5,}/g) ?? []) score += run.length - 2;
    for (let i = 0; i + 11 <= size; i++) {
      const eleven = line.slice(i, i + 11);
      if (eleven === '10111010000' || eleven === '00001011101') score += 40;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      dark += rows[y][x];
      if (x + 1 < size && y + 1 < size && rows[y][x] === rows[y][x + 1] && rows[y][x] === rows[y + 1][x] && rows[y][x] === rows[y + 1][x + 1]) score += 3;
    }
  }
  return score + (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
}

/**
 * The QR code for `text`, as rows of 1 (dark) and 0 (light), with no margin round it. Give
 * it a `mask` (0 to 7) to say which mask to use; left to itself it takes the one that
 * reads most easily.
 */
export function qrCode(text, { mask = null } = {}) {
  const { version, all } = codewords(text);
  const size = 17 + 4 * version;
  const rows = Array.from({ length: size }, () => new Array(size).fill(0));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));   // not the message's to use
  const set = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    rows[y][x] = dark ? 1 : 0;
    fixed[y][x] = true;
  };

  // the dotted lines that give a reader the grid
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // the three corner squares, each with a light edge round it
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, ring !== 2 && ring !== 4);
      }
    }
  }
  // the small square near the fourth corner, in every size but the smallest
  if (version > 1) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) set(size - 7 + dx, size - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  // the format information, twice over, and the one module that is always dark
  const format = (bits) => {
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);   // keeps its place for now

  // the message, in a zigzag up and down pairs of columns from the bottom right
  let next = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      for (const x of [right, right - 1]) {
        const y = ((right + 1) & 2) === 0 ? size - 1 - step : step;
        if (fixed[y][x] || next >= all.length * 8) continue;
        rows[y][x] = (all[next >>> 3] >>> (7 - (next & 7))) & 1;
        next++;
      }
    }
  }

  const masked = (which) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!fixed[y][x] && MASKS[which](x, y)) rows[y][x] ^= 1;
      }
    }
  };
  let best = mask;
  if (best === null) {
    let least = Infinity;
    for (let which = 0; which < MASKS.length; which++) {
      masked(which);
      format(formatBits(which));
      const score = penalty(rows);
      if (score < least) [least, best] = [score, which];
      masked(which);   // masking twice puts it back
    }
  }
  masked(best);
  format(formatBits(best));
  return rows;
}

/**
 * The code as an SVG picture, dark ink on a light card whatever the colour of the page (a
 * camera needs it that way round), with the margin of four modules a reader needs round it.
 */
export function qrSvg(text, { label = 'A QR code' } = {}) {
  const rows = qrCode(text), margin = 4, across = rows.length + margin * 2;
  let path = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let run = 1;
      while (row[x + run]) run++;
      path += `M${x + margin} ${y + margin}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return `<svg class="qr" viewBox="0 0 ${across} ${across}" width="${across * 4}" height="${across * 4}" shape-rendering="crispEdges" role="img" aria-label="${label}">` +
    `<rect width="${across}" height="${across}" fill="#fffcf2"/><path d="${path}" fill="#141b2d"/></svg>`;
}
