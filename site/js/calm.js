// Whether to hold pictures still: when the device asks for less motion, or when "Still" is
// chosen in Make it comfy.
const asked = matchMedia('(prefers-reduced-motion: reduce)');

export const calm = () => asked.matches || document.documentElement.dataset.motion === 'off';

/** Calls `fn` whenever the answer may have changed (or any other comfort setting has). */
export function onComfortChange(fn) {
  asked.addEventListener('change', fn);
  addEventListener('comfort', fn);
}
