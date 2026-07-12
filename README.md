# DúoLab — Conversion Landing Page

A static landing page for a real clinical lab in Ciudad del Carmen. Its sole job: help a first-time visitor understand what the lab offers and start a WhatsApp conversation.

## Overview

- **What:** Static landing page, conversion goal: "contact us via WhatsApp"
- **Why:** Lab's outdated online presence left no clear path for patients to reach them
- **Stack:** Astro (static), vanilla JS, Cloudflare Pages, no backend/database
- **Key insight:** Choosing the tool from the *actual requirements* beats defaulting to the popular framework
- **Reuse model:** Brand values and copy isolated (`styles/clients/duolab.css`, `content/clients/duolab.js`); components stay generic
- **Not:** an app, CMS, or portal — those are deliberately postponed

## Architecture

A single static Astro project — no backend, no API. Core idea: **isolate everything client-specific (copy, brand, tokens) into dedicated files; keep components generic.**

```text
src/
├── components/
│   └── landing/            # Generic section components — content comes in as props
│       ├── Header.astro
│       ├── Hero.astro
│       ├── Faq.astro
│       ├── Solution.astro
│       ├── How.astro
│       ├── Location.astro
│       ├── SocialProof.astro
│       ├── FinalCta.astro
│       ├── Footer.astro
│       ├── WhatsAppButton.astro   # Shared CTA: phone + prefilled message as props
│       └── WhatsAppFloat.astro
├── content/
│   └── clients/
│       └── duolab.js       # Single source of truth for this client's copy + config
├── layouts/
│   └── Layout.astro        # Document shell: SEO meta, JSON-LD, font preload
├── pages/
│   └── index.astro         # Composes the sections from the content file
└── styles/
    ├── tokens.css          # Generic token contract: names + neutral fallbacks
    └── clients/
        └── duolab.css      # This client's real brand values, mapped onto those names
```

**Why this matters:**
- Components reference token *names* (`--color-primary`, `--font-heading`), never hard-code brand.
- Copy, SEO metadata, and structured data feed from one `duolab.js` — they can't drift apart.

## Tech decisions

| Decision | Tradeoff |
|---|---|
| **Static-first, no backend** | No server, no auth, no database. Validates the MVP goal (just get a patient talking to the lab). |
| **Astro components, no SPA** | No hydration, no framework runtime. Astro ships zero JavaScript by default. |
| **WhatsApp as sole CTA** | Single channel, but it works without the app (falls back to Web), needs zero JS, and is where the audience already is. |
| **Cloudflare Pages + domain** | Free edge hosting, git-push deploys, DNS in one place. Minimal ops surface for a no-technical-team client. |
| **Mobile-first** | Audience browses mainly on phones, so that's the default build target. |

## Roadmap

**Completed:** Landing page • WhatsApp conversion flow • Technical SEO (meta, OG, canonical, LocalBusiness JSON-LD) • Cloudflare Pages hosting

**Deliberately postponed** (require backend + auth + database, not needed for MVP):
- Local SEO improvements
- Lab results portal
- Patient history & dashboard
- Admin tools

## Getting started

```sh
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # ./dist
```

Requires Node ≥ 22.12. No test suite — validation is manual (Lighthouse audit ≥90 all categories, visible copy matches approved source). Astro as the static builder, Cloudflare Pages for deployment.
