// The pixelreel showreel: pixelreel explaining itself, made with pixelreel.
//
// Every picture is a draw(t, px) function using the pixel kit (src/kit.js). t is seconds
// since the scene started, and each scene's CUES are when its sentences start in the
// recorded narration, so every gag lands on the word that sets it up. Change a scene's
// words and, after npm run voices, find its new cues from the pauses in the clip:
//   ffmpeg -i reels/showreel/audio/<clip>.mp3 -af silencedetect=noise=-38dB:d=0.12 -f null -
// The README's pictures are clips of these scenes (see docs/readme/README.md).

const INK = '#1a1a1a', NIGHT = '#0b1220', NAVY = '#13203a', BLUE = '#24476b', CREAM = '#ebeac5', LIGHT = '#fdf6e3';
const GOLD = '#ffcc4d', TEAL = '#55d6be', RED = '#d63a3a', PINK = '#ff7eb6', PURPLE = '#8e5bd6', ORANGE = '#ff8c2a';
const GREEN = '#3fa34d', GREY = '#9fb3c8', MUTED = '#6f87a3';

// ---------------------------------------------------------------------------------------
// The cast

/**
 * Reelie, the film reel who presents the show. mood: 'happy', 'talk', 'wow', 'sleep',
 * 'cross', 'sad' or 'shy'. walk is a clock that moves the feet; spin turns the reel.
 */
function reelie(px, cx, cy, { r = 16, spin = 0, mood = 'happy', t = 0, walk = null, shades = false } = {}) {
  cx = Math.round(cx); cy = Math.round(cy);
  const step = walk === null ? 0 : Math.floor(walk * 7) % 2 ? 1 : -1, fx = Math.round(r * 0.45), fy = cy + r - 4;
  for (const [side, lift] of [[-1, step > 0 ? 2 : 0], [1, step < 0 ? 2 : 0]]) {
    px.rect(INK, cx + side * fx - 4, fy - lift, 8, 6);
    px.rect('#46566e', cx + side * fx - 3, fy - lift + 1, 6, 3);
  }
  px.circle(INK, cx, cy, r);
  px.circle('#8094ab', cx, cy, r - 1);
  px.circle('#cfdbe7', cx - 1, cy - 1, r - 2);
  px.circle('#aebfd1', cx, cy, r - 3);
  for (let k = 0; k < 5; k++) {
    const a = spin + (k * 2 * Math.PI) / 5 - Math.PI / 2;
    px.circle('#2b3a52', cx + Math.cos(a) * r * 0.67, cy + Math.sin(a) * r * 0.67, Math.max(1, Math.round(r * 0.15)));
  }
  const hub = Math.max(5, Math.round(r * 0.46));
  px.circle(INK, cx, cy, hub + 1);
  px.circle(GOLD, cx, cy, hub);
  px.rect('#ffe08a', cx - Math.round(hub * 0.5), cy - hub + 1, Math.round(hub * 0.6), 1);
  face(px, cx, cy, hub, mood, t, shades);
}

function face(px, cx, cy, hub, mood, t, shades) {
  const e = Math.max(1, Math.round(hub / 6)), ex = Math.round(hub * 0.42), ey = Math.round(hub * 0.3);
  const my = Math.round(hub * 0.36), mw = Math.round(hub * 0.3);
  const blink = (t % 3.7) > 3.56;
  const eyes = (draw) => { draw(cx - ex - Math.floor(e / 2)); draw(cx + ex - Math.floor(e / 2)); };
  if (shades) {
    px.rect(INK, cx - ex - 2 * e - 1, cy - ey - e, 2 * ex + 4 * e + 3, 2 * e + 2);
    px.rect('#3a4a66', cx - ex - e - 1, cy - ey - e + 1, e + 1, 1);
    px.rect('#3a4a66', cx + ex - e, cy - ey - e + 1, e + 1, 1);
  } else if (mood === 'sleep' || mood === 'shy' || (blink && mood !== 'wow')) {
    eyes((x) => px.rect(INK, x - e, cy - ey + e, e * 3, e));
  } else if (mood === 'wow' || mood === 'sad') {
    eyes((x) => { px.rect(INK, x - Math.ceil(e / 2), cy - ey - Math.ceil(e / 2), e * 2, e * 2 + 1); px.rect(LIGHT, x - Math.ceil(e / 2), cy - ey - Math.ceil(e / 2), 1, 1); });
  } else if (mood === 'cross') {
    eyes((x) => px.rect(INK, x - e, cy - ey + e, e * 3, e));
    px.rect(INK, cx - ex - e * 2, cy - ey - e, e * 2, e); px.rect(INK, cx - ex, cy - ey, e, e);
    px.rect(INK, cx + ex, cy - ey - e, e * 2, e); px.rect(INK, cx + ex - e, cy - ey, e, e);
  } else {
    eyes((x) => px.rect(INK, x, cy - ey, e, e * 2));
  }
  const y = cy + my;
  if (mood === 'talk' && Math.floor(t * 8) % 2) {
    px.rect(INK, cx - mw, y - e, mw * 2 + 1, e * 3);
    px.rect(RED, cx - mw + e, y, mw * 2 + 1 - 2 * e, e);
  } else if (mood === 'wow') {
    px.rect(INK, cx - e, y - e, e * 2 + 1, e * 2 + 1);
    px.rect('#a52222', cx - e + 1, y - e + 1, e * 2 - 1, e * 2 - 1);
  } else if (mood === 'sleep') {
    px.rect(INK, cx - e, y, e * 2, e * 2);
  } else if (mood === 'cross') {
    px.rect(INK, cx - mw, y, mw * 2 + 1, e);
  } else if (mood === 'sad') {
    px.rect(INK, cx - mw + e, y, mw * 2 + 1 - 2 * e, e);
    px.rect(INK, cx - mw, y + e, e, e); px.rect(INK, cx + mw, y + e, e, e);
  } else {
    px.rect(INK, cx - mw + e, y + e, mw * 2 + 1 - 2 * e, e);
    px.rect(INK, cx - mw, y, e, e); px.rect(INK, cx + mw, y, e, e);
  }
}

// A person, eight pixels wide. H hair, S skin, C top, T trousers.
const PERSON = [
  '..HHHH..', '.HHHHHH.', '.HSSSSH.', '.SkSSkS.', '.SSSSSS.', '..SSSS..', '.CCCCCC.',
  'CCCCCCCC', 'SCCCCCCS', 'SCCCCCCS', '.TTTTTT.', '.TT..TT.', '.kk..kk.'
];
const SKINS = ['#f2c194', '#c68642', '#8d5524', '#e0ac69'];

function person(px, x, y, { hair = '#5a3418', skin = SKINS[0], top = BLUE, legs = '#2b3a52', scale = 2, flip = false, rows = PERSON } = {}) {
  px.sprite(rows, x, y, scale, flip, { H: hair, S: skin, C: top, T: legs });
}

// a person asleep on their arms at a desk, from the front: hair, arms and shoulders
const SLEEPER = [
  '.....HHHHHH.....', '....HHHHHHHH....', '...HHHHHHHHHH...', '..CCHHHHHHHHCC..', '.CCCCHHHHHHCCCC.', 'CCCCCSSSSSSCCCCC',
  'CCCCSSSSSSSSCCCC', 'CCCCCCCCCCCCCCCC'
];

