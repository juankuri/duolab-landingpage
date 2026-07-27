-- The schema had no indexes beyond those implied by primary keys and unique
-- constraints, so every lookup of a record's files was a full scan of files.
-- Small today, but these are exactly the queries every screen runs.

-- Used by the record detail view, the delete lookup and the latest-file
-- window function in the recent list.
CREATE INDEX idx_files_record_id ON files(record_id);

-- Used by the manager queue ("confirmed files awaiting publication") and,
-- later, by the patient lookup, which reads only PUBLISHED files for a
-- record. Shaped for both so the second one does not need another index.
CREATE INDEX idx_files_record_status ON files(record_id, status);

-- Used by the joins from records to patients.
CREATE INDEX idx_records_patient_id ON records(patient_id);
