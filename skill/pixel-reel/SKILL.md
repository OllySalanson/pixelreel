---
name: pixel-reel
description: Make a pixel reel - a short pixel-art explainer that plays like a little cartoon, one idea per scene with big plain captions - as a single web page the person opens and watches. Use when someone asks for a pixel reel, an explainer video or cartoon, or to have something explained in a way they can watch instead of read (for example because reading is hard work, or dyslexia).
---

# Pixel reel

A pixel reel explains one thing as a handful of scenes. Each scene has a short title, one
plain caption on screen, the words a narrator would say, and an animated pixel-art picture.
You write the reel as JSON, and `make-page.mjs` (beside this file) checks it and turns it into
one HTML file that plays in any browser, with Play, Back and Next buttons.

**If you have the Pixel Reel connector (a `make_reel` tool), use that instead.** It makes the
same reel with Peter, a warm recorded narrator, and a link to send to someone. This skill is
for when the connector is not there: its page plays with captions and the device's own voice.

## Steps

1. **Plan the scenes.** 5 to 7 scenes, about 40 seconds in all, one idea each, in the order
   a person needs them. If the person asked for a number of scenes or a length, give them
   that, not more. Only things that change what the person understands or does get their
   own scene.
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
- `say`: one or two short spoken sentences, 12 to 25 words, written to be said aloud and
  saying a little more than the caption. Leave it out to have the caption read as it is.
- Open on a `title` picture, and end on what to do next, or the one thing to remember.
- Be honest: every claim must be true to what the person gave you. For money, health or the
  law, say to check with whoever sent the original.
- Keep private things private: leave out names, addresses, and account or reference numbers
  from someone's letter, bill or chat unless they ask for them.
- Plain dashes only, never an em dash. No emoji. No real people's names or likenesses unless
  the person asks.

What to put in, by what you are given:

- **A letter, bill or form:** who it is from and what it is about; what the person has to
  do, if anything; by when; what happens if they do not; and who to ring. Use its real
  amounts and dates.
- **A document or web page:** the few things that matter most to someone reading it for the
  first time. Stick to what it says.
- **A chat:** what was worked out, what was decided and what happens next, not the back and
  forth.
- **How to do something:** the steps in order, one a scene, and the mistake people usually
  make.

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
before Play), `note` (small print under the player), `transition`, `captions` and `language`.

A scene: `title`, `caption`, and optionally `say`, `picture`, `transition` and `captions`.
Any other field is an error. There is no drawing code: every picture is a ready-made one.

`transition` is one of `cut` (default), `fade`, `dissolve`, `wipe`, `slide`, `blinds`, `iris`,
`flash` or `star`. `captions` is `plain` (default) or `typewriter`.

`language` is the language the reel is written in: `english` (default), `french`, `german`,
`spanish`, `italian`, `portuguese` or `dutch`. Write the reel in the language the person
writes to you in, every word of it, and say which with `language`: the player's buttons are
then in that language too, and it is read aloud in a voice of that language, not an English
one. For any other language, write the reel in it and leave `language` out.

### Pictures

| `type` | Fields (`?` is optional) | Shows |
| --- | --- | --- |
| `title` | `text`, `sub?` | A big title dropping in over a night sky, with a line typed underneath. |
| `big` | `text`, `sub?` | One big word or number on a paper card, punched in, with a line underneath. Keep `text` to about 8 characters. Once in a reel is plenty. |
| `list` | `items` (list of text), `heading?`, `numbered?` (true/false), `every?` and `start?` (seconds) | Items arriving one by one with a tick, or a number. Up to about 5 short items. |
| `chat` | `messages` (list of `{ "from": "...", "text": "..." }`), `title?`, `every?`, `start?` | Messages arriving with a typing indicator. The first sender sits on the left. |
| `terminal` | `lines` (list of text), `title?` | A terminal window. Lines starting with `$ ` type out; the rest is output. |
| `code` | `lines` (list of text), `title?` | An editor that types out the code, with simple highlighting. |
| `image` | `name` | One of the reel's `images` (`"images": { "name": "https://..." }`), slowly pushing in. |
| `icons` | `items` (1 to 4 `{ "icon": "...", "label": "..." }`, label optional), `heading?`, `every?`, `start?` | Everyday icons dropping in one by one, each with a short label underneath. |
| `flow` | `items` (as for `icons`), `heading?`, `every?`, `start?` | The same icons joined by arrows: how one thing leads to the next. |
| `compare` | `bad` and `good` (each `{ "icon": "...", "label": "..." }`), `heading?`, `every?`, `start?` | Two cards side by side: the one to avoid, with a cross, then the one to choose, with a tick. |
| `table` | `rows` (1 to 5 rows, each a list of 2 to 4 short cells), `columns?` (a heading for each column), `heading?`, `every?`, `start?` | A small table for a timetable, a bill, prices or dates: rows arrive one by one, the newest lit. |
| `sprite` | `rows` (list of text), `colours?`, `label?` | Your own pixel art, scaled up to fill the picture. See below. |
| `stage` | `place`, `things` (1 to 6 `{ "id", "is", "spot" }`), `moves` (1 to 6 `{ "do", ... }`) | Something happening: a place, a few things standing in it, and moves between them (a letter flies, a barrier rises, coins pile up). `docs/scenes.md` in the Pixel Reel repository has every field. |

