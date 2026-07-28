// All SQL touching patients and records. Handlers call these; they never
// build a statement themselves.

import { normalizeForSearch } from "../domain/search";

export type RecordDetailRow = {
  record_id: string;
  folio: string;
  patient_id: string;
  full_name: string;
  birth_date: string;
  phone_number: string;
};

export type RecordListRow = {
  record_id: string;
  folio: string;
  created_at: string;
  full_name: string;
  total_count: number;
  uploaded_count: number;
  confirmed_count: number;
  published_count: number;
  revoked_count: number;
  latest_uploaded_at: string | null;
};

export type ResultTally = {
  total: number;
  byStatus: Partial<Record<"UPLOADED" | "CONFIRMED" | "PUBLISHED" | "REVOKED", number>>;
};

/**
 * Turns the four SUM(CASE ...) columns every tally query selects into the
 * shape the API actually returns. A status only appears in byStatus when its
 * count is non-zero — an absent key reads as "none", never a 0 the caller
 * has to filter back out.
 */
export function tallyFromCounts(row: {
  total_count: number;
  uploaded_count: number;
  confirmed_count: number;
  published_count: number;
  revoked_count: number;
}): ResultTally {
  const byStatus: ResultTally["byStatus"] = {};

  if (row.uploaded_count) byStatus.UPLOADED = row.uploaded_count;
  if (row.confirmed_count) byStatus.CONFIRMED = row.confirmed_count;
  if (row.published_count) byStatus.PUBLISHED = row.published_count;
  if (row.revoked_count) byStatus.REVOKED = row.revoked_count;

  return { total: row.total_count, byStatus };
}

/** Shared by every query that groups files by record and needs per-status counts. */
const TALLY_COLUMNS = `
  COUNT(files.file_id) AS total_count,
  SUM(CASE WHEN files.status = 'UPLOADED' THEN 1 ELSE 0 END) AS uploaded_count,
  SUM(CASE WHEN files.status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
  SUM(CASE WHEN files.status = 'PUBLISHED' THEN 1 ELSE 0 END) AS published_count,
  SUM(CASE WHEN files.status = 'REVOKED' THEN 1 ELSE 0 END) AS revoked_count
`;

export type NewRecord = {
  recordId: string;
  patientId: string;
  folio: string;
  fullName: string;
  birthDate: string;
  phoneNumber: string;
};

/**
 * Both inserts go in one batch, which D1 runs as a transaction. A folio
 * collision therefore rolls the patient back with it instead of leaving an
 * orphaned patient row behind.
 */
export function insertPatientAndRecord(db: D1Database, record: NewRecord) {
  return db.batch([
    db
      .prepare(
        "INSERT INTO patients (patient_id, full_name, birth_date, phone_number, search_name) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        record.patientId,
        record.fullName,
        record.birthDate,
        record.phoneNumber,
        normalizeForSearch(record.fullName),
      ),
    db
      .prepare("INSERT INTO records (record_id, folio, patient_id) VALUES (?, ?, ?)")
      .bind(record.recordId, record.folio, record.patientId),
  ]);
}

/**
 * D1 surfaces a constraint violation as an Error whose message embeds the
 * SQLite text. There is no stable error code exposed, so the message is
 * matched, but only after checking the driver-independent facts first: the
 * cause chain and the constraint name both appear. Callers pre-check the
 * folio anyway, so this is the race backstop rather than the primary path.
 */
export function isFolioConflict(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause instanceof Error ? error.cause.message : "";
  const message = `${error.message} ${cause}`;

  return (
    message.includes("UNIQUE constraint failed") && message.includes("records.folio")
  );
}

export function findByFolio(db: D1Database, folio: string) {
  return db
    .prepare(
      `SELECT records.record_id, patients.full_name
       FROM records
       JOIN patients ON patients.patient_id = records.patient_id
       WHERE records.folio = ?`,
    )
    .bind(folio)
    .first<{ record_id: string; full_name: string }>();
}

const DETAIL_COLUMNS = `
  records.record_id,
  records.folio,
  patients.patient_id,
  patients.full_name,
  patients.birth_date,
  patients.phone_number
`;

/**
 * One query for both entry points. The admin UI opens a record by id after a
 * click and by folio after a scan, and the two used to be separate handlers
 * whose only difference was this WHERE clause.
 */
export function findRecordDetail(
  db: D1Database,
  lookup: { by: "id" | "folio"; value: string },
) {
  const column = lookup.by === "id" ? "records.record_id" : "records.folio";

  return db
    .prepare(
      `SELECT ${DETAIL_COLUMNS}
       FROM records
       JOIN patients ON patients.patient_id = records.patient_id
       WHERE ${column} = ?`,
    )
    .bind(lookup.value)
    .first<RecordDetailRow>();
}

