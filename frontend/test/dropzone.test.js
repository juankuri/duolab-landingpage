import { afterEach, describe, expect, it } from "vitest";

import { attachDropzone } from "../src/scripts/shared/dropzone.js";

const pdfFile = (name = "resultado.pdf", size = 1024) => {
  const file = new File([new Uint8Array(size)], name, { type: "application/pdf" });
  return file;
};

/** Builds the zone/input/text/status quad attachDropzone expects. */
function buildDom() {
  document.body.innerHTML = `
    <label class="dropzone" for="f" id="f-zone" tabindex="0">
      <span id="f-text">Arrastra el PDF aquí</span>
    </label>
    <input id="f" type="file" hidden />
    <p id="f-status"></p>
  `;
  return {
    zone: document.getElementById("f-zone"),
    input: document.getElementById("f"),
    textEl: document.getElementById("f-text"),
    statusEl: document.getElementById("f-status"),
  };
}

/** jsdom doesn't populate FileList from a drop; a fake dataTransfer is enough
 * to exercise attachDropzone's own logic, which only reads .files[0]. */
const dropEventWith = (file) => {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  event.dataTransfer = { files: file ? [file] : [] };
  return event;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("attachDropzone", () => {
  it("accepts a valid PDF picked via the input", () => {
    const dom = buildDom();
    let received;
    attachDropzone({ ...dom, onFile: (file) => (received = file) });

    const file = pdfFile();
    Object.defineProperty(dom.input, "files", { value: [file], configurable: true });
    dom.input.dispatchEvent(new Event("change"));

    expect(received).toBe(file);
    expect(dom.textEl.textContent).toBe("resultado.pdf");
    expect(dom.zone.dataset.tone).toBe("selected");
  });

  it("rejects a non-PDF file with the field error, not a silent no-op", () => {
    const dom = buildDom();
    let received = "unset";
    attachDropzone({ ...dom, onFile: (file) => (received = file) });

    const file = new File(["x"], "notas.docx", { type: "text/plain" });
    Object.defineProperty(dom.input, "files", { value: [file], configurable: true });
    dom.input.dispatchEvent(new Event("change"));

    expect(received).toBeNull();
    expect(dom.statusEl.textContent).toBe("Solo se aceptan archivos PDF.");
    expect(dom.zone.dataset.tone).toBe("error");
  });

  it("sets data-active while a drag is over the zone and clears it on drop", () => {
    const dom = buildDom();
    attachDropzone({ ...dom, onFile: () => {} });

    dom.zone.dispatchEvent(new Event("dragenter", { bubbles: true, cancelable: true }));
    expect(dom.zone.dataset.active).toBe("true");

    dom.zone.dispatchEvent(dropEventWith(pdfFile()));
    expect(dom.zone.dataset.active).toBeUndefined();
  });

  it("clears data-active on dragleave without a drop", () => {
    const dom = buildDom();
    attachDropzone({ ...dom, onFile: () => {} });

    dom.zone.dispatchEvent(new Event("dragenter", { bubbles: true, cancelable: true }));
    dom.zone.dispatchEvent(new Event("dragleave", { bubbles: true, cancelable: true }));

    expect(dom.zone.dataset.active).toBeUndefined();
  });

  it("accepts a PDF dropped onto the zone, same validation as the input path", () => {
    const dom = buildDom();
    let received;
    attachDropzone({ ...dom, onFile: (file) => (received = file) });

    const file = pdfFile("nuevo-drop.pdf");
    dom.zone.dispatchEvent(dropEventWith(file));

    expect(received).toBe(file);
    expect(dom.textEl.textContent).toBe("nuevo-drop.pdf");
  });

  it("ignores a drop event carrying no file", () => {
    const dom = buildDom();
    let calls = 0;
    attachDropzone({ ...dom, onFile: () => (calls += 1) });

    dom.zone.dispatchEvent(dropEventWith(null));

    expect(calls).toBe(0);
  });

  it("opens the file picker on Enter or Space", () => {
    const dom = buildDom();
    attachDropzone({ ...dom, onFile: () => {} });

    let clicked = 0;
    dom.input.addEventListener("click", () => (clicked += 1));

    dom.zone.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    dom.zone.dispatchEvent(new KeyboardEvent("keydown", { key: " ", cancelable: true }));

    expect(clicked).toBe(2);
  });

  it("reset() restores the idle label and clears tone/status", () => {
    const dom = buildDom();
    const { reset } = attachDropzone({ ...dom, onFile: () => {} });

    dom.zone.dispatchEvent(dropEventWith(pdfFile("elegido.pdf")));
    expect(dom.textEl.textContent).toBe("elegido.pdf");

    reset();

    expect(dom.textEl.textContent).toBe("Arrastra el PDF aquí");
    expect(dom.zone.dataset.tone).toBeUndefined();
    expect(dom.statusEl.textContent).toBe("");
  });
});
