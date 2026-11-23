// Message in a Bottle, the emails it sends: the invitation with a person's own link, the
// sign-in link asked for at a site's /review page, and the word that a note is done. Each is
// built here as { to, subject, text }; sending is whatever `mail` the endpoint is given (see
// README.md, "Sending email"). Without one, every email is kept in the store's outbox
// (bottles/outbox/<id>/mail.json), where `bottles outbox` shows it, and nothing leaves the service.

/** The address people are told to go back to: the site's own address and /review, without https://. */
export const reviewAddress = (site, path = '/review') => `${new URL(site.origins[0]).host}${path}`;

/** The link that switches the button on in whichever browser opens it. */
export const keyLink = (site, key) => `${site.origins[0]}/?bottle=${encodeURIComponent(key)}`;

const first = (name) => String(name).trim().split(/\s+/)[0] || 'there';
const quoted = (words, most = 200) => {
  const line = String(words).replace(/\s+/g, ' ').trim();
  return `"${line.length > most ? `${line.slice(0, most - 3)}...` : line}"`;
};
const signed = (from) => (from ? `\n\n${from}` : '');

/** The first email a person gets: their own link, and the short address for next time. */
export function inviteMail({ site, person, key, from = '', path = '/review' }) {
  return {
    to: person.email,
    subject: 'Review your website',
    text: `Hello ${first(person.name)},

${site.name} is ready for you to look at. Open this link to switch on the note button:

${keyLink(site, key)}

Then press Note, choose the part of the page, and say or type what you would like changed. We will email you when it is done.

Next time, on any phone or computer, go to ${reviewAddress(site, path)}${signed(from)}`
  };
}

/** The link asked for at /review: it works once, for half an hour. */
export function signInMail({ site, person, key, from = '' }) {
  return {
    to: person.email,
    subject: `Your link to review ${site.name}`,
    text: `Hello ${first(person.name)},

Open this link to switch on the note button for ${site.name}:

${keyLink(site, key)}

It works once, for the next 30 minutes.${signed(from)}`
  };
}

/** The word that a note is done, with what was done. */
export function doneMail({ site, person, note, from = '' }) {
  return {
    to: person.email,
    subject: 'Your note is done',
    text: `Hello ${first(person.name)},

You asked: ${quoted(note.note)}

${note.outcome?.what ? `What we did: ${note.outcome.what}\n\n` : ''}See it here: ${note.page?.url || site.origins[0]}${signed(from)}`
  };
}

/** A `mail` that sends nothing: it keeps each email in the store, as bottles/outbox/<id>/mail.json. */
export function outbox(store, { now = () => Date.now(), log = () => {} } = {}) {
  let n = 0;
  return async (message) => {
    const at = new Date(now());
    const id = `${at.toISOString().replace(/[-:T.Z]/g, '').slice(0, 17)}-${String(n++ % 1000).padStart(3, '0')}`;
    await store.put(`bottles/outbox/${id}/mail.json`, JSON.stringify({ id, at: at.toISOString(), ...message }, null, 2));
    log(`bottle: an email was kept in the outbox, not sent: "${message.subject}"`);
  };
}
