// Stands in for scripts/pocket_speak.py --serve in test/voice.test.js: the same lines in and
// out, with no voice model. FAKE_VOICE says how it misbehaves: "broken" stops before it is
// ready, "dies" stops after one line, "stuck" goes quiet after one line, "refuses" answers
// every job with an error. Each start adds its arguments as a line to the file FAKE_VOICE_LOG names.
import { appendFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const how = process.env.FAKE_VOICE ?? '';
if (process.env.FAKE_VOICE_LOG) appendFileSync(process.env.FAKE_VOICE_LOG, `${process.argv.slice(2).join(' ')}\n`);
if (how === 'broken') process.exit(3);
const say = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
say({ ready: true });
createInterface({ input: process.stdin }).on('line', (text) => {
  const job = JSON.parse(text);
  if (how === 'refuses') { say({ id: job.id, error: `no voice called ${job.voice}` }); return; }
  for (const [i, line] of job.lines.entries()) {
    if (i === 1 && how === 'dies') process.exit(1);
    if (i === 1 && how === 'stuck') return;
    writeFileSync(line.wav, `${job.voice} says: ${line.text}`);
    say({ id: job.id, wav: line.wav, seconds: line.text.length / 10 });
  }
  say({ id: job.id, done: true });
});
