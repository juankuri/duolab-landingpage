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

export function insert(db: D1Database, file: NewFile) {
  return db
    .prepare(
      `INSERT INTO files
         (file_id, record_id, r2_key, original_filename, mime_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      file.fileId,
      file.recordId,
      file.r2Key,
      file.originalFilename,
      file.mimeType,
      file.sizeBytes,
      file.uploadedBy,
    )
    .run();
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
         confirmed_at
       FROM files
       WHERE record_id = ?
       ORDER BY uploaded_at DESC`,
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

export function findInRecord(db: D1Database, recordId: string, fileId: string) {
  return db
    .prepare("SELECT file_id, r2_key FROM files WHERE file_id = ? AND record_id = ?")
    .bind(fileId, recordId)
    .first<{ file_id: string; r2_key: string }>();
}

export function remove(db: D1Database, fileId: string) {
  return db.prepare("DELETE FROM files WHERE file_id = ?").bind(fileId).run();
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
