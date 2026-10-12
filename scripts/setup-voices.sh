#!/usr/bin/env sh
# Gets everything npm run voices needs to record narration with Kokoro:
#   .venv/    a Python environment with kokoro-onnx and soundfile
#   models/   the Kokoro v1.0 model files (about 350 MB, downloaded once)
# Needs Python 3.10 to 3.13 and curl. Set KOKORO_HOME to keep the models somewhere else.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MODELS=${KOKORO_HOME:-"$ROOT/models"}
PYTHON=${PYTHON:-python3}
RELEASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  echo "Making a Python environment in .venv"
  "$PYTHON" -m venv "$ROOT/.venv"
fi
echo "Installing kokoro-onnx and soundfile"
"$ROOT/.venv/bin/python" -m pip install --quiet --upgrade pip
"$ROOT/.venv/bin/python" -m pip install --quiet "kokoro-onnx>=0.4,<1" "soundfile>=0.12"

mkdir -p "$MODELS"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ -s "$MODELS/$f" ]; then
    echo "Already have $f"
  else
    echo "Downloading $f"
    curl -fL --progress-bar -o "$MODELS/$f.part" "$RELEASE/$f"
    mv "$MODELS/$f.part" "$MODELS/$f"
  fi
done

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Note: ffmpeg is not installed. npm run voices needs it to make MP3s (sudo apt install ffmpeg, or brew install ffmpeg)."
fi
echo "Ready. Record a reel with: npm run voices what-is-pixelreel"
