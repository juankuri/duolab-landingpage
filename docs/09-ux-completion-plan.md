# DuoLab — UX/UI completion plan (checkpoints C–F)

**Status:** proposed, awaiting approval.
**Context for a fresh session:** this plan is self-contained. Read it, then read
`CLAUDE.md`, `docs/03-decisions.md` and `docs/06-quality.md` before touching code.
Branch in progress: `ux/checkpoint-b-patient-editing-folio-sequence`.

**Ordering principle:** the three live defects first (one of them blocks all
testing on `/admin/nuevo`), then the visible frontend work, then the plumbing.
The original brief was a frontend-polish brief and the schedule now reflects
that — search, pagination and performance come last, not first.

---

## 0. Honest state of the previous pass

An earlier session ran checkpoints A and B. Three things went wrong and must be
corrected before new work starts.

### 0.1 Three live defects (two are regressions from that pass)

| # | Symptom | Root cause | Origin |
|---|---|---|---|
| **D1** | `/admin/nuevo` renders as a blank white sheet with a dead "Cerrar" button; the form is unreachable, so folio autogeneration can't even be tested | `.sheet--pdf { display: flex }` (`frontend/src/styles/admin.css:845`) overrides the UA rule `dialog:not([open]) { display: none }`. The fullscreen PDF `<dialog>` is therefore **always painted**, non-modally, on top of the form. `Cerrar` calls `.close()`, which changes nothing because the dialog was never open. | **Regression, checkpoint A** |
| **D2** | White bar behind the manager's status tabs and behind "Publicar resultado" | `.mgr-tabs` (`frontend/src/styles/manager.css:23`) and `.mgr-actionbar` (`manager.css:253`) are sticky full-bleed bars painted `var(--color-surface)` = `#ffffff`, over a page background of `--color-surface-muted` = `#f5f3f8`. | **Pre-existing, missed** |
| **D3** | Patient edit panel is a cramped horizontal row; long names are clipped rather than handled | `<form class="card">` in `frontend/src/pages/admin/paciente.astro` inherits `.card { display: flex; align-items: center }` (`admin.css:52`), so the `<h2 class="sect">` and the three `.field` blocks became side-by-side flex children. No ellipsis, null, or long-value handling anywhere. | **Regression, checkpoint B** |

**Why D2 was missed, stated plainly:** the checkpoint A audit claimed "four real
white-square offenders, all fixed". That audit read `admin.css` only. The
manager screen is styled by a **separate 383-line `manager.css`** that was never
opened. The fix was real but the claim of completeness was false. Any future
CSS claim in this repo must name every stylesheet it audited.

**Why D1 shipped:** the checkpoint A verification read `object.data` values via
`javascript_exec` and called that "verified working". It never looked at the
rendered page. Programmatic assertions are not visual verification. See §6.

### 0.2 Two documentation debts already incurred

- Commit `814a86e` cites **DEC-027**; commit `4d60e89` cites **DEC-013
  inheritance** and the plan promised **DEC-026**. `docs/03-decisions.md` stops
  at DEC-025. **Both decisions were never written.** Committed code references
  decisions that do not exist.
- `docs/06-quality.md:37,40` still states `src/data/**` thresholds as 80/55;
  the actual vitest config is 85/75.

### 0.3 What the original brief asked for and did **not** get

Delivered: PDF preview + fullscreen, drag-and-drop upload, `?download=1`,
review-before-confirm, folio autogeneration (backend + wiring), patient
editing (backend + minimal UI), `admin.css` white-square fixes.

**Not delivered — the frontend-facing majority of the brief.** Each is now
scheduled, and this is the map from the brief to this plan:

| Brief item | Where it lands |
|---|---|
| §5 Phosphor Icons — **requested by name**, 8 hand-rolled SVG paths shipped instead | **§2 · D1** |
| §4 Layout & design consistency (spacing, rhythm, hierarchy) | **§2 · D2** |
| §5 Input placeholders with format examples | **§2 · D3** |
| §10 Patient results page redesign | **§3 · E1** |
| §8 Patient copy — friendly, reassuring | **§3 · E3** |
| §9 Neutral messaging on lookup failure | **§3 · E3** |
| §3 Real-time search (general) | **§4 · F2** |
| §3 + §11 Manager search, filtering, pagination, scale | **§4 · F1, F2** |
| §2 Performance — lazy loading, bundle, data fetching | **§4 · F3** |

