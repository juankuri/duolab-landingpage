-- At most one published file per record.
--
-- A record accumulates files over time: drafts, a confirmed one, corrections
-- after a mistake. Exactly one of them is "the result the patient can see",
-- and nothing enforced that. Two published files on one record would leave
-- the patient-facing question — which result is current — without an answer.
--
-- Expressed as a partial unique index rather than a check in the service so
-- it holds under concurrency and survives application logic being wrong.
-- Publish and supersede both rely on it as the backstop.
CREATE UNIQUE INDEX idx_files_single_published_per_record
  ON files(record_id)
  WHERE status = 'PUBLISHED';

-- Why a result was withdrawn is worth keeping: "wrong patient" and
-- "corrected values" are different events, and the distinction is
-- unrecoverable once it is lost. Optional, free text, never shown to
-- patients.
ALTER TABLE files ADD COLUMN revoked_reason TEXT;
