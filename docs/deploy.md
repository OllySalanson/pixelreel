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
| Memory | 2 GB. The voice model and PyTorch take about 1 GB, which the service keeps loaded so reels start at once; a video job about 300 MB more; My notes' Whisper model about 300 MB while someone speaks (it is stopped after 15 minutes unused). |
| Disk for `/data` | About 1 MB a reel (recordings), plus about 1.7 MB a minute for any video. 10 GB is thousands of reels. |
| Image | 2.3 GB as stored: PyTorch, the English voice model, and six more languages' models at 219 MB each. |
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

Give the bucket a rule that deletes objects under `reels/` 30 days old. The service deletes
expired reels itself every hour, but only while it is awake; the rule makes sure of it when
nobody calls. Keep the rule to `reels/`: Message in a Bottle keeps its sites, the people on
their lists and their keys under `bottles/`, and a rule for the whole bucket would delete
those, and every client's link with them, after 30 days.
Moving to R2 is a change of these settings (and copying any reels still wanted across).

## On Google Cloud Run

Pixel Reel runs as the Cloud Run service `pixelreel` in project `pixelreel-515501`, region
`europe-west1` (the nearest that maps custom domains). Reels are in the bucket
`pixelreel-515501-reels` (30-day delete rule for `reels/`, no public access), reached with an HMAC key of
the service account `pixelreel-run`, whose secret is the Secret Manager secret
`pixelreel-s3-secret`. To deploy a new version, from a clean checkout:

```sh
npm run deploy                      # or: npm run deploy -- --update-env-vars X=1
```

That backs up Message in a Bottle's notes first, runs
`gcloud run deploy pixelreel --source . --region europe-west1 --project pixelreel-515501 --quiet`
(and any settings given after `--`), and checks afterwards that the new version still lists every
note (see "Keeping the notes safe", below). Deploy that way, not with `gcloud run deploy` on its
own. It builds the `Dockerfile` with Cloud Build and keeps every other setting. The settings it
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
- The English model is kept loaded for good, about 0.8 GB. Another language's model is
  loaded into the same Python the first time a reel is in it and kept for the next, two
  at once unless `PIXELREEL_KEEP_LANGUAGES` says otherwise, at about 450 MB each: so the
  voice holds up to about 1.7 GB of the 4 GiB. Measured on a development machine, memory
  stayed level over seven changes of language. If the voice ever comes to hold more than
  2.6 GB it stops after the reel in hand and is started afresh, and the log says so.
- A narrator's voice is a file for each language, so the build fetches every narrator for
  every language, then loads each again with nothing allowed to be fetched
  (`scripts/setup-voices.sh`). A build with one missing stops there. The first image with
  the languages held only Peter's voice for them, so a French reel read by Anna could not
  be recorded; this check is what stops that happening again.

Measured on Cloud Run when they were switched on (22 November 2026, revision
`pixelreel-00019-g9r`, against the revision before):

