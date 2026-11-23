# Message in a Bottle

A small button for leaving notes on a website's pages, seen only by the people on that site's
list. One service runs it for every site it is on (Pixel Reel, Civ Speak, each client's site).
Someone on a site's list presses Note, clicks the part of the page the note is about (or chooses
the whole page), types or says the note, and sends it. Each note arrives with:

- a screenshot of what was on the screen, with the chosen part outlined in red,
- the page's address and title,
- a CSS selector for that part, its tag and its words,
- the window's size, scale and how far it was scrolled, and the browser,
- the `data-` settings on the page's `<html>` (on Pixel Reel, the Make it comfy choices),
- who left it, and whether it was said aloud.

Whoever looks after the sites works through each site's queue, marks every note with what came
of it, and the person who left it sees that under My notes, and gets an email when it is done.

Nobody else sees any of it. Every page loads `bottle.js`, but without a key it does nothing: no
button, no request. Search engines are kept out of everything it answers. The screenshot is made
in the browser by [modern-screenshot](https://github.com/qq15725/modern-screenshot) (MIT),
served by the service itself, so no other company is involved.

It is a package of its own (`package.json` here), used by Pixel Reel first and made to move into
Crow's Nest as its feedback stage: everything is in this folder, nothing in it reaches outside
it, and the endpoint is plain Node (20.6 or later) with no packages but modern-screenshot.
`npm install && npm test` here runs its own tests.

## How a client gets the button

1. Whoever looks after the sites puts them on the site's list (`bottles person add`) and sends
   them the "Review your website" email (`bottles invite`). It holds their own link, such as
   `https://theirsite.com/?bottle=<key>`.
2. Opening it switches the button on in that browser. The page takes the key out of its address
   at once (so it is not in a link copied from there, or in a screenshot), the service checks it,
   and only then does the button show. The browser keeps the key, so the button is there on every
   page of that site from then on.
3. On another phone or computer, or once the link is lost, they go to the site's short address,
   `theirsite.com/review`, and give their email. If it is on the site's list, the service emails
   them a link that switches the button on in that browser (it works once, for 30 minutes).
   Anyone else is told the same, "We'll be in touch by email", and sent nothing, so the page says
   nothing about who is on the list.
4. My notes, beside the Note button, lists their notes and what came of each: being done, done
   (with what was done, and Looks right to close it), or not done (with the reason). Turn off
   there forgets the key, and `/review` says the button is on and turns it off too.

A wrong key, or one belonging to someone turned off, shows nothing, and the browser forgets it.
`?bottle=off` on any page forgets the key as well.

## Putting it on a site

1. Add the site: `bottles site add civ-speak --name "Civ Speak" --origin https://civspeak.com`
   (more than one `--origin` if it is at more than one address).
2. Put the one line on every page, the service's address in it:

   ```html
   <script src="https://pixelreel.pro/bottle/bottle.js" defer></script>
   ```

3. Give the site a page at `/review` for signing in: the line with `data-review` in it, and
   nothing for a search engine:

   ```html
   <!doctype html>
   <html lang="en">
   <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
   <meta name="robots" content="noindex, nofollow"><title>Review</title></head>
   <body><script src="https://pixelreel.pro/bottle/bottle.js" data-review defer></script></body>
   </html>
   ```

   `data-review` makes the page the sign-in box, whatever its address, and only a page with it
   is one, so a site's own page of customer reviews is left alone.
4. If the site has a content security policy, it must let the service's scripts load and be asked
   (`script-src` and `connect-src` with the service's address), and allow `data:` pictures
   (`img-src data:`), which is how the screenshot is drawn.

Pixel Reel serves its own `/review` page, and every page of it has the line already.

## Looking after the sites

`bottles` (`bottles.mjs`, `npm run bottles --` in Pixel Reel) is the admin tool. `npm run
bottles` talks to the live service and has gcloud read the admin key from Secret Manager (the
secret `pixelreel-bottle-reader`), so it needs a gcloud signed in to the project. Elsewhere, run
`node bottle/bottles.mjs` with `--service <address>` (or `BOTTLE_SERVICE`) and the admin key in
`BOTTLE_READER`, or `--gcloud-secret <name> --project <project>`.

### Sites and people

```sh
npm run bottles -- sites                                            # every site, with its queue
npm run bottles -- site add civ-speak --name "Civ Speak" --origin https://civspeak.com
npm run bottles -- person add civ-speak --name "Ann Lee" --email ann@example.com   # prints her link
npm run bottles -- invite civ-speak ann-lee --to you@example.com    # the "Review your website" email
npm run bottles -- people civ-speak
npm run bottles -- person off civ-speak ann-lee                     # every key of hers stops working
npm run bottles -- person on civ-speak ann-lee
npm run bottles -- person link civ-speak ann-lee                    # a new link for her
npm run bottles -- outbox                                           # the emails kept instead of sent
```

A person's id is made from their name (`ann-lee`). Only a hash of each key is kept, so the store
holds no key that works; a link is printed once, when it is made.

### Working through a queue

Every note is triaged into one of three outcomes, and goes through these states:

| State | What it means |
| --- | --- |
| `new` | Just left. |
| `in-progress` | Someone is on it. |
| `held` | Doing it would harm the site's SEO or brand. Not done: the conflict and a proposed solution wait for Olly's decision. Held is his only inbox. |
| `declined` | It would be bad for the client in a way they may not see. Not done, and the reason is one or two plain sentences beginning "We haven't done this because...", the risk in one plain unit they understand (enquiries, calls, sales), never mixing measures. |
| `done` | On the preview, with what was done and how sure (0 to 100) it is what was meant. Its writer is emailed, once. |
| `closed` | Its writer said it is right (Looks right, under My notes). |

```sh
npm run bottles -- queue pixelreel                 # its open notes: new, in progress, held
npm run bottles -- fetch --site pixelreel --state open   # each into .bottles/<id>/: note.json and shot.jpg
npm run bottles -- show <id>
npm run bottles -- start <id>
npm run bottles -- done <id> --what "The heading is smaller on a phone." --confidence 90
npm run bottles -- held <id> --conflict "SEO: ..." --proposal "..."
npm run bottles -- declined <id> --reason "We haven't removed the Worthing page. It brings in about 4 enquiries a month, and removing it would lose most of them."
npm run bottles -- results pixelreel               # the table: request, what was done, confidence, conflict
npm run bottles -- list --site pixelreel --state all --json   # everything, for a script
```

Its writer sees only their own notes, and of those only what is theirs to see: a held note is
"being done" to them, and only done and declined notes say what came of them.

### The page of queues

`/bottle/admin` on the service (`https://pixelreel.pro/bottle/admin`) lists every site the button
is on, held notes first, with how many of its notes are in each state; each site's notes show
with their screenshots and what came of them. It opens for whoever holds the admin key (it asks
for it), or straight away in a browser that holds Olly's own key (from his link on Pixel Reel).
The page holds nothing itself, and is kept out of search engines.

## Sending email

The service builds three emails (`mail.mjs`): the invitation, the sign-in link, and the word that
a note is done. It sends them with the `mail({ to, subject, text })` function it is given. Without
one (as Pixel Reel has none yet: no email service is paid for), each email is kept in the
store's outbox instead (`bottles/outbox/<id>/mail.json`), `bottles outbox` shows them, and
nothing leaves the service. The sign-in page at `/review` needs real email to be any use to a
client, so choose a sender before giving anyone the short address.

## The parts

| File | What it is |
| --- | --- |
| `bottle.js` | Loaded by every page. A plain script of a few lines that does nothing without a key, except on the `/review` page (`data-review`). |
| `bottle-ui.mjs` | The button and what it opens, and the `/review` sign-in box, loaded only when needed. Drawn in a shadow root and styled with `adoptedStyleSheets`, so the page's styles cannot reach it and a strict content security policy (no inline styles or scripts) does not stop it. |
| `server.mjs` | The endpoint: `createBottle(...)` gives `handle(req, res)`, which answers everything under `/bottle` (and the home site's `/review` page) and returns false for anything else. |
| `sites.mjs` | The sites, the people on their lists, their keys and sign-in codes. |
| `mail.mjs` | The emails, and the outbox that keeps them when nothing sends them. |
| `admin.mjs`, `admin.css` | The page of queues. |
| `bottles.mjs` | The admin tool. |
| `test/` | The endpoint's and the tool's tests, with a store kept in memory. |

### The endpoint

`createBottle` takes:

- `store`: where everything is kept, with `put(key, bytes)`, `get(key)` (null when missing) and
  `folders(prefix)`. Pixel Reel's `DiskStore` and `S3Store` (`service/store.mjs`) both do.
  Each note is `bottles/<id>/note.json`, with `bottles/<id>/shot.jpg` beside it; the sites are
  `bottles/sites/<site>/site.json`, and keys and codes are kept by their hash under
  `bottles/keys/` and `bottles/codes/`.
- `home` (`{ id, name }`) and `origins`: the site the service is part of, and its addresses.
- `key`: the service's own secret, a key for `owner` (`{ id, name }`), who is on the home site's
  list without being added and may open the page of queues. On Pixel Reel that is Olly.
- `reader`: the admin key. Without it, only the owner's key opens the page of queues.
- `review`: the home site's own sign-in page, such as `/review`.
- `mail`, `from`: how to send email, and who signs it (see above).
- `caller(req)`: who is asking, for the limits (behind a proxy, the address it passed on).
- `perHour` (30), `perDay` (200): notes each person may leave in an hour, and each site in a
  day; `wrongPerHour` (10): wrong keys a caller may try in an hour before being turned away;
  `signInsPerHour` (5): sign-in links a caller may ask for in an hour (and three for each address).

A screenshot bigger than 4 MB is not kept (the note still is), and no note may be bigger than 6 MB.

| Request | Key | Answer |
| --- | --- | --- |
| `GET /bottle/bottle.js`, `bottle-ui.mjs`, `shot.mjs`, `admin.mjs`, `admin.css` | none | The files, to any site. |
| `GET /review`, `/bottle/admin` | none | The sign-in page and the page of queues, with nothing on them until a script draws it. |
| `POST /bottle/check` | `x-bottle-key` | 200 if the key is right, from that person's site. A sign-in link's code answers `{ key }`, a key of the person's own, once. |
| `POST /bottle/signin` | none | `{ "email": ... }` from one of a site's pages: 202 whatever happens; someone on the list is emailed a link. |
| `POST /bottle/notes` | `x-bottle-key` | 201 `{ id }`. The body is JSON, up to 6 MB with the screenshot (a JPEG data URL in `shot`). |
| `GET /bottle/mine` | `x-bottle-key` | `{ notes }`: the person's own, newest first, as they may see them. |
| `POST /bottle/mine/<id>/closed` | `x-bottle-key` | Closes one of their done notes. |
| `GET /bottle/notes?state=new&site=<id>` | admin | `{ notes }`, oldest first. `state` is one of the states, `open` (new, in progress and held) or `all`. |
| `GET /bottle/notes/<id>`, `.../shot.jpg` | admin | One note, or its screenshot. |
| `PATCH /bottle/notes/<id>` | admin | `{ "state": "done", "what": ..., "confidence": 90 }` (held: `conflict`, `proposal`; declined: `reason`). What came of it is kept in the note's `outcome` and `history`. |
| `GET /bottle/sites`, `POST /bottle/sites` | admin | Every site with its people and its counts by state; or adds one, `{ id, name, origins }`. |
| `GET /bottle/sites/<site>` | admin | One site and its people. |
| `POST /bottle/sites/<site>/people` | admin | `{ name, email }`: adds a person, and answers `{ person, link }`. |
| `PATCH /bottle/sites/<site>/people/<person>` | admin | `{ "on": false }` turns them off. |
| `POST .../people/<person>/link`, `.../invite` | admin | A new link; or the invitation, to `{ "to" }` if given, else to them. |
| `GET /bottle/outbox` | admin | The latest 50 emails kept instead of sent. |

"Admin" is `authorization: Bearer <admin key>`, or the owner's key in `x-bottle-key` from the
home site. A page on any site the service knows may ask it from its own address (it answers
with `access-control-allow-origin` for those, and no others); a person's key works only from
their own site's pages. Nothing is listed without the admin key except a person's own notes.

## How it was checked

`test/bottle.test.js` here covers the endpoint, the emails and the admin tool; Pixel Reel's own
`test/bottle.test.js` covers how it is mounted there. The button was checked in a headless
Chromium on Pixel Reel's own pages, under its content security policy, on a 1280 x 657 window and
as a 390 x 844 phone: choosing a part, writing, sending, and the screenshot matching what was on
the screen (scrolled, with the sticky bar at the top). Sites and people were checked the same way
with a stand-in client site at another address loading the button from a local service: the
personal link, a note with its screenshot, My notes with done, held and declined notes, Looks
right, Turn off, signing in at `/review` with a link from the outbox, and the page of queues, on
a phone and a wide screen. Speak was seen to appear in Chromium; nobody has dictated a note
with it yet.

What a screenshot may not show: pictures from another site that does not allow it come out
blank. A note with no screenshot (it can fail on an unusual page) is still sent, with
everything else.
