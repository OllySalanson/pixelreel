---
name: pixel-reel
description: Make a pixel reel - a short pixel-art explainer that plays like a little cartoon, one idea per scene with big plain captions - as a single web page the person opens and watches. Use when someone asks for a pixel reel, an explainer video or cartoon, or to have something explained in a way they can watch instead of read (for example because reading is hard work, or dyslexia).
---

# Pixel reel

A pixel reel explains one thing as a handful of scenes. Each scene has a short title, one
plain caption on screen, the words a narrator would say, and an animated pixel-art picture.
You write the reel as JSON, and `make-page.mjs` (beside this file) checks it and turns it into
one HTML file that plays in any browser, with Play, Back and Next buttons.

## Steps

1. **Plan the scenes.** 4 to 10 scenes, one idea each, in the order a person needs them.
   Only things that change what the person understands or does get their own scene.
2. **Write `reel.json`** in the format below.
3. **Make the page:**

   ```sh
   node <this skill's folder>/make-page.mjs reel.json /mnt/user-data/outputs/<short-name>.html
   ```

   It lists every problem in the reel at once. Fix them all and run it again until it says
   `Wrote ...`. (If the outputs folder is different where you are, write the page wherever
   files are shared with the person.)
4. **Share the page file** and say, in one line, to open it and press Play.

## Writing for people who find reading hard

- Short, everyday words. One idea per sentence. No jargon unless the scene explains it.
- `title`: one to three words. `caption`: one short sentence, about 12 words at most.
- `say`: one or two short spoken sentences, 15 to 45 words, saying a little more than the
  caption. Leave it out to have the caption read as it is.
- Be honest: every claim must be true to what the person gave you.
- Plain dashes only, never an em dash. No emoji. No real people's names or likenesses unless
  the person asks.

## The format

```json
{
  "format": "pixelreel/1",
  "title": "How tea is made",
  "transition": "dissolve",
  "scenes": [
    { "title": "Tea", "caption": "From the bush to the cup.",
      "say": "Let's see how tea gets from a bush on a hillside into your cup.",
      "picture": { "type": "title", "text": "TEA", "sub": "From the bush to the cup" } }
  ]
}
```

The reel: `format` (always `"pixelreel/1"`), `title`, `scenes`, and optionally `intro` (shown
before Play), `note` (small print under the player), `transition` and `captions`.

A scene: `title`, `caption`, and optionally `say`, `picture`, `transition` and `captions`.
Any other field is an error. There is no drawing code: every picture is a ready-made one.

`transition` is one of `cut` (default), `fade`, `dissolve`, `wipe`, `slide`, `blinds`, `iris`,
`flash` or `star`. `captions` is `plain` (default) or `typewriter`.

### Pictures

| `type` | Fields (`?` is optional) | Shows |
| --- | --- | --- |
| `title` | `text`, `sub?` | A big title dropping in over a night sky, with a line typed underneath. |
| `big` | `text`, `sub?` | One huge word or number, punched in, with a line underneath. Keep `text` to about 8 characters. |
| `list` | `items` (list of text), `heading?`, `numbered?` (true/false), `every?` and `start?` (seconds) | Items arriving one by one with a tick, or a number. Up to about 5 short items. |
| `chat` | `messages` (list of `{ "from": "...", "text": "..." }`), `title?`, `every?`, `start?` | Messages arriving with a typing indicator. The first sender sits on the left. |
| `terminal` | `lines` (list of text), `title?` | A terminal window. Lines starting with `$ ` type out; the rest is output. |
| `code` | `lines` (list of text), `title?` | An editor that types out the code, with simple highlighting. |
| `image` | `name` | One of the reel's `images` (`"images": { "name": "https://..." }`), slowly pushing in. |

A scene with no `picture` shows its title on a plain card. Mix the pictures so the reel
moves: open with `title`, use `list` for steps, `big` for one number or word that matters,
and `chat` for a conversation. `example.json` beside this file is a finished reel.

## What the person gets

The page has no recorded voice. It starts with the sound off and moves on by itself, timed as
if someone were reading the words aloud; the Sound button reads them with the device's own
voice. For a warm recorded narrator, the open-source pixelreel project
(github.com/OllySalanson/pixelreel) records the same `reel.json` with `npm run voices` and
makes the page with `npm run page`.

## If node is not available

The page checks the reel itself and shows any problems on screen, so the reel can be put in
the template directly:

```sh
python3 -c "import json,sys; t=open(sys.argv[1]).read(); r=json.dumps(json.load(open(sys.argv[2]))).replace('<','\\\\u003c'); open(sys.argv[3],'w').write(t.replace('PIXELREEL_REEL_HERE', r))" <this skill's folder>/template.html reel.json /mnt/user-data/outputs/<short-name>.html
```
