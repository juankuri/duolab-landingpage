-- Drop the one-published-file-per-record invariant.
--
-- Migration 0005 created idx_files_single_published_per_record on this
-- reasoning: "Exactly one of them is 'the result the patient can see' ...
-- Two published files on one record would leave the patient-facing question
-- — which result is current — without an answer."
--
-- That premise was wrong about the domain, and this migration removes what
-- it built. A folio is not a document, it is an order: one visit produces
-- several studies, and each study is its own PDF with its own lifecycle.
-- The five files on a real folio are five different studies, not five
-- versions of one. "Which result is current" is a question that only makes
-- sense between versions of the same document; between distinct studies
-- every published one is current, simultaneously, and the patient is
-- entitled to all of them.
--
-- The distinction 0005 collapsed, now kept apart deliberately:
--   · different studies  -> publish both, both visible, no supersede
--   · a corrected study  -> revoke the wrong one, publish the fix; that is
--                           what POST /files/:id/publish?supersedes= still
--                           does atomically (DEC-011), now as an explicit
--                           choice rather than the only way past a 409.
--
-- What does NOT change: revoke stays terminal (DEC-007), the live
-- PUBLISHED re-check at download time stays the real gate (DEC-014), and
-- the public lookup's non-enumeration guarantee (DEC-015) is untouched —
-- "folio exists but nothing is published" still collapses into the same
-- generic failure as every other bad lookup.
DROP INDEX IF EXISTS idx_files_single_published_per_record;

-- The published set of a record is now read on every public lookup, so it
-- gets the index the uniqueness constraint used to provide incidentally.
-- Partial, because rows in the other three states are never queried this way.
CREATE INDEX IF NOT EXISTS idx_files_published_per_record
  ON files(record_id, published_at)
  WHERE status = 'PUBLISHED';
