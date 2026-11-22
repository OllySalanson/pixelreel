// Runs before the page is drawn, so that nothing jumps once it is. It puts back the comfort
// settings chosen last time (see comfort.js), and keeps the bar across the top on one row.
{
  const root = document.documentElement;
  try {
    const saved = JSON.parse(localStorage.getItem('pixelreel-comfort') || '{}');
    for (const key of ['font', 'size', 'space', 'paper', 'motion', 'pace', 'words', 'ruler']) {
      if (typeof saved[key] === 'string' && /^[a-z0-9]{1,16}$/.test(saved[key])) root.dataset[key] = saved[key];
    }
  } catch {
    // nothing saved, or nowhere to save it: the page keeps its usual look
  }

  // The bar across the top. Bigger letters and wider typefaces need more room than a fixed
  // rule can know, so this measures: it lets go of one thing at a time (site.css says what
  // goes at each step, under "the bar across the top") until what is left sits on one row.
  const STEPS = 4;
  const fit = () => {
    const bar = document.querySelector('.top-in');
    if (!bar) return;
    const oneRow = () => {
      const shown = [...bar.children].filter((el) => el.offsetWidth > 0);
      return shown.every((el) => el.offsetTop < shown[0].offsetTop + shown[0].offsetHeight);
    };
    for (let step = 0; step <= STEPS; step++) {
      if (step) bar.dataset.tight = String(step); else delete bar.dataset.tight;
      if (oneRow()) break;
    }
  };
  // First as soon as the bar has been read, which is when what follows it is there. The
  // stylesheet is in by then: it comes before this script, which waits for it.
  const read = new MutationObserver(() => {
    if (!document.getElementById('main')) return;
    read.disconnect();
    fit();
  });
  read.observe(root, { childList: true, subtree: true });
  // Then whenever the room or the letters change.
  addEventListener('resize', fit);
  document.fonts?.addEventListener('loadingdone', fit);
  new MutationObserver(fit).observe(root, { attributes: true, attributeFilter: ['data-font', 'data-size'] });
}
