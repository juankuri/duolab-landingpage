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

Status: Accepted, amended by DEC-018 (replace)

The file lifecycle is `UPLOADED → CONFIRMED → PUBLISHED → REVOKED`, with one cycle in the pre-publication half: `CONFIRMED → UPLOADED` ("withdraw"), confined there because nothing was ever visible to a patient before that point. Once `PUBLISHED`, revoking is terminal — a revoked file cannot be published again, correcting a mistake means uploading and confirming a new file. See DEC-018 for the one deliberate exception: replacing a published file's PDF, which is a different action from revoking it.

Rationale: after publication, "was this ever released, and is it still" must always have one unambiguous answer for a revoked file. A re-publishable `REVOKED` state would need `published_at`/`revoked_at` to mean "the latest one" rather than "the one time," which is a worse question to answer correctly than it looks.

Cost of the withdraw cycle: confirming, withdrawing, and confirming again overwrites `confirmed_by`/`confirmed_at`, so only the last confirmation survives. Acceptable while nothing here was ever patient-visible. The trigger to add an append-only `file_events` table is the first time someone has to answer "who vouched for what, and when" for a real complaint — not before.

## DEC-008: A file may be hard-deleted only from `UPLOADED`

Status: Accepted — unchanged by DEC-018

`DELETE /records/:recordId/files/:fileId` refuses everything except `UPLOADED`. A `CONFIRMED` file must be withdrawn first (`POST /files/:id/withdraw`); `PUBLISHED` and `REVOKED` files are never deleted — after publication, the record of what a patient could see is the point, not an inconvenience to route around. Replace (DEC-018) does not change this: it swaps a file's bytes in place, it does not delete a row.

This closed a real gap: before this decision, `DELETE` had no status guard at all and would have happily removed a published result once publish existed.

## DEC-009: R2/D1 consistency is a set of bounded guarantees, not a transaction

Status: Accepted

Cloudflare Workers have no transaction spanning R2 and D1. Upload writes the object first, then the metadata row; if the row insert fails, the object is deleted as compensation. Delete removes the row first, then the object; if the object delete fails, the row is already gone so nothing renders a broken reference.

What is guaranteed: a single failure self-compensates, and no query ever returns a row whose object is missing. What is not guaranteed: if the compensating step also fails (e.g. R2 unavailable right after a D1 failure), the object is orphaned. This is treated as acceptable because the orphan is unreachable (no code path reads by unlisted key), the storage key is deterministic (`records/{recordId}/{fileId}.pdf`), and every occurrence is logged as a structured `ORPHAN_R2_OBJECT` event with enough context to delete it by hand. See `backend/README.md` for the recovery command. No automated reconciliation sweep exists; add one if orphans start appearing at a rate hand-cleanup can't keep up with.

## DEC-010: At most one `PUBLISHED` file per record, enforced by the database

Status: Accepted — unchanged; multi-publish (allowing more than one `PUBLISHED` result per folio at once) stayed out of scope for the employee-module work that added DEC-016–DEC-018. Replace (DEC-018) gives a second way to correct a published result without touching this constraint at all: it returns the file to `UPLOADED` in place rather than superseding it with another file.

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

Status: Accepted — implemented with the patient flow

Revoking a published file must take effect immediately. The patient lookup and download routes set `Cache-Control: no-store` (`http/routes/public/index.ts`) and query `status = 'PUBLISHED'` live on every request — the download route re-checks it in the same query that fetches the file row, not from a value trusted from an earlier request or the token. A revoked result served from a stale cache is the worst failure this product can have: it is the exact case the revoke feature exists to prevent, silently defeated by an unrelated performance decision made later by someone who did not have this context.

## DEC-015: Public lookup rate limiting and download tokens use only D1, and the token is encrypted, not signed

Status: Accepted

The public lookup (`POST /api/public/results/lookup`) needed two things nothing in the repo had a pattern for: abuse resistance on an unauthenticated endpoint, and a way to hand the browser something that authorizes one download without exposing an internal id.

**Rate limiting** is a D1 table (`public_lookup_attempts`, migration `0006`), not a new Cloudflare binding. Two independent budgets apply per fixed 10-minute window: one keyed to the caller's IP, one keyed to the folio being looked up — either tripping blocks the request, so rotating IPs against one folio or trying many folios from one IP are both bounded. Neither the IP nor the folio is stored as given: both are HMAC-SHA256 fingerprints keyed by a secret (`RATE_LIMIT_KEY_SECRET`), specifically because a plain hash of an IPv4 address is enumerable offline in seconds and a keyed hash isn't. The counter increment is a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, not a `SELECT` followed by an application-side `UPDATE`, so concurrent requests against the same fingerprint can't race the count down.

