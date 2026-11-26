// Everything Claude is told about writing a reel, by the connector and by the website, for the
// settings the service runs with: English only, and with every language and narrator the image
// carries. test/cards.test.js holds it to test/fixtures/cards-told.json, which is what Claude was
// told on 26 Nov 2026, before the stage: with the pictures switched back to cards
// (PIXELREEL_PICTURES=cards), Claude must be told exactly that again.
import { formatGuide, toolList } from '../service/mcp.mjs';
import { instructions } from '../service/writer.mjs';

const LANGUAGES = ['french', 'german', 'spanish', 'italian', 'portuguese', 'dutch'];
const NARRATORS = ['anna', 'vera', 'stuart', 'charles', 'paul'];

export function told(options = {}) {
  return {
    guide: formatGuide([], [], options),
    guideAll: formatGuide(LANGUAGES, NARRATORS, options),
    tools: toolList([], [], options),
    toolsAll: toolList(LANGUAGES, NARRATORS, options),
    website: instructions(null, null, options),
    websiteFrench: instructions('french', 'anna', options)
  };
}
