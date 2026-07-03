---

description: "Task list template for feature implementation"
---

# Tasks: DúoLab Conversion Landing Page

**Input**: Design documents from `/specs/001-duolab-landing-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/component-props.md, quickstart.md

**Tests**: No automated test tasks — per plan.md's Technical Context, this feature has no automated test framework; validation is manual via `quickstart.md`'s 9 scenarios (Lighthouse, accessibility, content fidelity).

**Organization**: Tasks are grouped by user story (per spec.md priorities P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to the repository root, per plan.md's Project Structure

## Path Conventions

Single static Astro project (no backend). All paths under `src/`, `public/clients/duolab/`, per plan.md.

---

## Phase 1: Setup

**Purpose**: Project scaffolding shared by every section/story

- [X] T001 Create the directory structure from plan.md: `public/clients/duolab/`, `src/components/landing/`, `src/content/clients/`, `src/styles/clients/`
- [X] T002 [P] Create the generic brand token contract in `src/styles/tokens.css` (custom property names only: `--color-primary`, `--color-primary-dark`, `--color-accent-soft`, `--color-bg`, `--text-primary`, `--text-secondary`, `--font-heading`, `--font-body`) per research.md's brand-token-architecture decision
- [X] T003 [P] Create DúoLab's concrete token values in `src/styles/clients/duolab.css`, assigning branding.md's hex codes (`#6B4A8E`, `#4A3163`, `#B89DCE`, `#EDE8F5`, `#142129`, `#5A6472`) and Plus Jakarta Sans to the token names from T002
- [X] T004 [P] Self-host the Plus Jakarta Sans WOFF2 weights under `public/clients/duolab/fonts/` and add `@font-face` rules with `font-display: swap` in `src/styles/clients/duolab.css`, per research.md's font-loading decision

**Checkpoint**: Token and font infrastructure ready for any component to consume

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared component/content infrastructure that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create the shared `WhatsAppButton.astro` component in `src/components/landing/WhatsAppButton.astro` per contracts/component-props.md (props: `phoneNumber`, `message`, `label`, `variant`; renders a single `wa.me` link, no JS)
- [X] T006 Create `src/layouts/Layout.astro` per contracts/component-props.md: imports `src/styles/clients/duolab.css`, renders `<title>`, meta description, canonical link, Open Graph/Twitter Card tags, and a `LocalBusiness` JSON-LD block from its `seo`/`business` props
- [X] T007 Create the content skeleton `src/content/clients/duolab.js` exporting the `LandingContent` shape from data-model.md, populated with `business` (name, address, hours, years, study count from offer.md/briefing.md) and `seo` fields; set `whatsapp.phoneNumber` to an explicit placeholder value and `whatsapp.messages` to the message texts from copy.md
- [X] T008 Create `src/pages/index.astro` that imports `Layout.astro` and `src/content/clients/duolab.js`, passing `seo`/`business` to the layout (no section components yet — wired in per-story below)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Mother with young children looking for a trustworthy lab (Priority: P1) 🎯 MVP

**Goal**: A visitor like Carla can, from the hero through the solution section, recognize her own doubts reflected in the copy, see the children-care differentiator with visual prominence, and reach a working WhatsApp CTA — without leaving the page.

**Independent Test**: Show the page to someone matching this persona; confirm they identify (a) what DúoLab offers, (b) that it serves children with experience, (c) that no appointment is needed, and (d) how to contact a specialist, unaided.

### Implementation for User Story 1

