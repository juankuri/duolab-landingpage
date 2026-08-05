/**
 * Delays calling `fn` until `ms` have passed with no new call — the standard
 * trailing-edge debounce. Used by /admin/buscar to turn keystroke-by-keystroke
 * `input` events into one request per pause, rather than one per keystroke.
 *
 * Pure and DOM-free on purpose, same split as the rest of scripts/admin/ —
 * see docs/04-backlog.md's astro-check finding for why logic lives here and
 * not inline in the page's <script>.
 */
export function debounce(fn, ms) {
  let timer = null;

  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
