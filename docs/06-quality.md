# Quality

## Test taxonomy

The repo already has three kinds of test; this section names what exists rather than adding a fourth.

Domain
: Pure rules in `backend/src/domain/` (`file-lifecycle.ts`, `validation.ts`, `download-token.ts`, …). No I/O, no Worker — run under plain Vitest inside the `cloudflareTest` pool, same as everything else in the backend, but they don't touch D1 or R2.

Data / services / HTTP
: Everything that touches D1 or R2 is exercised through the HTTP route, inside workerd, against real D1 and R2 bindings via Miniflare (`@cloudflare/vitest-pool-workers`, see `backend/vitest.config.ts` and `backend/test/helpers.ts`). Nothing here is mocked at the repository boundary — `data/` is the only code allowed to hold SQL or bucket calls (DEC-005), and the tests confirm what it does, not what it was told to do.

Frontend pure modules
: `frontend/src/scripts/admin/status.js`, `folio.js`, `render.js`, `validation.js`, `session.js`, `manager.js`, `pdf-view.js`, and `frontend/src/scripts/public/lookup.js` — tested with Vitest + jsdom (`frontend/vitest.config.js`). `api.js` and `upload.js` are thin `fetch()`/XHR wrappers; they are exercised by the manual smoke walk, not unit tests, for the same reason `data/` on the backend is thinner than `domain/` — the interesting behavior is on the other side of the I/O call. `session.js`'s `loadActor()` is the one exception worth naming: it wraps `fetch` but is tested anyway (via a stubbed global) because it decides the manager/employee redirect, and that decision is worth pinning even though the call itself is thin.

Pages
: Astro pages (`admin/*.astro`, `resultados.astro`) are **not** covered by an automated suite. Rendering full Astro output and stubbing `fetch` would cost more than it buys while the manual smoke walk is still the actual gate for page behavior. If that stops being true — Playwright/Cypress gets added — this section changes with it.

## Definition of Done, per slice

In this order. A step skipped is a step reported as skipped, not silently dropped.

1. `pnpm --filter @duolab/backend check` (`tsc --noEmit`) clean.
2. `pnpm --filter @duolab/backend test` green, count not lower than before the slice.
3. `pnpm --filter duolab test` green, count not lower than before the slice.
4. `pnpm --filter @duolab/backend test:coverage` and `pnpm --filter duolab test:coverage` above their thresholds (see below).
5. `pnpm --filter duolab build` clean.
6. The manual QA script for the flow the slice touched (below), actually run, not assumed.
7. Docs updated if the slice changed a decision, a contract, or the domain model — `docs/01-domain.md`, `docs/03-decisions.md`, `docs/04-backlog.md`, `HANDOFF.md` as applicable.

## Threshold policy

- A threshold moves up when coverage genuinely rises. It is never lowered to make a command pass — if a change drops coverage, the slice either adds tests to hold the line or states in the commit message exactly which branch is now uncovered and why that's acceptable.
- Thresholds are set **per directory** (see `backend/vitest.config.ts`, `frontend/vitest.config.js`), not as one global number, because the layers do different jobs and shouldn't be graded the same:
  - `backend/src/domain/**` — statements 90 / branches 85. Pure rules; there's no excuse for an untested branch here.
  - `backend/src/services/**` — statements 90 / branches 80.
  - `backend/src/data/**` — statements 80 / branches 55 (see gap below).
  - `backend/src/http/**` — statements 80 / branches 70.
  - `frontend/src/scripts/admin/{status,folio,render,validation,session,manager,pdf-view}.js` and `frontend/src/scripts/public/lookup.js` — statements 85 / branches 75.
- **Known gap, not hidden:** `backend/src/data/users.repo.ts` has no direct test (0% today, only exercised indirectly through `auth.ts`), which is why `src/data/**` branches sits at 55 instead of the 70 every other layer clears. Raise it the day a test is added, not before — a threshold set above what's actually measured just teaches everyone to ignore the coverage command.

## What a new unit test needs

- The happy path.
- The edges: empty input, a boundary value, accented/diacritic text where the code normalizes it, a duplicate.
- The expected failure, asserted by its specific error code — not just "throws".
- A state transition is tested from **every** origin state it's reachable from, not only the one that succeeds. `backend/test/file-lifecycle.test.ts` and `backend/src/domain/file-lifecycle.ts`'s own `TRANSITIONS` table are the pattern to follow.

## Regression guardrails no agent may weaken

These exist because they close a real privacy or security gap (see `docs/03-decisions.md` DEC-014, DEC-015). If one of these fails, the fix is in the code, never in the test:

