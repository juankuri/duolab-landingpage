# Public site restructure — implementation plan

> Status: accepted, in execution on `feat/public-site-restructure`.
> Written before any code changed. Phase progress is tracked by the commits on
> that branch, not by edits to this file.

## Context

DúoLab's public surface is one landing page (`/`) plus a patient lookup page
(`/resultados`) that was built as a standalone document, not as part of a site.
There is no legal surface, no 404 page, and no shared navigation model: the
landing header points at three footer anchors, `/resultados` is reachable only
from one footer link, and an unknown URL in production returns raw JSON from the
Hono Worker.

The approved wireframe (`DúoLab IA Wireframes Standalone.html`) defines a small
public website — `/`, `/resultados`, `/aviso-de-privacidad`, `/terminos-de-uso`,
`/404` — held together by one nav model, one footer, and a focused secondary
header. This plan turns that IA into the smallest safe set of changes against
the code that exists, without touching backend contracts, domain rules,
authentication, admin flows, or the landing's approved commercial copy.

The wireframe is a **lo-fi structure reference, not a visual spec** — the same
standing applied to the previous wireframe in DEC-024. Brand values come from
`branding/guidelines.md` and `styles/clients/duolab.css`, never from the
wireframe's sketch palette.

---

## 1. Current public frontend architecture

### Pages (`frontend/src/pages/`)

| Route | File | Shell |
|---|---|---|
| `/` | `index.astro` | `layouts/Layout.astro` |
| `/resultados` | `resultados.astro` | **none** — hand-rolls its own `<html>`/`<head>` |
| `/admin/*` | `admin/{index,buscar,folio,manager,nuevo,paciente,revisar}.astro` | `components/admin/AdminLayout.astro` |

### Layouts

- `layouts/Layout.astro` — landing-only document shell. Props `seo` + `business`.
  Emits `<title>`, description, canonical, OG/Twitter, a `MedicalBusiness`
  JSON-LD block, the font preload, and a global reset (`box-sizing`, body type,
  `scroll-behavior: smooth` + `scroll-padding-top: 72px`, `prefers-reduced-motion`
  override, `.skip-link`). Imports `styles/clients/duolab.css`.
- `components/admin/AdminLayout.astro` — internal shell, out of scope.
- `resultados.astro` deliberately uses neither (documented in its own header
  comment): it is not a marketing surface, and it carries `noindex, nofollow`.

### Shared components

- `components/landing/` — `Header`, `Footer`, `Hero`, `SocialProof`, `About`,
  `Services`, `Solution`, `How`, `Location`, `Faq`, `ReviewUs`, `FinalCta`,
  `Section`, `SectionHeader`, `WhatsAppButton`, `WhatsAppFloat`, `LinkButton`.
- `components/Icon.astro` — build-time inlined Phosphor glyphs (DEC-028), always
  `aria-hidden`; every call site carries its own visible label.
- `Section.astro` already accepts `id` and `labelledby`; `Location.astro` is the
  one section that uses `id` today (`id="ubicacion"`).

### Styles

`styles/tokens.css` (generic, client-agnostic token *names*) ← `styles/clients/duolab.css`
(DúoLab brand *values* + self-hosted Plus Jakarta Sans). `admin.css` and
`manager.css` are internal-only. Public pages must consume token names via
`var()`, never brand literals.

### Scripts

- `scripts/public/lookup.js` — pure logic for `/resultados` (error message
  collapsing, token expiry, date/plural formatting, download URL). Under test.
- `scripts/admin/api.js` — exports `API_BASE` from `PUBLIC_API_BASE`, read with
  `??` so an empty production value survives.
- `scripts/shared/icons.js` — `iconNode()` for runtime-built DOM.

### SEO / head handling

Centralised only inside `Layout.astro`. `resultados.astro` repeats the pieces it
needs by hand. `astro.config.mjs` sets `site: 'https://laboratoriosduolab.com'`
and runs `@astrojs/sitemap` with a filter excluding `/admin` and `/resultados`.
`public/robots.txt` allows everything except `/admin`.

### Current `/resultados` implementation

