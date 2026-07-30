# UX/UI refinement — audit and plan (2026-07)

Scope: refine the existing product's UI/UX across all flows. No new features, no domain-rule changes, no API contract changes, no new brand assets. Ordered: shared foundations → patient → manager → employee → landing. Full inventory (routes, components, forms, dialogs, responsive behavior, a11y scan) was done via code exploration before this plan; findings are folded in below rather than kept as a separate document.

## Critical

1. **Broken hero logo asset (landing).** `Hero.astro` references `/clients/duolab/logo/logo-full.svg`; only `/logo/logo-full.svg` and `/logo/logo-mark.svg` exist in `frontend/public/`. The hero's brand lockup 404s on every load of the real site. Fix: point at the existing path. No new asset needed.
2. **Dialog focus is never returned to its trigger.** `openRevokeSheet`/`openReplaceSheet` (`folio.astro`) capture a `triggerButton` reference that is never used to refocus on close — after closing any sheet (replace/revoke/add/dup), keyboard/screen-reader focus is lost to `<body>`. WCAG 2.4.3 (focus order) / 2.1.2 in spirit. Fix in the one place all sheets close.
3. **No skip link anywhere** (`AdminLayout.astro`, `Layout.astro`, `resultados.astro`). Every admin page and the landing have persistent chrome before `<main>`; a keyboard user cannot bypass it. WCAG 2.4.1.
4. **Inconsistent validation-error pattern between the two real public-facing forms.** `/admin/nuevo` uses per-field `<p class="err">`; `/resultados` (the one patients actually use, mobile, low digital literacy) uses a single combined message + refocus-first-empty-field. Patients need the clearest, most forgiving pattern of the two — align on per-field inline errors there too, so the fix is visible next to the field that caused it, not just implied by focus jumping.
5. **`/admin/folio`'s "⋯" menu is a small, isolated icon-only target for the second-most-common action on the busiest employee screen** (publish/withdraw/replace/revoke live behind it once "Confirm" is promoted out). Fitts's law: this is exactly the "small isolated icon button for an important action" the task explicitly calls out. Needs a larger hit area at minimum; some actions may deserve promotion the way "Confirm" already was.

## High

6. **Employee screens (`folio.astro`, `nuevo.astro`, `buscar.astro`, `paciente.astro`) have no real mobile layout** — one `640px` breakpoint touches only the topbar and card alignment; `.frow` (the core row primitive used everywhere) has no wrap behavior for narrow viewports, and the "⋯" menu popover is a fixed 210px width that can overflow a small screen. Employees are desktop-first by design (fine), but "remain fully responsive" is an explicit requirement — this needs a baseline mobile fallback, not full mobile optimization.
7. **No visible required-field indicator on any form.** Every field in `/admin/nuevo` and `/resultados` is implicitly required with no asterisk/legend; a screen-reader user gets no "required" cue until submit fails. Both forms are `novalidate`, so the HTML `required` attribute (present on `/resultados`, absent on `/admin/nuevo`) isn't even doing its native a11y job consistently.
8. **`/admin/nuevo`'s phone field has no `inputmode="tel"`** (relies on `type="tel"` alone) while `/resultados`'s does — inconsistent mobile-keyboard behavior between the two forms that ask for the same data.
9. **Five independent reimplementations of the empty-state pattern** and **seven independent reimplementations of the status-line setter** across admin pages (see inventory item 9). Every one of these is a place a future edit can drift from the others — worth consolidating into shared helpers now, since the task explicitly asks to reuse/improve shared components before duplicating.
10. **Three independent reimplementations of the patient-summary card** (`folio.astro`, `revisar.astro`, `paciente.astro`) and **three of the folio-row pattern** (`index.astro`, `buscar.astro`, `paciente.astro`) — same risk as #9, higher visual-consistency stakes since these are patient-identity-bearing rows.
11. ~~**Landing skips a heading level**~~ — **retracted on verification.** The initial audit note was based on an incomplete grep. `SectionHeader.astro` emits `<h2>`, `Hero.astro` emits the single `<h1>`, and the `<h3>`s in `How`/`Services`/`Location`/`Solution` sit correctly beneath their section's `<h2>`. Hierarchy is already valid; no change made.
12. **`ACTIONS.UPLOADED` includes `"delete"` in `status.js` but no consuming UI renders it** — a phantom action in the single source of truth for what's possible. Either it's a real gap (an employee genuinely cannot delete an erroneous draft before ever confirming it, which contradicts "prevention of accidental confirmation... easy PDF replacement or removal before confirmation" in the brief) or the table is stale. This needs a decision, not a silent fix — flagged as a domain question below, not something to resolve by adding new backend behavior unilaterally.

## Medium