---

## 1. Checkpoint C — stop the bleeding (small, lands first, alone)

Surgical. No new features. Exists so that everything after it can be tested at
all.

### C1 · Fix D1 — `/admin/nuevo` is unusable

`admin.css`: scope the flex layout to the open state.

```css
.sheet--pdf { max-width: none; width: min(96vw, 900px); height: 90vh; padding: 0; }
.sheet--pdf[open] { display: flex; flex-direction: column; }
```

Then **sweep every `dialog` rule in both stylesheets** for the same class of
bug: any `display` on a bare `.sheet`-family selector. Regression test in §5.

### C2 · Fix D2, and audit `manager.css` completely

- Repaint `.mgr-tabs` and `.mgr-actionbar` to sit on the page rather than above
  it: `--color-surface-muted` with the existing border, or transparent with a
  `backdrop-filter` blur — chosen after looking at both rendered.
- Then read `manager.css` **end to end** (all 383 lines) and list every rule
  painting `--color-surface` where the page background is muted. Fix all of
  them here. Report the count.

### C3 · Fix D3, and establish the "ugly data" rules

Rebuild the edit panel as a real **vertical** form — its own `.form-card`
class, not `.card`. Fields stack, each full-width, so a 120-character name has
somewhere to go.

Then add, as **shared utilities** in `admin.css` rather than per-page patches:

- `.truncate` — single-line ellipsis, with `title` carrying the full value.
- `.clamp-2` — two-line clamp for names and filenames.
- A documented null convention: never render `null` / `undefined` / `""`. Show
  an explicit `—` with an accessible label ("sin dato"), never a blank cell.
- Long lists: any list that can exceed ~20 rows gets a cap plus a count
  ("mostrando 20 de 137"). The lists themselves are enumerated in §4 · F1.

**Then design against hostile data, not demo data.** Add
`backend/scripts/seed-hostile.ts` generating: 120-character names; a name that
is one unbroken 60-character word; empty-but-valid optional fields; a patient
with 40 folios; a folio with 15 results; a 200-character filename. Every screen
is reviewed against this seed from here on.

### C4 · Pay the documentation debt this pass already incurred

- **DEC-026** — employee patient editing; MANAGER inherits it via DEC-013's
  `satisfies()` rather than a new rule; phone and birth date are public-lookup
  authentication factors, so editing them re-keys download access.
- **DEC-027** — server-authoritative folio suggestion; the sequence is global
  per **lab-local** calendar day (`LAB_UTC_OFFSET_HOURS = -6`, no DST); why
  `MAX`-of-parsed-suffix beats `COUNT(*)`; why the `records.folio` UNIQUE index
  stays the concurrency authority rather than a lock or reservation table.
- Fix `docs/06-quality.md:37,40` (80/55 → 85/75).

These two belong here because the work that earned them is already committed;
no later checkpoint will earn them.

**DoD for C:** full DoD (§6) + before/after screenshots of `/admin/nuevo`,
`/admin/manager`, `/admin/paciente` at 375 px and 1280 px + the hostile-data
pass + `/` proven pixel-identical.

---

## 2. Checkpoint D — the design system, applied everywhere

Brief §4, §5 and §6. **This is deliberately before the patient-page rebuild**,
and it is the one place this plan deviates from the order you listed: the
patient page consumes these primitives, so building it first means building on
values that this checkpoint then rewrites, and touching that page twice. It is
still visible work — it changes every screen in the product. Say the word and I
will flip D and E.

### D1 · Phosphor Icons, as asked

Add `@phosphor-icons/core` as a **build-time dependency only**. Astro inlines
the raw SVG at build; nothing reaches the browser but path data — no runtime
JS, no icon-font request, no new UI library. Replaces the 8 hand-rolled paths
in `frontend/src/scripts/shared/icons.js`.

`Icon.astro` gains a `weight` prop (`regular` default, `fill` for active
states) and keeps its contract: `aria-hidden`, `currentColor`, always beside a
visible label.

