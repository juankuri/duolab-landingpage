# Data Model: Landing Page de Conversión — DúoLab

This feature has no persistent storage (spec Key Entities: N/A). "Data model" here means the shape of the static content that `src/content/clients/duolab.js` exports and that the section components render — the editorial content schema, not a database schema.

## LandingContent (root export of `src/content/clients/duolab.js`)

| Field | Type | Notes |
|---|---|---|
| `business` | `BusinessInfo` | Name, address, hours, phone — feeds both visible copy and SEO schema |
| `whatsapp` | `WhatsAppConfig` | Base phone number + per-context prefilled messages |
| `seo` | `SeoMeta` | Title, description, OG image, canonical URL |
| `hero` | `HeroContent` | — |
| `problem` | `ProblemContent` | — |
| `solution` | `SolutionContent` | — |
| `socialProof` | `SocialProofContent` | — |
| `finalCta` | `FinalCtaContent` | — |

## BusinessInfo

| Field | Type | Notes |
|---|---|---|
| `name` | string | "DúoLab" |
| `addressLine` | string | "Frente a la Subestación CFE, San Manuel" |
| `city` | string | "Ciudad del Carmen, Campeche" |
| `hours` | `{ label: string, value: string }[]` | One entry per schedule line (Lun–Vie, Sábados, Domingos) |
| `yearsOfOperation` | number | `11` — drives FR-006 social-proof signal and SC-... claims; MUST be a verifiable figure provided by the client, not invented |
| `studyCount` | string | `"+50"` — same verifiability rule as `yearsOfOperation` |

## WhatsAppConfig

| Field | Type | Notes |
|---|---|---|
| `phoneNumber` | string | E.164-style digits for the `wa.me` link. **Placeholder until the client confirms the real number** (spec Assumptions) — build MUST fail or warn loudly if this is still the placeholder at deploy time (see [quickstart.md](./quickstart.md)) |
| `messages` | `{ context: string, text: string }[]` | One prefilled message per CTA context (hero, solution-section, final-cta), matching the texts already drafted in `copy.md` |

## SeoMeta

| Field | Type | Notes |
|---|---|---|
| `title` | string | — |
| `description` | string | — |
| `canonicalUrl` | string | — |
| `ogImage` | string | Path under `public/clients/duolab/` |

## HeroContent

| Field | Type | Notes |
|---|---|---|
| `eyebrow` | string | "11 años cuidando la salud de Ciudad del Carmen" |
| `headline` | string | MUST be the exact text from `copy.md` ("Tus análisis clínicos, con resultados en los que confías.") — spec FR-002, verbatim, no paraphrasing |
| `subheadline` | string | Supporting copy below the H1 |
| `primaryCtaMessageContext` | string | Key into `WhatsAppConfig.messages` for the hero's CTA |

## ProblemContent

| Field | Type | Notes |
|---|---|---|
| `eyebrow` | string | — |
| `headline` | string | — |
| `concerns` | `string[]` | The buyer-persona's own phrasing of each doubt/fear (cita, precio, trato a los niños, confianza en resultados) — spec FR-003 |

## SolutionContent

| Field | Type | Notes |
|---|---|---|
| `eyebrow` | string | — |
| `headline` | string | — |
| `offerPoints` | `string[]` | Direct answers to each `ProblemContent.concerns` entry — spec FR-004 |
| `childCareDifferentiator` | `{ headline: string, body: string, bullets: string[], ctaMessageContext: string }` | The experience-with-children differentiator, rendered with distinct visual prominence — spec FR-005. Content MUST avoid naming any medical specialty term (per standing content rule); describe the experience in plain, non-specialty language |

## SocialProofContent

| Field | Type | Notes |
|---|---|---|
| `trustSignals` | `{ value: string, label: string }[]` | Quantitative-only signals: years of operation, study count, same-day turnaround — spec FR-006 |
| `testimonials` | `Testimonial[] \| null` | **Null/empty until the client provides real, sourced reviews.** Rendering logic MUST omit the testimonial block entirely when this is empty, never substitute placeholder or generic quotes — spec FR-006, Clarifications session 2026-06-27 |

### Testimonial (only populated once sourced)

| Field | Type | Notes |
|---|---|---|
| `quote` | string | Verbatim from the real review |
| `author` | string | First name / initial, as the client approves for public display |
| `source` | string | e.g. "Google Maps" |
| `sourceUrl` | string \| null | Link to the original review, if available |

## FinalCtaContent

| Field | Type | Notes |
|---|---|---|
| `headline` | string | — |
| `subheadline` | string | — |
| `ctaMessageContext` | string | — |
| `microcopy` | string | Small reassurance line under the button, per `copy.md` |

## Validation rules (carried from spec Functional Requirements)

- `hero.headline` MUST equal the approved `copy.md` text exactly (FR-002).
- `socialProof.testimonials` MUST be `null`/empty rather than populated with non-verified content (FR-006).
- No field anywhere in this content model MUST contain bare pricing figures, the word "Contáctenos", or insurance/IMSS mentions (FR-010).
- No field anywhere in this content model MUST name a medical specialty term, even though such terms appear in the client's source docs (standing content rule — abstract or omit instead).