Single page component, `noindex, nofollow`. A `.bar` header (logo + "Volver al
inicio"), a `.card` holding a `novalidate` form (folio / phone / birthDate), a
`role="status" aria-live="polite"` status line, a hidden result panel (summary
card, file list, expiry line, "Buscar otro folio"), static reassurance copy, and
a WhatsApp help button. Its inline `<script>` is bundled (not `is:inline`, so
`import.meta.env` is substituted) and owns all DOM/fetch; pure logic lives in
`lookup.js`. Downloads go through `fetch()` → `Blob` → `blob:` URL so the
download token never enters the address bar or history. Two `<style>` blocks:
one scoped, one `is:global` (load-bearing — runtime-built rows never receive
Astro's scoping attribute).

---

## 2. Critical findings (read before touching anything)

**F1 — The landing header logo is broken in production, today.**
`components/landing/Header.astro:28` points at `/clients/duolab/logo/logo-mark.svg`.
The file lives at `public/logo/logo-mark.svg`. Confirmed present in the built
output (`frontend/dist/index.html`). The header currently renders the `alt` text
where the wordmark should be. `Hero.astro:134` carries the same stale prefix in a
comment only. Fixed in Phase 1 and pinned by a test, because every new page in
this plan reuses that logo.

**F2 — A correct 404 status is impossible without a Worker change.**
`backend/wrangler.jsonc` sets `assets.not_found_handling: "none"`, which is
load-bearing: any other value would answer `/records`, `/files`, `/api/public/*`
with the 404 page instead of running the API. So an unmatched path falls through
to Hono, and `app.notFound` returns `{"error":"Not found."}` as JSON — in a
browser. An Astro-built `dist/404.html` would never be served. **Approved:** add
an `ASSETS` binding and branch `app.notFound` on content negotiation. This is
the one backend change in the plan and it is required by the "correct 404 status"
requirement; nothing else in `backend/` is touched.

**F3 — `/resultados` has no document shell to share.**
It builds its own `<head>`. Adding a shared footer and a shared secondary header
must not route it through `Layout.astro` — that layout emits the landing's
canonical, OG tags and `MedicalBusiness` JSON-LD, none of which belong on a
patient lookup page. The shared pieces are therefore **components**, not a layout
swap.

**F4 — No legal copy exists anywhere.** Not in `docs/`, `branding/`, or
`site.js`. Per the decision taken: ship structure with explicitly-marked
`[PENDIENTE]` placeholders and `noindex`. No legal claim is invented.
**Placeholder legal pages must never exist in production** — not as a route, not
as a footer link, not as a built artifact. They are reviewable in staging only,
behind the build-time flag in §5.5. `noindex` alone is not sufficient: it is a
request to crawlers, not an access control, and a placeholder privacy notice
served from the production origin is a worse failure than no page at all.

**F5 — Route collision guard.** `wrangler.jsonc` documents that nothing in
`frontend/dist` may occupy `/records`, `/files`, `/me`, `/search`, `/patients`,
`/health` or `/api/*` — assets win over the Worker. The three new routes
(`/aviso-de-privacidad`, `/terminos-de-uso`, `/404`) do not collide. Re-verify
before merging if any route name changes.

**F6 — Baseline drift in the docs.** `docs/06-quality.md` records "backend 328
tests, frontend 200"; `HANDOFF.md` records 271/138. Measure the real numbers at
Phase 0 and use those as the floor, rather than trusting either document.

### Wireframe ↔ project contradictions

| # | Wireframe | Repository | Resolution |
|---|---|---|---|
| C1 | Nav: Servicios · Cómo funciona · Ubicación | Nav: Horarios · Ubicación · Contacto, anchored into the **footer** | Follow the wireframe. `#servicios` / `#como-funciona` do not exist yet — add `id` to the existing `<Section>` wrappers. No section copy changes. |
| C2 | Footer col 1: "[descripción breve — approved copy]" | `footerSlogan = ""` — the slogan is an empty string | Omit the slot. No commercial copy is invented. |
| C3 | Footer "Ayuda al paciente: Consultar resultado · WhatsApp" | The footer's WhatsApp CTA is commented out in `Footer.astro` | Restore it as a **text link** in that column, using the existing `resultados` prefilled message. Not a second pill CTA. |
| C4 | One "secondary header" | Wireframe actually shows **two** variants (`/resultados` = logo + back; legal/404 = logo + Inicio + Consultar resultados) | One component, `links` prop. Matches locked decision 5 and the wireframe both. |
| C5 | Legal page footer: "Volver al inicio · Términos de uso · © año" | Locked decision 6 requires **one** footer everywhere | The shared footer wins. The wireframe's reduced legal footer is discarded — it contradicts an explicit locked decision. |
| C6 | Mobile `/`: "Resultados" as its own tappable item beside the hamburger | Current header collapses everything behind the hamburger | Implement the wireframe: `Resultados` sits outside the collapsible nav. |

---

## 3. File manifest

### Create

| Path | Purpose |
|---|---|
| `frontend/src/components/public/PublicFooter.astro` | The one shared public footer. 4 columns per wireframe 1g. |
| `frontend/src/components/public/SecondaryHeader.astro` | Focused header for `/resultados`, legal pages, `/404`. |
| `frontend/src/layouts/LegalLayout.astro` | Shell only: head/SEO, secondary header, breadcrumb, title + updated date, TOC slot, body slot, contact block, shared footer. |
| `frontend/src/pages/_legal/aviso-de-privacidad.astro` | Semantic page markup. Under `_legal/` so Astro does **not** route it by default — injected only when the flag is on (§5.5). |
| `frontend/src/pages/_legal/terminos-de-uso.astro` | Same. |
| `frontend/src/pages/404.astro` | Builds to `dist/404.html`. |
| `frontend/src/config/features.js` | `LEGAL_ENABLED` — the one build-time feature flag. |
| `frontend/src/scripts/public/nav.js` | `isCurrentPath()` — the one piece of new pure logic. |
| `frontend/test/nav.test.js` | Unit tests for the above. |
| `frontend/test/legal-gating.test.js` | Guards that the flag actually gates routes *and* footer links. |
| `frontend/test/public-pages.test.js` | Source-level guards (see §8). |
| `backend/test/not-found.test.ts` | The `app.notFound` content-negotiation branch. |
| `docs/10-public-site-restructure-plan.md` | This plan. |

### Modify

| Path | Change |
|---|---|
| `frontend/src/components/landing/Header.astro` | Fix the logo path (F1); add the `Resultados` link (desktop, and outside the hamburger on mobile); accept `resultsHref`. |
| `frontend/src/components/landing/Services.astro` | `id="servicios"` on its `<Section>`. One attribute. |
| `frontend/src/components/landing/How.astro` | `id="como-funciona"` on its `<Section>`. One attribute. |
| `frontend/src/pages/index.astro` | New `navLinks`; swap `landing/Footer` for `public/PublicFooter`. |
| `frontend/src/pages/resultados.astro` | Replace the inline `.bar` with `<SecondaryHeader>`; append `<PublicFooter>`. **Script and form untouched.** |
| `frontend/src/layouts/Layout.astro` | Make `seo.canonicalUrl`/description per-page-able and support an optional `noindex` — additive, landing output unchanged. |
| `frontend/src/config/site.js` | Add a `legal` block (route paths, `updatedAt`, contact placeholder) and a `notFound` block. No commercial copy touched. |
| `frontend/astro.config.mjs` | Conditionally `injectRoute` the two legal pages; exclude `/404` from the sitemap. |
| `frontend/vitest.config.js` | Add `scripts/public/nav.js` to the coverage include list. Thresholds unchanged or raised. |
| `package.json` (root) | `deploy:staging` sets `LEGAL_ENABLED=1`; `deploy:production` does not. |
| `backend/src/env.ts` | Declare the `ASSETS` binding on `AppEnv["Bindings"]` — only if Phase 5's verification confirms that shape (§5.6). |
| `backend/src/index.ts` | Branch `app.notFound` (F2), as verified — not as sketched. |
| `backend/wrangler.jsonc` | Add `"binding": "ASSETS"` to `assets` in **both** the top-level and the `staging` env blocks (environments do not inherit). |
| `docs/03-decisions.md` | New DEC-029 recording the public-site IA and the 404 mechanism. |
| `docs/04-backlog.md` | Real legal copy as an explicit open item. |
| `docs/06-quality.md` | Add Flow G (public site) to the manual QA scripts; update measured baselines. |

### Preserve — do not touch

`frontend/src/config/site.js`'s commercial content (hero, about, services, solution,
how, faq, location, socialProof, reviewUs, finalCta, whatsapp messages);
every `components/landing/` section component's markup and copy; the entire
`<script>` block and both `<style>` blocks of `resultados.astro`;
`scripts/public/lookup.js`; all of `scripts/admin/`; all of `pages/admin/`;
every backend route, service, domain module and migration; `public/robots.txt`.

### Remove — optional, not a release requirement

`frontend/src/components/landing/Footer.astro` is the only removal candidate.
It is **optional cleanup**, explicitly outside the definition of done for this
work. Remove it only after confirming, in this order:

1. `grep -rn "landing/Footer" frontend/src` returns nothing;
2. no test, doc or plan references it;
3. nothing in it is unported — in particular its commented-out WhatsApp CTA
   block, whose intent C3 restores as a text link in the new footer.

If any of the three fails, leave the file and note why. A superseded component
that still compiles costs nothing; deleting one that something still needs costs
a revert. Nothing else is removed by this plan.

---

## 4. Component and layout structure

```
layouts/
  Layout.astro          (unchanged role: landing shell; gains optional noindex)
  LegalLayout.astro     (new: legal shell)
components/
  Icon.astro            (reused)
  public/
    PublicFooter.astro  (new)
    SecondaryHeader.astro (new)
  landing/
    Header.astro        (modified)
    WhatsAppButton.astro, LinkButton.astro, Section.astro … (reused as-is)
```

Deliberately **not** done: no `components/public/` mirror of the landing kit, no
shared `PublicLayout` wrapping all five routes, no design-token additions, no
CSS framework, no feature folders (AGENTS.md forbids them until multiple
implemented features justify one). `/404` and the legal pages reuse
`LinkButton.astro` and `WhatsAppButton.astro` rather than growing new button
components.

---

## 5. How to implement each piece

### 5.1 Landing navigation

`Header.astro` gains one prop, `resultsHref` (default `/resultados`), and renders
`Resultados` as a distinct link — purple, `font-weight: 700`, outside the
`<ul>` of anchors, because it leaves the page rather than scrolling within it
(wireframe 1b). On mobile it sits between the logo and the hamburger, **outside**
`.site-header__nav`, so it is reachable without opening the menu; the existing
`data-open` toggle script is untouched and keeps working because `Resultados` was
never inside the collapsible region.

`index.astro`'s `navLinks` becomes:

```js
const navLinks = [
  { label: "Servicios", href: "#servicios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Ubicación", href: "#ubicacion" },
];
```

`Services.astro` and `How.astro` each get one attribute on their existing
`<Section>` — `id="servicios"` / `id="como-funciona"` — exactly as
`Location.astro` already carries `id="ubicacion"`. `Section.astro` already
accepts `id`; no component API changes. `Layout.astro`'s existing
`scroll-padding-top: 72px` and the `prefers-reduced-motion` override already
handle the anchor jump.

The old `#horarios` / `#contacto` ids stay on the footer so any existing external
link keeps resolving.

### 5.2 Shared public footer

`PublicFooter.astro` renders the wireframe's four columns from data already in
`site.js`:

1. **DúoLab** — `business.name`. (The "descripción breve" slot is omitted — C2.)
2. **Contacto** — `business.addressLines`, `business.city`, `business.hours`,
   the display-only Telmex number. `<address>`, as today.
3. **Ayuda al paciente** — `Consultar resultado` → `/resultados`;
   `WhatsApp` → the `resultados`-context prefilled `wa.me` link, as a text link.
4. **Legal** — `Aviso de privacidad`, `Términos de uso`.

Baseline: `© {year} DúoLab · Ciudad del Carmen, Campeche`.

It imports `content` from `../../config/site.js` directly and takes **no props**,
reading the active route from `Astro.url.pathname`. That is a deliberate
departure from `landing/Footer.astro`'s prop contract: five pages would otherwise
each restate the same six props, and `resultados.astro` already imports `site.js`
directly (the same precedent). White-labelling still swaps one content file plus
one CSS file, which is what Principle V actually protects.

Links are **never** removed on the current page. The active one gets
`aria-current="page"` and a non-colour-only visual treatment (weight + underline).
Visual style stays the current footer's: Morado Principal ground, white text,
`--color-surface-soft` for supporting lines. Grid collapses to one column below
768px.

### 5.3 Secondary header

`SecondaryHeader.astro` is `resultados.astro`'s existing `.bar` markup and CSS
lifted verbatim into a component, plus a `links` prop:

```astro
<SecondaryHeader links={[{ label: "Volver al inicio", href: "/", icon: "arrow-left" }]} />

<SecondaryHeader links={[
  { label: "Inicio", href: "/" },
  { label: "Consultar resultados", href: "/resultados", emphasis: true },
]} />
```

The first form must produce byte-comparable output to what `/resultados` renders
today — that is the acceptance criterion for Phase 3. `aria-current="page"` is
applied where a link points at the current path. The logo keeps its
`alt=""` + adjacent text label (the wordmark is already named by `.bar__name`,
so an `alt` would be a duplicate announcement).

Mobile matches wireframe 1b: single row, no hamburger, targets ≥44px.

### 5.4 `LegalLayout`

Shell only. Props: `title`, `updated` (ISO date), `description`, `canonicalPath`.
Structure:

```astro
<html lang="es-MX"> … <meta name="robots" content="noindex, nofollow" /> (while placeholder)
  <a class="skip-link" href="#main">Saltar al contenido</a>
  <SecondaryHeader links={[Inicio, Consultar resultados]} />
  <main id="main">
    <nav aria-label="Ruta de navegación"> Inicio / {title} </nav>   ← breadcrumb
    <h1>{title}</h1>
    <p class="legal__updated">Última actualización: <time datetime={updated}>…</time></p>
    <div class="legal__grid">
      <details class="legal__toc" open>
        <summary>Contenido</summary>
        <slot name="toc" />      ← the page supplies its own <nav><ol><li><a href="#…">
      </details>
      <div class="legal__body"><slot /></div>   ← the page supplies <h2 id> <p> <ul>
    </div>
    <slot name="contacto" />
  </main>
  <PublicFooter />
```

The TOC is a **named slot**, not a config array — there is no block/card renderer
anywhere in this layout, per locked decision 7. `<details open>` is the whole
mobile-collapse mechanism: at ≥768px CSS hides the `<summary>` and the TOC
becomes the sidebar column; below that the patient can collapse it. Native
element, no JavaScript, no state to manage.

`LegalLayout` duplicates a small amount of `Layout.astro`'s `<head>` rather than
extending it, because it must **not** emit the landing's canonical URL, OG tags
or `MedicalBusiness` JSON-LD. Sharing them would be the wrong abstraction.

### 5.5 Privacy notice and terms pages

Each is ordinary semantic markup passed into `LegalLayout`:

```astro
<LegalLayout title="Aviso de Privacidad" updated={legal.privacyUpdatedAt} …>
  <nav slot="toc" aria-labelledby="toc-h"><ol>…</ol></nav>
  <h2 id="responsable">1. Responsable de los datos personales</h2>
  <p>[PENDIENTE — texto legal por aprobar]</p>
  …
  <address slot="contacto">…</address>
</LegalLayout>
```

Every unwritten body is a single visible `[PENDIENTE — …]` paragraph. Section
headings follow the shape a Mexican privacy notice needs (responsable, datos
recabados, finalidades, transferencias, derechos ARCO, cambios al aviso,
contacto) so the structure is right and only the prose is missing.

#### Gating placeholder legal pages out of production

`noindex` is a request to crawlers, not access control. A placeholder privacy
notice must not be **reachable at all** on the production origin — no route, no
footer link, no built artifact. One build-time flag, off by default:

`frontend/src/config/features.js`

```js
/**
 * LEGAL_ENABLED — the legal pages carry [PENDIENTE] placeholder copy and must
 * not be reachable in production until approved text replaces it. Off unless
 * the build is explicitly told otherwise, so forgetting the flag fails safe
 * (pages absent) rather than unsafe (placeholders live).
 *
 * Delete this flag, and the injectRoute block in astro.config.mjs, in the same
 * commit that lands the approved copy. It is scaffolding with an expiry date.
 */
export const LEGAL_ENABLED = import.meta.env.LEGAL_ENABLED === "1";
```

The pages live in `src/pages/_legal/`. Astro does not route a directory whose
name starts with `_`, so **nothing is emitted unless the route is injected**:

`frontend/astro.config.mjs`

```js
const LEGAL_ENABLED = process.env.LEGAL_ENABLED === "1";

// injectRoute is Astro's first-party mechanism for conditional routes. Files
// under pages/_legal/ are invisible to the router on their own, so an
// unflagged build emits no /aviso-de-privacidad and no /terminos-de-uso —
// the paths then fall through to the Worker and get the real 404 page.
const legalRoutes = {
  name: "duolab-legal-routes",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      if (!LEGAL_ENABLED) return;
      injectRoute({ pattern: "/aviso-de-privacidad", entrypoint: "./src/pages/_legal/aviso-de-privacidad.astro" });
      injectRoute({ pattern: "/terminos-de-uso",     entrypoint: "./src/pages/_legal/terminos-de-uso.astro" });
    },
  },
};
```

`PublicFooter.astro` imports `LEGAL_ENABLED` and renders the Legal column's two
links only when it is on. This is the single exception to "never remove a footer
link" (locked decision 6) — that rule is about not hiding the *current* page's
link for cosmetic consistency, not about linking to routes that do not exist.
When the flag is off, the Legal column is omitted entirely rather than rendered
empty, and the footer degrades to three columns.

Deploy wiring, in the root `package.json`:

```
"deploy:staging":    "LEGAL_ENABLED=1 pnpm run build && pnpm --filter @duolab/backend deploy:staging"
"deploy:production": "pnpm run build && pnpm --filter @duolab/backend deploy:production"
```

Production is the default path and needs no flag to be safe — that asymmetry is
the point. Local `pnpm dev` also defaults off; a developer reviewing the legal
pages runs `LEGAL_ENABLED=1 pnpm dev`.

While the flag exists, both pages also carry `noindex, nofollow` and are excluded
from the sitemap. **Landing the approved copy is one commit that does five
things:** replaces every `[PENDIENTE]`, deletes `features.js`, deletes the
`injectRoute` block, makes the footer links unconditional, and drops the
`noindex` plus the sitemap exclusion.

### 5.6 404

Per wireframe 1f, with the hierarchy from locked decision 10:

- `<SecondaryHeader>` with Inicio + Consultar resultados.
- `<h1>` "404" with "No encontramos esta página." beneath it. (`404` is a label,
  not the accessible name of the page — the `<title>` is
  `Página no encontrada · DúoLab`.)
- **Primary:** `<LinkButton variant="primary" href="/">Volver al inicio</LinkButton>`
- **Secondary:** `<LinkButton variant="outline" href="/resultados">Consultar resultado</LinkButton>`
- **Help, not a CTA:** a plain text link — "¿Necesitas ayuda? Escríbenos por
  WhatsApp" — visibly lighter than the two buttons. Not a `WhatsAppButton` pill.
- `<PublicFooter />`, `noindex, nofollow`.

**Serving it with a real 404 status** (F2) — *hypothesis, to be verified before
it is written.*

The sketch below is what the change is **expected** to look like. It is not to be
implemented as written. Cloudflare's static-asset behaviour, the generated
`Env` types and Hono's `notFound` contract each have edges that this pseudocode
assumes rather than knows.

```ts
// HYPOTHESIS ONLY — verify every assumption in the checklist below first.
app.notFound(async (c) => {
  const wantsHtml = c.req.header("Accept")?.includes("text/html");
  if (wantsHtml && c.env.ASSETS) {
    const page = await c.env.ASSETS.fetch(new URL("/404.html", c.req.url));
    if (page.ok) {
      return new Response(page.body, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }
  return c.json({ error: "Not found." }, 404);
});
```

**Verification checklist — run first, then adapt the implementation to what it
finds, and record the findings in DEC-029.** Each item is a real way the sketch
could be wrong:

1. **`Env` types.** Does `backend/src/env.ts`'s `AppEnv["Bindings"]` need an
   explicit `ASSETS: Fetcher`, or does the generated
   `backend/worker-configuration.d.ts` (gitignored, produced by `pnpm cf-typegen`)
   supply it once the binding is in `wrangler.jsonc`? Confirm `pnpm --filter
   @duolab/backend check` is clean either way — the repo's static gate is `tsc`,
   and a type added by a gitignored generated file is not a type another machine
   has.
2. **Binding shape.** Confirm `assets.binding` is the correct key for this
   Wrangler version and that adding it does **not** change `not_found_handling`
   semantics. Confirm it must be restated in the `staging` env block (the file's
   own comment says environments do not inherit — verify it applies to `assets`
   too, not only to `d1_databases`/`vars`).
3. **`ASSETS.fetch()` argument.** Does it accept a `URL`, or does it require a
   `Request`? Does it honour the request method, and does it resolve `/404.html`
   or need `/404`? Astro's static build emits `dist/404.html` — confirm the
   actual filename in `dist/` rather than assuming it.
4. **HEAD requests.** `new Response(page.body, …)` for a `HEAD` is wrong — a
   `HEAD` response must have a null body, and constructing one with a body may
   throw or leak. Verify and handle explicitly. A monitoring probe issuing
   `HEAD /` on a bad path must not 500.
5. **Real browser `Accept` headers.** Chrome/Safari/Firefox send
   `text/html,application/xhtml+xml,…`; some clients send `*/*`. Confirm
   `.includes("text/html")` matches every real browser navigation and does **not**
   match the admin UI's `fetch()` calls. Decide deliberately what `*/*` gets —
   JSON is the safer default, since the admin UI and every API client parse JSON.
6. **API routing is unaffected.** Re-confirm after the change that `/records`,
   `/files`, `/me`, `/search`, `/patients`, `/health` and `/api/public/*` all
   still reach their handlers, and that a *browser* hitting a bad `/api/*` path
   still gets JSON — never an HTML page an API client cannot parse.
7. **Local behaviour.** `wrangler dev` with `frontend/dist` absent or stale: the
   branch must degrade to the existing JSON `404`, never a `200`, never a
   throw, never an empty body. This is what makes the test suite runnable
   without a built frontend.
8. **Staging behaviour.** Verify on the real staging Worker, not only locally:
   an unknown URL in a browser shows the page **and** DevTools reports status
   `404` (a `200` with 404-looking content is the failure this whole item
   exists to prevent).

If verification shows the branch cannot be made correct without changing
`not_found_handling` — which `wrangler.jsonc` documents as load-bearing for API
routing — **stop and report**, rather than changing it. That would be a genuine
architectural trade needing a decision, not an implementation detail.

`wrangler.jsonc` gets `"binding": "ASSETS"` restated in **both** the top-level
and the `staging` blocks, subject to checklist item 2.

### 5.7 Integration with `/resultados`

Two edits, both structural:

1. Delete the inline `<header class="bar">` block and its `.bar*` CSS rules from
   the scoped `<style>`; render `<SecondaryHeader links={[…Volver al inicio]} />`
   in its place.
2. Add `<PublicFooter />` after `</main>`.

Everything else stays exactly as it is.

---

## 6. Preserving `/resultados` behaviour

The page's `<script>` block is **not edited at all**. It survives because:

- Every id it queries (`lookup-form`, `lookup-h`, `lookup-lead`,
  `lookup-required`, `submit`, `status`, `result`, `result-name`, `result-folio`,
  `result-count`, `result-expiry`, `file-list`, `folio`, `phone`, `birthDate`,
  `search-again`, `err-*`) lives inside `<main>`, which is untouched. The header
  swap and the footer append are outside it.
- The `is:global` `<style>` block stays — it is load-bearing for the runtime-built
  file rows, which never receive Astro's scoping attribute. **Do not** scope it
  while "tidying".
- `PublicFooter` and `SecondaryHeader` must not define `.btn`, `.file`,
  `.badge`, `.status`, `.card`, `.err` or `.field` in any global block. Their
  styles are Astro-scoped and namespaced (`.pfoot__*`, `.shead__*`). A global
  `.btn` from a new component would silently restyle the download buttons.
- The `<script>` stays bundled (not `is:inline`) so `PUBLIC_API_BASE` keeps being
  substituted at build time.
- `noindex, nofollow` and the sitemap exclusion stay.

All eight required UI states already exist and are preserved unchanged: initial
(form visible, status empty) · local validation error (per-field `Falta este
dato.` + `aria-invalid` + focus on the first empty field + the page-level status
line) · submitting (`submitBtn.disabled`, `aria-busy`, "Buscando…") · result
found (summary card, file list, expiry countdown) · generic unsuccessful lookup
(`lookupErrorMessage`, tone `error`) · technical error (the `catch` branch, and
`>= 500` in `lookupErrorMessage`) · download in progress (`withPending`'s
per-row `role="status"` line and `aria-busy`). Regression is caught by Flow E,
which is re-run verbatim in Phase 3.

**Non-enumeration (DEC-015) is untouched.** No new message distinguishes a folio,
patient, phone, birth date, unpublished, revoked or expired result. The new 404
page is a *routing* 404 and says nothing about any record; it is never rendered
in response to a lookup.

---

## 7. Accessibility requirements

Applies to every new or modified public page. DEC-024 (WCAG 2.2 AA as an explicit
criterion) governs.

- **Landmarks** — one `<header>`, one `<main id="main">`, one `<footer>` per page;
  exactly one `<h1>`; `<nav>` elements carry distinct `aria-label`
  (`Navegación principal`, `Ruta de navegación`, `Pie de página`, `Contenido`).
  A `.skip-link` (already in `Layout.astro` and `resultados.astro`) is added to
  `LegalLayout` and `404.astro`, targeting `#main`.
- **Keyboard** — every interactive element is a real `<a>` or `<button>`; no
  `div` handlers, no positive `tabindex`. The footer's link order matches its
  visual order. The header's `Resultados` link precedes the hamburger in DOM
  order, matching the wireframe's visual order.
- **Focus** — visible focus everywhere via `outline: 2px solid var(--color-primary)`
  / `--color-secondary`, `outline-offset: 2px` (the existing pattern; never a
  token that falls back to `currentColor`). No focus is moved on page load
  anywhere new. `/resultados`'s existing focus moves (first empty field on
  validation failure, first row button on result, folio on reset/expiry) are
  preserved untouched.
