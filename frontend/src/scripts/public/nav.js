/**
 * Pure navigation helpers for the public site. Same split as
 * scripts/public/lookup.js: logic here, markup in the .astro component.
 */

/** Trailing slash off, empty path normalised back to "/". */
function normalize(path) {
  if (typeof path !== "string" || path === "") return "";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * Whether `href` names the page currently being rendered — the condition for
 * aria-current="page".
 *
 * Trailing slashes are the whole reason this is a function rather than `===`:
 * Astro's static build emits /resultados as dist/resultados/index.html, so the
 * pathname a browser reports is "/resultados/" while every link in the site is
 * written "/resultados". Comparing them raw marks nothing as current.
 *
 * External and anchor hrefs are never "current" — only same-origin paths are
 * compared, so a wa.me link or a "#ubicacion" anchor returns false.
 */
export function isCurrentPath(pathname, href) {
  if (typeof href !== "string" || !href.startsWith("/")) return false;
  const current = normalize(pathname);
  if (current === "") return false;
  return current === normalize(href);
}
