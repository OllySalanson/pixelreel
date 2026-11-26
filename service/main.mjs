#!/usr/bin/env node
// Runs the Pixel Reel service: npm run service
// PORT (default 8787) is where it listens; PIXELREEL_URL is the address people reach it at
// (default http://localhost:PORT), used in the links it gives; PIXELREEL_DATA is the folder
// it keeps reels in (default .service-data), unless PIXELREEL_S3_BUCKET names a bucket to keep
// them in instead (with PIXELREEL_S3_ENDPOINT, _REGION, _KEY_ID and _SECRET; see
// docs/deploy.md). PIXELREEL_TRUST_PROXY=1 behind a proxy that sets X-Forwarded-For (or how
// many proxies, if more than one); PIXELREEL_REELS_PER_HOUR (each caller, default 10),
// PIXELREEL_REELS_PER_DAY (everyone, default 300) and PIXELREEL_VIDEOS_PER_HOUR (default 10) set
// the rate limits, and PIXELREEL_CLAUDE_PER_HOUR (default 60) what everyone using Claude may
// make between them, as they all call from the few addresses in PIXELREEL_CLAUDE_ADDRESSES
// (default Anthropic's published ones).
// PIXELREEL_LISTED=1 lets search engines list the website (never the reels); without it every
// page asks them not to, for as long as Pixel Reel is by invitation. Unless NODE_ENV is
// production (as it is in the image), browsers check for a newer copy of the site's files
// every time, so a change shows on the next reload. PIXELREEL_TRY=1 switches on Make it
// right here, where the service has Claude write a reel for a visitor (it needs a credential
// for the Claude API, such as ANTHROPIC_API_KEY, and costs money a reel: docs/service.md);
// PIXELREEL_TRY_MODEL (default claude-sonnet-5-5), PIXELREEL_TRY_EFFORT, PIXELREEL_TRIES_PER_HOUR
// (each visitor, default 5) and PIXELREEL_TRIES_PER_DAY (everyone, default 30) set which model,
// how hard it thinks, and how many.
// Recording needs Pocket TTS set up (scripts/setup-voices.sh) and ffmpeg; videos need
// @napi-rs/canvas. The voice is loaded once, when the service starts, and kept ready
// (service/voice.mjs); PIXELREEL_WARM_VOICE=0 loads it afresh for each reel instead.
// PIXELREEL_LANGUAGES (such as french,spanish) lets reels be made in other languages Peter can read.
// PIXELREEL_NARRATORS (such as anna,stuart) lets someone ask for a narrator other than Peter.
// PIXELREEL_PICTURES=cards puts the pictures back to the cards alone, as before the stage.
// PIXELREEL_BOTTLE_KEY is Olly's own key to Message in a Bottle's note button (the link
// #bottle=<key>), and PIXELREEL_BOTTLE_READER the admin key, which adds sites and people and
// reads the notes (the message-in-a-bottle package's README). It sends email through Resend
// when PIXELREEL_RESEND_KEY and PIXELREEL_BOTTLE_MAIL_FROM (an address on the account's
// sending domain) are both set; otherwise each email is kept in its outbox and none is sent.
// PIXELREEL_BOTTLE_REPLY_TO is Olly's own address: replies to its emails go there, and so does word of new notes.
// PIXELREEL_RESEND_WEBHOOK_SECRET is the signing secret of the Resend webhook that says when
// an email bounced (docs/deploy.md).
import { join } from 'node:path';
import { resend } from 'message-in-a-bottle/mail';
import { Hearing } from './hear.mjs';
import { CLAUDE_ADDRESSES, RateLimit } from './limits.mjs';
import { NARRATORS, recordWith, Reels } from './reels.mjs';
import { PICTURE_MODES } from './mcp.mjs';
import { createService } from './server.mjs';
import { DiskStore, S3Store } from './store.mjs';
import { POCKET_LANGUAGES } from '../scripts/voices.mjs';
import { WarmVoice } from './voice.mjs';

const port = Number(process.env.PORT) || 8787;
const baseUrl = process.env.PIXELREEL_URL || `http://localhost:${port}`;
const data = process.env.PIXELREEL_DATA || join(process.cwd(), '.service-data');
const log = (line) => console.log(`${new Date().toISOString()} ${line}`);

