// The service's own few pages: what Pixel Reel is, how to add it to Claude, privacy, terms and
// credits. They are written in Markdown in docs/site/, so they read well on GitHub and are easy
// to change, and turned into pages here with just the Markdown they use.
import { readFileSync } from 'node:fs';

export const SITE_PAGES = { '/': 'home', '/claude': 'claude', '/privacy': 'privacy', '/terms': 'terms', '/credits': 'credits' };

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline Markdown: `code`, **bold**, *emphasis* and [links](address), on escaped text. */
function inline(text) {
  return escapeHtml(text)
    // a web address gets a line of its own, and breaks after a slash if it must
    .replace(/`([^`]+)`/g, (_, code) => (/^https?:/.test(code) ? `<code class="address">${code.replace(/\//g, '/<wbr>')}</code>` : `<code>${code}</code>`))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, words, href) => `<a href="${href}">${words}</a>`);
}

/** The Markdown these pages use (headings, paragraphs, lists) as HTML. Comments are dropped. */
export function markdownHtml(source) {
  const html = [];
  let para = [], list = null;
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    para = [];
    list = null;
  };
  for (const line of source.replace(/<!--[\s\S]*?-->\n?/g, '').split('\n')) {
    const heading = /^(#{1,3}) (.+)$/.exec(line), item = /^(-|\d+\.) (.+)$/.exec(line);
    if (heading) { flush(); html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); }
    else if (item) {
      const tag = item[1] === '-' ? 'ul' : 'ol';
      if (para.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(item[2]);
    } else if (/^\s+\S/.test(line) && list) list.items[list.items.length - 1] += ` ${line.trim()}`;
    else if (line.trim()) { if (list) flush(); para.push(line.trim()); }
    else flush();
  }
  flush();
  return html.join('\n');
}

/** One of the pages, for a service at `baseUrl`. */
export function sitePage(name, baseUrl) {
  const source = readFileSync(new URL(`../docs/site/${name}.md`, import.meta.url), 'utf8').replaceAll('{{url}}', baseUrl);
  const title = /^# (.+)$/m.exec(source)?.[1] ?? 'Pixel Reel';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title === 'Pixel Reel' ? title : `${title} - Pixel Reel`)}</title>
<meta name="description" content="Short pixel-art cartoons with a warm recorded voice, made by Claude, to watch instead of read.">
<style>
body { margin: 0; background: #0b1220; color: #f8f7dd; font: 19px/1.6 Verdana, Tahoma, sans-serif; }
main { max-width: 40em; margin: 0 auto; padding: 24px 16px 48px; }
h1 { color: #55d6be; font-size: 34px; margin: 8px 0 12px; }
h2 { color: #ffcc4d; font-size: 23px; margin: 30px 0 8px; }
a { color: #55d6be; }
code { background: #13203a; border: 1px solid #33506e; border-radius: 3px; padding: 1px 6px; overflow-wrap: break-word; }
code.address { display: block; width: fit-content; max-width: 100%; box-sizing: border-box; margin: 6px 0 2px; font-size: 20px; }
li { margin: 6px 0; }
</style>
</head>
<body>
<main>
${markdownHtml(source)}
</main>
</body>
</html>
`;
}
