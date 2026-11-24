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
of it, and the person who left it sees that under My notes, and is emailed what came of it (all
their notes since the last email in one, at most an hour apart).

Nobody else sees any of it. Every page loads `bottle.js`, but without a key or a link it does
nothing: no button, no request. Search engines are kept out of everything it answers. The screenshot is made
in the browser by [modern-screenshot](https://github.com/qq15725/modern-screenshot) (MIT),
served by the service itself, so no other company is involved.

It is a package of its own (`package.json` here), used by Pixel Reel first and made to move into
Crow's Nest as its feedback stage: everything is in this folder, nothing in it reaches outside
it, and the endpoint is plain Node (20.6 or later) with no packages but modern-screenshot.
`npm install && npm test` here runs its own tests.

## How a client gets the button

1. Whoever looks after the sites puts them on the site's list (`bottles person add`) and sends
   them the invitation (`bottles invite`), "<Site>: your link to leave notes on the new site". It
   holds a link such as `https://theirsite.com/#bottle=<code>`, which works for 7 days on any
   phone or computer it is opened on. The code is after `#`, which a browser never sends to the
   site, so it is in none of the site's logs, and the page takes it out of its address at once.
2. Opening it shows one small card, "Switch on the note button". Pressing it swaps the code for a
   key of that browser's own, which it keeps, so the button is there on every page of that site
   from then on, and says "The note button is on". Only the press uses the link, so a mail scanner
   that opens it uses nothing up. A new invitation (`invite` or `person link`) retires the last.
3. On another phone or computer, or once the link has run out, they go to the site's short
   address, `theirsite.com/review` ("Review <Site>") and give their email. If it is on the site's
   list, the service emails them a sign-in link the same way (it works once, for 30 minutes; at
   most five a day). Anyone else is told the same ("If that address is on the list, a link is on
   its way"), with Send again, and sent nothing, so the page says nothing about who is on the list.
4. My notes, beside the Note button, lists their notes, each with its page and day, and what came
   of each: being done, waiting (held), done (with what was done, and Looks right to close it), or
   not done (with the reason). Turn off there forgets the key, and `/review` says the button is on
   and turns it off too.

A link that has run out (used, too old, retired, or its person turned off) says "This link has run
out", with Get a new link to `/review`; opened in a browser whose key still works, it leaves the
button on and says so. A kept key that stops working shows nothing, and the browser forgets it:
that browser could be anyone's. `#bottle=off` on any page forgets the key as well. Links sent
before links held codes (`?bottle=<key>`) still work.

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
npm run bottles -- person add civ-speak --name "Ann Lee" --email ann@example.com   # prints her link (7 days)
npm run bottles -- invite civ-speak ann-lee                         # emails her a new invitation
npm run bottles -- invite civ-speak ann-lee --to you@example.com    # a preview of it, with no link in it
npm run bottles -- people civ-speak                                 # with the last email to each, and their link's end
npm run bottles -- person off civ-speak ann-lee                     # every key and link of hers stops working, for good
npm run bottles -- person on civ-speak ann-lee                      # then send her a new invitation
npm run bottles -- person link civ-speak ann-lee                    # a new link for her (the last one stops working)
npm run bottles -- person email civ-speak ann-lee ann.lee@example.com   # corrects her address
npm run bottles -- outbox                                           # the emails kept instead of sent
```

A person's id is made from their name (`ann-lee`). Only a hash of each key and code is kept, so
the store holds no key that works; a link is printed once, when it is made. Turning someone off
ends every key and link they have, so turning them on again brings back none of them, not even
one they passed on. Correcting an address does the same, so a link sent to a wrong one is dead.
`people` shows what became of the last email to each person (an invitation sent, or in the
outbox; bounced or marked as spam, once Resend's webhook says so) and until when their
invitation's link works.

### Working through a queue

Every note is triaged into one of three outcomes, and goes through these states:

| State | What it means |
| --- | --- |
| `new` | Just left. |
| `in-progress` | Someone is on it. |
| `held` | Doing it would harm the site's SEO or brand. Not done: the conflict and a proposed solution wait for Olly's decision. Held is his only inbox. |
| `declined` | It would be bad for the client in a way they may not see. Not done, and the reason is one or two plain sentences beginning "We haven't done this because...", the risk in one plain unit they understand (enquiries, calls, sales), never mixing measures. |
| `done` | On the preview, with what was done and how sure (0 to 100) it is what was meant. Its writer is emailed, once (see "Sending email"). |
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
"waiting" to them (it may yet be declined), and only done and declined notes say what came of
them.

### The page of queues

`/bottle/admin` on the service (`https://pixelreel.pro/bottle/admin`) lists every site the button
is on, held notes first, with how many of its notes are in each state; each site's notes show
with their screenshots and what came of them. It opens for whoever holds the admin key (it asks
for it), or straight away in a browser that holds Olly's own key (from his link on Pixel Reel).
The page holds nothing itself, and is kept out of search engines.

## Sending email

The service builds four emails (`mail.mjs`), each naming the site in its subject: the invitation
(which says who it is from), the sign-in link, the news of what came of a person's notes, and,
to whoever looks after the sites, word of new notes. It sends them with the `mail({ to, subject,
text, replyTo })` function it is given. `resend({ key, from })` in `mail.mjs` is one that sends
through [Resend](https://resend.com); Pixel Reel uses it when it has a key (docs/deploy.md, "Its
email, through Resend"). Without one, each email is kept in the store's outbox instead
(`bottles/outbox/<id>/mail.json`), `bottles outbox` shows them, and nothing leaves the service.
The sign-in page at `/review` needs real email to be any use to a client, so set a sender up
before giving anyone the short address.

- **Replies.** With `replyTo`, every email ends "Reply to this email to reach <from>" and a
  reply goes there, not to the sending address (which may take no mail).
- **News of notes.** A note marked done or declined joins its writer's next email, which goes
  once nothing has been marked for them for 10 minutes, and no sooner than an hour after the last:
  one email however many notes were marked, listing each under a link to its page. A note is
  marked told only once its email has gone, so one that fails goes next time, and a person turned
  off is sent nothing until they are on again. The service looks every minute; if it was asleep,
  it sends what is due when it next wakes.
- **New notes.** With `notify`, whoever looks after the sites is told when notes come in on a
  site ("Harbour Bakery: 4 new notes", with a link to its queue), the same way: once they stop
  coming for 10 minutes, at most an hour apart. Notes left with the owner's own key are not told.
- **What is kept.** Once emails really go, the outbox kept before is emptied, and each email sent
  is recorded under `bottles/sent/<id>/` with whom it was to, its subject and why, but none of its
  words, so no link. A Resend webhook (`hook`, posting to `/bottle/resend`) says when one bounced
  or was marked as spam, and `bottles people` shows it.

## The parts

| File | What it is |
| --- | --- |
| `bottle.js` | Loaded by every page. A plain script of a few lines that does nothing without a key or a link, except on the `/review` page (`data-review`). It is served asking for the very `bottle-ui.mjs` served with it, so a browser never runs one with the other from before a change. |
| `bottle-ui.mjs` | The button and what it opens, and the `/review` sign-in box, loaded only when needed. Drawn in a shadow root and styled with `adoptedStyleSheets`, so the page's styles cannot reach it and a strict content security policy (no inline styles or scripts) does not stop it. |
| `server.mjs` | The endpoint: `createBottle(...)` gives `handle(req, res)`, which answers everything under `/bottle` (and the home site's `/review` page) and returns false for anything else. |
| `sites.mjs` | The sites, the people on their lists, their keys and sign-in codes. |
| `mail.mjs` | The emails, the Resend sender, and the outbox that keeps them when nothing sends them. |
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
- `mail`, `from`, `replyTo`: how to send email, who signs it, and where a reply goes (see above).
- `notify`: the address told when new notes come in; `hook`: the signing secret of a Resend
  webhook (`whsec_...`), which says when an email bounced.
- `quiet` (10 minutes), `gap` (an hour), `every` (a minute): when news of notes is sent (see
  above), and how often it looks. `tell()` sends whatever is due now.
- `caller(req)`: who is asking, for the limits (behind a proxy, the address it passed on).
- `perHour` (30), `perDay` (200): notes each person may leave in an hour, and each site in a
  day; `wrongPerHour` (10): wrong keys a caller may try in an hour before being turned away;
  `signInsPerHour` (5): sign-in links a caller may ask for in an hour (and three for each address,
  and five a day for each person on a list, counted in the store).

A screenshot bigger than 4 MB is not kept (the note still is), and no note may be bigger than 6 MB.

| Request | Key | Answer |
| --- | --- | --- |
| `GET /bottle/bottle.js`, `bottle-ui.mjs`, `shot.mjs`, `admin.mjs`, `admin.css` | none | The files, to any site. |
| `GET /review`, `/bottle/admin` | none | The sign-in page and the page of queues, with nothing on them until a script draws it. |
| `POST /bottle/check` | `x-bottle-key` | 200 if the key is right, from that person's site. A link's code that still works answers 409 `{ code: true }`; with `{ "use": true }` it answers `{ key }`, a key of the person's own (a sign-in code once, an invitation's for 7 days). |
| `POST /bottle/site` | none | `{ name }` of the site the page asking is on, for its `/review` page. |
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
| `PATCH /bottle/sites/<site>/people/<person>` | admin | `{ "on": false }` turns them off, ending every key and link they have; `{ "email": ... }` corrects their address. |
| `POST .../people/<person>/link`, `.../invite` | admin | A new invitation link (retiring the last); or the invitation emailed to them. With `{ "to" }`, a preview of it to that address, with no link in it. |
| `GET /bottle/outbox` | admin | The latest 50 emails kept instead of sent. |
| `POST /bottle/resend` | Resend's signature | A Resend webhook: a bounce or complaint is kept on the person the email was for. |

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

The links were checked the same way, as a 390 x 844 phone (and a 1280 x 800 window), with the
emails taken from the outbox: an invitation's card and its button, a sign-in link opened on a
phone already on (left on, the link unused), opened fresh, opened again once used (the button
stays on and says the link has run out), and opened with nothing kept (This link has run out, Get
a new link, then "Review Harbour Bakery", Check your email and Send again); a link pasted into a
tab already on the page; the toast clear of the buttons; and My notes with each note's page and
day and a held note waiting. `decide()` in `bottle-ui.mjs` holds the choice made about a link and
a kept key, and the tests run it. Nobody has opened a link from a real inbox yet, through an
iPhone's mail app or a scanner such as Safe Links.

What a screenshot may not show: pictures from another site that does not allow it come out
blank. A note with no screenshot (it can fail on an unusual page) is still sent, with
everything else.
