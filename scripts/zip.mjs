// A small ZIP writer: files stored as they are (no compression), in the order given, with a
// fixed date, so the same files always make the same bytes and a test can tell when the
// committed archive is out of date.
import { crc32 } from '../src/png.js';

const DOS_DATE = (1 << 5) | 1;   // 1 January 1980, the first day a ZIP can hold
const UTF8 = 1 << 11;            // names are UTF-8

/** A ZIP archive of `files`, a list of { name, data } with data as a string or bytes. */
export function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const body = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
    const crc = crc32(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4);           // version needed: 1.0
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(0, 8);            // stored
    local.writeUInt16LE(0, 10);           // time
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBytes, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(0x031e, 4);       // made by: Unix, version 3.0
    entry.writeUInt16LE(10, 6);
    entry.writeUInt16LE(UTF8, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE((name.endsWith('/') ? 0o40755 : 0o100644) * 0x10000, 38);   // permissions
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + body.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

/** The files in a ZIP made by zip(), as [{ name, data }]: enough to check one in a test. */
export function unzip(archive) {
  const buf = Buffer.from(archive), files = [];
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = buf.readUInt32LE(end + 16);
  for (let i = 0; i < buf.readUInt16LE(end + 10); i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('not a ZIP this tool made');
    if (buf.readUInt16LE(at + 10) !== 0) throw new Error('compressed entries are not supported');
    const nameLength = buf.readUInt16LE(at + 28), extra = buf.readUInt16LE(at + 30), comment = buf.readUInt16LE(at + 32);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLength);
    const local = buf.readUInt32LE(at + 42), size = buf.readUInt32LE(at + 24);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    files.push({ name, data: buf.subarray(start, start + size), crc: buf.readUInt32LE(at + 16) });
    at += 46 + nameLength + extra + comment;
  }
  return files;
}
