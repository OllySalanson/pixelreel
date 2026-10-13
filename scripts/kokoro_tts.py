"""Speak lines of text into WAV files with Kokoro, for scripts/voices.mjs.

Reads one JSON job from stdin:
  {"model": ".../kokoro-v1.0.onnx", "voices": ".../voices-v1.0.bin",
   "voice": "bm_george", "speed": 0.92, "lang": "en-gb", "threads": 2,
   "lines": [{"text": "Hello!", "wav": "/tmp/x.wav"}, ...]}
and prints one JSON line per finished WAV: {"wav": "...", "seconds": 3.4}.

Needs the kokoro-onnx and soundfile packages (scripts/setup-voices.sh installs them).
You do not normally run this yourself: npm run voices does.
"""

import json
import os
import sys


def main() -> None:
    job = json.load(sys.stdin)
    threads = str(int(job.get("threads", 2)))
    # keep the CPU calm: ONNX would otherwise take every core
    for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
        os.environ.setdefault(var, threads)

    try:
        import onnxruntime as ort
        import soundfile as sf
        from kokoro_onnx import Kokoro
    except ImportError as err:
        sys.exit(f"{err}. Run scripts/setup-voices.sh first, or point PIXELREEL_PYTHON at a Python that has kokoro-onnx and soundfile.")

    for key in ("model", "voices"):
        if not os.path.isfile(job[key]):
            sys.exit(f"Kokoro model file not found: {job[key]}. Run scripts/setup-voices.sh, or set KOKORO_HOME to the folder that has it.")

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(threads)
    opts.inter_op_num_threads = 1
    session = ort.InferenceSession(job["model"], opts, providers=["CPUExecutionProvider"])
    kokoro = Kokoro.from_session(session, job["voices"])

    for line in job["lines"]:
        samples, rate = kokoro.create(line["text"], voice=job["voice"], speed=float(job["speed"]), lang=job["lang"])
        sf.write(line["wav"], samples, rate)
        print(json.dumps({"wav": line["wav"], "seconds": round(len(samples) / rate, 2)}), flush=True)


if __name__ == "__main__":
    main()
