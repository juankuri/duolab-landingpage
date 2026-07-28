/**
 * Folio suggestion.
 *
 * The folio is provided by laboratory staff. The system may propose one, but it
 * stays editable until the folio is created — so everything here is a suggestion
 * and nothing here is authoritative.
 *
 * Lifted unchanged from admin.astro; the accent handling in particular is a real
 * rule, not a nicety. Extracted so the several creation screens share one
 * implementation instead of each growing their own.
 */

const SPANISH_PARTICLES = /\b(de|del|la|las|los|y)\b/gi;

/**
 * "Ángel Núñez" must suggest ANNU, not ÁNNÚ: the folio travels in a URL path and
 * the server only accepts A-Z, 0-9 and hyphens. Decomposing to NFD splits the
 * accent into its own combining mark, which is then dropped, leaving the base
 * letter.
 */
export function stripDiacritics(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Extract 4-letter initials from a patient's full name.
 * "Maria Lopez" → "MALO", "Mario Jimenez Perez" → "MAJP", "Alejandro" → "ALEJ".
 */
export function initialsFromName(name) {
  const cleaned = stripDiacritics(name)
    .trim()
    .replace(SPANISH_PARTICLES, "")
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toUpperCase());

  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) {
    return (cleaned[0] + "XXXX").slice(0, 4);
  }
  if (cleaned.length === 2) {
    return (cleaned[0].slice(0, 2) + cleaned[1].slice(0, 2)).slice(0, 4);
  }
  if (cleaned.length === 3) {
    return (
      cleaned[0].slice(0, 2) + cleaned[1].slice(0, 1) + cleaned[2].slice(0, 1)
    ).slice(0, 4);
  }
  return cleaned
    .slice(0, 4)
    .map((word) => word[0])
    .join("");
}

/** Today as DDMMYY. */
export function todayDDMMYY(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    pad(now.getDate()) + pad(now.getMonth() + 1) + pad(now.getFullYear() % 100)
  );
}

/**
 * `${initials}-${DDMMYY}-`, left open so the employee types the sequence number.
 * An empty name yields an empty suggestion rather than a stub with no initials.
 */
export function suggestFolio(fullName, now = new Date()) {
  if (!fullName || !fullName.trim()) return "";
  return `${initialsFromName(fullName)}-${todayDDMMYY(now)}-`;
}
