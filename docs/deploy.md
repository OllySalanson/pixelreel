# Putting the service online

The [service](service.md) runs anywhere a container runs. The `Dockerfile` holds all of it:
Node, ffmpeg, Python with Pocket TTS, and the voice model, so nothing downloads when it starts.

```sh
docker build -t pixelreel .
docker run -p 8787:8787 -e PIXELREEL_URL=https://reels.example -v pixelreel-data:/data pixelreel
```

- `PIXELREEL_URL` must be the public `https://` address people and Claude reach it at.
- `/data` is where reels are kept. Give it a disk that survives restarts, or reels vanish
  before their 30 days are up.
- `PIXELREEL_TRUST_PROXY=1` is on in the image, as most hosts put a proxy in front that sets
  `X-Forwarded-For`. Turn it off (`0`) if yours does not, or callers could pretend to be
  someone else to get round the rate limits.
- `GET /health` answers `ok` once it is up.

## What the host needs

| | |
| --- | --- |
| Processor | 2 vCPUs. Pocket TTS records about 2.5 times faster than real time on 4; one job runs at a time. |
| Memory | 2 GB. The voice model and PyTorch take about 1 GB; a video job about 300 MB more. |
| Disk for `/data` | About 1 MB a reel (recordings), plus about 1.7 MB a minute for any video. 10 GB is thousands of reels. |
| Image | About 2 GB, mostly PyTorch and the model. |
| HTTPS | Claude only connects to `https://` addresses. |

## Choosing a host

Choosing a host is a decision to make once, with the costs in front of you. Whichever it is:

- **A small server of your own** (any VPS): run the image with a volume and a reverse proxy
  for HTTPS (Caddy does it in two lines). Fixed monthly cost, and you look after it.
- **A platform with volumes** (Fly.io, Railway, Render): point it at the `Dockerfile`, attach
  a volume at `/data`, set `PIXELREEL_URL`.
- **A platform without disks** (Cloud Run): it scales to nothing when idle, but its disk does
  not last. Reels need to go in an object store instead. `service/store.mjs` is the one place
  to change: an S3-style store with the same `put`, `get`, `size`, `list`, `folders` and
  `remove`.

The service keeps its queue in memory, so run one copy of it. One copy records one reel at a
time; for more at once, run more copies behind a shared object store and a shared queue (a
change for later, when there is the traffic for it).

## Not done yet

- The image has not been built and run here: building it fetches about 1 GB (PyTorch and the
  voice model). Build it on the host, or anywhere with room, before relying on it.
- Nothing is deployed. Where it runs, and its address, are for Olly to choose.
