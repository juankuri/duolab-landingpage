/**
 * The DOM-free half of the manager's PDF viewer — page/zoom arithmetic that
 * is cheap to get exactly right and expensive to get wrong on a phone.
 * pdf.js itself, the canvas, and the fetch are all in manager.astro's
 * script, same split as api.js/upload.js: the I/O and DOM side is exercised
 * by the manual smoke walk, not unit tests.
 */

/** Keeps a 1-based page number inside [1, total] — never 0, never past the end. */
export function clampPage(page, total) {
  if (total <= 0) return 0;
  return Math.min(Math.max(Math.trunc(page), 1), total);
}

/**
 * A fixed ladder rather than a slider or pinch-only: two big +/- buttons a
 * 60-year-old can find without hunting, per docs/03-decisions.md DEC-022.
 * "fit-width" is the default a lab result opens on — reading a wide table
 * matters more than seeing the whole page at once.
 */
export const ZOOM_STEPS = ["fit-width", 1.5, 2, 3];

/** Steps through ZOOM_STEPS, clamped at both ends rather than wrapping. */
export function nextZoom(current, direction) {
  const index = ZOOM_STEPS.indexOf(current);
  const from = index === -1 ? 0 : index;
  const to = Math.min(Math.max(from + direction, 0), ZOOM_STEPS.length - 1);
  return ZOOM_STEPS[to];
}

/** The scale that makes a page exactly as wide as the viewport. */
export function fitWidthScale(viewportWidth, pageWidth) {
  if (pageWidth <= 0) return 1;
  return viewportWidth / pageWidth;
}

/**
 * iOS Safari silently blanks a canvas past its memory ceiling rather than
 * erroring — there is no event to catch. Capping total pixels keeps a huge
 * page or an aggressive zoom from ever reaching that ceiling. `cap` is
 * injected rather than hardcoded so the test can pin the ceiling itself
 * (about 8-12M pixels is the safe range in practice) without pretending to
 * know the real device limit.
 */
export function canvasPixels(scale, pageWidth, pageHeight, dpr, cap) {
  const rawScale = scale * dpr;
  const rawPixels = pageWidth * rawScale * pageHeight * rawScale;

  if (rawPixels <= cap) {
    return { scale: rawScale, pixels: rawPixels };
  }

  const factor = Math.sqrt(cap / rawPixels);
  const clampedScale = rawScale * factor;

  return {
    scale: clampedScale,
    pixels: pageWidth * clampedScale * pageHeight * clampedScale,
  };
}
