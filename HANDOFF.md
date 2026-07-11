# HANDOFF — DúoLab Landing Page

_Last updated: 2026-07-11 — Session: DRY refactor + new sections (About/Services/ReviewUs) + client-meeting content pass + icon polish_

## Goal

**Project:** Single-page conversion landing for DúoLab (a clinical analysis lab in
Ciudad del Carmen, Campeche). Astro + vanilla JS, statically deployed. Sole
conversion goal: turn a doubtful searcher into a WhatsApp conversation
("Escríbenos por WhatsApp"). Reusable/white-labelable component set driven by
design tokens (Constitution Principle V).

**This session:** User re-opened the project to add the logo/images and noticed
real problems on a fresh look — FAQ sitting in position #2, duplicated section
CSS across 4 components. Did a 4-part pass:
1. **DRY refactor** — extracted `Section` + `SectionHeader` primitives, migrated
   Faq/How/Solution/Location onto them (zero visual change, ~140 lines of
   duplicated CSS removed).
2. **New sections + reorder** — added About, Services, ReviewUs (client-authored
   copy); reordered to Hero → Trust → About → Services → Solution → How →
   Location → FAQ → ReviewUs → FinalCta (FAQ moved out of the #2 slot).
3. **Client-meeting content pass** — user had a client meeting and left TODOs in
   the code; fixed all five (two-line address, WhatsApp number wired from data
   instead of hardcoded, payment-method card copy/accents, FAQ appointment-study
   list synced with `how.note`).
4. **Icon/design polish** — added a shared `LinkButton` (map-pin icon on location
   CTAs, Jakob's Law), fixed a duplicate `id="ubicacion"` bug (Location + Footer
   both had it — footer's copy removed), retired the lone blue accent in
   SocialProof (now within One Purple), redrew the contactless-pay icon per user
   feedback (bigger oval, more clearance around the waves). **Tried "icon on every
   Services card"** — user reviewed it live and rejected it; reverted to
   icon-only-on-the-payment-card. Don't re-propose the full icon set without being
   asked.

**Committed and ready for the user to push** (see Commits below). Not yet pushed
to origin as of this handoff — user said "I will manually push."

## Current State

- **Build/typecheck clean.** `pnpm build` succeeds; `pnpm exec astro check` is
  0 errors / 0 warnings (fixed 3 pre-existing implicit-`any` params along the way:
  Header navLinks map, index.astro `ctaFor`).
- **Domain already resolved** — contrary to what the previous handoff implied,
  `SITE_ORIGIN` (duolab.js) and `astro.config`'s `site` are both already
  `https://laboratoriosduolab.com`. Sitemap + robots.txt already exist (added in
  an earlier session, commits `7e8d0cb`/`acaec4f`/`be4851f`). **`dist/` is
  git-ignored and regenerated on every build — never hand-edit the sitemap XML.**
- **Section order (current, in `src/pages/index.astro`):** Hero → SocialProof
  (Trust) → About → Services → Solution → How → Location → Faq → ReviewUs →
  FinalCta → Footer.
- **Components directory** (`src/components/landing/`): Header, Hero, SocialProof,
  About, Services, Solution, How, Location, Faq, ReviewUs, FinalCta, Footer,
  WhatsAppButton, WhatsAppFloat, LinkButton, Section, SectionHeader.
- **Shared primitives to reuse, not reinvent:**
  - `Section.astro` — band wrapper (`width`, `background: surface|muted|soft`,
    optional `id`/`labelledby`).
  - `SectionHeader.astro` — eyebrow + H2 pair (`headlineMax` for the ≥768px cap).
  - `LinkButton.astro` — pill-styled anchor for non-WhatsApp CTAs (`variant`,
    `external`, `icon: "map-pin"`). WhatsApp CTAs must keep using
    `WhatsAppButton` (encodes the prefilled message) — don't merge them.
- **Not yet done:** logo/real images (this is literally why the user reopened the
  project — got sidetracked into the audit/refactor first), reconciling `+200`
  vs `2000` study-count language (flagged to user, not yet resolved — see Open
  Questions), Google review sourcing for `socialProof.testimonials` (still `null`
  by design).

## Files In Flight

- [src/content/clients/duolab.js](src/content/clients/duolab.js) — single content
  source. Now holds `about`, `services`, `reviewUs` in addition to the original
  shapes. `business.addressLines` (array, for 2-line display) added alongside the
  original single-line `addressLine` (kept for map query + schema.org). `REVIEW_URL`
  const added (`https://g.page/r/CZEYzWlxjxgbEBM/review`). `studyCount: "+2000"`
  (user edit, was `+200`) — **not yet reconciled** with Solution/About copy, see
  Open Questions.
- [src/pages/index.astro](src/pages/index.astro) — composition + `ctaFor` helper
  (now typed). Passes `whatsappDisplay` into Location, `slogan` into Hero (user
  then changed `footerSlogan` to `""` post-session — see Open Questions).
- [src/components/landing/Hero.astro](src/components/landing/Hero.astro) —
  secondary CTA migrated from a bespoke `.hero__secondary` anchor onto the shared
  `LinkButton` (map-pin icon). Slogan prop added but **user emptied the string
  after this session** (`footerSlogan = ""` in index.astro) — the slogan-in-hero
  feature is currently inert, not deleted. Ask before re-adding a value.
- [src/components/landing/Location.astro](src/components/landing/Location.astro)
  — `WHATSAPP_NUMBER` prop dropped (was declared but never passed — dead code);
  replaced with `whatsappDisplay` string prop, now actually wired from
  `index.astro`. Address renders from `business.addressLines[]`.
- [src/components/landing/Footer.astro](src/components/landing/Footer.astro) —
  removed its duplicate `id="ubicacion"` (Location section owns that anchor now;
  footer's was dead/invalid HTML — nav was jumping to whichever came first in the
  DOM). Address also renders from `addressLines[]`.
- [src/components/landing/Services.astro](src/components/landing/Services.astro)
  — text-only cards; the payment-method card alone carries an inline contactless-
  pay SVG (oval + 4 waves, `rx=10.5 ry=8`, waves start further inside the oval
  than the first draft to avoid overlap — user explicitly approved this version).
  **Do not add icons to the other cards** — tried and reverted per user feedback.
- [src/components/landing/SocialProof.astro](src/components/landing/SocialProof.astro)
  — `accent` now renders in Morado Oscuro (`--color-primary-dark`), not Azul
  (`--color-accent`/`#318BFF`). That blue token still exists in
  [duolab.css](src/styles/clients/duolab.css) but is now unused on the page —
  left in place (not deleted) in case a future section wants a functional
  data-point accent again.

## Commits (this session, not yet pushed)

```
53d86e7 feat(landing): add About/Services/ReviewUs sections and reorder page
6ff4518 refactor(landing): extract shared Section and SectionHeader
```

Both are on top of `be4851f` (prior session's SEO H1 work). `.claude/settings.local.json`
was deliberately left uncommitted (local tooling config, not project content).

## Failed Attempts

- **Full icon set on every Services card.** Built a `ServiceIcon.astro` component
  with 6 icons (droplet/flask/child/elder/clock/contactless) in a consistent line
  style, one per card. User reviewed it live and said "I didn't like it" — reverted
  completely (component deleted, content `icon` keys removed, card markup restored
  to text-only). **Lesson:** "avoid AI-slop, try every card with an icon" was the
  user's own instruction, and it still didn't land — a consistent icon *system*
  isn't automatically good for this brand. Don't re-attempt without a specific new
  ask; if asked again, consider showing 1-2 card mockups before wiring the full set.
- **First contactless icon draft overlapped.** Waves' start coordinates were too
  close to the oval's rx/ry, so the outermost wave visually touched the oval
  border. Fixed by enlarging the oval and pulling wave start-points inward — user
  confirmed the result ("I love it").

## Next Steps

1. **Push this session's 2 commits** — user's action, not mine (explicitly said
   "I will manually push").
2. **SEO audit** — user's next ask, not yet started. Look at:
   `src/layouts/Layout.astro` `<head>` (canonical, OG/Twitter tags, LocalBusiness
   JSON-LD — check whether `openingHoursSpecification` is structured or still
   `description`-only, and whether schema `telephone` should be the display
   landline vs. WhatsApp number), `astro.config` sitemap integration, `robots.txt`.
   **Do NOT touch `dist/`** — it's build output, git-ignored, regenerated every
   `pnpm build`. If sitemap/robots need changes, edit the source (astro.config /
   `public/robots.txt`), not the built XML.
3. **Logo + real images** — the original reason the user reopened the project.
   Still pending. `seo.ogImage` in duolab.js is still `null`.
4. **Source real Google reviews** → populate `socialProof.testimonials` (stays
   `null` until then — never ship placeholder quotes, this is a hard project rule).
5. **(Optional, flagged not resolved) Reconcile study count language** — trust bar
   says "+200" (unchanged), but About/Solution copy now says "2000" / "más de
   2000 estudios" (user's own edit from the client meeting). Ask user whether the
   trust-bar number should be bumped to match, or whether "+200" vs "2000" means
   two different things (e.g. sample types vs. lifetime studies performed).
6. **(Optional, flagged not resolved) Hero slogan** — currently passed as an empty
   string (`footerSlogan = ""`), which makes `Hero.astro`'s `{slogan && ...}`
   branch render nothing. User's own comment history says they want the slogan
   "not only in the footer... also at the start of the page," but then emptied
   the const post-session — likely because the placement doubled as a stand-in
   for a future logo image and they want an actual image there instead. Confirm
   before touching.

## Standing Rules (unchanged)

- DESIGN.md tokens — Morado Principal `#6B4A8E`, Plus Jakarta Sans, One Purple
  Rule (Azul `#318BFF` is a defined *functional* exception in tokens, but as of
  this session it's unused on the page — SocialProof no longer uses it).
- Never "pediátrico/pediatric" or medical specialty terms in output
  (Constitution Principle VII) — also tracked in this agent's persistent memory.
- WhatsApp CTA number: `529381156464` | Display landline: `938 383 0700` |
  Display WhatsApp (text, not a link): `938 115 6464`.
- Display phone numbers render as plain text — NEVER a `wa.me`/`tel` link. The
  only actionable contact anywhere on the page is the primary WhatsApp CTA.
- `socialProof.testimonials` stays `null` until the client sources real, sourced
  Google reviews. `ReviewUs` (new this session) solicits *new* reviews via an
  external Google link — it's a different mechanism from testimonials and both
  can coexist.
- Work/code/commits in English; visible copy in Spanish.
- Use the `Section`/`SectionHeader`/`LinkButton` primitives for any new landing
  section — don't hand-roll section chrome or a new anchor-button style.
