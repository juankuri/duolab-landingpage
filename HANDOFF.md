# HANDOFF — DúoLab Landing Page

_Last updated: 2026-07-02 — Session: US2/US3 + Header/Footer + Polish phase_

## Goal

**Project:** Single-page conversion landing for DúoLab (a clinical analysis lab in
Ciudad del Carmen, Campeche). Astro + vanilla JS, statically deployed to
Cloudflare Pages. Sole conversion goal: turn a doubtful searcher into a WhatsApp
conversation ("Escríbenos por WhatsApp"). Reusable/white-labelable component set
driven by design tokens (Constitution Principle V).

**This session:** Implemented User Story 2 (social proof + final CTA), User Story 3
(testimonial hard-branch), added Header + Footer chrome, bumped the constitution to
v1.3.0 (Copywriting Principles), and ran the full Polish phase (T026–T033) —
Lighthouse, WCAG AA contrast, responsive, SEO/JSON-LD, and the quickstart gate.

## Current State

- **Sections T001–T033 complete.** Hero, Problem, Solution (with children-care
  differentiator), SocialProof, FinalCta all built, wired into
  [src/pages/index.astro](src/pages/index.astro), and rendering correctly.
- **Header + Footer** implemented and composed into the page (sticky header with
  hamburger + scroll shadow; Morado footer with hours/address/display-phone/CTA).
- **Lighthouse: 100 / 100 / 100 / 100** on BOTH mobile and desktop (Performance,
  Accessibility, Best Practices, SEO). Verified against the production build via
  `astro preview`.
- **WCAG AA:** all contrast passes after the T030 fix (see Changed).
- **Responsive:** 0px horizontal overflow at 360 / 390 / 768 / 1024 / 1440.
- **Not deployed yet.** No Cloudflare Pages project connected (T034 pending).
- **Not committed.** All of this session's work is in the working tree only —
  nothing has been committed or pushed to `origin/main` yet.
- **Blockers before production:** (1) confirm real production domain, (2) connect
  Cloudflare Pages (T034). WhatsApp number is already real; testimonials
  intentionally empty.

## Files In Flight

- [src/content/clients/duolab.js](src/content/clients/duolab.js) — stable. Holds
  `socialProof` (trustSignals + `testimonials: null`) and `finalCta`. Contains a
  commented-out testimonial fill-in template (inert). `studyCount`/trust signal is
  `+200` (user edit). `WHATSAPP_NUMBER = "529381156464"` (real).
- [src/components/landing/SocialProof.astro](src/components/landing/SocialProof.astro)
  — stable. Renders trust signals; hard-branches on testimonials (nothing when
  null, sourced quotes with attribution when populated).
- [src/components/landing/FinalCta.astro](src/components/landing/FinalCta.astro) — created, stable.
- [src/components/landing/Header.astro](src/components/landing/Header.astro) — created, stable. Vanilla-JS hamburger + scroll-shadow.
- [src/components/landing/Footer.astro](src/components/landing/Footer.astro) — created, stable. (Minor linter/user tweak to `.site-footer__copyright` margin.)
- [src/components/landing/Hero.astro](src/components/landing/Hero.astro) — edited: wordmark "lab" recolored for contrast + branding.md logo-rule docs.
- [src/layouts/Layout.astro](src/layouts/Layout.astro) — edited: added `scroll-behavior: smooth` + `scroll-padding-top` (reduced-motion guarded).
- [src/pages/index.astro](src/pages/index.astro) — stable. Full composition: Header → 5 sections → Footer.
- [.specify/memory/constitution.md](.specify/memory/constitution.md) — v1.3.0, stable.
- [specs/001-duolab-landing-page/tasks.md](specs/001-duolab-landing-page/tasks.md) — T017–T033 marked `[X]`; T034 still `[ ]`.

## Changed This Session

- **US2 (T017–T022):** added `socialProof.trustSignals` + `finalCta` content;
  built `SocialProof.astro` (Lila Claro band, 4 signals) and `FinalCta.astro`
  (Morado ground, outline CTA); composed after Solution.
- **US3 (T023–T025):** added `socialProof.testimonials: null` with the documented
  `Testimonial` shape; extended `SocialProof.astro` with the populated branch
  (each quote renders with `source` attribution; `sourceUrl` becomes a link).
  Validated both branches (empty → 0 blockquotes; populated → renders + attributes).
- **Header/Footer:** new site chrome, both prop-driven for white-label reuse. Nav
  links smooth-scroll to footer anchors (`#horarios`, `#ubicacion`, `#contacto`).
  Header wordmark is lowercase "dúolab" (matches DESIGN.md stylized name).
