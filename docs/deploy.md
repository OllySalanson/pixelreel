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
  not last, so reels go in a bucket instead (below). This is where Pixel Reel runs.

The service keeps its queue in memory, so run one copy of it. One copy records one reel at a
time; for more at once, run more copies behind a shared object store and a shared queue (a
change for later, when there is the traffic for it).

## Keeping reels in a bucket

Set `PIXELREEL_S3_BUCKET` and the service keeps reels in an S3-style bucket
(`S3Store` in `service/store.mjs`) instead of `/data`:

| Setting | |
| --- | --- |
| `PIXELREEL_S3_ENDPOINT` | `https://storage.googleapis.com` for Google Cloud Storage, `https://<account id>.r2.cloudflarestorage.com` for Cloudflare R2. |
| `PIXELREEL_S3_BUCKET` | The bucket's name. |
| `PIXELREEL_S3_REGION` | `auto` (the default) suits both. |
| `PIXELREEL_S3_KEY_ID`, `PIXELREEL_S3_SECRET` | An HMAC key for a Cloud Storage service account, or an R2 API token's key pair. |

Give the bucket a rule that deletes objects 30 days old. The service deletes expired reels
itself every hour, but only while it is awake; the rule makes sure of it when nobody calls.
Moving to R2 is a change of these settings (and copying any reels still wanted across).

## On Google Cloud Run

Pixel Reel runs as the Cloud Run service `pixelreel` in project `pixelreel-515501`, region
`europe-west1` (the nearest that maps custom domains). Reels are in the bucket
`pixelreel-515501-reels` (30-day delete rule, no public access), reached with an HMAC key of
the service account `pixelreel-run`, whose secret is the Secret Manager secret
`pixelreel-s3-secret`. To deploy a new version, from a checkout:

```sh
gcloud run deploy pixelreel --source . --region europe-west1 --project pixelreel-515501
```

That builds the `Dockerfile` with Cloud Build and keeps every other setting. The settings it
was first made with:

```sh
gcloud run deploy pixelreel --source . --region europe-west1 --project pixelreel-515501 \
  --service-account pixelreel-run@pixelreel-515501.iam.gserviceaccount.com \
  --allow-unauthenticated --cpu 2 --memory 4Gi --no-cpu-throttling \
  --min-instances 0 --max-instances 1 --concurrency 40 --timeout 300 \
  --execution-environment gen2 --cpu-boost \
  --set-env-vars PIXELREEL_URL=https://pixelreel.pro,PIXELREEL_S3_ENDPOINT=https://storage.googleapis.com,PIXELREEL_S3_BUCKET=pixelreel-515501-reels,PIXELREEL_S3_KEY_ID=<hmac access id> \
  --set-secrets PIXELREEL_S3_SECRET=pixelreel-s3-secret:latest
```

Why these:

- `--no-cpu-throttling`: the voice and video are made in the background after the request
  that asked for them has been answered. Without it Cloud Run stops the processor between
  requests and jobs stall. It also means an awake copy is paid for until Cloud Run puts it to
  sleep, about 15 minutes after the last request.
- `--max-instances 1`: the queue is in memory, so one copy (see above).
- `--memory 4Gi`: the voice model needs about 1.3 GB, and a Cloud Run copy's `/tmp`, where
  jobs work, is in memory too.
- The custom domain is a Cloud Run domain mapping (`gcloud beta run domain-mappings`), which
  needs the domain verified for the Google account first (`gcloud domains verify`).
