# Decisions

## DEC-001: Keep top-level technical layers

Status: Accepted

The repository is organized by technical layer at the top level:

- `frontend/`
- `backend/`
- `database/`
- `docs/`
- `branding/`

This structure makes the repository feel like the DuoLab product rather than a single Astro project.

## DEC-002: Keep documentation lightweight

Status: Accepted

Documentation should preserve domain knowledge and product decisions. Raw discovery, handoff notes, generated specs, and process-heavy project-management artifacts should not be canonical documentation.

Canonical documentation lives in:

- `docs/01-domain.md`
- `docs/02-architecture.md`
- `docs/03-decisions.md`
- `docs/04-backlog.md`
- `branding/brand.md`
- `branding/copy.md`
- `branding/guidelines.md`

## DEC-003: Stay Cloudflare-first

Status: Accepted

The architectural direction is Cloudflare-first:

- Pages
- Workers
- D1
- R2
- Access

This keeps deployment and operations simple for the current product scale.

## DEC-004: Use Hono for the Backend API

Status: Accepted

Hono is the backend framework for the Cloudflare Workers API.

It keeps the Worker implementation small, typed, and close to the underlying Fetch API while still providing routing and middleware for the result-delivery workflows.

## DEC-005: Backend module structure, not full Clean Architecture

Status: Accepted

The backend is organized into `domain/` (pure rules, no I/O), `data/` (the only code touching D1 or R2), `services/` (operations spanning two stores or enforcing lifecycle rules), and `http/` (middleware and routes). `index.ts` is wiring only.

Deliberately not done: no repository interfaces or ports, no DTO mapper layer, no dependency-injection container, no CQRS. There is one implementation of each repository and there will only ever be one at this scale; introducing an interface for it buys nothing but ceremony. The benefit actually being bought is that `domain/` is pure functions, testable without a Worker, and that two invariants become mechanically checkable: no SQL outside `data/`, no R2 bucket call outside `data/storage.ts`.

Revisit if a second implementation of a repository is ever genuinely needed (it will not be needed to support testing — the test suite already runs against real D1 and R2 via Miniflare).

## DEC-006: Roles in a D1 `users` table, not an Access group claim

Status: Accepted

Cloudflare Access answers whether someone is a person the lab lets in. It does not answer whether that person may publish a result. Roles (`EMPLOYEE`, `MANAGER`) are resolved from a `users` table keyed on the Access-verified email, rather than from an Access group claim.

Rationale: auditable in data we own, testable without the edge (the `DEV_ROLE` local-dev override exercises both roles offline), and changeable without touching the Cloudflare dashboard, which is not configured yet. Cost: a second identity store beside Access, and no user-management UI — adding or deactivating staff is a `wrangler d1 execute` command, documented in `backend/README.md`. Acceptable at single-digit staff; revisit if that stops being true.

Addresses are normalized (trim + lowercase) in the application before every lookup and write, the `users.email` column is `COLLATE NOCASE`, and a `CHECK` constraint makes storing a non-normalized address impossible. The `CHECK` requires `COLLATE BINARY` inside its own comparison — without it, the column's `NOCASE` collation applies inside the constraint too and silently defeats it. This is a real trap, not a style preference; a test in `backend/test/roles.test.ts` pins it.

## DEC-007: `REVOKED` is terminal; a confirmed file is withdrawn, not re-published

Status: Accepted

The file lifecycle is `UPLOADED → CONFIRMED → PUBLISHED → REVOKED`, with exactly one cycle: `CONFIRMED → UPLOADED` ("withdraw"), confined to the pre-publication half where nothing was ever visible to a patient. Once `PUBLISHED`, the machine is strictly linear and ends at `REVOKED`. A revoked file cannot be published again — correcting a mistake means uploading and confirming a new file.

Rationale: after publication, "was this ever released, and is it still" must always have one unambiguous answer. A re-publishable `REVOKED` state would need `published_at`/`revoked_at` to mean "the latest one" rather than "the one time," which is a worse question to answer correctly than it looks.

Cost of the one cycle that does exist: confirming, withdrawing, and confirming again overwrites `confirmed_by`/`confirmed_at`, so only the last confirmation survives. Acceptable while nothing here was ever patient-visible. The trigger to add an append-only `file_events` table is the first time someone has to answer "who vouched for what, and when" for a real complaint — not before.

## DEC-008: A file may be hard-deleted only from `UPLOADED`

Status: Accepted

`DELETE /records/:recordId/files/:fileId` refuses everything except `UPLOADED`. A `CONFIRMED` file must be withdrawn first (`POST /files/:id/withdraw`); `PUBLISHED` and `REVOKED` files are never deleted — after publication, the record of what a patient could see is the point, not an inconvenience to route around.

