# Voices

A reel speaks in one of three ways, best first:

1. **A recorded clip** for the scene, made by `npm run voices` (or by you).
2. **The browser's own voice**, when a scene has no recording yet, so a brand new reel plays
   straight away. It sounds like a satnav having a moment, so record before you share.
3. **Silence**, timed as if someone were speaking, with Sound off or no voice at all.

Clips are matched to scenes by their exact words, not their position, so you can reorder
scenes freely. Change a scene's words and it falls back to the browser's voice until you
record again, so the voice never says something the caption does not.

- [Record with Kokoro](#record-with-kokoro)
- [Pick a voice](#pick-a-voice)
- [Use another speech engine](#use-another-speech-engine)
- [Use your own voice](#use-your-own-voice)

## Record with Kokoro

pixelreel records with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), an open speech
model, through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx). It runs offline
on an ordinary CPU; nothing is sent anywhere.

**Install once.** You need Python 3.10 to 3.13, `curl` and [ffmpeg](https://ffmpeg.org/)
(`sudo apt install ffmpeg` or `brew install ffmpeg`). Then:

```sh
scripts/setup-voices.sh
```

This makes a Python environment in `.venv/` with `kokoro-onnx` and `soundfile`, and downloads
the Kokoro v1.0 model files (about 350 MB) into `models/`. Both folders are ignored by git.
Set `KOKORO_HOME` to keep the model files somewhere else, or `PIXELREEL_PYTHON` to use a
Python you already have.

**Record.**

```sh
npm run voices my-reel
```

This writes one small MP3 per scene into `reels/my-reel/audio/`, plus `manifest.json`, which
tells the player which clip belongs to which words. Expect about half a minute per clip on a
laptop. Run it again after editing: only lines whose words changed are recorded again, and
clips nothing uses any more are deleted. It uses two CPU threads so the machine stays
usable; `THREADS=4 npm run voices my-reel` is faster.

| Option (after `--`) | Default | |
| --- | --- | --- |
| `--voice` | `bm_george` | A warm British male voice. |
| `--speed` | `0.92` | Slightly slower than normal, for explaining. |
| `--lang` | `en-gb` | Pronunciation. Use `en-us` with American voices. |
| `--bitrate` | `48k` | Mono MP3 bitrate: about 350 KB a minute of speech. |
| `--all` | | Record every clip again. |
| `--command` | | Record with [another speech engine](#use-another-speech-engine). |

## Pick a voice

```sh
npm run voices my-reel -- --voice bf_emma --speed 1
```

Some English voices: `bm_george`, `bm_fable`, `bm_lewis`, `bf_emma`, `bf_isabella` (British);
`am_michael`, `am_adam`, `af_heart`, `af_bella` (American, with `--lang en-us`). Kokoro's
[voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) has the rest,
including other languages. Changing voice or speed records every clip again.

## Use another speech engine

Any program that can turn words into an audio file will do. Give `--command` a command line
with `{out}` where the file should go; it gets each scene's words on its standard input.
ffmpeg turns whatever it writes into a small MP3.

```sh
# Piper, another open, offline voice
npm run voices my-reel -- --command "piper --model en_GB-alan-medium.onnx --output_file {out}"

# eSpeak NG, tiny and very robotic
npm run voices my-reel -- --command "espeak-ng --stdin -v en-gb -w {out}"

# the voice built into a Mac
npm run voices my-reel -- --command "say -o {out} --data-format=LEI16@22050"
```

A cloud voice works the same way: write a little script that reads the words, calls the
service and saves the audio to the path it is given, then point `--command` at it. Changing
the command records every clip again.

## Use your own voice

Record each line yourself, as an MP3 (or anything browsers play), and put the files in the
reel's `audio/` folder. Then list them in `audio/manifest.json`, each with the scene's exact
words (its `say`, or its caption if it has no `say`) and its length in seconds:

```json
{
  "clips": [
    { "text": "First, the picking. Only the top two leaves and a bud are taken.", "file": "picking.mp3", "seconds": 6.4 }
  ]
}
```

`npm run check my-reel` lists any scene still without a recording. Your files are safe from
`npm run voices`: it only ever records, replaces or deletes the clips it named itself, so you
can record some lines and let Kokoro do the rest.
