# The Pixel Reel service

The service lets anyone make reels from their own Claude, with the recorded narrator, and no
code or install on their side. It is a small Node server with two faces:

- **A Claude connector** (an MCP server) at `/mcp`. Claude writes the reel's scenes, and the
  service records the voice and gives back a link to watch it.
- **A page for each reel** at `/r/<id>`, which plays it with its recordings in the website's
  own player, and `/r/<id>/video.mp4` once a video has been asked for. The page is there at
  once, and waits with the watcher while the voice is still being recorded. When its link
  is sent in a message, the message shows the reel's own picture (`/r/<id>/card.png`: its
  first picture, its name and a play button, drawn by `service/card.mjs` the first time it
  is asked for).

It also serves the website: what Pixel Reel is (`/`), how to add it to Claude (`/claude`, with
its own address filled in), a page for each of its own example reels to be sent by
(`/watch/<name>`), how to add it to a phone's home screen (`/app`), the press kit, and
privacy, terms and credits. Something shared to it from a phone's Share menu is sent to
`/share`, which the site's own service worker takes on the phone; the service only sends
the browser on to the make-one box. The site lives in
[`site/`](../site) and is described in [docs/site/](site/README.md). The privacy and terms
pages are drafts, still to be approved, and the privacy page still needs a contact address.

