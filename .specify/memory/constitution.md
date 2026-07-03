<!--
Sync Impact Report
Version change: 1.3.0 → 1.4.0
Modified principles: none renamed
Added sections:
  - Design Anti-Slop Patterns for New Sections (new subsection under Development
    Workflow & Deployment; binding for any new page section — codifies specific
    prohibited generic-AI-template patterns for the How, Location, and WhatsApp
    float treatments introduced in this amendment's companion restructuring, and
    requires an /impeccable critique pass before any new section ships)
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (Constitution Check
    gate is dynamically derived from this file; no hardcoded principle text)
  - .specify/templates/spec-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/tasks-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/checklist-template.md ✅ no changes needed (generic)
  - specs/001-duolab-landing-page/tasks.md ⚠ updated in the same change set to
    reflect the Problem→FAQ replacement and the new How/Location/WhatsApp-float
    sections
  - README.md ⚠ pending (still the default Astro starter README; unrelated to
    this amendment)
Follow-up TODOs: none
-->

<!--
Sync Impact Report (v1.3.0, superseded above)
Version change: 1.2.0 → 1.3.0
Modified principles: none renamed
Added sections:
  - Copywriting Principles (new top-level section; binding for all copy
    generated in any feature spec — benefits-not-features, specific/action
    CTAs, one "pregunta que duele" hook per section, proof-over-claim, a ban
    on urgency/scarcity tactics for this healthcare-adjacent business, and a
    "¿y eso qué significa para mí?" test for every section)
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (Constitution Check
    gate is dynamically derived from this file; no hardcoded principle text)
  - .specify/templates/spec-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/tasks-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/checklist-template.md ✅ no changes needed (generic)
  - specs/001-duolab-landing-page/spec.md ✅ already compliant — approved copy
    is benefit-led, CTAs are intent-specific, no urgency/scarcity tactics
    present (verified against copy.md)
  - README.md ⚠ pending (still the default Astro starter README; unrelated to
    this amendment)
Follow-up TODOs: none
-->

<!--
Sync Impact Report (v1.2.0, superseded above)
Version change: 1.1.0 → 1.2.0
Modified principles: none renamed
Added sections:
  - Core Principle VII. No Medical Specialty Terminology in Output (new
    principle; formalizes a rule that had been informally appended to
    "Development Workflow & Deployment" without a version bump or rationale —
    this amendment corrects that governance gap)
Removed sections:
  - The ad-hoc paragraph under "Development Workflow & Deployment" banning
    "pediatría"/"pediatric"/"pediátrico" is removed from that section and
    superseded by Principle VII below (same rule, now properly governed)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (Constitution Check
    gate is dynamically derived from this file; no hardcoded principle text)
  - .specify/templates/spec-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/tasks-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/checklist-template.md ✅ no changes needed (generic)
  - specs/001-duolab-landing-page/spec.md ✅ already compliant — no medical
    specialty terms present (verified); structural prose already rewritten to
    English in a prior amendment cycle
  - README.md ⚠ pending (still the default Astro starter README; unrelated to
    this amendment)
Follow-up TODOs: none
-->

<!--
Sync Impact Report (v1.1.0, superseded above)
Version change: 1.0.0 → 1.1.0
Modified principles: none renamed
Added sections:
  - Core Principle VI. English for Code, Spanish for Client Content (new
    language convention principle)
Removed sections: none
Follow-up TODOs: none
-->

<!--
Sync Impact Report (v1.0.0, superseded above)
Version change: 0.0.0 (template) → 1.0.0
Modified principles: N/A (initial ratification — all 5 principles newly defined)
Added sections:
  - Core Principles I–V (Performance & Speed, Mobile-First Responsive Design,
    Accessibility (WCAG AA), Lean JS / No Heavy Frameworks, Reusable & White-Labelable
    Components)
  - SEO & Discoverability Requirements (Section 2)
  - Development Workflow & Deployment (Section 3)
  - Governance
Removed sections: none (placeholders only)
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): original adoption date unknown; set to the date this
    version was first written (2026-06-27) since no prior ratified constitution
    existed for this repository.
-->

# DuoLab Constitution

## Core Principles

### I. Performance & Speed (NON-NEGOTIABLE)

Every page MUST score above 90 on all Lighthouse categories (Performance,
Accessibility, Best Practices, SEO) and MUST achieve a fully interactive load
time under 3 seconds on a throttled mobile connection. Performance budgets are
checked before a feature is considered done, not retrofitted afterward: image
assets MUST be optimized and served in modern formats, fonts MUST be
subset/preloaded deliberately, and no script MUST block initial render unless
strictly required for above-the-fold functionality.

Rationale: These are conversion landing pages built for paying clients —
slow pages directly cost clients money through bounce rate and ad-spend
waste, so performance is a business requirement, not a nice-to-have.

