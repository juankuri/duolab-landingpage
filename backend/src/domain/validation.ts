// Pure input rules. No I/O, no Hono, no D1 — everything here is a function of
// its arguments, which is what makes it cheap to test exhaustively.

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

// Result PDFs are a few pages of text and tables. 15 MB is far above anything
// the lab produces and far below what would make an upload expensive to store
// or slow to stream back to a patient.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * A declared content type can be set by the caller, so the bytes are checked
 * too. Both must agree before anything reaches storage.
 */
export async function isPdf(file: File): Promise<boolean> {
  if (file.size === 0) {
    return false;
  }

  if (file.type !== "application/pdf") {
    return false;
  }

  const header = new Uint8Array(
    await file.slice(0, PDF_MAGIC_BYTES.length).arrayBuffer(),
  );

  return PDF_MAGIC_BYTES.every((byte, index) => header[index] === byte);
}

/**
 * The stored filename is whatever the employee's machine called the file, so
 * it reaches this header as untrusted input: CR or LF in it would terminate
 * the header and let the rest be chosen by the uploader.
 *
 * RFC 6266: the quoted form must be plain ASCII, so non-ASCII names are
 * transliterated there and carried intact in the filename* form, which every
 * current browser prefers when both are present.
 */
export function contentDisposition(filename: string): string {
  const ascii =
    filename
      .replace(/[\\"]/g, "")
      // Anything outside printable ASCII, which includes CR, LF and every
      // other control character, cannot appear in the quoted form.
      .replace(/[^\x20-\x7e]/g, "_")
      .trim() || "resultado.pdf";

  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
