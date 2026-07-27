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

- Employee can create or find a record by folio. ✅
- Employee can upload PDF files to a record. ✅
- Employee can confirm, withdraw a confirmation, and replace a file before publication. ✅
- Manager can publish a record. ✅
- Manager can revoke a published record. ✅
- Internal users can see publication state. ✅

## Public Website

- Keep the landing page stable during Phase 2 refactors.
- Add real photos when available.
- Add real, sourced Google reviews only when approved.

## Later

- Audit trail for uploads and publications.
- Expiration or archival rules for old records.
- Sweep old `public_lookup_attempts` rows. Not a correctness issue (each row is scoped to its own window and inert once past), just accumulation — add a cleanup path if the table's size becomes a real cost, not before.