const store = process.env.PIXELREEL_S3_BUCKET ? S3Store.fromEnv(process.env) : new DiskStore(data);
// The voice is loaded as soon as the service wakes, and kept: by the time Claude has written
// a reel's scenes, Peter is ready to read them. PIXELREEL_WARM_VOICE=0 loads it for each reel instead.
// Another language's model is loaded the first time a reel is in it, and kept for the next:
// PIXELREEL_KEEP_LANGUAGES says how many are held at once (2 unless told; each is about 220 MB to hold).
const voice = process.env.PIXELREEL_WARM_VOICE === '0' ? null : new WarmVoice({ log, keep: Number(process.env.PIXELREEL_KEEP_LANGUAGES) || 2 });
voice?.start();
// Peter reads English. PIXELREEL_LANGUAGES names the other languages he may read here (french, german,
// spanish, italian, portuguese, dutch): only ones whose voice models are to hand (docs/deploy.md).
const asked = (process.env.PIXELREEL_LANGUAGES ?? '').split(',').map((l) => l.trim().toLowerCase()).filter(Boolean);
const languages = asked.filter((l) => l !== 'english' && POCKET_LANGUAGES.includes(l));
for (const l of asked) if (l !== 'english' && !languages.includes(l)) log(`PIXELREEL_LANGUAGES: Peter does not read "${l}"; he reads ${POCKET_LANGUAGES.join(', ')}`);
if (languages.length) log(`Peter also reads ${languages.join(', ')} here`);
// Peter narrates. PIXELREEL_NARRATORS names others who may be asked for here (anna, vera, stuart, charles,
// paul): only ones whose voices are to hand (docs/deploy.md).
const wanted = (process.env.PIXELREEL_NARRATORS ?? '').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
const narrators = wanted.filter((n) => NARRATORS[n]);
for (const n of wanted) if (n !== 'peter' && !NARRATORS[n]) log(`PIXELREEL_NARRATORS: there is no narrator "${n}"; there are ${Object.keys(NARRATORS).join(', ')}`);
if (narrators.length) log(`${narrators.join(', ')} can narrate here too`);
// PIXELREEL_PICTURES=cards switches the pictures back to the cards alone, exactly as before the
// stage: what Claude is told and what is taken. Reels already made with a stage still play.
const pictures = process.env.PIXELREEL_PICTURES === 'cards' ? 'cards' : 'stage';
if (process.env.PIXELREEL_PICTURES && !PICTURE_MODES.includes(process.env.PIXELREEL_PICTURES)) log(`PIXELREEL_PICTURES: "${process.env.PIXELREEL_PICTURES}" is not one of ${PICTURE_MODES.join(', ')}; using the stage`);
if (pictures === 'cards') log('the pictures are the cards alone, as before the stage (PIXELREEL_PICTURES=cards)');
// The critic looks at every reel's pictures while Peter records, and mends what is wrong
// (service/critic.mjs). It needs a credential for the Claude API and the stage switched on;
// PIXELREEL_CRITIC=0 turns it off, and PIXELREEL_CRITIC_PER_DAY (default 100) bounds what it costs.
let critic = null;
if (pictures === 'stage' && process.env.PIXELREEL_CRITIC !== '0') {
  try {
    const { createCritic } = await import('./critic.mjs');
    critic = createCritic({ model: process.env.PIXELREEL_CRITIC_MODEL || undefined, perDay: Number(process.env.PIXELREEL_CRITIC_PER_DAY) || 100, log });
    log(`the critic looks at every reel's pictures, at most ${Number(process.env.PIXELREEL_CRITIC_PER_DAY) || 100} a day`);
  } catch (err) {
    log(`the critic stays off: ${err.message}`);   // no credential for the Claude API, most likely
  }
}
const reels = new Reels({ store, log, languages, narrators, pictures, critic, record: recordWith(voice ? (...job) => voice.speak(...job) : null) });
await reels.resume();
const sweep = async () => {
  const gone = await reels.sweep().catch((err) => { log(`sweep failed: ${err.message}`); return []; });
  if (gone.length) log(`deleted ${gone.length} expired reel${gone.length === 1 ? '' : 's'}`);
};
await sweep();
setInterval(sweep, 3600_000).unref();

