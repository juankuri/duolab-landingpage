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

Note (2026-07): the lo-fi Phase 2 wireframe for `/admin/manager`'s revoke screen (M6) captions itself "Revocar oculta el archivo al paciente de inmediato. Podrás volver a publicarlo más tarde" — that line is wrong and was not carried into the implementation. `REVOKED` stays terminal per this decision; the shipped copy (`revokeConfirmBody` in `frontend/src/scripts/admin/manager.js`) says the opposite on purpose. Flagged here so the wireframe is never read as a spec change on this point.

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

## DEC-010: A record may hold many `PUBLISHED` files at once

Status: **Reversed** by migration `0009_multi_published.sql`. Previously: "At most one `PUBLISHED` file per record, enforced by the database."

The original decision enforced a partial unique index (`idx_files_single_published_per_record`, migration 0005) on this reasoning: *"Exactly one of them is 'the result the patient can see' ... Two published files on one record would leave the patient-facing question — which result is current — without an answer."*

**That premise was wrong about the domain, and the index encoded the mistake.** A folio is not a document, it is an **order**: one visit produces several studies, and each study is its own PDF with its own lifecycle. A real folio holding five files holds five different studies, not five versions of one. "Which result is current" is a question that only means something between versions of the same document; between distinct studies, every published one is current, simultaneously, and the patient is entitled to all of them.

The invariant was therefore not protecting a truth about the business — it was preventing the normal case. Publishing a second result on a folio that already has one now simply succeeds.

What this does **not** change, and each has tests pinning it:

- Revoke stays terminal (DEC-007). Revoking one released study leaves the others published.
- The live `PUBLISHED` re-check at download time stays the real gate (DEC-014).
- Non-enumeration (DEC-015) is untouched: "folio exists but nothing is published" still collapses into the same generic failure, and the *count* of published results is only ever revealed to a caller who already matched folio, phone and birth date.

Cost: the uniqueness guarantee is gone, so nothing at the database level stops a bug from publishing the same logical study twice. That is a recoverable data-entry problem (revoke one), unlike the previous state, which made a legitimate operation impossible.

## DEC-011: `?supersedes=` is an explicit correction, not a required detour

Status: Accepted — **amended** by DEC-010's reversal.

Originally, `POST /files/:id/publish` refused with `409 ALREADY_PUBLISHED` whenever another file on the record was published, and naming it via `?supersedes=<fileId>` was the only way through. That gate is gone with the invariant that motivated it: publishing alongside an existing result is the normal case and needs no ceremony.

`?supersedes=` survives, because the situation the old design **conflated** with "a second study" is real and distinct: correcting a study that was already released. It still performs an atomic revoke-then-publish in a single `DB.batch()`, so the patient never sees both versions of one study or neither. It is now opt-in — a deliberate choice a caller makes, not something discovered by hitting an error.

Added with the reversal: the superseded file must belong to the **same record** as the replacement. While the unique index existed this was implied; without it, nothing else would stop a supersede from revoking another patient's result.

Rejected alternatives, unchanged: auto-superseding silently (a manager could unpublish a result without realizing — the worst failure mode this product has); two separate manual steps, revoke-then-publish (leaves a real gap where the patient sees nothing, and is not atomic).

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

## DEC-021: `/admin/manager` is a separate, mobile-first surface — not a responsive version of the dense admin

Status: Accepted

MANAGER gets its own page (`frontend/src/pages/admin/manager.astro`) instead of `admin.css` growing a breakpoint. The real manager is ~60 years old, reads results on an iPhone in one hand, and has exactly two jobs: publish, revoke. Every other admin screen — search, folio detail with its six-action menu, patient creation — solves an employee's problem, not a manager's, and making one layout serve both would mean either the manager wades through chrome they never use, or the employee's dense, keyboard-driven screen gets compromised to fit a phone. Two small, single-purpose surfaces sharing the same backend contract cost less than one screen trying to be both.