- **Constitution → v1.3.0:** added the **Copywriting Principles** section
  (benefits-not-features, specific CTAs, one "pregunta que duele" per section,
  proof-over-claim, no urgency/scarcity, "¿y eso qué significa para mí?"). Sync
  Impact Report + version footer updated (MINOR bump).
- **T030 contrast fix (visual change — review it):** hero wordmark "lab" was Lila
  Medio `#B89DCE` on Lila Claro `#EDE8F5` = 1.99:1 (failed AA). Recolored to Morado
  Oscuro `#4A3163` (~9:1). Two-tone logotype preserved within the One Purple family.
- **T027 finding — do NOT redo:** there is NO raster imagery anywhere; the hero
  "placeholder" is a text wordmark by design. No `<Image>` conversion needed until
  a real photo/logo asset is delivered. Don't hunt for an image to optimize.
- **Decisions/consensus (don't re-litigate):**
    - Display phone `938 383 0700` renders as plain text — NOT a `wa.me`/`tel` link.
      The only actionable contact is the WhatsApp number.
    - `socialProof.testimonials` stays `null` until the client sources real Google
      reviews (proof-over-claim). The commented template documents the shape.
    - Header nav links + scroll shadow intentionally diverge from DESIGN.md's
      "minimal nav / tint-on-scroll" guidance — this was an explicit user request.

## Failed Attempts

- **Preview server via plain shell backgrounding died between tool calls.**
  `nohup npm run preview &` and `(npm run preview &)` both returned HTTP 000 /
  exit 7 on the next probe — the process didn't survive the shell exit. **Fix:**
  launch it with the Bash tool's `run_in_background: true` mode; that keeps it
  alive across calls. Use `pkill -f "astro preview"` to stop it.
- **Re-ran Lighthouse against a stale build → false "contrast still FAIL".** The
  first rebuild after the Hero edit errored (exit 144) and left the OLD `dist`, so
  the preview kept serving the old CSS (`var(--color-secondary)`) and Lighthouse
  reported the contrast failure as unfixed. **Lesson:** after editing, confirm the
  build actually completed — `grep` the built `dist/_astro/*.css` to verify it
  reflects the source — BEFORE re-auditing. Don't trust an audit run without
  confirming the artifact changed.
- **CDP responsive script — two bugs before it worked.** (1) First version omitted
  `returnByValue` handling and crashed with `"undefined" is not valid JSON`.
  (2) The CDP `Runtime.evaluate` result is nested at `resp.result.result.value`,
  not `resp.result.value` — the initial destructuring `const { result }` was wrong.
  Working script is at `scratchpad/responsive.mjs` (Node 22 global `WebSocket`,
  Chrome at `/usr/bin/google-chrome`, `--remote-debugging-port`). Reuse it.
- **Placeholder grep false positive.** `grep "PLACEHOLDER"` flagged the WhatsApp
  number as a placeholder, but the match was the commented-out testimonial template
  in `duolab.js` — not the phone number. The number is real. Scope phone-placeholder
  greps to the `WHATSAPP_NUMBER`/`phoneNumber` lines to avoid this.

## Next Steps

1. **Commit & push this session's work** to `origin/main` (branch first if needed) —
   nothing is committed yet. Group logically (US2, US3, Header/Footer, constitution,
   Polish). Do NOT include `dist/` or the scratchpad.
2. Reestyle page according to PoC (by mistake, it was never imported and its importante),
   there will probably be important changes in src/styles. Poolish and improve aesthetics
3. use official logo
   3.1 add official images
4. **Source 3 real Google reviews** (client permission) → populate
   `socialProof.testimonials` using the commented template shape. Never ship
   generic/placeholder quotes.
5. **(Optional) Enrich the JSON-LD** in [src/layouts/Layout.astro](src/layouts/Layout.astro):
   `openingHoursSpecification` is currently `description`-only (valid but not
   machine-structured); consider `dayOfWeek/opens/closes`. Also decide whether
   schema `telephone` should be the display landline vs. the WhatsApp number.
6. **Client review** of the full page (especially the T030 wordmark color change)
   before flipping to production.
7. **Confirm the real production domain** with the client and update `SITE_ORIGIN`
   in [src/content/clients/duolab.js](src/content/clients/duolab.js) (currently
   `https://duolab.mx`) — it feeds canonical + OG + JSON-LD. (investigate the best options to buy domains [pros/cons], rn considering: godaddy)

## Standing Rules (no cambian)

- DESIGN.md tokens verbatim — Morado Principal #6B4A8E, Plus Jakarta Sans (it will probably change with nest step #2, color blue asked by client is missing - it shluld be in /specs)
- constitution.md v1.3.0 binding (Copywriting Principles)
- Never "pediátrico/pediatric" or medical specialty terms in output
- WhatsApp CTA: 529381156464 | Phone display: 9383830700
- Work/code/commits in English; visible copy in Spanish