This closed a real gap: before this decision, `DELETE` had no status guard at all and would have happily removed a published result once publish existed.

## DEC-009: R2/D1 consistency is a set of bounded guarantees, not a transaction

Status: Accepted

Cloudflare Workers have no transaction spanning R2 and D1. Upload writes the object first, then the metadata row; if the row insert fails, the object is deleted as compensation. Delete removes the row first, then the object; if the object delete fails, the row is already gone so nothing renders a broken reference.

What is guaranteed: a single failure self-compensates, and no query ever returns a row whose object is missing. What is not guaranteed: if the compensating step also fails (e.g. R2 unavailable right after a D1 failure), the object is orphaned. This is treated as acceptable because the orphan is unreachable (no code path reads by unlisted key), the storage key is deterministic (`records/{recordId}/{fileId}.pdf`), and every occurrence is logged as a structured `ORPHAN_R2_OBJECT` event with enough context to delete it by hand. See `backend/README.md` for the recovery command. No automated reconciliation sweep exists; add one if orphans start appearing at a rate hand-cleanup can't keep up with.

## DEC-010: At most one `PUBLISHED` file per record, enforced by the database

Status: Accepted

A record may accumulate many files over its life — drafts, corrections, a confirmed one — but at most one may be `PUBLISHED` at a time. This is enforced by a partial unique index (`idx_files_single_published_per_record` in `database/migrations/0005_single_published.sql`), not by application logic, so it holds under concurrency and survives the service being wrong.

## DEC-011: Publishing over an existing published file requires explicit supersede

Status: Accepted

`POST /files/:id/publish` refuses with `409 ALREADY_PUBLISHED` (naming the current file) when another file on the same record is already published. Replacing it requires the caller to name it explicitly via `?supersedes=<fileId>`, which performs an atomic revoke-then-publish in a single `DB.batch()`. There is no window where the record has zero or two published files.

Rejected alternatives: auto-superseding silently (a manager could unpublish a result without realizing — the worst failure mode this product has); two separate manual steps, revoke-then-publish (leaves a real gap where the patient sees nothing, and is not atomic).

## DEC-012: Cloudflare Access boundary for the patient flow — same Worker, additive `/api/public/*`

Status: Accepted

`docs/02-architecture.md` names Cloudflare Access as the only authentication mechanism. Patients cannot be Access users — there is no Access application a public visitor can be a member of. Every current backend route assumes an Access-verified identity via `requireAccess`.

Resolved as: the patient lookup and download routes live on the **same Worker**, mounted as a new `/api/public/*` sub-app with no `requireAccess` in its middleware chain, alongside the existing internal routes (`/records`, `/files`, `/me`, `/health`), which are **left exactly as they are** — no rename, no path-prefix migration to `/api/internal/*`.

Rejected alternative: renaming the existing internal routes under an `/api/internal/*` prefix to make the split explicit in both directions. Rejected because it would touch every existing route path, every admin-frontend fetch call site, and every existing test's request path, for a boundary that is already unambiguous from the single new sub-app's own auth-free mount — the regression surface of renaming stable, already-tested routes is not justified by a symmetry preference. Revisit only if a real deployment constraint (e.g. routing patients and staff through different Cloudflare Access applications or edge rules) forces the split.

Related, and already true today: `GET /files/:fileId` stays employee-only and must not be widened to serve patients. The patient download has its own handler under `/api/public/results/:downloadToken/download`, its own authorization (an opaque encrypted token plus a live `PUBLISHED` re-check), and `Content-Disposition: attachment`.

## DEC-013: MANAGER is a strict superset of EMPLOYEE

Status: Accepted

A manager may do everything an employee may do, plus publish and revoke. Chosen over a disjoint model (manager may only review and release) with the tradeoff stated rather than hidden: **there is no separation of duties**. One manager can create a record, upload a PDF, confirm it, and publish it, with nobody else involved.

Rationale: at single-digit lab staff, a disjoint model deadlocks the moment the manager is the only person present to cover intake. `confirmed_by` and `published_by` are both recorded, so a four-eyes rule (requiring them to differ) can be added later as a guard in `services/file-service.ts`, without a migration and without revisiting this decision from scratch.

## DEC-014: Patient-facing responses must never be cached at the edge

Status: Accepted — applies once the patient flow exists; recorded now because it is cheap now and expensive later

Revoking a published file must take effect immediately. The patient lookup and download routes (not yet built — see DEC-012) must set cache-control headers that prevent edge or browser caching, and must query `status = 'PUBLISHED'` live on every request. A revoked result served from a stale cache is the worst failure this product can have: it is the exact case the revoke feature exists to prevent, silently defeated by an unrelated performance decision made later by someone who did not have this context.