Mapped from the brief: phone → `Phone`, email → `Envelope`, address → `MapPin`,
ID → `IdentificationCard`, calendar → `CalendarBlank`, doctor → `Stethoscope`,
laboratory → `Flask`, files → `FilePdf`, status → per-state (`Clock`,
`CheckCircle`, `SealCheck`, `Prohibit`).

**Domain gap, flagged not papered over:** the schema has no email, address,
doctor or ID column (`database/migrations/0002_records.sql`). Those four icons
have nothing to label. This plan **does not invent fields** — it maps the icons
that have data and records the rest as a product question (§7).

Coverage is comprehensive across admin *and* patient surfaces: `/resultados`
result cards, the patient card on `/admin/folio`, `/admin/revisar` and
`/admin/paciente`, every status badge, every upload zone, every row action.

### D2 · One spacing and type scale, enforced

Audit every admin and patient screen against the brief's list — spacing,
margins, padding, alignment, component sizing, typography hierarchy, visual
rhythm. Concretely:

- Every hardcoded `px` in `admin.css` and `manager.css` that should be a
  `--space-*` token becomes one. Report the count before and after.
- One card treatment, one section-heading treatment, one list-row treatment,
  shared by both stylesheets instead of diverging per file.
- Vertical rhythm on a single scale rather than today's per-page values.

### D3 · Placeholders and field copy

Every input gets a placeholder carrying a **format example**, not a restatement
of its label: phone → `9381234567`, birth date → `AAAA-MM-DD`, folio →
`JPKR-050826-0131`, search → `Nombre, teléfono o folio`.

**Boundary for this whole checkpoint:** `frontend/src/styles/clients/duolab.css`
and the landing's `Layout.astro` are not touched. `/` must stay
pixel-identical; it is in the screenshot set precisely to prove that.

---

## 3. Checkpoint E — the patient experience

Brief §8, §9 and §10. The surface a patient judges the lab by, and today the
least finished screen in the product.

### E1 · Redesign `/resultados`

A rebuild of the result panel, not a reskin. It carries: page title, masked
patient name, folio, availability status, published count, readable filename,
publication date, per-file download, per-file "Ver PDF". Modern cards, real
hierarchy, one unmistakable primary CTA, a professional medical aesthetic that
earns trust. Reference images 2 and 3 are inspiration for structure and calm,
not designs to copy; the DúoLab identity stays.

Skeletons for structural loading (the panel's shape is known in advance);
inline pending states for the download and preview buttons; explicit expired,
revoked, empty and failure states. The `.truncate` / `.clamp-2` / null
conventions from C3 apply here first — long filenames and long names are the
norm on this page.

### E2 · Masked name

New `backend/src/domain/masking.ts`: given names in full, surnames as initials
("Juan Pablo O. L."). Added to the lookup response **only after all three
factors match**, so enumeration is unaffected and the full name never crosses
the public boundary.

### E3 · Copy pass, and the neutrality rule

Warm, plain Spanish throughout: "Consulta tus resultados aquí", "Captura los
datos que te dio el laboratorio", "Tus resultados están listos", "Descargar
PDF", "¿Necesitas ayuda? Escríbenos por WhatsApp".

The failure message becomes your wording — friendlier, still revealing nothing:

> No fue posible mostrar tus resultados con la información proporcionada.
> Verifica tus datos o intenta nuevamente más tarde. Si el problema continúa,
> comunícate con el laboratorio.

**This is copy only.** The backend already collapses every failure — wrong
folio, wrong phone, wrong birth date, unpublished, revoked, expired token — to
one identical `404 LOOKUP_FAILED`
(`backend/src/services/public-result-service.ts:77-112`), pinned by
`backend/test/public-lookup.test.ts`. That guardrail is **extended, never
relaxed**: the new masked-name field must be proven absent from every failure
branch.

### E4 · Preview without leaking the token

The in-page viewer fetches the PDF with `fetch()` against the **existing**
`GET /api/public/results/:token/download/:fileId` and renders the resulting
`ArrayBuffer`. "Open fullscreen / new tab" uses a `blob:` object URL.

Stated plainly: **no public route ever carries the download token into a
navigation.** A new tab is a navigation, so a token in the path would land in
the address bar, in history, and in session-restore state. A `blob:` URL is
origin-scoped, unguessable, dies with the document, and contains no token — so
this is strictly safer than the alternative, not a compromise. Cost, said out
loud: the whole PDF is held in memory before first paint, and each preview is a
fresh fetch (no caching — DEC-014). Acceptable for a few-page result under the
15 MB ceiling; the same trade DEC-022 already accepted for the manager.

Amend **DEC-022** to record this and the retirement of `/admin/revisar`'s
iframe.

Share is `navigator.share` with the fetched blob, rendered **only** when
`navigator.canShare({ files })` is true — a control that isn't functional isn't
shown.

---

## 4. Checkpoint F — manager scale, live search, measured performance

Brief §2, §3 and §11. Last, because none of it changes how the product looks —
but all of it changes how it feels at scale, and DEC-021's constraint (one
manager, ~60 years old, one iPhone, one hand) has to survive it.