const POINTER = ['k.......', 'kk......', 'kwk.....', 'kwwk....', 'kwwwk...', 'kwwwwk..', 'kwwwwwk.', 'kwwwwwwk', 'kwwwkkkk', 'kwkwk...', 'kk.kwk..', '....kk..'];
const HAND = ['...kk......', '..kwwk.....', '..kwwk.....', '..kwwkkk...', '..kwwkwwkk.', 'kkkwwkwwkwk', 'kwkwwwwwkwk', 'kwwwwwwwwwk', '.kwwwwwwwwk', '..kwwwwwwk.', '...kkkkkk..'];
const SPIDER = ['k.k.k.k', '.kkkkk.', 'kkrkrkk', '.kkkkk.', 'k.k.k.k'];
const HEART = ['.kk.kk.', 'krrkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];

// ---------------------------------------------------------------------------------------
// Props and effects

/** A rubber stamp, punched onto the picture at time `at`. */
function stamp(px, word, cx, cy, t, at, colour = RED, size = 16) {
  if (t < at) return;
  const k = px.tween(t, at, 0.22, 2, 1, 'out'), w = px.textW(word, size) + 12, h = size + 6;
  px.zoom(k, cx, cy, () => {
    px.rect(colour, cx - w / 2, cy - h / 2, w, h);
    px.rect(LIGHT, cx - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4);
    px.rect(colour, cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6);
    px.text(word, cx, cy - h / 2 + 3, size, LIGHT, 'center');
  });
}

/** A big red cross that strikes itself out from the middle. */
function cross(px, cx, cy, size, t, at) {
  if (t < at) return;
  const n = Math.min(size, Math.floor((t - at) * size * 7));
  for (let i = -n; i <= n; i++) {
    px.rect(INK, cx + i - 2, cy + i - 1, 5, 4); px.rect(INK, cx + i - 2, cy - i - 2, 5, 4);
  }
  for (let i = -n; i <= n; i++) {
    px.rect(RED, cx + i - 1, cy + i, 3, 2); px.rect(RED, cx + i - 1, cy - i - 1, 3, 2);
  }
}

/** A sheet of paper with a title and lines of writing. */
function paper(px, x, y, w, h, title, { fill = LIGHT, ink = '#3d3d3d', lines = true } = {}) {
  px.window(x, y, w, h, fill);
  px.rect('#d9d6bd', x + w - 7, y + 1, 6, 6);
  px.rect('#171717', x + w - 7, y + 6, 6, 1); px.rect('#171717', x + w - 7, y + 1, 1, 6);
  if (title) px.text(title, x + 4, y + 2, 12, ink);
  if (lines) for (let ly = y + (title ? 17 : 6); ly < y + h - 4; ly += 5) px.rect('#b9b6a0', x + 4, ly, Math.max(4, w - 10 - ((ly * 7) % 13)), 2);
}

/** TV static. */
function noise(px, box, t) {
  const f = Math.floor(t * 24);
  for (let j = box.y; j < box.y + box.h; j += 2) {
    for (let i = box.x; i < box.x + box.w; i += 2) px.rect(px.rand(i * 7.13 + j * 3.71 + f * 17.9) > 0.5 ? '#c9c9c9' : '#2e2e2e', i, j, 2, 2);
  }
}

/** A firework bursting at cx, cy at time `at`. */
function firework(px, cx, cy, t, at, colour) {
  const dt = t - at;
  if (dt < -0.6 || dt > 1.7) return;
  if (dt < 0) { px.rect(LIGHT, cx, cy + Math.round(-dt * 90), 1, 3); return; }   // the rocket going up
  const r = 34 * (1 - (1 - Math.min(1, dt / 0.9)) ** 3), fall = dt * dt * 10, size = dt < 1 ? 2 : 1;
  for (let i = 0; i < 18; i++) {
    const a = (i * 2 * Math.PI) / 18 + at;
    if (dt > 1.2 && (i + Math.floor(dt * 10)) % 3) continue;
    px.rect(i % 3 ? colour : LIGHT, cx + Math.cos(a) * r, cy + Math.sin(a) * r + fall, size, size);
  }
}

/** A night city skyline, `seed` choosing the buildings, with windows lit here and there. */
function skyline(px, x0, base, colour, lit, seed, t) {
  let x = 0;
  for (let i = 0; x < 330; i++) {
    const w = 16 + Math.floor(px.rand(seed + i) * 22), h = 22 + Math.floor(px.rand(seed * 3 + i) * 46);
    px.rect(colour, x0 + x, base - h, w - 2, h);
    if (lit) {
      for (let wy = base - h + 4; wy < base - 4; wy += 6) {
        for (let wx = 3; wx < w - 5; wx += 5) {
          if (px.rand(seed + i * 31 + wx * 7 + wy * 13 + Math.floor(t / 3 + i) * 0.37) > 0.72) px.rect(lit, x0 + x + wx, wy, 2, 3);
        }
      }
    }
    x += w;
  }
}

/** A speech bubble that types its words out from `at`. */
function says(px, str, x, y, t, at, tailX = null, size = 12, maxW = 140) {
  if (t < at) return null;
  const shown = px.typed(str, t, at, 30);
  const box = px.bubble(str, x, y, size, tailX, LIGHT, LIGHT, maxW);   // the full size, so it never jiggles
  const lines = px.wrap(str, maxW, size);
  let budget = shown.length;
  lines.forEach((l, i) => {
    const part = l.slice(0, Math.max(0, budget));
    budget -= l.length + 1;
    if (part) px.text(part, box.x + 5, box.y + 2 + i * (size + 1), size, '#202020');
  });
  return box;
}

/** A browser window; returns the area inside it. */
function browser(px, x, y, w, h, title = '') {
  px.window(x, y, w, h, LIGHT);
  px.rect(BLUE, x + 1, y + 1, w - 2, 11);
  [RED, GOLD, GREEN].forEach((c, i) => px.rect(c, x + 4 + i * 5, y + 4, 3, 3));
  if (title) px.text(title, x + w / 2, y + 0, 12, CREAM, 'center');
  return { x: x + 1, y: y + 12, w: w - 2, h: h - 13 };
}

/** A small player: a picture, a caption bar and a progress bar, playing a tiny Reelie. */
function miniPlayer(px, box, t, { playing = true } = {}) {
  px.clip([[box.x, box.y, box.w, box.h]], () => {
    px.sky(NIGHT, '#2f5d8a');
    px.stars(t);
    px.hills('#1f3b5e', box.y + box.h - 4, 10, playing ? t * 20 : 0, 4);
    reelie(px, box.x + box.w / 2, box.y + box.h / 2 - 4 + (playing ? px.bob(t, 6, 2) : 0), { r: Math.min(14, Math.floor(box.h / 4)), spin: playing ? t * 3 : 0, t, mood: 'talk' });
    px.rect(CREAM, box.x, box.y + box.h - 3, box.w, 3);
    px.rect(GOLD, box.x, box.y + box.h - 3, Math.round(box.w * ((t * 0.12) % 1)), 3);
  });
}

// ---------------------------------------------------------------------------------------
// The scenes

const CUES = {
  docs: [0, 1.38, 3.2, 4.32, 5.22, 7.55],
  meet: [0, 1.74, 3.36, 6.73, 8.41, 9.89, 11.24],
  scenes: [0, 3.28, 4.9, 5.83, 7.0, 8.17, 9.15],
  code: [0, 1.87, 3.7, 4.67, 5.63, 7.09, 8.4],
  ready: [0, 1.58, 2.1, 3.08, 4.07, 4.85, 5.65],
  voice: [0, 2.98, 4.86, 5.7, 6.8, 8.2, 9.53, 10.79],
  satnav: [0, 1.69, 3.97, 5.96],
  controls: [0, 2.39, 3.05, 3.65, 4.92, 6.96, 7.6],
  wipes: [0.75, 1.33, 1.82, 2.45, 3.0, 4.61, 6.36, 8.22],
  helps: [0, 1.01, 2.82, 5.3, 7.98],
  also: [0, 1.15, 2.48, 5.74, 8.32, 9.77],
  anywhere: [0, 1.68, 3.21, 4.53, 5.73, 8.35],
  robots: [0, 1.68, 3.99, 7.06, 9.56, 12.01],
  make: [0, 2.35, 2.93, 3.73, 4.7, 6.37, 7.35],
  end: [0, 1.54, 3.83, 7.27]
};

function docsScene(t, px) {
  const [, nobody, readme, wiki, changelog, cartoon] = CUES.docs;
  const [sx, sy] = px.shake(t, nobody + 0.42, 0.5, 4);
  px.shift(sx, sy, () => {
    px.rect('#18233a', 0, 0, px.W, px.H);
    px.rect('#1e2b45', 0, 108, px.W, 40);
    px.rect('#241b2c', 0, 148, px.W, 32);
    px.rect('#1a1420', 0, 148, px.W, 2);
    // a window on the night
    px.clip([[15, 17, 64, 64]], () => {
      px.sky('#0c1528', '#2a3f6b');
      px.stars(t);
      px.moon(62, 32);
      skyline(px, 15, 81, '#101c33', GOLD, 5, t);
    });
    px.rect(INK, 14, 16, 66, 1); px.rect(INK, 14, 81, 66, 1); px.rect(INK, 14, 16, 1, 66); px.rect(INK, 79, 16, 1, 66);
    px.rect(INK, 46, 16, 2, 66); px.rect(INK, 14, 48, 66, 2);
    px.rect('#2b3a52', 10, 82, 74, 3);
    // the desk, the monitor full of docs, the tea
    px.rect('#5a3418', 96, 124, 168, 26);
    px.rect('#7a4a24', 92, 118, 176, 8);
    px.rect('#4a2a12', 100, 150, 6, 18); px.rect('#4a2a12', 252, 150, 6, 18);
    px.window(160, 76, 62, 40, '#0d1117');
    px.rect('#2b3a52', 186, 116, 10, 3);
    for (let i = 0; i < 7; i++) {
      const ly = 80 + ((i * 5 + Math.floor(t * 6)) % 34);
      px.rect(i % 3 ? MUTED : GREY, 164, ly, 30 + ((i * 17) % 22), 2);
    }
    px.rect(LIGHT, 238, 108, 8, 10); px.rect(LIGHT, 246, 110, 2, 5);
    if (px.blink(t, 0.6)) px.rect('#cfd6dd', 240, 101 - Math.floor(t * 4) % 4, 1, 4);
    // the reader, fast asleep on the desk
    px.rect('#3b2c3f', 112, 92, 34, 30);
    px.rect('#2c2130', 114, 94, 30, 26);
    px.sprite(SLEEPER, 105, 95 + (Math.floor(t * 1.2) % 2), 3, false, { H: '#3b2a20', S: SKINS[1], C: TEAL });
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      px.text('z', 134 + i * 5 + Math.sin(k * 6) * 3, 76 - k * 32, 10 + i * 3, k > 0.85 ? MUTED : CREAM);
    }
    // the docs nobody reads land on the desk
    if (t >= nobody) {
      const y = px.tween(t, nobody, 0.42, -120, 0, 'in');
      for (let i = 0; i < 9; i++) {
        const w = 34 + ((i * 7) % 6), x = 226 - w / 2 + ((i * 5) % 7) - 3;
        paper(px, x, 108 + y - i * 8, w, 9, null, { lines: false, fill: i % 2 ? LIGHT : '#e9e4c8' });
      }
    }
  });
  // what they are: one card after another
  const cards = [
    [readme, 'README.md', 'UNREAD', 104],
    [wiki, 'WIKI', 'SINCE 2016', 172],
    [changelog, 'CHANGELOG', 'HELLO?', 240]
  ];
  for (const [at, name, verdict, x] of cards) {
    if (t < at) continue;
    const y = Math.round(px.tween(t, at, 0.35, -60, 12, 'back'));
    paper(px, x - 30, y, 60, 48, name, { fill: LIGHT });
    stamp(px, verdict, x, y + 30, t, at + 0.45, RED, 12);
  }
  if (t >= changelog + 0.5) {
    const k = px.tween(t, changelog + 0.5, 0.6, 0, 1, 'bounce'), drop = Math.round(10 + k * 22 + px.bob(t, 3, 2));
    px.line('#d9d6bd', 262, 12, 262, 12 + drop);
    px.sprite(SPIDER, 259, 12 + drop, 1);
    px.line('#c9c6af', 212, 12, 224, 20); px.line('#c9c6af', 216, 12, 214, 24);
  }
  // so here is a cartoon instead: down comes a screen, and the film counts in
  if (t >= cartoon) {
    px.rect(`rgba(5, 8, 16, ${Math.min(0.55, (t - cartoon) * 1.2).toFixed(2)})`, 0, 0, px.W, px.H);
    const drop = Math.round(px.tween(t, cartoon, 0.5, 0, 132, 'out'));
    px.rect('#3a3a44', 70, 4, 180, 6);
    px.rect(INK, 74, 10, 172, drop);
    px.rect('#e8e4d4', 76, 10, 168, Math.max(0, drop - 2));
    if (drop > 120) {
      const run = Math.max(0, t - cartoon - 0.6), n = Math.max(1, 3 - Math.floor(run / 0.8)), sweep = (run % 0.8) / 0.8;
      px.clip([[76, 10, 168, 120]], () => {
        px.rect('#8a8a8a', 76, 10, 168, 120);
        px.ring('#dcdcdc', 160, 70, 46, 3);
        px.ring('#dcdcdc', 160, 70, 36, 2);
        px.rect('#dcdcdc', 76, 69, 168, 2); px.rect('#dcdcdc', 159, 10, 2, 120);
        for (let r = 0; r < 34; r++) px.rect('#5f5f5f', 160 + Math.cos(sweep * 6.283 - 1.57) * r, 70 + Math.sin(sweep * 6.283 - 1.57) * r, 2, 2);
        px.text(String(n), 160, 48, 48, INK, 'center');
      });
    }
  }
}

