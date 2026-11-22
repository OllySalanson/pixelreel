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
its own address filled in), the press kit, and privacy, terms and credits. The site lives in
[`site/`](../site) and is described in [docs/site/](site/README.md). The privacy and terms
pages are drafts, still to be approved, and the privacy page still needs a contact address.

- [Run it](#run-it)
- [Add it to Claude](#add-it-to-claude)
- [The tools](#the-tools)
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

Ask for something like *"Make me a pixel reel explaining how to read my gas meter."* Claude
reads the format, writes the scenes, and gives you a link to the reel, which plays as soon as
the voice is recorded: about as long as the reel itself.

## The tools

| Tool | Does | Hint |
| --- | --- | --- |
| `reel_format` | Explains how to write a reel: the fields, every picture and icon, and writing for people who find reading hard. | read-only |
| `make_reel` | Checks a reel and starts recording it. Its input is the [reel.json format](scenes.md#a-reel-as-data-reeljson) as a JSON Schema. A reel with problems comes back as a tool error listing every one, for Claude to fix. | |
| `get_reel` | Says whether a reel is waiting, being recorded, ready or failed, with its links. | read-only |
| `get_reel_video` | Asks for a ready reel's MP4 and gives its link once it is made. | |
| `delete_reel` | Deletes a reel, its recordings and its video at once. | destructive |

Results come as plain words for Claude to pass on, and as `structuredContent` (`id`, `state`,
`watch`, `video`, ...) for any other client.

## The player in the chat

`make_reel` and `get_reel` also point Claude at a player to show inside the chat (an
[MCP App](https://claude.com/docs/connectors/building/mcp-apps/getting-started),
`ui://pixelreel/player.html`), so the reel plays right there, with a link to its own page.

- It is the real player, in one page, plus `service/app-bridge.js`, which speaks the MCP Apps
  protocol to Claude over `postMessage`: it takes `make_reel`'s result, asks the service at
  `/r/<id>/play.json` until the voice is recorded, then starts the player, and tells Claude
  how tall it is.
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
  `PIXELREEL_REELS_PER_DAY`. Behind a proxy that sets `X-Forwarded-For` (most hosts), set
  `PIXELREEL_TRUST_PROXY=1` so callers are told apart.
- With 20 jobs waiting, it asks people to try again in a few minutes.

The local tools (`npm run voices`, `page`, `video`) have no such limits.

## What it keeps, and for how long

- The reel as it was sent, its recordings and, if asked for, its video. Nothing else: no
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
| `service/app-bridge.js` | The in-chat player's side of the MCP Apps protocol. |
| `service/reels.mjs` | Making, recording, videos, expiry and deleting: one job at a time. |
| `service/limits.mjs` | How big a reel may be, and how many each caller may make. |
| `service/try.mjs`, `service/writer.mjs` | Make it right here: a visitor's request, and Claude asked to write it. Off by default. |
| `service/site.mjs` | Puts the website's pages together, from `site/`. |
| `service/static.mjs` | Serves the files those pages load (styles, scripts, fonts, pictures and the site's reels), and nothing else. |
| `service/store.mjs` | Where reels are kept: a folder now, behind an interface an S3-style store can take over. |

A job copies its reel out of the store into a folder of its own, runs the same
`npm run voices` and `npm run video` code as on your machine, and puts the results back.
