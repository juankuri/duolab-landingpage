# Backlog

## Phase 2: Online Results Foundation

- Define the result-delivery domain model. ✅
- Design D1 schema for records, folios, publication state, and file metadata. ✅
- Define R2 storage conventions for result PDFs. ✅
- Decide backend framework after evaluating Cloudflare Workers options. ✅ (DEC-004)
- Define Cloudflare Access boundaries for patient and admin experiences. ✅ (DEC-012)

## Patient Portal

- Patient can consult a published record by folio, phone and birth date. ✅
- Patient can download the published PDF file attached to a record. ✅
- Patient receives the same clear feedback whether the folio, phone, birth date or publication state was the reason for no match. ✅ — see DEC-015 and the non-enumeration tests in `backend/test/public-lookup.test.ts`.
- Rate limiting on the lookup endpoint. ✅ (DEC-015)

## Admin Portal

- Employee can create a patient, a folio and its first result in one step — a folio can no longer exist without a result. ✅ (DEC-016)
- Employee can search by folio, patient name (accent-insensitive) or phone in one box. ✅
- Employee can add a further result to an existing folio without touching the ones already there, and confirm it in one click. ✅
- Employee can open a patient and start a new folio for them without retyping their data. ✅
- Employee can confirm, withdraw a confirmation, and replace a file's PDF from any of UPLOADED/CONFIRMED/PUBLISHED. ✅ (DEC-018)
- Manager can publish a record. ✅
- Employee or manager can revoke a published record — no longer manager-only. ✅ (DEC-018)
- Internal users see each result's own status and a folio's derived tally, not a single folio-level status. ✅
- The manager queue (`?status=CONFIRMED`) includes a folio whose latest result is a fresh draft but which still has an older confirmed result waiting — previously excluded by mistake. ✅ — regression test in `backend/test/records.test.ts`.
- Keyboard: `/` focuses search from anywhere; the result menu supports arrow-key navigation; Esc returns focus to what opened it. ✅

## Public Website

- Keep the landing page stable during Phase 2 refactors.
- Add real photos when available.
- Add real, sourced Google reviews only when approved.

## Later

- Multiple published results per folio, and the patient-portal changes that go with it. Deliberately deferred — the highest-risk, most invasive slice of the original nine-slice plan (touches the shipped, already-tested public patient flow and drops a DB-level invariant); revisit as its own scoped piece of work.
- Patient editing (name/birth date/phone correction after creation). No `PUT`/`PATCH` endpoint exists; none of the current flows need it.
- "Descargar todos" (ZIP) on the patient result page. Deferred with multi-publish, since it only matters once a folio can have more than one published result at a time.
- Audit trail for uploads and publications (an append-only `file_events` table). The trigger, per DEC-007, is the first time someone has to answer "who vouched for what, and when" for a real complaint — not before.
- Expiration or archival rules for old records.
- Sweep old `public_lookup_attempts` rows. Not a correctness issue (each row is scoped to its own window and inert once past), just accumulation — add a cleanup path if the table's size becomes a real cost, not before.
- Close the coverage gap on `backend/src/data/users.repo.ts` (0% today, see DEC-019) and raise `src/data/**`'s branch threshold accordingly.
- CI (GitHub Actions or equivalent) running `check` + `test` + `test:coverage` + `build` on every push — deliberately not set up alongside the coverage/QA policy in this pass; the policy is enforced by convention (`docs/06-quality.md`) until it's enforced by a pipeline.
