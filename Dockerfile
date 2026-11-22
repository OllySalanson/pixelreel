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
# VOICE_LANGUAGES names other languages for the narrator to read ("french spanish"): each adds about
# 190 MB, and is switched on when the service runs with PIXELREEL_LANGUAGES (docs/deploy.md)
ARG VOICE_LANGUAGES=""
# VOICE_NAMES names other narrators' voices ("anna stuart_bell"), switched on with PIXELREEL_NARRATORS
ARG VOICE_NAMES=""
COPY scripts/setup-voices.sh scripts/setup-voices.sh
RUN VOICE_LANGUAGES="$VOICE_LANGUAGES" VOICE_NAMES="$VOICE_NAMES" sh scripts/setup-voices.sh && chmod -R a+rX /opt/huggingface

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production PORT=8787 PIXELREEL_DATA=/data PIXELREEL_TRUST_PROXY=1 THREADS=2
USER node
EXPOSE 8787
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "service/main.mjs"]
