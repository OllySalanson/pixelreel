// The player inside a Claude chat (an MCP App). The host shows this page in a frame and sends
// it make_reel's result; it waits for the voice to be recorded, then plays the reel right
// there. It talks to the host in JSON-RPC over postMessage, as the MCP Apps spec sets out,
// and to the service only to ask whether the reel is ready. startPixelreel() runs the
// ordinary player once the reel is in the page.
/* global startPixelreel */
(() => {
  const PROTOCOL = '2026-01-26';
  const service = document.body.dataset.service;
  const $ = (id) => document.getElementById(id);
  const pending = new Map();
  let nextId = 1, shown = null;

  const send = (message) => window.parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
  const request = (method, params) => new Promise((ok, fail) => {
    const id = nextId++;
    pending.set(id, { ok, fail });
    send({ id, method, params });
  });
  const notify = (method, params) => send({ method, params });

  // a square for each line of the reel, lit as Peter reads it: how far along it is, at a glance
  const lines = Object.assign(document.createElement('span'), { className: 'lines', hidden: true });
  lines.setAttribute('aria-hidden', 'true');
  $('cap').appendChild(lines);

  let announced = '';

  // What this page says itself, in the reel's language once that is known (window.pixelreelAppWords,
  // put in by the service from src/words.js); English until then, and for a language it has no words for.
  const WORDS = window.pixelreelAppWords ?? {};
  let language = 'english';
  const t = (key, values = {}) => String((WORDS[language] ?? WORDS.english ?? {})[key] ?? key).replace(/\{(\w+)\}/g, (all, name) => (name in values ? values[name] : all));
  const speaks = (spoken) => {
    if (typeof spoken !== 'string' || !WORDS[spoken]) return;
    language = spoken;
    document.documentElement.lang = (window.pixelreelLangCodes ?? {})[spoken] ?? 'en';   // so a screen reader reads the words as that language
  };

  /** Shows words in the caption box, with the picture and buttons put away; and `done` of `of` squares lit, if there is a count. */
  function say(heading, words, done = 0, of = 0) {
    document.querySelector('.stage').hidden = true;
    for (const el of [$('seek'), document.querySelector('.controls')]) el.hidden = true;
    $('heading').textContent = heading;
    $('cap-title').textContent = words[0];
    $('cap-typed').textContent = words[1] ?? '';
    $('cap-body').removeAttribute('aria-hidden');
    // said aloud to someone using a screen reader, once for each thing that happens: not again for every line read
    if (heading + words[0] !== announced) {
      announced = heading + words[0];
      $('cap-live').textContent = `${words[0]}. ${words[1] ?? ''}`.trim();
    }
    lines.hidden = !of;
    lines.replaceChildren(...Array.from({ length: of }, (_, i) => Object.assign(document.createElement('i'), { className: i < done ? 'on' : '' })));
  }

  /**
   * Hands the player the recordings there are so far. `more` is true while Peter is still
   * recording the rest: the player then waits for a line it has not got yet, rather than
   * read it in the browser's own voice. `guesses` say about how long each line still to
   * come will last, so the reel's length on screen is nearly right from the start.
   */
  function hand(clips, more, guesses = []) {
    window.pixelreelClips = { clips, more, guesses };
    document.dispatchEvent(new CustomEvent('pixelreel:clips'));
  }

  /** Puts the reel in the page as the player expects it, and starts the player. */
  function play({ reel, clips, watch, guesses }, more = false) {
    document.body.dataset.language = language;   // the player's own buttons and words are in the reel's language too
    lines.hidden = true;
    document.querySelector('.stage').hidden = false;
    for (const el of [$('seek'), document.querySelector('.controls')]) el.hidden = false;
    $('cap-body').setAttribute('aria-hidden', 'true');
    for (const [id, value] of [['reel-data', reel], ['reel-audio', { clips }]]) {
      const data = document.createElement('script');
      data.type = 'application/json';
      data.id = id;
      data.textContent = JSON.stringify(value);
      document.body.appendChild(data);
    }
    hand(clips, more, guesses);   // left for the player to find when it starts
    startPixelreel();
    const link = document.createElement('p');
    link.className = 'note open-page';
    const a = Object.assign(document.createElement('a'), { href: watch, textContent: t('open'), target: '_blank', rel: 'noopener' });
    a.onclick = (e) => { e.preventDefault(); request('ui/open-link', { url: watch }).catch(() => window.open(watch, '_blank', 'noopener')); };
    link.appendChild(a);
    document.querySelector('main').appendChild(link);
  }

  /** What to show while a reel is not ready yet: [heading, words]. */
  function waiting(state) {
    if (state.state === 'queued') return [t('turn'), t('turnWords')];
    if (state.lines) return [t('recording'), t('read', { who: state.narrator ?? 'Peter', done: state.recorded, of: state.lines })];
    return [t('recording'), t('soon')];
  }

  /**
   * Asks the service how the reel is getting on until it is ready, or has failed. The reel
   * starts as soon as the service says a player would stay behind the recorder (`playable`),
   * which is long before the last line is recorded; the lines recorded after that are handed
   * to the player as they come.
   */
  async function follow(id) {
    let started = false;
    for (let wait = 2000; shown === id; wait = started ? 1500 : Math.min(wait * 1.2, 4000)) {
      let state;
      try {
        const res = await fetch(`${service}/r/${id}/play.json`, { cache: 'no-store' });
        state = res.ok ? await res.json() : { state: res.status === 404 ? 'gone' : 'trouble' };
      } catch {
        state = { state: 'trouble' };
      }
      if (shown !== id) return;
      if (state.state === 'ready') {
        if (started) hand(state.clips, false); else play(state);
        return;
      }
      speaks(state.language);
      if (state.state === 'failed') { say(state.title, [t('failed'), state.error]); return; }
      if (state.state === 'gone') { say(t('gone'), [t('goneWords')]); return; }
      if (started) {
        if (state.clips) hand(state.clips, true, state.guesses);
      } else if (state.playable && state.reel && state.clips) {
        started = true;
        play(state, true);
      } else if (state.state !== 'trouble') {
        say(state.title, waiting(state), state.recorded, state.lines);
      }
      await new Promise((ok) => setTimeout(ok, wait));
    }
  }

  function toolResult(result) {
    const id = result?.structuredContent?.id;
    if (result?.isError || !id) {
      say('Pixel Reel', ['No reel to show', 'Claude will say what needs fixing.']);
      return;
    }
    if (shown === id) return;
    shown = id;
    speaks(result.structuredContent.language);
    say(result.structuredContent.title ?? 'Pixel Reel', waiting({ state: 'recording' }));
    follow(id);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const m = event.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && !m.method && pending.has(m.id)) {
      const { ok, fail } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) fail(m.error); else ok(m.result);
    } else if (m.method === 'ui/notifications/tool-result') {
      toolResult(m.params);
    } else if (m.method && m.id !== undefined) {
      // ping, and the host saying it is about to close this frame, both want only an answer
      if (m.method === 'ping' || m.method === 'ui/resource-teardown') send({ id: m.id, result: {} });
      else send({ id: m.id, error: { code: -32601, message: `${m.method} is not supported` } });
    }
  });

  say('Pixel Reel', ['Getting ready', '']);
  // the content's own height: the page's scroll height is never less than the frame, so a frame could only grow
  new ResizeObserver(() => notify('ui/notifications/size-changed', { height: Math.ceil(document.body.getBoundingClientRect().height) }))
    .observe(document.body);
  request('ui/initialize', { appInfo: { name: 'pixelreel', version: '1' }, appCapabilities: {}, protocolVersion: PROTOCOL })
    .then(() => notify('ui/notifications/initialized', {}))
    .catch(() => {});
})();