Rejected: a KV namespace or Durable Object rate limiter. Better suited to high write volume, but each is a new Cloudflare resource requiring a real resource id to deploy — unjustified for a lab at this scale, and D1 was already provisioned.

**Download tokens** are AES-256-GCM ciphertext (`domain/download-token.ts`), not an HMAC-signed payload. A signed-but-unencrypted token is tamper-resistant but not opaque: the client can base64-decode a signed payload and read the internal `fileId` straight out, even without being able to forge a new token. That fails "prefer an opaque download token" in substance even while satisfying it in name. AES-GCM makes the payload unreadable, not just unforgeable, and — because DEC-014 already requires a live `PUBLISHED` re-check at download time regardless of what the token claims — buys that opacity without needing a persisted token table or its cleanup job. The secret (`DOWNLOAD_TOKEN_SECRET`) is applied directly as 32 bytes of key material (`openssl rand -base64 32`), not run through a hand-rolled KDF; a malformed or short secret fails loudly at first use rather than silently degrading.

Both secrets are self-generated application secrets, not Cloudflare resource identifiers — local values live in `backend/.dev.vars` (gitignored), and a deploy needs `wrangler secret put` for both before the public routes can be exposed for real.

## DEC-016: A folio cannot exist without its first result

Status: Accepted

`POST /records` creates a patient (or reuses one via `patientId`), a folio, and its first result in one multipart request and one D1 batch — there is no longer a way to create a folio without a PDF. The old two-step flow (create a bare record, then separately `POST` a file to it) is gone; `POST /records/:recordId/files` still exists, but only for adding a *second or later* result to a folio that already has one.

Rationale: the domain model treats a folio as meaningless without something a patient might eventually see. A record with zero results was a reachable, valid-looking state that meant nothing — the UI had to render a `NO_FILE` placeholder for it, and an employee could walk away mid-intake leaving a folio nobody could act on. Atomic creation removes that state from the reachable set entirely rather than special-casing it everywhere it showed up.

Rows created before this decision may still have zero files (nothing retroactively deletes them); the frontend's `NO_RESULT` fallback in `status.js` stays for that reason, but no code path can produce a new one.

## DEC-017: `/admin/*` route structure uses query params, not path segments

Status: Accepted

Every `/admin/*` page that addresses a specific resource — `/admin/folio?f=`, `/admin/revisar?f=&r=`, `/admin/nuevo?patient=`, `/admin/paciente?id=`, `/admin/buscar?q=` — does so with a query string, not a path segment like `/admin/folio/[folio]`.

Rationale: the frontend is an Astro static build (`output: "static"`, no adapter). A path-segment route over ids that do not exist at build time needs `getStaticPaths` and, for genuinely dynamic ids, an SSR adapter — a materially larger change than a prettier URL is worth at this scale. Query params work identically well as deep links, are trivial to read with `URL.searchParams`, and cost nothing to add a new one to.

Revisit if the frontend ever moves to an SSR adapter for an unrelated reason — at that point the prettier path-segment form becomes close to free and worth adopting for consistency with the public-facing routes.

## DEC-018: Replace is a separate action from revoke and withdraw, with its own predicate

Status: Accepted

A result's PDF may be swapped for a corrected one from `UPLOADED`, `CONFIRMED`, or `PUBLISHED` — `POST /records/:recordId/files/:fileId/replace` — always landing back on `UPLOADED` and clearing both `confirmed_by`/`confirmed_at` and `published_by`/`published_at`, not just the pair the state it came from would suggest. `canReplace()` in `domain/file-lifecycle.ts` governs this outside `TRANSITIONS`/`canTransition()` on purpose: replace is not the same shape of move as withdraw even though both can end at `UPLOADED`. It carries a new file, resets more columns, and — critically — its ordering guarantee is load-bearing in a way no entry in `TRANSITIONS` needs to be (see below). Folding it into that table would make `canTransition("PUBLISHED", "UPLOADED")` report `true` for a move that no state-only endpoint (`/withdraw`) actually performs from `PUBLISHED`.

**Ordering, and why it matters (extends DEC-014):** the D1 row is updated to `UPLOADED` *before* the new PDF is written to R2 at the same key. A patient holding a live download token for the file being replaced is therefore cut off the instant the D1 write lands — before the old bytes are overwritten, and well before the new ones are readable. The reverse order would leave a window where the object at that key is already the new PDF while the row still reads `PUBLISHED`, meaning a patient could download a result nobody decided to publish. Same asymmetry DEC-014 already established for revoke, applied to the write path this time instead of the read path.