- **Forms and errors** — no new form is introduced. `/resultados` keeps its
  `<label for>` pairs, `aria-describedby` hint, `aria-invalid`, per-field error
  next to its control, and page-level status.
- **`aria-live`** — the existing `role="status" aria-live="polite"` regions are
  preserved. No new live region is added; the new pages are static.
- **`aria-current="page"`** — on the active footer link and the active secondary
  header link, on every public page. The link is never removed (locked decision
  6). Backed by a non-colour cue (weight + underline).
- **Target size** — ≥44×44px for the header `Resultados` link, hamburger,
  secondary-header links, 404 buttons and footer links, matching the existing
  `admin.css` / `resultados.astro` rule (`14px` vertical padding + explicit `16px`
  line, both literal on purpose).
- **Reduced motion** — no new animation is introduced. `Layout.astro`'s
  `prefers-reduced-motion` override of `scroll-behavior` already covers the new
  anchors; `LegalLayout` repeats it, since it does not extend `Layout.astro`.
- **Contrast** — new text uses `--text-primary` / `--text-secondary` on
  `--color-surface`/`--color-surface-muted`, or `--text-on-primary` /
  `--color-surface-soft` on the footer's `--color-primary` ground. These are the
  pairings already shipped. **No new colour pairing is introduced**, so no new
  contrast risk is created. An automated contrast audit remains an open backlog
  item from DEC-024's pass — this plan does not claim to close it.

