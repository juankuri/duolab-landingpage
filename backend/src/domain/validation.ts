// Pure input rules. No I/O, no Hono, no D1 — everything here is a function of
// its arguments, which is what makes it cheap to test exhaustively.
//
// Validation is allowlist-shaped: each rule says what is acceptable rather
// than trying to enumerate what is not. Values are still bound as parameters
// everywhere, so this is defence in depth, not the only thing standing
// between input and the database.

export type Valid<T> = { ok: true; value: T };
export type Invalid = { ok: false; error: string };
export type Result<T> = Valid<T> | Invalid;

const ok = <T,>(value: T): Valid<T> => ({ ok: true, value });
const fail = (error: string): Invalid => ({ ok: false, error });

/** Control characters are never legitimate in any of these fields. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateFullName(raw: unknown): Result<string> {
  if (typeof raw !== "string") {
    return fail("El nombre es obligatorio.");
  }

  // Collapse runs of whitespace so "Maria   Lopez" and "Maria Lopez" are the
  // same patient name rather than two.
  const value = raw.trim().replace(/\s+/g, " ");

  if (value.length < 2 || value.length > 120) {
    return fail("El nombre debe tener entre 2 y 120 caracteres.");
  }

  if (CONTROL_CHARACTERS.test(value)) {
    return fail("El nombre contiene caracteres no válidos.");
  }

  // Deliberately permissive about which letters: accents, apostrophes and
  // hyphens are all ordinary in the names this lab handles. The rule is that
  // there is at least one letter, not that the name matches a pattern.
  if (!/\p{L}/u.test(value)) {
    return fail("El nombre debe incluir al menos una letra.");
  }

  return ok(value);
}

/**
 * Round-trips through Date rather than trusting the pattern, because
 * /\d{4}-\d{2}-\d{2}/ happily accepts 2026-02-30. Building the date and
 * checking it still formats to the same string rejects days that do not
 * exist in that month.
 */
export function validateBirthDate(raw: unknown, today = new Date()): Result<string> {
  if (typeof raw !== "string") {
    return fail("La fecha de nacimiento es obligatoria.");
  }

  const value = raw.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail("Usa el formato AAAA-MM-DD para la fecha de nacimiento.");
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return fail("La fecha de nacimiento no existe.");
  }

  if (parsed.toISOString().slice(0, 10) !== value) {
    return fail("La fecha de nacimiento no existe.");
  }

  const year = parsed.getUTCFullYear();

  if (year < 1900) {
    return fail("La fecha de nacimiento es demasiado antigua.");
  }

  if (parsed.getTime() > today.getTime()) {
    return fail("La fecha de nacimiento no puede estar en el futuro.");
  }

  return ok(value);
}

/**
 * Mexican numbers, stored as the ten national digits. A leading 52 country
 * code is accepted and dropped so the same phone typed either way is stored
 * once. This rejects foreign numbers, which is a real limitation and the
 * reason the rule lives in one function rather than scattered.
 */
export function validatePhoneNumber(raw: unknown): Result<string> {
  if (typeof raw !== "string") {
    return fail("El teléfono es obligatorio.");
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return ok(digits);
  }

  if (digits.length === 12 && digits.startsWith("52")) {
    return ok(digits.slice(2));
  }

  return fail("El teléfono debe tener 10 dígitos.");
}

/**
 * A charset allowlist rather than a shape. The admin UI suggests
 * {INITIALS}-{DDMMYY}-{sequence}, but folios are also read off paper and may
 * predate that convention, so pinning the shape would reject legitimate ones
 * for no security gain. Constraining the characters is what makes a folio
 * safe to put in a URL path.
 *
 * Uppercased so lookup is case insensitive, which is how someone reading a
 * printed folio expects a reference number to behave.
 */
export function validateFolio(raw: unknown): Result<string> {
  if (typeof raw !== "string") {
    return fail("El folio es obligatorio.");
  }

  const value = raw.trim().toUpperCase();

  if (value.length < 3 || value.length > 32) {
    return fail("El folio debe tener entre 3 y 32 caracteres.");
  }

  if (!/^[A-Z0-9-]+$/.test(value)) {
    return fail("El folio solo admite letras, números y guiones.");
  }

  return ok(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids are generated with crypto.randomUUID, so anything else is malformed. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

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
export function contentDisposition(
  filename: string,
  disposition: "inline" | "attachment" = "inline",
): string {
  const ascii =
    filename
      .replace(/[\\"]/g, "")
      // Anything outside printable ASCII, which includes CR, LF and every
      // other control character, cannot appear in the quoted form.
      .replace(/[^\x20-\x7e]/g, "_")
      .trim() || "resultado.pdf";

  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