### F1 · Backend: search, paging, real counts

`GET /records` gains `?q=` and `?offset=`, and returns `total`.

- `q` reuses `normalizeForSearch` / `normalizePhoneQuery` and the same
  predicates as `searchFolios` (`backend/src/data/records.repo.ts:369`).
- `total` is a `COUNT` over the same predicate, so counts stop being capped at
  the current `limit=50` — **the tab chips in the screenshots are showing a
  truncated number today.**
- Composes with the existing `?status=` and `?include=files`.
- Offset pagination, not cursor: acceptable at a queue of tens, and the
  backlog's cursor item stays open with the reasoning recorded rather than
  assumed away.

### F2 · Frontend: search that types

Applies to `/admin` (home), `/admin/buscar` **and** `/admin/manager`, from one
shared module (`frontend/src/scripts/shared/live-search.js`) — not three copies:

- 250 ms debounce; an `AbortController` per keystroke so a slow earlier
  response can never overwrite a newer one; Enter still works but is never
  required.
- Query and tab persisted to the URL via `history.replaceState`, so browser
  back restores the queue.
- "Cargar más" using `?offset=`, replacing today's silent truncation at 50.
- Search-specific empty states, distinct from tab empty states.
- Mutations refresh only the affected tab (3 requests → 1).
- Within DEC-021: the three status tabs remain the status filter and the
  day/hour grouping remains the date structure. **No sort control, no filter
  bar** — search, real counts, load-more and persisted state fix scale without
  adding choices to a screen built to have few.

### F3 · Performance — measure first, then fix

The brief says the app feels slow for every role. **Measure before changing
anything** and paste real numbers, not impressions.

Already measured: `frontend/dist` is 2.0 MB, of which pdf.js is 1.68 MB and
correctly dynamic-imported; no page's own script exceeds 13 KB; the font is a
single 27 KB variable woff2. **Bundle size is not the problem.** The measured
problems are waterfalls:

- Serial `/me` → data on `/admin`, `/admin/folio`, `/admin/manager`. Fix:
  `Promise.all` — the folio id is in `location.search` immediately and nothing
  forces the record fetch to wait on the role.
- `loadActor()` uncached, re-fired on every navigation. Fix: a `sessionStorage`
  cache, **subject to every one of these, none optional** — a render hint only
  and never the authorization source of truth; served immediately *and*
  revalidated in the background on every load; updated and reconciled when the
  role changes; cleared by any 401 or 403 from one place in `api.js`; cleared
  on logout; `sessionStorage` (tab lifetime), never `localStorage`.
- The font is preloaded on the landing only, so `/resultados` and every admin
  page discover it after CSS parse. Fix: preload in `AdminLayout.astro` and
  `resultados.astro`. The landing's own preload is untouched.
- Skeletons for lists, the queue and the patient card, replacing text-only
  "Cargando…". Duplicate-action guards uniform on every mutating button.

**No response caching is added.** DEC-014 forbids it; `Cache-Control: no-store`
stays on `/api/public/*` and `GET /files/:fileId`.

Deliverable: a before/after table of request counts and serial hops per route.

---

## 5. QA — tests and quality metrics

### 5.1 Backend (`backend/test/`, real D1/R2 via `@cloudflare/vitest-pool-workers`)

