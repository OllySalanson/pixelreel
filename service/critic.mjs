// The critic: before anyone watches a reel, its pictures are looked at. First the free checks,
// rules a computer can test in no time (a label too long to sit under its thing, a move whose
// cue Peter never says, a person who moves spot between scenes). Then one look: Claude is shown
// each scene drawn as it will play, twice, with what Peter says, and mends any picture that shows
// the wrong thing, a thing standing for something it is not, or anything hard to read. It works
// while Peter records, and may change pictures only: never a word, so the recording stands.
// Every look costs money, so the service runs it only where it has a credential for the Claude
// API, with the stage switched on (PIXELREEL_PICTURES), and at most so many a day.
import Anthropic from '@anthropic-ai/sdk';
import { reelFromData } from '../src/format.js';
import { pictureProblems } from '../src/pictures.js';
import { ReelError } from '../src/reel.js';
import { SPOTS } from '../src/stage.js';
import { drawScenes } from './frames.mjs';
import { formatGuide } from './mcp.mjs';
import { spokenWords } from './pacing.mjs';
import { replyJson } from './try.mjs';

/** The smallest a label is drawn at, and roughly how wide a letter of it is, in picture pixels. */
const LABEL_SIZE = 10, LETTER = 0.48;
const SPOT_GAP = SPOTS.left - SPOTS['far-left'];

/** The words of `cue` that Peter must say, in order, for its move to be timed to them. */
const plainWords = (text) => spokenWords(text).map((w) => w.word);

/**
 * The free checks: what is wrong with a reel's pictures that a rule can tell, as plain sentences
 * ("scene 3: ..."), for the critic to put right and for the log. Never a reason to turn a reel
 * away: the format's own checks do that. `widthOf(text, size)` measures a label.
 */
export function freeChecks(raw, { widthOf = (text, size) => text.length * size * LETTER } = {}) {
  const found = [], seen = new Map();
  (raw?.scenes ?? []).forEach((scene, i) => {
    const p = scene?.picture, where = `scene ${i + 1}`;
    if (p?.type !== 'stage' || !Array.isArray(p.things) || !Array.isArray(p.moves)) return;
    const said = plainWords(scene.say ?? scene.caption ?? '').join(' ');
    p.moves.forEach((m, n) => {
      if (m.cue === undefined) found.push(`${where}: move ${n + 1} (${m.do}) has no cue, so it comes in on a guess, not as Peter says it`);
      else if (!` ${said} `.includes(` ${plainWords(m.cue).join(' ')} `)) found.push(`${where}: the cue "${m.cue}" of move ${n + 1} (${m.do}) is not words Peter says in this scene, so it comes in on a guess`);
    });
    // a label must fit between its neighbours at the smallest size it is drawn
    const ground = p.things.filter((th) => th.label && !th.up && SPOTS[th.spot] !== undefined);
    for (const th of ground) {
      const near = ground.filter((o) => o !== th).map((o) => Math.abs(SPOTS[o.spot] - SPOTS[th.spot]));
      const room = Math.min(SPOT_GAP * 2 - 6, ...near.map((d) => d - 6));
      if (widthOf(th.label, LABEL_SIZE) > room) found.push(`${where}: the label "${th.label}" is too long to sit under "${th.id}" beside its neighbours; shorten it, or leave a spot between them`);
    }
    // the same person or thing, by its label, keeps its spot from scene to scene
    for (const th of p.things) {
      if (!th.label || th.up) continue;
      const before = seen.get(th.label.toLowerCase());
      if (before && before.spot !== th.spot && before.scene === i - 1) found.push(`${where}: "${th.label}" stood ${before.spot} in scene ${i} and stands ${th.spot} here; keep the same cast in the same spots`);
      seen.set(th.label.toLowerCase(), { spot: th.spot, scene: i });
    }
  });
  return found;
}

/** The guide's part about pictures: the stage, the library, the cards and the icons. */
function pictureRules() {
  const guide = formatGuide([], [], { pictures: 'stage' });
  return guide.slice(guide.indexOf('Pictures: show what is happening'), guide.indexOf('\nTransitions:'));
}

/** What the critic is told. */
const CRITIC = `You are the critic for Pixel Reel: short pixel-art explainers, one idea a scene, read aloud by Peter. You are shown each scene's picture as it will play, drawn twice (part of the way through, and at the end), with what Peter says over it, then the whole reel as JSON. Many who watch find reading hard, so the pictures must explain by themselves.

For each scene, ask: could someone who cannot read the labels tell what is happening, and is it what Peter says? Look for:
- a thing standing for something it is not (a music note for an answer, a house for a computer, a cross on something that is not wrong);
- a picture that shows a sign of the idea where a stage could show it happening;
- things floating, overlapping, cut off or hard to make out, and labels that run into each other;
- a person shown as someone they are not, or the cast moving spots between scenes for no reason.
Mend only what is wrong. Keep what works.

The rules for pictures, and the library, are below. Change pictures only: never a scene's title, caption or say, and never the number or order of the scenes.

Reply with one JSON object and nothing else: {"faults": ["scene 2: ...", ...], "pictures": [one picture for each scene, in order], "wishes": [short names of things a picture needed that the library does not have, such as "gas meter"]}. If nothing is wrong, reply {"faults": [], "pictures": [], "wishes": []}.

${pictureRules()}`;

