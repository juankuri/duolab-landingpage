/**
 * The icon set, sourced from @phosphor-icons/core — requested by name in the
 * original brief, replacing a first pass that shipped 8 hand-rolled SVG
 * paths instead (docs/09-ux-completion-plan.md §D1 records that as a
 * deviation this checkpoint corrects).
 *
 * Build-time only: each `?raw` import below is a plain SVG file under
 * @phosphor-icons/core/assets/{weight}/, resolved and inlined by Vite at
 * build time into a string constant. Nothing is fetched at runtime, there is
 * no icon font, and no new UI library is introduced — this is a set of SVG
 * path strings, the same shape the hand-rolled set already was, just sourced
 * from a real icon library instead of drawn by hand. `grep -ri phosphor
 * dist/` after a build finds nothing but inlined path data, the same way
 * checkpoint A verified pdf.js was never statically bundled.
 *
 * Every icon here is `viewBox="0 0 256 256"` — Phosphor's own coordinate
 * space, not the hand-rolled set's 24x24 — Icon.astro reads the viewBox from
 * the source rather than assuming one.
 *
 * Every use is still required to sit beside a visible text label; this file
 * has no opinion on that, Icon.astro's callers do.
 */
import arrowLeft from "@phosphor-icons/core/assets/regular/arrow-left.svg?raw";
import arrowSquareOut from "@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw";
import calendarBlank from "@phosphor-icons/core/assets/regular/calendar-blank.svg?raw";
import caretRight from "@phosphor-icons/core/assets/regular/caret-right.svg?raw";
import checkCircle from "@phosphor-icons/core/assets/regular/check-circle.svg?raw";
import clock from "@phosphor-icons/core/assets/regular/clock.svg?raw";
import downloadSimple from "@phosphor-icons/core/assets/regular/download-simple.svg?raw";
import eye from "@phosphor-icons/core/assets/regular/eye.svg?raw";
import filePdf from "@phosphor-icons/core/assets/regular/file-pdf.svg?raw";
import flask from "@phosphor-icons/core/assets/regular/flask.svg?raw";
import phone from "@phosphor-icons/core/assets/regular/phone.svg?raw";
import prohibit from "@phosphor-icons/core/assets/regular/prohibit.svg?raw";
import sealCheck from "@phosphor-icons/core/assets/regular/seal-check.svg?raw";
import uploadSimple from "@phosphor-icons/core/assets/regular/upload-simple.svg?raw";
import userCircle from "@phosphor-icons/core/assets/regular/user-circle.svg?raw";

// `weight="fill"` variants, for an active/selected state where Phosphor's own
// filled glyphs read as more "on" than the outlined default — used sparingly
// (the active status glyph, not every icon has one).
import checkCircleFill from "@phosphor-icons/core/assets/fill/check-circle-fill.svg?raw";
import sealCheckFill from "@phosphor-icons/core/assets/fill/seal-check-fill.svg?raw";

/** Pulls viewBox and inner markup out of a raw Phosphor SVG source string. */
function parse(svgSource) {
  const viewBoxMatch = svgSource.match(/viewBox="([^"]+)"/);
  const innerMatch = svgSource.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return {
    viewBox: viewBoxMatch?.[1] ?? "0 0 256 256",
    inner: innerMatch?.[1] ?? "",
  };
}

const REGULAR = {
  "arrow-left": arrowLeft,
  "external-link": arrowSquareOut,
  calendar: calendarBlank,
  chevron: caretRight,
  "check-circle": checkCircle,
  clock,
  download: downloadSimple,
  eye,
  file: filePdf,
  laboratory: flask,
  phone,
  prohibited: prohibit,
  published: sealCheck,
  upload: uploadSimple,
  person: userCircle,
};

const FILL = {
  "check-circle": checkCircleFill,
  published: sealCheckFill,
};

export const ICONS = Object.fromEntries(
  Object.entries(REGULAR).map(([name, source]) => [name, parse(source)]),
);

export const ICONS_FILL = Object.fromEntries(
  Object.entries(FILL).map(([name, source]) => [name, parse(source)]),
);

export const ICON_NAMES = Object.keys(ICONS);

/**
 * Builds the same markup Icon.astro renders, for the DOM built at runtime by
 * scripts/admin/render.js and manager.astro's inline script — those can't
 * reach a .astro component. Always aria-hidden, same contract as Icon.astro:
 * every call site is expected to carry its own visible text label.
 */
export function iconNode(name, { weight = "regular", size = 20, className } = {}) {
  const icon = (weight === "fill" && ICONS_FILL[name]) || ICONS[name];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", icon.viewBox);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);
  svg.innerHTML = icon.inner;
  return svg;
}
