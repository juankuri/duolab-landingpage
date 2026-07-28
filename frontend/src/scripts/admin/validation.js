/**
 * Client mirror of backend/src/domain/validation.ts.
 *
 * The server stays the authority — every rule here is enforced again there, and
 * the API's per-field errors are what actually get shown when the two disagree.
 * This exists so the employee finds out before the round trip, not because
 * anyone is trusting it.
 *
 * Kept as pure functions with the same { ok, value } / { ok, error } shape as the
 * server's, so the two can be checked against a shared table of cases rather
 * than drifting quietly.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });

export function validateFullName(raw) {
  if (typeof raw !== "string") return fail("El nombre es obligatorio.");

  const value = raw.trim().replace(/\s+/g, " ");

  if (!value) return fail("Captura el nombre completo.");
  if (value.length < 2 || value.length > 120) {
    return fail("El nombre debe tener entre 2 y 120 caracteres.");
  }
  if (!/\p{L}/u.test(value)) {
    return fail("El nombre debe incluir al menos una letra.");
  }

  return ok(value);
}

export function validateBirthDate(raw, today = new Date()) {
  if (typeof raw !== "string") return fail("La fecha de nacimiento es obligatoria.");

  const value = raw.trim();

  if (!value) return fail("Captura la fecha de nacimiento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail("Usa el formato AAAA-MM-DD para la fecha de nacimiento.");
  }

  // Round-trip rather than trust the pattern: /\d{4}-\d{2}-\d{2}/ happily
  // accepts 2026-02-30.
  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail("La fecha de nacimiento no existe.");
  }
  if (parsed.getUTCFullYear() < 1900) {
    return fail("La fecha de nacimiento es demasiado antigua.");
  }
  if (parsed.getTime() > today.getTime()) {
    return fail("La fecha de nacimiento no puede estar en el futuro.");
  }

  return ok(value);
}

/** Ten national digits; a leading 52 is accepted and dropped, as on the server. */
export function validatePhoneNumber(raw) {
  if (typeof raw !== "string") return fail("El teléfono es obligatorio.");

  const digits = raw.replace(/\D/g, "");

  if (!digits) return fail("Captura el teléfono.");
  if (digits.length === 10) return ok(digits);
  if (digits.length === 12 && digits.startsWith("52")) return ok(digits.slice(2));

  return fail("El teléfono debe tener 10 dígitos.");
}

export function validateFolio(raw) {
  if (typeof raw !== "string") return fail("El folio es obligatorio.");

  const value = raw.trim().toUpperCase();

  if (!value) return fail("Captura el folio.");
  if (value.length < 3 || value.length > 32) {
    return fail("El folio debe tener entre 3 y 32 caracteres.");
  }
  if (!/^[A-Z0-9-]+$/.test(value)) {
    return fail("El folio solo admite letras, números y guiones.");
  }

  return ok(value);
}

/**
 * Type and size only. The server additionally checks the magic bytes, which the
 * browser cannot do without reading the file, and which is the check that
 * actually matters — a renamed .docx passes everything here.
 */
export function validatePdf(file) {
  if (!file) return fail("Selecciona el archivo PDF.");
  if (file.type !== "application/pdf") return fail("Solo se aceptan archivos PDF.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("El archivo supera los 15 MB.");
  if (file.size === 0) return fail("El archivo está vacío.");

  return ok(file);
}

/**
 * Validates a whole creation form at once and returns { values, errors }.
 *
 * Every field is checked before any is reported, matching the server's
 * behaviour (routes/records.ts names every problem in one response) so the
 * employee does not submit repeatedly to discover the next mistake.
 *
 * `fields` selects which of them apply — Flow C reuses this with only
 * folio and pdf, because the patient is already chosen.
 */
export function validateCreation(
  input,
  fields = ["fullName", "birthDate", "phoneNumber", "folio", "pdf"],
) {
  const checks = {
    fullName: () => validateFullName(input.fullName),
    birthDate: () => validateBirthDate(input.birthDate),
    phoneNumber: () => validatePhoneNumber(input.phoneNumber),
    folio: () => validateFolio(input.folio),
    pdf: () => validatePdf(input.pdf),
  };

  const values = {};
  const errors = {};

  for (const name of fields) {
    const result = checks[name]();
    if (result.ok) values[name] = result.value;
    else errors[name] = result.error;
  }

  return { values, errors, ok: Object.keys(errors).length === 0 };
}
