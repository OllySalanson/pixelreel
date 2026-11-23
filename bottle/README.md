# Message in a Bottle

A small button for leaving notes on a website's pages, seen only by people given its secret
link. Press it, click the part of the page the note is about (or choose the whole page),
write or dictate the note, send. Each note goes to the site's own service with:

- a screenshot of what was on the screen, with the chosen part outlined in red,
- the page's address and title,
- a CSS selector for that part, its tag and its words,
- the window's size, scale and how far it was scrolled, and the browser,
- the `data-` settings on the page's `<html>` (on Pixel Reel, the Make it comfy choices).

Whoever holds the second key, the reader key, lists the notes, downloads them with their
screenshots, and marks each one read, asked, fixed or dropped (`bottles.mjs`).

Nobody else sees any of it. Every page loads `bottle.js`, but without the key it does nothing:
no button, no request. The screenshot is made in the browser by
[modern-screenshot](https://github.com/qq15725/modern-screenshot) (MIT), served from the site
itself, so no other service is involved.

It is a package of its own (`package.json` here), used by Pixel Reel first and made to move
into Crow's Nest as its feedback stage: everything is in this folder, nothing in it reaches
outside it, and the endpoint is plain Node (20.6 or later) with no packages but
modern-screenshot. `npm install && npm test` here runs its own tests.

## The secret link

Add `?bottle=<key>` to any page's address, for example `https://pixelreel.pro/?bottle=<key>`.
The page takes the key out of its address at once (so it is not in a link copied from there,
or in a screenshot), checks it with the service and keeps it in that browser, so the button is
there on every page from then on. `?bottle=off` forgets it. If the key is changed on the
service, browsers holding the old one forget it the next time they open a page.

The key is never in the repository: it is a setting of the service.

## The parts

| File | What it is |
| --- | --- |
| `bottle.js` | Loaded by every page: `<script src="/bottle/bottle.js" defer></script>`. A plain script of a few lines that does nothing without the key. |
| `bottle-ui.mjs` | The button and what it opens, loaded only once a key is in hand. Drawn in a shadow root and styled with `adoptedStyleSheets`, so the page's styles cannot reach it and a strict content security policy (no inline styles or scripts) does not stop it. |
| `server.mjs` | The endpoint: `createBottle({ store, key, reader, origins })` gives `handle(req, res)`, which answers everything under `/bottle` and returns false for anything else. |
| `bottles.mjs` | The reader, for whoever looks after the site (or an agent doing it for them). |
| `test/` | The endpoint's and the reader's tests, with a store kept in memory. |

### The endpoint

`createBottle` takes:

- `store`: where notes are kept, with `put(key, bytes)`, `get(key)` (null when missing) and
  `folders(prefix)`. Pixel Reel's `DiskStore` and `S3Store` (`service/store.mjs`) both do.
  Each note is `bottles/<id>/note.json`, with `bottles/<id>/shot.jpg` beside it.
- `key`: the link's secret. Without it the button never shows and no note is taken.
- `reader`: the reader's secret. Without it nobody can read the notes.
- `origins`: the sites whose pages may send notes, such as `['https://pixelreel.pro']`.
- `caller(req)`: who is asking, for the limits (behind a proxy, the address it passed on).
- `perHour` (30), `perDay` (200): notes each caller may leave in an hour, and everyone in a
  day; `wrongPerHour` (10): wrong keys a caller may try in an hour before being turned away.

| Request | Key | Answer |
| --- | --- | --- |
| `GET /bottle/bottle.js`, `bottle-ui.mjs`, `shot.mjs` | none | The scripts. |
| `POST /bottle/check` | `x-bottle-key` | 200 if the key is right. |
| `POST /bottle/notes` | `x-bottle-key` | 201 `{ id }`. The body is JSON, up to 6 MB with the screenshot (a JPEG data URL in `shot`). |
| `GET /bottle/notes?state=new` | `authorization: Bearer <reader>` | `{ notes: [...] }`, oldest first. `state` is `new` (the default), `read`, `asked`, `fixed`, `dropped` or `all`. |
| `GET /bottle/notes/<id>` | reader | One note. |
| `GET /bottle/notes/<id>/shot.jpg` | reader | Its screenshot. |
| `PATCH /bottle/notes/<id>` | reader | `{ "state": "fixed", "answer": "what was done" }`: the state changes and the answer is added to the note's `history`. |

There is no way to list notes without the reader key, and the link's key is not it.

## Reading the notes

```sh
npm run bottles -- list                      # the new notes, one a line
npm run bottles -- fetch                     # each into .bottles/<id>/: note.json and shot.jpg
npm run bottles -- show <id>                 # one note in full
npm run bottles -- mark <id> fixed --answer "The heading is smaller on a phone now."
npm run bottles -- list --state all --json   # everything, for a script
```

`npm run bottles` reads Pixel Reel's notes: it names the site and has gcloud read the reader
key from Secret Manager (the secret `pixelreel-bottle-reader`), so it needs a gcloud signed in
to the project. Elsewhere, run `node bottle/bottles.mjs` with `--site <address>` (or
`BOTTLE_SITE`) and the reader key in `BOTTLE_READER`, or `--gcloud-secret <name> --project
<project>`.

A note's states: `new` when left; `read` once looked at; `asked` when its writer has been
asked what they meant; `fixed`; `dropped` when nothing will be done.

## Putting it on a site

1. Serve the endpoint: `import { createBottle } from 'message-in-a-bottle'` (or this folder's
   `server.mjs`) and call `handle(req, res)` early in the server's request handler.
2. Add `<script src="/bottle/bottle.js" defer></script>` to every page.
3. Set the two keys as the service's secret settings, each a long random string
   (`openssl rand -hex 24`).
4. Open a page with `?bottle=<key>` and leave a note to see it work.

The page's content security policy must allow its own scripts and `fetch` to itself
(`script-src 'self'; connect-src 'self'`), and `data:` pictures (`img-src 'self' data:`),
which is how the screenshot is drawn.

## How it was checked

`test/bottle.test.js` here covers the endpoint and the reader; Pixel Reel's own
`test/bottle.test.js` covers how it is mounted there. The button was checked in a
headless Chromium on Pixel Reel's own pages, under its content security policy, on a
1280 x 657 window and as a 390 x 844 phone: choosing a part, writing, sending, and the
screenshot matching what was on the screen (scrolled, with the sticky bar at the top).

What a screenshot may not show: pictures from another site that does not allow it come out
blank. A note with no screenshot (it can fail on an unusual
page) is still sent, with everything else.
