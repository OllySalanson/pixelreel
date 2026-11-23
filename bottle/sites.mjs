// Message in a Bottle, who may leave notes: the sites the button is on, and the people on each
// site's list. Each person has keys of their own (one in the link they were sent, one more each
// time they sign in at the site's /review page), so a person is turned off alone, and a wrong or
// turned-off key shows nothing. Only a hash of each key is kept, so the store holds no key that
// works. Kept in the same store as the notes:
//
//   bottles/sites/<site>/site.json   { id, name, origins, people: [{ id, name, email, on, added }] }
//   bottles/keys/<hash>.json         { site, person, at, via }: whose key it is
//   bottles/codes/<hash>.json        { site, person, until, used }: a sign-in link's one-time code
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A message for whoever asked, saying what was wrong with what they asked. */
export class Said extends Error {}

/** What a site's or a person's id may be: short, lower case, readable in a command. */
export const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** How long a sign-in link works, once sent. */
export const CODE_MS = 30 * 60_000;

const hash = (token) => createHash('sha256').update(String(token)).digest('hex');
const sha = (text) => createHash('sha256').update(String(text)).digest();
/** Whether `given` is `secret`, taking as long whatever it is. */
export const same = (given, secret) => typeof given === 'string' && given.length > 0 && typeof secret === 'string' && secret.length > 0 && timingSafeEqual(sha(given), sha(secret));

/** A new key or code: 32 characters that can go in an address as they are. */
export const newToken = () => randomBytes(24).toString('base64url');

