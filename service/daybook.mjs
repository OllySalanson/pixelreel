// The day book: a line for every reel made, and each day's summary for Olly. Kept under
// daybook/<day>/<id>.json in the reels' store, apart from the reels, so it outlives them. It
// keeps no more than the summary needs: a reel's title cut to a few words, how many scenes and
// of what kind, which drawings it used, what it wished the library had, and what the critic
// made of it. Never what was said, a caption, a label, or anything the visitor gave.
import { CAST } from '../src/stage.js';

/** The folder in the store. */
export const DAYBOOK = 'daybook';

/** The day a time falls on, as YYYY-MM-DD (UTC). */
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/** A name as the day book keeps it: lower case, plain letters and spaces, short. Null for anything else. */
export function plainName(text) {
  const name = String(text ?? '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return name && name.length <= 40 && /^[\p{L}\p{N} ']+$/u.test(name) ? name : null;
}

/** What the day book keeps of a reel (reel.json, parsed): never its words. */
export function entryOf(raw, { how = 'connector', wishes = [] } = {}) {
  const kinds = {}, things = new Set(), own = new Set();
  for (const scene of raw.scenes ?? []) {
    const p = scene.picture, kind = p?.type ?? 'card';
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    if (kind !== 'stage') continue;
    for (const th of p.things ?? []) {
      if (Array.isArray(th.rows)) { const n = plainName(th.id); if (n) own.add(n); } else if (typeof th.is === 'string' && !CAST.includes(th.is)) things.add(th.is);
    }
  }
  const title = String(raw.title ?? '').split(/\s+/).slice(0, 6).join(' ').slice(0, 60);
  return {
    title, how, scenes: (raw.scenes ?? []).length, kinds, things: [...things].sort(), own: [...own].sort(),
    wishes: [...new Set((Array.isArray(wishes) ? wishes : []).map(plainName).filter(Boolean))].slice(0, 5)
  };
}

/** Whether a reel had the right drawings: nothing wished for, nothing drawn by hand, and nothing the critic found that it could not mend. */
export const hadRight = (entry) => !entry.wishes.length && !entry.own.length && !(entry.critic && entry.critic.faults && !entry.critic.mended);

/** Every entry for `day` in `store`. */
export async function entriesFor(store, day) {
  const keys = await store.list(`${DAYBOOK}/${day}`);
  const entries = await Promise.all(keys.filter((k) => k.endsWith('.json')).map(async (k) => { try { return JSON.parse(await store.get(k)); } catch { return null; } }));
  return entries.filter(Boolean).sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** The drawings wished for, most wanted first: from the wishes, the things drawn by hand, and the critic's. */
export function wanted(entries) {
  const count = new Map();
  for (const e of entries) for (const name of new Set([...e.wishes, ...e.own, ...(e.critic?.wishes ?? [])])) count.set(name, (count.get(name) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, reels]) => ({ name, reels }));
}

/** A day's summary: how many reels, which had the right drawings, and the drawings to make. */
export async function daySummary(store, day) {
  const entries = await entriesFor(store, day);
  return {
    day,
    reels: entries.length,
    right: entries.filter(hadRight).length,
    stages: entries.reduce((n, e) => n + (e.kinds.stage ?? 0), 0),
    scenes: entries.reduce((n, e) => n + e.scenes, 0),
    each: entries.map((e) => ({ title: e.title, how: e.how, scenes: e.scenes, stages: e.kinds.stage ?? 0, right: hadRight(e), critic: e.critic ?? null, gaps: [...new Set([...e.wishes, ...e.own, ...(e.critic?.wishes ?? [])])] })),
    wanted: wanted(entries)
  };
}

/** The drawings wanted over the `days` days up to and including `day`, most wanted first. */
export async function wantedOver(store, day, days = 7) {
  const all = [];
  for (let i = 0; i < days; i++) all.push(...(await entriesFor(store, dayOf(Date.parse(day) - i * 86400000))));
  return { from: dayOf(Date.parse(day) - (days - 1) * 86400000), to: day, reels: all.length, wanted: wanted(all) };
}

