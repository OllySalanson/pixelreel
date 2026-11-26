# The test bench

Ten fixed topics in `topics/`, of the kinds people bring: a gas bill, a hospital letter, a
council tax reminder, a how-to, a web page, a school letter, a bank's warning, a phone
contract, and two of firstmate's technical reels. After every change to the pictures or to
what Claude is told, they are written again and drawn beside the last run, so better is seen,
not guessed.

    ANTHROPIC_API_KEY=... npm run bench -- write <run>      # about 25 US cents with Sonnet
    npm run bench -- sheet <before> <after>                 # bench/runs/<before>-vs-<after>.png

`write` uses the website's own writer (`service/writer.mjs`) with the service's checks and its
one round of putting a reel right, and keeps each reel with its time and cost in
`runs/<run>/`. `--model`, `--effort` and `--only gas-bill,school-trip` change what is run.
`sheet` draws each scene as it stands near the end of its line, at the picture's own size.

Keep the topics as they are: a run is only worth comparing with another on the same words.
`runs/cards` is the site as it was on 26 Nov 2026, before the stage: every picture a card.
`runs/stage` is the first run with the stage and its library (`--pictures stage`, the default).
