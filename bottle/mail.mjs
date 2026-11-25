// Message in a Bottle, the emails it sends: the invitation with a person's own link, the
// sign-in link asked for at a site's /review page, the news of what came of a person's notes
// (all of them since the last, in one email), and, to whoever looks after the sites, word that
// new notes have come in. Each is built here as { to, subject, text, replyTo }; sending is
// whatever `mail` the endpoint is given (see README.md, "Sending email"): resend() sends through
// Resend. Without one, every email is kept in the store's outbox (bottles/outbox/<id>/mail.json),
// where `bottles outbox` shows it, and nothing leaves the service.

/** The address people are told to go back to: the site's own address and /review, without https://. */
export const reviewAddress = (site, path = '/review') => `${new URL(site.origins[0]).host}${path}`;

/**
 * The link that offers to switch the button on in whichever browser opens it, on the site's
 * page if it has one (a site that lives under a path), or else its home page. The code is in
 * the part after #, which a browser never sends to the site, so it is in none of the site's
 * logs, and the page takes it out of its address at once.
 */
export const keyLink = (site, code) => `${site.page ?? `${site.origins[0]}/`}#bottle=${encodeURIComponent(code)}`;

/** What stands in for a link in an email that must not carry one. */
export const NO_LINK = '(link removed for preview)';

const first = (name) => String(name).trim().split(/\s+/)[0] || 'there';
const quoted = (words, most = 200) => {
  const line = String(words).replace(/\s+/g, ' ').trim();
  return `"${line.length > most ? `${line.slice(0, most - 3)}...` : line}"`;
};
/** The end of every email: where a reply goes, if anywhere, and who it is from. */
const ending = ({ from = '', replyTo = '' }) => `${replyTo ? `\n\nReply to this email to reach ${from || 'us'}.` : ''}${from ? `\n\n${from}` : ''}`;
const message = (to, subject, text, replyTo) => ({ to, subject, text, ...(replyTo ? { replyTo } : {}) });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The first email a person gets: who it is from, their own link, and the short address for next time. */
export function inviteMail({ site, person, code, from = '', replyTo = '', path = '/review' }) {
  return message(person.email, `${site.name}: your link to leave notes on the new site`, `Hello ${first(person.name)},
${from ? `\nI'm ${from}, and I'm looking after the work on ${site.name}.\n` : ''}
${site.name} is ready for you to look at. Open this link, on any phone or computer, to switch on the note button:

${code ? keyLink(site, code) : NO_LINK}

It works for 7 days.

Then press Note, choose the part of the page, and say or type what you would like changed. We will email you when it is done, or why not.

Next time, or once the link has run out, go to ${reviewAddress(site, path)}${ending({ from, replyTo })}`, replyTo);
}

/** The link asked for at /review: it works once, for half an hour. */
export function signInMail({ site, person, code, from = '', replyTo = '' }) {
  return message(person.email, `${site.name}: your sign-in link`, `Hello ${first(person.name)},

Open this link to switch on the note button for ${site.name}:

${keyLink(site, code)}

It works once, for the next 30 minutes.${ending({ from, replyTo })}`, replyTo);
}

/** The page a note was left on, as a link, or the site's own address. */
const pageOf = (site, note) => note.page?.url || site.origins[0];

/**
 * What came of a person's notes since the last email, all in one: each done note with what was
 * done, each declined one with the reason, under a link to the page it was left on.
 */
export function newsMail({ site, person, notes, from = '', replyTo = '' }) {
  const done = notes.every((n) => n.state === 'done');
  const subject = `${site.name}: ${done
    ? notes.length === 1 ? 'your note is done' : `${notes.length} of your notes are done`
    : notes.length === 1 ? 'what came of your note' : `what came of ${notes.length} of your notes`}`;
  const pages = new Map();
  for (const n of notes) pages.set(pageOf(site, n), [...(pages.get(pageOf(site, n)) ?? []), n]);
  const said = (n) => (n.state === 'done'
    ? `Done: ${quoted(n.note)}${n.outcome?.what ? `\nWhat we did: ${n.outcome.what}` : ''}`
    : `Not done: ${quoted(n.note)}${n.outcome?.reason ? `\n${n.outcome.reason}` : ''}`);
  const body = [...pages].map(([page, theirs]) => `${page}\n\n${theirs.map(said).join('\n\n')}`).join('\n\n\n');
  return message(person.email, subject, `Hello ${first(person.name)},

Here is what came of ${notes.length === 1 ? 'your note' : `${notes.length} of your notes`} on ${site.name}.

${body}${ending({ from, replyTo })}`, replyTo);
}

/** Word, to whoever looks after the sites, that notes have come in on a site, with a link to its queue. */
export function arrivedMail({ to, site, notes, queue }) {
  return message(to, `${site.name}: ${plural(notes.length, 'new note')}`, `${plural(notes.length, 'new note')} on ${site.name}:

${notes.map((n) => `${n.by || n.person}: ${quoted(n.note, 120)}`).join('\n')}

${queue}`);
}

/** A `mail` that sends nothing: it keeps each email in the store, as bottles/outbox/<id>/mail.json. */
export function outbox(store, { now = () => Date.now(), log = () => {} } = {}) {
  let n = 0;
  return async (message) => {
    const at = new Date(now());
    const id = `${at.toISOString().replace(/[-:T.Z]/g, '').slice(0, 17)}-${String(n++ % 1000).padStart(3, '0')}`;
    await store.put(`bottles/outbox/${id}/mail.json`, JSON.stringify({ id, at: at.toISOString(), ...message }, null, 2));
    log(`bottle: an email was kept in the outbox, not sent: "${message.subject}"`);
    return { id: null };
  };
}

/**
 * A `mail` that sends through Resend (resend.com), with an API key of the account whose
 * sending domain `from` is on, such as 'Olly <notes@example.com>'. A message's replyTo goes as
 * its reply-to address. Resolves to { id }, Resend's id for the email; throws if Resend says no.
 */
export function resend({ key, from, fetch = globalThis.fetch, log = () => {} }) {
  if (!key || !from) throw new Error('Resend needs an API key and a from address on its sending domain.');
  return async ({ to, subject, text, replyTo }) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) })
    });
    if (!res.ok) throw new Error(`Resend would not send "${subject}": ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
    log(`bottle: an email was sent, "${subject}"`);
    const id = (await res.json().catch(() => null))?.id;
    return { id: typeof id === 'string' ? id : null };
  };
}
