// All SQL touching patients and records. Handlers call these; they never
// build a statement themselves.

import * as filesRepo from "./files.repo";
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

type NewPatient = {
  patientId: string;
  fullName: string;
  birthDate: string;
  phoneNumber: string;
};

function preparePatientInsert(db: D1Database, patient: NewPatient) {
  return db
    .prepare(
      "INSERT INTO patients (patient_id, full_name, birth_date, phone_number, search_name) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      patient.patientId,
      patient.fullName,
      patient.birthDate,
      patient.phoneNumber,
      normalizeForSearch(patient.fullName),
    );
}

function prepareRecordInsert(
  db: D1Database,
  record: { recordId: string; folio: string; patientId: string },
) {
  return db
    .prepare("INSERT INTO records (record_id, folio, patient_id) VALUES (?, ?, ?)")
    .bind(record.recordId, record.folio, record.patientId);
}

/**
 * Partial patient update. Each field is optional so a caller only names what
 * actually changed; `patientId` is never one of them — it is immutable.
 * `search_name` is only recomputed when `fullName` is part of the update
 * (preparePatientInsert's normalizeForSearch, mirrored here) so an edit to
 * just the phone or birth date can't accidentally touch it. `updated_at` is
 * always bumped, since something did change if this runs at all.
 */
export function updatePatient(
  db: D1Database,
  patientId: string,
  changes: { fullName?: string; birthDate?: string; phoneNumber?: string },
) {
  const sets: string[] = [];
  const bindings: unknown[] = [];

  if (changes.fullName !== undefined) {
    sets.push("full_name = ?", "search_name = ?");
    bindings.push(changes.fullName, normalizeForSearch(changes.fullName));
  }
  if (changes.birthDate !== undefined) {
    sets.push("birth_date = ?");
    bindings.push(changes.birthDate);
  }
  if (changes.phoneNumber !== undefined) {
    sets.push("phone_number = ?");
    bindings.push(changes.phoneNumber);
  }

  sets.push("updated_at = CURRENT_TIMESTAMP");
  bindings.push(patientId);

  return db
    .prepare(`UPDATE patients SET ${sets.join(", ")} WHERE patient_id = ?`)
    .bind(...bindings)
    .run();
}

export function findPatient(db: D1Database, patientId: string) {
  return db
    .prepare(
      "SELECT patient_id, full_name, birth_date, phone_number FROM patients WHERE patient_id = ?",
    )
    .bind(patientId)
    .first<{ patient_id: string; full_name: string; birth_date: string; phone_number: string }>();
}

/**
 * Patient (optional) + record + first result, one `db.batch()`. A folio can
 * no longer exist without a result (DEC pending, Slice 9 doc pass) — this is
 * the only way a record row gets created now, which is what makes that true
 * rather than just documented.
 *
 * `patient` is omitted when the caller already validated an existing
 * `patientId` (Flow C) — nothing to insert, the record just points at it.
 * Folio collisions surface the same way as before: `isFolioConflict()` below
 * still matches on `records.folio`, regardless of which position in the
 * batch the record insert holds.
 */
export function createRecordWithFile(
  db: D1Database,
  input: {
    patient?: NewPatient;
    record: { recordId: string; folio: string; patientId: string };
    file: filesRepo.NewFile;
  },
) {
  const statements: D1PreparedStatement[] = [];

  if (input.patient) statements.push(preparePatientInsert(db, input.patient));
  statements.push(prepareRecordInsert(db, input.record));
  statements.push(filesRepo.prepareInsert(db, input.file));

  return db.batch(statements);
}

export type PatientFolioRow = {
  record_id: string;
  folio: string;
  total_count: number;
  uploaded_count: number;
  confirmed_count: number;
  published_count: number;
  revoked_count: number;
};

/** Every folio belonging to one patient, each with its own tally. Newest first. */
export function listFoliosForPatient(db: D1Database, patientId: string) {
  return db
    .prepare(
      `SELECT
         records.record_id,
         records.folio,
         ${TALLY_COLUMNS}
       FROM records
       LEFT JOIN files ON files.record_id = records.record_id
       WHERE records.patient_id = ?
       GROUP BY records.record_id
       ORDER BY records.created_at DESC`,
    )
    .bind(patientId)
    .all<PatientFolioRow>();
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

export type QueueFileRow = {
  record_id: string;
  file_id: string;
  original_filename: string;
  status: string;
  sequence: number | null;
  uploaded_at: string;
};

/**
 * The manager queue's per-file detail, for a batch of records at once —
 * `?include=files` on the list endpoint. Two round trips total regardless of
 * `limit`: this one plus `listRecent` above, never one query per record.
 *
 * D1 caps a single statement at 100 bound parameters. A caller passing
 * `limit=100` would put 100 ids in the IN-list already, and the optional
 * `status` binding would push it over — so ids are chunked at 50 and the
 * results merged, rather than trusting the caller's `limit` to always leave
 * headroom.
 *
 * `status`, when given, filters the FILES returned, not the records: the
 * list's `?status=` already selected records that have at least one file in
 * that state (see listRecent's comment), and a record can have others besides
 * — an older PUBLISHED file alongside a fresh CONFIRMED draft, say. The
 * manager queue wants only the file it can act on for that tab.
 */
export async function listFilesForRecords(
  db: D1Database,
  recordIds: string[],
  status?: string,
): Promise<QueueFileRow[]> {
  if (recordIds.length === 0) {
    return [];
  }

  const CHUNK_SIZE = 50;
  const rows: QueueFileRow[] = [];

  for (let start = 0; start < recordIds.length; start += CHUNK_SIZE) {
    const chunk = recordIds.slice(start, start + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const statusClause = status ? "AND status = ?" : "";
    const bindings = status ? [...chunk, status] : chunk;

    const result = await db
      .prepare(
        `SELECT
           record_id,
           file_id,
           original_filename,
           status,
           sequence,
           uploaded_at
         FROM files
         WHERE record_id IN (${placeholders})
           ${statusClause}
         -- Same tie-break as listForRecord, so ordering agrees across endpoints.
         ORDER BY record_id, uploaded_at DESC, file_id DESC`,
      )
      .bind(...bindings)
      .all<QueueFileRow>();

    rows.push(...result.results);
  }

  return rows;
}

/**
 * Every folio created within a lab-local calendar day, across all patients —
 * the pool `domain/folio.ts#nextDailySequence` reads to suggest the next
 * number. `bounds` is a [startUtc, endUtc) pair already computed against
 * `records.created_at`'s storage format, so this is a plain indexed range
 * scan, not a per-row date computation.
 */
export function listFoliosForDay(
  db: D1Database,
  bounds: { startUtc: string; endUtc: string },
) {
  return db
    .prepare("SELECT folio FROM records WHERE created_at >= ? AND created_at < ?")
    .bind(bounds.startUtc, bounds.endUtc)
    .all<{ folio: string }>();
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
