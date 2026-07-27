// All SQL touching patients and records. Handlers call these; they never
// build a statement themselves.

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
  latest_status: string | null;
  latest_uploaded_at: string | null;
};

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
        "INSERT INTO patients (patient_id, full_name, birth_date, phone_number) VALUES (?, ?, ?, ?)",
      )
      .bind(
        record.patientId,
        record.fullName,
        record.birthDate,
        record.phoneNumber,
      ),
    db
      .prepare("INSERT INTO records (record_id, folio, patient_id) VALUES (?, ?, ?)")
      .bind(record.recordId, record.folio, record.patientId),
  ]);
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

export function listRecent(db: D1Database, limit: number) {
  return db
    .prepare(
      `SELECT
         records.record_id,
         records.folio,
         records.created_at,
         patients.full_name,
         latest.status AS latest_status,
         latest.uploaded_at AS latest_uploaded_at
       FROM records
       JOIN patients ON patients.patient_id = records.patient_id
       LEFT JOIN (
         SELECT f.record_id, f.status, f.uploaded_at
         FROM files f
         WHERE f.uploaded_at = (
           SELECT MAX(f2.uploaded_at) FROM files f2 WHERE f2.record_id = f.record_id
         )
       ) latest ON latest.record_id = records.record_id
       ORDER BY COALESCE(latest.uploaded_at, records.created_at) DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<RecordListRow>();
}