---

## 8. SEO and privacy

| Route | `<title>` | Indexable | Canonical | Sitemap |
|---|---|---|---|---|
| `/` | current title, unchanged | yes | `https://laboratoriosduolab.com/` | yes |
| `/resultados` | `Consulta tus resultados · DúoLab` (unchanged) | **no** — `noindex, nofollow` | — | excluded (already) |
| `/aviso-de-privacidad` | `Aviso de Privacidad · DúoLab` | **no** — and **not built at all in production** while placeholder | `…/aviso-de-privacidad` | excluded while placeholder |
| `/terminos-de-uso` | `Términos de Uso · DúoLab` | same | `…/terminos-de-uso` | excluded while placeholder |
| `/404` | `Página no encontrada · DúoLab` | **no** | — | excluded |

The two legal rows describe the staging build. In a production build the routes
do not exist, so `/aviso-de-privacidad` falls through to the Worker and receives
the 404 page — the correct answer for a page that genuinely is not there yet.

Each page gets its own one-sentence `<meta name="description">`. The landing's
title, description and canonical are **not** changed. `robots.txt` is not changed
— `noindex` is the correct instrument here, and `Disallow` would prevent crawlers
from reading the `noindex` at all.

Privacy guardrails, all of which hold by construction and must not regress:

- **No sensitive data in URLs.** The lookup is a `POST` body; the download token
  is fetched, never navigated to, so it never reaches the address bar, history or
  session-restore state. Nothing in this plan adds a query string anywhere.