function meetScene(t, px) {
  const [, list, plays, browserAt, editor, timeline, stuck] = CUES.meet;
  const [sx, sy] = px.shake(t, 0.75, 0.45, 4);
  px.shift(sx, sy, () => {
    px.sky(NIGHT, '#2a3f6b');
    px.stars(t);
    px.moon(286, 26);
    px.hills('#1d3354', 150, 30, t * 3, 2);
    px.hills('#162a48', 164, 18, t * 8, 6);
    px.rect('#0f1d33', 0, 160, px.W, 20);
    px.parallax(t, 24, 40, (x) => { px.rect('#16294a', x + 6, 158, 2, 2); px.rect('#16294a', x + 24, 159, 3, 1); });
  });
  // the logo slams in
  const ly = Math.round(px.tween(t, 0.1, 0.65, -40, 14, 'bounce'));
  px.text('PIXELREEL', 160, ly + 3, 40, INK, 'center');
  px.text('PIXELREEL', 160, ly, 40, GOLD, 'center', '#a5521a');
  px.confetti(t, 0.72, 30, 176, 40);
  px.confetti(t, 0.78, 290, 176, 40);
  if (t > 1.2) { px.sparkle(56, 20, t); px.sparkle(268, 46, t + 0.5); }
  const strip = t >= plays && t < editor;
  // Reelie rolls in and swallows the scenes
  if (t < editor) {
    const x = px.tween(t, 0.3, 1.1, -30, 120, 'out');
    const fast = t > list + 0.2 && t < plays + 0.4;
    reelie(px, x, 118, { r: 20, spin: t * (fast ? 14 : 3), t, walk: t < 1.4 ? t : null, mood: fast ? 'wow' : 'happy' });
    for (let i = 0; i < 3; i++) {
      const at = list + 0.25 + i * 0.35;
      if (t < list) break;
      const k = px.clamp((t - at) / 0.45, 0, 1);
      if (k >= 1) continue;
      const cx = px.lerp(28, 120, k), cy = px.lerp(92 + i * 16, 118, k) - Math.sin(k * Math.PI) * 20;
      px.window(cx - 13, cy - 9, 26, 18, [GOLD, TEAL, PINK][i]);
      px.text(['ONE', 'TWO', 'THREE'][i], cx, cy - 6, 10, INK, 'center');
    }
  }
  // out comes a strip of film, and then a browser playing it
  if (strip) {
    const reach = px.clamp((t - plays) * 160, 0, 200);
    px.clip([[140, 104, reach, 30]], () => {
      px.rect(INK, 140, 106, 200, 24);
      const shift = Math.floor(t * 30) % 22;
      for (let i = -1; i < 10; i++) {
        const fx = 140 + i * 22 + shift;
        px.rect(CREAM, fx + 3, 107, 4, 2); px.rect(CREAM, fx + 3, 127, 4, 2);
        px.rect([BLUE, PURPLE, '#2f5d8a', ORANGE][(i + 8) % 4], fx + 1, 110, 18, 16);
        px.circle(GOLD, fx + 10, 118, 3);
      }
    });
    if (t >= browserAt) {
      const k = px.tween(t, browserAt, 0.4, 0, 1, 'back');
      px.zoom(k, 252, 100, () => {
        const box = browser(px, 200, 62, 104, 76, 'my-reel');
        miniPlayer(px, box, t);
      });
    }
    if (t > plays + 0.3) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.2 + i / 3) % 1;
        px.text('~', 96 + k * 18, 84 - k * 14, 12, k > 0.8 ? MUTED : TEAL);
      }
    }
  }
  // what it is not
  if (t >= editor) {
    px.dither(NIGHT, 0, 60, px.W, 120, px.clamp((t - editor) * 4, 0, 0.5));
    const panels = [
      [editor, 18, 'VIDEO EDITOR', (x, y) => {
        px.rect('#2b2b38', x + 4, y + 18, 84, 34);
        px.rect('#101015', x + 8, y + 22, 40, 24);
        for (let i = 0; i < 5; i++) px.circle(i % 2 ? GREY : MUTED, x + 58 + (i % 3) * 10, y + 26 + Math.floor(i / 3) * 12, 3);
        px.rect(RED, x + 8, y + 48, 76, 2);
      }],
      [timeline, 116, 'TIMELINE', (x, y) => {
        [[PINK, 4, 40], [TEAL, 20, 52], [GOLD, 8, 30], [PURPLE, 30, 44]].forEach(([c, ox, w], i) => px.rect(c, x + 4 + ox, y + 20 + i * 8, w, 6));
        px.rect(RED, x + 46 + Math.round(Math.sin(t * 3) * 10), y + 18, 1, 36);
      }],
      [stuck, 214, 'RENDERING', (x, y) => {
        px.window(x + 6, y + 26, 80, 12, '#1d2b44');
        px.rect(GREEN, x + 7, y + 27, 77, 10);
        px.text('99%', x + 46, y + 40, 14, px.blink(t, 1) ? GOLD : CREAM, 'center');
        px.line('#d9d6bd', x + 76, y + 14, x + 88, y + 26); px.line('#d9d6bd', x + 82, y + 14, x + 76, y + 22);
        const d = Math.round(8 + px.bob(t, 2, 3));
        px.line('#d9d6bd', x + 20, y + 14, x + 20, y + 14 + d);
        px.sprite(SPIDER, x + 17, y + 14 + d, 1);
      }]
    ];
    for (const [at, x, label, inside] of panels) {
      if (t < at) continue;
      const y = Math.round(px.tween(t, at, 0.3, 190, 82, 'back'));
      px.window(x, y, 92, 60, '#13203a');
      px.rect(BLUE, x + 1, y + 1, 90, 12);
      px.text(label, x + 46, y + 1, 12, CREAM, 'center');
      inside(x, y);
      cross(px, x + 46, y + 32, 22, t, at + 0.55);
    }
  }
}

const SCENE_CODE = [
  'export default {', "  title: 'My reel',", '  scenes: [', '    {', "      title: 'Hello!',", "      caption: 'Read along',",
  "      say: 'Spoken aloud',", '      draw(t, px) { ... }', '    },', '    { ... },', '    { ... }', '  ]', '};'
];
const SHOPPING = ['MILK', 'EGGS', 'BREAD', 'OAT MILK?', 'THE GOOD CHEESE', 'MORE CHEESE', 'BATTERIES (WHICH?)', 'A MOP', 'BIRTHDAY CARD',
  'FOR WHO?', 'BIN BAGS', 'TEA', 'MORE TEA', 'GLITTER (WHY)', 'SOCKS', 'A SPOON', 'LIGHTBULB', 'THAT SAUCE', 'PATIENCE', 'SNACKS'];