**The redirect is cosmetic, not the gate.** Role is only known after an async `GET /me`, and both pages are static output with no server-side routing, so `session.js`'s `roleRedirect()` runs client-side: a MANAGER landing on `/admin` is sent to `/admin/manager`; an EMPLOYEE landing on `/admin/manager` is sent back to `/admin`, which never redirects, so there is no loop. `requireRole("MANAGER")` on `POST /files/:id/publish` remains the actual boundary — this redirect only decides what is worth showing, same framing DEC-006 and DEC-013 already established for the `#who-name` fill it replaces (`session.js`'s `fillWho()`). Both landing pages hide their content behind a small "Cargando…" state until the redirect decision is made, rather than flashing the wrong UI first.

**`?desktop=1` escape hatch on `/admin`**, persisted in `sessionStorage`: without it, a manager who needs the dense admin for something the mobile view doesn't cover — or a developer running locally with `DEV_ROLE=manager` — could never reach `/admin` at all. It has no effect on `/admin/manager` itself; that page stays exclusive to MANAGER regardless.

## DEC-022: The manager's PDF viewer is bundled pdf.js, fed an ArrayBuffer — never an `<iframe src>` or a bare URL

Status: Accepted

Viewing the result PDF without leaving the page is the manager screen's central requirement (see DEC-021's rationale for who this is for). An `<iframe src="/files/:id">` was the obvious first idea — `/admin/revisar` already does exactly that for the employee flow, and the backend sets no `X-Frame-Options`/CSP anywhere that would block it. It was rejected anyway: iOS Safari does not render an embedded PDF usably inside an iframe — first page only, no scroll, no pinch-zoom within the frame — which is precisely the device this screen is built for (DEC-021). `pdfjs-dist` renders to a `<canvas>` with the app's own controls instead: fit-width by default, a fixed zoom ladder (fit-width/1.5×/2×/3×) rather than a slider, and page navigation with large touch targets — all deliberately sized for someone without deep phone literacy.

