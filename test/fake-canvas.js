// A pretend 2D canvas context for the tests: it records what is drawn instead of drawing.
// Text is measured as half its font size per character, which is near enough for layout.

export function fakeContext() {
  const g = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '12px x', textAlign: 'left', textBaseline: 'top',
    imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    rects: [], texts: [], clips: [], depth: 0, transforms: [],
    fillRect(x, y, w, h) { this.rects.push({ x, y, w, h, c: this.fillStyle }); },
    strokeRect() {},
    fillText(str, x, y) { this.texts.push({ str: String(str), x, y, c: this.fillStyle, font: this.font }); },
    measureText(str) { return { width: String(str).length * (parseFloat(this.font) / 2) }; },
    save() { this.depth++; },
    restore() { this.depth--; },
    translate(x, y) { this.transforms.push(['translate', x, y]); },
    scale(x, y) { this.transforms.push(['scale', x, y]); },
    beginPath() { this._path = []; },
    rect(x, y, w, h) { this._path.push([x, y, w, h]); },
    clip() { this.clips.push(this._path); },
    drawImage() {}
  };
  return g;
}

/** How many pixels a list of recorded rects covers, counting overlaps once, inside a box. */
export function coverage(rects, box) {
  const seen = new Set();
  for (const r of rects) {
    const [x, y, w, h] = Array.isArray(r) ? r : [r.x, r.y, r.w, r.h];
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i >= box.x && i < box.x + box.w && j >= box.y && j < box.y + box.h) seen.add(i * 10000 + j);
      }
    }
  }
  return seen.size;
}
