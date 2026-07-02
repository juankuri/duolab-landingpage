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

- [ ] T026 [P] Verify `Layout.astro`'s `LocalBusiness` JSON-LD and meta/OG tags render correctly with the populated `business`/`seo` content (constitution SEO & Discoverability Requirements)
- [ ] T027 [P] Replace the lab photo placeholder with Astro's `<Image>` component (`astro:assets`) wherever imagery is used in `src/components/landing/`, with explicit `width`/`height`/`alt`
- [ ] T028 Apply branding.md logo usage rules (minimum size, safe area, permitted backgrounds) wherever the logo renders in `Layout.astro` and `Hero.astro` (spec FR-011)
- [ ] T029 Run `npx lighthouse http://localhost:4321 --view` and fix any Performance/Accessibility/Best Practices/SEO score below 90 (constitution Principle I, III)
- [ ] T030 Run an automated contrast check (e.g. axe DevTools) against `src/styles/clients/duolab.css` and fix any WCAG AA contrast failure (constitution Principle III)
- [ ] T031 Verify mobile-first responsiveness at ≈360px, 768px, 1024px, 1440px with no horizontal scroll/zoom (spec FR-012, SC-005)
- [ ] T032 Confirm `whatsapp.phoneNumber` in `src/content/clients/duolab.js` has been replaced with the client's real number before any production deploy (spec Assumptions)
- [ ] T033 Run the full quickstart.md validation guide end to end and record results before requesting client review
- [ ] T034 Connect the repository's `main` branch to a Cloudflare Pages project for automatic deploy-on-push, per the user-provided stack decision

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
