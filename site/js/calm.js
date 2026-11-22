// Whether to hold pictures still: when the device asks for less motion, or when "Still" is
// chosen in Make it comfy. Nothing here touches the page until it is asked, so Node can
// load the scripts that use it.
let asked = null;
const device = () => (asked ??= matchMedia('(prefers-reduced-motion: reduce)'));

export const calm = () => device().matches || document.documentElement.dataset.motion === 'off';

/** Calls `fn` whenever the answer may have changed (or any other comfort setting has). */
export function onComfortChange(fn) {
  device().addEventListener('change', fn);
  addEventListener('comfort', fn);
}