- **No caching of patient responses.** `/api/public/*` sets `Cache-Control: no-store`
  (DEC-014), unchanged. The `/resultados` *document* is a static asset holding no
  patient data — every patient value arrives over the no-store API — so its asset
  caching is correct as-is and is not touched.
- **No analytics.** The repository contains no analytics, tag manager or
  third-party script, and this plan adds none. That is the mechanism by which no
  patient form value can be captured; it is a constraint to hold, not work to do.
  Any future analytics must exclude `/resultados` explicitly.
- **No third-party requests** on the new pages: no CDN font, no embedded map, no
  external stylesheet.

---

## 9. Test impact

### Existing tests that must change

- **None break.** No existing test asserts on the footer, the header nav, or the
  `/resultados` header. `frontend/test/lookup.test.js` covers `lookup.js`, which
  is not edited. The backend suite does not currently assert on `app.notFound`.
- `frontend/vitest.config.js` — add `src/scripts/public/nav.js` to the coverage
  `include` list. Thresholds are unchanged or raised, **never lowered**
  (`docs/06-quality.md` threshold policy).
- `docs/06-quality.md` — new Flow G, refreshed measured baselines (F6).

### New tests

**`frontend/test/nav.test.js`** — `isCurrentPath(pathname, href)`: exact match;
trailing-slash equivalence (`/resultados/` vs `/resultados`, which is what Astro's
static output actually produces); `/` matching only `/`; a non-match; empty and
`undefined` input. Happy path, edges, and the failure case, per the quality doc's
"what a new unit test needs".