| | Before | With six languages and five narrators |
| --- | --- | --- |
| Image, as stored | 1.14 GB | 2.14 GB (2.32 GB once every narrator's voice was built in for every language) |
| Container start | 1.8 to 2.9 seconds | 1.8 seconds |
| English voice loaded after start | 15.6 to 16.4 seconds | 14.5 seconds |
| Memory at rest, of 4 GiB | 18% | 21% |
| Memory while a French reel records | | 38% |
| English reel, six scenes: first line, playable, ready | | 7, 11 and 33 seconds |
| French reel, six scenes: first line, playable, ready | | 19, 38 and 51 seconds |

Since then the loaded voice holds other languages too. Measured on Cloud Run on
22 November 2026, revision `pixelreel-00029-7v2`, with a seven-scene French reel of 39
seconds, against the same reel on the revision before:

| | Model loaded for each reel | Held by the loaded voice |
| --- | --- | --- |
| French model loaded | each reel, in a second Python | once, in 2.8 seconds |
| The voice holds, with English and French | | 1228 MB |
| First French reel: first line, playable, ready | 14, 27 and 47 seconds | 12, 25 and 51 seconds |
| The next French reel: first line, playable, ready | 13, 25 and 45 seconds | 8, 12 and 45 seconds |

The first reel in a language still waits for its model and that narrator's voice in it;
the ones after start as soon as an English reel does.

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

### Counting visits

The site counts its visits with Google Analytics (docs/service.md, "Counting visits"): the
property "Pixel Reel" in Olly's Analytics account (Niches), web stream `https://pixelreel.pro`.

```sh
npm run deploy -- --update-env-vars PIXELREEL_ANALYTICS=G-MJV7K1QL78
```

`PIXELREEL_ANALYTICS=` (empty) switches it off, and the pages go back to loading nothing from
anywhere else.

### Message in a Bottle

The note button (Message in a Bottle, a package of its own in the private repository
[OllySalanson/message-in-a-bottle](https://github.com/OllySalanson/message-in-a-bottle), [its README](https://github.com/OllySalanson/message-in-a-bottle#readme))
is built into the image from the packed copy in `vendor/` that `package.json` names, so the
build never needs to reach a private repository. To take a new version of it, tag it there and
run `npm run bottle-update` (which clones it with your own git sign-in, runs its checks, and
remakes the copy), then commit `vendor/`, `package.json` and `package-lock.json`.

It is on when the service has its two
keys: `PIXELREEL_BOTTLE_KEY`, Olly's own key (his link is `https://pixelreel.pro/#bottle=<key>`,
after `#` so that no request log ever holds it,
and with it in his browser `https://pixelreel.pro/bottle/admin` opens the page of queues), and
`PIXELREEL_BOTTLE_READER`, the admin key, which `npm run bottles` uses to add sites and people
and work through the notes. Both are Secret Manager secrets, made so that neither is typed or
shown:

```sh
for name in pixelreel-bottle-key pixelreel-bottle-reader; do
  openssl rand -hex 24 | tr -d '\n' | gcloud secrets create $name --data-file=- --project pixelreel-515501
  gcloud secrets add-iam-policy-binding $name --project pixelreel-515501 \
    --member serviceAccount:pixelreel-run@pixelreel-515501.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
done
gcloud run services update pixelreel --region europe-west1 --project pixelreel-515501 \
  --update-secrets PIXELREEL_BOTTLE_KEY=pixelreel-bottle-key:latest,PIXELREEL_BOTTLE_READER=pixelreel-bottle-reader:latest
```

Olly's own hosting has a Message in a Bottle service of its own too, at
`https://ollysalanson.com/bottle` (a Node app on his NameHero hosting, keeping its notes in a
folder there), ready for his client previews' sites; until a site moves there (`bottles site move`),
its notes stay here. Its sites' Speak uses this service's `/hear`, so set
`--update-env-vars PIXELREEL_HEAR_FOR=https://ollysalanson.com` (docs/service.md, "Who may ask").

A person on a site's list can also send suggestions through Claude: `npm run bottles -- person
claude <site> <person>` prints an Add to Claude link to send them (one press of Add, once it
opens), and the address in it (`https://pixelreel.pro/bottle/mcp/<key>`), the package's README,
"In Claude". The key is in
the address, so it is in Cloud Run's request logs; turning the person off ends it.

A live site with no email set up can have a word instead (`npm run bottles -- site word <site>
<word>`): its people go to `<site>/suggest` (a page of the site's own with the line's
`data-suggest`), give the word and their name, and have the button for a year. Their suggestions
wait under Waiting on the page of queues until they are approved there once (or with `npm run
bottles -- person approve <site> <person>`); the package's README, "A live site's word".

Olly's key is `gcloud secrets versions access latest --secret pixelreel-bottle-key --project
pixelreel-515501`. To change it, add a new version of `pixelreel-bottle-key` and redeploy;
browsers holding the old one forget it. Everyone else's keys are kept (by their hash) in the
bucket under `bottles/`, and turned off with `npm run bottles -- person off`.

Before the first client is added, the bucket's delete rule must be kept to `reels/` (see
above), or their links stop working after 30 days:

```sh
printf '%s' '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30,"matchesPrefix":["reels/"]}}]}' > lifecycle.json
gcloud storage buckets update gs://pixelreel-515501-reels --lifecycle-file=lifecycle.json --project pixelreel-515501
```

#### Keeping the notes safe

The notes are what clients have told us, and are kept for good: nothing in Pixel Reel or the
bottle deletes one. Everything of the bottle's is in the reels' bucket under `bottles/` (each
note's `note.json` and `shot.jpg`, the sites and people, keys and codes), which the 30-day rule
never touches. A new version or revision of the service reads the same bucket, so a deploy moves
nothing.

The client sites' notes (Hoops and Dreams, The Elevation Project) have one home of their own:
the Bottle at `https://ollysalanson.com/bottle`, on NameHero (Olly, 25 Nov 2026: preview sites
use Bottle at ollysalanson.com/bottle, not hosted on Pixel Reel). It runs the same package
(`~/bottle-app`, started by the host's Node from `app.cjs`, its settings in `settings.env`
beside it) and keeps its notes in `~/bottle-data/bottles`, outside the web folder. There is no
shell there, only SFTP (`~/.ssh/namehero_deploy`), so a new version is put there by uploading
the unpacked package into `bottle-app/node_modules/message-in-a-bottle` (keeping the old one
aside) and then `bottle-app/tmp/restart.txt`. Pixel Reel keeps only its own site's notes, and
passes on anything that still comes to it for the client sites (`bottles site move`, below).
Everything here covers both places: `--of pixelreel` (the default) or `--of namehero`.

To make sure:

- **Backups**, in the bucket `pixelreel-515501-bottle-backups` (europe-west1, private), a folder
  each, named by when it was made: `20261127-093000/bottles/...` for Pixel Reel's,
  `namehero/20261127-093000/bottles/...` for NameHero's (fetched by SFTP). `npm run bottles-safe --
  backup [--of namehero]` makes one and checks it holds every note; `npm run deploy` makes one of
  Pixel Reel's before every deploy. `npm run bottles-safe -- list [--of namehero]` lists them.
  Make one of NameHero's before changing anything there.
- **A check that nothing has gone**: every note in the last backup must still be listed by the
  service. `npm run bottles-safe -- check` says `LOST: ...` for any that is not, with the command
  that puts it back. `npm run deploy` checks that the new version lists every note the old one
  did, and stops before deploying if a note is already lost.
- **Once a day**: `npm run bottles-safe -- daily` (run every hour or so by a watch) does both
  places: a backup when the last is a day old, and the check; it prints only when a note is lost
  or a check could not be made (each place on its own, so one that cannot be reached is said and
  the other still looked at), never nothing when something is wrong. It needs a gcloud signed in
  to the project and the NameHero SFTP key; each gcloud call takes about a minute from Olly's PC,
  so a run takes a few minutes.
- **Both places the same**, after copying a site from one to the other: `npm run bottles-safe --
  compare <site> [<site> ...]` says, for each site, how many notes each place holds and every
  note only one has or whose state differs.
- **Putting back**: `npm run bottles-safe -- restore <backup> [--of namehero]` copies back every
  file of that backup the place no longer has; it never replaces or deletes anything there, so a note marked
  since is kept as it is now. Between backups, the bucket keeps a deleted or replaced file for 7
  days (soft delete): `gcloud storage ls --soft-deleted gs://pixelreel-515501-reels/bottles/<id>/`
  and `gcloud storage restore` bring one back.

On the page, a note is kept in the visitor's browser until the service says it has it, so a
deploy (or the service asleep, or a dropped connection) while someone sends one only delays it
(the package's README, "A note is never lost on its way").

**One service per site.** A site's notes must be taken by one service only. If another Bottle
service takes over a site, copy the site's `bottles/` files across, then on the old one
`npm run bottles -- site move <site> <the new service's endpoint>`: everything that site's pages
ask is passed on to the new one from then on, and nothing is kept here (the package's README,
"Moving a site to another service").

#### Its email, through Resend

The invitations, sign-in links, news of what came of each person's notes, and word to Olly of
new notes go out through
[Resend](https://resend.com), on Olly's personal account (not Renew's). Until the service has
both `PIXELREEL_RESEND_KEY` and `PIXELREEL_BOTTLE_MAIL_FROM`, it sends nothing and keeps each
email in its outbox (`npm run bottles -- outbox`); its log says which when it starts. To set it up:

1. Make a personal Resend account and add the domain the emails will come from (pixelreel.pro,
   say) under Domains. Add the DNS records Resend shows for it where that domain's DNS is kept,
   and wait until Resend says the domain is Verified.
2. Under API Keys, make a key with **Sending access** only, for that domain alone. It is shown
   once: copy it.
3. Keep it as the secret `pixelreel-resend-key` (pasted at the prompt, so it is in no file or
   history), and give the service the key and the address to send from:

   ```sh
   read -rs KEY && printf '%s' "$KEY" | gcloud secrets create pixelreel-resend-key --data-file=- --project pixelreel-515501 && unset KEY
   gcloud secrets add-iam-policy-binding pixelreel-resend-key --project pixelreel-515501 \
     --member serviceAccount:pixelreel-run@pixelreel-515501.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
   gcloud run services update pixelreel --region europe-west1 --project pixelreel-515501 \
     --update-secrets PIXELREEL_RESEND_KEY=pixelreel-resend-key:latest \
     --update-env-vars "PIXELREEL_BOTTLE_MAIL_FROM=Olly <notes@pixelreel.pro>,PIXELREEL_BOTTLE_REPLY_TO=<your own address>"
   ```

   The from address must be on the verified domain. `PIXELREEL_BOTTLE_REPLY_TO` is your own
   address: pixelreel.pro takes no email (it has no MX record), so without it a client's reply
   bounces. With it, every email ends "Reply to this email to reach Olly" and replies come to
   you, and so does word of new notes. Then send yourself a preview of the invitation
   (`npm run bottles -- invite <site> <person> --to <your address>`, which carries no working
   link) to see it arrive. When emails start to go, the outbox kept until then is emptied.
4. So that `npm run bottles -- people <site>` shows an email that bounced: in Resend, under
   Webhooks, add an endpoint `https://pixelreel.pro/bottle/resend` for `email.bounced`,
   `email.complained` and `email.delivered`, and keep its signing secret (`whsec_...`) as the
   secret `pixelreel-resend-webhook` the same way, given to the service as
   `--update-secrets PIXELREEL_RESEND_WEBHOOK_SECRET=pixelreel-resend-webhook:latest`.

If replies should one day land in an inbox at pixelreel.pro itself (`notes@pixelreel.pro`), that
needs mail hosting for the domain (its MX records, from a provider such as Fastmail or Google
Workspace, or Cloudflare Email Routing to forward to your own address); then set
`PIXELREEL_BOTTLE_REPLY_TO` to it, or leave it unset.

To stop sending again, `--remove-secrets PIXELREEL_RESEND_KEY`: the emails go back to the outbox.

### What it costs

Cloud Run bills an awake copy by the second, from the first request until it sleeps about
15 minutes after the last: about 2,000 vCPU-seconds a visit. The free allowance (240,000
vCPU-seconds and 450,000 GiB-seconds a month) covers about a hundred visits; each one after
that is about 4 US cents. The bucket, the image repository (about 25p) and the rest come to
well under a pound. A copy kept awake all month by steady traffic would cost about $110,
so watch the budget alert if it ever becomes popular: `--max-instances 1` caps it there.
