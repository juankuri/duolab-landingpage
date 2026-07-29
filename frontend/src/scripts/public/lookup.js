/**
 * Pure logic behind /resultados — the patient lookup page. DOM/fetch stay in
 * resultados.astro's own script, same split as scripts/admin/*.js.
 *
 * Every function here is deliberately blind to *why* a lookup failed beyond
 * what the HTTP status code already reveals — wrong folio, wrong phone,
 * wrong birth date, no such record, not yet published, and revoked are all
 * indistinguishable 404s on the wire (DEC-015, non-enumeration), and nothing
 * added here may narrow that back down. The one exception the backend
 * itself sanctions is rate limiting: 429 is allowed to read differently,
 * because volume is not sensitive the way "does this folio exist" is.
 */

/** Which required field is empty, in the order a person fills them in — or null. */
export function firstEmptyField({ folio, phone, birthDate }) {
  if (!folio?.trim()) return "folio";
  if (!phone?.trim()) return "phone";
  if (!birthDate?.trim()) return "birthDate";
  return null;
}

/** Strips everything but digits, for the phone field's as-you-type filter. */
export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * The one message for every lookup failure that isn't empty-input or rate
 * limiting — asserted by status code, never by narrowing on the response
 * body, which is exactly the enumeration DEC-015 exists to prevent.
 */
export function lookupErrorMessage(status) {
  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
  }

  if (status >= 500) {
    return "Ocurrió un error. Intenta de nuevo más tarde.";
  }

  // Every other non-2xx (400 malformed body, 404 no match / not published /
  // revoked) reads identically on purpose.
  return "No encontramos un resultado con esos datos. Verifica el folio, el teléfono y la fecha de nacimiento.";
}

/**
 * How much of the download token's window is left, given the `expiresAt`
 * the lookup response carries (previously fetched and discarded). `now` is
 * injected so this stays a pure function under test rather than reading
 * Date.now() itself.
 */
export function tokenExpiry(expiresAt, now = Date.now()) {
  const expiry = Date.parse(expiresAt);

  if (Number.isNaN(expiry)) {
    // A missing/malformed expiresAt should not be treated as "forever valid" —
    // fail toward re-verifying, not toward a token the UI can't reason about.
    return { expired: true, msLeft: 0 };
  }

  const msLeft = expiry - now;
  return { expired: msLeft <= 0, msLeft: Math.max(0, msLeft) };
}

/** "4 minutos" / "menos de un minuto" — coarse on purpose, this isn't a stopwatch. */
export function formatMsLeft(msLeft) {
  const minutes = Math.floor(msLeft / 60_000);

  if (minutes <= 0) return "menos de un minuto";
  if (minutes === 1) return "1 minuto";
  return `${minutes} minutos`;
}

/**
 * The download URL for one published study. The token names the folio and
 * the path names the file — the server checks the file actually belongs to
 * that folio, so a wrong pairing fails rather than serving someone else's
 * result.
 */
export function downloadUrl(apiBase, downloadToken, fileId) {
  return `${apiBase}/api/public/results/${encodeURIComponent(downloadToken)}/download/${encodeURIComponent(fileId)}`;
}

/**
 * "26 jul 2026" from the server's zoneless timestamp. Mirrors
 * scripts/admin/render.js's formatMoment in appending "Z" — D1 stores
 * CURRENT_TIMESTAMP without an offset, and parsing it as local time would
 * shift the date across midnight for patients.
 */
export function formatPublishedAt(raw) {
  if (!raw) return "";

  const parsed = new Date(`${String(raw).replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Plural-aware heading for the result panel. */
export function resultsHeading(count) {
  if (count === 1) return "Encontramos 1 resultado";
  return `Encontramos ${count} resultados`;
}