function scenesScene(t, px) {
  const [, title, caption, sayAt, picture, thatsIt, shopping] = CUES.scenes;
  px.rect(NAVY, 0, 0, px.W, px.H);
  for (let y = 4; y < px.H; y += 8) for (let x = 4; x < px.W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
  // the reel file, typing itself
  px.window(8, 10, 184, 160, '#101a2c');
  px.rect(BLUE, 9, 11, 182, 12);
  [RED, GOLD, GREEN].forEach((c, i) => px.rect(c, 13 + i * 6, 15, 4, 4));
  px.text('reel.js', 100, 11, 12, CREAM, 'center');
  const lit = { 4: title, 5: caption, 6: sayAt, 7: picture };
  let budget = Math.floor((t - 0.2) * 70);
  SCENE_CODE.forEach((line, i) => {
    const y = 27 + i * 11, part = line.slice(0, Math.max(0, budget));
    budget -= line.length + 2;
    const at = lit[i];
    if (at !== undefined && t >= at && t < at + (i === 7 ? 99 : 1.4)) px.rect('#2c4a6e', 10, y - 1, 180, 11);
    px.text(String(i + 1), 26, y, 11, MUTED, 'right');
    let x = 32;
    for (const [piece, c] of highlight(part)) { px.text(piece, x, y, 11, c); x += px.textW(piece, 11); }
    if (at !== undefined && t >= at) px.text('<', 182 - (Math.floor(t * 4) % 2), y, 12, GOLD, 'right');
  });
  // the scene it makes, part by part
  const box = { x: 202, y: 30, w: 110, h: 62 };
  px.window(box.x - 2, box.y - 2, box.w + 4, 112, NIGHT);
  if (t >= picture) {
    const k = px.tween(t, picture, 0.35, 0, 1, 'back');
    px.zoom(k, box.x + box.w / 2, box.y + box.h / 2, () => {
      px.clip([[box.x, box.y, box.w, box.h]], () => {
        px.sky(NIGHT, '#2f5d8a');
        px.stars(t);
        px.hills('#1f3b5e', box.y + box.h, 12, t * 10, 3);
        px.sprite(HEART, box.x + box.w / 2 - 14, box.y + 16 + px.bob(t, 4, 2), 4);
      });
    });
  } else {
    for (let x = box.x; x < box.x + box.w; x += 6) { px.rect('#2b3a52', x, box.y, 3, 1); px.rect('#2b3a52', x, box.y + box.h - 1, 3, 1); }
    px.text('picture', box.x + box.w / 2, box.y + 24, 12, '#2b3a52', 'center');
  }
  px.rect('#13203a', box.x, box.y + box.h + 2, box.w, 44);
  if (t >= title) px.text('1. Hello!', box.x + 4, box.y + box.h + 3, 14, GOLD);
  if (t >= caption) px.text(px.typed('Read along...', t, caption, 20), box.x + 4, box.y + box.h + 18, 12, LIGHT);
  if (t >= sayAt) {
    for (let i = 0; i < 14; i++) {
      const h = 2 + Math.round(Math.abs(Math.sin(t * 9 + i * 1.1) * Math.sin(t * 2.3 + i * 0.4)) * 9);
      px.rect(TEAL, box.x + 50 + i * 4, box.y + box.h + 38 - h, 3, h);
    }
    px.rect(GREY, box.x + 6, box.y + box.h + 30, 6, 6);
    px.rect(GREY, box.x + 12, box.y + box.h + 28, 2, 10);
  }
  if (t >= thatsIt) {
    const k = px.tween(t, thatsIt, 0.3, 0, 1, 'back');
    px.zoom(k, 257, 150, () => px.sign("THAT'S IT!", 257, 142, 16, GOLD));
    if (t < shopping + 1) { px.sparkle(206, 140, t); px.sparkle(306, 150, t + 0.3); }
  }
  // meanwhile, the shopping list
  if (t >= shopping) {
    const drop = px.tween(t, shopping, 0.5, -200, 0, 'out'), scroll = Math.max(0, (t - shopping - 0.6) * 26);
    const x = 222, top = Math.round(4 + drop);
    px.clip([[x, 0, 92, px.H]], () => {
      px.window(x, top - 400, 90, 400 + 176, '#fffbe8');
      px.rect('#e3d6a3', x + 1, top, 88, 14);
      px.text('SHOPPING', x + 45, top + 1, 12, '#7a4a24', 'center');
      SHOPPING.forEach((item, i) => {
        const y = top + 18 + i * 11 - scroll;
        if (y > top + 14 && y < px.H) { px.rect('#d9cfa8', x + 5, y + 8, 80, 1); px.text(item, x + 6, y - 1, 11, '#3d3d3d'); }
      });
    });
  }
}

const KIT_SKY = ['#2b1a4a', '#f28a5c'];
const TREE = ['...g...', '..ggg..', '.ggggg.', '..ggg..', '.ggggg.', 'ggggggg', '...n...', '...n...'];
const BIRD = [['k...k', '.k.k.', '..k..'], ['.....', 'kk.kk', '..k..']];

function codeScene(t, px) {
  const [, , sprites, parallax, typewriter, and, confetti] = CUES.code;
  const lift = (n) => Math.round(px.tween(t, parallax, 0.35, 0, n, 'out') - px.tween(t, parallax + 0.95, 0.35, 0, n, 'inOut'));
  const [sx, sy] = px.shake(t, confetti, 0.6, 3);
  px.shift(sx, sy, () => {
    px.sky(...KIT_SKY);
    px.circle('#f39a66', 236, 104, 36);
    px.circle('#f7ad6c', 236, 104, 31);
    px.circle('#ffd27a', 236, 104, 26);
    px.shift(0, -lift(26), () => px.hills('#5b2f6b', 128, 38, t * 4, 7));
    px.shift(0, -lift(13), () => px.hills('#3d2050', 148, 20, t * 10, 3));
    px.hills('#26143a', 164, 6, t * 26, 9);
    px.parallax(t, 26, 80, (x) => px.sprite(TREE, x + 30, 144, 2));
    for (let i = 0; i < 3; i++) {
      const bx = 330 - ((t * 22 + i * 60) % 380), by = 34 + i * 9 + Math.round(Math.sin(t * 2 + i) * 3);
      px.sprite(px.frame(t + i * 0.2, 4, BIRD), bx, by, 1);
    }
    reelie(px, 96, 142, { r: 16, spin: t * 4, t, walk: t, mood: t >= confetti ? 'wow' : 'happy' });
    if (t >= parallax && t < parallax + 1.4) {
      const k = px.clamp((t - parallax) / 0.3, 0, 1);
      if (k > 0.5) {
        px.sign('FAR, SLOW', 60, 72 - lift(26), 12, '#d9b3ff');
        px.sign('MIDDLE', 160, 108 - lift(13), 12, '#ffd1e8');
        px.sign('NEAR, FAST', 262, 152, 12, GOLD);
      }
    }
  });
  px.sign('draw(t, px)', 52, 8, 12, GOLD);
  px.sign(`t = ${t.toFixed(1)}s`, 268, 8, 12, TEAL);
  if (t >= sprites && t < parallax + 0.2) {
    if (px.blink(t, 3)) {
      for (let x = 74; x < 120; x += 4) { px.rect(LIGHT, x, 118, 2, 1); px.rect(LIGHT, x, 164, 2, 1); }
      for (let y = 118; y < 165; y += 4) { px.rect(LIGHT, 74, y, 1, 2); px.rect(LIGHT, 119, y, 1, 2); }
    }
    px.sign('SPRITES', 96, 104, 12, LIGHT);
  }
  if (t >= typewriter) {
    px.window(52, 30, 216, 30, '#101a2c');
    px.rect(GOLD, 53, 31, 214, 1);
    px.type('THIS TEXT TYPES ITSELF OUT...', 60, 37, t, 16, LIGHT, typewriter + 0.1, 22);
  }
  if (t >= and && t < confetti) px.text('...', 132, 116 + px.bob(t, 10, 1), 16, GOLD);
  if (t >= confetti) {
    for (const [cx, cy, d] of [[40, 170, 0], [280, 170, 0.1], [160, 180, 0.05], [100, 175, 0.2], [220, 178, 0.15]]) px.confetti(t, confetti + d, cx, cy, 45);
    const k = px.tween(t, confetti, 0.35, 0, 1, 'back');
    px.zoom(k, 160, 82, () => px.text('CONFETTI!', 160, 70, 32, GOLD, 'center', '#a5521a'));
  }
}

const READY = [
  { type: 'list', heading: 'PICK ONE', items: ['A title', 'A list (hello)', 'A terminal', 'A chat', 'Some code'], every: 0.25, start: 0.1 },
  { type: 'terminal', title: 'terminal', lines: ['$ npm run new my-reel', 'Made reels/my-reel/reel.js', '$ npm start'] },
  { type: 'chat', title: 'Team', messages: [{ from: 'Sam', text: 'Did you read the doc?' }, { from: 'You', text: 'I watched the cartoon.' }], start: 0.2, every: 0.6 },
  { type: 'title', text: 'YOUR WORDS', sub: 'go right here' }
];
const EASEL_SCRIBBLE = [[0, 0, 3, 8], [3, 8, 8, 3], [3, 8, -2, 14], [3, 8, 7, 15], [3, 8, 4, 20], [4, 20, 0, 28], [4, 20, 9, 27]];

function readyScene(t, px) {
  const [, same, pick, , term, chat, words] = CUES.ready;
  if (t < pick + 0.15) {
    px.rect('#2a2238', 0, 0, px.W, px.H);
    px.rect('#211a2d', 0, 138, px.W, 42);
    // an easel with a very honest attempt at a person
    px.rect('#7a4a24', 142, 40, 4, 110); px.rect('#7a4a24', 196, 40, 4, 110); px.rect('#7a4a24', 168, 30, 4, 120);
    px.window(132, 36, 78, 70, LIGHT);
    const n = Math.min(EASEL_SCRIBBLE.length, Math.floor(t * 5));
    EASEL_SCRIBBLE.slice(0, n).forEach(([x0, y0, x1, y1]) => px.line(INK, 165 + x0, 52 + y0, 165 + x1, 52 + y1));
    px.ring(INK, 168, 52, 6, 1);
    reelie(px, 96, 128, { r: 18, t, mood: t >= same ? 'shy' : 'happy', spin: 0.3 });
    px.line(INK, 112, 116, 130, 98);
    if (t >= same) px.sign('SAME.', 96, 92, 14, GOLD);
    if (t < same) px.text('?', 214, 34 + px.bob(t, 5, 2), 20, GOLD);
    return;
  }
  // a telly flicking through the ready-made pictures
  const screen = { x: 12, y: 8, w: 296, h: 158 };
  const channels = [[pick + 0.15, 0], [term, 1], [chat, 2], [words, 3]];
  let ch = 0, from = pick + 0.15;
  for (const [at, c] of channels) if (t >= at) { ch = c; from = at; }
  px.rect('#2e3340', 0, 0, px.W, px.H);
  px.clip([[screen.x, screen.y, screen.w, screen.h]], () => {
    if (t - from < 0.22 && ch > 0) noise(px, screen, t);
    else px.picture(READY[ch], t - from + [0, 2.2, 0.8, 0][ch]);   // a channel is on for a moment, so start part-way in
    for (let y = screen.y; y < screen.y + screen.h; y += 2) px.rect('rgba(0, 0, 0, 0.16)', screen.x, y, screen.w, 1);
  });
  px.rect('#2e3340', screen.x, screen.y, 2, 2); px.rect('#2e3340', screen.x + screen.w - 2, screen.y, 2, 2);
  px.rect('#2e3340', screen.x, screen.y + screen.h - 2, 2, 2); px.rect('#2e3340', screen.x + screen.w - 2, screen.y + screen.h - 2, 2, 2);
  px.rect('#232733', 0, 168, px.W, 12);
  px.text(`CH ${ch + 1}  ${['LIST', 'TERMINAL', 'CHAT', 'TITLE'][ch]}`, 14, 168, 12, '#7dff9a');
  for (let i = 0; i < 4; i++) px.circle(i === ch ? GOLD : '#4a5060', 250 + i * 14, 174, 3);
}

const HEAD = ['.HHHHHH.', 'HHHHHHHH', 'HSSSSSSH', 'SkSSSSkS', 'SSSSSSSS', '.SSkkSS.', '..SSSS..'];
const VOICES = [
  ['GEORGE', '#5a3418', SKINS[0], 'ME!'], ['EMMA', '#d6a33a', SKINS[3]], ['LEWIS', '#2a1a12', SKINS[2]], ['BELLA', '#a52222', SKINS[0]],
  ['ADAM', '#6b4a2b', SKINS[1]], ['ISLA', '#1a1a1a', SKINS[2]], ['FABLE', '#c9c9c9', SKINS[3]]
];

/** A pixel cloud, a key and a bank card: the things this voice does not need. */
function cloudIcon(px, cx, cy) {
  px.rect(INK, cx - 15, cy - 3, 30, 12); px.rect(INK, cx - 9, cy - 10, 14, 10); px.rect(INK, cx + 1, cy - 7, 12, 8);
  px.rect(LIGHT, cx - 14, cy - 2, 28, 10); px.rect(LIGHT, cx - 8, cy - 9, 12, 10); px.rect(LIGHT, cx + 2, cy - 6, 10, 8);
}
function keyIcon(px, cx, cy) {
  px.ring(INK, cx - 8, cy, 7, 3); px.ring(GOLD, cx - 8, cy, 6, 2);
  px.rect(INK, cx - 2, cy - 2, 18, 5); px.rect(GOLD, cx - 1, cy - 1, 16, 3);
  px.rect(INK, cx + 8, cy + 2, 3, 5); px.rect(INK, cx + 13, cy + 2, 3, 4);
}
function cardIcon(px, cx, cy) {
  px.window(cx - 16, cy - 10, 32, 21, TEAL);
  px.rect(INK, cx - 15, cy - 5, 30, 4);
  px.rect(GOLD, cx - 12, cy + 2, 6, 5); px.rect(LIGHT, cx + 2, cy + 4, 10, 2);
}

function voiceScene(t, px) {
  const [, model, cloud, key, sub, fancy, pick, plug] = CUES.voice;
  const gaps = [[2.62, 2.98], [4.32, 4.86], [7.75, 8.2], [9.1, 9.53], [10.56, 10.79]];
  const speaking = t < 12.6 && !gaps.some(([a, b]) => t >= a && t < b);
  px.rect('#1f2c47', 0, 0, px.W, px.H);
  px.rect('#243453', 0, 0, px.W, 6);
  px.rect('#4f2f19', 0, 124, px.W, 56);
  px.rect('#6b4226', 0, 120, px.W, 6);
  // a picture on the wall and a cup of tea for company
  px.window(30, 50, 34, 26, '#7a4a24'); px.rect('#7cc4f0', 33, 53, 28, 20); px.rect(GREEN, 33, 66, 28, 7); px.circle(GOLD, 54, 58, 3);
  px.rect(LIGHT, 232, 106, 12, 14); px.rect(LIGHT, 244, 109, 3, 6);
  for (let i = 0; i < 2; i++) if (px.blink(t + i * 0.4, 0.7)) px.rect('#9aa8b8', 236 + i * 4, 98 - Math.floor(t * 5 + i * 2) % 5, 1, 4);
  // the laptop doing the talking
  px.window(108, 46, 104, 72, '#2b3a52');
  px.rect('#0d1117', 112, 50, 96, 64);
  px.rect('#9fb3c8', 98, 118, 124, 6); px.rect('#7d8fa3', 98, 122, 124, 2);
  px.rect('#16243c', 112, 50, 96, 11);
  px.text('kokoro', 117, 50, 12, CREAM);
  px.rect(GREEN, 196, 54, 4, 4);
  for (let i = 0; i < 22; i++) {
    const a = speaking ? Math.abs(Math.sin(t * 8 + i * 0.9) * Math.sin(t * 2.7 + i * 0.37)) : 0;
    const h = 2 + Math.round(a * 26);
    px.rect(TEAL, 116 + i * 4, 80 - h / 2, 3, h);
  }
  px.text('OFFLINE', 160, 101, 12, GREEN, 'center');
  if (t >= model && t < pick) {
    const k = px.tween(t, model, 0.3, 0, 1, 'back');
    px.zoom(k, 160, 140, () => { px.sign('AN OPEN SPEECH MODEL', 160, 134, 12, GOLD); });
  }
  // no cloud, no key, no subscription
  for (const [at, x, label, icon] of [[cloud, 62, 'CLOUD', cloudIcon], [key, 160, 'API KEY', keyIcon], [sub, 258, 'SUBSCRIPTION', cardIcon]]) {
    if (t < at) continue;
    const k = px.tween(t, at, 0.3, 0, 1, 'back');
    px.zoom(k, x, 22, () => { icon(px, x, 18); px.text(label, x, 31, 12, LIGHT, 'center', INK); });
    cross(px, x, 18, 11, t, at + 0.35);
  }
  // don't fancy me?
  if (t >= fancy) {
    const y = Math.round(px.tween(t, fancy, 0.35, 200, 102, 'back'));
    reelie(px, 284, y, { r: 17, t, mood: t < pick ? 'sad' : 'happy', spin: 0.4 });
    if (t < pick) {
      const drop = ((t - fancy) * 30) % 18;
      px.rect('#7fd3ff', 290, y - 2 + drop, 2, 3);
      px.text('?', 300, y - 34 + px.bob(t, 6, 1), 20, GOLD);
    }
  }
  // pick another
  if (t >= pick) {
    const slide = (t - pick) * 45, y = 142;
    px.rect('#1a253c', 0, y - 4, px.W, 40);
    VOICES.forEach(([name, hair, skin, tag], i) => {
      const x = Math.round(160 + i * 48 - slide) - 20;
      if (x < -50 || x > 330) return;
      const near = Math.abs(x + 20 - 160) < 24;
      px.window(x, y, 40, 34, near ? GOLD : LIGHT);
      px.sprite(HEAD, x + 12, y + 3, 2, false, { H: hair, S: skin });
      px.text(name, x + 20, y + 21, 10, INK, 'center');
      if (tag && near) px.sign(tag, x + 20, y - 18, 12, PINK);
    });
  }
  // or plug in another engine
  if (t >= plug) {
    const x = Math.round(px.tween(t, plug, 0.5, -80, 0, 'out'));
    px.rect(INK, x - 10, 92, 98, 4);
    px.rect('#5a5a66', x + 82, 88, 12, 12); px.rect(GREY, x + 94, 90, 6, 3); px.rect(GREY, x + 94, 95, 6, 3);
    if (t > plug + 0.5) {
      px.sparkle(106, 94, t, GOLD, 10);
      px.sign('--command', 54, 100, 12, TEAL);
    }
  }
}

function car(px, x, y, t, wobble = 0) {
  const by = y + (Math.floor(t * 8) % 2) + wobble;
  px.rect(INK, x + 8, by - 13, 30, 12); px.rect(RED, x + 9, by - 12, 28, 11);
  px.rect('#9fd8ff', x + 12, by - 10, 10, 6); px.rect('#9fd8ff', x + 24, by - 10, 10, 6);
  px.rect(INK, x, by - 3, 52, 12); px.rect(RED, x + 1, by - 2, 50, 10);
  px.rect('#a52222', x + 1, by + 4, 50, 2);
  px.rect(GOLD, x + 46, by, 5, 3); px.rect('#ff6b6b', x + 1, by, 3, 3);
  for (const wx of [x + 12, x + 40]) {
    px.circle(INK, wx, y + 9, 6); px.circle('#5a5a66', wx, y + 9, 3);
    const a = t * 12;
    px.rect(GREY, wx + Math.round(Math.cos(a) * 2), y + 9 + Math.round(Math.sin(a) * 2), 1, 1);
  }
}

function satnavScene(t, px) {
  const [, reads, moment, away] = CUES.satnav;
  const speed = t >= away ? 1 + (t - away) * 1.5 : 1;
  px.sky('#101a33', '#3b2f5c');
  px.stars(t);
  px.parallax(t, 6 * speed, 330, (x) => skyline(px, x, 132, '#1a2340', '#ffcc4d', 11, t));
  px.parallax(t, 14 * speed, 330, (x) => skyline(px, x, 140, '#141b33', null, 23, t));
  px.rect('#2a2a33', 0, 140, px.W, 40);
  px.rect('#4a4a55', 0, 140, px.W, 3);
  px.parallax(t, 120 * speed, 40, (x) => px.rect(LIGHT, x, 162, 20, 2));
  px.parallax(t, 60 * speed, 110, (x) => {
    px.rect('#3a3a44', x + 10, 92, 3, 48); px.rect('#3a3a44', x + 10, 92, 12, 3);
    px.circle('rgba(255, 220, 120, 0.25)', x + 21, 98, 7); px.rect('#ffe08a', x + 19, 95, 5, 3);
  });
  const [sx, sy] = px.shake(t, moment + 0.2, 1, 3);
  const cx = t >= away ? 70 + (t - away) * (t - away) * 60 : 70;
  car(px, cx + sx, 140 + sy, t);
  if (t >= away) for (let i = 0; i < 4; i++) px.rect(LIGHT, cx - 30 - i * 14 - ((t * 200) % 14), 130 + i * 4, 10, 1);
  if (t >= moment && t < away) px.text('?', cx + 26, 104 + px.bob(t, 9, 2), 18, GOLD);
  // the satnav
  px.rect(INK, 192, 12, 116, 72); px.rect('#33333d', 194, 14, 112, 68);
  px.rect('#123a2a', 198, 18, 104, 60);
  const lost = t >= moment && t < away;
  if (t < away) {
    px.rect('#2f6b4f', 198, 52, 104, 8); px.rect('#2f6b4f', 246, 18, 8, 60);
    if (!lost) {
      px.rect(GOLD, 248, 62, 4, 10); px.rect(GOLD, 246, 58, 8, 4); px.rect(GOLD, 248, 56, 4, 2);
      px.text('200 YDS', 204, 20, 12, LIGHT);
    } else {
      px.text('RECALCULATING', 250, 22, 12, LIGHT, 'center');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283 + t * 6;
        px.rect(i === 0 ? GOLD : '#4f8f6f', 250 + Math.cos(a) * 12, 52 + Math.sin(a) * 12, 3, 3);
      }
    }
  } else {
    px.text('NOW PLAYING', 250, 20, 12, GOLD, 'center');
    px.sprite(['k......', 'kk.....', 'kgk....', 'kggk...', 'kgggk..', 'kggk...', 'kgk....', 'kk.....', 'k......'], 236, 38, 2);
    px.text('MY NEW REEL', 250, 60, 12, LIGHT, 'center');
  }
  px.rect('#55555f', 244, 84, 12, 8); px.rect('#3a3a44', 236, 90, 28, 3);
  if (t >= reads && t < moment) says(px, 'In two hundred yards, press Play.', 22, 22, t, reads + 0.1, null, 12, 150);
  if (t >= moment && t < away) says(px, 'Turn around. No, wait. Left. Ish.', 22, 22, t, moment + 0.1, null, 12, 150);
  if (t >= away) says(px, 'You have arrived. Enjoy the show.', 22, 22, t, away + 0.2, null, 12, 150);
}