export function exists(db: D1Database, recordId: string) {
  return db
    .prepare("SELECT record_id FROM records WHERE record_id = ?")
    .bind(recordId)
    .first<{ record_id: string }>();
}

/**
 * Every record with its results' tally, newest activity first.
 *
 * `status` used to filter to "the latest file is in this state", which
 * quietly dropped a folio from the manager queue (`?status=CONFIRMED`) the
 * moment a newer draft was added on top of an older confirmed result — the
 * confirmed one didn't go anywhere, but the query stopped seeing it. It now
 * means "has at least one result in this state", via HAVING on the same
 * per-status counts the tally already computes, so the fix and the tally
 * share one query instead of disagreeing with each other.
 *
 * uploaded_at resolves to the second, so file_id breaks ties for
 * "most recent activity" the same way it does everywhere else in this file.
 */
export function listRecent(db: D1Database, limit: number, status?: string) {
  const having = status ? "HAVING SUM(CASE WHEN files.status = ? THEN 1 ELSE 0 END) > 0" : "";
  const bindings = status ? [status, limit] : [limit];

  return db
    .prepare(
      `SELECT
         records.record_id,
         records.folio,
         records.created_at,
         patients.full_name,
         ${TALLY_COLUMNS},
         MAX(files.uploaded_at) AS latest_uploaded_at
       FROM records
       JOIN patients ON patients.patient_id = records.patient_id
       LEFT JOIN files ON files.record_id = records.record_id
       GROUP BY records.record_id
       ${having}
       ORDER BY COALESCE(MAX(files.uploaded_at), records.created_at) DESC
       LIMIT ?`,
    )
    .bind(...bindings)
    .all<RecordListRow>();
}

/**
 * Folios matching a folio, patient name, or phone query — the three criteria
 * the unified search box supports in one input.
 *
 * An exact folio match sorts first, then a folio prefix match, then
 * everything else (name/phone matches) by recency — an employee typing a
 * full folio expects that folio, not whichever record was touched last.
 *
 * `phoneDigits` is empty when the query has no digits in it at all, in which
 * case the phone branch is skipped rather than matching every row with a
 * `LIKE '%'` — the caller passes `null` for that branch's binding when so,
 * and this function only reads it if it might apply.
 */
export function searchFolios(
  db: D1Database,
  input: { normalizedQuery: string; folioQuery: string; phoneDigits: string | null },
  limit: number,
) {
  const phoneClause = input.phoneDigits ? "OR patients.phone_number LIKE ? || '%'" : "";
  const phoneBinding = input.phoneDigits ? [input.phoneDigits] : [];

  return db
    .prepare(
      `SELECT
         records.record_id,
         records.folio,
         records.created_at,
         patients.full_name,
         ${TALLY_COLUMNS}
       FROM records
       JOIN patients ON patients.patient_id = records.patient_id
       LEFT JOIN files ON files.record_id = records.record_id
       WHERE UPPER(records.folio) LIKE UPPER(?) || '%'
          OR patients.search_name LIKE '%' || ? || '%'
          ${phoneClause}
       GROUP BY records.record_id
       ORDER BY
         CASE
           WHEN UPPER(records.folio) = UPPER(?) THEN 0
           WHEN UPPER(records.folio) LIKE UPPER(?) || '%' THEN 1
           ELSE 2
         END,
         records.created_at DESC
       LIMIT ?`,
    )
    .bind(
      input.folioQuery,
      input.normalizedQuery,
      ...phoneBinding,
      input.folioQuery,
      input.folioQuery,
      limit,
    )
    .all<RecordListRow>();
}

export type PatientSearchRow = {
  patient_id: string;
  full_name: string;
  phone_number: string;
  folio_count: number;
};

/** Patients matching a name or phone query, each with how many folios they have. */
export function searchPatients(
  db: D1Database,
  input: { normalizedQuery: string; phoneDigits: string | null },
  limit: number,
) {
  const phoneClause = input.phoneDigits ? "OR patients.phone_number LIKE ? || '%'" : "";
  const phoneBinding = input.phoneDigits ? [input.phoneDigits] : [];

  return db
    .prepare(
      `SELECT
         patients.patient_id,
         patients.full_name,
         patients.phone_number,
         COUNT(records.record_id) AS folio_count
       FROM patients
       LEFT JOIN records ON records.patient_id = patients.patient_id
       WHERE patients.search_name LIKE '%' || ? || '%'
          ${phoneClause}
       GROUP BY patients.patient_id
       ORDER BY patients.full_name ASC
       LIMIT ?`,
    )
    .bind(input.normalizedQuery, ...phoneBinding, limit)
    .all<PatientSearchRow>();
}
