// __TITLE__
// Each scene has:
//   title    the heading over the caption
//   caption  what is shown on screen to read along with
//   say      what the narrator says (leave it out to read the caption aloud)
//   draw(t, px)  paints the picture: t is seconds since the scene started, px is the
//                pixel kit (rect, sprite, text, sign, sky, hills, tween, confetti and more).
//   picture  or, instead of draw, a ready-made picture: title, list, terminal, code, chat,
//            big or image.
// The picture is 320 x 180 pixels. docs/scenes.md has every field, picture and kit helper.

export default {
  title: '__TITLE__',
  intro: 'Sound will start. Use Next and Back any time.',
  note: '',
  // how one scene gives way to the next: cut, fade, dissolve, wipe, slide, blinds, iris, flash or star
  transition: 'dissolve',
  // 'typewriter' types each caption out as the narrator speaks; 'plain' shows it all at once
  captions: 'typewriter',
  // pictures the scenes can show with px.image(name, x, y, w, h), relative to this folder
  images: {},
  scenes: [
    {
      title: 'Hello',
      caption: 'This is the first scene. Change these words to tell your story.',
      say: 'Hello! This is the first scene. Change these words to tell your story.',
      draw(t, px) {
        px.sky('#0b1220', '#24476b');
        px.stars(t);
        px.hills('#13263f', 160, 20, t * 6);
        px.sign('__SIGN__', px.W / 2, px.tween(t, 0.3, 1, -30, 70, 'bounce'), 20, '#ffcc4d');
      }
    },
    {
      title: 'A second scene',
      caption: 'Each scene moves on by itself when the narrator finishes speaking.',
      draw(t, px) {
        px.rect('#13203a', 0, 0, px.W, px.H);
        const steps = ['ONE', 'TWO', 'THREE'];
        steps.forEach((word, i) => {
          if (px.shown(t, i, 1.5, 1)) px.sign(word, 70 + i * 90, 80, 16);
        });
      }
    },
    {
      title: 'No drawing needed',
      caption: 'A ready-made picture needs no code at all, just the words.',
      picture: { type: 'list', heading: 'THREE STEPS', items: ['Write the scenes', 'Record the voices', 'Press Play'], numbered: true }
    }
  ]
};