**`frontend/test/public-pages.test.js`** — source-level guards, following the
precedent `dialog.test.js` and `format.test.js` already set (`readFileSync` over
source, asserting a contract that unit tests cannot reach and Playwright is not
worth adding for):

1. Every logo `src` referenced in `src/**/*.astro` resolves to a real file under
   `frontend/public/`. **This is the regression guard for F1** and is the one
   test that would have caught the broken header.
2. Every public page (`index`, `resultados`, `aviso-de-privacidad`,
   `terminos-de-uso`, `404`) renders `<PublicFooter`.
3. `PublicFooter.astro` links to all four of `/`, `/resultados`,
   `/aviso-de-privacidad`, `/terminos-de-uso`, and contains no conditional that
   removes a link (locked decision 6).
4. `resultados.astro`, both legal pages and `404.astro` each contain
   `content="noindex, nofollow"`.
5. Neither `PublicFooter.astro` nor `SecondaryHeader.astro` contains
   `<style is:global` — the guard against a global `.btn` silently restyling the
   `/resultados` download buttons.
6. `resultados.astro` still contains every id its script queries — a cheap
   regression net over the one file this plan edits that has real behaviour.

**`frontend/test/legal-gating.test.js`** — the guard that placeholder legal copy
cannot reach production:

1. `PublicFooter.astro` gates its Legal column on `LEGAL_ENABLED` — asserted
   against the source, so removing the condition fails the test.
2. `astro.config.mjs` injects the legal routes only under the flag.
3. Both legal page files live under `src/pages/_legal/`, never directly under
   `src/pages/` (where Astro would route them unconditionally).
4. `features.js` defaults to `false` for an unset, empty or arbitrary value — it
   is on only for the exact string `"1"`. Fail-safe by default is the property
   worth pinning.

**`backend/test/not-found.test.ts`** — written **after** §5.6's verification, to
assert the behaviour actually observed rather than the behaviour assumed. The
cases it must cover regardless of what the verification finds:

- `GET /api/nope` with a JSON `Accept` → `404`, `application/json`,
  `{ error: "Not found." }` (the existing contract, now pinned).
- `GET /nope` with a real browser `Accept` string → `404`, and not
  `application/json` when the asset resolves.
- The same with the asset unavailable → the JSON fallback, still `404`.
- `HEAD /nope` → `404`, no throw, no body (checklist item 4).
- `GET /nope` with `Accept: */*` → whatever the verification decided, asserted
  explicitly so the decision is recorded in a test rather than in a comment.
- Never a `200` in any branch.

### Manual verification matrix

To be added to `docs/06-quality.md` as **Flow G — Sitio público**:

| # | Check | Where |
|---|---|---|
| G1 | Header logo renders as the wordmark image, not `alt` text | `/`, desktop + mobile |
| G2 | Servicios / Cómo funciona / Ubicación each scroll to the right section, header not overlapping the heading | `/` |
| G3 | `Resultados` is visible and tappable **without** opening the hamburger | `/`, ≤767px |
| G4 | Hamburger still opens/closes, `aria-expanded` flips, a link closes it | `/`, ≤767px |
| G5 | Footer is identical on all five public pages; the current page's link is present and marked `aria-current` | all |
| G6 | Tab from the address bar: skip link → header → main → footer, no trap, focus always visible | all |
| G7 | Legal pages: breadcrumb, TOC sidebar ≥768px / collapsible below, TOC anchors jump correctly | both legal |
| G8 | An unknown URL in a browser shows the 404 **page** and DevTools reports status `404` | staging |
| G9 | An unknown `/api/*` path still returns JSON `404` | staging |
| G10 | `/admin` is unreachable from any public page and absent from every nav and footer | all |
| G11 | View source: `noindex` present on `/resultados`, both legal pages and `/404`; absent on `/` | all |
| G12 | **Flow E re-run verbatim** (all 11 steps) — the actual gate that `/resultados` did not regress | `/resultados` |
| G13 | `/resultados`: token still never appears in the address bar or history (Flow E step 11) | `/resultados` |
| G14 | **Flag off** (a plain `pnpm run build`): `dist/` contains no `aviso-de-privacidad` and no `terminos-de-uso`; the footer shows no Legal column; both URLs return the 404 page | production-shaped build |
| G15 | **Flag on** (`LEGAL_ENABLED=1`): both routes exist, the footer Legal column appears, both pages carry `noindex` and are absent from `dist/sitemap-0.xml` | staging |
| G16 | `HEAD` on an unknown path returns `404` and does not error | staging |

### Commands

```bash
pnpm --filter @duolab/backend check && pnpm test && pnpm test:coverage && pnpm run build
```

Run individually while iterating:

```bash
pnpm --filter duolab test
```

```bash
pnpm --filter duolab build
```

There is no lint step in this repository — `astro check` is the static gate.
`astro check` currently reports 672 pre-existing errors, all confined to inline
page `<script>` blocks (documented in `docs/04-backlog.md`). **The bar for this
work is that the count does not increase**; new `.astro` files must contribute
zero. Record the before/after count in the Phase 5 commit message.

---

## 10. Implementation phases

Branch `feat/public-site-restructure` off `develop`. Every phase is one commit,
builds green, and is independently revertable. No `git push` at any point — the
user pushes manually. No AI attribution or `Co-Authored-By` in any commit
message.

Before the first commit, run the full DoD once and record the numbers — that
baseline is what "not lower than before" means for the rest of the work (F6).

---

**Phase 0a — Plan.** *Risk: none.*
Commit `docs/10-public-site-restructure-plan.md` alone. Documentation only, no
code. Kept separate from 0b so the plan's history is not entangled with a code
fix and either can be reverted without the other.

*Accepts when:* the file is committed and nothing else is in the diff.

---

**Phase 0b — Logo fix.** *Risk: very low.*
Fix `Header.astro`'s logo path (F1) and add the resolves-to-a-real-file test.
Its own commit: a live production bug, independent of this entire restructure,
and cherry-pickable to `main` on its own if the rest of the branch stalls.

*Accepts when:* the landing header renders the wordmark image; `pnpm --filter duolab test`
green with one new test that fails against the old path; the diff contains no
planning document and no unrelated file.

---

**Phase 1 — `PublicFooter` + `nav.js` + the flag.** *Depends on: 0b. Risk: low.*
Create `scripts/public/nav.js`, `test/nav.test.js`, `config/features.js`,
`PublicFooter.astro`. Wire the footer into `/` only, replacing
`landing/Footer.astro` in `index.astro`. Add `site.js`'s `legal` block (paths +
placeholder `updatedAt`). The Legal column is gated on `LEGAL_ENABLED` from the
first commit, so the flag exists **before** the pages it protects — never after.

*Accepts when:* `/` renders the footer; with the flag off there is no Legal
column and no dead link anywhere; `#horarios`/`#contacto` still resolve;
`aria-current="page"` is on the `/` link; the grid collapses to one column below
768px; `nav.js` is in the coverage include and clears 85/75; build clean.

---

**Phase 2 — Landing navigation.** *Depends on: 1. Risk: low.*
`id` on Services/How's `<Section>`; new `navLinks`; `Resultados` in
`Header.astro`, outside the collapsible nav on mobile.

