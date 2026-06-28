# Quickstart: Landing Page de Conversión — DúoLab

## Prerequisites

- Node.js ≥22.12.0
- Dependencies installed: `npm install`

## Run locally

```bash
astro dev --background
```

Check status/logs with `astro dev status` / `astro dev logs`; stop with `astro dev stop` (per project convention in `AGENTS.md`/`CLAUDE.md`).

## Build & preview the static output

```bash
npm run build
npm run preview
```

`npm run build` is what Cloudflare Pages runs automatically on every push to `main`; running it locally first catches build-time errors before they reach deploy.

## Validation scenarios

Each scenario below maps to an acceptance scenario or success criterion in [spec.md](./spec.md).

### 1. Hero communicates value + CTA above the fold (FR-001, FR-002, SC-001)

- Open the page on a mobile viewport (≤390px wide) and a desktop viewport.
- Confirm the H1 text matches `copy.md` exactly: "Tus análisis clínicos, con resultados en los que confías."
- Confirm the primary WhatsApp CTA button is visible without scrolling on both viewports.

### 2. Problem section reflects the buyer persona's own language (FR-003)

- Confirm the section names: necesidad de cita, incertidumbre de precio, miedo al trato hacia los hijos, desconfianza en resultados — in plain language, no medical jargon.

### 3. Solution section answers each problem + highlights the children-experience differentiator (FR-004, FR-005)

- Confirm each concern from the Problem section has a corresponding answer here.
- Confirm the children-experience differentiator block has a visually distinct background and appears before the final CTA (User Story 1, Acceptance Scenario 1).
- Confirm no medical specialty term appears anywhere in this section's rendered text (standing content rule).

### 4. Social proof renders only verified signals (FR-006)

- If `src/content/clients/duolab.js`'s `socialProof.testimonials` is `null`/empty: confirm the rendered page shows **no** testimonial block — only the quantitative trust signals (years, study count, turnaround).
- If testimonials have been sourced and populated: confirm each one renders with its `source` attribution.

### 5. Final CTA reinforces without new information (FR-007)

- Confirm this section repeats the primary action and introduces no new claims not already stated earlier on the page.

### 6. WhatsApp CTAs work with and without WhatsApp installed (FR-008, Edge Cases)

- Click each CTA button; confirm it opens `https://wa.me/<number>?text=<context-appropriate message>`.
- On a device without WhatsApp installed, confirm the link falls back to WhatsApp Web (native `wa.me` behavior — no custom fallback code needed).

### 7. Pre-launch content gates (Assumptions)

- Confirm `WhatsAppConfig.phoneNumber` is **not** the placeholder value before this build is deployed to production.
- Confirm `socialProof.testimonials` is either `null` or contains only client-sourced, verifiable reviews — never generic/illustrative quotes.

### 8. Performance, accessibility, SEO gates (Constitution Principles I, III; SEO & Discoverability section)

```bash
npx lighthouse http://localhost:4321 --view
```

- Confirm Performance, Accessibility, Best Practices, and SEO scores are all ≥90.
- Confirm `<title>`, meta description, canonical link, Open Graph tags, and a `LocalBusiness` JSON-LD block are present in the rendered HTML `<head>`.
- Run an automated contrast check (e.g. axe DevTools) against the brand palette in `src/styles/clients/duolab.css`.

### 9. Mobile-first responsiveness (FR-012, SC-005)

- Verify at common breakpoints (≈360px, 768px, 1024px, 1440px) that no horizontal scroll or zoom is needed and all CTAs remain reachable.

## Expected outcome

All nine scenarios pass with no manual workaround required — at that point the feature is ready for client review and, once the real WhatsApp number and (optionally) real testimonials are sourced, ready to deploy.
