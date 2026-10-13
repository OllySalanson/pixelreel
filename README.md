# pixelreel

Narrated pixel-art explainer videos, made from a short list of scenes.

You write a reel as one small JavaScript file: a title, then a list of scenes, each with a
caption, the words to say and a little picture drawn in code. pixelreel plays it in the
browser like a video, with a warm recorded voice-over, captions, and Play, Pause, Back,
Next and Sound controls. No video editor, no build step, no server code.

![The example reel playing: a film reel mascot, scene cards, a pixel heart, a voice waveform and a terminal](docs/pixelreel.gif)

**Watch the example:** [ollysalanson.github.io/pixelreel](https://ollysalanson.github.io/pixelreel/)
(two minutes, with sound; it explains pixelreel itself).

## What you get

- **A browser player.** Pixel-art pictures on a 320 x 180 canvas, large readable captions,
  Play/Pause, Back, Next, Sound on/off and a dot per scene. Keyboard: Space plays and
  pauses, the arrow keys move between scenes, M turns the sound off and on.
- **Scenes as data.** One `reel.js` file per reel. Pictures are small `draw(t, px)`
  functions with a pixel kit of helpers, so they can move in time with the narration.
- **Offline narration.** `npm run voices` records every scene with
  [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), an open-weights speech model that
  runs on an ordinary CPU. Only lines that changed are recorded again.
- **A fallback voice.** A scene with no recording yet is read aloud by the browser's own
  voice, so a brand new reel plays straight away.
- **Static hosting.** A reel is plain files. A GitHub Pages workflow is included.

## Quick start

You need [Node.js](https://nodejs.org/) 20 or newer.

```sh
git clone https://github.com/OllySalanson/pixelreel.git
cd pixelreel
npm start
```

Open <http://localhost:8000/> and press Play. (Browsers will not load modules or audio
from a page opened straight from disk, so `npm start` runs a tiny local web server.
`PORT=9000 npm start` picks another port.)

Start your own reel:

```sh
npm run new my-reel                         # makes reels/my-reel/reel.js
npm run new my-reel -- --title "My reel"    # or give it a title
```

Then open <http://localhost:8000/?reel=my-reel>. Edit `reels/my-reel/reel.js` and reload
to see your changes. Until you record voices, the browser reads each scene aloud.

## Write scenes

A reel file exports one object:

```js
export default {
  title: 'How tea is made',
  intro: 'Sound will start. Use Next and Back any time.',   // shown before Play (optional)
  note: 'Made with pixelreel.',                             // small print under the player (optional)
  images: { garden: 'images/garden.png' },                  // pictures, relative to the reel folder (optional)
  scenes: [
    {
      title: 'Picking',
      caption: 'Only the top two leaves and a bud are picked.',
      say: 'First, the picking. Only the top two leaves and a bud are taken from each bush.',
      draw(t, px) {
        px.sky('#0b1220', '#24476b');
        px.sign('PICKING', px.W / 2, 20, 16, '#ffcc4d');
        if (px.shown(t, 0, 1, 2)) px.image('garden', 60, 50, 200, 110);
      }
    }
  ]
};
```

Each scene has:

| Field | Needed | What it is |
| --- | --- | --- |
| `title` | yes | The heading over the caption. |
| `caption` | yes | The words shown on screen. Short sentences read best. |
| `say` | no | What the narrator says. Leave it out to read the caption aloud. |
| `draw(t, px)` | no | Paints the picture. `t` is seconds since the scene started. Leave it out for a plain title card. |

When the narration ends the player waits a moment, then moves on by itself. Aim for 6 to
14 scenes of 25 to 60 spoken words each. If the reel has a mistake (a missing caption, a
typo in the file), the player says what and where instead of playing.

### The pixel kit

Pictures are drawn on a grid of 320 x 180 logical pixels (`px.W` x `px.H`), scaled up
crisply. `draw` is called about 20 times a second.

| Helper | Draws |
| --- | --- |
| `px.rect(colour, x, y, w, h)` | A filled rectangle. |
| `px.sprite(rows, x, y, scale, flip)` | Pixel art from rows of palette letters (`.` is see-through). Letters: `k` ink, `w` white, `r` red, `g` green, `b` blue, `y` yellow, `o` orange, `p` purple, `t` teal, `s` skin, `n` brown, `e` grey, `c` cream (capitals are darker shades of `b`, `r`, `n`, `g`). Any other character is used as a CSS colour. |
| `px.text(str, x, y, size, colour, align)` | Text in the Orange Kid pixel font. |
| `px.textW(str, size)` | How wide that text would be. |
| `px.window(x, y, w, h, fill)` | A framed panel. |
| `px.sign(str, cx, y, size, bg, fg)` | A label in a panel, centred on `cx`. |
| `px.image(name, x, y, w, h, frame)` | One of the reel's `images`, fitted in the box and framed. |
| `px.sky(top, bottom)` | A banded sky between two `#rrggbb` colours. |
| `px.stars(t)`, `px.moon(cx, cy)` | Twinkling stars and a crescent moon. |
| `px.bob(t, speed, amount)` | A small bounce to add to a position. |
| `px.shown(t, i, every, start)` | True once item `i` of a list should appear, one every `every` seconds from `start`: handy for revealing things as the narrator names them. |

For anything else, write your own helpers at the top of the reel file, as the
[example reel](reels/what-is-pixelreel/reel.js) does for its film reel and speech bubble.

To check one picture by eye, open `?reel=my-reel&scene=3&t=12`: scene 3, twelve seconds in.

## Record the voices

Recorded narration sounds far better than the browser's voice. pixelreel uses
[Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) through
[kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx). It runs offline on the CPU;
nothing is sent anywhere.

### Install (once)

You need Python 3.10 to 3.13, `curl` and [ffmpeg](https://ffmpeg.org/)
(`sudo apt install ffmpeg` or `brew install ffmpeg`). Then:

```sh
scripts/setup-voices.sh
```

This makes a Python environment in `.venv/` with `kokoro-onnx` and `soundfile`, and
downloads the Kokoro v1.0 model files (`kokoro-v1.0.onnx` and `voices-v1.0.bin`, about
350 MB) into `models/`. Both folders are ignored by git. Set `KOKORO_HOME` to keep the
model files somewhere else.

### Record

```sh
npm run voices my-reel
```

This writes one small MP3 per scene into `reels/my-reel/audio/`, plus `manifest.json`,
which tells the player which clip belongs to which words. Expect about half a minute per
clip on a laptop. Run it again after editing: only lines whose words changed are recorded
again, and clips nothing uses any more are deleted. A scene whose words changed since the
last recording is read by the browser's voice until you record again, so the voice never
says something the caption does not.

Options (after `--`):

| Option | Default | |
| --- | --- | --- |
| `--voice` | `bm_george` | A warm British male voice. |
| `--speed` | `0.92` | Slightly slower than normal, for explaining. |
| `--lang` | `en-gb` | Pronunciation. Use `en-us` with American voices. |
| `--bitrate` | `48k` | Mono MP3 bitrate. 48k keeps a two-minute reel under 600 KB. |
| `--all` | | Record every clip again. |

For example `npm run voices my-reel -- --voice bf_emma --speed 1`. Some other English
voices: `bm_fable`, `bm_lewis`, `bf_emma`, `bf_isabella` (British); `am_michael`,
`am_adam`, `af_heart`, `af_bella` (American). Kokoro's
[voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) has them all.
Changing voice or speed records every clip again.

It uses two CPU threads so the machine stays usable; `THREADS=4 npm run voices my-reel`
is faster. To use a Python you already have, set `PIXELREEL_PYTHON` to it.

## Host it

The player and reels are static files, so any web host works.

**GitHub Pages:** the included workflow (`.github/workflows/pages.yml`) publishes the site
on every push to `main`. Turn it on once: in your repository, go to **Settings > Pages**
and set **Source** to **GitHub Actions**. Your reels are then at
`https://<you>.github.io/<repo>/?reel=<name>`. The reel named in `data-reel` in
`index.html` plays when there is no `?reel=`.

**Anywhere else:** upload `index.html`, `src/`, `fonts/` and `reels/` together, keeping
the same folders.

## Project layout

```
index.html                  the player page
src/                        the player: main.js (page), player.js (timing), narrator.js
                            (clip, browser voice or timer), reel.js (checks a reel), kit.js
                            (pixel kit), timing.js, pixelreel.css
reels/<name>/reel.js        a reel
reels/<name>/audio/         its recorded clips and manifest.json
scripts/                    npm start, npm run new, npm run voices, setup-voices.sh
test/                       unit tests (node --test)
fonts/                      Orange Kid, the pixel font (CC0)
```

## Develop

```sh
npm install     # the linter
npm test        # unit tests: reel loader, player timing, narrator, tools
npm run lint
```

## Licence

pixelreel is released under the [MIT licence](LICENSE).

It stands on the shoulders of:

- **[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)** by hexgrad, the speech
  model that records the narration. Its weights are released under the Apache 2.0 licence.
  pixelreel does not include the model; `scripts/setup-voices.sh` downloads it.
- **[kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx)** by thewh1teagle (MIT),
  which runs Kokoro on the CPU and hosts the model files used here.
- **Orange Kid**, the pixel font, by Ray Larabie of
  [Typodermic Fonts](https://typodermicfonts.com/), released under
  [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain). See
  [fonts/LICENSE.txt](fonts/LICENSE.txt).

The example reel's narration was recorded with Kokoro, voice `bm_george`.