**Revoke widened to any authenticated actor, not manager-only** (amends the manager-only framing implicit in earlier drafts of DEC-007/DEC-013): `POST /files/:id/revoke` no longer requires `requireRole("MANAGER")`. DEC-013 already named MANAGER a strict superset of EMPLOYEE with no separation of duties; leaving revoke gated while every other non-publish action was open was an inconsistency, not a deliberate boundary. Publish remains the one action requiring MANAGER — releasing a result to a patient is the asymmetric-risk action this product cares about controlling, not hiding one.

## DEC-019: Coverage thresholds are per-directory and set from measured baselines, never guessed

Status: Accepted

`backend/vitest.config.ts` and `frontend/vitest.config.js` enforce coverage thresholds scoped per directory (`domain/`, `services/`, `data/`, `http/` on the backend; the pure `scripts/admin/` modules on the frontend), not one repo-wide number. The layers do different jobs and are held to different bars on purpose — `domain/` is pure rules with no excuse for an untested branch (90%+); `data/` is thinner because some of its branches only trigger under real D1/R2 failure injection.

Every threshold in the initial configuration was set by running the suite once, reading the actual number, and rounding down — never picked first and adjusted to fit. `backend/src/data/**`'s branch threshold is the clearest case: `users.repo.ts` has no direct test (0% today) and pulls the directory average down to where the honest starting threshold was 55%, not the 70–80% every sibling layer clears; it has since risen to 75% as `search.ts`'s queries added real coverage elsewhere in the same directory, and is documented as a known gap in `docs/06-quality.md` rather than hidden behind a lower number.

The full policy — what a new unit test needs, the manual QA scripts, and the regression guardrails no change may weaken — lives in `docs/06-quality.md`, referenced from `AGENTS.md` so every session loads it.

## DEC-020: One Worker serves both the frontend and the API, on a single origin

Status: Accepted — supersedes the "Pages for frontend delivery" line in `docs/02-architecture.md`

The Worker is configured with a static-assets directory pointing at the built Astro output (`backend/wrangler.jsonc`, `assets.directory = "../frontend/dist"`). One deployment serves `/`, `/resultados` and `/admin/*` as files and everything else — `/records`, `/files`, `/me`, `/search`, `/patients`, `/health`, `/api/public/*` — as Worker routes.

Rationale, and it is not a preference: the CORS policy in `src/index.ts` returns an allowed origin **only** in local dev and sends no CORS headers otherwise. That was written assuming same-origin production, and shipping a separate frontend host would have silently broken every browser call from `/admin` and `/resultados` the moment it deployed. The choice was to reopen that policy — allowing a production origin, and then sharing the Cloudflare Access `CF_Authorization` cookie across two hostnames so the JWT still reaches the API — or to make the same-origin assumption true. Making it true is less machinery and removes a whole category of failure rather than configuring around it.

`not_found_handling` is `"none"`, and that value is load-bearing: it is what lets a request matching no asset fall through to the Worker. Any other setting answers `/records` with the 404 page and the API stops existing. This was verified against wrangler 4.112 by running the Worker with real built assets and checking both directions, including that the trailing-slash redirect the asset router performs preserves the query string — every internal link is `?f=`, `?q=` or `?id=`, so losing it would have broken navigation in production only.

**Cost, stated plainly:** because the internal routes are not under a shared prefix (DEC-012 deliberately left them at the top level), the Cloudflare Access application needs a destination for each — `/admin*`, `/records*`, `/files*`, `/me`, `/search*`, `/patients*` — and must exclude `/api/public/*` and the landing. Access is not decoration here: it is what injects the `Cf-Access-Jwt-Assertion` header that `requireAccess` reads, so a route left off the list receives no identity and answers 401. The failure mode is therefore "that route is broken", loudly, not "that route is exposed" — the Worker still refuses anything without the header.

**Constraint this creates:** nothing in `frontend/dist` may ever occupy `/records`, `/files`, `/me`, `/search`, `/patients`, `/health` or `/api/*`. Assets win over the Worker, so a public page added at one of those paths would silently shadow the endpoint behind it.

If maintaining six Access destinations proves annoying in practice, moving the internal routes under `/api/internal/*` reduces it to one and is a mechanical change — DEC-012 explicitly left that door open for "a real deployment constraint", and this is the shape such a constraint would take.