13. Stale doc comment in `admin/index.astro` claims `/admin/nuevo` "does not exist yet" — it does, 262 lines. Harmless but misleading to the next person (or agent) who reads it.
14. `AdminLayout.astro`'s `viewport-fit=cover` comment justifies itself by referencing the *manager* screen's safe-area padding, but this layout is used by every *non-manager* admin page — the rationale is either dead or (more likely) simply also true generically; worth a one-line comment fix so it doesn't read as copy-pasted.
15. Inconsistent `alt` text policy between the two logo usages: `AdminLayout.astro`/`resultados.astro` correctly use `alt=""` (decorative, name is adjacent in text); `Hero.astro`'s logo has a full descriptive `alt` while functioning purely decoratively (the brand name is already in surrounding text/title). Minor, but worth aligning once the broken-path fix (#1) touches that same `<img>`.
16. `Services.astro` is "text-only cards, no icon slop" per its own comment, except exactly one item conditionally renders an SVG icon — inconsistent within the section itself.
17. Dropzone file-picker behavior (change handler, validation, error-state swap) is hand-rolled 3+ times (`nuevo.astro`, `folio.astro`'s add-sheet and replace-sheet) even though `ConfirmSheet.astro` already emits the shared markup for it — only the JS wiring isn't shared.
18. `.menu__list` (folio.astro's "⋯" menu) is a fixed 210px popover — will overflow near a viewport edge or a small screen; ties into #6.

## Low

19. Visual/spacing polish once the above lands: confirm the `.frow` left-border status reinforcement (`admin.css:283-289`) still reads correctly after any row-refactor; general pass for consistent spacing tokens usage across the older admin pages, which predate the manager surface's more careful token discipline.

## Domain question — flag, do not silently resolve

`status.js`'s `ACTIONS.UPLOADED` lists `"delete"`, but there is no button, menu item, or route anywhere that offers it. Employees currently have no way to remove a draft result before it's ever confirmed except "replace" (swap the PDF) — there's no "this was a mistake, remove it entirely" path. This may be intentional (replace covers the real case; a bare draft with no confirmed history is low-stakes enough to just leave and re-add correctly) or may be a genuine gap the table anticipated and the UI never got built for. **Not resolving this by adding a new delete flow in this pass** — it would touch the backend contract and is exactly the kind of domain-rule question the task says to document rather than decide unilaterally. Recorded here for the product owner.

## Implementation order

### A. Shared foundations (do first, once)
- `render.js`: add `setStatusLine(el, message, tone)`, `renderEmpty(el, title, sub)`, `patientCardNode(patient)` / `folioRowNode(folio)` helpers to replace the duplicated inline versions listed in items 9–10. Existing call sites migrate to these one at a time — no behavior change, pure consolidation, covered by the existing test suite for `render.js` plus new unit tests for the added exports.
- `AdminLayout.astro` + `Layout.astro` + `resultados.astro`: add a real skip-to-content link (`.vh` until `:focus`, jumps to `#main`/the page's main landmark). One shared CSS rule in `admin.css`'s equivalent for the public pages.
- Fix dialog focus-return: wherever a sheet is opened, store the trigger and call `.focus()` on its `close` event — one small shared pattern, applied at each of the 4 sheet call sites in `folio.astro` plus `nuevo.astro`'s dup-dialog.
- Fix the broken Hero logo path (`/clients/duolab/logo/logo-full.svg` → `/logo/logo-full.svg`), align its `alt` to `""` since the brand name is already textual elsewhere on the page.
- Required-field legend: add a single "* campo obligatorio" legend + `*` markers to `/admin/nuevo` and `/resultados` (the two real data-entry forms), consistent with `required` attributes already present on `/resultados` and added to `/admin/nuevo` (harmless since both are `novalidate`).
- `inputmode="tel"` added to `/admin/nuevo`'s phone field to match `/resultados`.

### B. Patient flow (`resultados.astro`)
- Align validation-error presentation with `/admin/nuevo`'s per-field pattern (item 4) — keep the existing masking/inputmode/autocomplete work already in place, just change *where* an error shows.
- Re-check contrast/hierarchy pass now that shared foundations exist; no structural change otherwise — this flow was already found to be the most mobile-considered of the bunch.

### C. Manager flow (`/admin/manager`)
- Already refined in the previous session (grouped queue, accessible tablist, publish-success screen, revoke warning). This pass only re-verifies it against the newly-added shared helpers (e.g. if `renderEmpty`/`setStatusLine` end up used there too) and re-runs the full QA script — no new structural work expected here unless the shared-foundations pass surfaces something.

### D. Employee flow (`/admin`, `/admin/buscar`, `/admin/nuevo`, `/admin/folio`, `/admin/revisar`, `/admin/paciente`)
- Migrate all six pages onto the new `render.js` helpers (removes items 9, 10).
- `/admin/folio`: enlarge the "⋯" menu's hit area (Fitts, item 5); consider promoting one more high-frequency action the same way "Confirm" was already promoted, without redesigning the menu itself.
- Add the baseline mobile fallback for `.frow`/`.menu__list` (item 6, 18) — wrap behavior at narrow widths, not a full mobile redesign (employees are desktop-first by explicit brief).
- Clean the stale doc comment (item 13).
- Consolidate the dropzone wiring (item 17) into one shared function reused by `nuevo.astro` and both of `folio.astro`'s file sheets.

### E. Landing
- Fix logo path (already done in foundations step, listed here for flow completeness).
- Heading hierarchy: verified already correct, no change (see retracted item 11).
- Resolve the one inconsistent icon in `Services.astro` — drop it (matches the section's own "text-only" comment) rather than adding icons to the rest, since the guidelines lean toward restraint.

## What shipped in this pass

Shared foundations, patient flow, employee flow and landing items above are implemented. Manager flow was re-verified against the new shared helpers and needed no changes (it was already refined in the prior session). Specifically:

- `render.js` gained `setStatusLine`, `folioRowNode`, `patientRowNode`, `fillPatientCard`; `index`/`buscar`/`paciente`/`folio`/`revisar` migrated onto them, removing the duplicated row/card/status builders (items 9, 10). `renderEmpty` was drafted but not adopted — each page's empty block hides different sibling sections, so a shared setter would have taken a per-page callback and saved nothing; the existing `showEmpty` closures stayed.
- Skip link added to `AdminLayout.astro`, `index.astro` (landing) and `resultados.astro`, with matching `#main` targets and a shared `.skip-link` rule per CSS scope (item 3).
- Dialog focus-return wired via each `<dialog>`'s native `close` event on `revoke-sheet`, `replace-sheet`, `add-sheet` (folio) and `dup-dialog` (nuevo), so Esc/backdrop dismissal returns focus too, not just the buttons (item 2).
- `Hero.astro`'s broken `/clients/duolab/logo/logo-full.svg` → `/logo/logo-full.svg`, `alt` aligned to `""` (items 1, 15).
- Required-field communication: `*` markers + `required` attributes + a "* campo obligatorio" legend on `/admin/nuevo` and `/resultados`; `inputmode="tel"` added to `/admin/nuevo`'s phone (items 7, 8).
- `/resultados` moved to per-field inline errors (`.err` + `aria-invalid`), marking *every* empty field rather than only the first, cleared per-field on input, with the status line kept as the summary (item 4).
- `.iconbtn` (the "⋯" toggle) 32px → 44px and `.menu__item` given a 44px floor; `.menu__list` capped at `90vw` (items 5, 18).
- `.frow` mobile fallback at ≤640px: wraps, tally drops to its own line, name un-truncates (items 6, 16 for `.frow`-adjacent).
- `Services.astro`'s single inconsistent SVG icon removed, matching the section's own text-only rule (item 16).
- Stale doc comments cleaned in `admin/index.astro` and `AdminLayout.astro` (items 13, 14).

Not done, deliberately: item 12 (the phantom `delete` action) is the documented domain question below; item 17 (dropzone wiring consolidation) and item 19 (spacing polish) were left as follow-ups — neither blocks a task, and item 17 in particular touches three upload paths whose failure modes are covered only by manual QA.

### Verification run

`vitest run` (153 passing, 8 files), `vitest --coverage` (statements 93.61 / branches 87.5 — both above the 85/75 floor, not lowered), `astro build` clean (9 pages). Headless-Chrome console check across `/`, `/resultados`, `/admin`, `/admin/buscar`, `/admin/nuevo`, `/admin/folio`, `/admin/paciente`, `/admin/manager`: no uncaught errors, `/admin` reaches its unhidden content state, `/admin/folio` renders the enlarged toggles and the skip link.

**Not verified, and not claimed:** no screen-reader pass was run (NVDA/VoiceOver), no automated contrast audit, and no real-device iPhone pass — `docs/06-quality.md`'s Flow D still needs to be run on hardware before the manager/employee mobile fallbacks are considered proven. WCAG 2.2 AA is the target these changes move toward; it is not a conformance claim.

## Verification (after each flow, and once at the end)

`pnpm --filter duolab check` (informational only — pre-existing untyped-`$()` errors across every admin page are not this pass's to fix and were already present before this session), `pnpm --filter duolab test`, `pnpm --filter duolab test:coverage` (85/75 floor, never lowered), `pnpm --filter duolab build`. Manual: keyboard-only pass over each changed page (tab order, focus visible, dialog open/close/return-focus), screen-reader spot check of the new skip link and any newly-added `aria-live`/labels, contrast check of Gris Texto in its actual contexts, long-name/long-filename overflow check, empty-list check per page, and — per `docs/06-quality.md` — the relevant manual QA script for whichever flow was touched.