- **Non-enumeration** (`backend/test/public-lookup.test.ts`): every failure mode of the public lookup — malformed input, wrong folio, wrong phone, wrong birth date, unpublished, revoked — collapses to the identical `404 LOOKUP_FAILED`.
- **No patient data in logs** (`backend/test/public-lookup.test.ts`): a `console.error` spy across a lookup asserts phone and birth date never appear in any logged value.
- **Live revocation** (DEC-014, `backend/test/public-download.test.ts`): a still-unexpired download token stops working the instant the file it points to is revoked or replaced — checked against `PUBLISHED` live, in the same query, never from a value trusted from an earlier read.

## Manual QA scripts

Run against `wrangler dev` (backend) + `astro dev --background` (frontend), one D1 and one R2, both local via Miniflare.

**Flow A — Alta (create patient + folio + first result)**
1. From the admin home, start a new patient with a folio, valid phone, valid birth date, and a PDF.
2. Confirm the folio cannot be created without a PDF.
3. Submit an already-used folio → expect the conflict dialog offering to open the existing folio.
4. Land on review; confirm in one click; return to the folio detail and check the tally updated.

**Flow B — Add a result + review + confirm**
1. Open an existing folio with at least one result already in some state.
2. Add a second result (PDF only) and confirm the first result's status did not change.
3. From review, confirm the new result in one click, no second modal.

**Flow C — New folio for an existing patient**
1. Open a patient's detail page.
2. Start "+ Nuevo folio"; confirm the patient fields are pre-filled and read-only (chip, not a form).
3. Submit with just a folio and a PDF; confirm in D1 that no new `patients` row was created.

**Replace + revoke**
1. Publish a result, run a public lookup, get a download token.
2. Replace that file's PDF while the token is still valid → confirm the download fails **before** the new PDF's bytes are the ones a re-download would serve (order matters, not just the eventual state).
3. Confirm the result now reads `Borrador` and that `published_by`/`published_at` are cleared.
4. As an employee (not a manager), revoke a published result → confirm it succeeds and that publishing is still refused to that role.

**Flow D — Publicación desde gerencia**, run on a real iPhone (iOS Safari) — the manual walk this slice cannot skip, since safe-area insets, the 16px input rule and the canvas memory cap (DEC-021, DEC-022) all fail silently in a desktop browser.
1. `DEV_ROLE="manager"` in `backend/.dev.vars`, `pnpm dev:setup && pnpm dev:seed`.
2. Open `/admin` on the phone → confirm it redirects to `/admin/manager` without a flash of the dense admin.
3. Confirm the three tabs load and their counts match what's in D1.
4. Open a CONFIRMED result → confirm the PDF renders **inside** the page, fit-width by default; the page and zoom controls work; nothing is hidden under the home indicator.
5. Publish it → confirm the sheet, then confirm "Ver siguiente por publicar (N)" jumps to the next item without returning to the queue.
6. Confirm a second result on the same folio from the employee flow, then publish it here too → confirm it **succeeds** alongside the first (DEC-010 reversed), and that both then show as `Publicado`.
7. Revoke a published result → confirm the copy says it is **definitive**, and that the revoked item offers no actions afterward.
8. With `DEV_ROLE="employee"`, confirm `/admin/manager` bounces to `/admin`; confirm `/admin?desktop=1` as a manager does not redirect.

**Flow E — Consulta del paciente: expiración, copy, no-enumeración**
1. Publish a result for a seeded patient (e.g. `MANB-140385-01` / `9381110001` / `1985-03-14`). Look it up on `/resultados` → success panel, folio echoed back, download works.
2. Wait out the 5-minute token window (or lower `TOKEN_TTL_MS` locally) → confirm the countdown updates, and that at expiry the page returns to the form with a clear message — never a raw JSON response replacing the page.
3. Submit with one or more fields blank → confirm "Completa los tres campos…", not the generic failure, and that focus lands on the first empty field.
4. **Non-enumeration, the regression this flow exists to catch:** run a wrong folio, a wrong phone, a wrong birth date, and a real folio with nothing published yet — confirm all four render the exact same message. If any of these ever differs, the bug is in the frontend copy or the backend response, never in this test.
5. Trigger the rate limit (repeat lookups past the folio or IP budget) → confirm the distinct "demasiados intentos" message, not the generic one.
6. Confirm the WhatsApp button is present and pre-filled correctly in both the form and the result states.
7. **Multi-publish.** Publish a second study on the same folio, then look it up again → confirm both appear, each with its own name, date and download, and that each link fetches the right PDF.
8. **Token scoping, the guard DEC-023 makes necessary.** Take a valid token from folio A and request a published file id belonging to folio B (`/api/public/results/<tokenA>/download/<fileB>`) → must be `404 LOOKUP_FAILED`. Same for a file on folio A that is only `CONFIRMED`, and for a malformed file id. If any of these ever returns a PDF or a `400`, stop and fix the route, not the test.
9. Revoke one of several published results → confirm the patient's list loses exactly that one and keeps the rest.

## Reporting

Every slice closes with the actual command output, not a summary of intent — paste the real pass/fail counts and coverage numbers. "Tests pass" without the number invites drift nobody notices until it's a real regression.
