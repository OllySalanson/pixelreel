"""Speak lines of text into WAV files with Pocket TTS, for scripts/voices.mjs.

Reads one JSON job from stdin:
  {"voice": "peter_yearsley", "threads": 2,
   "lines": [{"text": "Hello!", "wav": "/tmp/x.wav"}, ...]}
and prints one JSON line per finished WAV: {"wav": "...", "seconds": 3.4}.

With --serve it stays running, for the service (service/voice.mjs): it loads the model and
the voice named by --voice once, prints {"ready": true}, then takes a job a line for as
long as stdin stays open, ending each with {"done": true}, or {"error": "..."} if that job
could not be spoken. A job's "id" comes back on every line about it, so its lines are
never taken for another's. Loading takes far longer than speaking a line, so a reel recorded
this way starts being spoken at once.

Needs the pocket-tts and soundfile packages (scripts/setup-voices.sh installs them). The
model downloads itself the first time, about 220 MB.
You do not normally run this yourself: npm run voices does. It is not called pocket_tts.py
because that name would hide the pocket_tts package it imports.
"""

import json
import os
import sys


def calm(threads: int) -> None:
    """Keeps the CPU calm: PyTorch would otherwise take every core."""
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ.setdefault(var, str(threads))


def load(threads: int):
    """The model, the function that saves audio, and a function giving a voice's state (kept, once made)."""
    try:
        import soundfile as sf
        import torch
        from pocket_tts import TTSModel
    except ImportError as err:
        sys.exit(f"{err}. Run scripts/setup-voices.sh first, or point PIXELREEL_PYTHON at a Python that has pocket-tts and soundfile.")

    torch.set_num_threads(threads)
    model = TTSModel.load_model()
    states = {}

    def voice(name: str):
        if name not in states:
            try:
                states[name] = model.get_state_for_audio_prompt(name)
            except Exception as err:  # an unknown name, or a file to copy a voice from
                raise ValueError(f"Pocket TTS could not use the voice \"{name}\" ({err}). "
                                 "Pick one of its own voices, such as peter_yearsley, stuart_bell or charles.") from err
        return states[name]

    return model, sf, voice


def speak(job: dict, model, sf, voice, about: dict = {}) -> None:
    """Speaks a job's lines, printing a line (with `about` in it) as each WAV is written."""
    state = voice(job["voice"])
    for line in job["lines"]:
        samples = model.generate_audio(state, line["text"]).numpy()
        sf.write(line["wav"], samples, model.sample_rate)
        print(json.dumps({"wav": line["wav"], "seconds": round(len(samples) / model.sample_rate, 2), **about}), flush=True)


def serve(args: list) -> None:
    """Stays running: loads once, then speaks a job for each line of stdin."""
    def option(name: str, fallback: str) -> str:
        return args[args.index(name) + 1] if name in args else fallback

    threads = int(option("--threads", "2"))
    calm(threads)
    model, sf, voice = load(threads)
    try:
        voice(option("--voice", "peter_yearsley"))
    except ValueError as err:
        sys.exit(str(err))
    print(json.dumps({"ready": True}), flush=True)
    for text in sys.stdin:
        if not text.strip():
            continue
        about = {}
        try:
            job = json.loads(text)
            about = {"id": job.get("id")}
            speak(job, model, sf, voice, about)
            print(json.dumps({"done": True, **about}), flush=True)
        except Exception as err:  # this job failed; the next may not
            print(json.dumps({"error": str(err), **about}), flush=True)


def main() -> None:
    if "--serve" in sys.argv[1:]:
        serve(sys.argv[1:])
        return
    job = json.load(sys.stdin)
    threads = int(job.get("threads", 2))
    calm(threads)
    model, sf, voice = load(threads)
    try:
        speak(job, model, sf, voice)
    except ValueError as err:
        sys.exit(str(err))


if __name__ == "__main__":
    main()
