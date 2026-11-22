# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Commands: `npm test` (node --test), `npm run lint` (ESLint), `npm start` (local server on :8000), `npm run check [reel] [-- --recorded]` (validates reels without a browser; CI runs it with `--recorded`). No build step; the browser loads `src/*.js` as ES modules directly.
- A reel is `reels/<name>/reel.js` (code allowed) or `reel.json` (data only, `src/format.js`, checked strictly and never run); `scripts/reel-file.mjs` finds either for the tools.
- `skill/pixel-reel.zip` (the Claude skill) and its unzipped copy in `plugins/pixel-reel/skills/` (the Claude Code plugin) are generated from `skill/pixel-reel/`, `index.html`, `src/` and the font by `npm run skill`, and committed; `test/onepage.test.js` fails until it is remade after any player change. `scripts/bundle.mjs` joins `src/` modules for one-file pages and only takes one-line `import { a } from './x.js';` and exported functions, classes, consts and lets.
- `npm run video` draws frames in Node with `@napi-rs/canvas` (a dev dependency) and the real kit on the player's clock (`scripts/video.mjs`), so the MP4 matches the player; it needs ffmpeg, and `test/video.test.js` skips without either.
- `service/` is the hosted connector (`npm run service`, docs/service.md): stateless MCP over Streamable HTTP plus `/r/<id>` pages; jobs reuse `scripts/voices.mjs` and `scripts/video.mjs` on a checked-out folder, so `test/service.test.js` injects a fake recorder and video maker. It runs on Cloud Run with reels in a bucket (`S3Store`, `PIXELREEL_S3_*`); docs/deploy.md has the project, settings and redeploy command. The image's ffmpeg is Debian's 5.1, older than most dev machines', so video changes can pass locally and fail there.
- Timing and state live in `src/player.js` and `src/narrator.js`, drawing in `src/kit.js`, `src/pictures.js` and `src/transitions.js`, all DOM-free so `test/` drives them with mocked timers and the recording context in `test/fake-canvas.js`. Only `src/main.js` (the player page) and `src/export.js` (the banner maker) touch the page.
- node's `mock.timers` counts a timer set inside a callback from the end of the current `tick()`, so tests tick to one timer boundary at a time.
- Clips are matched to scenes by their exact `say` text through `audio/manifest.json`, not by position. Editing a scene's words makes it fall back to the browser voice until `npm run voices <reel>` is rerun, and CI (`npm run check -- --recorded`, `test/reel.test.js`) fails until it is. Clip files named as 16-hex-digit hashes are made by the tool; any other name is a hand-made recording that `voices` never replaces or deletes.
- New reels record with Pocket TTS (`peter_yearsley`); the committed showreel and example reel are Kokoro `bm_george`, which `npm run voices` keeps because a reel keeps the narrator its manifest names, so re-recording them needs `scripts/setup-voices.sh kokoro` (see docs/voices.md). Keep committed audio small (mono 48k) and record in one batch.
- The showreel (`reels/showreel/reel.js`) is the site's default reel and the README's source: its gags are timed to `CUES` taken from the recorded clips, and `docs/readme/README.md` lists the banner maker settings that remake the README's animated pictures. Changing a scene's words means re-recording, re-timing its cues, and remaking any picture that shows it.
- To check pictures by eye, `?reel=<name>&scene=N&t=S` holds one frame; for many frames, draw them with `createKit` on a canvas of your own rather than timing screenshots of the live player.
- House style for all text: plain dash, never an em dash (`test/hygiene.test.js` enforces it).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
