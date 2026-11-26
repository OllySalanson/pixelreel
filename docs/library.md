# The library, and how it grows

The stage (`src/stage.js`) draws its people, things and places from the library
(`src/library.js`): people who take any skin and hair and wear what says what they do, about
ninety things, and sixteen places. `npm run library -- sheet` draws all of it on one page.

## Every day: the day book

Every reel made, by the connector or the website, gets a line in the day book
(`service/daybook.mjs`, kept under `daybook/` in the reels' store): its title cut to a few
words, how many scenes and of what kind, which drawings it used, what it wished the library had,
and what the critic made of it. Never what was said, nor anything the visitor gave.

The day's summary says how many reels were made, which had the right drawings (nothing wished
for, nothing drawn by hand, nothing the critic could not mend), and the drawings to make, most
wanted first. Whoever holds the admin key (`PIXELREEL_BOTTLE_READER`) reads it:

    curl -H "Authorization: Bearer $KEY" https://pixelreel.pro/day            # today, as a page
    curl -H "Authorization: Bearer $KEY" https://pixelreel.pro/day/2026-11-26.json
    curl -H "Authorization: Bearer $KEY" https://pixelreel.pro/day/wanted?days=7
    curl -X POST -H "Authorization: Bearer $KEY" https://pixelreel.pro/day/send   # email it, once

The key is never taken from the address, which is kept in logs. The service emails the summary
to Olly itself each evening after 21:00 UTC once it can send email: that needs
`PIXELREEL_RESEND_KEY` and `PIXELREEL_BOTTLE_MAIL_FROM` (a Resend account with pixelreel.pro as
its sending domain) and `PIXELREEL_BOTTLE_REPLY_TO`, Olly's address. None of these were set on
26 Nov 2026, so until then firstmate fetches `/day` each evening and passes it on. The service
sleeps when nobody uses it, so a schedule calling `POST /day/send` is surer than its own clock.

## Every week: the sheet

1. `npm run library -- wanted` lists what the reels wished for over the last week.
2. `ANTHROPIC_API_KEY=... npm run library -- week` has Opus draw the most wanted things (eight at
   most) in the library's style. A second Claude is shown each drawing without its name and says
   what it sees; one it does not know is outlined in orange on the sheet. It writes
   `library-week.json` and `library-week.html`. About 4 US cents a drawing.
3. Open the sheet in Brave for Olly. He says yes, or gives the names to leave out or draw again.
4. `npm run library -- add library-week.json --skip violin` writes the drawings said yes to into
   `src/library.js`. Then `npm run skill`, the tests, a pull request, and a deploy: the next reels
   can use them, and Claude is told of them by the guide, which is built from the library.

`--names "a,b"` draws names given by hand instead, such as something drawn well for one of
firstmate's own reels.
