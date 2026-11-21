// Where the service keeps reels, behind one small interface so the place can change without
// the rest noticing: a folder on disk now, any S3-style store later. Keys are paths such as
// "reels/<id>/reel.json"; values are bytes.
import { mkdir, readdir, readFile, rm, stat, writeFile, rename } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

const KEY = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/;

/** Checks a key is a plain relative path, with no way out of the store. */
export function checkKey(key) {
  if (typeof key !== 'string' || !KEY.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`"${key}" is not a key the store takes`);
  }
  return key;
}

/** A store in a folder on this machine. */
export class DiskStore {
  constructor(root) {
    this.root = normalize(root);
  }

  path(key) {
    const file = join(this.root, checkKey(key));
    if (!file.startsWith(this.root + sep)) throw new Error(`"${key}" is outside the store`);
    return file;
  }

  /** Saves `data` (bytes or text) under `key`, all at once: a reader never sees half a file. */
  async put(key, data) {
    const file = this.path(key), part = `${file}.${process.pid}.${Date.now()}.part`;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(part, data);
    await rename(part, file);
  }

  /** The bytes saved under `key`, or null if there are none. */
  async get(key) {
    try {
      return await readFile(this.path(key));
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') return null;
      throw err;
    }
  }

  /** How many bytes are saved under `key`, or null. */
  async size(key) {
    try {
      const s = await stat(this.path(key));
      return s.isFile() ? s.size : null;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Every key under `prefix` (a folder such as "reels/abc"), in no particular order. */
  async list(prefix) {
    const keys = [];
    const walk = async (key) => {
      let entries;
      try {
        entries = await readdir(this.path(key), { withFileTypes: true });
      } catch (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return;
        throw err;
      }
      for (const e of entries) {
        if (e.name.endsWith('.part')) continue;
        if (e.isDirectory()) await walk(`${key}/${e.name}`);
        else keys.push(`${key}/${e.name}`);
      }
    };
    await walk(checkKey(prefix));
    return keys;
  }

  /** The folders directly under `prefix`, such as every reel id under "reels". */
  async folders(prefix) {
    try {
      return (await readdir(this.path(prefix), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /** Deletes `prefix` and everything under it. */
  async remove(prefix) {
    await rm(this.path(prefix), { recursive: true, force: true });
  }
}
