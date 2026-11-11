#!/usr/bin/env sh
# Gets everything npm run voices needs to record narration:
#   .venv/    a Python environment with Pocket TTS (and PyTorch for the CPU) and soundfile
#   the Pocket TTS model and its default voice (about 220 MB, downloaded once into the
#   Hugging Face cache, ~/.cache/huggingface)
# With "kokoro" (scripts/setup-voices.sh kokoro) it also gets Kokoro, the engine the
# example reels were recorded with: kokoro-onnx, and its model files (about 350 MB) in models/.
# Needs Python 3.10 to 3.13 and curl. Set KOKORO_HOME to keep the Kokoro models somewhere else.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MODELS=${KOKORO_HOME:-"$ROOT/models"}
PYTHON=${PYTHON:-python3}
RELEASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
PIP="$ROOT/.venv/bin/python -m pip install --quiet"

case "${1:-}" in
  "") KOKORO=no ;;
  kokoro) KOKORO=yes ;;
  *) echo "Usage: scripts/setup-voices.sh [kokoro]" >&2; exit 2 ;;
esac

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  echo "Making a Python environment in .venv"
  "$PYTHON" -m venv "$ROOT/.venv"
fi
"$ROOT/.venv/bin/python" -m pip install --quiet --upgrade pip

if [ "$(uname -s)" = Linux ]; then
  # PyPI's PyTorch for Linux brings gigabytes of GPU libraries; Pocket TTS only needs the CPU one
  echo "Installing PyTorch for the CPU"
  $PIP --index-url https://download.pytorch.org/whl/cpu "torch>=2.5"
fi
echo "Installing Pocket TTS and soundfile"
$PIP "pocket-tts>=4,<5" "soundfile>=0.12"
echo "Getting the Pocket TTS model and the peter_yearsley voice"
"$ROOT/.venv/bin/python" -c "from pocket_tts import TTSModel; TTSModel.load_model().get_state_for_audio_prompt('peter_yearsley')"

if [ "$KOKORO" = yes ]; then
  echo "Installing kokoro-onnx"
  $PIP "kokoro-onnx>=0.4,<1"
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
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Note: ffmpeg is not installed. npm run voices needs it to make MP3s (sudo apt install ffmpeg, or brew install ffmpeg)."
fi
echo "Ready. Record a reel with: npm run voices my-reel"
