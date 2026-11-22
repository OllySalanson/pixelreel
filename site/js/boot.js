// Runs before the page is drawn: puts back the comfort settings chosen last time (see
// comfort.js), so the page never flashes from one look to another.
{
  const root = document.documentElement;
  try {
    const saved = JSON.parse(localStorage.getItem('pixelreel-comfort') || '{}');
    for (const key of ['font', 'size', 'space', 'paper', 'motion']) {
      if (typeof saved[key] === 'string' && /^[a-z0-9]{1,16}$/.test(saved[key])) root.dataset[key] = saved[key];
    }
  } catch {
    // nothing saved, or nowhere to save it: the page keeps its usual look
  }
}
