# DúoLab — Conversion Landing Page

A single static landing page for a real clinical analysis laboratory in Ciudad del Carmen, Campeche. Its one job is to help a first-time visitor understand what the lab offers and start a conversation over WhatsApp.

This README documents the engineering process behind the project rather than the finished page. It's a small project on purpose — the interesting part is how the technology was chosen, where the scope line was drawn, and which tradeoffs were made consciously.

---

## TL;DR

- **What:** A static landing page whose single conversion goal is "talk to a specialist" via WhatsApp.
- **Why it exists:** A real lab had an outdated online presence and no easy path for a new patient to make contact. The goal was digital presence and conversion, not "a website."
- **Stack:** Astro (static output), vanilla JS only, self-hosted variable font, deployed to Cloudflare Pages with the domain on Cloudflare.
- **Key architecture decision:** Static-first. There's no backend, no database, no client-side framework runtime — because nothing on the page needed one.
- **Reuse decision:** Brand values and copy live in isolated files (`styles/clients/duolab.css`, `content/clients/duolab.js`); the section components stay generic.
- **Process:** Spec-driven. A written spec, a plan, and a small "constitution" of principles came before implementation, and a proof-of-concept was validated with the client before building the full page.
- **Biggest lessons:** Choosing a tool from the project's actual requirements beats choosing the popular one; and separating the MVP from the backlog is what kept this simple instead of over-built.
- **What it is not:** Not an app, not a CMS, not a portal. Those are on the roadmap and were deliberately left out.

---

## Business context

The client is an established clinical laboratory whose online presence didn't reflect its real-world reputation, with no clear way for a prospective patient to reach it. The brief was not "build a website" — the objective was to improve the lab's digital presence and turn a first-time visitor into a new patient.

WhatsApp became the primary conversion path because it's simply where this audience already is: they prefer messaging over a phone call or a web form, so every call-to-action funnels into a single WhatsApp conversation rather than splitting attention across channels.

---

## Why Astro

Before writing code I evaluated several options — plain PHP, React, Angular, and no-code builders like Framer — instead of defaulting to the framework I'd heard the most about. The requirements pointed clearly away from a single-page application:

| Requirement | What it implied |
| --- | --- |
| Essentially static marketing content | No need for a client-side runtime or hydration |
| Fast on mid-range phones and slow connections | Ship as little JavaScript as possible |
| Good technical SEO | Real server-rendered HTML at a stable URL |
| Low, ideally zero, ongoing cost | Static hosting, no server to run or patch |
| Minimal maintenance (no in-house tech team) | Fewer moving parts, fewer dependencies to keep current |

A React or Angular SPA would have shipped a framework runtime to render what is fundamentally a static document; a no-code builder wouldn't have left me a reusable, code-owned foundation; plain PHP needed a server I didn't want to maintain. Astro fit the shape of the problem: it renders components to static HTML at build time and ships **zero JavaScript by default**, adding script only where I explicitly opt in. Choosing it was a requirements decision, not a trend decision.

---

## Architecture

The repository is a single static Astro project — no backend, no monorepo split, no API. The structure reflects one deliberate idea: **keep the reusable parts generic and isolate everything client-specific into its own files.**

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

Why this shape helps maintainability and future growth:

- **Components never hard-code brand values or copy.** They reference token *names* (`--color-primary`, `--font-heading`) and receive text as props. A designer changing the palette edits one CSS file; a copy change edits one JS object.
- **Content is a single source of truth.** The same `duolab.js` feeds the visible copy, the SEO metadata, and the structured data — so the page and its schema can't quietly drift apart.

---

## Technical decisions

A few decisions shaped the architecture; each records what was chosen and the tradeoff accepted.

### Static-first, no backend
Astro's default static build, no SSR adapter — there's no server-side logic to justify a runtime. **Tradeoff:** if a future feature genuinely needs a server (say, a validated form), the adapter gets added then. I chose not to pay for that capability while it sits unused.

### Component architecture over a SPA
Sections are `.astro` components rendered at build time and composed from the content file. **Tradeoff:** I give up rich client-side interactivity I don't need, and in exchange ship almost no JavaScript — a clear win for a mostly-static page.

### WhatsApp as the single primary CTA
Every CTA is a plain `<a href="https://wa.me/…?text=…">` with a message prefilled for its context. **Tradeoff:** WhatsApp is the only contact channel in scope, and that's intentional — it needs zero JavaScript, works even without the app installed (falls back to WhatsApp Web), and its behavior is visible right in the rendered HTML.