- [Run it](#run-it)
- [Add it to Claude](#add-it-to-claude)
- [The tools](#the-tools)
  - [What Claude is told](#what-claude-is-told)
  - [Ready-made things to ask for](#ready-made-things-to-ask-for)
  - [Pictures timed to the voice](#pictures-timed-to-the-voice)
- [The player in the chat](#the-player-in-the-chat)
- [Other languages](#other-languages)
- [Other narrators](#other-narrators)
- [Playing while it records](#playing-while-it-records)
- [Make it right here](#make-it-right-here)
- [Limits](#limits)
- [What it keeps, and for how long](#what-it-keeps-and-for-how-long)
- [How it fits together](#how-it-fits-together)

## Run it

You need what `npm run voices` and `npm run video` need: Pocket TTS
([setup](voices.md#record-with-pocket-tts)), ffmpeg, and `npm install`. Then:

```sh
npm run service
```

| Setting | Default | |
| --- | --- | --- |
| `PORT` | `8787` | Where it listens. |
| `PIXELREEL_URL` | `http://localhost:8787` | The address people reach it at, used in the links it gives. |
| `PIXELREEL_DATA` | `.service-data` | The folder it keeps reels in. |
| `PIXELREEL_S3_BUCKET` | none | A bucket to keep reels in instead, with the settings in [deploy.md](deploy.md#keeping-reels-in-a-bucket). |
| `PIXELREEL_PYTHON` | `.venv/bin/python` | The Python with Pocket TTS installed, as for `npm run voices`. |
| `PIXELREEL_LISTED` | off | `1` lets search engines list the website. Off, every page asks them not to. Reels are never listed. |
| `PIXELREEL_LANGUAGES` | none (all six in the image) | Other languages Peter may read, such as `french,spanish`. Off, every reel is in English. See [Other languages](#other-languages). |
| `PIXELREEL_NARRATORS` | none (all five in the image) | Narrators besides Peter that may be asked for, such as `anna,stuart`. Off, Peter reads every reel. See [Other narrators](#other-narrators). |
| `PIXELREEL_WARM_VOICE` | on | `0` loads the voice afresh for each reel, instead of once when the service starts. Saves about 1 GB of memory, and makes every reel wait longer. |

It records one reel at a time, and carries on with any waiting after a restart. Stopping it
(Ctrl+C) finishes the job in hand first. To put it online, see [deploy.md](deploy.md).

**Peter is kept ready.** Starting Python and loading the voice model takes longer than
speaking several lines, so the service does it once, as soon as it starts
(`service/voice.mjs` runs `scripts/pocket_speak.py --serve`), and each reel's lines are
spoken by that one. By the time Claude has written a reel's scenes, the voice is loaded.
Measured on a development machine with a six-scene reel, the wait fell from about 26
seconds to about 18, and the first line was read after 3 seconds rather than 9. If the
loaded voice cannot start, stops or goes quiet, the lines it did not get to are recorded
the usual way, so no reel is lost to it; the log says so in a line starting `voice:`.

## Add it to Claude

Claude reaches connectors over the internet, so the service needs a public `https://` address
for this: a server of your own, or for a quick try a tunnel to your machine (such as
`cloudflared tunnel --url http://localhost:8787`), with `PIXELREEL_URL` set to that address.

The quickest way is the service's own short address, `/add` (for Pixel Reel,
`pixelreel.pro/add`): it sends the browser straight to Claude's box for adding a connector,
with the name and address filled in, using
[Claude's own link for this](https://claude.com/docs/connectors/building/directory-vs-custom).
The person presses Continue, then Add. It is short enough to say, to type on a phone, or to
print. The connector is added to their account, so it is then there in the desktop app and
on their phone too.

Or by hand: in Claude, open **Customize > Connectors**, add a custom connector, and paste the address
with `/mcp` on the end. It needs no sign-in. Custom connectors work on every Claude plan (the
Free plan allows one).

Ask for something like *"Make me a pixel reel explaining how to read my gas meter."*, or
paste in a letter and ask for a reel of it. Claude writes the scenes and gives you a link to
the reel, which plays as soon as the voice is recorded: about as long as the reel itself.

## The tools

| Tool | Does | Hint |
| --- | --- | --- |
| `reel_format` | The full guide to writing a reel: what makes a good one, every picture and icon, how to draw a sprite, and a finished reel to learn from. | read-only |
| `make_reel` | Checks a reel and starts recording it. Its input is the [reel.json format](scenes.md#a-reel-as-data-reeljson) as a JSON Schema. A reel with problems comes back as a tool error listing every one, for Claude to fix. | |
| `get_reel` | Says whether a reel is waiting, being recorded, ready or failed, with its links and its scenes. | read-only |
| `get_reel_video` | Asks for a ready reel's MP4 and gives its link once it is made. | |
| `delete_reel` | Deletes a reel, its recordings and its video at once. | destructive |

Results come as plain words for Claude to pass on, and as `structuredContent` (`id`, `state`,
`watch`, `video`, ...) for any other client. Some clients show Claude only the
`structuredContent`, so the plain words are in it too, as `message`.

### What Claude is told

Claude writes a reel from what the connector tells it, so the words are chosen with care, and
tried with real Claude sessions. To try a change, run the service and ask a real Claude:

```sh
echo '{"mcpServers":{"pixelreel":{"type":"http","url":"http://localhost:8787/mcp"}}}' > mcp.json
claude -p "Make me a pixel reel about how to read my gas meter." --mcp-config mcp.json --strict-mcp-config \
  --allowedTools "mcp__pixelreel__reel_format,mcp__pixelreel__make_reel" --output-format stream-json --verbose
```

Read what it wrote, how many tries it took, and what it said to the person afterwards:

- **A reel like the site's own.** `make_reel`'s description, its schema and the guide all ask
  for what the [examples on the site](site/README.md#the-reels-it-plays) are: 5 to 7 scenes,
  about 40 seconds, 12 to 25 spoken words a scene in Peter's voice, a title picture first,
  the pictures mixed. Left to itself Claude wrote reels twice as long.
- **One press where it can be.** The essentials are in `make_reel` itself, so Claude can write
  a good reel without calling `reel_format` first, and a first-timer has one fewer thing to
  allow. A reel that leaves out `"format"` is taken as `pixelreel/1` rather than sent back.
- **A short answer.** People who ask for a reel often find reading hard work, so the result
  asks Claude to answer in a line or two with the link, not to list the scenes, and not to
  keep checking: the player and the page wait by themselves.
- **Private things stay private.** A reel of someone's letter leaves out names, addresses and
  account numbers unless they ask, since anyone with the link can watch.
- **No timing to guess.** `make_reel` does not offer the pictures' `start` and `every`: see below.
- **A change records only what changed.** Asked to change a reel ("make the last scene
  funnier"), Claude sends the whole reel again with `improves` set to the earlier reel's
  id. The lines the two share, word for word, keep their recordings, so only the changed
  lines are read again. It is a new reel with a link of its own; the earlier one stays
  until it is deleted, as someone may have been sent its link. It works even when the
  change is asked for before the first reel has finished recording.
- **A reel can be changed from another chat.** There, Claude has only the reel's link.
  Every tool that takes a reel takes its id or its link, and `get_reel` gives the reel's
  scenes as they were written, so Claude can change them and send them back.

### Ready-made things to ask for

The connector also offers four prompts (`service/prompts.mjs`), which Claude lists in its own
menu under Pixel Reel, so someone who finds writing hard work can pick one instead of
working out what to type:

| Prompt | Asks for |
| --- | --- |
| A reel about... | A reel explaining whatever they name. |
| A reel of a letter or bill | What a letter, bill or form says, what to do, and by when, with names and account numbers left out. If no letter has been given yet, Claude asks for it. |
| A reel of a document or web page | The few things that matter most in something long: an attached document, or a web page by its address. |
| A reel of this chat | What the conversation worked out, what was decided, and what happens next. |

Where the service has other narrators or languages to offer, every prompt also has a
**voice** box and a **language** box, each of which can be left empty (Peter, English). That
is where someone finds out there is a choice: Claude itself only mentions other voices when
asked.

Each is the words a person would say, with what makes a good reel of that kind of thing.
The same advice is in the guide, for someone who asks in their own words.

### Pictures timed to the voice

A list, a row of icons, a flow, a compare or a chat brings its items in one at a time.
Whoever writes the reel cannot know how long Peter will take over a line, so on a guess the
items bunch at the start of a long line, or are still waiting when a short one ends. Once the
voice is recorded, `service/pacing.mjs` sets each such picture's `start` and `every` itself:

- An item whose label Peter says ("Outside", "Under the stairs") arrives just as he says it.
  When he says it is worked out from the words: how far through the line they come, with a
  pause for each comma and full stop. Against the timings set by hand on the site's own reels
  (from the recordings' real word timings) it lands about half a second away on average.
- Items he does not name fall in step with the ones he does; with none named they keep an
  even pace.
- The first item never waits more than a few seconds, and the last is always in before the
  line ends.

The timed reel replaces the one that was sent, so the page, the player in the chat, the
video and the picture for link previews all play the same thing.

## The player in the chat

`make_reel` and `get_reel` also point Claude at a player to show inside the chat (an
[MCP App](https://claude.com/docs/connectors/building/mcp-apps/getting-started),
`ui://pixelreel/player.html`), so the reel plays right there, with a link to its own page.

- It is the real player, in one page, plus `service/app-bridge.js`, which speaks the MCP Apps
  protocol to Claude over `postMessage`: it takes `make_reel`'s result, asks the service at
  `/r/<id>/play.json` until the voice is recorded, then starts the player, and tells Claude
  how tall it is.
- While it waits it says how far Peter has got ("Peter has read 3 of 7 lines"), with a
  square for each line, lit as it is read. `play.json` carries the count (`recorded`,
  `lines`) while a reel is being recorded, for any page that wants to show it.
- **It does not wait for the last line.** The first line is recorded in a few seconds, and
  Peter records about as fast as the player plays, so the reel starts as soon as he is
  safely ahead and the later lines are handed to the player as they come. Measured with
  the real voice, the reel could be played 4 to 10 seconds after it was made, rather than
  25 to 28. See [Playing while it records](#playing-while-it-records).
- To see it without Claude, run the service and `node scripts/chat-stand-in.mjs`: it makes
  a reel and writes a page that frames the player and speaks the chat's side of the
  protocol. No test can see the player in a page, so look at this after any change to
  `src/main.js` or `service/app-bridge.js`.
- Its content security policy lets it reach the service's own address and nothing else.
- Where a host does not show apps, nothing changes: Claude passes on the link.

## Other languages

**On in the image that runs pixelreel.pro; off from a checkout unless you set it. Still worth a listen by someone who speaks each language.**

Peter's voice comes from Pocket TTS, which also has models for French, German, Spanish,
Italian, Portuguese and Dutch. With `PIXELREEL_LANGUAGES=french,spanish` (say), `make_reel`
gains a `language` field, the guide tells Claude to write every word of such a reel in that
language, and the service records it with that language's model and the same voice. With
it off, Claude is told Peter reads English only, and to say so to someone who asked in
another language.

- Each language is a model of its own, about 220 MB, and it must be to hand: on your
  machine it downloads itself the first time; in the image it has to be built in
  ([deploy.md](deploy.md#other-languages-and-narrators)).
- The voice kept loaded is the English one, so a reel in another language loads its model
  each time: on Cloud Run its first line comes about 12 seconds later than an English reel's.
- **What has been checked, and what has not.** A line in each of the six languages was
  recorded with Peter's voice and written down again by a speech-to-text model: each was
  heard in the right language, word for word. Two whole French reels that a real Claude
  wrote were recorded too, one of them through the live service: eleven of their thirteen
  lines came back word for word but for a word or two, and none was unintelligible. That
  shows the words can be made out. It does not show how natural it sounds, or whether a
  British voice reading Spanish is one a Spanish speaker would want to listen to. Nobody
  who speaks these languages has listened.
- Words in the pictures use the pixel lettering, which has the accented letters of all six.
- The pictures are timed to the voice by looking for each label's words in the line, which
  works in any of these languages; numbers written in digits are only matched to English
  number words.

## Other narrators

**On in the image that runs pixelreel.pro; off from a checkout unless you set it. Peter is always the narrator unless someone asks for another.**

Pocket TTS has other British voices. With `PIXELREEL_NARRATORS=anna,stuart` (any of `anna`,
`vera`, `stuart`, `charles`, `paul`), `make_reel` gains a `narrator` field, and Claude is
told the person can have one of those if they ask for a different voice. Claude is told not
to offer the choice unprompted: Peter stays the narrator unless someone asks.

- Why it might be wanted: some people follow one voice more easily than another, and some
  would simply rather hear a woman's voice.
- The website offers the same choice: where narrators are on, the part of the home page
  about the voice has a card for each, with a button to hear them say hello
  ([site](site/README.md#who-reads)). It no longer says there is only Peter.
- Each voice is a small file that must be to hand, like a language's model
  ([deploy.md](deploy.md#other-languages-and-narrators)).
- A line was recorded in each of the six voices and written down again by a speech-to-text
  model: every one came back word for word. Nobody has listened to judge how they sound.
- A change to a reel (`improves`) keeps its recordings only when the narrator and the
  language are the same.
- The player in the chat names whoever is reading ("Anna has read 3 of 7 lines"). The reel's
  own page on the website still says Peter.

## Playing while it records

A reel used to wait for its last line before anything played. Now:

- **Each line is saved as it is recorded** (`service/reels.mjs`), with a list of the lines
  so far, and how fast they are coming.
- **`play.json` hands out what there is** while the state is `recording`: `reel` (its
  pictures timed to each line's recording, or to a guess at it for a line still to come),
  `clips` (the lines so far), `guesses` (about how long each line still to come will
  last) and `playable`.
- **`playable` is the service's word that a player starting now will not catch Peter up**
  (`service/ahead.mjs`). It walks the scenes: the player reaches each one after the scenes
  before it; Peter has its line ready after the unrecorded lines up to it, at the pace he
  has kept so far and a quarter slower, to be safe. If he is overdue with the line in
  hand, nothing is promised.
- **The player takes late lines** (`src/main.js`): whoever frames it leaves them in
  `window.pixelreelClips` (`{ clips, more, guesses }`) and sends a `pixelreel:clips` event.
  The reel's clock and the marks on its progress bar are set again as each arrives.
- **If the player does get to a line that has not come** (someone presses Next, or Peter
  slows down), it waits for it, saying "This line is still being recorded", rather than
  read it in the browser's own voice; the scene then starts from the top with his.

The player in the chat does this now. The reel's own page (`/r/<id>`) still waits for the
last line: it can use the same `play.json` fields.

## Make it right here

**Off unless you switch it on, because every reel it makes is paid for.** (It is on at
pixelreel.pro.)

Someone without Claude cannot use the connector. With this on, the website's "Make a pixel
reel now" box makes the reel itself. The visitor gives it one thing to explain, in whichever
way is easiest for them:

- **Type or paste** a link or a few words into the box, and press **Make my reel**.
- **Paste some writing** (an email, a letter) into the box. It grows to hold it.
- **Drop** a link, a PDF, a picture or some writing **anywhere on the page**. A panel says
  "Drop it here" while it is dragged, and the reel is started as soon as it lands.
- **Choose a file**, or on a phone **take a photo** of a letter or a bill.

The visitor is taken to the reel's own page straight away, and waits there with something to
watch. The service asks Claude to write the scenes through the Claude API after it has
answered, and the page says what is being done and how far along it is: a sign ("Writing",
then "Recording"), a bar that fills, and one plain sentence ("Claude is writing it: 3 scenes
so far.", then "Peter is recording scene 4 of 6."). Claude's reply is read as it is written,
so the page has the reel's name and a count of its scenes long before it is finished. When
the voice is recorded, the reel plays there. If it cannot be made, the page says
why in plain words, and "Try something else" leads back to the box, with the words that were
asked about still in it. Giving the words to their own Claude is still there, behind "Use
your own Claude instead".

Once a reel plays, its page offers it again: **Make it simpler** and **Make it shorter**
(wherever the service can write a reel itself, for anyone who has the reel's link). Claude is
given the reel as it was written, since what it was made from was never kept, and writes a
new one: simpler words and smaller ideas, or about half as long. It is a new reel with a
page of its own, under the same name while it is written, and the first stays as it is. It
counts as one of the visitor's reels for the hour, and costs about as much as a reel from a
few words.

**In the reader's own language.** Where Peter can read more than English
([Other languages](#other-languages)), the box asks "Read it to me in" and offers English and
each of those languages, called what its speakers call it (Français, Español). It starts on
the language the browser says its reader prefers, if that is one on offer, and remembers the
last one chosen on the device. Claude is told to write every word of the reel in that
language, whatever language what was given is in, so a letter in English can be explained in
Spanish; the reel is recorded with that language's model. A reel made simpler or shorter
stays in the language it is in. With no other language switched on, there is no choice and
every reel is in English.

**Read by whoever was chosen.** Where other narrators read ([Other narrators](#other-narrators)), the
home page lets a visitor choose one, and says "Anna will read the reels you make". A reel
made in the box is read by that narrator: the choice goes with the request, is checked
against the narrators the service offers, and Claude is told who will read, so that the
narrator never says they are Peter. A reel made simpler or shorter keeps whoever read it.

**Your reels.** The home page lists the reels a visitor has made here, under the box, so
that they can find them again, call them what they like, and delete them. The list is kept
in the visitor's own browser and never sent to the service. When a reel is begun, `/try`
gives back a `key` with its id, which the service keeps only the hash of; `DELETE /r/<id>`
with that key (`x-reel-key`) deletes the reel, its recordings and its video at once. Having
a reel's link is enough to watch it, never to delete it.

What can be known before Claude is asked is said in the box, before the visitor leaves it:
nothing typed, a file Pixel Reel cannot read, too much of it, a PDF too long to read, too
many reels in the last hour.

For a page that is waiting, `/r/<id>/play.json` gives the reel's `state` (`writing`, then
`queued`, `recording` and `ready`, or `failed` with an `error`) and how far it has got:
`written` (scenes so far, with the reel's `title` once Claude has written it) while it is
being written, `ahead` (jobs before it) while it is queued, and `recorded` of `lines` while
Peter records. How far the writing has got is kept in memory only (`Reels.note`).
A reel that was still being written when the service restarted is marked `failed`, since
nothing would ever finish it.

| Setting | Default | |
| --- | --- | --- |
| `PIXELREEL_TRY` | off | `1` switches it on. It also needs a credential for the Claude API, such as `ANTHROPIC_API_KEY`. |
| `PIXELREEL_TRY_MODEL` | `claude-sonnet-5-5` | The model that writes. `claude-opus-5-5` costs twice as much, `claude-haiku-5-5` a twentieth. |
| `PIXELREEL_TRY_EFFORT` | `low` | How hard the model thinks: `low`, `medium` or `high`. |
| `PIXELREEL_TRIES_PER_HOUR` | `5` | How many each visitor (by address) may make in an hour. |
| `PIXELREEL_TRIES_PER_DAY` | `30` | How many everyone may make in a day. This is the cap on what it can cost. |

What a visitor may give, and how much of it:

| | The most | |
| --- | --- | --- |
| A link or a few words | 600 letters | A link is read by Claude, once, up to 10,000 tokens of the page: about 7,000 words. |
| Writing | 60,000 letters | About 10,000 words: a long article. |
| A PDF | 10 MB, and 50,000 tokens | Counted with the Claude API's token counter, which is free, before Claude reads a page of it. That is about 25 pages. |
| A picture | 5 MB | JPEG, PNG, GIF or WebP. The page makes a phone's photo smaller before sending it (2,000 pixels along its longest side). |

A file is known by how it begins, never by its name or what the browser says it is. Anything
else (a Word document, say) is turned away in plain words: "Save that as a PDF, then give it
again."

**What it costs.** With `claude-sonnet-5-5` ($2 and $10 a million tokens in and out):

| A reel from | Tokens in | Tokens out | Cost | |
| --- | --- | --- | --- | --- |
| A link | 48,617 | 1,227 | 11 cents | **Measured**, once, on 22 November 2026: the first real reel, from a GOV.UK guide, when Claude read up to 20,000 tokens of a page. |
| A link, now | about 18,000 | about 1,200 | about 5 cents | An estimate, from the two changes below. Not measured yet. |
| A few words, or a photo | about 3,000 | about 1,200 | about 2 cents | An estimate. Not measured yet. |
| A PDF | at most 53,000 | about 1,200 | at most 12 cents | An estimate. The PDF itself is counted before it is read, and turned away over 50,000 tokens. |

A link costs more than its page is long, for two reasons that the first real reels showed:

- **The page is paid for more than once.** Claude reads it, then reads it again each time
  it carries on after fetching it. So Claude now reads up to 10,000 tokens of a page, not
  20,000 (`PAGE_TOKENS` in `service/writer.mjs`).
- **The page reader itself costs tokens on every pass.** Counted with the token counter,
  which is free: a request with no page reader is 2,868 tokens; with the plain reader
  (`web_fetch_20250910`) it is 3,914; with the newer one that has Claude write code to sift
  the page (`web_fetch_20260209`), 7,411, and it takes a pass more. A link whose page would
  not load took 23,939 tokens, about 5 cents, and came to nothing. A reel reads one page
  once, so it now uses the plain reader (`PAGE_READER`).

At 30 a day, the most it can cost is about $3.60 a day if every one is a long PDF, and about
$1.50 if every one is a link, plus the recording (see [deploy.md](deploy.md#what-it-costs)).

**A YouTube link is turned away before it costs anything.** Claude's page reader cannot
load a YouTube page (tried, on the live site), and Pixel Reel cannot watch a video. So the
box says so at once, with what to do instead: "If it has a transcript, copy that and paste
it here."

The service logs what each reel was made from and every kind of token it took (`try: words,
48617 tokens in, 1227 out, 1 page fetched (claude-sonnet-5-5)`), so the real figure can be
worked out from the logs: look for lines that start `try:`.

A go that cost nothing is not counted against the visitor: a file turned away before Claude
saw it, a PDF that was too long, or Claude being busy.

How it is kept safe:

- **The service never fetches an address a visitor gives it.** A link is read by Claude's
  own web fetch tool, on Anthropic's side, once, and no more than 10,000 tokens of it.
- **Only a request that names a page may read one.** Writing, a PDF or a picture is given to
  Claude with no way to fetch anything, so a link hidden inside a document goes nowhere.
- **Only the website's own page may ask.** A request from another site, or one that does not
  say where it comes from, is refused, so no other site can spend the service's money. (A
  script can still pretend, which is what the caps are for.)
- **What a visitor gives, and what is on a page, is material to explain, never an
  instruction.** Claude is told so, and whatever it writes still has to pass the same checks
  and limits as any reel. If the reel has problems, Claude gets one chance to put it right,
  and is not sent a long document a second time to do it.
- **What a visitor gives is not kept.** It is held in memory while Claude reads it and then
  dropped: only the reel is stored. Claude is told to leave out details that point at one
  person and that the explanation does not need (names, addresses, account numbers), since
  anyone with a reel's link can watch it.
- If Claude declines, the visitor is told so in plain words. The request asks for Claude's
  default fallback model first, so a refusal by the one model is not the last word.

`site/js/given.js` works out what was given and what to send for it (and holds the limits,
which the service reads from there); `site/js/maker.js` is the box; `service/try.mjs` takes
the request and `service/writer.mjs` asks Claude. The tests in `test/given.test.js` and
`test/try.test.js` use a stand-in for Claude, so they cost nothing.

## Limits

So a reel stays short enough to watch, and nobody (or no runaway agent) can use the service up:

- A reel has at most 12 scenes, 70 spoken words and 160 caption characters a scene, 8 items
  in a list, terminal, code or chat picture, and runs under 4 minutes. It cannot carry images
  from elsewhere (they could track whoever watches); icons and sprites cover most needs.
  `reel_format` tells Claude these up front, and `make_reel` says exactly what is over.
- Each caller (by address) can make 10 reels and 10 videos an hour, and the service 300 reels
  a day in all. Set them with `PIXELREEL_REELS_PER_HOUR`, `PIXELREEL_VIDEOS_PER_HOUR` and
  `PIXELREEL_REELS_PER_DAY`. Only a reel that is made counts: one sent back to Claude to be
  fixed does not.
- **Everyone using Claude shares one, bigger, allowance.** Claude calls a connector from
  Anthropic's own addresses, not the person's, so the service cannot tell one person on
  Claude from another: counted singly, a few people would use up each other's ten. Callers
  from [Anthropic's published addresses](https://platform.claude.com/docs/en/api/ip-addresses)
  are counted together instead, and may make 60 reels and 60 videos an hour between them
  (`PIXELREEL_CLAUDE_PER_HOUR`; the addresses are `PIXELREEL_CLAUDE_ADDRESSES`, a list like
  `160.79.104.0/21,153.61.208.0/20`). The day's limit still caps what it can all cost.
- Behind a proxy that sets `X-Forwarded-For` (most hosts), set `PIXELREEL_TRUST_PROXY=1` so
  callers are told apart, or to how many proxies there are if more than one. The caller is
  taken to be the address the outermost proxy saw, never one the caller wrote in the header
  themselves. The service logs once how many addresses arrive (never the addresses), and
  says if that is not what the setting expects.
- With 20 jobs waiting, it asks people to try again in a few minutes.

The local tools (`npm run voices`, `page`, `video`) have no such limits.

## What it keeps, and for how long

- The reel as it was sent (with its pictures timed to the voice), its recordings and, if asked for, its video. Nothing else: no
  accounts, no names, no addresses.
- Each reel has a random 22-character id, so only people with its link can watch it.
- Reels are deleted after 30 days, or at once with `delete_reel`.
- The voice is recorded on the service's own machine. The words are never sent to another
  company.
- A reel's page loads nothing from anywhere else: its content security policy allows only the
  service's own files. The page names the reel and points at its first picture (so a link
  sent in a message shows what it is) but holds none of its words: the player fetches those.
- Search engines are asked not to list any reel, its recordings or its video.

## How it fits together

| File | Does |
| --- | --- |
| `service/main.mjs` | Starts it: settings, restart, the hourly sweep of expired reels. |
| `service/server.mjs` | HTTP: `/mcp`, the reel pages, their recordings and videos. |
| `service/mcp.mjs` | The connector's tools, and the player shown in the chat. |
| `service/prompts.mjs` | The ready-made things to ask for, and what to put in a reel of each kind. |
| `service/app-bridge.js` | The in-chat player's side of the MCP Apps protocol. |
| `service/reels.mjs` | Making, recording, videos, expiry and deleting: one job at a time. |
| `service/pacing.mjs` | Times a recorded reel's pictures to its voice. |
| `service/ahead.mjs` | Says when a reel still being recorded can start playing without catching the recorder up. |
| `service/voice.mjs` | Keeps the voice model loaded between reels, so a reel starts being spoken at once. |
| `service/limits.mjs` | How big a reel may be, and how many each caller may make. |
| `service/try.mjs`, `service/writer.mjs` | Make it right here: what a visitor gives (words, a link, writing, a PDF or a picture), and Claude asked to write it. Off by default. |
| `service/site.mjs` | Puts the website's pages together, from `site/`. |
| `service/static.mjs` | Serves the files those pages load (styles, scripts, fonts, pictures and the site's reels), and nothing else. |
| `service/store.mjs` | Where reels are kept: a folder now, behind an interface an S3-style store can take over. |

A job copies its reel out of the store into a folder of its own, runs the same
`npm run voices` and `npm run video` code as on your machine, and puts the results back.
