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
- `PIXELREEL_TRUST_PROXY=1` is on in the image, as most hosts put a proxy in front that adds
  the caller's address to `X-Forwarded-For`. Turn it off (`0`) if yours does not, or callers
  could pretend to be someone else to get round the rate limits; set it to `2` if two
  proxies are in front (a load balancer and the host's own, say). After the first request
  the log has a line starting `callers:` that says how many addresses arrived and whether
  that matches. If it does not, fix the setting: with it too low everyone looks like one
  caller and shares one allowance.
- `GET /health` answers `ok` once it is up.
- `PIXELREEL_LISTED=1` lets search engines list the website, for once Pixel Reel is open to
  everyone. Until then leave it off: every page asks them to keep out, which also keeps
  their robots from waking a sleeping copy.

## What the host needs

| | |
| --- | --- |
| Processor | 2 vCPUs. Pocket TTS records about 2.5 times faster than real time on 4; one job runs at a time. |
| Memory | 2 GB. The voice model and PyTorch take about 1 GB, which the service keeps loaded so reels start at once; a video job about 300 MB more. |
| Disk for `/data` | About 1 MB a reel (recordings), plus about 1.7 MB a minute for any video. 10 GB is thousands of reels. |
| Image | 2.1 GB as stored: PyTorch, the English voice model, and six more languages' models at 219 MB each. |
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
- `PIXELREEL_URL` is `https://pixelreel.pro`, so the links the service gives use it. The
  service's own address, `https://pixelreel-252679649337.europe-west1.run.app`, still answers.

Callers' addresses are kept out of the logs: the project's `_Default` log sink excludes Cloud
Run's request logs (`pixelreel-request-logs`), as the privacy page says. The image repository
keeps the latest two images.

### The address

Pixel Reel is at `https://pixelreel.pro`; the connector address to paste into Claude is
`https://pixelreel.pro/mcp`. `pixelreel.pro` and `www.pixelreel.pro` are Cloud Run domain
mappings, made like this (all done; for another domain, or to make them again). The domain
must be verified for the Google account that makes them:

1. In [Search Console](https://search.google.com/search-console), add a **Domain** property for
   `pixelreel.pro`. It gives a TXT record (`google-site-verification=...`); add it at the
   domain's DNS host, then press Verify.
2. Make the mappings (once verified, or Google refuses and they must be deleted and made
   again): `gcloud beta run domain-mappings create --service pixelreel --domain
   pixelreel.pro --region europe-west1` (and again for `www.pixelreel.pro`).
3. At the DNS host, point the names at Google, replacing any records already there for them:

   | Name | Type | Value |
   | --- | --- | --- |
   | `@` | A | `216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21` (four records) |
   | `@` | AAAA | `2001:4860:4802:32::15`, `2001:4860:4802:34::15`, `2001:4860:4802:36::15`, `2001:4860:4802:38::15` (four records) |
   | `www` | CNAME | `ghs.googlehosted.com.` |

   `gcloud beta run domain-mappings describe --domain pixelreel.pro --region europe-west1`
   lists the records Google wants, if they ever differ.
4. Google issues the certificate once the records are seen, usually within an hour.

### Other languages and narrators

On in the image. It is built with the voice models for French, German, Spanish, Italian,
Portuguese and Dutch (`ARG VOICE_LANGUAGES` in the `Dockerfile`, 219 MB each) and
with five more narrators' voices beside Peter's: Anna, Vera, Stuart, Charles and Paul
(`ARG VOICE_NAMES`, small files), and it switches them on itself (`ENV PIXELREEL_LANGUAGES`
and `PIXELREEL_NARRATORS`, at the end of the `Dockerfile`). See
[service.md](service.md#other-languages) for what has and has not been checked about how
they sound.

- To offer fewer, change both lines for it in the `Dockerfile` (what is built in, and what
  is switched on) and deploy. Keep the two in step: a language or narrator switched on
  without its model in the image cannot be recorded, as the image's model folder is not
  writable and nothing is downloaded when the service runs.
- To switch them off without a new image:
  `gcloud run services update pixelreel --region europe-west1 --project pixelreel-515501 --update-env-vars PIXELREEL_LANGUAGES=,PIXELREEL_NARRATORS=`.
- The voice kept loaded is the English one. A reel in another language loads that
  language's model for the reel, in a second process, so for its length the service holds
  two models.
- A narrator's voice is a file for each language, so the build fetches every narrator for
  every language, then loads each again with nothing allowed to be fetched
  (`scripts/setup-voices.sh`). A build with one missing stops there. The first image with
  the languages held only Peter's voice for them, so a French reel read by Anna could not
  be recorded; this check is what stops that happening again.

Measured on Cloud Run when they were switched on (22 November 2026, revision
`pixelreel-00019-g9r`, against the revision before):

| | Before | With six languages and five narrators |
| --- | --- | --- |
| Image, as stored | 1.14 GB | 2.14 GB |
| Container start | 1.8 to 2.9 seconds | 1.8 seconds |
| English voice loaded after start | 15.6 to 16.4 seconds | 14.5 seconds |
| Memory at rest, of 4 GiB | 18% | 21% |
| Memory while a French reel records | | 38% |
| English reel, six scenes: first line, playable, ready | | 7, 11 and 33 seconds |
| French reel, six scenes: first line, playable, ready | | 19, 38 and 51 seconds |

The models are only read when a reel in that language is recorded, so the service starts
no slower. A reel in another language waits about 12 seconds longer for its first line,
while its model loads.


### Switching on Make it right here

It has been on at pixelreel.pro since 22 November 2026, with the key in the secret
`pixelreel-claude-key`. This is how it was switched on, and how to do it anywhere else. To
let visitors without Claude have the service write a reel for them from what
they type, paste, drop or photograph (see [service.md](service.md#make-it-right-here) for
what that costs and how it is kept safe), put a Claude API key in Secret Manager and switch
it on. With the key in a file (here `~/.config/pixelreel/claude-key`), so that it is never
typed or shown:

```sh
tr -d '\r\n' < ~/.config/pixelreel/claude-key | gcloud secrets create pixelreel-claude-key --data-file=- --project pixelreel-515501
gcloud secrets add-iam-policy-binding pixelreel-claude-key --project pixelreel-515501 \
  --member serviceAccount:pixelreel-run@pixelreel-515501.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
gcloud run services update pixelreel --region europe-west1 --project pixelreel-515501 \
  --update-env-vars PIXELREEL_TRY=1 --update-secrets ANTHROPIC_API_KEY=pixelreel-claude-key:latest
```

A new key later is a new version of the same secret (`gcloud secrets versions add
pixelreel-claude-key --data-file=-`) and a redeploy. The model and the caps have defaults
(`claude-sonnet-5-5`, 5 an hour for each visitor, 30 a day for everyone); set
`PIXELREEL_TRY_MODEL`, `PIXELREEL_TRIES_PER_HOUR` or `PIXELREEL_TRIES_PER_DAY` the same way to
change them. What each reel took is in the logs: look for lines that start `try:`.

To switch it off again: `--update-env-vars PIXELREEL_TRY=0`.

### What it costs

Cloud Run bills an awake copy by the second, from the first request until it sleeps about
15 minutes after the last: about 2,000 vCPU-seconds a visit. The free allowance (240,000
vCPU-seconds and 450,000 GiB-seconds a month) covers about a hundred visits; each one after
that is about 4 US cents. The bucket, the image repository (about 25p) and the rest come to
well under a pound. A copy kept awake all month by steady traffic would cost about $110,
so watch the budget alert if it ever becomes popular: `--max-instances 1` caps it there.
