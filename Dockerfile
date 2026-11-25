# The Pixel Reel service in one image: Node for the connector, the player and the videos,
# Python with Pocket TTS for the voice (model included, so nothing downloads at run time),
# and ffmpeg for sound and video. See docs/deploy.md.
#   docker build -t pixelreel .
#   docker run -p 8787:8787 -e PIXELREEL_URL=https://reels.example -v pixelreel-data:/data pixelreel
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HF_HOME=/opt/huggingface

# the voice first: it changes least and takes longest (PyTorch for the CPU, Pocket TTS, the model)
# VOICE_LANGUAGES names the other languages the narrator reads: each is a model of about 220 MB.
# VOICE_NAMES names the other narrators' voices (small files). Both are switched on further down,
# with PIXELREEL_LANGUAGES and PIXELREEL_NARRATORS: keep the two in step (docs/deploy.md).
ARG VOICE_LANGUAGES="french german spanish italian portuguese dutch"
ARG VOICE_NAMES="anna vera stuart_bell charles paul"
COPY scripts/setup-voices.sh scripts/setup-voices.sh
RUN VOICE_LANGUAGES="$VOICE_LANGUAGES" VOICE_NAMES="$VOICE_NAMES" sh scripts/setup-voices.sh && chmod -R a+rX /opt/huggingface

# My notes' microphone, for browsers that cannot write down what is said themselves (Brave,
# Firefox): faster-whisper and its base.en model, about 150 MB (scripts/hear.py, service/hear.mjs)
RUN .venv/bin/python -m pip install --quiet "faster-whisper>=1.1,<2" \
  && .venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('base.en', device='cpu', compute_type='int8')" \
  && chmod -R a+rX /opt/huggingface

# vendor/ holds the packed copy of Message in a Bottle that package.json names (npm run bottle-update)
COPY package.json package-lock.json ./
COPY vendor vendor
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production PORT=8787 PIXELREEL_DATA=/data PIXELREEL_TRUST_PROXY=1 THREADS=2
# what the image can read, and in whose voice, is what it offers: the models and voices built in above
ENV PIXELREEL_LANGUAGES=french,german,spanish,italian,portuguese,dutch PIXELREEL_NARRATORS=anna,vera,stuart,charles,paul PIXELREEL_HEAR=1
USER node
EXPOSE 8787
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "service/main.mjs"]