const setting = (name, fallback) => Number(process.env[name]) || fallback;
// everyone using Claude calls from a few addresses of Anthropic's, so they share one, bigger, allowance
const ranges = process.env.PIXELREEL_CLAUDE_ADDRESSES === undefined ? CLAUDE_ADDRESSES : process.env.PIXELREEL_CLAUDE_ADDRESSES.split(',').map((r) => r.trim()).filter(Boolean);
const shared = { ranges, perHour: setting('PIXELREEL_CLAUDE_PER_HOUR', 60) };
const limits = {
  reels: new RateLimit({ perHour: setting('PIXELREEL_REELS_PER_HOUR', 10), perDay: setting('PIXELREEL_REELS_PER_DAY', 300), shared }),
  videos: new RateLimit({ perHour: setting('PIXELREEL_VIDEOS_PER_HOUR', 10), perDay: setting('PIXELREEL_REELS_PER_DAY', 300), shared }),
  tries: new RateLimit({ perHour: setting('PIXELREEL_TRIES_PER_HOUR', 5), perDay: setting('PIXELREEL_TRIES_PER_DAY', 30) }),
  // pieces of a note said aloud, a few seconds each: about half an hour of speaking an hour, for each visitor
  hearing: new RateLimit({ perHour: 1200, perDay: 20000 })
};

// Make it right here: off unless asked for, because each reel it writes is paid for
let writer = null;
if (process.env.PIXELREEL_TRY === '1') {
  try {
    const { createWriter } = await import('./writer.mjs');
    writer = createWriter({ model: process.env.PIXELREEL_TRY_MODEL || undefined, effort: process.env.PIXELREEL_TRY_EFFORT || undefined, pictures, log });
    log(`Make it right here is on: at most ${limits.tries.perDay} reels a day, ${limits.tries.perHour} an hour for each visitor`);
  } catch (err) {
    log(`Make it right here stays off: ${err.message}`);   // no credential for the Claude API, most likely
  }
}

// My notes' microphone where the browser cannot hear (Brave, Firefox): a Whisper model on this
// machine writes it down, loaded the first time someone speaks. Only where there are notes to
// write it into (Make it right here), and only with PIXELREEL_HEAR=1, as it needs faster-whisper
// and its model (about 150 MB; the image has them). PIXELREEL_HEAR_MODEL chooses another.
const hearing = writer && process.env.PIXELREEL_HEAR === '1'
  ? new Hearing({ model: process.env.PIXELREEL_HEAR_MODEL || undefined, threads: Number(process.env.THREADS) || 2, log })
  : null;
if (hearing) log(`My notes can hear in every browser, with ${hearing.model}`);

const replyTo = process.env.PIXELREEL_BOTTLE_REPLY_TO ?? '';
const bottle = { key: process.env.PIXELREEL_BOTTLE_KEY ?? '', reader: process.env.PIXELREEL_BOTTLE_READER ?? '', replyTo, notify: replyTo, hook: process.env.PIXELREEL_RESEND_WEBHOOK_SECRET ?? '' };
const resendKey = process.env.PIXELREEL_RESEND_KEY ?? '', mailFrom = process.env.PIXELREEL_BOTTLE_MAIL_FROM ?? '';
if (resendKey && mailFrom) bottle.mail = resend({ key: resendKey, from: mailFrom, log });
else if (resendKey || mailFrom) log(`Message in a Bottle sends no email: ${resendKey ? 'PIXELREEL_BOTTLE_MAIL_FROM' : 'PIXELREEL_RESEND_KEY'} is not set, so each one is kept in its outbox`);
if (bottle.key || bottle.reader) log(`Message in a Bottle is on${bottle.reader ? '' : ', but only Olly can read the notes: PIXELREEL_BOTTLE_READER is not set'}, ${bottle.mail ? 'sending email through Resend' : 'keeping its emails in the outbox'}`);
// The day's summary for Olly (service/daybook.mjs): a page at /day for whoever holds the admin
// key, and, where email is set up, an email each evening after 21:00 UTC, once a day. The service
// may be asleep then (it sleeps when nobody uses it), so POST /day/send does the same for a schedule.
if (bottle.mail && replyTo) {
  const evening = async () => {
    if (new Date().getUTCHours() < 21) return;
    const { dayOf, sendSummary } = await import('./daybook.mjs');
    await sendSummary(store, dayOf(Date.now()), { mail: bottle.mail, to: replyTo }).catch((err) => log(`the day's summary could not be sent: ${err.message}`));
  };
  setInterval(evening, 15 * 60_000).unref();
}
const server = createService({ reels, baseUrl, log, limits, writer, hearing, bottle, trustProxy: Number(process.env.PIXELREEL_TRUST_PROXY) || 0, listed: process.env.PIXELREEL_LISTED === '1', fresh: process.env.NODE_ENV !== 'production' });
server.listen(port, () => log(`Pixel Reel is at ${baseUrl}: connector ${baseUrl}/mcp, reels kept in ${store}`));

const stop = () => {
  log('stopping: finishing the job in hand first');
  server.close();
  reels.stop().then(() => { voice?.stop(); hearing?.stop(); process.exit(0); });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
