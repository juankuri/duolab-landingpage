-- Normalized name for unaccented substring search.
--
-- A search box that matches "kuri" but not "Kurí" is a search box people
-- learn to route around instead of use. SQLite has no built-in
-- diacritic-folding collation, so the normalized form is stored and matched
-- against, not computed at query time — the alternative is a full scan on
-- every keystroke. The column's values are set by application code, from
-- domain/search.ts's normalizeForSearch() (records.repo.ts, every insert),
-- because SQL itself cannot do NFD decomposition — see the backfill below.
ALTER TABLE patients ADD COLUMN search_name TEXT;

-- SQLite has no NFD/diacritic-stripping builtin, so this backfill only lower-
-- cases; rows with accented names get their real search_name the first time
-- application code touches them, or from a one-off backfill script run with
-- the same normalizeForSearch() the application uses. Acceptable because
-- every INSERT going forward sets it correctly from day one — this migration
-- only has to not leave the column NULL for existing rows' plain-ASCII case.
UPDATE patients SET search_name = lower(full_name) WHERE search_name IS NULL;

CREATE INDEX idx_patients_search_name ON patients(search_name);

-- The phone prefix search in GET /search needs this; nothing indexed
-- phone_number before.
CREATE INDEX idx_patients_phone_number ON patients(phone_number);
