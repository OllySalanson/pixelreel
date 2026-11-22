# The website

The website at the service's own address ([pixelreel.pro](https://pixelreel.pro)): what Pixel
Reel is, how to add it to Claude, the press kit, and privacy, terms and credits. The
[service](../service.md) serves it, and everything it shows lives in [`site/`](../../site).

- [Who it is built for](#who-it-is-built-for)
- [How it fits together](#how-it-fits-together)
- [Changing it](#changing-it)
- [The reels it plays](#the-reels-it-plays)
- [Design log](#design-log)

## Who it is built for

People who find reading hard work. Every choice follows from that:

- **Letters.** Lexend, large (20px, 18px on a phone), with open spacing and lines no longer
  than about 60 characters. Never justified, never in italics, never all in capitals for a
  sentence.
- **Words.** Short sentences in everyday words, a few to a section. No walls of text.
- **Paper.** Dark ink on cream rather than black on white, which dazzles some readers.
  Words never sit on a pattern or a picture: even the stars keep clear of them.
- **Buttons.** Every main thing to do is a big button that says what it does.
- **Make it comfy.** A panel on every page changes the letters (Lexend, Atkinson
  Hyperlegible Next or OpenDyslexic), their size and spacing, the colour of the paper, and
  whether pictures move. It is kept on the reader's device only.
- **Watch instead.** Every part of the home page has a "Make a pixel reel about this" button
  that plays a reel of that part, made earlier. "Watch this whole page" plays them all.
- **Calm.** Sound only ever starts on a press. Pictures hold still for anyone whose device
  asks for less motion, or who chooses Still.

Pixel art is for pictures; words are always in plain letters. One pixel of the page's pixel
art is `--u` (4px) wide everywhere, so buttons, borders, icons and scenery sit on one grid.

The voice is Peter's: warm, plain, British, a little cheeky. Plain dashes only.

## How it fits together

| File | Does |
| --- | --- |
| `site/layout.html` | The shell every page shares: the bar across the top, the foot, Make it comfy and the theatre. |
| `site/pages/*.html`, `*.md` | A page each. The comment at the top holds its `title` and `description`. Plain pages are Markdown. `reel.html` is the page every shared reel is watched on (`/r/<id>`). |
| `site/css/site.css` | The whole look. |
| `site/js/` | `main.js` wakes the page up; `player.js` is the player; `theatre.js` plays a reel over the page; `shots.js` draws reel pictures as illustrations; `scenery.js` and `landscape.js` draw the night scenes; `comfort.js` and `boot.js` are Make it comfy; `maker.js` writes what to say to Claude; `watch.js` is the page a shared reel is watched on; `sprites.js` is the site's own pixel art. |
| `site/fonts/`, `site/art/` | The fonts (with their licences), and the icons, logos and share picture. |
| `service/site.mjs` | Puts a page together: the layout, the page, and the `{{names}}` in them. |
| `service/static.mjs` | Serves the files a page loads, and only those. |
| `scripts/site-art.mjs` | Draws `site/art/` from the sprites and the landscape (`npm run site-art`). |
| `service/try.mjs`, `service/writer.mjs` | Make it right here, where the service has Claude write a reel for a visitor. Off by default: [service.md](../service.md#make-it-right-here). |

A page can say `{{url}}`, `{{mcp}}` (the connector's address) and `{{add}}` (the link that
opens Claude with the connector filled in), `{{icon:letter:4}}` for an everyday icon and
`{{sprite:reelie:2}}` for one of the site's own, drawn as crisp SVG four (or two) pixels to
the pixel, and `{{player:pixel-reel}}` for a player of a reel in `reels/`.

The player is the real one underneath: `site/js/player.js` uses the same timing, narrator,
kit and transitions as `src/main.js`, with the site's own buttons round it. The pages work
without JavaScript, except that reels need it to play.

A page loads nothing from anywhere else, sets no cookies, and its content security policy
(`SITE_POLICY` in `service/site.mjs`) allows only the site's own files. That rules out
inline styles and scripts, so pages have none (`test/site.test.js` checks).

Search engines are asked to keep out (`noindex`, and `/robots.txt`) for as long as Pixel
Reel is by invitation. `PIXELREEL_LISTED=1` lets them list the website. Reels are never
listed: every `/r/` answer says `noindex`.

## Changing it

```sh
npm run service          # http://localhost:8787, picking up changes on reload
npm test                 # test/site.test.js and test/service.test.js cover the site
npm run site-art         # after changing Reelie or the landscape
```

Look at every change at three sizes (1440 x 900, 1280 x 720 and 390 x 844), and with
Make it comfy set to Dark, to Biggest and to Still.

## The reels it plays

All are `reel.json` reels in `reels/`, written the way Claude writes them through the
connector (ready-made pictures only) and recorded by Peter with `npm run voices`:

| Reel | Where |
| --- | --- |
| `pixel-reel` | The player at the top of the home page. |
| `site-what`, `site-how`, `site-who`, `site-peter`, `site-make`, `site-good`, `site-questions` | "Make a pixel reel about this", one for each part of the home page. With `site-open`, they are also "Watch this whole page". |
| `site-open` | The reel for "It is all open", and the code typing out beside it. |
| `site-privacy`, `site-terms` | "Make a pixel reel about this" on the privacy and terms pages. A plain page gets the button by naming a reel in the comment at its top (`reel: site-privacy`). |
| `gas-meter`, `pension-letter`, `volcano`, `cup-of-tea`, `offside-rule`, `blue-sky` | The examples under Now showing. `pension-letter` also plays beside the letter in "Same letter, two ways". |

Change a reel's words and it needs recording again (`npm run voices <name>`); a test fails
until it is. Change what a part of the page says, and change its reel to match. A picture's
`start` and `every` are set to when Peter says the words, so check them after re-recording.

## Design log

### Before (22 November 2026)

The home page was five paragraphs of Markdown on dark blue, with a text link to add Pixel
Reel to Claude. Nothing to watch, on a site about watching.

| Desktop | Phone |
| --- | --- |
| ![The old home page: a heading and paragraphs of text on dark blue.](log/before-desktop.jpg) | ![The old home page on a phone.](log/before-phone.jpg) |

### Version 1

A first whole page: a night-sky top with the player beside the headline, then cream paper for
reading. What was wrong with it, looked at hard:

- The headline broke into three lines, and pushed the buttons off the first screen.
- Words sat on a dithered sky and among the stars, which is hard on exactly the readers the
  site is for.
- The big Play button sat on top of the reel's own title.
- The landscape was below the fold, so the first screen ended in plain dark blue.

![Version 1: the headline in three lines, text over a dithered sky.](log/v1-desktop.jpg)

### Version 2

- The headline is two lines, as it is said: "Watch it. Don't read it."
- The sky is plain behind every word. Stars keep out of the way of text, and the dawn glow
  starts below it.
- Play sits under the reel's title, not on it.
- The whole first screen fits a laptop: headline, both buttons, the player, and the hills
  with Reelie on them.
- The page turns from night to day as the hills meet the paper, and back to night at the
  foot, where Reelie is asleep.
- Phone: the bar across the top fits on one line, the player's buttons fit on one row, and
  lists put their icon beside the words to save scrolling.
- Found by looking at a picture of it: the theatre could open off the screen when the page
  was scrolled. Fixed.

| Desktop | Laptop |
| --- | --- |
| ![Version 2 on a desktop: two-line headline, player, and the landscape at dawn.](log/v2-desktop.jpg) | ![Version 2 on a laptop.](log/v2-laptop.jpg) |

| Now showing | A reel about a part of the page | Phone |
| --- | --- | --- |
| ![Four example reels as posters on a strip of film.](log/v2-gallery.jpg) | ![The theatre playing the reel about who Pixel Reel is for.](log/v2-theatre.jpg) | ![Version 2 on a phone.](log/v2-phone.jpg) |

### Version 3

Looked at again, version 2 explained Pixel Reel well but never let anyone feel the
difference, and the middle of the page was all cream cards.

- **Same letter, two ways.** Straight after the top, a dense pension letter (small, grey,
  justified: everything this site is not) sits beside the reel of the same letter. The
  letter is a picture of a letter, hidden from screen readers, who are told what it is.
- **Watch this whole page.** A button at the top plays the reel for each part of the page,
  one after another: the whole site, as a reel. Next on a reel's last scene skips on.
- **Pictures on the word.** Every clip was run through speech-to-text to find when each word
  is said, and each list, row of icons and chat now arrives as Peter says it. An answer no
  longer shows before its question has been asked.
- **Colour.** The "who it is for" cards have a coloured tile behind each icon.
- **The big Play button** keeps off the picture's own words: under a title, in the middle
  of anything else.
- **A way home.** Every shared reel's page now says "Made with Pixel Reel" under the player.
- **Checked by machine as well as by eye:** Lighthouse gives accessibility 100 and best
  practices 100 on the home, Claude, press and privacy pages at phone size. It found one
  real fault: on a phone the Make it comfy button had no name for a screen reader. Fixed,
  and a test now checks every button has one.
- **Faster:** a page now asks for all its scripts at once, and the first reel with them,
  rather than finding out about each from the one before.

| The top, with Watch this whole page | Same letter, two ways | Who it is for |
| --- | --- | --- |
| ![Version 3: the top of the page with a Watch this whole page button.](log/v3-hero.jpg) | ![A dense letter beside a reel of the same letter.](log/v3-ways.jpg) | ![Cards with coloured tiles behind their icons.](log/v3-who.jpg) |

### Version 4

The page a shared reel lands on is where most people will meet Pixel Reel, and it still
looked like the old site.

- **A shared reel's page** (`/r/<id>`) is now the website's own: the same player, Make it
  comfy, a night sky, and "Want one of your own?" underneath. It says how long the reel is
  kept, and offers the video once one has been made.
- **Waiting is a scene of its own.** The page used to say "Nearly ready" and reload itself
  every five seconds. Now it is there at once, Reelie waits on screen under a RECORDING
  sign, and the reel appears the moment Peter has finished.
- **A link sent in a message** shows a card ("A pixel reel for you") and the reel's title.
  The page itself holds none of the reel's words.
- **Privacy and terms, as reels.** Both pages have "Make a pixel reel about this" straight
  under the heading. Nobody reads the terms; now they can watch them.
- **It is all open.** A part of the home page for the curious, with a reel of its own, and
  code typing itself out beside it.
- **Looked at with Make it comfy turned up,** which found two faults: at the biggest
  letters on a phone the bar across the top and the player's buttons ran off the side of
  the screen. Both now wrap. Pictures drawn on a canvas no longer take on the page's letter
  spacing.

| A shared reel | Waiting for the voice | It is all open |
| --- | --- | --- |
| ![A shared reel's page: the player under a night sky.](log/v4-reel.jpg) | ![Reelie waits under a RECORDING sign.](log/v4-waiting.jpg) | ![The open-source part of the home page, with code typing out.](log/v4-open.jpg) |

### Version 5

- **Six examples, not four.** Now showing gains "The offside rule, at last" and "Why the sky
  is blue", each with pixel art drawn for it: a football pitch with the last defender's line
  marked, sunlight fanning out into its colours, a sunset. The posters sit three by two.
- The two questions the make-one box suggests (the offside rule, why the sky is blue) are now
  ones a visitor can watch the answer to on the same page.

| Six examples |
| --- |
| ![Six example reels as posters, three by two, on a strip of film.](log/v5-gallery.jpg) |

### Version 6

- **Make it right here, built and switched off.** Until now a visitor needed Claude to get a
  reel. The make-one box can now offer a second button that has the service ask Claude for
  them, and takes them to the reel's page to wait for the voice. It costs money for every
  reel, so it is off, and the button is not on the page at all, until it is switched on
  ([service.md](../service.md#make-it-right-here) has the costs and the safeguards).
- Tried with a stand-in for Claude from the button through to a reel ready to play.

| The button, when it is switched on |
| --- |
| ![The make-one box with a second button: Make it right here.](log/v6-here.jpg) |
