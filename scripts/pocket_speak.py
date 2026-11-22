"""Speak lines of text into WAV files with Pocket TTS, for scripts/voices.mjs.

Reads one JSON job from stdin:
  {"voice": "peter_yearsley", "threads": 2,
   "lines": [{"text": "Hello!", "wav": "/tmp/x.wav"}, ...]}
and prints one JSON line per finished WAV: {"wav": "...", "seconds": 3.4}. A job may name
the "language" its words are in (french, german, spanish, italian, portuguese, dutch): each
is a model of its own, which downloads itself the first time, about 220 MB.

With --serve it stays running, for the service (service/voice.mjs): it loads the model and
the voice named by --voice once, prints {"ready": true}, then takes a job a line for as
long as stdin stays open, ending each with {"done": true}, or {"error": "..."} if that job
could not be spoken. A job's "id" comes back on every line about it, so its lines are
never taken for another's. Loading takes far longer than speaking a line, so a reel recorded
this way starts being spoken at once. The English model stays loaded for good. Another
language's is loaded the first time a job asks for it, which it says with
{"loaded": "french", "seconds": 9.1}, and is kept for the next such job; --keep says how
many other languages are held at once (2 unless told), the one longest unused making way.
If it comes to hold more than --most MB all the same (2600 unless told), it says
{"full": true} after the job in hand and stops, for the service to start it afresh.

Needs the pocket-tts and soundfile packages (scripts/setup-voices.sh installs them). The
model downloads itself the first time, about 220 MB.
You do not normally run this yourself: npm run voices does. It is not called pocket_tts.py
because that name would hide the pocket_tts package it imports.
"""

import gc
import json
import os
import sys
import time


def calm(threads: int) -> None:
    """Keeps the CPU calm: PyTorch would otherwise take every core."""
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ.setdefault(var, str(threads))


def load(threads: int, language=None):
    """The model (for `language`, or English), the function that saves audio, and a function giving a voice's state (kept, once made)."""
    try:
        import soundfile as sf
        import torch
        from pocket_tts import TTSModel
    except ImportError as err:
        sys.exit(f"{err}. Run scripts/setup-voices.sh first, or point PIXELREEL_PYTHON at a Python that has pocket-tts and soundfile.")

    torch.set_num_threads(threads)
    try:
        model = TTSModel.load_model(language=language) if language and language != "english" else TTSModel.load_model()
    except Exception as err:  # a language it does not speak, or a model that could not be fetched
        raise ValueError(f"Pocket TTS could not load its {language or 'English'} model ({err}).") from err
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


def release() -> None:
    """Gives the memory of models let go back to the machine, where it can be (glibc keeps it otherwise)."""
    gc.collect()
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass  # not glibc: the memory is reused all the same


def holds() -> int:
    """How much memory this is holding, in MB, or 0 where that cannot be read."""
    try:
        with open("/proc/self/statm") as statm:
            return int(statm.read().split()[1]) * os.sysconf("SC_PAGE_SIZE") // (1024 * 1024)
    except (OSError, ValueError, IndexError):
        return 0


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
    keep = max(1, int(option("--keep", "2")))
    most = int(option("--most", "2600"))
    calm(threads)
    try:
        english = load(threads)
        english[2](option("--voice", "peter_yearsley"))
    except ValueError as err:
        sys.exit(str(err))
    others = {}  # the other languages' models, the one used longest ago first

    def loaded(language: str, about: dict):
        """The model for `language`, loading it if it is not held, and letting the one longest unused go to make room."""
        if language == "english":
            return english
        if language in others:
            others[language] = others.pop(language)  # used just now
            return others[language]
        while len(others) >= keep:
            del others[next(iter(others))]
        release()
        began = time.monotonic()
        others[language] = load(threads, language)
        print(json.dumps({"loaded": language, "seconds": round(time.monotonic() - began, 1), "holds": holds(), **about}), flush=True)
        return others[language]

    print(json.dumps({"ready": True}), flush=True)
    for text in sys.stdin:
        if not text.strip():
            continue
        about = {}
        try:
            job = json.loads(text)
            about = {"id": job.get("id")}
            # not kept in names of this loop's own: a model let go must have nothing still holding it
            speak(job, *loaded(job.get("language") or "english", about), about)
            print(json.dumps({"done": True, **about}), flush=True)
        except Exception as err:  # this job failed; the next may not
            print(json.dumps({"error": str(err), **about}), flush=True)
        if holds() > most:  # models let go do not always give their memory back: start afresh rather than grow
            print(json.dumps({"full": True, "holds": holds()}), flush=True)
            return


def main() -> None:
    if "--serve" in sys.argv[1:]:
        serve(sys.argv[1:])
        return
    job = json.load(sys.stdin)
    threads = int(job.get("threads", 2))
    calm(threads)
    try:
        model, sf, voice = load(threads, job.get("language"))
        speak(job, model, sf, voice)
    except ValueError as err:
        sys.exit(str(err))


if __name__ == "__main__":
    main()