const CLICKS = [[2.39, 104, 155], [3.05, 152, 155], [4.92, 205, 155]];
const CURSOR = [[0, 268, 172], [2.1, 268, 172], [2.39, 104, 156], [2.8, 104, 156], [3.05, 152, 156], [3.5, 152, 156], [3.65, 150, 108],
  [3.9, 110, 108], [4.2, 190, 108], [4.5, 120, 108], [4.75, 170, 108], [4.92, 205, 156], [5.6, 205, 156], [6.3, 270, 174], [9, 270, 174]];

function controlsScene(t, px) {
  const [, pauseAt, skipAt, dragAt, offAt, rude, fine] = CUES.controls;
  px.rect(NIGHT, 0, 0, px.W, px.H);
  for (let y = 4; y < px.H; y += 8) for (let x = 4; x < px.W; x += 8) px.rect('#152038', x, y, 1, 1);
  // the mini player's own clock: frozen while paused, dragged back and forth while scrubbed
  let mt = t;
  const paused = t >= pauseAt + 0.12 && t < skipAt + 0.1;
  if (paused) mt = pauseAt + 0.12;
  const dragging = t >= dragAt + 0.25 && t < offAt;
  const handle = dragging ? 150 + Math.sin((t - dragAt - 0.25) * 6) * 46 : 30 + ((t * 9) % 220);
  if (dragging) mt = 2 + (handle - 104) / 30;
  const muted = t >= offAt + 0.15;
  const pic = { x: 34, y: 12, w: 252, h: 92 };
  px.window(30, 8, 260, 162, '#0b1220');
  const drawA = () => px.clip([[pic.x, pic.y, pic.w, pic.h]], () => {
    px.sky(NIGHT, '#2f5d8a');
    px.stars(mt);
    px.hills('#1f3b5e', pic.y + pic.h, 16, mt * 14, 4);
    reelie(px, 160 + Math.sin(mt * 1.3) * 60, 64 + px.bob(mt, 5, 2), { r: 18, spin: mt * 2, t: mt, mood: muted ? (t >= fine ? 'shy' : t >= rude ? 'cross' : 'happy') : 'talk' });
  });
  const drawB = () => px.clip([[pic.x, pic.y, pic.w, pic.h]], () => {
    px.sky(...KIT_SKY);
    px.circle('#ffd27a', 240, 80, 18);
    px.hills('#3d2050', pic.y + pic.h, 14, mt * 14, 3);
    reelie(px, 160 + Math.sin(mt * 1.3) * 60, 64 + px.bob(mt, 5, 2), { r: 18, spin: mt * 2, t: mt, mood: muted ? (t >= fine ? 'shy' : t >= rude ? 'cross' : 'happy') : 'talk' });
  });
  if (t < skipAt + 0.1) drawA();
  else if (t < skipAt + 0.6) px.transition('slide', (t - skipAt - 0.1) / 0.5, drawA, drawB, pic);
  else drawB();
  if (paused) { px.rect('rgba(0, 0, 0, 0.35)', pic.x, pic.y, pic.w, pic.h); px.text('PAUSED', 160, 44, 20, LIGHT, 'center', INK); }
  if (muted) {
    const rx = 160 + Math.sin(mt * 1.3) * 60, ry = 64 + px.bob(mt, 5, 2) + 4;
    px.rect('#e8d9a8', rx - 8, ry - 1, 16, 4); px.rect('#d4c48f', rx - 6, ry - 3, 4, 8); px.rect('#d4c48f', rx + 2, ry - 3, 4, 8);
    if (t >= rude) px.sign(t >= fine ? '...FINE.' : 'RUDE.', rx + 34, ry - 40, 14, t >= fine ? CREAM : PINK);
  }
  // progress bar, caption, buttons
  px.rect('#22344f', 34, 105, 252, 5);
  px.rect(GOLD, 34, 105, Math.round(handle - 34), 5);
  px.rect(LIGHT, Math.round(handle) - 2, 103, 5, 9);
  px.rect('#13203a', 34, 111, 252, 29);
  px.text('8. Captions and controls', 40, 111, 12, GOLD);
  px.text(px.typed('Captions type along as I talk.', t, 0.2, 14), 40, 125, 12, LIGHT);
  const buttons = [[36, 40, 'BACK'], [80, 48, paused ? 'PLAY' : 'PAUSE'], [132, 40, 'NEXT'], [176, 64, muted ? 'SOUND: OFF' : 'SOUND: ON']];
  for (const [x, w, label] of buttons) {
    const pressed = CLICKS.some(([at, cx]) => t >= at && t < at + 0.15 && cx > x && cx < x + w);
    px.window(x, 146 + (pressed ? 1 : 0), w, 18, pressed ? GOLD : BLUE);
    px.text(label, x + w / 2, 148 + (pressed ? 1 : 0), 12, pressed ? INK : CREAM, 'center');
  }
  for (const [at, cx, cy] of CLICKS) if (t >= at && t < at + 0.35) px.ring(LIGHT, cx, cy, 3 + Math.round((t - at) * 30), 1);
  let i = 0;
  while (i < CURSOR.length - 2 && CURSOR[i + 1][0] <= t) i++;
  const [ta, xa, ya] = CURSOR[i], [tb, xb, yb] = CURSOR[i + 1];
  const k = px.EASE.inOut(px.clamp((t - ta) / Math.max(0.01, tb - ta), 0, 1));
  px.sprite(POINTER, px.lerp(xa, xb, k), px.lerp(ya, yb, k), 1);
}

const MINI_KINDS = [['fade', 14, 24], ['wipe', 116, 24], ['dissolve', 218, 24], ['slide', 65, 98], ['iris', 167, 98]];

function miniDay(px, b) {
  px.rect('#7cc4f0', b.x, b.y, b.w, b.h);
  px.circle('#ffd27a', b.x + b.w - 16, b.y + 13, 7);
  px.rect('#3fa34d', b.x, b.y + b.h - 13, b.w, 13); px.rect('#2a7a35', b.x, b.y + b.h - 13, b.w, 2);
  px.rect('#7a4a24', b.x + 20, b.y + b.h - 22, 3, 10); px.circle('#2a7a35', b.x + 21, b.y + b.h - 25, 6);
}
function miniNight(px, b) {
  px.rect('#101c36', b.x, b.y, b.w, b.h);
  for (let i = 0; i < 12; i++) px.rect(LIGHT, b.x + ((i * 37) % b.w), b.y + ((i * 23) % (b.h - 16)), 1, 1);
  px.circle(LIGHT, b.x + 18, b.y + 12, 6); px.circle('#101c36', b.x + 21, b.y + 10, 5);
  px.rect('#1f3b5e', b.x, b.y + b.h - 13, b.w, 13);
}

/** A little screen playing transition `kind` on a loop: day to night and back. */
function miniTransition(px, kind, t, b) {
  const p = (t % 2.4);
  if (p < 0.4) miniDay(px, b);
  else if (p < 1.2) px.transition(kind, (p - 0.4) / 0.8, () => miniDay(px, b), () => miniNight(px, b), b);
  else if (p < 1.6) miniNight(px, b);
  else px.transition(kind, (p - 1.6) / 0.8, () => miniNight(px, b), () => miniDay(px, b), b);
}