The icons, by what they are about:

- **Paperwork and money:** `letter`, `document`, `money`, `card`, `bank`, `calendar`, `clock`, `hourglass`, `bag`, `basket`, `gift`, `chart`
- **People and home:** `person`, `people`, `woman`, `man`, `girl`, `boy`, `children`, `baby`, `heart`, `house`, `bed`, `key`, `lock`, `bin`, `cup`, `apple`, `egg`, `bread`, `bowl`, `bottle`, `pan`, `tap`, `shirt`, `tooth`, `pill`, `thermometer`, `dog`, `cat`
- **Out and about:** `car`, `bus`, `train`, `plane`, `pin`, `world`, `flag`, `ball`, `trophy`, `music`, `book`, `pencil`
- **Technology:** `phone`, `computer`, `camera`, `wifi`, `battery`, `plug`, `cog`, `search`, `speech`, `bell`, `eye`, `shield`, `rocket`
- **Weather and nature:** `sun`, `moon`, `cloud`, `rain`, `water`, `fire`, `bolt`, `tree`
- **Signs:** `tick`, `cross`, `warning`, `question`, `star`, `lightbulb`

Pick the one that means the thing, and keep labels to two or three words. If no icon means
it, do not make one stand for it: use a `list`, a `table` or a `sprite` instead.

Show people as who they are. `woman`, `man`, `girl`, `boy` and `baby` are one person each,
and their item can give them `skin` (`light`, `medium`, `deep`) and `hair` (`black`, `brown`,
`blonde`, `ginger`, `grey`), such as `{ "icon": "woman", "label": "Laura", "hair": "ginger" }`.
A woman, or anyone called she, is a woman. Set skin and hair only from what you were told or
shown; otherwise leave them out and each person gets a look of their own, the same in every
scene. When you do not know who someone is, do not make them a man: use `person` (anyone, a
plain outline), `people` (a woman and a man) or `children` (a girl and a boy).

A `sprite` is drawn from rows of letters, one letter a pixel, up to 40 rows of up to 64: `k`
black, `w` white, `r` red, `g` green, `b` blue, `y` yellow, `o` orange, `p` purple, `t` teal,
`s`, `S` and `d` skin (light, medium, deep), `n` brown, `e` grey, `c` cream, capitals `B`,
`R`, `N`, `G` for darker blue, red, brown and green, and `.` for see-through. `colours` adds
letters of your own, such as `{ "h": "#6b3e2e" }`. Keep sprites small and bold (about 8 to
16 pixels across): a face, a sun, a simple object. A person in a sprite is drawn as the people
icons are: who they are at a glance, with their skin and hair as you were told. Make every
row the same length: a stray space or letter pushes the rest of that row sideways.

A scene with no `picture` shows its title on a plain card. Mix the pictures so the reel
moves: open with `title`, use `icons` or `list` for what is involved, `flow` for steps that
lead to each other, `compare` for do this, not that, `table` for what is set out in rows
and columns (times, amounts, dates: never make icons stand for those), `big` once at most,
for the one number or word the reel turns on, and `chat` for a conversation. `example.json` beside this file is a finished reel.

## What the person gets

The page has no recorded voice. It starts with the sound off and moves on by itself, timed as
if someone were reading the words aloud; the Sound button reads them with the device's own
voice. For Peter, the warm recorded narrator, and a link to send, the person can add the
Pixel Reel connector to Claude at pixelreel.pro/claude: say so in one line if they ask about
the voice. The open-source pixelreel project (github.com/OllySalanson/pixelreel) can also
record the same `reel.json` with `npm run voices` and make the page with `npm run page`.

## If node is not available

The page checks the reel itself and shows any problems on screen, so the reel can be put in
the template directly:

```sh
python3 -c "import json,sys; t=open(sys.argv[1]).read(); r=json.dumps(json.load(open(sys.argv[2]))).replace('<','\\\\u003c'); open(sys.argv[3],'w').write(t.replace('PIXELREEL_REEL_HERE', r))" <this skill's folder>/template.html reel.json /mnt/user-data/outputs/<short-name>.html
```
