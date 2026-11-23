// Message in a Bottle, the page of queues (/bottle/admin): every site the button is on, with
// how many notes are in each state, held first, as they wait on a decision; and each site's
// notes with their screenshots and what came of them. Only for whoever holds the admin key, or
// the service's own key (kept in this browser by its link): the page itself holds nothing, and
// asks the endpoint for everything with one of them.

const STATES = ['held', 'new', 'in-progress', 'declined', 'done', 'closed'];
const NAMES = { held: 'Held', new: 'New', 'in-progress': 'In progress', declined: 'Declined', done: 'Done', closed: 'Closed', all: 'All' };
const ADMIN = 'bottle-admin', KEY = 'bottle-key';
const base = new URL('./', import.meta.url);

const make = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  el.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return el;
};

const stored = (where, name) => { try { return where.getItem(name); } catch { return null; } };

/** How this page asks: with the admin key given here, or else the key this browser keeps for the button. */
let asking = null;
const headers = () => (asking?.admin ? { authorization: `Bearer ${asking.admin}` } : asking?.key ? { 'x-bottle-key': asking.key } : {});
const ask = async (path) => {
  const res = await fetch(new URL(path, base), { headers: headers(), credentials: 'omit' });
  if (res.status === 403 || res.status === 404 || res.status === 429) throw Object.assign(new Error('refused'), { refused: true });
  if (!res.ok) throw new Error(String(res.status));
  return res;
};

const main = make('main');
document.body.append(main);

const ago = (at) => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000));
  return minutes < 60 ? `${minutes}m` : minutes < 2880 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`;
};
const pathOf = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url; } };
const hostOf = (origin) => { try { return new URL(origin).host; } catch { return origin; } };

function keyForm(wrong) {
  const field = make('input', { type: 'password', name: 'key', autocomplete: 'current-password', 'aria-label': 'Key' });
  const form = make('form', { class: 'key' }, make('h1', {}, 'Queues'), make('label', {}, 'Key', field), wrong ? make('p', { class: 'error', role: 'alert' }, 'Not right') : null, make('button', { type: 'submit', class: 'go' }, 'Open'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    asking = { admin: field.value.trim() };
    try { sessionStorage.setItem(ADMIN, asking.admin); } catch { /* for this page only */ }
    show();
  });
  main.replaceChildren(form);
  field.focus();
}

function count(state, n) {
  return make('span', { class: `count ${state}${n ? '' : ' none'}` }, make('b', {}, String(n)), ` ${NAMES[state]}`);
}

async function sitesView() {
  const { sites } = await (await ask('sites')).json();
  const open = (s) => s.counts.new + s.counts['in-progress'];
  sites.sort((a, b) => b.counts.held - a.counts.held || open(b) - open(a) || a.name.localeCompare(b.name));
  const total = sites.reduce((n, s) => n + s.counts.held, 0);
  main.replaceChildren(
    make('header', {}, make('h1', {}, 'Queues'), total ? make('span', { class: 'count held' }, make('b', {}, String(total)), ' Held') : null),
    make('ul', { class: 'sites' }, ...sites.map((site) => make('li', {}, make('a', { href: `#site=${encodeURIComponent(site.id)}`, class: 'site' },
      make('span', { class: 'name' }, site.name), make('span', { class: 'host' }, site.origins.map(hostOf).join(' ')),
      make('span', { class: 'counts' }, ...STATES.map((s) => count(s, site.counts[s])))))))
  );
}

const shots = new Map();
async function shotOf(id) {
  if (!shots.has(id)) shots.set(id, ask(`notes/${id}/shot.jpg`).then((r) => r.blob()).then((b) => URL.createObjectURL(b)).catch(() => null));
  return shots.get(id);
}

function noteCard(note) {
  const o = note.outcome ?? {};
  const lines = [];
  if (o.what) lines.push(['Done', `${o.what}${Number.isFinite(o.confidence) ? ` (${o.confidence}%)` : ''}`]);
  if (o.conflict) lines.push(['Conflict', o.conflict]);
  if (o.proposal) lines.push(['Proposal', o.proposal]);
  if (o.reason) lines.push(['Reason', o.reason]);
  const picture = make('div', { class: 'shot' });
  if (note.shot) {
    shotOf(note.id).then((url) => {
      if (url) picture.append(make('a', { href: url, target: '_blank', rel: 'noopener' }, make('img', { src: url, alt: '', loading: 'lazy' })));
    });
  } else picture.classList.add('none');
  return make('li', { class: 'note' },
    picture,
    make('div', { class: 'body' },
      make('p', { class: 'top' }, make('span', { class: `chip ${note.state}` }, NAMES[note.state] ?? note.state), make('span', { class: 'meta' }, [note.by, ago(note.at), pathOf(note.page?.url ?? '')].filter(Boolean).join(' · '))),
      make('p', { class: 'words' }, note.note),
      note.target?.whole ? null : note.target?.text ? make('p', { class: 'part' }, `<${note.target.tag}> ${note.target.text.slice(0, 120)}`) : null,
      lines.length ? make('dl', {}, ...lines.flatMap(([k, v]) => [make('dt', {}, k), make('dd', {}, v)])) : null));
}

async function siteView(id, state) {
  const [{ sites }, { notes }] = await Promise.all([(await ask('sites')).json(), (await ask(`notes?state=all&site=${encodeURIComponent(id)}`)).json()]);
  const site = sites.find((s) => s.id === id);
  if (!site) { location.hash = ''; return; }
  const chosen = state ?? (site.counts.held ? 'held' : 'all');
  const shown = notes.filter((n) => chosen === 'all' || n.state === chosen).reverse();
  const tab = (s, n) => make('a', { href: `#site=${encodeURIComponent(id)}&state=${s}`, class: `tab${s === chosen ? ' on' : ''}`, 'aria-current': s === chosen ? 'true' : 'false' }, NAMES[s], n === null ? null : make('b', {}, String(n)));
  main.replaceChildren(
    make('header', {}, make('a', { href: '#', class: 'back', 'aria-label': 'All queues' }, '‹'), make('h1', {}, site.name)),
    make('nav', { class: 'tabs' }, ...STATES.map((s) => tab(s, site.counts[s])), tab('all', null)),
    shown.length ? make('ul', { class: 'notes' }, ...shown.map(noteCard)) : make('p', { class: 'empty' }, 'None')
  );
}

async function show() {
  const route = new URLSearchParams(location.hash.slice(1));
  try {
    if (route.get('site')) await siteView(route.get('site'), route.get('state'));
    else await sitesView();
  } catch (err) {
    if (err.refused) {
      // the key kept for the button is not the service's own: fall back to asking for the admin key
      const wrong = Boolean(asking?.admin);
      try { sessionStorage.removeItem(ADMIN); } catch { /* nothing kept */ }
      asking = null;
      keyForm(wrong);
    } else main.replaceChildren(make('p', { class: 'error', role: 'alert' }, 'Could not be reached'));
  }
}

const admin = stored(sessionStorage, ADMIN), key = stored(localStorage, KEY);
asking = admin ? { admin } : key ? { key } : null;
addEventListener('hashchange', show);
if (asking) show();
else keyForm(false);
