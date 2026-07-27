# Backlog

## Phase 2: Online Results Foundation

- Define the result-delivery domain model. ✅
- Design D1 schema for records, folios, publication state, and file metadata. ✅
- Define R2 storage conventions for result PDFs. ✅
- Decide backend framework after evaluating Cloudflare Workers options. ✅ (DEC-004)
- Define Cloudflare Access boundaries for patient and admin experiences. Admin done; patient boundary open (DEC-012).

## Patient Portal

- Patient can consult a published record by folio.
- Patient can download PDF files attached to a published record.
- Patient receives clear feedback when a folio is not found or not published.

See DEC-012: the Access boundary this needs is not yet decided, and `GET /files/:fileId` must not be widened to serve it.

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
- Patient identity verification beyond folio lookup if required.