### Cloudflare Pages and domain
Static build deployed to Cloudflare Pages, with the domain in the same account. Free edge hosting, git-push deploys, and DNS in one place keep the operational surface tiny for a client with no technical team.

### Mobile-first
Layouts are authored for small screens first and enhanced upward, because the audience overwhelmingly browses on phones.

---

## Development process

The work followed an engineering workflow more than a strict timeline:

```text
Research → Technology evaluation → Business analysis → Wireframes
   → Proof of concept → Client validation → Implementation
   → Deployment → Iteration
```

Research and technology evaluation came before any code, comparing PHP, React, Angular, and Framer against the project's actual requirements — which is how the project landed on Astro. Business analysis reframed "we need a website" into the real problem (convert a mobile visitor into a WhatsApp conversation), and low-fidelity wireframes let section order and message flow get discussed before visual design was in the way.

A working proof of concept went to the client before the full page was built, and their feedback reshaped it — the original "problem" section became a FAQ, and dedicated How-it-works and Location sections plus the floating WhatsApp button were added as a result. Validating early meant building the agreed page, not a first guess at it.

Implementation composed the generic section components against the isolated content and token files. Deployment is a static push to Cloudflare Pages, followed by iteration — small refinements like an accent color added at the client's request and a tooling migration from npm to pnpm.

---

## Constraints

Real projects are shaped by their constraints, and naming them explains most of the decisions above:

- **Limited budget** — pushed toward free static hosting and no paid services.
- **No in-house technical team on the client side** — demanded low maintenance and few moving parts.
- **Mobile-first audience** — most traffic was expected on phones, so that had to be the default target, not an afterthought.
- **Fast delivery** — a focused MVP beat a feature-rich plan.
- **Simplicity over unnecessary complexity** — the guiding tie-breaker whenever a decision was close.

These weren't obstacles to work around so much as the design brief itself. "Static, cheap, low-maintenance, mobile-first, WhatsApp-centered" is a direct reading of them.

---

## Roadmap

### Completed

- ✅ Landing page (hero, FAQ, solution, how-it-works, location, social proof, final CTA)
- ✅ WhatsApp-centered conversion flow with context-specific CTAs
- ✅ Technical SEO baseline (meta, Open Graph, canonical, `MedicalBusiness` JSON-LD)
- ✅ Static deployment on Cloudflare Pages with the domain on Cloudflare

### Deliberately postponed

- ⬜ Local SEO improvements
- ⬜ Laboratory results portal
- ⬜ Patient history
- ⬜ Administrative dashboard
- ⬜ Authentication

These were left out on purpose. Each one implies a backend, a database, and an auth model — real complexity that the MVP's goal (get a new patient talking to the lab) does not require. Building them now would have been over-engineering; the current architecture leaves a clean place to add them when there's a validated reason to.

---

## Lessons learned

- **I stopped reaching for the popular tool by default.** Coming in, I assumed "real" web work meant a big framework. Sitting with the requirements first taught me the opposite — the strongest decision I made here was matching a modest tool to the actual problem, and I now start every project from the requirements rather than the stack.
- **A static site can be the right answer, not the beginner one.** I expected to feel like I'd under-built. Instead, "no server" turned out to directly serve the client's real goals, and it reset what I reach for when a problem doesn't actually need a backend.
- **Showing the client something early changed what I built.** Their feedback on the proof of concept reshaped the page — I'd have spent that effort on the wrong version if I'd waited to "finish" first. It made validation something I now do before implementation, not after.
- **I learned to treat the whole deliverable as mine.** Redrawing the client's old logo as an SVG wasn't strictly "code," but leaving it broken would have undercut the work — the boundary of the job was wider than I first assumed.
- **Deciding how I'd deploy up front kept the architecture honest.** Committing to static hosting early meant I was never tempted to bolt on a server the project didn't need.

---

## Development principles

- Mobile-first
- Progressive enhancement
- Component-based architecture
- Semantic HTML
- Accessibility (WCAG 2.1 AA baseline)
- Performance first
- Technical SEO fundamentals
- KISS — when two approaches worked, the one with fewer moving parts won

---

## Running it locally

```sh
pnpm install
pnpm dev        # local dev server at http://localhost:4321
pnpm build      # static build to ./dist
pnpm preview    # preview the production build locally
```

Requires Node ≥ 22.12. There is no automated test suite — with no business logic to cover, validation is manual: a Lighthouse audit (targeting ≥ 90 across Performance, Accessibility, Best Practices, and SEO) and a review that the visible copy matches the client-approved source. Adding tests here would have been ceremony without coverage; I'd rather be honest about that than pad the repo.
