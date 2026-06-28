# Component Contracts: Landing Page de Conversión — DúoLab

This project has no network API. The "interfaces" worth contracting are the prop shapes each section component accepts — this is what makes the components reusable across future clients (Constitution Principle V): a new client engagement implements these same contracts with new content, never new component logic.

## `WhatsAppButton.astro`

| Prop | Type | Required | Notes |
|---|---|---|---|
| `phoneNumber` | string | yes | E.164-style digits, no `+` or spaces |
| `message` | string | yes | Already URL-encodable plain text; component handles `encodeURIComponent` |
| `label` | string | yes | Visible button text |
| `variant` | `"primary" \| "outline"` | no, default `"primary"` | Maps to brand token classes, never hard-coded colors |

Renders a single `<a href="https://wa.me/{phoneNumber}?text={encoded(message)}">`. No JavaScript required.

## `Hero.astro`

| Prop | Type | Required |
|---|---|---|
| `eyebrow` | string | yes |
| `headline` | string | yes |
| `subheadline` | string | yes |
| `cta` | `{ phoneNumber: string, message: string, label: string }` | yes |
| `secondaryCta` | `{ href: string, label: string }` | no |

Contract: the component MUST render `headline` verbatim, with no text transformation (no truncation, no casing changes) — enforces spec FR-002.

## `Problem.astro`

| Prop | Type | Required |
|---|---|---|
| `eyebrow` | string | yes |
| `headline` | string | yes |
| `concerns` | `string[]` | yes |

## `Solution.astro`

| Prop | Type | Required |
|---|---|---|
| `eyebrow` | string | yes |
| `headline` | string | yes |
| `offerPoints` | `string[]` | yes |
| `childCareDifferentiator` | `{ headline: string, body: string, bullets: string[], cta: { phoneNumber: string, message: string, label: string } }` | yes |

Contract: `childCareDifferentiator` MUST render with a visually distinct treatment (e.g. a dedicated background) from the rest of the section — enforces spec FR-005.

## `SocialProof.astro`

| Prop | Type | Required |
|---|---|---|
| `trustSignals` | `{ value: string, label: string }[]` | yes |
| `testimonials` | `Testimonial[] \| null` | yes (explicit, may be `null`) |

Contract: when `testimonials` is `null` or an empty array, the component MUST NOT render any testimonial block, placeholder, or generic quote — enforces spec FR-006. This is a hard branch, not a default-content fallback.

## `FinalCta.astro`

| Prop | Type | Required |
|---|---|---|
| `headline` | string | yes |
| `subheadline` | string | yes |
| `cta` | `{ phoneNumber: string, message: string, label: string }` | yes |
| `microcopy` | string | no |

## `Layout.astro`

| Prop | Type | Required |
|---|---|---|
| `seo` | `SeoMeta` (see [data-model.md](../data-model.md)) | yes |
| `business` | `BusinessInfo` (see [data-model.md](../data-model.md)) | yes |

Contract: MUST emit `<title>`, meta description, canonical link, Open Graph/Twitter Card tags, and a `LocalBusiness` JSON-LD `<script type="application/ld+json">` block built from `business` — enforces the constitution's SEO & Discoverability Requirements section.