- [X] T009 [P] [US1] Add `hero` content (verbatim headline from copy.md: "Tus análisis clínicos, con resultados en los que confías.", eyebrow, subheadline, CTA message key) to `src/content/clients/duolab.js`
- [X] T010 [P] [US1] Add `problem` content (`concerns` array in the buyer persona's own phrasing: cita, precio, trato a los hijos, confianza en resultados) to `src/content/clients/duolab.js`
- [X] T011 [P] [US1] Add `solution` content, including `childCareDifferentiator` (headline, body, bullets, CTA message key) without naming any medical specialty term, to `src/content/clients/duolab.js`
- [X] T012 [US1] Create `Hero.astro` in `src/components/landing/Hero.astro` per contracts/component-props.md (renders `headline` verbatim, no text transformation; uses `WhatsAppButton`)
- [X] T013 [US1] Create `Problem.astro` in `src/components/landing/Problem.astro` per contracts/component-props.md
- [X] T014 [US1] Create `Solution.astro` in `src/components/landing/Solution.astro` per contracts/component-props.md, giving `childCareDifferentiator` a visually distinct background per spec FR-005
- [X] T015 [US1] Compose `Hero`, `Problem`, `Solution` into `src/pages/index.astro`, passing content from `src/content/clients/duolab.js`
- [X] T016 [US1] Run quickstart.md scenarios 1–3 manually on mobile and desktop viewports; fix any mismatch against copy.md/spec FR-001–FR-005. Confirm none of FR-010's excluded phrases appear in any rendered content.

**Checkpoint**: User Story 1 is fully functional and independently testable — hero, problem, and solution sections work end to end with a live WhatsApp CTA

---

## Phase 4: User Story 2 - Adult who keeps putting off their health needs a quick resolution (Priority: P2)

**Goal**: A visitor like Roberto, without reading the children-focused content, still finds clear trust signals and a jargon-free final CTA.

**Independent Test**: Show the page to someone without small children; confirm they find quantitative trust signals and a clear "talk to a specialist" CTA without needing the children-care section.

### Implementation for User Story 2

- [X] T017 [P] [US2] Add `socialProof.trustSignals` content (years of operation, study count, same-day turnaround) to `src/content/clients/duolab.js`
- [X] T018 [P] [US2] Add `finalCta` content (headline, subheadline, CTA message key, microcopy) to `src/content/clients/duolab.js`
- [X] T019 [US2] Create `SocialProof.astro` in `src/components/landing/SocialProof.astro` per contracts/component-props.md, rendering `trustSignals`; accept a `testimonials` prop but render nothing for it yet (depends on T017)
- [X] T020 [US2] Create `FinalCta.astro` in `src/components/landing/FinalCta.astro` per contracts/component-props.md (depends on T018)
- [X] T021 [US2] Compose `SocialProof` and `FinalCta` into `src/pages/index.astro`, after the Solution section
- [X] T022 [US2] Run quickstart.md scenarios 4–5 manually; confirm copy has no medical jargon and the final CTA introduces no new claims. Confirm none of FR-010's excluded phrases appear in any rendered content.

**Checkpoint**: User Stories 1 AND 2 both work independently — the full page now has all five sections

---

## Phase 5: User Story 3 - Visitor comparing options before deciding looks for social validation (Priority: P3)

**Goal**: The social-proof section alone communicates at least two concrete trust signals, and is ready to display real testimonials once the client sources them — never generic/placeholder quotes.

**Independent Test**: Viewing only the social-proof section in isolation, confirm at least two concrete trust signals are identifiable (e.g. "11 años de experiencia", "+50 estudios disponibles").

### Implementation for User Story 3

- [X] T023 [US3] Add `socialProof.testimonials: null` (with the `Testimonial` shape documented from data-model.md ready to populate later) to `src/content/clients/duolab.js`
- [X] T024 [US3] Update `SocialProof.astro` (`src/components/landing/SocialProof.astro`) so that when `testimonials` is `null`/empty it renders no testimonial block at all, and when populated it renders each with its `source` attribution — per the hard branch in contracts/component-props.md (depends on T019, T023)
- [X] T025 [US3] Run quickstart.md scenario 4's both branches (empty and populated `testimonials`) and confirm no placeholder/generic quote ever renders

**Checkpoint**: All three user stories are independently functional — the page is feature-complete pending real content (WhatsApp number, testimonials)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution-mandated gates that span all sections, plus pre-launch content checks

- [X] T026 [P] Verify `Layout.astro`'s `LocalBusiness` JSON-LD and meta/OG tags render correctly with the populated `business`/`seo` content (constitution SEO & Discoverability Requirements)
- [X] T027 [P] Replace the lab photo placeholder with Astro's `<Image>` component (`astro:assets`) wherever imagery is used in `src/components/landing/`, with explicit `width`/`height`/`alt`
- [X] T028 Apply branding.md logo usage rules (minimum size, safe area, permitted backgrounds) wherever the logo renders in `Layout.astro` and `Hero.astro` (spec FR-011)
- [X] T029 Run `npx lighthouse http://localhost:4321 --view` and fix any Performance/Accessibility/Best Practices/SEO score below 90 (constitution Principle I, III)
- [X] T030 Run an automated contrast check (e.g. axe DevTools) against `src/styles/clients/duolab.css` and fix any WCAG AA contrast failure (constitution Principle III)
- [X] T031 Verify mobile-first responsiveness at ≈360px, 768px, 1024px, 1440px with no horizontal scroll/zoom (spec FR-012, SC-005)
- [X] T032 Confirm `whatsapp.phoneNumber` in `src/content/clients/duolab.js` has been replaced with the client's real number before any production deploy (spec Assumptions)
- [X] T033 Run the full quickstart.md validation guide end to end and record results before requesting client review
- [ ] T034 Connect the repository's `main` branch to a Cloudflare Pages project for automatic deploy-on-push, per the user-provided stack decision

---

## Phase 7: Restructure — FAQ, How, Location, WhatsApp Float (post-launch content expansion)

**Purpose**: Reworks the page flow using `poc/duolab.html` (stakeholders/isabel/duolab.html) as the
visual reference, per constitution v1.4.0's Design Anti-Slop Patterns for New Sections. Replaces
Problem with an FAQ section (spec FR-007 intent) and adds How, Location, and a WhatsApp float —
none of which may use the generic patterns (numbered circles, emoji card grids, always-on floating
buttons) the constitution amendment now explicitly bans.

- [X] T035 Amend `.specify/memory/constitution.md` to v1.4.0: add "Design Anti-Slop Patterns for
  New Sections" under Development Workflow & Deployment, with a Sync Impact Report entry
- [X] T036 [P] Add `faq` content to `src/content/clients/duolab.js` (copy.md SECCIÓN 6 verbatim,
  except the last answer's "toma de muestras pediátricas" abstracted to "toma de muestras a niños"
  per Constitution Principle VII); remove the now-unused `problem` content block
- [X] T037 [P] Add `how` content (copy.md SECCIÓN 5: 3 steps + fine-print note) to
  `src/content/clients/duolab.js`
- [X] T038 [P] Add `location` content (eyebrow/headline only — reuses the existing `business` block
  for address/hours) to `src/content/clients/duolab.js`
- [X] T039 Create `Faq.astro` in `src/components/landing/Faq.astro`: native `<details>/<summary>`
  accordion (no JS required), single readable column with hairline dividers — no card grid
- [X] T040 Create `How.astro` in `src/components/landing/How.astro`: vertical timeline with a
  connecting rail and plain dot markers — explicitly NOT numbered circles (constitution v1.4.0)
- [X] T041 Create `Location.astro` in `src/components/landing/Location.astro`: asymmetric
  two-column layout, info left, a real embedded Google Maps iframe (`?output=embed`, no API key)
  right — explicitly NOT an emoji-icon card grid (constitution v1.4.0)
- [X] T042 Create `WhatsAppFloat.astro` in `src/components/landing/WhatsAppFloat.astro`:
  mobile-only (`max-width: 767px`), hidden until scrolled past the hero, single pulse on first
  reveal via vanilla JS scroll listener — never a looping animation or an always-on desktop float
  (constitution v1.4.0)
- [X] T043 Remove `src/components/landing/Problem.astro` (superseded by Faq.astro; no longer
  composed into the page)
- [X] T044 Restructure `src/pages/index.astro` to the new section order: Header → Hero → Faq →
  Solution (+ its existing child-care differentiator panel) → How → Location → SocialProof →
  FinalCta → Footer → WhatsAppFloat
- [X] T045 Run `npx astro build` and a structural smoke test of the rendered HTML to confirm the
  new section order, all FAQ items/timeline steps render, and the map iframe embeds the real
  business address
- [X] T046 Run an `/impeccable audit` pass against Faq.astro, How.astro, Location.astro, and
  WhatsAppFloat.astro (constitution v1.4.0 requirement — distinct from the Lighthouse/WCAG/
  responsive gates in Phase 6); scored 20/20 after adding a missing `:focus-visible` style to
  WhatsAppFloat.astro (the only real finding)
- [X] T047 Re-run quickstart.md's Lighthouse, WCAG AA, and responsive checks (Phase 6 gates) against
  the restructured page. Lighthouse (production `astro preview` build): **100/100/100/100 on both
  mobile and desktop** (LCP 1.1s, TBT 0ms, CLS 0). WCAG AA contrast: all pairs pass — Gris Texto body
  6.0 on white / 5.44 on Fondo Suave; Azul accent 3.35 on white (large/bold trust values, ≥3:1 met).
  Responsive: 0 horizontal overflow — all new-section grids are fractional or gated ≥768px, no fixed
  widths, corroborated by CLS 0.

## Phase 8: Blue accent (client request)

**Purpose**: The client asked for the PoC's blue (#318BFF). Added as a functional/informational
accent only (data-point highlight + small icons), NOT a second brand color — the One Purple Rule is
amended, not broken.

- [X] T048 Add the three PoC blue tones to `src/styles/clients/duolab.css` as `--color-accent`
  (#318BFF), `--color-accent-soft` (#59ADFF), `--color-accent-lite` (#EEF6FF). Blue lives only in the
  client file; `tokens.css` is untouched (client-agnostic contract)
- [X] T049 Document "Accent (functional, not brand)" in `DESIGN.md` and amend "The One Purple Rule"
  → "The One Purple Rule (with one functional exception)"; add matching Do/Don't entries scoping blue
  to fact-marking (never CTAs, links, section grounds, or body text)
- [X] T050 Apply the blue accent in `SocialProof.astro`: each trust signal gains an optional `accent`
  substring rendered in Azul (mirrors the PoC trust bar). Seated the signals in a white panel on the
  Lila Claro ground so the blue clears AA (3.35:1 on white vs. failing 2.79:1 on Lila Claro) — also
  matches the PoC's white trust bar and DESIGN.md's card-on-tinted-section rule

**Checkpoint**: Page reflects the PoC-informed restructure + the client's blue accent, and passes all
Phase 6 gates (Lighthouse/WCAG/responsive) plus the v1.4.0 impeccable critique. Ready for client
review; remaining pre-production items are unchanged (T034 Cloudflare Pages, real testimonials,
confirmed domain).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — no dependency on other stories
- **User Story 2 (Phase 4)**: Depends on Foundational; shares `src/pages/index.astro` with US1 but adds independent sections
- **User Story 3 (Phase 5)**: Depends on Foundational and on `SocialProof.astro` existing (T019, from US2) — extends it rather than duplicating it
- **Polish (Phase 6)**: Depends on all three user stories being complete. T028 (logo rules) specifically depends on `Layout.astro` (T006) and `Hero.astro` (T012) already existing, which is why it lives here rather than in Setup.

### Within Each User Story

- Content tasks (`src/content/clients/duolab.js` additions) before the component that consumes them
- Components before composing them into `src/pages/index.astro`
- Manual quickstart validation last

### Parallel Opportunities

- T002, T003, T004 (Setup) can run in parallel
- T009, T010, T011 (US1 content) can run in parallel — different fields, same file but non-overlapping sections; coordinate if editing concurrently
- T017, T018 (US2 content) can run in parallel
- T026, T027 (Polish) can run in parallel. T028 touches `Layout.astro` and `Hero.astro`, which overlaps T026's edits to `Layout.astro` — run T028 after T026, not in parallel with it.

---

## Parallel Example: User Story 1

```bash
# Content additions for User Story 1 (coordinate edits to the same file):
Task: "Add hero content to src/content/clients/duolab.js"
Task: "Add problem content to src/content/clients/duolab.js"
Task: "Add solution content to src/content/clients/duolab.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md scenarios 1–3 against the live page
5. Share preview deploy with the client for early feedback

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → MVP preview
3. Add User Story 2 → validate independently → fuller preview
4. Add User Story 3 → validate independently → feature-complete page
5. Phase 6 Polish → Lighthouse/a11y/SEO gates → ready for real content (WhatsApp number, testimonials) and production deploy

---

## Notes

- [P] tasks touch different files (or clearly separable regions of the same content file) and have no completion-order dependency
- [Story] label maps each task to its user story for traceability back to spec.md
- No automated tests exist for this feature — quickstart.md is the validation mechanism
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
- T032 (real WhatsApp number) and T023's real-testimonial readiness are the two pre-launch content gates carried over from spec.md's Assumptions — do not deploy to production until both are resolved with the client