function wipesScene(t, px) {
  const [, , , , , cartoonAt, starAt, proud] = CUES.wipes;
  px.rect(NAVY, 0, 0, px.W, px.H);
  for (let y = 4; y < px.H; y += 8) for (let x = 4; x < px.W; x += 8) px.rect('#1a2b47', x, y, 1, 1);
  if (t < cartoonAt + 0.3) {
    const away = px.tween(t, cartoonAt, 0.3, 0, 1, 'in');
    px.shift(0, away * 190, () => {
      px.sign('TRANSITIONS', 160, 4, 14, GOLD);
      MINI_KINDS.forEach(([kind, x, y], i) => {
        const on = t >= CUES.wipes[i] && (i === 4 || t < CUES.wipes[i + 1]);
        px.window(x - 2, y - 2, 92, 54, on ? GOLD : INK);
        if (on) px.window(x - 3, y - 3, 94, 56, GOLD);
        miniTransition(px, kind, t + i * 0.45, { x, y, w: 88, h: 50 });
        px.sign(kind.toUpperCase(), x + 44, y + 54, 12, on ? GOLD : CREAM);
      });
    });
    return;
  }
  // a proper old cartoon ending, then the one nobody asked for
  const box = { x: 40, y: 16, w: 240, h: 132 };
  px.window(box.x - 2, box.y - 2, box.w + 4, box.h + 4, INK);
  const cartoon = () => {
    px.rect('#f2d28a', box.x, box.y, box.w, box.h);
    for (let r = 160; r > 0; r -= 16) px.circle(r % 32 ? '#e8bf6a' : '#f2d28a', box.x + box.w / 2, box.y + box.h / 2, r);
    reelie(px, box.x + box.w / 2, box.y + box.h / 2 + 4, { r: 30, t: t - cartoonAt > 1 ? 3.6 : 0, mood: 'happy', spin: 0.2 });
  };
  const sparkly = () => {
    px.rect('#3a1d6b', box.x, box.y, box.w, box.h);
    for (let i = 0; i < 24; i++) px.sparkle(box.x + Math.round(px.rand(i) * box.w), box.y + Math.round(px.rand(i + 50) * box.h), t + i * 0.3, i % 2 ? GOLD : PINK);
    px.text('STAR WIPE', box.x + box.w / 2, box.y + 46, 32, GOLD, 'center', '#a52222');
  };
  px.clip([[box.x, box.y, box.w, box.h]], () => {
    if (t < starAt) {
      cartoon();
      const r = Math.max(0, px.tween(t, cartoonAt + 0.3, 0.8, 150, 40, 'out') - px.tween(t, cartoonAt + 1.4, 0.4, 0, 40, 'in'));
      for (let y = box.y; y < box.y + box.h; y++) {
        const dy = y + 0.5 - (box.y + box.h / 2 + 2), half = Math.abs(dy) < r ? Math.sqrt(r * r - dy * dy) : 0;
        const cx = box.x + box.w / 2;
        px.rect(INK, box.x, y, Math.max(0, Math.round(cx - half - box.x)), 1);
        px.rect(INK, Math.round(cx + half), y, Math.max(0, Math.round(box.x + box.w - cx - half)), 1);
      }
    } else if (t < starAt + 1.1) {
      px.transition('star', (t - starAt) / 1.1, () => px.rect(INK, box.x, box.y, box.w, box.h), sparkly, box);
    } else sparkly();
  });
  px.sign(t < starAt ? 'LIKE AN OLD CARTOON' : 'WHY', 160, 156, 12, t < starAt ? CREAM : PINK);
  if (t >= proud) {
    const y = Math.round(px.tween(t, proud, 0.3, 220, 150, 'back'));
    reelie(px, 292, y, { r: 15, t, mood: 'shy' });
    px.rect('#7fd3ff', 302, y - 14, 2, 3);
    px.sign('NOT PROUD', 250, y - 34, 12, GOLD);
  }
}

/** Vignettes one after another, wiping between them on the cues. */
function vignettes(px, t, cues, draws, kind = 'wipe') {
  let i = 0;
  while (i < cues.length - 1 && t >= cues[i + 1]) i++;
  const lt = t - cues[i];
  if (i > 0 && lt < 0.45) px.transition(kind, lt / 0.45, () => draws[i - 1](px, t - cues[i - 1]), () => draws[i](px, lt));
  else draws[i](px, lt);
  return i;
}

function badge(px, n) {
  px.sign(`USE CASE ${n}`, 276, 4, 12, PINK);
}

const ROCKET = ['....w....', '...www...', '..wwbww..', '..wbtbw..', '..wwbww..', '..wwwww..', '..wwwww..', '.rwwwwwr.', 'rrwwwwwrr', 'rr.www.rr', 'r...o...r'];

function helpsScene(t, px) {
  const draws = [
    (px, lt) => {
      px.sky(NIGHT, '#24476b');
      px.stars(t);
      const k = px.tween(lt, 0, 0.4, 0, 1, 'back');
      px.zoom(k, 160, 70, () => px.text('WHERE DOES IT HELP?', 160, 56, 24, GOLD, 'center', INK));
      reelie(px, 160, 128, { r: 18, t, mood: 'wow', spin: t });
    },
    (px, lt) => {
      px.rect('#2c3e5c', 0, 0, px.W, px.H);
      px.rect('#3b2c2a', 0, 150, px.W, 30);
      px.rect('#22314c', 20, 60, 44, 90); px.rect('#18233a', 24, 64, 36, 86); px.rect(GOLD, 54, 104, 3, 3);
      for (let i = 0; i < 16; i++) {
        const x = i * 20 + 6, c = [RED, GOLD, TEAL, PINK][i % 4];
        px.rect(c, x, 14, 10, 4); px.rect(c, x + 2, 18, 6, 3); px.rect(c, x + 4, 21, 2, 2);
      }
      px.line(CREAM, 0, 13, 320, 13);
      px.sign('WELCOME, NEW HUMAN!', 160, 30, 16, GOLD);
      px.window(196, 58, 100, 64, INK);
      miniPlayer(px, { x: 198, y: 60, w: 96, h: 60 }, t);
      px.text('ONBOARDING, 2 MIN', 246, 124, 10, CREAM, 'center');
      const x = Math.round(px.tween(lt, 0.1, 1.2, -20, 110, 'out'));
      person(px, x, 120, { hair: '#2a1a12', skin: SKINS[2], top: PURPLE, legs: '#2b3a52' });
      px.rect(GOLD, x + 7, 134, 2, 4); px.rect(LIGHT, x + 5, 138, 6, 4);
      px.window(x + 14, 136, 18, 12, '#b08a5a');
      for (const [bx, c] of [[150, RED], [170, TEAL], [188, GOLD]]) {
        const by = 64 + px.bob(t + bx, 2, 3);
        px.line(CREAM, bx, by + 7, bx + 2, by + 34); px.circle(c, bx, by, 7); px.rect(LIGHT, bx - 3, by - 4, 2, 2);
      }
      badge(px, 1);
    },
    (px, lt) => {
      px.sky('#0b1220', '#3b2f5c');
      px.stars(t);
      px.rect('#1a1f2e', 0, 150, px.W, 30);
      px.rect('#4a4a55', 76, 70, 4, 80); for (let y = 74; y < 150; y += 8) px.line('#4a4a55', 80, y, 92, y + 8);
      const lift = Math.max(0, lt - 0.6), ry = 104 - lift * lift * 40;
      if (lt > 0.4) {
        for (let i = 0; i < 26; i++) {
          const age = (lt * 3 + i * 0.13) % 1, wx = 104 + (px.rand(i) - 0.5) * 10 * (1 + age * 3), wy = ry + 44 + age * 30;
          px.rect(age < 0.4 ? GOLD : age < 0.7 ? ORANGE : '#6b6b77', wx, wy, 3, 3);
        }
      }
      px.sprite(ROCKET, 91, ry - 10, 3, false, { b: BLUE, t: TEAL });
      px.text('v2.0', 104, ry + 22, 10, INK, 'center');
      px.window(170, 40, 130, 82, INK);
      miniPlayer(px, { x: 172, y: 42, w: 126, h: 64 }, t);
      px.text("WHAT'S NEW IN 2.0", 235, 108, 12, GOLD, 'center');
      for (let i = 0; i < 14; i++) px.rect('#0b0f18', 166 + i * 10, 140 + (i % 3), 6, 10 - (i % 3));
      badge(px, 2);
    },
    (px, lt) => {
      px.rect('#0d1117', 0, 0, px.W, px.H);
      px.window(8, 10, 196, 160, '#161b22');
      px.rect('#21262d', 9, 11, 194, 14);
      px.text('Pull request: add dark mode', 14, 12, 12, LIGHT);
      px.rect('#2d333b', 9, 25, 194, 12);
      px.text('login.js', 14, 25, 11, GREY);
      px.text('+120', 158, 25, 11, GREEN); px.text('-3', 186, 25, 11, RED);
      const rows = ['=', '-', '-', '+', '+', '+', '=', '+', '+', '=', '-', '+', '+'];
      rows.forEach((kind, i) => {
        const y = 40 + i * 10;
        if (kind !== '=') px.rect(kind === '+' ? '#12361f' : '#3d1518', 9, y, 194, 10);
        px.text(kind === '=' ? ' ' : kind, 14, y - 1, 11, kind === '+' ? GREEN : RED);
        px.rect(kind === '=' ? '#4b535d' : kind === '+' ? '#5fcf7f' : '#e06b6b', 24, y + 3, 40 + ((i * 37) % 110), 3);
      });
      stamp(px, 'LGTM', 106, 100, lt, 1.7, GREEN, 20);
      px.window(214, 26, 98, 62, INK);
      miniPlayer(px, { x: 216, y: 28, w: 94, h: 58 }, t);
      px.text('THE PR, EXPLAINED', 263, 90, 10, CREAM, 'center');
      person(px, 248, 112, { hair: '#d6d6d6', skin: SKINS[3], top: TEAL });
      px.rect(INK, 249, 117, 5, 3); px.rect(INK, 256, 117, 5, 3); px.rect(INK, 254, 118, 2, 1);
      if (lt > 1.7) px.text('NICE', 272, 106 + px.bob(t, 8, 1), 12, GOLD);
      badge(px, 3);
    },
    (px, lt) => {
      px.rect('#3b4a3a', 0, 0, px.W, px.H);
      px.rect('#5a3418', 0, 150, px.W, 30);
      px.window(46, 10, 228, 84, '#7a4a24');
      px.rect('#244232', 50, 14, 220, 76);
      px.text('VOLCANOES', 70, 18, 16, '#e8e4d4');
      px.rect('#d9d4c0', 150, 82, 80, 2);
      for (let i = 0; i < 18; i++) px.rect('#d9d4c0', 160 + i * 2, 82 - Math.min(i, 17 - i) * 3, 2, 2);
      for (let i = 0; i < 20; i++) {
        const age = (lt * 1.5 + i * 0.09) % 1;
        px.rect(i % 3 ? '#ff8c5a' : GOLD, 177 + (px.rand(i) - 0.5) * 60 * age, 56 - Math.sin(age * 3) * 30 + age * age * 30, 2, 2);
      }
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 4; i++) {
          const x = 52 + i * 58 + row * 14, y = 104 + row * 30;
          px.rect('#7a4a24', x - 4, y + 18, 34, 4);
          px.sprite(['.HHHH.', 'HHHHHH', 'HHHHHH', '.SSSS.', 'CCCCCC', 'CCCCCC'], x + 6, y, 2, false,
            { H: ['#2a1a12', '#d6a33a', '#5a3418', '#1a1a1a'][(i + row) % 4], S: SKINS[(i + row * 2) % 4], C: [TEAL, PINK, GOLD, PURPLE][(i + row) % 4] });
        }
      }
      const kid = { x: 238, y: 134 };
      px.sign('!', kid.x + 6, kid.y - 22 + px.bob(t, 10, 1), 12, GOLD);
      px.text('BACK ROW: AWAKE', 160, 166, 12, CREAM, 'center');
      badge(px, 4);
    }
  ];
  vignettes(px, t, CUES.helps, draws);
}

const KNIGHT = ['..eee...', '.eeeee..', '.ekkke..', '.eeeee..', '..eee...', 'reeeeer.', 'reeeeerw', '.eeeee.w', '.ee.ee.w', '.kk.kk..'];
const DRAGON = [
  '.......gg....', '......gggg...', '.....ggkgg...', 'gg..gggggg...', 'ggggggggggggg', '.gggggggggg..', '..ggggggg....',
  '..gg...gg....', '..kk...kk....'
];
const BOSS_CHAT = {
  type: 'chat', title: 'Boss', start: 0.3, every: 1.35, messages: [
    { from: 'Boss', text: 'Status update?' }, { from: 'You', text: 'Made you a two minute cartoon.' },
    { from: 'Boss', text: 'Watched it twice.' }, { from: 'Boss', text: 'Can every update be a cartoon?' }
  ]
};

