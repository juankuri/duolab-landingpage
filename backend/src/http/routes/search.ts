import { Hono } from "hono";

import * as recordsRepo from "../../data/records.repo";
import { normalizeForSearch, normalizePhoneQuery } from "../../domain/search";
import type { AppEnv } from "../../env";

export const search = new Hono<AppEnv>();

const LIMIT = 20;

/**
 * One query box, three criteria: folio (exact/prefix), patient name
 * (accent-insensitive substring), phone (digit prefix). Returns folios and
 * patients as two separate groups — a patient with three folios should be
 * findable by name whether or not any single folio matched, and the two
 * groups answer different questions ("which folio" vs "which patient").
 *
 * An empty or whitespace-only query returns both groups empty rather than
 * running a `LIKE '%'` that would match every row — this is a search box,
 * not a browse-everything view (that's GET /records).
 */
search.get("/", async (c) => {
  const raw = c.req.query("q") ?? "";
  const trimmed = raw.trim();

  if (!trimmed) {
    return c.json({ folios: [], patients: [] });
  }

  const normalizedQuery = normalizeForSearch(trimmed);
  const folioQuery = trimmed.toUpperCase();
  const digits = normalizePhoneQuery(trimmed);
  // A handful of stray digits inside a name ("Ana 2") is not a phone number
  // someone is searching for — the phone branch only engages once there is
  // enough to be a plausible partial number.
  const phoneDigits = digits.length >= 3 ? digits : null;

  const [folioRows, patientRows] = await Promise.all([
    recordsRepo.searchFolios(c.env.DB, { normalizedQuery, folioQuery, phoneDigits }, LIMIT),
    recordsRepo.searchPatients(c.env.DB, { normalizedQuery, phoneDigits }, LIMIT),
  ]);

  return c.json({
    folios: folioRows.results.map((row) => ({
      recordId: row.record_id,
      folio: row.folio,
      patientName: row.full_name,
      results: recordsRepo.tallyFromCounts(row),
    })),
    patients: patientRows.results.map((row) => ({
      patientId: row.patient_id,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      folioCount: row.folio_count,
    })),
  });
});
