/**
 * Native inline PDF preview via a `blob:` object URL, for the desktop
 * employee surfaces (/admin/nuevo, /admin/revisar).
 *
 * Chosen over the pdf.js/canvas viewer that `/admin/manager` runs inline for
 * these two screens specifically: DEC-022 rejected `<iframe src>` because
 * iOS Safari cannot render an embedded PDF usably — a constraint about that
 * one mobile engine, not about desktop browsers, and employees are
 * desktop-first by explicit brief. On desktop, every major engine (Chromium,
 * Firefox, Safari) renders a `<object type="application/pdf">` pointed at a
 * blob: URL with its own full-featured native viewer — no worker to spin
 * up, no CORS/Range negotiation (blob: URLs are not network requests), and
 * no version-specific pdf.js behavior to depend on. The canvas/pdf.js
 * approach stays confined to `/admin/manager`'s own inline viewer (mobile),
 * where DEC-022's reasoning actually applies.
 *
 * A `blob:` URL is origin-scoped, unguessable outside this document, and is
 * revoked as soon as it's no longer shown — nothing here is ever a network
 * URL that could carry a token into browser history.
 */
export function createBlobPreview(objectEl) {
  let currentUrl = null;

  function revoke() {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
  }

  /** `source` is a Blob or File. Returns the blob: URL now showing, so a
   *  caller can also point a fallback link at the same object without
   *  minting (and leaking) a second one. */
  function show(source) {
    revoke();
    currentUrl = URL.createObjectURL(source);
    objectEl.data = currentUrl;
    return currentUrl;
  }

  function clear() {
    revoke();
    objectEl.removeAttribute("data");
  }

  return { show, clear };
}