/**
 * A reel's pictures put right by the critic's `reply`, with every word as it was: { mended } if
 * they will play, or { problems } saying why not.
 */
export function mendedReel(raw, reply, { partly = false } = {}) {
  const pictures = Array.isArray(reply?.pictures) ? reply.pictures : [];
  if (pictures.length !== raw.scenes.length) return { problems: [`"pictures" must have one picture for each of the ${raw.scenes.length} scenes, in order`] };
  // with `partly`, each scene takes its mended picture only if that picture plays, and keeps its own otherwise
  const fits = (picture) => picture && typeof picture === 'object' && (!partly || !pictureProblems(picture).length);
  const mended = { ...raw, scenes: raw.scenes.map((scene, i) => (fits(pictures[i]) ? { ...scene, picture: pictures[i] } : scene)) };
  if (partly && mended.scenes.every((scene, i) => scene === raw.scenes[i])) return { problems: ['no mended picture would play'] };
  try {
    reelFromData(mended);
  } catch (err) {
    if (err instanceof ReelError) return { problems: err.problems };
    throw err;
  }
  return { mended };
}

/**
 * A critic: look(raw) draws reel `raw` (reel.json, parsed), runs the free checks, shows Claude
 * the frames, and resolves to { raw, faults, wishes }: the reel with its pictures mended, or as it was
 * when nothing needed mending or the reply would not do. It never throws: whatever goes wrong,
 * the reel goes on as it was. `perDay` bounds how many looks a day there are; `log` is told what
 * each cost.
 */
export function createCritic({ client = new Anthropic({ timeout: 120_000, maxRetries: 1 }), model = 'claude-sonnet-5-5', effort = 'low', perDay = 100, now = () => Date.now(), log = () => {} } = {}) {
  const used = { day: '', count: 0 };
  return async function look(raw, { id = '' } = {}) {
    const day = new Date(now()).toISOString().slice(0, 10);
    if (used.day !== day) Object.assign(used, { day, count: 0 });
    const checks = freeChecks(raw);
    if (used.count >= perDay) { log(`critic: ${id} not looked at: ${perDay} looks today already`); return { raw, faults: checks }; }
    used.count++;
    try {
      const scenes = await drawScenes(raw, { parts: [0.5, 0.95], scale: 2 });
      const content = [];
      scenes.forEach((scene, i) => {
        content.push({ type: 'text', text: `Scene ${i + 1}, "${raw.scenes[i].title}". Peter says: "${raw.scenes[i].say ?? raw.scenes[i].caption}"` });
        for (const frame of scene.frames) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: frame.toBuffer('image/png').toString('base64') } });
      });
      content.push({ type: 'text', text: `${checks.length ? `The free checks found:\n- ${checks.join('\n- ')}\n\n` : ''}The reel, as JSON:\n${JSON.stringify(raw)}` });
      const messages = [{ role: 'user', content }], took = { in: 0, out: 0 };
      let faults = [], mended = null, problems = [], wishes = [];
      for (let round = 1; round <= 2; round++) {
        const response = await client.messages.create({ model, max_tokens: 12000, output_config: { effort }, system: CRITIC, messages });
        took.in += response.usage.input_tokens; took.out += response.usage.output_tokens; took.model = response.model;
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        const reply = replyJson(text);
        if (round === 1) faults = Array.isArray(reply.faults) ? reply.faults.filter((f) => typeof f === 'string') : [];
        if (Array.isArray(reply.wishes)) wishes = reply.wishes.filter((w) => typeof w === 'string').slice(0, 5);
        if (!faults.length) break;
        ({ mended = null, problems = [] } = mendedReel(raw, reply));
        // the second time, every picture that plays is kept, and a scene whose picture still would not keeps its own
        if (!mended && round === 2) ({ mended = null } = mendedReel(raw, reply, { partly: true }));
        if (mended || round === 2) break;
        // one chance to put its pictures right, as the writer has
        messages.push({ role: 'assistant', content: text }, { role: 'user', content: `Those pictures have problems. Fix every one, changing pictures only, and reply with the whole JSON again:\n- ${problems.join('\n- ')}` });
      }
      const kept = mended && problems.length ? `, all but ${problems.length === 1 ? 'one picture' : 'some pictures'} that would not do (${problems.slice(0, 3).join('; ')})` : '';
      log(`critic: ${id} ${took.in} tokens in, ${took.out} out (${took.model}); ${faults.length} faults${faults.length && !mended ? `, but its pictures would not do (${problems.slice(0, 3).join('; ')}), so the reel stays as it was` : kept}`);
      return { raw: mended ?? raw, faults, wishes };
    } catch (err) {
      log(`critic: ${id} could not look: ${err.message}`);
      return { raw, faults: checks };
    }
  };
}
