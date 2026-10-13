// Turns a plain Markdown script into a reel, for npm run new my-reel -- --from notes.md
//
//   # Reel title                the reel's title, and an opening title scene
//   A line or two of intro.     said over the opening title
//   ## Scene title              starts a scene (### does too)
//   The caption, on screen.     the first paragraph is the caption
//   > What the narrator says.   optional: otherwise the paragraphs are read out
//   - a bullet list             a list picture (1. 2. 3. for a numbered one)
//   ```sh ... ```               a terminal picture; any other ``` block is code
//   ```chat  Name: words ```    a chat picture
//   ![alt](images/x.png)        an image picture (put the file in the reel's folder)
//
// A scene with none of those gets a big title card. Release notes work as they are.

const SHELLS = new Set(['sh', 'bash', 'zsh', 'shell', 'console', 'terminal', 'powershell', 'ps', 'cmd']);

/** Plain words for the screen and the narrator: no link syntax, URLs, emphasis or "by @someone in" credits. */
export function plainWords(text) {
  return String(text)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+by @[\w-]+(?:\s+in\s+\S+)?/g, '')
    .replace(/\s+(?:in|at|see)\s+https?:\/\/\S+/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(^|\s)@([\w-]+)/g, '$1$2')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,!?;:]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

const sentence = (s) => (/[.!?]$/.test(s) ? s : s + '.');

/**
 * Reads a script and returns { reel, warnings }: a reel object ready for normalizeReel,
 * and anything in the script that was left out.
 */
export function parseScript(markdown, { title: given } = {}) {
  const warnings = [];
  const warn = (w) => { if (!warnings.includes(w)) warnings.push(w); };
  const intro = { paras: [], say: [] };
  const scenes = [];
  let title = null, scene = null, fence = null, para = [];
  const images = {};

  const flush = () => {
    const words = plainWords(para.join(' '));
    // a label whose link was taken out ("Full Changelog:") says nothing on its own
    if (words && !words.endsWith(':')) (scene ?? intro).paras.push(words);
    para = [];
  };
  const picture = (p) => {
    if (!scene) { warn(`a ${p.type} before the first scene was left out`); return false; }
    if (scene.picture && scene.picture !== p) { warn(`scene "${scene.title}" has more than one picture; it shows the first`); return false; }
    scene.picture = p;
    return true;
  };
  const endFence = ({ lang, info, lines }) => {
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    if (!lines.length) return;
    if (lang === 'chat') {
      const messages = lines.map((l) => /^\s*([^:]+):\s*(.+)$/.exec(l)).filter(Boolean).map((m) => ({ from: m[1].trim(), text: plainWords(m[2]) }));
      if (messages.length) picture({ type: 'chat', messages });
      else warn('a chat block needs lines like "Name: words"');
    } else if (SHELLS.has(lang)) {
      const prompted = lines.some((l) => l.startsWith('$ '));
      picture({ type: 'terminal', lines: lines.map((l) => (prompted ? l : '$ ' + l.trim())) });
    } else {
      picture({ type: 'code', ...(info || lang ? { title: info || `example.${lang}` } : {}), lines });
    }
  };

  for (const raw of String(markdown).replace(/\r\n?/g, '\n').split('\n')) {
    if (fence) {
      if (/^\s*```/.test(raw)) { endFence(fence); fence = null; } else fence.lines.push(raw.replace(/\t/g, '  '));
      continue;
    }
    const line = raw.trim();
    let m;
    if ((m = /^```\s*([\w-]*)\s*(.*)$/.exec(line))) { flush(); fence = { lang: m[1].toLowerCase(), info: m[2].trim(), lines: [] }; }
    else if ((m = /^#\s+(.+)$/.exec(line)) && title === null && !scene) { flush(); title = plainWords(m[1]); }
    else if ((m = /^#{1,3}\s+(.+)$/.exec(line))) { flush(); scene = { title: plainWords(m[1]), paras: [], say: [], picture: null }; scenes.push(scene); }
    else if ((m = /^>\s?(.*)$/.exec(line))) { flush(); (scene ?? intro).say.push(plainWords(m[1])); }
    else if ((m = /^(?:[-*+]|(\d+)[.)])\s+(.+)$/.exec(line))) {
      flush();
      const list = scene?.picture?.type === 'list' ? scene.picture : { type: 'list', items: [] };
      if (picture(list)) {
        list.items.push(plainWords(m[2]));
        if (m[1]) list.numbered = true;
      }
    } else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/.exec(line))) {
      flush();
      const name = (m[2].split('/').pop().replace(/\.\w+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'picture';
      images[name] = m[2];
      picture({ type: 'image', name });
    } else if (!line) flush();
    else para.push(line);
  }
  flush();
  if (fence) endFence(fence);

  const out = [];
  const reelTitle = given || title || 'Untitled reel';
  if (given || title) {
    const words = intro.paras.join(' '), text = title || given;
    out.push({
      title: text,
      caption: words || text,
      say: intro.say.join(' ') || words || text,
      picture: { type: 'title', text, ...(words && words.length <= 140 ? { sub: words } : {}) }
    });
  }
  for (const s of scenes) {
    const told = s.paras.join(' '), items = s.picture?.type === 'list' ? s.picture.items : [];
    out.push({
      title: s.title,
      caption: s.paras[0] || s.title,
      say: s.say.join(' ') || told || [s.title, ...items].map(sentence).join(' '),
      picture: s.picture ?? { type: 'big', text: s.title }
    });
  }
  if (!out.length) throw new Error('This script has no scenes. Start each one with a heading such as "## The first scene".');
  const reel = { title: reelTitle, transition: 'dissolve', captions: 'typewriter' };
  if (Object.keys(images).length) reel.images = images;
  reel.scenes = out;
  return { reel, warnings };
}

/** A string in quotes: single ones, unless the words have an apostrophe and no double quotes. */
const quote = (s) => (s.includes("'") && !s.includes('"') ? JSON.stringify(s)
  : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`);

/** Writes a value as tidy JavaScript: short things on one line, long things spread out. */
function literal(value, indent = '') {
  if (typeof value === 'string') return quote(value);
  if (typeof value !== 'object' || value === null) return String(value);
  const inner = indent + '  ';
  const parts = Array.isArray(value)
    ? value.map((v) => literal(v, inner))
    : Object.entries(value).map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k)}: ${literal(v, inner)}`);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{ ', ' }'];
  const flat = parts.length ? `${open}${parts.join(', ')}${close}` : open.trim() + close.trim();
  if (!flat.includes('\n') && indent.length + flat.length <= 96) return flat;
  return `${open.trim()}\n${parts.map((p) => inner + p).join(',\n')}\n${indent}${close.trim()}`;
}

/** The reel.js file for a reel made from a script. */
export function reelSource(reel, { from = 'a script' } = {}) {
  return `// ${reel.title.replace(/\n/g, ' ')}
// Made with npm run new from ${from}.
// Every scene is plain data: change the words, swap a picture for another, or give a scene
// a draw(t, px) function of its own. docs/scenes.md has every picture, transition and
// caption style.

export default ${literal(reel)};
`;
}
