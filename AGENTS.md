# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Commands: `npm test` (node --test), `npm run lint` (ESLint), `npm start` (local server on :8000), `npm run check [reel] [-- --recorded]` (validates reels without a browser; CI runs it with `--recorded`). No build step; the browser loads `src/*.js` as ES modules directly.
- Timing and state live in `src/player.js` and `src/narrator.js`, drawing in `src/kit.js`, `src/pictures.js` and `src/transitions.js`, all DOM-free so `test/` drives them with mocked timers and the recording context in `test/fake-canvas.js`. Only `src/main.js` (the player page) and `src/export.js` (the banner maker) touch the page.
- node's `mock.timers` counts a timer set inside a callback from the end of the current `tick()`, so tests tick to one timer boundary at a time.
- Clips are matched to scenes by their exact `say` text through `audio/manifest.json`, not by position. Editing a scene's words makes it fall back to the browser voice until `npm run voices <reel>` is rerun, and CI (`npm run check -- --recorded`, `test/reel.test.js`) fails until it is. Clip files named as 16-hex-digit hashes are made by the tool; any other name is a hand-made recording that `voices` never replaces or deletes.
- Re-recording needs Kokoro (see docs/voices.md); keep committed audio small (mono 48k) and record in one batch.
- To check pictures by eye, `?reel=<name>&scene=N&t=S` holds one frame; for many frames, draw them with `createKit` on a canvas of your own rather than timing screenshots of the live player.
- House style for all text: plain dash, never an em dash (`test/hygiene.test.js` enforces it).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