*Accepts when:* all three anchors scroll to their section with the heading clear
of the sticky header; `Resultados` is tappable at ≤767px without opening the menu;
the hamburger still toggles with correct `aria-expanded`; every target ≥44px; no
section copy changed (`git diff` touches no string in `site.js`'s content blocks).

---

**Phase 3 — `SecondaryHeader` + `/resultados`.** *Depends on: 1. Risk: medium —
this is the only phase that touches a page with real behaviour.*
Extract `.bar` into `SecondaryHeader.astro`; use it in `resultados.astro`; append
`<PublicFooter />`. The `<script>` block is not edited.

*Accepts when:* the rendered `/resultados` header is visually and structurally
identical to before; **Flow E passes all 11 steps**; all eight UI states behave
as before; the download token still never appears in the address bar or history;
`git diff` shows zero lines changed inside the `<script>` block.

---

**Phase 4 — `LegalLayout` + both legal pages, gated.** *Depends on: 1, 3. Risk: low.*
Ship the shell, both pages under `src/pages/_legal/` with `[PENDIENTE]` bodies,
the `injectRoute` block, `LEGAL_ENABLED=1` on `deploy:staging`, `noindex`,
sitemap exclusion, `test/legal-gating.test.js`, and the backlog entry for real
copy.

*Accepts when:* **G14 passes — a default build emits neither page and the footer
shows no Legal column**; with `LEGAL_ENABLED=1` both routes render, breadcrumb
and TOC anchors work, the TOC is a sidebar ≥768px and collapsible below, body
markup is `<h2>`/`<p>`/`<ul>` with no card wrapper and no config-driven renderer,
both carry `noindex`, and both are absent from `dist/sitemap-0.xml`.

---

**Phase 5 — `/404` + the Worker branch.** *Depends on: 1, 4. Risk: medium — the
only backend change.*

Split into two steps, in order:

**5a — Verify.** Work through §5.6's eight-item checklist against the real
`Env` types, the real Wrangler config, `wrangler dev`, and staging. Write the
findings down. If any assumption is wrong, adapt the design before writing the
handler; if the branch cannot be made correct without changing
`not_found_handling`, stop and report rather than changing it.

**5b — Implement what 5a verified.** `404.astro`; the `ASSETS` binding in both
`wrangler.jsonc` blocks; the `app.notFound` branch as verified; `env.ts` if
needed; `backend/test/not-found.test.ts` asserting observed behaviour; sitemap
exclusion. DEC-029 records what the verification actually found, including any
assumption from §5.6 that turned out to be wrong — that record is the
deliverable, not just the code.

*Accepts when:* `/404` renders with the correct CTA hierarchy (one primary, one
secondary, WhatsApp as a text link); an unknown browser URL returns status `404`
**with** the page, confirmed in DevTools on staging; `HEAD` on the same path
returns `404` without erroring; an unknown `/api/*` path still returns JSON
`404`; `/records`, `/files`, `/me`, `/search`, `/patients`, `/health` and
`/api/public/*` all still route to the API (F5); `pnpm --filter @duolab/backend
check` clean; the backend suite green with a higher count than the Phase 0
baseline; `astro check`'s error count has not risen.

---

**Phase 6 — Docs.** *Depends on: all. Risk: very low.*
DEC-029, Flow G in `docs/06-quality.md`, refreshed measured baselines, the
backlog entry for the pending legal copy, and a `docs/04-backlog.md` note that
`features.js` + the `injectRoute` block are scaffolding to delete with that copy.

*Accepts when:* the full DoD passes; test counts are at or above the Phase 0
baseline in both suites; coverage thresholds met with none lowered.

---

**Optional, not part of the release — remove `landing/Footer.astro`.**
*Risk: very low, and skippable.*
Only after the three-point confirmation in §3. If it passes, its own commit. If
anything still references the file or holds unported intent, leave it and say so.
This step being skipped does not make the work incomplete.

---

## 11. Sensitive-data verification

Checked before planning; re-check before the final commit.

- `backend/.dev.vars` is untracked and gitignored (`.gitignore:77`). Only
  `.dev.vars.example` is committed, and its values are documented in-file as
  placeholders, correct for local development only.
- `git ls-files` matches no `.env`, `.pem`, `.key`, credential or secret file —
  only `backend/.dev.vars.example` and `frontend/.env.example`.
- `wrangler.jsonc`'s `database_id` and `CLOUDFLARE_ACCESS_AUDIENCE` are resource
  identifiers, not secrets — DEC-025 and the file's own comments state this. The
  real `RATE_LIMIT_KEY_SECRET` / `DOWNLOAD_TOKEN_SECRET` exist only locally and
  are set per environment with `wrangler secret put`.
- The WhatsApp and Telmex numbers in `site.js` are the business's published
  contact numbers, intentionally public.
- No patient data appears anywhere in the repository; seeds are synthetic.
- `dist/`, `coverage/` and `.astro/` are gitignored and must stay untracked —
  verify with `git status --short` before each commit, since this work rebuilds
  the frontend repeatedly.

**No new secret, token, key, identifier or patient value is introduced by any
file in this plan.**

---

## 12. Open decisions

Only one remains genuinely unresolved:

- **The real legal copy.** Structure ships now with `[PENDIENTE]` markers,
  `noindex`, and — decisively — the default-off `LEGAL_ENABLED` flag, so the
  placeholder pages exist in staging and **nowhere else**. The prose needs the
  business owner and, for the privacy notice specifically, someone who can sign
  off on LFPDPPP compliance (identidad y domicilio del responsable, datos
  recabados, finalidades, transferencias, medios para ejercer derechos ARCO).
  Tracked as a backlog item in Phase 6, together with the note that
  `features.js` and the `injectRoute` block are scaffolding to be deleted in the
  same commit as the approved text.

Everything else was settled: the wireframe's nav model wins over the current
footer-anchor nav; the four-column footer ships without an invented description;
the Worker 404 branch is approved. The wireframe's reduced legal-page footer (C5)
is discarded in favour of locked decision 6.

Two pre-existing open questions are **out of scope** and untouched: the P4-vs-DEC-015
tie in `docs/04-backlog.md`, and the `astro check` inline-script refactor.

---

## 13. Recommended implementation order and risk

| Phase | Depends on | Risk | Why |
|---|---|---|---|
| 0a — Plan | — | none | Documentation only. |
| 0b — Logo fix | — | very low | One attribute; fixes a live bug; cherry-pickable on its own. |
| 1 — PublicFooter + nav.js + flag | 0b | low | New component, one call site, new pure module with full coverage. Flag lands before the pages it protects. |
| 2 — Landing navigation | 1 | low | Two `id` attributes, one array, one link. No copy touched. |
| 3 — SecondaryHeader + /resultados | 1 | **medium** | The only page with real behaviour. Mitigated by not editing the script, by the global-style guard test, and by re-running Flow E in full. |
| 4 — LegalLayout + legal pages | 1, 3 | low | Entirely new files, off by default. Nothing existing depends on them. Fail-safe: forgetting the flag omits the pages, it does not expose them. |
| 5a — Verify the 404 mechanism | 1, 4 | low | Read-only investigation. Its whole purpose is to move risk out of 5b. |
| 5b — /404 + Worker branch | 5a | **medium** | The only backend change. Mitigated by 5a, by a fallback that is never a `200`, by a dedicated test, and by re-verifying every API route still routes. |
| 6 — Docs | all | very low | Documentation. |
| *opt* — Remove `landing/Footer.astro` | 6 | very low | Optional. Skippable without making the work incomplete. |

Two residual risks worth naming:

- **A global CSS rule from a new shared component leaking into `/resultados`'s
  runtime-built file rows.** Guarded by test #5 in `public-pages.test.js` and by
  Flow G12.
- **A placeholder legal page reaching production.** Guarded by the default-off
  flag, by `legal-gating.test.js`, and by G14 — three independent checks,
  because `noindex` is not one of them.

---

## 14. Statement

**No code has been changed.** This planning pass performed read-only inspection
of the repository, the built output in `frontend/dist/`, the git history and the
approved wireframe. No file in `frontend/`, `backend/`, `database/`, `docs/` or
`branding/` was created, modified or deleted; no branch was created; no command
with side effects was run; nothing was pushed.

### On the design MCP

The approved wireframe was read in full from the attached local file. For the
record, the Claude Design project `dbfe14c2-9c90-4cb1-9c64-2dae7fae771f`
("DúoLab website architecture proposal") is a canvas project, not a design-system
project — `DesignSync` can enumerate it (it holds `DúoLab IA Wireframes
Standalone.html`, `DúoLab IA Wireframes.dc.html`, and a nested `_ds/` bundle) but
its import/write flow only targets design-system projects. A separate **"DúoLab
Design System"** project (`c36f6af9-…`) does exist, carrying `tokens/colors.css`,
`spacing.css`, `typography.css`, `effects.css` and the same Plus Jakarta Sans
file this repository already self-hosts. Reconciling those remote tokens with
`styles/tokens.css` + `styles/clients/duolab.css` is a genuinely separate task —
it would touch every surface in the product, including `/admin` — and is
deliberately **not** part of this plan, which introduces no new design system and
no new token.
