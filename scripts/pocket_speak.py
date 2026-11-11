"""Speak lines of text into WAV files with Pocket TTS, for scripts/voices.mjs.

Reads one JSON job from stdin:
  {"voice": "peter_yearsley", "threads": 2,
   "lines": [{"text": "Hello!", "wav": "/tmp/x.wav"}, ...]}
and prints one JSON line per finished WAV: {"wav": "...", "seconds": 3.4}.

Needs the pocket-tts and soundfile packages (scripts/setup-voices.sh installs them). The
model downloads itself the first time, about 220 MB.
You do not normally run this yourself: npm run voices does. It is not called pocket_tts.py
because that name would hide the pocket_tts package it imports.
"""

import json
import os
import sys


def main() -> None:
    job = json.load(sys.stdin)
    threads = int(job.get("threads", 2))
    # keep the CPU calm: PyTorch would otherwise take every core
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ.setdefault(var, str(threads))

    try:
        import soundfile as sf
        import torch
        from pocket_tts import TTSModel
    except ImportError as err:
        sys.exit(f"{err}. Run scripts/setup-voices.sh first, or point PIXELREEL_PYTHON at a Python that has pocket-tts and soundfile.")

    torch.set_num_threads(threads)
    model = TTSModel.load_model()
    try:
        voice = model.get_state_for_audio_prompt(job["voice"])
    except Exception as err:  # an unknown name, or a file to copy a voice from
        sys.exit(f"Pocket TTS could not use the voice \"{job['voice']}\" ({err}). "
                 "Pick one of its own voices, such as peter_yearsley, stuart_bell or charles.")

    for line in job["lines"]:
        samples = model.generate_audio(voice, line["text"]).numpy()
        sf.write(line["wav"], samples, model.sample_rate)
        print(json.dumps({"wav": line["wav"], "seconds": round(len(samples) / model.sample_rate, 2)}), flush=True)


if __name__ == "__main__":
    main()