/** An address made plain for comparing: trimmed and in lower case. */
export const plainEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** A site's address as an origin (https://example.com), or a message saying what is wrong with it. */
export function originOf(address) {
  let url;
  try { url = new URL(address); } catch { throw new Said(`"${address}" is not an address, such as https://example.com`); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Said(`"${address}" is not a web address`);
  return url.origin;
}

/** An id from a name: "Sam O'Neill" is sam-oneill. */
export const slug = (name) => String(name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'person';

const shown = (person) => ({ id: person.id, name: person.name, email: person.email ?? '', on: person.on !== false, added: person.added ?? null, ...(person.owner ? { owner: true } : {}) });

/**
 * The sites and their people, kept in `store`. `home` is the site the service itself is (its
 * id, name and origins), which is there even before anything is kept for it; `owner` is the
 * person whose key is the service's own secret (`ownerKey`), who is on the home site's list
 * and may read every site's notes.
 */
export class Sites {
  constructor({ store, home = null, owner = null, ownerKey = '', now = () => Date.now(), keep = 60_000 }) {
    Object.assign(this, { store, home, owner, ownerKey, now, keep, origins: null });
  }

  /** Every site, in order of id. */
  async all() {
    const ids = (await this.store.folders('bottles/sites')).filter((id) => ID.test(id));
    if (this.home && !ids.includes(this.home.id)) ids.push(this.home.id);
    const found = await Promise.all(ids.sort().map((id) => this.get(id)));
    return found.filter(Boolean);
  }

  /** One site, or null. The home site always is one, with its origins whatever is kept. */
  async get(id) {
    if (!ID.test(String(id))) return null;
    const bytes = await this.store.get(`bottles/sites/${id}/site.json`);
    const kept = bytes ? JSON.parse(bytes) : null;
    if (id !== this.home?.id) return kept;
    const site = { id, name: this.home.name, origins: [], people: [], ...kept };
    site.origins = [...new Set([...this.home.origins.map(originOf), ...site.origins])];
    const owner = this.owner && this.ownerKey ? { id: this.owner.id, name: this.owner.name, email: this.owner.email ?? '', on: true, owner: true } : null;
    if (owner && !site.people.some((p) => p.id === owner.id)) site.people = [owner, ...site.people];
    return site;
  }

  async save(site) {
    const people = site.people.filter((p) => !(p.owner && site.id === this.home?.id && p.id === this.owner?.id));
    await this.store.put(`bottles/sites/${site.id}/site.json`, JSON.stringify({ ...site, people }, null, 2));
    this.origins = null;
  }

  /** What a site is said to be, for whoever looks after them: no keys, and people as they are shown. */
  static shown(site) {
    return { id: site.id, name: site.name, origins: site.origins, people: site.people.map(shown) };
  }

  /** Adds a site (or changes the name and origins of one there already). */
  async add({ id, name, origins }) {
    if (!ID.test(String(id))) throw new Said('A site\'s id is short, in lower case letters, numbers and dashes, such as civ-speak.');
    const list = (Array.isArray(origins) ? origins : [origins]).filter(Boolean).map(originOf);
    if (!list.length && id !== this.home?.id) throw new Said('Name the site\'s address, such as https://civspeak.com.');
    const site = (await this.get(id)) ?? { id, name: '', origins: [], people: [] };
    site.name = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : site.name || id;
    site.origins = [...new Set([...site.origins, ...list])];
    await this.save(site);
    return site;
  }

  /** The site whose pages are at `origin`, or null. */
  async at(origin) {
    if (!origin) return null;
    for (const site of await this.all()) if (site.origins.includes(origin)) return site;
    return null;
  }

  /** Every origin a site is at, kept for a minute, for answering browsers on other sites. */
  async allowed(origin) {
    if (!this.origins || this.origins.until < this.now()) {
      const all = new Set((await this.all()).flatMap((s) => s.origins));
      this.origins = { all, until: this.now() + this.keep };
    }
    return this.origins.all.has(origin);
  }

  /** Puts a person on a site's list, with a key for the link they are sent. Returns { person, key }. */
  async addPerson(siteId, { name, email }) {
    const site = await this.get(siteId);
    if (!site) throw new Said(`There is no site "${siteId}".`);
    const plain = plainEmail(email);
    if (!String(name ?? '').trim()) throw new Said('Give the person\'s name.');
    if (!EMAIL.test(plain)) throw new Said('Give the person\'s email address.');
    if (site.people.some((p) => plainEmail(p.email) === plain)) throw new Said(`${plain} is on ${site.name}'s list already.`);
    let id = slug(name);
    for (let n = 2; site.people.some((p) => p.id === id); n++) id = `${slug(name)}-${n}`;
    const person = { id, name: String(name).trim().slice(0, 80), email: plain, on: true, added: new Date(this.now()).toISOString() };
    site.people.push(person);
    await this.save(site);
    return { person: shown(person), key: await this.newKey(site.id, id, 'link') };
  }

  /** A new key for a person, kept by its hash. */
  async newKey(site, person, via) {
    const key = newToken();
    await this.store.put(`bottles/keys/${hash(key)}.json`, JSON.stringify({ site, person, at: new Date(this.now()).toISOString(), via }));
    return key;
  }

  /** A person, or null. */
  async person(siteId, personId) {
    const site = await this.get(siteId);
    const person = site?.people.find((p) => p.id === personId);
    return person ? { site, person } : null;
  }

  /** Turns a person on or off: every key they have stops working, or works again. */
  async turn(siteId, personId, on) {
    const site = await this.get(siteId);
    const person = site?.people.find((p) => p.id === personId);
    if (!person) throw new Said(`There is nobody "${personId}" on ${site ? site.name : `"${siteId}"`}'s list.`);
    if (person.owner) throw new Said('The service\'s own key is its setting, not on a list.');
    person.on = Boolean(on);
    await this.save(site);
    return shown(person);
  }

  /** Whose `key` is, if they may leave notes: { site, person }, or null. */
  async who(key) {
    if (typeof key !== 'string' || key.length < 8 || key.length > 200) return null;
    if (this.ownerKey && same(key, this.ownerKey)) {
      const site = await this.get(this.home.id);
      return { site, person: site.people.find((p) => p.owner) };
    }
    const bytes = await this.store.get(`bottles/keys/${hash(key)}.json`);
    if (!bytes) return null;
    const { site: siteId, person: personId } = JSON.parse(bytes);
    const found = await this.person(siteId, personId);
    return found && found.person.on !== false ? found : null;
  }

  /** A one-time code for a sign-in link to `email` on the site at `origin`, or null if they are not on its list. */
  async code(siteId, email) {
    const site = await this.get(siteId);
    const plain = plainEmail(email);
    const person = plain && site?.people.find((p) => !p.owner && p.on !== false && plainEmail(p.email) === plain);
    if (!person) return null;
    const code = newToken();
    await this.store.put(`bottles/codes/${hash(code)}.json`, JSON.stringify({ site: site.id, person: person.id, until: this.now() + CODE_MS, used: false }));
    return { site, person, code };
  }

  /** Swaps a sign-in link's code, once and while it is fresh, for a key of the person's own: { site, person, key }, or null. */
  async redeem(code) {
    if (typeof code !== 'string' || code.length < 8 || code.length > 200) return null;
    const file = `bottles/codes/${hash(code)}.json`;
    const bytes = await this.store.get(file);
    if (!bytes) return null;
    const kept = JSON.parse(bytes);
    if (kept.used || kept.until < this.now()) return null;
    await this.store.put(file, JSON.stringify({ ...kept, used: true }));
    const found = await this.person(kept.site, kept.person);
    if (!found || found.person.on === false) return null;
    return { ...found, key: await this.newKey(kept.site, kept.person, 'sign-in') };
  }
}
