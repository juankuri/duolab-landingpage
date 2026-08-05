// Pure folio-suggestion rules — no I/O, no D1. The server is the authority
// on the folio a new record is offered (DEC-027): the frontend's own
// suggestFolio() (scripts/admin/folio.js) stays as a client-side fallback
// for instant feedback while typing, but this is what the API actually
// returns and what the create form ultimately submits.
//
// The convention: {INITIALS}-{DDMMYY}-{SEQ_PREFIX}{n}, e.g. JPKR-040826-0131.
// SEQ_PREFIX ("013") is a literal component the client asked for, not a
// zero-padding scheme — folio #10 of the day is …-01310, not …-013010. Both
// are named constants below specifically so a corrected reading (a padded
// counter, a different prefix) is a one-line change, not a rewrite.

/** The literal digits the client asked to see before the counter. Not padding. */
export const FOLIO_SEQUENCE_PREFIX = "013";

// Ciudad del Carmen, Campeche observes no DST — a fixed offset is correct
// year-round, unlike most of the rest of Mexico. Getting this wrong would
// roll the sequence over at 18:00 local instead of midnight, silently
// reusing numbers from "yesterday" for the last six hours of every real day.
export const LAB_UTC_OFFSET_HOURS = -6;
const LAB_OFFSET_MS = LAB_UTC_OFFSET_HOURS * 60 * 60 * 1000;

const SPANISH_PARTICLES = /\b(de|del|la|las|los|y)\b/gi;

/**
 * "Ángel Núñez" must suggest ANNU, not ÁNNÚ — the folio travels in a URL
 * path and validateFolio only accepts A-Z, 0-9 and hyphens. Decomposing to
 * NFD splits the accent into its own combining mark, which is then dropped,
 * leaving the base letter. Ported verbatim from
 * frontend/src/scripts/admin/folio.js so the two cannot silently diverge —
 * backend/test/folio.test.ts cross-checks the same case table.
 */
export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Extract 4-letter initials from a patient's full name.
 * "Maria Lopez" → "MALO", "Mario Jimenez Perez" → "MAJP", "Alejandro" → "ALEJ".
 */
export function initialsFromName(name: string): string {
  const cleaned = stripDiacritics(name)
    .trim()
    .replace(SPANISH_PARTICLES, "")
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toUpperCase());

  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return (cleaned[0] + "XXXX").slice(0, 4);
  if (cleaned.length === 2) return (cleaned[0].slice(0, 2) + cleaned[1].slice(0, 2)).slice(0, 4);
  if (cleaned.length === 3) {
    return (cleaned[0].slice(0, 2) + cleaned[1].slice(0, 1) + cleaned[2].slice(0, 1)).slice(0, 4);
  }
  return cleaned
    .slice(0, 4)
    .map((word) => word[0])
    .join("");
}

/** The lab-local calendar date (as a UTC-midnight Date carrying only Y/M/D) containing `instant`. */
function labLocalCalendarDate(instant: Date): Date {
  const shifted = new Date(instant.getTime() + LAB_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
  );
}

/** Today, in the lab's own calendar, as DDMMYY — never the server's UTC date. */
export function labLocalDDMMYY(instant: Date): string {
  const local = labLocalCalendarDate(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return pad(local.getUTCDate()) + pad(local.getUTCMonth() + 1) + pad(local.getUTCFullYear() % 100);
}

function toSqliteTimestamp(d: Date): string {
  // SQLite's CURRENT_TIMESTAMP (what records.created_at is stored as) formats
  // as "YYYY-MM-DD HH:MM:SS" in UTC — no "T", no "Z". Matching that exactly
  // is what makes a plain string range comparison against created_at valid.
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * UTC [start, end) bounds of the lab-local calendar day containing `instant`,
 * formatted for a direct `created_at >= ? AND created_at < ?` comparison.
 * This is an index-friendly range predicate, not a leading-wildcard LIKE.
 */
export function labDayUtcBounds(instant: Date): { startUtc: string; endUtc: string } {
  const localMidnight = labLocalCalendarDate(instant);
  const startInstant = new Date(localMidnight.getTime() - LAB_OFFSET_MS);
  const endInstant = new Date(startInstant.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: toSqliteTimestamp(startInstant), endUtc: toSqliteTimestamp(endInstant) };
}

const SEQUENCE_SUFFIX = new RegExp(`-${FOLIO_SEQUENCE_PREFIX}(\\d+)$`);

/**
 * Reads the sequence number out of any folio, not only ones matching a
 * particular initials/date base — the counter is global per lab-day, so a
 * folio belonging to a different patient still occupies a slot in it. A
 * folio not matching the `-{PREFIX}{digits}` convention (a paper folio
 * predating it, or one an employee typed by hand) simply isn't a number to
 * count past — that is what validateFolio's charset allowlist already
 * treats as a legitimate folio, and this stays consistent with it.
 */
export function parseSequence(folio: string): number | null {
  const match = folio.match(SEQUENCE_SUFFIX);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * `${base}-${FOLIO_SEQUENCE_PREFIX}${sequence}`. `base` is
 * `${initials}-${DDMMYY}`; kept as a separate parameter (not reassembled
 * internally) so a caller who already computed it once — the route handler,
 * which also returns it — never risks the two disagreeing.
 */
export function buildFolio(base: string, sequence: number): string {
  return `${base}-${FOLIO_SEQUENCE_PREFIX}${sequence}`;
}

/**
 * The next number in the day's global sequence, given every folio already
 * created that lab-day (any patient, any initials). Parses the max rather
 * than counting rows: a day with some folios that don't follow the
 * convention still yields a correct next number instead of drifting from
 * one that just counts everything.
 */
export function nextDailySequence(folios: string[]): number {
  let max = 0;
  for (const folio of folios) {
    const n = parseSequence(folio);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}

export type FolioSuggestion = { folio: string; initials: string; day: string; sequence: number };

/**
 * The full suggestion for a given name, at a given instant, given the day's
 * folios so far (any patient). `existingFolios` is the caller's
 * responsibility to fetch scoped to the right lab-day — this function does
 * no I/O and trusts the list it's handed.
 */
export function suggestFolio(
  fullName: string,
  now: Date,
  existingFolios: string[],
): FolioSuggestion {
  const initials = initialsFromName(fullName);
  const day = labLocalDDMMYY(now);
  const sequence = nextDailySequence(existingFolios);
  return { folio: buildFolio(`${initials}-${day}`, sequence), initials, day, sequence };
}
