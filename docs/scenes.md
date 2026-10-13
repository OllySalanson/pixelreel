# Writing scenes

Everything a reel can do, with a tiny example of each. For the voice, see
[voices.md](voices.md); for putting a reel on the web, see [sharing.md](sharing.md).

- [The reel file](#the-reel-file)
- [Scenes](#scenes)
- [Ready-made pictures](#ready-made-pictures)
- [Transitions](#transitions)
- [Typewriter captions](#typewriter-captions)
- [The pixel kit](#the-pixel-kit)
- [Checking your work](#checking-your-work)

## The reel file

A reel is one file, `reels/<name>/reel.js`, that exports one object:

```js
export default {
  title: 'How tea is made',
  intro: 'Sound will start. Use Next and Back any time.',
  note: 'Made with pixelreel.',
  transition: 'dissolve',
  captions: 'typewriter',
  images: { garden: 'images/garden.png' },
  scenes: [ /* ... */ ]
};
```

| Field | Needed | What it is |
| --- | --- | --- |
| `title` | yes | The reel's name, shown above the player. |
| `scenes` | yes | The list of scenes, in order. |
| `intro` | no | Shown before anyone presses Play. |
| `note` | no | Small print under the player: credits, a link. |
| `transition` | no | How every scene enters, unless it says otherwise. Default `'cut'`. See [Transitions](#transitions). |
| `captions` | no | `'plain'` (the default) or `'typewriter'`. See [Typewriter captions](#typewriter-captions). |
| `images` | no | Pictures the scenes can show, as `name: 'path'`, relative to the reel's folder. |

`npm run new my-reel` writes a starter file; `npm run new my-reel -- --from notes.md` writes
one [from a script](sharing.md#make-a-reel-from-a-script).

## Scenes

```js
{
  title: 'Picking',
  caption: 'Only the top two leaves and a bud are picked.',
  say: 'First, the picking. Only the top two leaves and a bud are taken from each bush.',
  transition: 'wipe',
  draw(t, px) {
    px.sky('#0b1220', '#24476b');
    px.sign('PICKING', px.W / 2, 20, 16, '#ffcc4d');
  }
}
```

| Field | Needed | What it is |
| --- | --- | --- |
| `title` | yes | The heading over the caption. |
| `caption` | yes | The words on screen. Short sentences read best. |
| `say` | no | What the narrator says. Leave it out to read the caption aloud. |
| `draw(t, px)` | no | Paints the picture. `t` is seconds since the scene started; `px` is the [pixel kit](#the-pixel-kit). |
| `picture` | no | A [ready-made picture](#ready-made-pictures) instead of `draw`. |
| `transition` | no | How this scene enters, overriding the reel's. |
| `captions` | no | `'plain'` or `'typewriter'`, overriding the reel's. |

A scene with neither `draw` nor `picture` gets a plain title card. When the narration ends
the player waits a moment, then moves on by itself. Aim for 6 to 16 scenes of 20 to 50
spoken words each. If a reel has a mistake, the player (and `npm run check`) says what and
where instead of playing.

## Ready-made pictures

No drawing needed: give a scene a `picture` and it animates in time by itself. They are
plain data, so a script or an AI agent can write a whole reel of them. A kit helper,
`px.picture(spec, t)`, draws one inside your own `draw` too.

**title**: a big title dropping in over a night sky, with a line typed underneath.

```js
picture: { type: 'title', text: 'TEA', sub: 'From the bush to the cup' }
```

**list**: items arriving one by one with a tick (or a number), `every` seconds from `start`.

```js
picture: { type: 'list', heading: 'YOU WILL NEED', items: ['A kettle', 'A teapot', 'Patience'], numbered: true, every: 1.5 }
```

**terminal**: a terminal window. Lines starting with `$ ` type out; the rest is output.

```js
picture: { type: 'terminal', title: 'bash', lines: ['$ kettle --boil', 'Boiled in 2m 40s', '$ steep --minutes 3'] }
```

**code**: an editor that types out the code, with simple highlighting.

```js
picture: { type: 'code', title: 'tea.js', lines: ['const cup = brew({', "  leaves: 'assam',", '  minutes: 3', '});'] }
```

**chat**: messages arriving with a typing indicator. The first sender sits on the left.

```js
picture: { type: 'chat', title: 'Kitchen', messages: [{ from: 'Kettle', text: 'Ready.' }, { from: 'You', text: 'Pour away.' }] }
```

**big**: one huge word or number, punched in, with a line underneath.

```js
picture: { type: 'big', text: '3 MIN', sub: 'and not a second more' }
```

**image**: one of the reel's `images`, slowly pushing in.

```js
picture: { type: 'image', name: 'garden' }
```

## Transitions

How one scene gives way to the next: set `transition` on the reel for every scene, or on a
scene for just that one.

| Name | What happens |
| --- | --- |
| `cut` | Switches at once (the default). |
| `fade` | Dithers down to black and back up. |
| `dissolve` | The old picture crumbles away in blocks. |
| `wipe` | The new picture sweeps in from the left behind a zigzag edge. |
| `slide` | The new picture pushes the old one off to the left. |
| `blinds` | Slats close over the old picture. |
| `iris` | A closing circle, like the end of an old cartoon, then opening on the new scene. |
| `flash` | A white flash. |
| `star` | The new scene bursts out of a spinning star. You know what you did. |

```js
{ title: 'The end', caption: 'Thanks for watching.', transition: 'iris' }
```

Anyone whose system asks for less motion gets plain cuts.

## Typewriter captions

With `captions: 'typewriter'`, each caption types itself out as the narrator speaks,
finishing a little before the voice does. Paused, it shows in full so it can be read, and a
screen reader is given the whole caption at once.

```js
export default { title: 'Tea', captions: 'typewriter', scenes: [ /* ... */ ] };
```

## The pixel kit

Pictures are drawn on a grid of 320 x 180 logical pixels (`px.W` x `px.H`), scaled up
crisply, about 20 times a second. `t` is the seconds since the scene started, so anything
worked out from `t` moves in time with the narration and holds still when paused.

### Drawing

| Helper | Draws | Example |
| --- | --- | --- |
| `px.rect(colour, x, y, w, h)` | A filled rectangle. | `px.rect('#ffcc4d', 10, 10, 40, 20)` |
| `px.sprite(rows, x, y, scale, flip, colours)` | Pixel art from rows of letters ([palette below](#sprite-letters)). `.` is see-through; `colours` adds letters of your own. | `px.sprite(['.hh.', 'hyyh'], 50, 50, 4, false, { h: '#6b3e2e' })` |
| `px.text(str, x, y, size, colour, align, shadow)` | Text in the Orange Kid pixel font; `shadow` is a colour for a drop shadow. | `px.text('HELLO', 160, 20, 24, '#ffcc4d', 'center', '#1a1a1a')` |
| `px.textW(str, size)` | How wide that text would be. | `const w = px.textW('HELLO', 24)` |
| `px.wrap(str, maxW, size)` | The text broken into lines that fit. | `px.wrap(longText, 200, 12).forEach((l, i) => px.text(l, 10, 10 + i * 13))` |
| `px.window(x, y, w, h, fill)` | A framed panel. | `px.window(20, 20, 100, 60)` |
| `px.sign(str, cx, y, size, bg, fg)` | A label in a panel, centred on `cx`. | `px.sign('PICKING', 160, 10, 16, '#ffcc4d')` |
| `px.bubble(str, x, y, size, tailX, bg, fg, maxW)` | A speech bubble, wrapped, with a tail pointing down at `tailX`. | `px.bubble('Morning!', 120, 30, 12, 140)` |
| `px.image(name, x, y, w, h, frame)` | One of the reel's `images`, fitted in the box. | `px.image('garden', 60, 40, 200, 110)` |

### Scenery

| Helper | Draws | Example |
| --- | --- | --- |
| `px.sky(top, bottom)` | A banded sky between two `#rrggbb` colours. | `px.sky('#0b1220', '#2f5d8a')` |
| `px.stars(t)` | Twinkling stars. | `px.stars(t)` |
| `px.moon(cx, cy)` | A crescent moon. | `px.moon(280, 26)` |
| `px.hills(colour, y, amp, shift, seed)` | Rolling hills along the bottom, tops between `y - amp` and `y`. They repeat every 320 pixels, so a growing `shift` scrolls them forever; layers at different speeds make parallax. | `px.hills('#1f3b5e', 150, 24, t * 8)` |
| `px.clouds(t, y, speed, colour, count, seed)` | Chunky clouds drifting across. | `px.clouds(t, 20, 6)` |
| `px.parallax(t, speed, width, draw)` | Calls `draw(x)` for each copy of a `width`-wide layer needed to fill the picture as it scrolls. | `px.parallax(t, 30, 64, (x) => px.rect('#333', x, 150, 40, 30))` |

### Shapes

| Helper | Draws | Example |
| --- | --- | --- |
| `px.circle(colour, cx, cy, r)` | A filled circle. | `px.circle('#ffcc4d', 160, 90, 20)` |
| `px.ring(colour, cx, cy, r, w)` | A circle outline `w` pixels thick. | `px.ring('#d63a3a', 160, 90, 30, 3)` |
| `px.line(colour, x0, y0, x1, y1)` | A one-pixel line. | `px.line('#fdf6e3', 0, 179, 319, 120)` |
| `px.dither(colour, x, y, w, h, level)` | Speckles a box in an ordered dither, from `level` 0 (clear) to 1 (solid): pixel-art shading and fades. | `px.dither('#000', 0, 0, 320, 180, 1 - t / 2)` |

### Motion

| Helper | Gives | Example |
| --- | --- | --- |
| `px.tween(t, start, dur, from, to, ease)` | A number moving from `from` to `to` over `dur` seconds from `start`. `ease` is `'linear'`, `'in'`, `'out'` (default), `'inOut'`, `'back'`, `'bounce'`, `'elastic'` or a function. | `const y = px.tween(t, 1, 0.8, -40, 60, 'bounce')` |
| `px.bob(t, speed, amp)` | A gentle bounce to add to a position. | `px.circle('#fff', 160, 90 + px.bob(t), 8)` |
| `px.shown(t, i, every, start)` | True once item `i` should show, one every `every` seconds from `start`. | `if (px.shown(t, 2, 1.5, 1)) px.sign('THREE', 250, 80)` |
| `px.frame(t, fps, frames)` | The frame of an animation for time `t`. | `px.sprite(px.frame(t, 6, [WALK1, WALK2]), x, 140, 2)` |
| `px.blink(t, rate)` | True for the first half of each blink, `rate` blinks a second. | `if (px.blink(t)) px.text('PRESS START', 160, 150, 16, '#fff', 'center')` |
| `px.type(str, x, y, t, size, colour, start, cps)` | Types text out from `start` with a cursor; true once it is all there. | `px.type('Hello, world', 20, 40, t, 16, '#55d6be', 1)` |
| `px.typed(str, t, start, cps)` | Just the part typed so far, to draw however you like. | `px.sign(px.typed('LOADING...', t), 160, 80)` |
| `px.lerp(a, b, k)`, `px.clamp(v, lo, hi)` | In-between numbers and keeping numbers in range. | `px.lerp(0, 100, 0.25)` |
| `px.rand(n)` | A steady pseudo-random number in [0, 1): the same `n` always gives the same answer, so nothing flickers. | `const x = px.rand(i) * px.W` |

### Effects and camera

| Helper | Does | Example |
| --- | --- | --- |
| `px.confetti(t, start, x, y, count)` | A burst of confetti from `x, y` at `start`, falling away over two seconds. | `px.confetti(t, 3, 160, 90)` |
| `px.sparkle(x, y, t, colour)` | A little twinkling star. | `px.sparkle(40, 30, t)` |
| `px.shake(t, start, dur, amp)` | `[dx, dy]` for a shake that dies away. | `const [dx, dy] = px.shake(t, 2, 0.5, 4)` |
| `px.shift(dx, dy, fn)` | Draws whatever `fn()` draws moved by `dx, dy`: a camera. | `px.shift(...px.shake(t, 2), () => drawCity(t))` |
| `px.zoom(k, cx, cy, fn)` | Draws whatever `fn()` draws magnified around `cx, cy`. Whole numbers keep pixels square. | `px.zoom(2, 160, 90, () => px.sprite(HERO, 150, 80))` |
| `px.clip(rects, fn)` | Draws whatever `fn()` draws only inside a list of `[x, y, w, h]`. | `px.clip([[20, 20, 100, 60]], () => px.stars(t))` |
| `px.transition(kind, p, drawOld, drawNew, box)` | Frame `p` (0 to 1) of a [transition](#transitions), inside your own picture. | `px.transition('iris', t % 1, () => dayTime(), () => nightTime(), { x: 20, y: 20, w: 120, h: 70 })` |
| `px.picture(spec, t)` | A [ready-made picture](#ready-made-pictures), inside your own `draw`. | `px.picture({ type: 'big', text: 'WOW' }, t)` |

`px.W` and `px.H` are the picture size, `px.PAL` the sprite palette and `px.EASE` the
easing curves.

### Sprite letters

`k` ink, `w` white, `r` red, `g` green, `b` blue, `y` yellow, `o` orange, `p` purple, `t` teal,
`s` skin, `n` brown, `e` grey, `c` cream, and capitals `B`, `R`, `N`, `G` for darker shades of
blue, red, brown and green. Pass `colours`, such as `{ h: '#6b3e2e', s: '#c68642' }`, to add
letters or change these for one sprite.

For anything else, write your own helpers at the top of the reel file, as the
[example reel](../reels/what-is-pixelreel/reel.js) does for its film reel and speech bubble.

## Checking your work

- Open `?reel=my-reel&scene=3&t=12` to hold scene 3 at twelve seconds in, to check a
  picture by eye. Press Play to carry on from there.
- `npm run check my-reel` checks the reel without a browser: it lists every problem and
  where it is, how long the reel runs, and which scenes still have no recording.
- In the player, the progress bar under the picture jumps to any moment; the ticks mark
  where each scene starts.
