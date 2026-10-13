# Sharing a reel

A reel is a handful of static files: no server code, no accounts, no build step. That makes
it easy to put almost anywhere, and easy for other tools to make.

- [Host it](#host-it)
- [Embed it in a page](#embed-it-in-a-page)
- [Put a banner in a README](#put-a-banner-in-a-readme)
- [Make a reel from a script](#make-a-reel-from-a-script)
- [A reel for every release](#a-reel-for-every-release)
- [Let an AI agent write it](#let-an-ai-agent-write-it)
- [Player addresses](#player-addresses)

## Host it

**GitHub Pages.** The included workflow (`.github/workflows/pages.yml`) publishes the player
and every reel on each push to `main`. Turn it on once: in your repository, go to
**Settings > Pages** and set **Source** to **GitHub Actions**. Your reels are then at
`https://<you>.github.io/<repo>/?reel=<name>`. The reel named in `data-reel` in `index.html`
plays when there is no `?reel=`.

**Anywhere else.** Upload `index.html`, `src/`, `fonts/` and `reels/` together, keeping the
same folders (and `export.html` too, if you want the banner maker online). Any static host
works: Netlify, an S3 bucket, a shared drive behind a web server, a Raspberry Pi.

## Embed it in a page

Add `&embed` to a reel's address for just the player, sized to fit its frame, then drop it
in an iframe:

```html
<iframe src="https://you.github.io/pixelreel/?reel=my-reel&embed"
  width="720" height="600" style="border: 0" allow="autoplay" title="My reel"></iframe>
```

It works in docs sites, wikis and slide tools that accept an iframe. Make the frame about
as tall as it is wide, minus a sixth, so the caption and buttons fit under the picture.

## Put a banner in a README

GitHub will not run a player inside a README, but it will show an animated picture that
links to one. The banner maker turns a few seconds of any scene into exactly that:

1. Run `npm start` and open <http://localhost:8000/export.html?reel=my-reel> (or
   `export.html` on your Pages site).
2. Pick a scene, where to start and how long, and whether to add a Watch button. For a
   montage, list several clips instead, as `scene:from-to`: `2:0-2, 4:8.3-9.6, 9:6.3-7.5`
   plays two seconds of scene 2, then a moment of scene 4, then one of scene 9.
3. Press **Make the banner**, download the SVG, and paste the snippet it gives you:

```md
[![Watch: My reel](my-reel-banner.svg)](https://you.github.io/pixelreel/?reel=my-reel)
```

The banner is an animated SVG of real frames from the reel. It stays crisp at any size, and
holds still on its first frame for anyone who prefers less motion.

## Make a reel from a script

Write the story as plain Markdown and let `npm run new` lay out the scenes:

```sh
npm run new tea -- --from tea.md
```

````md
# Tea, explained

How a leaf becomes a cup.

## Picking

Only the top two leaves and a bud are picked.

> First, the picking. Only the top two leaves and a bud are taken from each bush.

- Two leaves
- One bud

## Brewing

```sh
kettle --boil
steep --minutes 3
```
````

| In the script | In the reel |
| --- | --- |
| `# Title` | The reel's title, and an opening title scene over the text that follows it |
| `## Heading` (or `###`) | A new scene |
| The first paragraph | The caption |
| `> A quote` | What the narrator says (otherwise the paragraphs are read out) |
| A bullet or numbered list | A [list picture](scenes.md#ready-made-pictures) |
| A `sh` code block | A terminal picture; any other code block is a code picture |
| A `chat` block of `Name: words` lines | A chat picture |
| `![alt](images/x.png)` | An image picture (copy the file into the reel's folder) |
| Nothing else | A big title card |

The result is an ordinary `reel.js` of plain data, ready to edit, with dissolves and
typewriter captions switched on. Release notes work as they are: links, addresses and
"by @someone in" credits are tidied out of the words.

```sh
gh release view v1.2.0 --json body --jq .body | npm run new release-1-2 -- --from - --title "What's new in 1.2"
```

## A reel for every release

[docs/examples/release-reel.yml](examples/release-reel.yml) is a GitHub Actions workflow
that runs whenever you publish a release: it turns the release notes into a reel, records
the narration with Kokoro, checks it, commits it, and redeploys your Pages site. Copy it to
`.github/workflows/` in a copy of pixelreel, and every release gets its own two-minute
cartoon without anyone lifting a finger. The model files are cached, so after the first run
it takes a few minutes.

## Let an AI agent write it

Scenes are plain data, so any coding agent can write a reel. Point it at this repository and
ask for something like:

> Write a pixelreel reel explaining how our login flow works, as reels/login/reel.js.
> Follow docs/scenes.md. Use 8 to 12 scenes of 20 to 45 spoken words each, and the
> ready-made pictures unless a custom draw function would explain it better. Run
> `npm run check login` and fix anything it reports, then `npm run voices login`.

`npm run check` gives the agent exact problems to fix ("scene 4: picture.items is needed for
a list picture"), and the browser's voice reads any scene before it is recorded, so you can
watch a draft straight away.

## Player addresses

| Address | Shows |
| --- | --- |
| `?reel=my-reel` | That reel (otherwise the one in `index.html`'s `data-reel`). |
| `&scene=3&t=12` | Scene 3 held at twelve seconds in. Press Play to carry on from there. |
| `&embed` | Just the player, for an iframe. |
| `export.html?reel=my-reel` | The banner maker. |

Keyboard: Space plays and pauses, the arrow keys move between scenes, M turns the sound off
and on. On the progress bar, the arrow keys move five seconds and Home and End jump to the
start and the end.
