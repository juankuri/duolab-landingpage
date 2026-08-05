import { validatePdf } from "../admin/validation.js";

/**
 * One drag-and-drop + click-to-pick implementation for every PDF dropzone in
 * the admin module (`/admin/nuevo`, `/admin/folio`'s add-result sheet, and
 * its replace sheet via ConfirmSheet.astro).
 *
 * Before this module the copy said "Arrastra el PDF…" on all three, but
 * nothing anywhere listened for a `drop` event — the label only ever worked
 * as a click target. This is the fix, written once.
 *
 * Validation is delegated to validatePdf() (type, size, empty) — the same
 * rule the server re-checks by magic bytes; this module adds no new rules,
 * only the interaction around the existing one.
 *
 * `zone` is the visible drop target (a <label for="…">), `input` the hidden
 * file input it labels. `data-active` on `zone` is toggled for the CSS
 * dragover state; `data-tone` communicates selected/error to admin.css's
 * .dropzone[data-tone] rules.
 */
export function attachDropzone({ zone, input, textEl, statusEl, onFile, idleText }) {
  const idle = idleText ?? textEl.textContent;

  const setTone = (tone) => {
    if (tone) zone.dataset.tone = tone;
    else delete zone.dataset.tone;
  };

  const showError = (message) => {
    textEl.textContent = idle;
    setTone("error");
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.dataset.tone = "error";
    }
    onFile(null);
  };

  const showSelected = (file) => {
    textEl.textContent = file.name;
    setTone("selected");
    if (statusEl) {
      statusEl.textContent = "";
      delete statusEl.dataset.tone;
    }
    onFile(file);
  };

  /** Reusable by the caller after a successful upload, to reset for reuse. */
  function reset() {
    input.value = "";
    textEl.textContent = idle;
    setTone(null);
    if (statusEl) {
      statusEl.textContent = "";
      delete statusEl.dataset.tone;
    }
  }

  const handleFile = (file) => {
    const check = validatePdf(file);
    if (!check.ok) {
      showError(file ? check.error : "");
      return;
    }
    showSelected(file);
  };

  input.addEventListener("change", () => handleFile(input.files[0]));

  // Keyboard activation: a <label for> already forwards Enter/Space clicks
  // on most browsers, but making it explicit costs nothing and doesn't rely
  // on that browser behavior for such a central action.
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  let dragDepth = 0;

  zone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    zone.dataset.active = "true";
  });

  zone.addEventListener("dragover", (event) => {
    // Required for `drop` to fire at all — the browser's default is to
    // reject the drop.
    event.preventDefault();
  });

  zone.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) delete zone.dataset.active;
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    delete zone.dataset.active;

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    // Keeps the hidden <input>'s FileList in sync so a subsequent form
    // submit reading input.files (rather than the onFile callback's value)
    // still sees the dropped file. Every current caller uses the callback
    // value instead, so this is a nicety, not load-bearing — guarded
    // because DataTransfer isn't constructible in every test environment.
    if (typeof DataTransfer !== "undefined") {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    }

    handleFile(file);
  });

  return { reset };
}
