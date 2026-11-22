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
(`/watch/<name>`), the press kit, and privacy, terms and credits. The site lives in
[`site/`](../site) and is described in [docs/site/](site/README.md). The privacy and terms
pages are drafts, still to be approved, and the privacy page still needs a contact address.

- [Run it](#run-it)
- [Add it to Claude](#add-it-to-claude)
- [The tools](#the-tools)
  - [What Claude is told](#what-claude-is-told)
  - [Ready-made things to ask for](#ready-made-things-to-ask-for)
  - [Pictures timed to the voice](#pictures-timed-to-the-voice)
- [The player in the chat](#the-player-in-the-chat)
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

It records one reel at a time, and carries on with any waiting after a restart. Stopping it
(Ctrl+C) finishes the job in hand first. To put it online, see [deploy.md](deploy.md).

## Add it to Claude

Claude reaches connectors over the internet, so the service needs a public `https://` address
for this: a server of your own, or for a quick try a tunnel to your machine (such as
`cloudflared tunnel --url http://localhost:8787`), with `PIXELREEL_URL` set to that address.

Then in Claude, open **Customize > Connectors**, add a custom connector, and paste the address
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
| `get_reel` | Says whether a reel is waiting, being recorded, ready or failed, with its links. | read-only |
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
- To see it without Claude, frame the player (`resources/read` of
  `ui://pixelreel/player.html`) in a page that answers `ui/initialize` and then sends
  `ui/notifications/tool-result` with `make_reel`'s result.
- Its content security policy lets it reach the service's own address and nothing else.
- Where a host does not show apps, nothing changes: Claude passes on the link.

## Make it right here

**Off unless you switch it on, because every reel it makes is paid for.**

Someone without Claude cannot use the connector. With this on, the website's "Make a pixel
reel now" box gains a second button, "Make it right here": the visitor types a link or a few
words, the service asks Claude to write the scenes through the Claude API, and they are
taken to the reel's page, which plays it once the voice is recorded.

| Setting | Default | |
| --- | --- | --- |
| `PIXELREEL_TRY` | off | `1` switches it on. It also needs a credential for the Claude API, such as `ANTHROPIC_API_KEY`. |
| `PIXELREEL_TRY_MODEL` | `claude-opus-5-5` | The model that writes. `claude-haiku-5-5` costs about a fortieth as much. |
| `PIXELREEL_TRY_EFFORT` | `low` | How hard the model thinks: `low`, `medium` or `high`. |
| `PIXELREEL_TRIES_PER_HOUR` | `3` | How many each visitor (by address) may make in an hour. |
| `PIXELREEL_TRIES_PER_DAY` | `20` | How many everyone may make in a day. This is the cap on what it can cost. |

What it costs is an estimate from the published prices, not yet measured. A reel from a few
words is about 2,000 tokens in and 2,000 out; from a link, up to about 22,000 in, since
Claude reads at most 20,000 tokens of one page. With `claude-opus-5-5` ($4 and $20 a million
tokens) that is about 5 cents for a few words and up to about 13 cents for a long page; with
`claude-haiku-5-5` ($0.10 and $0.50) it is a third of a cent at most. At 20 a day, the most
it can cost is about $2.60 a day with Opus, or about 6 cents with Haiku, plus the recording
(see [deploy.md](deploy.md#what-it-costs)). The service logs the tokens each reel took
(`try: 1200 tokens in, 600 out`), so the real figure can be read from the logs.

How it is kept safe:

- **The service never fetches an address a visitor gives it.** A link is read by Claude's
  own web fetch tool, on Anthropic's side, once, and no more than 20,000 tokens of it.
- **Only the website's own page may ask.** A request from another site, or one that does not
  say where it comes from, is refused, so no other site can spend the service's money. (A
  script can still pretend, which is what the caps are for.)
- **What a visitor types, and what is on a page, is material to explain, never an
  instruction.** Claude is told so, and whatever it writes still has to pass the same checks
  and limits as any reel. If the reel has problems, Claude gets one chance to put it right.
- **A request is one line of at most 600 letters.** It is not a place to paste a document.
- If Claude declines, the visitor is told so in plain words. The request asks for Claude's
  default fallback model first, so a refusal by the one model is not the last word.

`service/try.mjs` takes the request and `service/writer.mjs` asks Claude; the tests in
`test/try.test.js` use a stand-in for both, so they cost nothing.

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
| `service/limits.mjs` | How big a reel may be, and how many each caller may make. |
| `service/try.mjs`, `service/writer.mjs` | Make it right here: a visitor's request, and Claude asked to write it. Off by default. |
| `service/site.mjs` | Puts the website's pages together, from `site/`. |
| `service/static.mjs` | Serves the files those pages load (styles, scripts, fonts, pictures and the site's reels), and nothing else. |
| `service/store.mjs` | Where reels are kept: a folder now, behind an interface an S3-style store can take over. |

A job copies its reel out of the store into a folder of its own, runs the same
`npm run voices` and `npm run video` code as on your machine, and puts the results back.
