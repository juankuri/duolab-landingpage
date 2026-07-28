// All SQL touching files.

export type FilePreviewRow = {
  file_id: string;
  r2_key: string;
  original_filename: string;
  mime_type: string;
};

export type RecordFileRow = {
  file_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  uploaded_by: string;
  uploaded_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  published_by: string | null;
  published_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  sequence: number | null;
};

export type NewFile = {
  fileId: string;
  recordId: string;
  r2Key: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
};

/**
 * `sequence` is assigned once, here, from the current max for the record —
 * never recomputed. Deleting an earlier draft must not shift the numbers of
 * the results after it, or "FOLIO · #3" would stop naming the same physical
 * result between one page load and the next (see migration 0007).
 *
 * Unexecuted, so the atomic-create path (record-service.ts) can put it in
 * the same `db.batch()` as the record (and, for a new patient, the patient)
 * insert. `insert()` below is this run standalone, for the plain
 * add-a-result path where there is nothing else to batch it with.
 */
export function prepareInsert(db: D1Database, file: NewFile) {
  return db
    .prepare(
      `INSERT INTO files
         (file_id, record_id, r2_key, original_filename, mime_type, size_bytes, uploaded_by, sequence)
       VALUES (?, ?, ?, ?, ?, ?, ?,
         (SELECT COALESCE(MAX(sequence), 0) + 1 FROM files WHERE record_id = ?))`,
    )
    .bind(
      file.fileId,
      file.recordId,
      file.r2Key,
      file.originalFilename,
      file.mimeType,
      file.sizeBytes,
      file.uploadedBy,
      file.recordId,
    );
}

export function insert(db: D1Database, file: NewFile) {
  return prepareInsert(db, file).run();
}

export function listForRecord(db: D1Database, recordId: string) {
  return db
    .prepare(
      `SELECT
         file_id,
         original_filename,
         mime_type,
         size_bytes,
         status,
         uploaded_by,
         uploaded_at,
         confirmed_by,
         confirmed_at,
         published_by,
         published_at,
         revoked_by,
         revoked_at,
         revoked_reason,
         sequence
       FROM files
       WHERE record_id = ?
       -- file_id breaks the tie when two uploads share a second, so the
       -- order is stable rather than left to the query planner.
       ORDER BY uploaded_at DESC, file_id DESC`,
    )
    .bind(recordId)
    .all<RecordFileRow>();
}

export function findForPreview(db: D1Database, fileId: string) {
  return db
    .prepare(
      "SELECT file_id, r2_key, original_filename, mime_type FROM files WHERE file_id = ?",
    )
    .bind(fileId)
    .first<FilePreviewRow>();
}

/** Current lifecycle state, for telling "not found" apart from "wrong state". */
export function findStatus(db: D1Database, fileId: string) {
  return db
    .prepare("SELECT file_id, record_id, status FROM files WHERE file_id = ?")
    .bind(fileId)
    .first<{ file_id: string; record_id: string; status: string }>();
}

export function findInRecord(db: D1Database, recordId: string, fileId: string) {
  return db
    .prepare(
      "SELECT file_id, r2_key, status FROM files WHERE file_id = ? AND record_id = ?",
    )
    .bind(fileId, recordId)
    .first<{ file_id: string; r2_key: string; status: string }>();
}

export function remove(db: D1Database, fileId: string) {
  return db.prepare("DELETE FROM files WHERE file_id = ?").bind(fileId).run();
}

/**
 * Clears the confirmation as well as the status. A file sitting in UPLOADED
 * while still naming who confirmed it would be a record of something that is
 * no longer true, and the next confirmation is the one that counts.
 */
export function withdraw(db: D1Database, fileId: string) {
  return db
    .prepare(
      `UPDATE files
         SET status = 'UPLOADED',
             confirmed_by = NULL,
             confirmed_at = NULL
       WHERE file_id = ?
         AND status = 'CONFIRMED'`,
    )
    .bind(fileId)
    .run();
}

/**
 * The file to stream for a public download, live-checked against
 * `PUBLISHED` in the same query rather than trusting a status a caller might
 * have read earlier — a revoke must take effect on the very next request
 * (DEC-014), including one made against an otherwise still-valid token.
 */
export function findPublishedForDownload(db: D1Database, fileId: string) {
  return db
    .prepare(
      `SELECT file_id, r2_key, original_filename, mime_type
       FROM files
       WHERE file_id = ? AND status = 'PUBLISHED'`,
    )
    .bind(fileId)
    .first<FilePreviewRow>();
}

