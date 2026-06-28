# Implementation Plan: DúoLab Conversion Landing Page

**Branch**: `001-duolab-landing-page` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-duolab-landing-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A single static, mobile-first landing page for DúoLab (a clinical lab in Ciudad del Carmen) with five sections — hero, problem, solution, social proof, final CTA — whose sole conversion goal is getting the visitor to talk to a specialist over WhatsApp. Built with Astro and vanilla JavaScript only, deployed statically to Cloudflare Pages on every push to `main`. All visible copy is reproduced verbatim from the client's approved `copy.md`; brand colors/typography come from `branding.md` via CSS custom properties so the same section components can be reused for future clients.

## Technical Context

**Language/Version**: Astro 7.0.3 (JavaScript, no TypeScript at runtime; `tsconfig.json` is editor-tooling only per the default Astro scaffold), Node.js ≥22.12.0

**Primary Dependencies**: Astro core only — no `@astrojs/react`, `@astrojs/vue`, or any other UI-framework integration (Constitution Principle IV)

**Storage**: N/A — fully static content, no database, no CMS

**Testing**: No automated unit/integration test framework (justified: no business logic, just static markup/content composition). Validation is manual: Lighthouse audit (Performance/Accessibility/Best Practices/SEO ≥90), cross-browser/cross-device check, and a content/copy fidelity review against `copy.md` — see [quickstart.md](./quickstart.md)

**Target Platform**: Cloudflare Pages (static hosting, no adapter/SSR needed), modern evergreen browsers + Safari iOS, mobile-first

**Project Type**: Web — single static frontend project (no backend, no API)

**Performance Goals**: Lighthouse ≥90 in all four categories; fully interactive in <3s on a throttled mobile connection (Constitution Principle I, spec SC-005)

**Constraints**: No client-side JS framework runtime (Principle IV); brand values MUST be CSS custom properties, not hard-coded (Principle V); WCAG 2.1 AA minimum (Principle III); mobile-first layout (Principle II); single static page, no auth/backend (spec FR-013); all code/file/component names in English, all visible copy in Spanish exactly as approved (Principle VI)

**Scale/Scope**: One route (`/`), five sections, built as reusable components so a second client engagement is mostly new content + new token values, not new components (Principle V)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Performance & Speed | Static Astro output, no framework runtime, optimized images via Astro `<Image>`, font preloading | PASS — design has no heavy dependency that would block this |
| II. Mobile-First, Responsive | All section components authored mobile-first per spec FR-012 | PASS |
| III. Accessibility — WCAG AA | Semantic landmarks per section, contrast checked against branding.md palette, focus-visible states on CTA buttons | PASS — verified in quickstart.md manual checklist |
| IV. Lean JavaScript | Only the WhatsApp link (`<a href>`) and at most a tiny vanilla `<script>` for any mobile-nav toggle; no UI framework added | PASS |
| V. Reusable, White-Labelable Components | Section components (`Hero.astro`, `Problem.astro`, etc.) take content as props/slots, not hard-coded DúoLab text; brand tokens isolated in a per-client CSS file | PASS |
| VI. English for Code, Spanish for Client Content | All file/component/variable names in English; client copy file holds the Spanish text verbatim from `copy.md` | PASS — see naming resolution below |
| VII. No Medical Specialty Terminology in Output | `childCareDifferentiator` content (data-model.md) and all component contracts describe the children-care experience without naming any medical specialty | PASS — verified, no such term appears anywhere in spec.md, data-model.md, or contracts/ |

**Naming resolution**: The original stack note used `/public/clientes/[nombre]/` (Spanish). Per user decision, this plan uses `/public/clients/[name]/` (English) to comply with Principle VI; no exception needed.

No violations — Complexity Tracking table is not needed for this plan.

**Post-Phase 1 re-check**: data-model.md and contracts/component-props.md introduce no new dependency, no UI framework, no hard-coded brand values, and no English/Spanish boundary violation. All six gates above remain PASS after design.

## Project Structure

### Documentation (this feature)

```text
specs/001-duolab-landing-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
public/
└── clients/
    └── duolab/
        ├── logo.svg
        ├── logo-white.svg
        └── lab-photo.jpg          # placeholder until the client provides a real photo

src/
├── components/
│   └── landing/
│       ├── Hero.astro
│       ├── Problem.astro
│       ├── Solution.astro
│       ├── SocialProof.astro
│       ├── FinalCta.astro
│       └── WhatsAppButton.astro   # shared CTA, takes a phone number + prefilled message as props
├── content/
│   └── clients/
│       └── duolab.js              # single source of truth for DúoLab's approved copy + WhatsApp messages (FR-002, FR-006, FR-009, FR-010)
├── layouts/
│   └── Layout.astro               # <head> meta/OG/schema.org markup, imports brand tokens
├── pages/
│   └── index.astro                # composes the five landing sections using src/content/clients/duolab.js
└── styles/
    ├── tokens.css                 # generic token contract (--color-primary, --font-heading, --font-body, etc.)
    └── clients/
        └── duolab.css             # DúoLab's concrete token values from branding.md
```

**Structure Decision**: Single static Astro project (no backend, no monorepo split). Section components live under `src/components/landing/` and are written generically (content via props/slots) so they are reusable for the next client engagement per Principle V. DúoLab-specific copy and brand tokens are isolated into their own files (`src/content/clients/duolab.js`, `src/styles/clients/duolab.css`) rather than inlined into the components, so swapping clients later means adding new content/token files, not editing component markup.

## Complexity Tracking

> No violations recorded — this section is intentionally empty.