### II. Mobile-First, Responsive by Default

All layout and styling work MUST start from the smallest viewport and scale
up via progressive enhancement (mobile-first media queries). No component
MUST be designed desktop-first and then "made responsive" after the fact.
Every shipped page MUST be manually verified at common mobile, tablet, and
desktop breakpoints before being marked complete.

Rationale: The majority of landing page traffic for client campaigns arrives
from mobile ads and social referrals; a desktop-first workflow systematically
produces a broken primary experience.

### III. Accessibility — WCAG AA Minimum (NON-NEGOTIABLE)

All pages and components MUST meet WCAG 2.1 AA at minimum: sufficient color
contrast, semantic HTML landmarks and heading order, keyboard-operable
interactive elements, visible focus states, and meaningful alt text /
ARIA labeling where semantic HTML alone is insufficient. Accessibility is
verified as part of the same review that checks Lighthouse scores, not as a
separate optional pass.

Rationale: Accessibility failures are both a legal/compliance risk for
clients and a direct Lighthouse score penalty, so treating it as optional
would silently violate Principle I as well.

### IV. Lean JavaScript — No Heavy Frameworks

Pages are built with Astro and plain JavaScript. React, Vue, Svelte, or any
other client-side UI framework MUST NOT be added as a rendering dependency
inside Astro components. Interactivity MUST be implemented with vanilla JS
(optionally Astro's built-in `<script>` islands) and MUST ship the minimum
JS required for the interaction — no framework runtime is acceptable simply
for convenience.

Rationale: Framework runtimes are the single biggest threat to the
performance budget in Principle I; for the simple interaction patterns these
landing pages need (forms, toggles, carousels), vanilla JS is sufficient and
keeps bundle size near zero.

### V. Reusable, White-Labelable Components

Astro components MUST be written to be reused across multiple client
projects, not hard-coded for a single client. Brand-specific values — colors,
typography, logos, spacing scales — MUST be parameterized via CSS custom
properties (design tokens) rather than hard-coded inside component markup or
styles. A new client engagement should be primarily a matter of swapping
token values and content, not rewriting components.

Rationale: This is an agency-style codebase serving many clients on the same
template family; without enforced parameterization, every new client
engagement degenerates into a one-off fork that can't receive shared fixes
or improvements.

### VI. English for Code, Spanish for Client Content

All code, code comments, variable/function/component names, file names, git
commit messages, specs, plans, and tasks MUST be written in English. Client
source documents under `stakeholders/<client>/` (briefings, buyer personas,
branding guides, offers, approved copy) remain in their original language —
typically Spanish — and MUST NOT be translated or rewritten as part of
engineering work. Visible landing page content (headlines, body copy, CTAs,
form labels) MUST stay in the language approved by the client in their copy
documents — typically Spanish for this market — reproduced as authored, not
paraphrased into English and back.

Rationale: This codebase serves a multi-client, English-language-maintained
template family (Principle V), so a consistent English engineering language
keeps components, commits, and specs reusable and reviewable regardless of
which language any given client's market speaks. Client-facing copy is the
opposite case — it was written and approved in the client's market language
specifically to speak to their buyer persona (per the approved copy
documents), and translating it would silently violate that approval and the
tone work already done.

### VII. No Medical Specialty Terminology in Output

Generated content, code, copy, comments, and specs MUST NOT use the word
"pediatría", "pediatric", "pediátrico", or any similar medical specialty
term — even though such terms appear freely in client source documents
(briefings, buyer personas, offers, approved copy). Where a source document
references a medical specialty, the generated output MUST abstract it (e.g.,
describe the audience or scenario — "children who are afraid of needles" —
rather than naming the specialty) or omit the reference entirely. This rule
applies to everything produced for the project — specs, plans, tasks, code,
comments, and any client-facing copy drafted or rewritten — but does NOT
apply to the client's own source files under `stakeholders/<client>/`, which
remain untouched per Principle VI.

Rationale: This is a standing client/business requirement, independent of
and orthogonal to any single feature's scope — it must hold for every piece
of generated output going forward, not just the content visible on one
landing page, so it is captured at the constitution level rather than
re-specified per feature.

## SEO & Discoverability Requirements

Every page MUST ship with: descriptive `<title>` and meta description tags,
complete Open Graph (and Twitter Card) metadata for social sharing previews,
and relevant JSON-LD schema markup (e.g., Organization, LocalBusiness, or
Product/Service schema as applicable to the client). Canonical URLs MUST be
set explicitly. These are mandatory for every page, not just the homepage,
since landing pages are frequently the sole entry point for a campaign and
must be independently discoverable and shareable.

## Copywriting Principles

These are binding for all copy generated in any feature spec — headlines, body
copy, CTAs, microcopy, form labels, and any drafted or rewritten client-facing
text:

- **Benefits, not features.** Copy MUST state what the reader gets, not what the
  business has. Never "contamos con equipo moderno"; always "tus resultados
  listos el mismo día".
- **Specific, action-oriented CTAs.** CTA labels MUST express intent and next
  step. Never a bare "Contactar" or "Más información" (and never "Contáctenos",
  per the client anti-references). Use "Escríbenos, te decimos qué llevar" or
  "Ver horarios y ubicación".
- **One "pregunta que duele" per section, maximum.** A section addressing a fear
  or objection MAY open with the reader's own painful question as its hook, but
  no more than one such hook per section — used sparingly so it lands rather
  than becoming a tic.
- **Proof over claim.** Copy MUST substantiate rather than assert. Never "somos
  los mejores"; always a concrete signal — years of operation, volume, or a
  specific differentiator.
- **No urgency or scarcity tactics.** Countdown timers, "solo por hoy",
  "últimos lugares", and similar pressure devices are banned. For a
  healthcare-adjacent business they break the trust the page exists to build;
  reassurance replaces urgency.
- **Answer "¿y eso qué significa para mí?" first.** Every section MUST make its
  relevance to the reader explicit before the reader has to ask — translate any
  fact or capability into what it means for them, in the same beat.

Rationale: These landing pages convert an anxious searcher into a conversation,
not a checkout. The failure modes are always the same — feature-listing,
generic CTAs, unsupported superlatives, and borrowed SaaS urgency — so the
guardrails against them belong at the constitution level, applied to every
feature's copy, rather than being re-argued per spec.

## Development Workflow & Deployment

The stack is fixed as Astro + vanilla JavaScript, deployed to Cloudflare
Pages — changes MUST NOT introduce an alternate build target or hosting
platform without a constitution amendment. Use `astro dev --background` for
local development per project tooling conventions, and verify Lighthouse
scores, responsive breakpoints, and accessibility before considering any page
or component complete. Each new client engagement MUST reuse existing shared
components and design-token patterns before introducing new one-off markup.

### Design Anti-Slop Patterns for New Sections

These prohibitions are binding for any new landing-page section, in addition
to DESIGN.md's general Do's and Don'ts. They exist because the specific
patterns below are the default output of generic page builders and AI
templates, and each one contradicts the "Calm Specialist" north star:

- **How-it-works / process sections.** MUST NOT use numbered circles
  (1, 2, 3) as the layout's organizing device. Use a timeline, staggered
  cards, or a visual metaphor instead — one where any icon used has to earn
  its place, not decorate a generic step.
- **Location sections.** MUST NOT use a card grid with emoji icons standing
  in for info (📍/🕐/📱ish boxes). Use an integrated layout instead — info in
  one column and an actual embedded map in the other, or an asymmetric
  two-column composition with real breathing room.
- **WhatsApp floating action buttons.** MUST NOT be a generic
  fixed-bottom-right circle present from page load with no other behavior.
  Either gate it behind a pulse/appearance triggered by scroll proximity to
  a CTA, or fold the action into the final-CTA section instead of floating
  it at all. A mobile-only float is acceptable if desktop already surfaces
  the CTA in the header.

Every new section MUST pass an `/impeccable` critique before it is
considered shippable — this is a distinct gate from the Lighthouse/WCAG/
responsive checks in Principle I and III, since it catches generic-template
smell that automated tooling cannot.

Rationale: DESIGN.md's Do's and Don'ts ban specific surface patterns
(gradient heroes, icon-card grids, uppercase eyebrows) but new section types
keep reintroducing the same generic-AI-template scaffolding in slightly
different guises (numbered circles instead of icon cards, floating buttons
instead of gradient heroes). Naming the specific failure modes for each new
section type, and requiring a dedicated critique pass, closes that gap
before it ships rather than catching it in a later redesign.

## Governance

This constitution supersedes any conflicting ad-hoc convention. Amendments
require: (1) a documented rationale for the change, (2) a version bump
following semantic versioning (MAJOR for incompatible governance/principle
removals or redefinitions, MINOR for new or materially expanded principles or
sections, PATCH for clarifications and wording fixes), and (3) propagation of
the change to any dependent templates (`.specify/templates/*.md`) in the same
change set. All feature plans MUST pass the Constitution Check gate defined
in `plan-template.md`; any deviation MUST be justified in that plan's
Complexity Tracking table or rejected. Compliance is reviewed at the same
time performance, accessibility, and SEO checks happen for each page —
there is no separate compliance-only review step.

**Version**: 1.4.0 | **Ratified**: 2026-06-27 | **Last Amended**: 2026-07-02