function alsoScene(t, px) {
  const draws = [
    (px, lt) => {
      px.rect('#1d2b44', 0, 0, px.W, px.H);
      px.window(30, 14, 260, 146, '#f4f1de');
      px.text('PROFIT, PROBABLY', 44, 20, 16, INK);
      px.rect(INK, 48, 140, 220, 2); px.rect(INK, 48, 52, 2, 90);
      [24, 38, 56, 80].forEach((h, i) => {
        const hh = Math.round(px.tween(lt, i * 0.12, 0.4, 0, h, 'out'));
        px.rect([TEAL, BLUE, PURPLE, PINK][i], 66 + i * 34, 140 - hh, 24, hh);
      });
      const k = px.clamp((lt - 0.45) / 0.6, 0, 1);
      for (let i = 0; i < k * 60; i++) px.rect(GREEN, 70 + i * 3.2, 130 - i * i * 0.04 - i * 0.6, 3, 3);
      if (k >= 1) px.sign('TO THE MOON', 236, 30, 12, GOLD);
      badge(px, 5);
    },
    (px, lt) => {
      px.sky('#2a0f1a', '#a5341f');
      px.rect('#1a0a10', 0, 120, px.W, 60);
      for (const [x, w, h] of [[30, 20, 50], [52, 40, 30], [94, 16, 60], [112, 36, 34]]) px.rect('#1a0a10', x, 120 - h, w, h);
      px.sprite(KNIGHT, 70, 96, 3);
      px.sprite(DRAGON, 196, 82, 4, true);
      for (let i = 0; i < 24; i++) {
        const age = (lt * 2.5 + i * 0.07) % 1;
        px.rect(age < 0.5 ? GOLD : ORANGE, 196 - age * 90, 104 + (px.rand(i) - 0.5) * 18 * age, 3, 3);
      }
      px.rect(INK, 0, 0, px.W, 18); px.rect(INK, 0, 162, px.W, 18);
      px.text('COMING SOON', 160, 22, 24, GOLD, 'center', '#5a1a0a');
      px.text('IN GLORIOUS 320 x 180', 160, 146, 12, CREAM, 'center');
      badge(px, 6);
    },
    (px, lt) => { px.picture(BOSS_CHAT, lt); badge(px, 7); },
    (px) => {
      const eyes = CUES.also[5];
      const seen = t >= eyes;
      px.rect('#141a26', 0, 0, px.W, px.H);
      paper(px, 74, 14, 172, 152, null, { fill: '#f4f1de', lines: false });
      px.text('CHANGELOG.md', 82, 18, 14, INK);
      ['## 2.1.0', '- Fixed the thing', '- Fixed the other thing', '## 2.0.0', '- Everything changed'].forEach((l, i) => px.text(l, 84, 40 + i * 14, 12, l.startsWith('#') ? BLUE : '#3d3d3d'));
      if (!seen) {
        for (const [x, y, s] of [[76, 16, 1], [244, 16, -1]]) for (let i = 0; i < 4; i++) px.line('#b9b6a0', x, y, x + s * (8 + i * 6), y + 14 - i * 3);
        for (let i = 0; i < 10; i++) px.rect('#6f6a5a', 80 + px.rand(i) * 160, 30 + ((t * 8 + i * 15) % 130), 1, 1);
      }
      px.sign(`VIEWS: ${seen ? 1 : 0}`, 282, 28, 12, seen ? GOLD : MUTED);
      if (seen) {
        const k = px.tween(t, eyes, 0.4, 0, 1, 'back'), cx = 52, cy = 120;
        px.zoom(k, cx, cy, () => {
          px.circle(INK, cx, cy, 22); px.circle(LIGHT, cx, cy, 21);
          px.circle('#3a7bd5', cx + 6, cy - 2, 10); px.circle(INK, cx + 7, cy - 2, 5); px.rect(LIGHT, cx + 3, cy - 7, 3, 3);
          if ((t % 2.4) > 2.25) px.rect('#f2c194', cx - 21, cy - 21, 43, 43);
        });
        px.confetti(t, eyes + 0.2, 160, 90, 40);
        px.sign('FIRST HUMAN VIEW!', 160, 150, 14, GOLD);
      }
      badge(px, 8);
    }
  ];
  vignettes(px, t, [0, CUES.also[1], CUES.also[2], CUES.also[4]], draws);
}

function server(px, x, y, t) {
  px.window(x, y, 40, 60, '#2b3a52');
  for (let i = 0; i < 4; i++) {
    px.rect('#16243c', x + 4, y + 5 + i * 13, 32, 10);
    px.rect(px.blink(t + i * 0.3, 2) ? GREEN : '#1f5f2f', x + 30, y + 8 + i * 13, 3, 3);
  }
}

function anywhereScene(t, px) {
  const [, goes, pages, host, banner, clicked] = CUES.anywhere;
  px.sky('#4f97cf', '#cfe9f7');
  px.clouds(t, 10, 5, LIGHT, 4, 3);
  px.hills('#5fae5a', 172, 16, t * 2, 4);
  px.hills('#4a9447', 180, 8, t * 4, 8);
  // the laptop and its handful of files
  px.window(18, 112, 84, 50, '#2b3a52'); px.rect('#0d1117', 22, 116, 76, 42);
  px.rect('#9fb3c8', 10, 162, 100, 6);
  px.text('my-reel/', 26, 118, 12, GOLD);
  const files = ['index.html', 'reel.js', 'audio/'];
  const spots = [[250, 36], [170, 96], [254, 110]];
  if (t < goes + 0.6) px.sign('JUST STATIC FILES', 60, 92, 12, GOLD);
  files.forEach((name, i) => {
    let x = 34 + i * 26, y = 138;
    if (t >= goes) {
      const at = [pages, host, banner][i] - 1.0, k = px.EASE.inOut(px.clamp((t - at) / 0.9, 0, 1));
      x = px.lerp(x, spots[i][0], k); y = px.lerp(y, spots[i][1], k) - Math.sin(k * Math.PI) * 40;
    }
    px.window(x - 6, y - 8, 12, 15, LIGHT); px.rect(GOLD, x - 3, y - 4, 6, 2); px.rect(MUTED, x - 3, y, 6, 1);
    if (t < goes + 0.6) px.text(name, x, y + 8, 8, GREY, 'center');
  });
  // where they can go
  if (t >= pages) {
    const k = px.tween(t, pages, 0.3, 0, 1, 'back');
    px.zoom(k, 250, 34, () => { cloudIcon(px, 250, 34); px.text('GITHUB PAGES', 250, 46, 12, BLUE, 'center', LIGHT); });
  }
  if (t >= host) {
    const k = px.tween(t, host, 0.3, 0, 1, 'back');
    px.zoom(k, 170, 100, () => { server(px, 150, 70, t); px.text('ANY WEB HOST', 170, 132, 12, BLUE, 'center', LIGHT); });
  }
  if (t >= banner) {
    // a README with a banner in it, which grows to fill the screen at the end
    const g = px.tween(t, clicked, 0.6, 0, 1, 'inOut');
    const r = { x: px.lerp(204, 26, g), y: px.lerp(64, 8, g), w: px.lerp(108, 268, g), h: px.lerp(104, 164, g) };
    const k = px.tween(t, banner, 0.3, 0, 1, 'back');
    px.zoom(k, r.x + r.w / 2, r.y + r.h / 2, () => {
      const box = browser(px, r.x, r.y, r.w, r.h, g > 0.5 ? 'README.md' : '');
      px.text('# my-project', box.x + 4, box.y + 2, g > 0.5 ? 16 : 12, INK);
      const bh = Math.round(box.h * 0.5), b = { x: box.x + 4, y: box.y + (g > 0.5 ? 22 : 16), w: box.w - 8, h: bh };
      miniPlayer(px, b, t);
      for (let ly = b.y + b.h + 6; ly < box.y + box.h - 4; ly += 7) px.rect('#b9b6a0', box.x + 4, ly, box.w - 12 - ((ly * 5) % 30), 3);
      if (g >= 1) {
        const hk = px.tween(t, clicked + 0.6, 0.5, 0, 1, 'out');
        const hx = px.lerp(300, b.x + b.w * 0.6, hk), hy = px.lerp(190, b.y + b.h * 0.55, hk);
        if (t > clicked + 1.15 && t < clicked + 1.5) px.ring(GOLD, b.x + b.w * 0.6 + 3, b.y + b.h * 0.55, 3 + Math.round((t - clicked - 1.15) * 40), 1);
        if (t > clicked + 1.2) {
          px.sign('YOU ARE HERE', b.x + b.w / 2, b.y + b.h + 8 + px.bob(t, 6, 1), 16, GOLD);
          px.sparkle(b.x + 10, b.y + 8, t); px.sparkle(b.x + b.w - 10, b.y + 12, t + 0.4);
        }
        px.sprite(HAND, hx, hy, 2);
      }
    });
  }
}

const ROBOT = [
  '....y....', '....k....', '.kkkkkkk.', '.keeeeek.', '.ketetek.', '.keeeeek.', '.kkkkkkk.', '..kkkkk..', 'kkeeeeekk', 'k.eeeee.k',
  'k.ekeke.k', '..eeeee..', '..kk.kk..'
];

function robotsScene(t, px) {
  const [, robots, notes, ci, agent, payrise] = CUES.robots;
  px.rect('#2a3346', 0, 0, px.W, px.H);
  px.rect('#323d54', 0, 0, px.W, 10);
  for (let x = 20; x < px.W; x += 70) { px.rect('#3d4a63', x, 10, 6, 70); px.rect('#3d4a63', x - 4, 76, 14, 6); }
  px.rect('#1e2433', 0, 146, px.W, 34);
  // the conveyor belt
  px.rect('#11151f', 0, 132, px.W, 14);
  px.parallax(t, -30, 16, (x) => px.rect('#3a4256', x, 134, 8, 3));
  for (let x = 6; x < px.W; x += 24) { px.circle('#5a6378', x, 145, 3); px.rect('#11151f', x - 1, 144, 2, 2); }
  // data floating up at the start
  if (t < robots + 1) {
    ["{ title: 'Hello' }", "{ say: '...' }", "{ picture: 'list' }"].forEach((snip, i) => {
      const k = (t * 0.25 + i / 3) % 1;
      px.text(snip, 40 + i * 90, 120 - k * 90, 12, k > 0.8 ? '#4d5b75' : TEAL);
    });
  }
  // the machine that makes reels
  px.window(130, 70, 64, 62, '#4a5570');
  px.rect('#11151f', 134, 112, 56, 20);
  px.text('npm run new', 162, 74, 11, LIGHT, 'center');
  for (let i = 0; i < 3; i++) px.rect(px.blink(t + i * 0.25, 3) ? [GREEN, GOLD, RED][i] : '#2b3346', 146 + i * 12, 92, 6, 6);
  if (t >= notes) {
    const flow = (t - notes) * 34;
    for (let i = 0; i < 8; i++) {
      const x = flow - i * 58 - 20;
      if (x < -30 || x > 340) continue;
      if (x < 134) paper(px, x - 9, 112, 20, 20, null, { lines: true });
      else if (x > 186) {
        const tag = t >= ci && x > 250 ? `v1.${i}` : null;
        reelie(px, x, 124, { r: 8, spin: t * 4, t, mood: 'happy' });
        if (tag) px.sign(tag, x, 98, 10, GOLD);
      }
    }
  }
  // CI, stamping a version on each one
  if (t >= ci) {
    const down = Math.abs(Math.sin((t - ci) * 3.2)) ** 6;
    px.rect('#5a6378', 266, 0, 8, 40 + down * 40);
    px.window(258, 36 + down * 40, 24, 14, GOLD);
    px.sign('CI', 296, 16, 14, GREEN);
  }
  // the AI agent
  if (t >= robots) {
    const y = Math.round(px.tween(t, robots, 0.4, 190, 64, 'back'));
    const typing = t >= agent;
    px.sprite(ROBOT, 20, y, 4, false, { e: '#8fa3b8', t: typing ? GOLD : TEAL });
    if (!typing && t < notes) px.rect(GREY, 58 + Math.round(Math.sin(t * 10) * 3), y + 30, 4, 10);
    if (typing) {
      px.window(16, y + 54, 48, 8, '#3a4256');
      for (let i = 0; i < 6; i++) if (px.blink(t * 3 + i * 0.37, 6)) px.rect(GOLD, 20 + i * 7, y + 56, 4, 3);
      for (let i = 0; i < 5; i++) {
        const k = ((t - agent) * 1.6 + i / 5) % 1;
        px.text(['draw(t, px)', 'caption:', 'say:', 'picture:', 'scenes: ['][i], 66 + k * 50, y + 10 - k * 40 + i * 3, 10, k > 0.8 ? MUTED : TEAL);
      }
      px.sign('AI AGENT', 38, y - 18, 12, PINK);
    }
    if (t >= payrise) {
      const k = px.tween(t, payrise, 0.35, 0, 1, 'back');
      px.zoom(k, 112, 40, () => {
        px.window(72, 20, 96, 34, LIGHT);
        px.text('WILL WORK FOR', 120, 22, 12, INK, 'center');
        px.text('ELECTRICITY', 120, 36, 14, RED, 'center');
      });
    }
  }
}

