-- Stable position of a result within its folio.
--
-- The admin UI names a result "FOLIO · #2", never by an internal id, so the
-- number needs a source that survives more than the current page load.
-- Assigned once at upload time and never recomputed: deleting a draft must
-- not renumber the results after it, or "#3" would stop meaning the same
-- physical result from one visit to the next.
ALTER TABLE files ADD COLUMN sequence INTEGER;

-- Backfill in upload order. uploaded_at resolves to the second (see the
-- comment on records.repo.ts:listRecent), so file_id breaks ties the same
-- way the rest of the schema already does.
UPDATE files
SET sequence = (
  SELECT rn FROM (
    SELECT file_id,
           ROW_NUMBER() OVER (
             PARTITION BY record_id
             ORDER BY uploaded_at ASC, file_id ASC
           ) AS rn
    FROM files
  ) numbered
  WHERE numbered.file_id = files.file_id
);

CREATE INDEX idx_files_record_sequence ON files(record_id, sequence);
