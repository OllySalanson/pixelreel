"""Writes down what is said: My notes' microphone, where the browser cannot (service/hear.mjs).

Run with --serve, it loads a Whisper model once (faster-whisper, on the processor) and then
reads one request a line on stdin, {"id": ..., "pcm": base64}, where pcm is mono 16-bit
samples at 16,000 a second, and answers each on stdout, {"id": ..., "text": ...}, or
{"id": ..., "error": ...}. It says {"ready": true} once the model is loaded.

  python scripts/hear.py --serve [--model base.en] [--threads 2]
  python scripts/hear.py some.raw          (the same, once, for trying it by hand)
"""
import argparse
import base64
import json
import sys


def load(model, threads):
    from faster_whisper import WhisperModel
    try:  # the model built into the image, without asking the internet
        return WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=threads, local_files_only=True)
    except Exception:  # not here yet: fetched once, into the Hugging Face cache
        return WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=threads)


def hear(whisper, pcm):
    import numpy as np
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    if len(samples) < 1600:  # under a tenth of a second: nothing was said
        return ""
    # one pass, no beam search: quick enough to show the words while they are said.
    # No text carried from one piece to the next, so a mishearing does not repeat itself.
    segments, _ = whisper.transcribe(samples, language="en", beam_size=1, condition_on_previous_text=False,
                                     vad_filter=True, vad_parameters={"min_silence_duration_ms": 300})
    return " ".join(segment.text.strip() for segment in segments).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", nargs="?")
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--threads", type=int, default=2)
    args = parser.parse_args()
    whisper = load(args.model, args.threads)
    if not args.serve:
        with open(args.file, "rb") as raw:
            print(hear(whisper, raw.read()))
        return
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        if not line.strip():
            continue
        asked = {}
        try:
            asked = json.loads(line)
            answer = {"id": asked["id"], "text": hear(whisper, base64.b64decode(asked["pcm"]))}
        except Exception as err:  # one bad piece must not stop the next
            answer = {"id": asked.get("id"), "error": str(err)[:200]}
        print(json.dumps(answer), flush=True)


if __name__ == "__main__":
    main()
