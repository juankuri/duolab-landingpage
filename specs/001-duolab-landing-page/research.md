# Phase 0 Research: Landing Page de Conversión — DúoLab

All Technical Context fields were already resolved by the user-provided stack notes and the project constitution; no `NEEDS CLARIFICATION` markers remained. The decisions below cover the implementation choices that still required picking an approach.

## Cloudflare Pages deployment target

- **Decision**: Use Astro's default static output (`output: 'static'`, the current default — no change needed in `astro.config.mjs`); no Cloudflare adapter (`@astrojs/cloudflare`) is added.
- **Rationale**: The page is fully static with no server-side rendering, API routes, or edge functions (spec FR-013: single static page, no backend). Cloudflare Pages serves a static `dist/` build directly; an SSR adapter would add an unnecessary runtime dependency and violate Principle IV's "ship the minimum JS/runtime required" spirit at the build-tooling level.
- **Alternatives considered**: `@astrojs/cloudflare` adapter for SSR — rejected, no server logic exists to justify it; can be added later only if a future feature (e.g., a contact form with server validation) needs it.

## WhatsApp CTA mechanism

- **Decision**: Plain `<a href="https://wa.me/<number>?text=<url-encoded-message>">` links, no JavaScript required to construct or trigger them. Each CTA instance gets its own pre-filled message string (matching the messages already drafted in `copy.md`), passed as a prop to a shared `WhatsAppButton.astro` component.
- **Rationale**: `wa.me` links work identically with or without WhatsApp installed (falls back to WhatsApp Web in-browser per spec Edge Cases), require zero client-side JS, and keep every CTA's behavior declarative and testable by reading the rendered HTML — satisfying Principle IV and keeping Lighthouse's "Best Practices"/performance score unaffected.
- **Alternatives considered**: A JS-driven click handler that builds the URL at runtime — rejected as unnecessary complexity; a contact form — explicitly out of scope per the user's stack note ("Formularios via [no estan contemplados en este alcance]") and spec Assumptions.

## Brand token architecture

- **Decision**: A generic, client-agnostic `src/styles/tokens.css` declares the custom-property *names* the components consume (`--color-primary`, `--color-primary-dark`, `--color-accent-soft`, `--color-bg`, `--text-primary`, `--text-secondary`, `--font-heading`, `--font-body`). A second file, `src/styles/clients/duolab.css`, assigns DúoLab's concrete values from `branding.md` to those same custom properties and is the only file imported by `Layout.astro` for this engagement.
- **Rationale**: Directly implements Constitution Principle V — section components reference only the generic token names, never DúoLab-specific values, so a future client only needs a new `clients/<name>.css` file plus new content, not component changes.
- **Alternatives considered**: Inlining hex values directly into component `<style>` blocks — rejected, would hard-code DúoLab branding into reusable components and violate Principle V outright.

## Font loading strategy

- **Decision**: Self-host the two required Plus Jakarta Sans weight ranges (the headline weights and the body weights called out in `branding.md`) as variable-font WOFF2 files under `public/clients/duolab/fonts/`, loaded via `@font-face` with `font-display: swap`, and preloaded in `Layout.astro`'s `<head>` for the weight used by the hero H1.
- **Rationale**: Self-hosting avoids a render-blocking third-party request to Google Fonts' CSS endpoint, which directly serves the <3s interactive / Lighthouse ≥90 budget in Principle I. `font-display: swap` avoids invisible-text flashes without blocking render.
- **Alternatives considered**: Linking Google Fonts' hosted CSS — rejected as an avoidable extra DNS/connection round-trip on a performance-budgeted page; using a system-font fallback only — rejected, branding.md mandates Plus Jakarta Sans as the single approved typeface.

## SEO / schema.org markup

- **Decision**: `Layout.astro` renders `LocalBusiness` JSON-LD schema (name, address, opening hours, telephone placeholder) plus standard meta description, canonical URL, and Open Graph/Twitter Card tags, populated from `src/content/clients/duolab.js`.
- **Rationale**: Directly required by the constitution's "SEO & Discoverability Requirements" section, and by `briefing.md`'s technical checklist (`schema.org LocalBusiness` for local SEO). Centralizing this data in the content file means it shares a single source of truth with the visible copy, avoiding drift between what's shown on-page and what's in the schema.
- **Alternatives considered**: Per-page manual meta tags with no JSON-LD — rejected, fails the constitution's explicit schema-markup mandate.

## Image handling

- **Decision**: Use Astro's built-in `<Image>` component (from `astro:assets`) for the lab photo and any section imagery, sourced from `public/clients/duolab/`, with explicit `width`/`height` and `alt` text supplied by the content file.
- **Rationale**: Automatic format conversion/optimization (WebP/AVIF) and explicit dimensions prevent layout shift and directly support the Lighthouse Performance and Accessibility gates (Principle I, III).
- **Alternatives considered**: Plain `<img>` tags with manually optimized assets — rejected as more error-prone to keep optimized over time; no measurable benefit over the built-in component for this scope.

**Output**: All Technical Context items resolved; no remaining `NEEDS CLARIFICATION` markers.
