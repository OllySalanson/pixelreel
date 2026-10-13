// What is pixelreel? A reel that explains itself.
// Each scene has a title, a caption (read on screen), say (spoken aloud; leave it out
// to speak the caption) and draw(t, px), which paints the picture. t is the number of
// seconds since the scene started; px is the pixel kit (see src/kit.js).

const INK = '#1a1a1a', NIGHT = '#0b1220', NAVY = '#13203a', CREAM = '#ebeac5', GOLD = '#ffcc4d', TEAL = '#55d6be';

// A film reel, drawn a pixel at a time and turned by `angle`.
function filmReel(px, cx, cy, r, angle, face = false) {
  const holes = [0, 1, 2, 3, 4].map((k) => {
    const a = angle + (k * 2 * Math.PI) / 5;
    return [Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58];
  });
  const hole = r * 0.2, hub = r * 0.2;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (d2 > r * r) continue;
      let c = '#9fb3c8';
      if (d2 > (r - 1.5) * (r - 1.5)) c = INK;
      else if (d2 > (r - 3.5) * (r - 3.5)) c = '#c9d6e3';
      else if (d2 <= hub * hub) c = GOLD;
      else if (holes.some(([hx, hy]) => (x - hx) ** 2 + (y - hy) ** 2 <= hole * hole)) c = NIGHT;
      px.rect(c, cx + x, cy + y, 1, 1);
    }
  }
  if (face) {
    px.rect(INK, cx - 4, cy - 2, 2, 3); px.rect(INK, cx + 2, cy - 2, 2, 3);
    px.rect(INK, cx - 4, cy + 2, 1, 1); px.rect(INK, cx - 3, cy + 3, 6, 1); px.rect(INK, cx + 3, cy + 2, 1, 1);
  }
}

// A strip of film running sideways, its frames sliding past.
function filmStrip(px, y, t, speed = 20, fill = (x) => (x % 2 ? '#24476b' : '#2f5d8a')) {
  px.rect(INK, 0, y, px.W, 26);
  const shift = Math.floor(t * speed) % 32;
  for (let i = -1; i < 12; i++) {
    const x = i * 32 - shift;
    px.rect(fill(i + Math.floor(t * speed / 32)), x + 3, y + 5, 26, 16);
    px.rect(CREAM, x + 4, y + 1, 4, 2); px.rect(CREAM, x + 20, y + 1, 4, 2);
    px.rect(CREAM, x + 4, y + 23, 4, 2); px.rect(CREAM, x + 20, y + 23, 4, 2);
  }
}

// A browser window with a title bar.
function browser(px, x, y, w, h, title) {
  px.window(x, y, w, h, CREAM);
  px.rect('#24476b', x + 1, y + 1, w - 2, 12);
  [0, 1, 2].forEach((i) => px.rect(['#d63a3a', GOLD, '#3fa34d'][i], x + 4 + i * 6, y + 5, 4, 4));
  if (title) px.text(title, x + 26, y + 1, 12, CREAM);
}

function button(px, label, x, y, w, lit) {
  px.window(x, y, w, 20, lit ? GOLD : '#24476b');
  px.text(label, x + w / 2, y + 3, 14, lit ? '#202020' : CREAM, 'center');
}

// When the sentences of the last scene start in its recording, in seconds. Found from the
// pauses in the clip: ffmpeg -i <clip>.mp3 -af silencedetect=n=-35dB:d=0.2 -f null -
const MAKE_CUES = [0, 2.52, 4.94, 6.48, 8.34, 9.24];
// When the 'Watch your way' narrator names each control, found the same way with d=0.05 to
// catch the commas: play, pause, go back, skip ahead, sound off, keyboard, space bar, arrows.
const WATCH_CUES = [1.29, 1.74, 2.26, 2.87, 4.15, 7.10, 8.26, 10.56];

const HEART = [
  '.kk.kk.',
  'krrkrrk',
  'krrrrrk',
  'krrrrrk',
  '.krrrk.',
  '..krk..',
  '...k...'
];