/** A day's summary in plain words, for an email. */
export function summaryText(s) {
  if (!s.reels) return `Pixel Reel, ${s.day}: no reels were made.`;
  const lines = [
    `Pixel Reel, ${s.day}: ${s.reels} reel${s.reels === 1 ? '' : 's'} made, ${s.scenes} scenes, ${s.stages} of them a stage.`,
    `${s.right} of ${s.reels} had the right drawings.`,
    '',
    ...s.each.map((e) => `- ${e.title} (${e.scenes} scenes, ${e.stages} stages, by ${e.how}): ${e.right ? 'the right drawings' : `missing ${e.gaps.join(', ') || 'drawings the critic could not mend'}`}${e.critic?.faults ? `; the critic found ${e.critic.faults} fault${e.critic.faults === 1 ? '' : 's'}${e.critic.mended ? ' and mended them' : ''}` : ''}.`)
  ];
  if (s.wanted.length) lines.push('', 'Drawings to make, most wanted first:', ...s.wanted.map((w) => `- ${w.name} (${w.reels} reel${w.reels === 1 ? '' : 's'})`));
  return lines.join('\n');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/** A day's summary as one plain page: big numbers, one line a reel, and the drawings to make. */
export function summaryHtml(s) {
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Pixel Reel, ${esc(s.day)}</title>
<style>
  body { margin: 0; background: #0d1b2a; color: #ebeac5; font: 18px/1.5 Verdana, 'DejaVu Sans', sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { color: #ffcc4d; font-size: 28px; margin: 0 0 16px; }
  h2 { color: #ffcc4d; font-size: 20px; margin: 28px 0 8px; }
  .big { display: flex; gap: 24px; flex-wrap: wrap; }
  .big div { background: #13203a; border: 2px solid #24476b; border-radius: 6px; padding: 10px 16px; }
  .big b { display: block; font-size: 32px; color: #ffcc4d; }
  ul { padding-left: 20px; } li { margin: 4px 0; }
  .ok { color: #55d6be; } .gap { color: #ff8c2a; }
</style></head><body><main>
<h1>Pixel Reel, ${esc(s.day)}</h1>
<div class="big"><div><b>${s.reels}</b>reels</div><div><b>${s.right}</b>right drawings</div><div><b>${s.stages}</b>stages of ${s.scenes} scenes</div></div>
${s.reels ? `<h2>Each reel</h2>\n<ul>${s.each.map((e) => `<li>${esc(e.title)} <small>(${e.scenes} scenes, ${e.stages} stages, by ${esc(e.how)})</small>: ${e.right ? '<span class="ok">the right drawings</span>' : `<span class="gap">missing ${esc(e.gaps.join(', ') || 'drawings the critic could not mend')}</span>`}</li>`).join('')}</ul>` : '<p>No reels were made.</p>'}
${s.wanted.length ? `<h2>Drawings to make</h2>\n<ul>${s.wanted.map((w) => `<li>${esc(w.name)} <small>(${w.reels} reel${w.reels === 1 ? '' : 's'})</small></li>`).join('')}</ul>` : ''}
</main></body></html>
`;
}

/** True when the request carries the admin key as `Authorization: Bearer <key>`; never from the address, which is kept in logs. */
function admitted(req, key) {
  const given = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? '';
  if (!key || given.length !== key.length) return false;
  let differ = 0;
  for (let i = 0; i < key.length; i++) differ |= key.charCodeAt(i) ^ given.charCodeAt(i);
  return differ === 0;
}

/** What to set so the summary can be emailed, when it cannot. */
export const NO_MAIL = 'No email can be sent: set PIXELREEL_RESEND_KEY and PIXELREEL_BOTTLE_MAIL_FROM (a Resend account with pixelreel.pro as its sending domain), and PIXELREEL_BOTTLE_REPLY_TO, the address it goes to.';

/** Emails `day`'s summary to `to` with `mail` (resend() from message-in-a-bottle/mail), once: a second time does nothing. */
export async function sendSummary(store, day, { mail, to }) {
  if (!mail || !to) throw new Error(NO_MAIL);
  const sent = `${DAYBOOK}/sent/${day}.json`;
  if (await store.get(sent).catch(() => null)) return { sent: false, already: true };
  const s = await daySummary(store, day);
  await mail({ to, subject: `Pixel Reel today: ${s.reels} reel${s.reels === 1 ? '' : 's'}, ${s.right} with the right drawings`, text: summaryText(s) });
  await store.put(sent, JSON.stringify({ at: new Date().toISOString(), to }));
  return { sent: true };
}

/**
 * The day book's addresses, for whoever holds the admin key (`reader`), sent as a Bearer token:
 *   GET  /day, /day/<YYYY-MM-DD>   that day's summary as a page (or JSON, with .json or Accept)
 *   GET  /day/wanted[?days=7]      the drawings wanted over the last days, for the weekly sheet
 *   POST /day/send[?day=...]       emails the day's summary to Olly, once, if email is set up
 * True if the request was one of them.
 */
export async function handleDaybook(req, res, { store, reader, mail = null, to = '', now = () => Date.now() }) {
  const url = new URL(req.url, 'http://localhost'), path = url.pathname;
  if (!/^\/day(?:\.json)?(?:\/|$)/.test(path)) return false;
  const send = (status, type, body) => res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff' }).end(body);
  const json = (status, body) => send(status, 'application/json; charset=utf-8', JSON.stringify(body));
  if (!reader) { json(404, { error: 'There is no day book here.' }); return true; }
  if (!admitted(req, reader)) { json(401, { error: 'Give the admin key as "Authorization: Bearer <key>".' }); return true; }
  const today = dayOf(now()), asked = url.searchParams.get('day') ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asked)) { json(400, { error: 'A day is YYYY-MM-DD.' }); return true; }
  if (path === '/day/wanted' && req.method === 'GET') {
    json(200, await wantedOver(store, today, Math.min(31, Math.max(1, Number(url.searchParams.get('days')) || 7))));
    return true;
  }
  if (path === '/day/send' && req.method === 'POST') {
    try { json(200, await sendSummary(store, asked, { mail, to })); } catch (err) { json(503, { error: err.message }); }
    return true;
  }
  const m = /^\/day(?:\/(\d{4}-\d{2}-\d{2}))?(\.json)?$/.exec(path);
  if (!m || req.method !== 'GET') { json(404, { error: 'Not a day book address.' }); return true; }
  const summary = await daySummary(store, m[1] ?? today);
  if (m[2] || /application\/json/.test(req.headers.accept ?? '')) json(200, summary);
  else send(200, 'text/html; charset=utf-8', summaryHtml(summary));
  return true;
}
