<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles: none renamed
Added sections:
  - Core Principle VI. English for Code, Spanish for Client Content (new
    language convention principle)
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed (Constitution Check
    gate is dynamically derived from this file; no hardcoded principle text)
  - .specify/templates/spec-template.md ✅ no changes needed (stack-agnostic,
    language-agnostic)
  - .specify/templates/tasks-template.md ✅ no changes needed (stack-agnostic)
  - .specify/templates/checklist-template.md ✅ no changes needed (generic)
  - specs/001-duolab-landing-page/spec.md ⚠ pending (written before this
    amendment; its structural prose — titles, user stories, requirements — is
    in Spanish, not English. Needs a rewrite pass to English prose while
    keeping quoted client copy/CTAs in Spanish verbatim, to comply with this
    principle)
  - README.md ⚠ pending (still the default Astro starter README; unrelated to
    this amendment)
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

## SEO & Discoverability Requirements

Every page MUST ship with: descriptive `<title>` and meta description tags,
complete Open Graph (and Twitter Card) metadata for social sharing previews,
and relevant JSON-LD schema markup (e.g., Organization, LocalBusiness, or
Product/Service schema as applicable to the client). Canonical URLs MUST be
set explicitly. These are mandatory for every page, not just the homepage,
since landing pages are frequently the sole entry point for a campaign and
must be independently discoverable and shareable.

## Development Workflow & Deployment

The stack is fixed as Astro + vanilla JavaScript, deployed to Cloudflare
Pages — changes MUST NOT introduce an alternate build target or hosting
platform without a constitution amendment. Use `astro dev --background` for
local development per project tooling conventions, and verify Lighthouse
scores, responsive breakpoints, and accessibility before considering any page
or component complete. Each new client engagement MUST reuse existing shared
components and design-token patterns before introducing new one-off markup.

Do NOT use the word "pediatría", "pediatric", "pediátrico" 
or any similar medical specialty terms in any generated content, code, 
copy, or specs. These words appear in the source docs but must NOT 
carry over to any output. If the docs reference a medical specialty, 
abstract it or omit it.

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

**Version**: 1.1.0 | **Ratified**: 2026-06-27 | **Last Amended**: 2026-06-27
