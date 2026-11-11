# Voices

A reel speaks in one of three ways, best first:

1. **A recorded clip** for the scene, made by `npm run voices` (or by you).
2. **The browser's own voice**, when a scene has no recording yet, so a brand new reel plays
   straight away. It sounds like a satnav having a moment, so record before you share.
3. **Silence**, timed as if someone were speaking, with Sound off or no voice at all.

Clips are matched to scenes by their exact words, not their position, so you can reorder
scenes freely. Change a scene's words and it falls back to the browser's voice until you
record again, so the voice never says something the caption does not.

- [Record with Pocket TTS](#record-with-pocket-tts)
- [Pick a voice](#pick-a-voice)
- [Record with Kokoro](#record-with-kokoro)
- [Use another speech engine](#use-another-speech-engine)
- [Use your own voice](#use-your-own-voice)

## Record with Pocket TTS

pixelreel records with [Pocket TTS](https://github.com/kyutai-labs/pocket-tts), a small open
speech model from Kyutai. It runs offline on an ordinary CPU, nothing is sent anywhere, and its
default narrator, `peter_yearsley`, is a warm British storyteller made from public domain
LibriVox readings.

**Install once.** You need Python 3.10 to 3.13, `curl` and [ffmpeg](https://ffmpeg.org/)
(`sudo apt install ffmpeg` or `brew install ffmpeg`). Then:

```sh
scripts/setup-voices.sh
```

This makes a Python environment in `.venv/` with `pocket-tts`, PyTorch for the CPU and
`soundfile` (about 1 GB in all), and downloads the model (about 220 MB) into the Hugging Face
cache, `~/.cache/huggingface`. `.venv/` is ignored by git. Set `PIXELREEL_PYTHON` to use a
Python you already have.

**Record.**

```sh
npm run voices my-reel
```

This writes one small MP3 per scene into `reels/my-reel/audio/`, plus `manifest.json`, which
tells the player which clip belongs to which words. Each clip takes about as long to make as it
does to say. Run it again after editing: only lines whose words changed are recorded again, and
clips nothing uses any more are deleted. It uses two CPU threads so the machine stays usable;
`THREADS=4 npm run voices my-reel` is faster.

**A reel keeps its narrator.** `manifest.json` remembers who recorded the reel, and a later
`npm run voices` carries on with the same engine and voice, so changing one line never leaves
a reel with two narrators. The example reels were recorded with Kokoro, so they stay with
Kokoro. Choosing another voice or engine records every clip again.

| Option (after `--`) | Default | |
| --- | --- | --- |
| `--engine` | `pocket` | `pocket` for Pocket TTS or `kokoro` for [Kokoro](#record-with-kokoro). |
| `--voice` | `peter_yearsley` | A Pocket TTS voice, or a Kokoro one such as `bm_george`, which picks Kokoro by itself. |
| `--bitrate` | `48k` | Mono MP3 bitrate: about 350 KB a minute of speech. |
| `--all` | | Record every clip again. |
| `--command` | | Record with [another speech engine](#use-another-speech-engine). |

## Pick a voice

```sh
npm run voices my-reel -- --voice stuart_bell
```

Some English voices: `peter_yearsley` and `stuart_bell` (storytellers from LibriVox readings),
`charles` and `paul` (English men), `anna` and `vera` (English women); `michael`, `jane`, `mary`
and `eve` (American). Pocket TTS's [voice list](https://github.com/kyutai-labs/pocket-tts#the-generate-command)
has the rest. Pocket TTS has no speed setting. It can also copy a voice from a short recording,
but that needs a separate model you must accept terms for; see its documentation.

## Record with Kokoro

[Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) is another open model that runs offline on
the CPU, through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx). It has more voices
and languages and a speed setting, and the example reels are narrated by its `bm_george`.
Install it too with:

```sh
scripts/setup-voices.sh kokoro
```

This adds `kokoro-onnx`, and downloads the Kokoro v1.0 model files (about 350 MB) into
`models/`, which git ignores. Set `KOKORO_HOME` to keep them somewhere else. Then name a Kokoro
voice, or the engine:

```sh
npm run voices my-reel -- --voice bf_emma --speed 1
npm run voices my-reel -- --engine kokoro
```

| Option (after `--`) | Default | |
| --- | --- | --- |
| `--voice` | `bm_george` | A warm British male voice. |
| `--speed` | `0.92` | Slightly slower than normal, for explaining. |
| `--lang` | `en-gb` | Pronunciation. Use `en-us` with American voices. |

Some English voices: `bm_george`, `bm_fable`, `bm_lewis`, `bf_emma`, `bf_isabella` (British);
`am_michael`, `am_adam`, `af_heart`, `af_bella` (American, with `--lang en-us`). Kokoro's
[voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) has the rest,
including other languages.

## Use another speech engine

Any program that can turn words into an audio file will do. Give `--command` a command line
with `{out}` where the file should go; it gets each scene's words on its standard input.
ffmpeg turns whatever it writes into a small MP3. A reel recorded this way needs the same
`--command` each time you record it again.

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
can record some lines and let Pocket TTS do the rest.
