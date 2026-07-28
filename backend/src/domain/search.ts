/**
 * Normalizes text for accent-insensitive substring search.
 *
 * Used two places: writing patients.search_name (records.repo.ts, on every
 * insert) and normalizing the incoming query in GET /search. Both have to
 * agree on what "normalized" means, or "Núñez" would be stored one way and
 * searched another — this is the single definition either side calls.
 *
 * The frontend has its own copy, `stripDiacritics()` in
 * frontend/src/scripts/admin/folio.js, because nothing here can run in the
 * browser without a bundler pulling in this whole module. The two are tested
 * against the same case table (see test/search.test.ts and
 * frontend/test/folio.test.js) so they cannot drift silently.
 *
 * NFD decomposition splits an accented character into its base letter plus a
 * combining mark (é -> e + ´); \p{M} (Unicode property "Mark") strips any
 * combining mark left over, the same approach and the same regex as
 * folio.js's stripDiacritics() on the frontend, so the two cannot drift into
 * stripping a different set of marks from each other.
 */
export function normalizeForSearch(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Digits only, for matching a phone number regardless of how it was typed. */
export function normalizePhoneQuery(raw: string): string {
  return raw.replace(/\D/g, "");
}
