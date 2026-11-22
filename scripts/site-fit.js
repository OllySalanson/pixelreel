// Checks a page of the website in a browser, at every setting of Make it comfy: that the bar
// across the top is on one row, that no word is cut in two at the end of a line, and that
// nothing is wider than the screen. Paste it into the console of a page (or hand it to a
// browser driver) at each screen width you care about. It answers with what it found.
// docs/site/README.md says when to run it.
(async () => {
  const root = document.documentElement, before = { ...root.dataset }, found = [];
  const settle = () => new Promise((done) => setTimeout(done, 80));

  // every run of letters that sits on more than one line; a break after a hyphen or at a slash is fair
  const cutWords = () => {
    const cut = new Set(), range = document.createRange();
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
      const el = text.parentElement;
      if (!el?.offsetParent || el.closest('dialog, script, style, noscript, [hidden]')) continue;
      for (const word of text.data.matchAll(/[^\s]+/g)) {
        range.setStart(text, word.index);
        range.setEnd(text, word.index + word[0].length);
        const lines = new Set([...range.getClientRects()].filter((box) => box.width > 0).map((box) => Math.round(box.top)));
        if (lines.size > 1 && !/[-/]/.test(word[0])) cut.add(word[0]);
      }
    }
    return [...cut];
  };
  const barRows = () => {
    const middles = [...document.querySelector('.top-in').children].filter((el) => el.offsetWidth > 0)
      .map((el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2);
    return Math.max(...middles) - Math.min(...middles) < 12 ? 1 : 2;
  };

  for (const font of ['lexend', 'atkinson', 'opendyslexic']) {
    root.dataset.font = font;
    const family = getComputedStyle(document.body).fontFamily.split(',')[0];
    await Promise.all([400, 500, 700, 800].map((weight) => document.fonts.load(`${weight} 16px ${family}`)));
    for (const size of ['1', '2', '3']) {
      for (const space of ['1', '2', '3']) {
        Object.assign(root.dataset, { size, space });
        await settle();
        const wrong = [];
        if (barRows() > 1) wrong.push('the bar across the top is on two rows');
        if (root.scrollWidth > root.clientWidth) wrong.push(`the page is ${root.scrollWidth - root.clientWidth}px wider than the screen`);
        const cut = cutWords();
        if (cut.length) wrong.push(`cut in two: ${cut.slice(0, 8).join(' ')}`);
        if (wrong.length) found.push(`${font}, size ${size}, spacing ${space}: ${wrong.join('; ')}`);
      }
    }
  }
  for (const key of ['font', 'size', 'space']) {
    if (key in before) root.dataset[key] = before[key]; else delete root.dataset[key];
  }
  return found.length ? found.join('\n') : `All well at ${root.clientWidth} pixels wide: one row, whole words, nothing too wide, at all 27 settings.`;
})();
