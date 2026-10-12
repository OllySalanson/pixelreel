# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Commands: `npm test` (node --test), `npm run lint` (ESLint), `npm start` (local server on :8000). No build step; the browser loads `src/*.js` as ES modules directly.
- Timing and state live in `src/player.js` and `src/narrator.js`, kept DOM-free so `test/` can drive them with mocked timers; `src/main.js` is the only file that touches the page.
- Clips are matched to scenes by their exact `say` text through `audio/manifest.json`, not by position. Editing a scene's words makes it fall back to the browser voice until `npm run voices <reel>` is rerun, and `test/reel.test.js` fails for the example reel until it is.
- Re-recording the example reel needs Kokoro (see README "Record the voices"); keep its audio small (mono 48k) since it is committed.
- House style for all text: plain dash, never an em dash (`test/hygiene.test.js` enforces it).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