| Checkpoint | Tests |
|---|---|
| **C** | No new backend tests (C is CSS + docs). The existing 320 must stay green. |
| **E** | `public-lookup.test.ts`: masking correctness, **and the non-enumeration assertion extended** to prove no failure branch leaks the new field. |
| **F** | `records.test.ts`: `?q=` matches folio/name/phone and composes with `?status=`; `?offset=` pages with no gaps or repeats; `total` is the unpaged count. |

### 5.2 Frontend (`frontend/test/`, vitest + jsdom, pure modules only)

| Checkpoint | Tests |
|---|---|
| **C** | New `dialog.test.js` — a closed `<dialog>` computes `display: none` under the real stylesheet (**the D1 regression guard**). New `format.test.js` — truncation, clamping, and the null/empty `—` convention. |
| **D** | `icons.test.js` — every name in `ICON_NAMES` resolves to a Phosphor path and renders `aria-hidden` with a sibling label. |
| **E** | `lookup.test.js` — new copy, masked-name rendering, preview/share capability gating, expired and revoked states, and **that no rendered URL anywhere contains the download token**. |
| **F** | New `live-search.test.js` — debounce, **out-of-order response rejection**, offset accumulation, tab+query persistence. `session.test.js` — the `/me` cache serves then revalidates, updates on a changed role, and is cleared by 401 and by 403. |

`.astro` pages stay out of unit scope (`docs/06-quality.md`); they are covered
by the manual scripts in §6.

### 5.3 Quality metrics

Baselines to beat, never to lower:

- Backend: **320 tests**, statements 93.95 / branches 88.13. Per-directory
  thresholds 90/85 domain, 90/80 services, 85/75 data, 80/70 http.
- Frontend: **171 tests**, statements 93.61 / branches 87.5.
- `frontend/dist` 2.0 MB total; landing CSS hash `index.CwiHrLvc.css` must not
  change in any checkpoint that claims not to touch the landing.

**Coverage thresholds move up or stay. Lowering one to make a command pass is
prohibited** (`docs/06-quality.md`).

### 5.4 Guardrails no checkpoint may weaken

Non-enumeration (DEC-015), no patient data in logs, live revocation (DEC-014),
record-scoped download tokens (DEC-023), private R2 with no permanent URLs,
role checks server-authoritative.

---

## 6. Verification — what "done" means

Every checkpoint ends with the full Definition of Done, in order, real output
pasted:

```bash
pnpm --filter @duolab/backend check && pnpm --filter @duolab/backend test && pnpm --filter duolab test && pnpm --filter @duolab/backend test:coverage && pnpm --filter duolab test:coverage && pnpm --filter duolab build
```

**Then the app is opened in a browser and looked at.** Reading a DOM property
via `javascript_exec` is not visual verification and may not be reported as
such — that is precisely how D1 shipped. Required per checkpoint:

- Screenshots at **375 px and 1280 px** of every affected route, before the
  first commit and after the last: `/`, `/resultados`, `/admin`,
  `/admin/buscar`, `/admin/nuevo`, `/admin/folio`, `/admin/revisar`,
  `/admin/paciente`, `/admin/manager`.
- `/` is in that set specifically to prove the landing did not change. Any
  difference is a defect in this pass, not an improvement.
- Every screen re-checked against the hostile-data seed (C3).
- **Loading and error states are part of the checklist**, not an afterthought:
  for each async surface confirm idle → loading → loaded → empty → submitting →
  success → validation error → recoverable error → expired session →
  unexpected error, and confirm no contradictory pair (an empty message while
  loading; a stale success left standing after a later failure).

Correct ports, since this already cost a round trip: **the frontend is
`localhost:4321`** (Astro dev). `localhost:8787` is the API — it serves the
Worker's *built* assets, which are stale unless `pnpm --filter duolab build`
just ran.

Manual scripts per checkpoint:

- **C** — `/admin/nuevo` reachable and the form usable; the fullscreen dialog
  opens *and* closes; manager tabs and action bar show no white bar; the
  patient edit panel is vertical and survives a 120-character name.
- **D** — every icon renders beside its label on both admin and patient
  surfaces; one spacing scale holds at both widths; `/` pixel-identical.