export default {
  title: 'What is pixelreel?',
  intro: 'Sound will start. About two minutes. Use Next and Back any time.',
  note: 'Made with pixelreel. Narration recorded with Kokoro, voice bm_george. Pixel font: Orange Kid by Typodermic (CC0).',
  scenes: [
    {
      title: 'Hello!',
      caption: 'This is pixelreel. It turns a short list of scenes into a narrated pixel-art video that plays in any web browser.',
      say: 'Hello! This is pixelreel. It turns a short list of scenes into a little narrated video, drawn in pixel art, that plays in any web browser. This one explains itself.',
      draw(t, px) {
        px.sky('#0b1220', '#24476b');
        px.stars(t);
        filmStrip(px, 140, t);
        filmReel(px, 160, 84 + px.bob(t, 2, 2), 34, t * 1.5, true);
        if (px.shown(t, 0, 1, 1)) px.sign('PIXELREEL', 160, 10, 20, GOLD);
      }
    },
    {
      title: 'A reel is a list of scenes',
      caption: 'Each scene has four parts: a title, a caption to read along with, the words the narrator says, and a picture.',
      say: 'A reel is just a list of scenes. Each scene has four parts. A title. A caption, for reading along. The words the narrator says. And a picture.',
      draw(t, px) {
        px.rect(NAVY, 0, 0, px.W, px.H);
        const parts = [['TITLE', 'Hello!'], ['CAPTION', 'Read along'], ['SAY', 'Spoken aloud'], ['DRAW', 'The picture']];
        parts.forEach(([name, hint], i) => {
          const x = 12 + i * 76, y = 48, on = px.shown(t, i, 2.0, 3.2);
          px.window(x, y + (on ? px.bob(t + i, 2, 1) : 0), 68, 96, on ? CREAM : '#33506e');
          if (!on) return;
          px.text(name, x + 34, y + 8, 16, '#a52222', 'center');
          if (i === 0) px.rect(GOLD, x + 10, y + 34, 48, 8);
          if (i === 1) [0, 1, 2, 3].forEach((l) => px.rect('#5d5c47', x + 8, y + 32 + l * 9, l === 3 ? 30 : 52, 4));
          if (i === 2) {
            for (let w = 0; w < 5; w++) {
              const h = 4 + Math.round(Math.abs(Math.sin(t * 6 + w * 1.3)) * 26);
              px.rect(TEAL, x + 14 + w * 9, y + 48 - h / 2, 6, h);
            }
          }
          if (i === 3) px.sprite(HEART, x + 20, y + 32, 4);
          px.text(hint, x + 34, y + 78, 12, '#202020', 'center');
        });
        px.sign('ONE SCENE', 160, 10, 16, GOLD);
      }
    },
    {
      title: 'Pictures are drawn in code',
      caption: 'Every picture is a small draw function on a grid of 320 by 180 chunky pixels. It knows how long the scene has run, so things can move.',
      say: 'Every picture is a small piece of code that draws on a grid of three hundred and twenty by one hundred and eighty chunky pixels. It knows how long the scene has been playing, so things can move.',
      draw(t, px) {
        px.rect(NIGHT, 0, 0, px.W, px.H);
        for (let x = 0; x < px.W; x += 10) px.rect('#16243c', x, 0, 1, px.H);
        for (let y = 0; y < px.H; y += 10) px.rect('#16243c', 0, y, px.W, 1);
        // paint the heart one pixel at a time, then let it beat
        const cells = [];
        HEART.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') cells.push([i, j, ch]); }));
        const painted = Math.min(cells.length, Math.floor(Math.max(0, t - 1) * 5));
        const beat = painted === cells.length ? (Math.sin(t * 5) > 0.6 ? 11 : 10) : 10;
        const ox = 160 - (7 * beat) / 2, oy = 86 - (7 * beat) / 2;
        cells.slice(0, painted).forEach(([i, j, ch]) => px.rect(px.PAL[ch], ox + i * beat, oy + j * beat, beat, beat));
        if (painted < cells.length) {
          const [i, j] = cells[painted];
          px.rect(GOLD, ox + i * beat, oy + j * beat, beat, 1); px.rect(GOLD, ox + i * beat, oy + j * beat + beat - 1, beat, 1);
          px.rect(GOLD, ox + i * beat, oy + j * beat, 1, beat); px.rect(GOLD, ox + i * beat + beat - 1, oy + j * beat, 1, beat);
        }
        px.sign('320 x 180', 160, 152, 16, CREAM);
        px.sign('draw(t, px)', 60, 10, 14, GOLD);
        px.sign('t = ' + t.toFixed(1) + 's', 268, 10, 14, TEAL);
      }
    },
    {
      title: 'A warm, recorded voice',
      caption: 'Kokoro, an open speech model, records each scene\'s narration ahead of time, on your own computer. One command records them all.',
      say: 'The voice you are hearing was recorded ahead of time, on an ordinary computer, by Kokoro, an open speech model. One command records every scene. Change a line, and only that scene is recorded again.',
      draw(t, px) {
        px.sky('#13203a', '#2f5d8a');
        // a speaker with sound rings
        px.rect(INK, 46, 74, 20, 28); px.rect('#9fb3c8', 48, 76, 16, 24);
        for (let i = 0; i <= 22; i++) {
          const half = 14 + i;   // the cone widens to the right
          px.rect(INK, 66 + i, 88 - half - 1, 1, half * 2 + 2);
          if (i < 22) px.rect('#9fb3c8', 66 + i, 88 - half, 1, half * 2);
        }
        for (let k = 0; k < 3; k++) {
          if ((Math.floor(t * 3) + k) % 3 === 0) continue;
          const r = 14 + k * 11;
          for (let a = -0.8; a <= 0.8; a += 0.05) px.rect(CREAM, 96 + Math.cos(a) * r, 88 + Math.sin(a) * r, 2, 2);
        }
        // a waveform on a screen
        px.window(150, 46, 150, 84, NAVY);
        for (let i = 0; i < 34; i++) {
          const h = 4 + Math.abs(Math.sin(t * 7 + i * 0.7) * Math.sin(t * 2.3 + i * 0.31)) * 60;
          px.rect(TEAL, 156 + i * 4, 88 - h / 2, 3, h);
        }
        px.sign('KOKORO', 225, 140, 16, GOLD);
        px.sign('voice: bm_george', 225, 24, 12);
      }
    },
    {
      title: 'No recording? Still fine',
      caption: 'If a scene has no recording yet, the browser reads it aloud with its own voice. So a new reel plays straight away.',
      say: 'No recording yet? That is fine. The browser reads the words aloud with its own built in voice, so a brand new reel plays straight away, while you are still writing it.',
      draw(t, px) {
        px.rect(NIGHT, 0, 0, px.W, px.H);
        browser(px, 40, 24, 240, 132, 'my-new-reel');
        px.rect('#000000', 52, 44, 120, 68);
        filmReel(px, 112, 78, 22, t, true);
        [0, 1, 2].forEach((l) => px.rect('#5d5c47', 52, 120 + l * 9, l === 2 ? 70 : 120, 4));
        if (px.shown(t, 0, 1, 2)) {
          // a speech bubble, with a trail of dots back to the player
          px.window(176, 94, 5, 5, '#fdf6e3'); px.window(182, 84, 7, 7, '#fdf6e3');
          px.window(192, 50, 80, 48, '#fdf6e3');
          const words = ['Hello...', 'Reading', 'aloud!'];
          words.forEach((w, i) => { if (px.shown(t, i, 1.2, 2.6)) px.text(w, 232, 56 + i * 13, 14, '#202020', 'center'); });
        }
      }
    },
    {
      title: 'Watch your way',
      caption: 'Play, Pause, Back and Next. Turn the sound off to read at your own pace. Space bar plays or pauses; the arrow keys move between scenes.',
      say: 'Watch it your way. Play, pause, go back, or skip ahead. Turn the sound off and read at your own pace. On a keyboard, the space bar plays and pauses, and the arrow keys move between scenes.',
      draw(t, px) {
        px.rect(NAVY, 0, 0, px.W, px.H);
        // light up each control as the narrator names it
        const during = (from, to) => t >= from && t < to;
        const [playAt, pauseAt, backAt, nextAt, soundAt, keysAt, spaceAt, arrowsAt] = WATCH_CUES;
        const btns = [['BACK', 48, backAt, nextAt], ['PLAY', 56, playAt, backAt], ['NEXT', 48, nextAt, soundAt], ['SOUND', 60, soundAt, keysAt]];
        let x = 39;
        btns.forEach(([label, w, from, to]) => {
          button(px, label === 'PLAY' && during(pauseAt, backAt) ? 'PAUSE' : label, x, 46, w, during(from, to));
          x += w + 10;
        });
        // the keyboard: space bar, then the arrow keys
        px.window(57, 102, 120, 22, during(spaceAt, arrowsAt) ? GOLD : CREAM);
        px.text('SPACE', 117, 106, 14, '#202020', 'center');
        [['<', 197], ['>', 233]].forEach(([k, kx], i) => {
          px.window(kx, 102, 30, 22, t >= arrowsAt && Math.floor(t * 2) % 2 === i ? GOLD : CREAM);
          px.text(k, kx + 15, 105, 16, '#202020', 'center');
        });
        for (let i = 0; i < 8; i++) px.rect(i === Math.floor(t / 1.5) % 8 ? GOLD : '#33506e', 104 + i * 14, 146, 10, 10);
      }
    },
    {
      title: 'Share it anywhere',
      caption: 'A reel is a handful of plain files. Put them on GitHub Pages, or any web host, and send the link.',
      say: 'A reel is just a handful of plain files. No server code, and no accounts. Put them on GitHub Pages, or any other web host, and send someone the link.',
      draw(t, px) {
        px.sky('#24476b', '#55a0d6');
        // a cloud
        const cx = 214, cy = 54;
        [[-26, 14], [0, 22], [24, 16]].forEach(([dx, r]) => px.rect(INK, cx + dx - r - 1, cy - r - 1, r * 2 + 2, r + 2));
        px.rect(INK, cx - 46, cy - 1, 92, 22);
        [[-26, 14], [0, 22], [24, 16]].forEach(([dx, r]) => px.rect('#fdf6e3', cx + dx - r, cy - r, r * 2, r + 1));
        px.rect('#fdf6e3', cx - 45, cy, 90, 20);
        px.text('YOUR SITE', cx, cy + 4, 14, '#24476b', 'center');
        // files floating up from the computer
        px.rect(INK, 40, 118, 72, 46); px.rect(NAVY, 43, 121, 66, 36); px.rect(INK, 64, 164, 24, 6);
        const names = ['index.html', 'reel.js', 'audio'];
        names.forEach((n, i) => {
          const p = ((t * 0.35 + i / 3) % 1);
          if (p > 0.92) return;   // gone into the cloud
          const tx = cx - 40, ty = cy + 12;
          const fx = 76 + (tx - 76) * p, fy = 118 - (118 - ty) * p - Math.sin(p * Math.PI) * 30;
          px.window(fx - 6, fy - 8, 12, 15, CREAM); px.rect(GOLD, fx - 3, fy - 4, 6, 2);
          if (p < 0.25) px.text(n, fx, fy + 9, 12, CREAM, 'center');
        });
        if (px.shown(t, 0, 1, 7)) px.sign('SEND THE LINK', 214, 128, 16, GOLD);
      }
    },
    {
      title: 'Make your own',
      caption: 'Start a reel with npm run new, then its name. Write your scenes, record the voices, and press Play.',
      say: 'Making your own takes three steps. Start a new reel with one command. Write your scenes. Then record the voices. That is all. Thanks for watching!',
      draw(t, px) {
        px.rect(NIGHT, 0, 0, px.W, px.H);
        px.window(16, 20, 190, 120, '#000000');
        const lines = ['$ npm run new my-reel', '$ edit reels/my-reel/reel.js', '$ npm run voices my-reel'];
        // when the narrator starts each step, and then thanks us, in the recorded clip
        const [, newAt, writeAt, recordAt, , thanksAt] = MAKE_CUES;
        lines.forEach((line, i) => {
          const start = [newAt, writeAt, recordAt][i];
          if (t < start) return;
          const n = Math.min(line.length, Math.floor((t - start) * 20));
          px.text(line.slice(0, n), 24, 30 + i * 22, 14, i === 1 ? GOLD : TEAL);
          if (n < line.length && Math.floor(t * 4) % 2) px.rect(CREAM, 24 + px.textW(line.slice(0, n), 14) + 1, 31 + i * 22, 5, 11);
        });
        filmReel(px, 260, 80 + px.bob(t, 3, 3), 30, t * 2, true);
        if (t >= thanksAt) px.sign('THANKS FOR WATCHING', 160, 152, 16, GOLD);
      }
    }
  ]
};
