#!/usr/bin/env node
// Shows the player as it appears inside a Claude chat, without Claude:
//   node scripts/chat-stand-in.mjs [service address] [reel.json] [page to write]
// It asks a running service (default http://localhost:8787) for the in-chat player, makes a
// reel there (default: the guide's own example), and writes a page (default
// chat-stand-in.html) that frames the player and speaks the chat's side of the MCP Apps
// protocol: it answers ui/initialize, hands over make_reel's result, and sizes the frame as
// the player asks. Open the page in a browser to watch the reel being recorded and played.
// No test can see this page, so look at it after any change to src/main.js or service/app-bridge.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { EXAMPLE_REEL } from '../service/mcp.mjs';

const [base = 'http://localhost:8787', reelPath, out = 'chat-stand-in.html'] = process.argv.slice(2);
const service = base.replace(/\/$/, '');

async function rpc(method, params) {
  const res = await fetch(`${service}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const answer = await res.json();
  if (answer.error) throw new Error(answer.error.message);
  return answer.result;
}

const inPage = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const player = (await rpc('resources/read', { uri: 'ui://pixelreel/player.html' })).contents[0].text;
const reel = reelPath ? JSON.parse(readFileSync(reelPath, 'utf8')) : EXAMPLE_REEL;
const result = await rpc('tools/call', { name: 'make_reel', arguments: reel });
if (result.isError) throw new Error(result.content[0].text);

writeFileSync(out, `<!doctype html>
<meta charset="utf-8">
<title>A stand-in for a chat</title>
<body style="margin:0;background:#f4f1ea;font:16px sans-serif;color:#333">
<div style="max-width:720px;margin:24px auto;padding:0 16px">
<p>Make me a pixel reel: ${reel.title.replace(/[<&]/g, '')}</p>
<iframe id="app" style="width:100%;height:120px;border:0;border-radius:12px;background:#0b1220"></iframe>
<p>Your reel is made. It plays here once Peter has started reading.</p>
</div>
<script>
const frame = document.getElementById('app');
const result = ${inPage(result)};
window.addEventListener('message', (event) => {
  const m = event.data;
  if (!m || m.jsonrpc !== '2.0') return;
  const send = (message) => frame.contentWindow.postMessage({ jsonrpc: '2.0', ...message }, '*');
  if (m.method === 'ui/initialize') send({ id: m.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'stand-in', version: '1' }, hostCapabilities: {}, hostContext: {} } });
  else if (m.method === 'ui/notifications/initialized') send({ method: 'ui/notifications/tool-result', params: result });
  else if (m.method === 'ui/notifications/size-changed') frame.style.height = m.params.height + 'px';
  else if (m.method === 'ui/open-link') { window.open(m.params.url, '_blank', 'noopener'); send({ id: m.id, result: {} }); }
});
frame.srcdoc = ${inPage(player)};
</script>
`);
console.log(`Made "${reel.title}" (${result.structuredContent.id}) at ${service}. Open ${out} in a browser to watch it in a stand-in chat.`);
