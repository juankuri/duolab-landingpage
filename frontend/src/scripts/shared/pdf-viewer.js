import {
  canvasPixels,
  clampPage,
  fitWidthScale,
  nextZoom,
} from "../admin/pdf-view.js";

/**
 * A reusable pdf.js canvas viewer, built from the same pieces
 * `/admin/manager` already uses (DEC-022): pdf.js is dynamically imported
 * only when a document is actually opened, the source is always an
 * ArrayBuffer (never a URL — see the comment this mirrors in
 * manager.astro), and the render scale is run through canvasPixels() so an
 * aggressive zoom on a wide page can't blank the canvas on iOS Safari.
 *
 * `manager.astro`'s own viewer is left as-is in this pass — it is the
 * original, already covered by the manual iPhone QA script (Flow D), and
 * migrating it is a separate, lower-risk-when-isolated change. This module
 * is what `/admin/revisar` and the `/admin/nuevo` preview now use, replacing
 * the fixed-height <iframe> that doesn't render on mobile Safari at all.
 *
 * `elements`:
 *   canvas          — the <canvas> to render into
 *   pageIndicator   — optional element to receive "N de M"
 *   prevButton      — optional, disabled state managed here
 *   nextButton      — optional, disabled state managed here
 *   textLayer       — optional element to receive the page's extracted text
 *                      (the one thing that makes the canvas non-opaque to a
 *                      screen reader — same reasoning as manager.astro)
 * `cap` — the iOS canvas pixel budget; defaults to the value manager.astro
 *         already ships (10,000,000), documented there against DEC-022.
 */
// pdf.js's render() and getDocument() communicate with a worker; if that
// worker never responds — observed in at least one sandboxed environment,
// cause not isolated — the returned promise never settles and the caller is
// left showing a loading state forever with no error to react to. Neither
// call is given its own AbortController by pdf.js, so a plain race against a
// timer is what turns silence into a definite failure the UI can show.
const RENDER_TIMEOUT_MS = 15_000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export function createPdfViewer(elements, cap = 10_000_000) {
  let pdfDoc = null;
  let page = 1;
  let zoom = "fit-width";

  async function renderPage() {
    if (!pdfDoc) return;

    const total = pdfDoc.numPages;
    page = clampPage(page, total);

    const pdfPage = await pdfDoc.getPage(page);
    const base = pdfPage.getViewport({ scale: 1 });
    const dpr = window.devicePixelRatio || 1;

    const requestedScale =
      zoom === "fit-width"
        ? fitWidthScale(elements.canvas.parentElement?.clientWidth || 320, base.width)
        : zoom;

    const { scale } = canvasPixels(requestedScale, base.width, base.height, dpr, cap);
    const viewport = pdfPage.getViewport({ scale });

    const canvas = elements.canvas;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;

    await withTimeout(
      pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise,
      RENDER_TIMEOUT_MS,
      "No se pudo dibujar el PDF a tiempo.",
    );

    if (elements.pageIndicator) elements.pageIndicator.textContent = `${page} de ${total}`;
    if (elements.prevButton) elements.prevButton.disabled = page <= 1;
    if (elements.nextButton) elements.nextButton.disabled = page >= total;

    if (elements.textLayer) {
      const text = await pdfPage.getTextContent();
      elements.textLayer.textContent = text.items.map((item) => item.str).join(" ");
    }
  }

  /** `source` is an ArrayBuffer or anything pdf.js's getDocument({data}) accepts. */
  async function open(source) {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;

    pdfDoc = await withTimeout(
      pdfjs.getDocument({ data: source }).promise,
      RENDER_TIMEOUT_MS,
      "No se pudo abrir el PDF a tiempo.",
    );
    page = 1;
    zoom = "fit-width";
    await renderPage();
  }

  function close() {
    pdfDoc = null;
    if (elements.canvas) {
      const ctx = elements.canvas.getContext("2d");
      ctx?.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    }
  }

  function prevPage() {
    page -= 1;
    return renderPage();
  }

  function nextPage() {
    page += 1;
    return renderPage();
  }

  function zoomIn() {
    zoom = nextZoom(zoom, 1);
    return renderPage();
  }

  function zoomOut() {
    zoom = nextZoom(zoom, -1);
    return renderPage();
  }

  return { open, close, prevPage, nextPage, zoomIn, zoomOut, renderPage };
}
