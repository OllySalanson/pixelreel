import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const EM_DASH = String.fromCharCode(0x2014);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXT = new Set(['.js', '.mjs', '.py', '.sh', '.html', '.css', '.json', '.md', '.yml', '.txt', '']);
const SKIP = new Set(['node_modules', 'models']);

function* textFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // skip dependencies, tool folders such as .git and .venv (but not .github), and the lockfile
    if (SKIP.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.github') || entry.name === 'package-lock.json') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* textFiles(path);
    else if (TEXT.has(extname(entry.name))) yield path;
  }
}

describe('house style', () => {
  it('uses a plain dash, never an em dash', () => {
    const offenders = [...textFiles(ROOT)].filter((f) => readFileSync(f, 'utf8').includes(EM_DASH));
    assert.deepEqual(offenders.map((f) => f.slice(ROOT.length)), []);
  });
});
