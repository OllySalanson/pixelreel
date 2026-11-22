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

  /** Shows words in the caption box, with the picture and buttons put away; and `done` of `of` squares lit, if there is a count. */
  function say(heading, words, done = 0, of = 0) {
    document.querySelector('.stage').hidden = true;
    for (const el of [$('seek'), document.querySelector('.controls')]) el.hidden = true;
    $('heading').textContent = heading;
    $('cap-title').textContent = words[0];
    $('cap-typed').textContent = words[1] ?? '';
    $('cap-body').removeAttribute('aria-hidden');
    lines.hidden = !of;
    lines.replaceChildren(...Array.from({ length: of }, (_, i) => Object.assign(document.createElement('i'), { className: i < done ? 'on' : '' })));
  }

  /** Puts the reel in the page as the player expects it, and starts the player. */
  function play({ reel, clips, watch }) {
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
    startPixelreel();
    const link = document.createElement('p');
    link.className = 'note open-page';
    const a = Object.assign(document.createElement('a'), { href: watch, textContent: 'Open it in its own page', target: '_blank', rel: 'noopener' });
    a.onclick = (e) => { e.preventDefault(); request('ui/open-link', { url: watch }).catch(() => window.open(watch, '_blank', 'noopener')); };
    link.appendChild(a);
    document.querySelector('main').appendChild(link);
  }

  /** What to show while a reel is not ready yet: [heading, words]. */
  function waiting(state) {
    if (state.state === 'queued') return ['Waiting its turn', 'Peter is recording another reel first. Yours plays here as soon as it is ready.'];
    if (state.lines) return ['Recording the voice', `Peter has read ${state.recorded} of ${state.lines} lines. The reel plays here as soon as he has finished.`];
    return ['Recording the voice', 'The reel plays here as soon as it is ready.'];
  }

  /** Asks the service how the reel is getting on until it is ready, or has failed. */
  async function follow(id) {
    for (let wait = 2000; shown === id; wait = Math.min(wait * 1.2, 4000)) {
      let state;
      try {
        const res = await fetch(`${service}/r/${id}/play.json`, { cache: 'no-store' });
        state = res.ok ? await res.json() : { state: res.status === 404 ? 'gone' : 'trouble' };
      } catch {
        state = { state: 'trouble' };
      }
      if (shown !== id) return;
      if (state.state === 'ready') { play(state); return; }
      if (state.state === 'failed') { say(state.title, ['This reel could not be made', state.error]); return; }
      if (state.state === 'gone') { say('No reel here', ['It has been deleted, or kept past its 30 days.']); return; }
      if (state.state !== 'trouble') say(state.title, waiting(state), state.recorded, state.lines);
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
