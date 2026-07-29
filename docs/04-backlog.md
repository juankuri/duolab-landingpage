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
- Patient's download link stays usable, or fails clearly, across its whole 5-minute window — no dead link that dumps raw JSON if they wait past it. ✅
- A folio may hold several published results at once, and the patient sees and downloads every one of them, each with its name and publication date. ✅ (DEC-010 reversed, DEC-011 amended, DEC-023)
- Patient has a WhatsApp escape hatch if the lookup doesn't work. ✅ — see `docs/01-domain.md`'s patient user stories.
- Patient sees a static reassurance that an unreleased result "isn't missing, just not ready yet" — without the page ever confirming a specific folio exists. ✅

## Admin Portal

- Employee can create a patient, a folio and its first result in one step — a folio can no longer exist without a result. ✅ (DEC-016)
- Employee can search by folio, patient name (accent-insensitive) or phone in one box. ✅
- Employee can add a further result to an existing folio without touching the ones already there, and confirm it in one click. ✅
- Employee can open a patient and start a new folio for them without retyping their data. ✅
- Employee can confirm, withdraw a confirmation, and replace a file's PDF from any of UPLOADED/CONFIRMED/PUBLISHED. ✅ (DEC-018)
- Manager can publish a record. ✅
- Employee or manager can revoke a published record — no longer manager-only. ✅ (DEC-018)
- Manager has a mobile-first surface of their own (`/admin/manager`) — a three-tab queue (por publicar/publicados/revocados), a PDF viewer that never leaves the page, and a batch "ver siguiente" rhythm. ✅ (DEC-021, DEC-022)
- Internal users see each result's own status and a folio's derived tally, not a single folio-level status. ✅
- The manager queue (`?status=CONFIRMED`) includes a folio whose latest result is a fresh draft but which still has an older confirmed result waiting — previously excluded by mistake. ✅ — regression test in `backend/test/records.test.ts`.
- Keyboard: `/` focuses search from anywhere; the result menu supports arrow-key navigation; Esc returns focus to what opened it. ✅

## Public Website

- Keep the landing page stable during Phase 2 refactors.
- Add real photos when available.
- Add real, sourced Google reviews only when approved.

## Deployment

- Single-origin topology decided and configured: one Worker serves the built frontend and the API. ✅ (DEC-020)
- Reproducible local start: `pnpm dev:setup` applies migrations, `pnpm dev:seed` fills the database through the real API. ✅
- Ordered deploy runbook in `backend/README.md`. ✅ — written, not yet executed.
- Create the real D1 database and R2 bucket, replace the placeholder `database_id`, apply migrations with `--remote`.
- Set `RATE_LIMIT_KEY_SECRET` and `DOWNLOAD_TOKEN_SECRET` with `wrangler secret put`, using fresh values.
- Configure the Cloudflare Access application (six destinations, see DEC-020) and the real `CLOUDFLARE_ACCESS_AUDIENCE`.
- Seed the real staff addresses into `users` on the remote database — an Access-verified address with no row gets 403 (DEC-006).

## Later

- Patient editing (name/birth date/phone correction after creation). No `PUT`/`PATCH` endpoint exists; none of the current flows need it.
- "Descargar todos" (ZIP) on the patient result page. Now unblocked — multi-publish shipped — but not built: the patient downloads each result individually, which covers the need. Worth adding when a folio routinely carries enough studies that one-by-one is tedious.
- Surface `?supersedes=` as a deliberate action in the employee screens (DEC-011). The API supports correcting an already-released study atomically, but no UI reaches it since the ALREADY_PUBLISHED error that used to expose it is gone. Today the path is revoke-then-publish, which is two steps and leaves a brief gap.
- Audit trail for uploads and publications (an append-only `file_events` table). The trigger, per DEC-007, is the first time someone has to answer "who vouched for what, and when" for a real complaint — not before.
- Expiration or archival rules for old records.
- Sweep old `public_lookup_attempts` rows. Not a correctness issue (each row is scoped to its own window and inert once past), just accumulation — add a cleanup path if the table's size becomes a real cost, not before.
- Close the coverage gap on `backend/src/data/users.repo.ts` (0% today, see DEC-019) and raise `src/data/**`'s branch threshold accordingly.
- CI (GitHub Actions or equivalent) running `check` + `test` + `test:coverage` + `build` on every push — deliberately not set up alongside the coverage/QA policy in this pass; the policy is enforced by convention (`docs/06-quality.md`) until it's enforced by a pipeline.
- `Range`/`Accept-Ranges` support on `GET /files/:fileId` — not needed today since the manager viewer fetches the whole file as one `ArrayBuffer` (DEC-022), but would let pdf.js load progressively if result PDFs ever grow well past a few pages.
- Cursor pagination on `GET /records` — `limit` is a hard ceiling (max 100, chunked at 50 for `?include=files`'s D1 binding limit), not a real page; fine while a folio list or a manager tab stays in the low tens, worth revisiting if either grows past that.
- pdf.js standard fonts/CMaps, deliberately left disabled (DEC-022) — add if a real lab result PDF ever renders with missing glyphs.
- **Open decision, needs a person, not an agent:** whether to relax DEC-015 for a caller who has already supplied a correct folio+phone+birth date, so `/resultados` could say "found your record, it's just not published yet" instead of the collapsed generic message. `docs/01-domain.md`'s patient story asks for exactly that; DEC-015 currently wins and the story is answered with static, unconditional copy instead. Revisit only with the product owner in the room — it's a real trade against `public-lookup.test.ts`'s non-enumeration guarantee, not a bug.
