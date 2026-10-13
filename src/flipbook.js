// An animated SVG that flips through frames like a flipbook. It stays crisp at any size and
// it plays in a README, because GitHub shows SVG animations. The banner maker writes these.

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * frames: one picture address (usually a PNG data URL) per frame, shown `fps` a second on a
 * loop. Runs of identical frames become one picture shown for longer. The first frame is
 * also the still picture for anyone who prefers less motion.
 * @param {string[]} frames
 * @param {{ width: number, height: number, fps: number, scale?: number, title?: string, desc?: string }} o
 *   width and height are the picture's size in pixels; scale is how big it is shown.
 */
export function flipbookSvg(frames, { width, height, fps, scale = 3, title = '', desc = '' }) {
  if (!frames.length) throw new Error('a flipbook needs at least one frame');
  const runs = [];
  for (const href of frames) {
    const last = runs.at(-1);
    if (last && last.href === href) last.frames++;
    else runs.push({ href, frames: 1 });
  }
  const total = frames.length, seconds = +(total / fps).toFixed(3);
  const holds = [...new Set(runs.map((r) => r.frames))];
  let at = 0;
  const images = runs.map((r) => {
    const delay = at ? ` style="animation-delay:${+(at / fps).toFixed(3)}s"` : '';
    at += r.frames;
    return `<image class="h${r.frames}" href="${escape(r.href)}" width="${width}" height="${height}"${delay}/>`;
  });
  const style = [
    `image{opacity:0;image-rendering:pixelated;animation:${seconds}s step-end infinite}`,
    'image:first-of-type{opacity:1}',
    ...holds.map((n) => `.h${n}{animation-name:h${n}}@keyframes h${n}{0%{opacity:1}${+((100 * n) / total).toFixed(4)}%{opacity:0}}`),
    '@media (prefers-reduced-motion:reduce){image{animation:none}}'
  ].join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * scale}" height="${height * scale}" image-rendering="optimizeSpeed">`,
    title ? `<title>${escape(title)}</title>` : '',
    desc ? `<desc>${escape(desc)}</desc>` : '',
    `<style>${style}</style>`,
    ...images,
    '</svg>',
    ''
  ].filter((line) => line !== '').join('\n') + '\n';
}