**The PDF is fetched as an `ArrayBuffer` and handed to `pdf.js` directly (`pdfjs.getDocument({ data })`), never given a URL.** Passing a URL makes pdf.js negotiate `Range:` requests by default for progressive loading; `Range` is not a CORS-simple header, so it preflights, and the local-dev CORS policy (`allowHeaders: ["Content-Type"]`, from DEC-020's same-origin production assumption) would reject it — silently breaking the viewer in split dev while working in production, the worst kind of gap to hit late. `GET /files/:fileId` also sets no `Content-Length`/`Accept-Ranges` today, so Range support would fail open anyway. Fetching the whole file as one plain `GET` is CORS-simple, needs no backend change, and costs the whole PDF in memory before page one paints — acceptable for lab results, which run a few pages and well under the 15 MB upload ceiling (`MAX_UPLOAD_BYTES`).

**Self-hosted, not a CDN**: the worker script is resolved via `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`, which Vite turns into a hashed asset under the same `frontend/dist/_astro/` directory the single Worker already serves (DEC-020) — no new deployment step, no third-party host in the request path of an internal tool that already refuses to be indexed.

**Loaded only on demand.** `pdfjs-dist` is a genuinely large dependency (a few hundred KB of core, over a megabyte for the worker); importing it is a dynamic `import()` inside `manager.astro`'s script, fired the first time a result is opened, not a top-level import. Verified against the built output: `grep -ri pdf dist/index.html` (and every other page) finds nothing — only `/admin/manager`'s own script chunk references the pdf.js chunk, and only via the dynamic-import call, never a static one. Standard fonts and CMaps are deliberately not enabled; lab result PDFs are Latin-1 with embedded fonts, and turning those on would ship several more megabytes of assets for a case that has not been observed. Revisit if a real PDF ever renders with missing glyphs.

**iOS canvas memory is capped, not trusted to the requested zoom.** Safari blanks a canvas silently past its own pixel ceiling — there is no error to catch — so `pdf-view.js`'s `canvasPixels()` clamps the effective render scale (`scale × devicePixelRatio`) to a fixed pixel budget before it ever reaches `page.render()`, rather than letting a 3× zoom on a wide page hit the ceiling on a real device during a real publish.

## DEC-023: Download tokens are scoped to a record, and the download route checks ownership

Status: Accepted

The public download token (DEC-015: AES-256-GCM, opaque, five-minute TTL) used to encrypt `{ fileId, exp }` — one token authorized exactly one file, which was sufficient while a record could only have one published result (DEC-010, now reversed).

With many published studies per folio, that shape stops fitting: one verification must unlock everything the patient is entitled to, and issuing N tokens from one lookup would mean N independent expiries for what is, to the patient, a single act of "check my results". The token now encrypts `{ recordId, exp }`, and the download route names the file separately: `GET /api/public/results/:downloadToken/download/:fileId`.

**The consequence, and it is the whole reason this is a decision and not an implementation detail:** the token became a key to a folio rather than to a file, so the route must now prove the requested file actually belongs to that folio. `filesRepo.findPublishedInRecord()` checks both halves in one query — the file must be `PUBLISHED` **and** its `record_id` must match the token's. Without that second half, any holder of one valid token could enumerate file ids and pull another patient's result; the file-scoped token made that structurally impossible, and the record-scoped one makes it a check that has to be right. A test asserts a token for folio A cannot fetch a published file from folio B.

Two smaller consequences, both deliberate:

- A malformed `fileId` is rejected with the same `404 LOOKUP_FAILED` as a well-formed but wrong one, rather than the `400 INVALID_INPUT` the internal routes use. On a public route the *shape* of an id must not be a signal either.
- The blast radius of a leaked token grew from one file to one folio's published files. Accepted: the token is already scoped to a patient who passed three-factor verification, it still expires in five minutes, and it still cannot outlive a revoke (DEC-014). What it never grants is anything belonging to a different patient.

## DEC-024: UX heuristics (Fitts, Jakob, Zeigarnik, Von Restorff, Miller, Hicks, WCAG 2.2 AA) are explicit design criteria, not incidental polish

Status: Accepted

Starting with the manager surface (`/admin/manager`), every screen in the product is designed and reviewed against a named set of heuristics, not "does it look fine":

- **Fitts's law** — interactive targets are sized and shaped for how error-prone the tap is, not uniformly. The whole `.mgr-card` is the tap target (not just the arrow glyph), and the manager's zoom buttons are larger than its page-nav buttons because a mis-tap on zoom costs more attention to recover from.
- **Jakob's law** — one status vocabulary (`status.js`), one list-row pattern, and one native `<dialog>` confirm pattern reused across every screen, so a pattern learned once in the product works everywhere else in it.
- **Zeigarnik effect** — an open-loop count (e.g. "Por publicar (4)") is shown only where it represents unfinished work the actor owns; a tab for already-completed work (Publicados, Revocados) does not get a count, since there is no open loop to remind them of.
- **Von Restorff effect** — exactly one element per screen gets the "different" treatment: the active tab, or the single primary action in a button group. Never two.
- **Miller's law** — action bars and confirm sheets on mobile stay to one primary decision at a time; a destructive control is never placed next to a benign one within reach of the same tap.
- **Hicks's law** — screens built for the manager (a first-time-computer-adjacent user per DEC-021) offer the fewest choices that get the job done, not every option that exists; the employee's desktop surface, built for a repeat power user, can afford more density.
- **WCAG 2.2 AA** — glyph + label on every status (never colour alone, per DEC-007's neighbor requirement in `status.js`), full keyboard operability including roving-tabindex tablists, visible focus using `--color-primary` everywhere (not a token that silently falls back to `currentColor`), and live regions for async state changes.

The wireframe that seeded this pass (`DuoLab Phase 2 Wireframes.dc.html`, a Claude Design artifact) is a **lo-fi structure-and-flow reference**, not a visual spec: its teal placeholder palette is explicitly discarded in favor of `branding/guidelines.md`'s *One Purple Rule* — brand color decisions belong to the brand doc, never to a wireframe tool's default theme.

Scope of this decision: applied to `/admin/manager` first, then extended across the product in a shared-foundations refinement pass (2026-07) — see `docs/07-ux-refinement-plan.md` for the audit, the priority ranking, and what shipped versus what was deliberately deferred. What remains unverified there (screen-reader pass, automated contrast audit, real-device iPhone run) is listed in that document and in `docs/04-backlog.md`; this decision sets the criteria, it does not by itself assert conformance.

## DEC-025: Three environments — local, staging, production — with staging as a topological mirror, not a smaller copy

Status: Accepted

The product runs in exactly three environments, mapped to branches: feature branches → local, `develop` → staging, `main` → production. The full matrix (resources, hostnames, secrets, what is shared and what is separate) lives in `docs/08-environments.md`; this decision records the reasoning that constrains it.

Staging is defined as *production's topology with production's data removed*. Concretely, three things must not differ, because each one is a class of failure staging exists to catch and would silently stop catching:

- **Single origin.** One Worker serving both the assets and the API, `PUBLIC_API_BASE` built empty, no CORS headers (DEC-020). Splitting the frontend onto its own staging hostname would pass in staging and fail on the first production deploy, which is the exact failure DEC-020 was written to remove.
- **The Access path policy.** Staging protects the same paths as production — `/admin*`, `/records*`, `/files*`, `/me`, `/search*`, `/patients*` — and excludes `/api/public/*` and the landing. Blanket-protecting the whole staging hostname was considered and rejected: it is simpler to configure, and it makes the patient flow unreachable from a browser without an Access session. That would leave the most publicly exposed surface in the product as the one surface staging never exercises. The cost accepted in exchange is that staging's public routes are reachable by anyone who knows the hostname; they are the same routes that are public in production anyway, and they are rate-limited by the same code (DEC-015).
- **Migrations.** Staging's schema changes only through `database/migrations`, in order. A hand-patched staging database is no longer a rehearsal of the production deploy.

What must differ is resource identity: separate D1, separate R2, separate Worker, and independently generated `RATE_LIMIT_KEY_SECRET` and `DOWNLOAD_TOKEN_SECRET` — so that a download token minted in staging cannot validate in production, and no staging request can read patient data. That separation is the entire justification for the environment; sharing any of it would reduce staging to a second name for production.

Deploys are manual until the runbook has been executed end to end at least once. Automation is scheduled after, not before: a pipeline written for a procedure nobody has performed encodes assumptions rather than experience.

## DEC-026: Employee patient editing, and why MANAGER gets it without a new rule

Status: Accepted

`PATCH /patients/:patientId` lets an employee correct a patient's name, phone number or birth date after the patient record already exists — a gap the product had no way to close before (a misheard name, a transposed digit in a phone number, a birth date typed wrong at intake, all previously permanent).

**Role:** the route is mounted behind `requireAccess` only — no `requireRole`. This is not a new grant of authority to MANAGER; it is DEC-013's `satisfies()` doing exactly what it was built to do. DEC-013 made MANAGER a strict superset of EMPLOYEE specifically so that adding a new EMPLOYEE-level action would never require a second decision about who else can do it — `POST /files/:id/publish` remains the *only* action gated by role in the app, and this route deliberately does not become a second one. If patient editing ever needs to be MANAGER-only, that is a new decision to write, not an oversight to fix.

**Why this needed a decision and an ordinary CRUD endpoint did not:** phone number and birth date are two of the three factors `services/public-result-service.ts` checks on every public lookup (the third is the folio). Editing either one **re-keys who can download this patient's already-published results** — a correction an employee makes to fix a typo has the side effect of changing who is authenticated to retrieve studies published before the edit. The route does not special-case this at the API level (there is no "confirm you understand" flag it requires), because the actor who needs to understand the consequence is a human at a keyboard, not the request — the frontend's `/admin/paciente` edit panel is where that consequence is surfaced, via a dedicated confirmation naming it explicitly before the request is even sent. The API's only obligation is to make the edit atomic and correct once asked.

**`search_name` is recomputed on a name change, not just on insert.** `patients.search_name` (DEC-008-adjacent, the accent-insensitive search column) was written once at `INSERT` and never touched again before this route existed, because nothing before it could change a name post-creation. A `PATCH` that updates `fullName` without recomputing `search_name` would leave the patient findable only by their *old* name — a silent, delayed bug with no error to catch it, since the write itself succeeds. `data/records.repo.ts#updatePatient` recomputes it through the same `normalizeForSearch()` the insert path uses, in the same statement, so the two can never drift.

`patientId` is immutable — never accepted from the request body, only from the URL, and the route does not even read it out of the body if present. `updated_at` (a column that has existed on `patients` since the original schema but was never written before this route) now actually advances.

## DEC-027: Server-authoritative daily folio suggestion, and why the sequence is global per lab-local day

Status: Accepted

`GET /records/folio-suggestion` (`?name=` before a patient exists, `?patientId=` once one does) returns `{ folio, initials, day, sequence }` — the folio the create form pre-fills, following the convention `{INITIALS}-{DDMMYY}-{SEQ_PREFIX}{n}` (e.g. `JPKR-040826-0131`). `SEQ_PREFIX` (`"013"`) is a literal component the client asked to see before the counter — not a zero-padding scheme, so the tenth folio of the day is `…-01310`, not `…-013010`.

**The sequence is global across every folio created that lab-day, not scoped to one patient or one initials/date base.** The first working draft of this feature read the corrected example (`JPKR-040826-0131`, `AMLG-040826-0132`, `PRHG-040826-0133` — three different patients) as a per-patient counter and got it wrong: `AMLG-...-0132` is the second folio *of that day*, not the second folio *for that patient*. `domain/folio.ts#nextDailySequence` reads every folio created in the lab-local day (`data/records.repo.ts#listFoliosForDay`, an indexed range scan on `records.created_at`, not a `LIKE`) and takes the max parsed sequence, regardless of whose folio it was.

**The day is the lab's own calendar day, not UTC.** `records.created_at` is `CURRENT_TIMESTAMP`, stored in UTC; Ciudad del Carmen, Campeche observes no DST, so a fixed `LAB_UTC_OFFSET_HOURS = -6` correctly computes the lab's own midnight year-round — unlike most of the rest of Mexico, where a fixed offset would eventually be wrong for half the year. Getting this wrong would silently roll the sequence over at 6pm local instead of midnight, reusing "yesterday's" numbers for the last six hours of every real business day. `labDayUtcBounds()` converts the lab-local day into the UTC `[start, end)` pair used in the range query, pinned by a test at the exact rollover instant (`2026-08-05T05:59:59Z` vs `2026-08-05T06:00:00Z`).

**Why `MAX(parsed sequence)` and not `COUNT(*)`:** a folio predating this convention, or one an employee typed by hand, is still a legitimate folio (`validateFolio` is a charset allowlist, not a shape constraint — see the folio decision in `docs/03-decisions.md`'s earlier entries). Counting rows would drift the moment a day contains even one such folio; parsing the trailing `-{SEQ_PREFIX}{digits}` and skipping what doesn't match keeps the sequence correct regardless of what else is in that day's list.

**Concurrency: the suggestion is advisory, the `UNIQUE` index is the actual guard.** This endpoint does no locking or reservation — two employees who both load the create form at the same instant can both be offered the same next number. `records.folio TEXT NOT NULL UNIQUE` (`0002_records.sql`) is what actually prevents two rows sharing one folio; the second `POST /records` gets the same `409 FOLIO_CONFLICT` it always did (`isFolioConflict()` matching the SQLite constraint error), unchanged by this feature. The client-side consequence: when the folio in the field is the untouched suggestion (not hand-edited), a `409` triggers one silent retry against a fresh suggestion before falling back to the duplicate-folio dialog a hand-typed conflict already showed. A dedicated test creates two records with the same suggested folio via `Promise.all` and asserts `[201, 409]`, proving the index — not the suggestion — is what decides.

The folio stays editable after being suggested, exactly as before this feature existed: staff-supplied and immutable only once the record is created.