const MAKE_LINES = [
  ['$ git clone https://github.com/OllySalanson/pixelreel', "Cloning into 'pixelreel'... done."],
  ['$ cd pixelreel && npm start', 'pixelreel is playing at http://localhost:8000/'],
  ['$ npm run new my-reel', 'Made reels/my-reel/reel.js'],
  ['$ npm run voices my-reel', '8 clips (8 new), 1.9 minutes of speech.']
];

function makeScene(t, px) {
  const [, clone, start, make, record, thatsIt, hardest] = CUES.make;
  px.rect(NIGHT, 0, 0, px.W, px.H);
  px.window(8, 8, 304, 112, '#0d1117');
  px.rect(BLUE, 9, 9, 302, 12);
  [RED, GOLD, GREEN].forEach((c, i) => px.rect(c, 13 + i * 6, 13, 4, 4));
  px.text('terminal', 160, 9, 12, CREAM, 'center');
  let at = 0;
  MAKE_LINES.forEach(([cmd, out], i) => {
    at = Math.max([clone, start, make, record][i], at);
    const y = 26 + i * 23;
    if (t < at) return;
    const typed = px.typed(cmd, t, at, 70);
    px.text(typed.slice(0, 1), 14, y, 12, TEAL);
    px.text(typed.slice(1), 20, y, 12, LIGHT);
    const done = at + cmd.length / 70;
    if (t < done) px.rect(LIGHT, 21 + px.textW(typed.slice(1), 12), y + 2, 4, 9);
    else if (t > done + 0.15) px.text(out, 20, y + 10, 11, GREY);
    at = done + 0.1;
  });
  // a stopwatch racing to a minute
  const secs = Math.min(59, Math.floor((t / thatsIt) * 59));
  px.circle(INK, 64, 150, 25); px.circle(LIGHT, 64, 150, 23); px.rect(INK, 60, 120, 8, 6); px.rect(GREY, 61, 121, 6, 4);
  const a = (secs / 60) * 6.283 - 1.5708;
  // the hand turns above a little readout window, never through it
  px.line(RED, 64, 143, 64 + Math.cos(a) * 12, 143 + Math.sin(a) * 12);
  px.rect(INK, 63, 142, 3, 3);
  px.window(53, 157, 22, 13, '#cfe3b5');
  px.text(`0:${String(secs).padStart(2, '0')}`, 64, 158, 12, INK, 'center');
  stamp(px, 'DONE!', 130, 150, t, thatsIt, GREEN, 20);
  if (t >= thatsIt) px.confetti(t, thatsIt, 130, 150, 30);
  // the hard bit
  reelie(px, 262, 150, { r: 16, t, mood: t >= hardest ? 'shy' : 'happy', spin: 0.6 });
  if (t >= hardest) {
    const icons = ['?', '??', '!'];
    const icon = icons[Math.min(2, Math.floor((t - hardest) / 0.9))];
    px.circle(LIGHT, 238, 120, 2); px.circle(LIGHT, 230, 112, 3);
    px.window(190, 82, 48, 26, LIGHT);
    px.text(icon, 214, 84, 20, icon === '!' ? GOLD : INK, 'center');
  }
}

const TROPHY = ['yyyyyyyyy', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '...yyy...', '....y....', '...yyy...', '..kkkkk..'];

function endScene(t, px) {
  const [, thanks, readme, go] = CUES.end;
  px.sky(NIGHT, '#2a2050');
  px.stars(t);
  firework(px, 70, 46, t % 3.2, 0.6, PINK);
  firework(px, 250, 36, (t + 1.1) % 3.2, 0.6, TEAL);
  firework(px, 170, 26, (t + 2.2) % 3.2, 0.6, GOLD);
  skyline(px, 0, 150, '#141a33', null, 41, t);
  skyline(px, 0, 168, '#0e1326', GOLD, 7, t);
  px.rect('#0b0f1e', 0, 168, px.W, 12);
  px.text('PIXELREEL', 160, 13, 32, INK, 'center');
  px.text('PIXELREEL', 160, 10, 32, GOLD, 'center', '#a5521a');
  const bow = t >= thanks && t < thanks + 0.9 ? Math.round(Math.sin(((t - thanks) / 0.9) * Math.PI) * 8) : 0;
  reelie(px, 160, 108 + bow + px.bob(t, 4, 2), { r: 24, t, mood: bow ? 'shy' : 'happy', shades: !bow, spin: t * 0.5 });
  if (t >= thanks && t < go + 0.5) px.sign('THANK YOU!', 160, 58, 14, PINK);
  if (t >= readme) {
    const x = Math.round(px.tween(t, readme, 0.4, 330, 196, 'back'));
    px.window(x, 76, 118, 40, '#101a2c');
    px.rect(GOLD, x + 1, 77, 116, 1);
    px.sprite(TROPHY, x + 6, 84, 3);
    px.text('ACHIEVEMENT', x + 40, 79, 12, GOLD);
    px.text('UNLOCKED', x + 40, 91, 12, GOLD);
    px.text('Watched to the end', x + 40, 103, 10, LIGHT);
  }
  px.text('Voice: Kokoro, bm_george. Font: Orange Kid (CC0). Made with pixelreel.', 160, 170, 10, MUTED, 'center');
  // and that's all, folks
  if (t >= go + 0.5) {
    const r = Math.max(0, px.tween(t, go + 0.5, 0.9, 200, 34, 'out') - px.tween(t, go + 1.8, 0.5, 0, 34, 'in'));
    for (let y = 0; y < px.H; y++) {
      const dy = y + 0.5 - 104, half = Math.abs(dy) < r ? Math.sqrt(r * r - dy * dy) : 0;
      px.rect(INK, 0, y, Math.max(0, Math.round(160 - half)), 1);
      px.rect(INK, Math.round(160 + half), y, Math.max(0, Math.round(160 - half)), 1);
    }
    if (r === 0) {
      px.text('THE END', 160, 40, 32, CREAM, 'center');
      px.text('github.com/OllySalanson/pixelreel', 160, 136, 12, MUTED, 'center');
    }
  }
}

/** Splits a line of code into [text, colour] pieces, the way the code picture does. */
function highlight(line) {
  const out = [];
  const re = /(\/\/.*$)|('(?:[^'\\]|\\.)*'?)|(\b\d+\b)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;
  let m;
  while ((m = re.exec(line))) {
    let c = CREAM;
    if (m[1]) c = MUTED;
    else if (m[2]) c = GOLD;
    else if (m[3]) c = TEAL;
    else if (m[4]) c = ['export', 'default'].includes(m[4]) ? PINK : /^\s*[:(]/.test(line.slice(re.lastIndex)) ? '#8fd3ff' : CREAM;
    else if (m[6]) c = GREY;
    out.push([m[0], c]);
  }
  return out;
}

export default {
  title: 'The pixelreel showreel',
  intro: 'Sound on. About three minutes, with gags. Use Next and Back any time.',
  note: 'Made with pixelreel, naturally. Voice: Kokoro (bm_george). Font: Orange Kid (CC0).',
  transition: 'dissolve',
  captions: 'typewriter',
  scenes: [
    { title: 'Nobody reads the docs', caption: "Nobody reads the docs. So here's a cartoon instead.",
      say: "Let's be honest. Nobody reads the docs. Not the read me, not the wiki, and definitely not the change log. So here's a cartoon instead.",
      draw: docsScene },
    { title: 'Meet pixelreel', caption: 'pixelreel turns a list of scenes into a narrated pixel-art video that plays in your browser.',
      say: 'This is pixel reel. Give it a list of scenes, and it plays them back as a narrated pixel art video, right in your browser. No video editor. No timeline. No progress bar stuck at ninety nine percent.',
      transition: 'flash', draw: meetScene },
    { title: 'A reel is a list of scenes', caption: "Each scene has a title, a caption, the words to say and a picture. That's the whole format.",
      say: "A reel is one small file with a list of scenes. Each scene has a title, a caption, the words to say, and a picture. That's it. Your shopping list is more complicated.",
      transition: 'wipe', draw: scenesScene },
    { title: 'Pictures are code', caption: 'Pictures are drawn in code with a pixel kit: sprites, parallax, typewriter text and, crucially, confetti.',
      say: 'Pictures are drawn in code, with a little pixel kit. Sprites. Parallax. Typewriter text. And, most importantly, confetti.',
      draw: codeScene },
    { title: 'Or skip the drawing', caption: "Can't draw? Pick a ready-made picture, like a list, a terminal or a chat, and fill in the words.",
      say: "Can't draw? Same. Pick a ready-made picture, like a list, a terminal or a chat, and just fill in the words.",
      transition: 'slide', draw: readyScene },
    { title: 'A voice, made at home', caption: 'Kokoro, an open speech model, records the voice offline. Or plug in any other voice you like.',
      say: "This voice was recorded offline by Kokoro, an open speech model. No cloud, no A P I key, no subscription. Don't fancy me? Pick another voice, or plug in any speech engine.",
      transition: 'blinds', draw: voiceScene },
    { title: 'No recording? No problem', caption: 'No recording yet? The browser reads it aloud, so a brand new reel plays straight away.',
      say: 'No recording yet? Your browser reads it out instead, like a satnav having a moment, so a brand new reel plays straight away.',
      transition: 'slide', draw: satnavScene },
    { title: 'Captions and controls', caption: 'Captions type along. Pause, skip, scrub back and forth, or switch the sound off.',
      say: 'Captions type along as I talk. Pause me, skip me, drag me back and forth, or switch me off entirely. Rude, but fine.',
      transition: 'fade', draw: controlsScene },
    { title: 'Transitions', caption: "Fade, wipe, dissolve, slide, iris and, yes, a star wipe. We're not proud of it.",
      say: "Scenes can fade, wipe, dissolve, slide, or close with an iris, like an old cartoon. There's also a star wipe. We're not proud of it.",
      draw: wipesScene },
    { title: 'Where it helps', caption: 'Onboarding new starters. Release notes. Walking a reviewer through a pull request. School lessons.',
      say: 'Where does it help? Onboarding new starters. Release notes people actually watch. Walking a reviewer through a pull request. School lessons that keep the back row awake.',
      transition: 'star', draw: helpsScene },
    { title: 'And also', caption: 'Pitch decks. Game trailers. Status updates for a busy boss. Changelogs nobody reads, until now.',
      say: "Pitch decks. Game trailers. Status updates for a boss who won't read a document, but will absolutely watch a cartoon. And change logs, finally seen by human eyes.",
      transition: 'wipe', draw: alsoScene },
    { title: 'Put it anywhere', caption: 'Static files: put it on GitHub Pages, any web host, or a banner in your README.',
      say: "It's just static files, so it goes anywhere: GitHub Pages, any web host, or an animated banner in your read me. Like the one you probably clicked to get here.",
      transition: 'iris', draw: anywhereScene },
    { title: 'Robots welcome', caption: 'Scenes are just data: make a reel from notes, one per release in CI, or let an AI agent write it.',
      say: 'Scenes are just data, so robots can write them too. Turn release notes into a reel in one command, have C I make one for every release, or let an A I agent do the lot. No pay rise required.',
      transition: 'slide', draw: robotsScene },
    { title: 'Make your own', caption: "Clone it, npm start, npm run new my-reel, npm run voices my-reel. That's it.",
      say: "Making your own takes about a minute. Clone it, start it, make a reel, record the voices. That's it. The hardest part is deciding what to explain.",
      transition: 'blinds', draw: makeScene },
    { title: "That's pixelreel", caption: 'Thanks for watching. Now go and explain something.',
      say: "That's pixel reel. Thanks for watching to the very end, which is more than anyone has ever done for a read me. Now go and explain something.",
      transition: 'flash', draw: endScene }
  ]
};