- **E** — `docs/06-quality.md` Flow E in full, especially the four different
  failures rendering one identical message, and token scoping. Then: preview a
  PDF, download it, open fullscreen, and **confirm the address bar shows a
  `blob:` URL with no token**; confirm share is absent where `canShare` is false.
- **F** — type in search: no request per keystroke, no stale overwrite; counts
  match D1; "Cargar más" past 50; browser-back restores tab and query; paste
  the before/after request-count table.

Flow D (real iPhone), screen-reader and automated-contrast verification cannot
be run here. They stay **listed as unverified** and are never claimed as done.

---

## 7. Documentation, handoff, debt and pendings

Updated **within the checkpoint that earns each change**, never batched at the
end.

| Document | Change |
|---|---|
| `docs/03-decisions.md` | Write **DEC-026** and **DEC-027** (C4). Add **DEC-028** (Phosphor as a build-time icon source; why an icon set is not a UI library) in D. Amend **DEC-022** (shared viewer, iframe retired, blob-URL preview) in E. Annotate **DEC-021** (search and load-more added; why they don't violate its minimalism) in F. |
| `docs/05-technical.md` | Fix the API list — the public download route is missing its `:fileId` segment. Add `PATCH /patients/:patientId`, `GET /records/folio-suggestion`, and `?q=` / `?offset=` / `total` on `GET /records`. |
| `docs/06-quality.md` | Fix the 80/55 → 85/75 drift. Add the hostile-data seed and the loading/error-state checklist to the manual scripts. Record the new coverage baselines. |
| `docs/04-backlog.md` | Tick closed items. Record what was deliberately left, with reasons (below). |
| `docs/02-architecture.md` | Document the stylesheet topology — `admin.css`, `manager.css`, and the landing's own, and which surfaces import which. That this was undocumented is what let D2 hide for a whole checkpoint. |
| `docs/07-ux-refinement-plan.md` | Mark superseded by this document. |

### Technical debt this plan deliberately does **not** pay

Each is a real cost, recorded so it is a choice and not an oversight:

- **`.astro` page scripts are untested.** The inline `<script>` in every page
  holds real branching logic no unit test reaches. Extracting it into testable
  modules is the right fix and is larger than this pass; §5.2 extracts only
  what each checkpoint touches.
- **`users.repo.ts` sits at 0% coverage** (DEC-019), holding `src/data/**`'s
  branch threshold down.
- **Offset pagination can repeat or skip rows** if the list changes between
  pages. Acceptable at a queue of tens; the cursor item stays open.
- **The hand-rolled `$()` helpers** produce ~613 `astro check` type errors
  across all pages. Pre-existing, reported, not fixed here — a mechanical but
  repo-wide change that would bury this pass's diff.
- **`docs/06-quality.md` Flow D (real iPhone)** remains owed.

### Pendings requiring a person, not an agent

- **DEC-015 relaxation** — whether a caller who already supplied a correct
  folio + phone + birth date may be told "not published yet".
  `docs/01-domain.md` asks for it; DEC-015 currently wins. A real trade against
  the non-enumeration guarantee. Product-owner call.
- **The phantom `delete` action** — `ACTIONS.UPLOADED` lists it, no UI offers
  it, so an erroneous draft can only be replaced, never removed.
- **Missing patient fields** — the brief asks for email, address, ID and doctor
  icons; the schema has none of those columns (D1). Adding them is a domain
  decision with migration, validation and public-lookup consequences.
- **"Descargar todos" (ZIP)** — needs a zip library in the Worker and a
  multi-object streaming endpoint. Stays a backlog "Later" item.

---

## 8. Execution rules

1. **One checkpoint at a time. Stop for approval after each.** C → D → E → F.
2. Each checkpoint leaves a clean commit series, each commit building and
   passing on its own.
3. Each checkpoint reports: changed routes, changed files, DoD output, the
   before/after screenshots, and the manual steps actually performed —
   separating what was verified from what was not.
4. **Nothing is reported as verified that was not looked at.** If a check could
   not be run, it is named as unrun.
5. No deploy, no remote migration, no Cloudflare change, no push, no merge.
6. Commits: short one-line summary, no AI attribution.
