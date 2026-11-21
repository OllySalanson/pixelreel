// Joins the player's ES modules into one script, so a reel can be a single HTML file that
// opens from anywhere (a download, an email, a chat), where a page cannot load other files.
// Each module keeps its own scope, so names never clash. It only understands the import and
// export forms this project uses, and refuses anything else rather than guess.
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const IMPORT = /^import \{([^}]*)\} from '\.\/([a-z0-9-]+\.js)';$/;
const EXPORT = /^export (?:async )?(?:function\*? |class |const |let )([A-Za-z_$][\w$]*)/;

/** One module rewritten as a scope that reads its imports from `__m` and returns its exports. */
function wrap(file, code) {
  const name = basename(file), imports = [], exports = [];
  const body = code.split('\n').map((line, i) => {
    if (/^import\b/.test(line)) {
      const m = IMPORT.exec(line.trim());
      if (!m) throw new Error(`${name}:${i + 1}: the bundler only takes "import { a, b } from './x.js';" on one line`);
      imports.push(m[2]);
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^(\S+) as (\S+)$/, '$1: $2'));
      return `const { ${names.join(', ')} } = __m['${m[2]}'];`;
    }
    if (/^export\b/.test(line)) {
      const m = EXPORT.exec(line);
      if (!m) throw new Error(`${name}:${i + 1}: the bundler only takes exported functions, classes, consts and lets`);
      exports.push(m[1]);
      return line.replace(/^export /, '');
    }
    return line;
  }).join('\n');
  return { name, imports, text: `__m['${name}'] = (() => {\n${body}\nreturn { ${exports.join(', ')} };\n})();` };
}

/**
 * The modules `entries` need (paths to files in one folder), each once, each after the ones
 * it imports, as one script. `run` is code to add at the end, which can read any module's
 * exports from `__m['file.js']`.
 */
export function bundle(entries, { run = '' } = {}) {
  const dir = dirname(resolve(entries[0]));
  const done = new Map(), visiting = new Set();
  const visit = (name) => {
    if (done.has(name)) return;
    if (visiting.has(name)) throw new Error(`${name} imports itself, through other modules`);
    visiting.add(name);
    const mod = wrap(name, readFileSync(join(dir, name), 'utf8'));
    for (const dep of mod.imports) visit(dep);
    visiting.delete(name);
    done.set(name, mod.text);
  };
  for (const entry of entries) {
    if (dirname(resolve(entry)) !== dir) throw new Error('the bundler takes modules from one folder');
    visit(basename(entry));
  }
  return ['const __m = {};', ...done.values(), run].filter(Boolean).join('\n\n') + '\n';
}