/** The published file for a record, if there is one. */
export function findPublished(db: D1Database, recordId: string) {
  return db
    .prepare(
      "SELECT file_id, original_filename FROM files WHERE record_id = ? AND status = 'PUBLISHED'",
    )
    .bind(recordId)
    .first<{ file_id: string; original_filename: string }>();
}

export function publish(db: D1Database, fileId: string, publishedBy: string) {
  return db
    .prepare(
      `UPDATE files
         SET status = 'PUBLISHED',
             published_by = ?,
             published_at = CURRENT_TIMESTAMP
       WHERE file_id = ?
         AND status = 'CONFIRMED'`,
    )
    .bind(publishedBy, fileId)
    .run();
}

export function revoke(
  db: D1Database,
  fileId: string,
  revokedBy: string,
  reason: string | null,
) {
  return db
    .prepare(
      `UPDATE files
         SET status = 'REVOKED',
             revoked_by = ?,
             revoked_at = CURRENT_TIMESTAMP,
             revoked_reason = ?
       WHERE file_id = ?
         AND status = 'PUBLISHED'`,
    )
    .bind(revokedBy, reason, fileId)
    .run();
}

/**
 * Revokes the currently published file and publishes the replacement in one
 * D1 batch, which runs as a transaction. Both apply or neither does, so there
 * is no moment where the record has two published files or none.
 *
 * Order matters: the revoke must come first, or the insert of a second
 * PUBLISHED row would hit idx_files_single_published_per_record.
 */
export function supersede(
  db: D1Database,
  input: {
    currentFileId: string;
    nextFileId: string;
    actorEmail: string;
    reason: string | null;
  },
) {
  return db.batch([
    db
      .prepare(
        `UPDATE files
           SET status = 'REVOKED',
               revoked_by = ?,
               revoked_at = CURRENT_TIMESTAMP,
               revoked_reason = ?
         WHERE file_id = ?
           AND status = 'PUBLISHED'`,
      )
      .bind(input.actorEmail, input.reason, input.currentFileId),
    db
      .prepare(
        `UPDATE files
           SET status = 'PUBLISHED',
               published_by = ?,
               published_at = CURRENT_TIMESTAMP
         WHERE file_id = ?
           AND status = 'CONFIRMED'`,
      )
      .bind(input.actorEmail, input.nextFileId),
  ]);
}

/**
 * The status is part of the WHERE clause, so the database decides whether the
 * transition applies. Under concurrent requests exactly one can win, and a
 * changes count of zero means this one did not.
 */
export function confirm(db: D1Database, fileId: string, confirmedBy: string) {
  return db
    .prepare(
      `UPDATE files
         SET status = 'CONFIRMED',
             confirmed_by = ?,
             confirmed_at = CURRENT_TIMESTAMP
       WHERE file_id = ?
         AND status = 'UPLOADED'`,
    )
    .bind(confirmedBy, fileId)
    .run();
}

/**
 * Swaps in a corrected PDF's metadata and sends the result back to
 * UPLOADED, clearing every downstream field — confirmed_by/at as well as
 * published_by/at, not just one of the two, because a replaced file has
 * been vouched for and possibly released by nobody yet; leaving either
 * behind would record an approval of bytes that no longer exist.
 *
 * `fromStatus` guards the WHERE clause: replace is reachable from three
 * different states (see canReplace() in domain/file-lifecycle.ts), so the
 * caller — which already read the current status to choose whether replace
 * is allowed at all — passes it through rather than this function
 * re-deriving what counts as "replaceable".
 *
 * Deliberately does not touch r2_key: the object is overwritten in place at
 * the same key (record-service.ts), not moved, so the row never needs to
 * point somewhere new.
 */
export function replace(
  db: D1Database,
  input: {
    fileId: string;
    fromStatus: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  },
) {
  return db
    .prepare(
      `UPDATE files
         SET status = 'UPLOADED',
             original_filename = ?,
             mime_type = ?,
             size_bytes = ?,
             confirmed_by = NULL,
             confirmed_at = NULL,
             published_by = NULL,
             published_at = NULL
       WHERE file_id = ?
         AND status = ?`,
    )
    .bind(
      input.originalFilename,
      input.mimeType,
      input.sizeBytes,
      input.fileId,
      input.fromStatus,
    )
    .run();
}
