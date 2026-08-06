# Backlog

## Phase 2: Online Results Foundation

- Define the result-delivery domain model. ✅
- Design D1 schema for records, folios, publication state, and file metadata. ✅
- Define R2 storage conventions for result PDFs. ✅
- Decide backend framework after evaluating Cloudflare Workers options. ✅ (DEC-004)
- Define Cloudflare Access boundaries for patient and admin experiences. ✅ (DEC-012)

## Patient Portal

- Patient can consult a published record by folio, phone and birth date. ✅
- Patient can download the published PDF file attached to a record. ✅
- Patient receives the same clear feedback whether the folio, phone, birth date or publication state was the reason for no match. ✅ — see DEC-015 and the non-enumeration tests in `backend/test/public-lookup.test.ts`.
- Rate limiting on the lookup endpoint. ✅ (DEC-015)
- Patient's download link stays usable, or fails clearly, across its whole 5-minute window — no dead link that dumps raw JSON if they wait past it. ✅
- A folio may hold several published results at once, and the patient sees and downloads every one of them, each with its name and publication date. ✅ (DEC-010 reversed, DEC-011 amended, DEC-023)
- Patient has a WhatsApp escape hatch if the lookup doesn't work. ✅ — see `docs/01-domain.md`'s patient user stories.
- Patient sees a static reassurance that an unreleased result "isn't missing, just not ready yet" — without the page ever confirming a specific folio exists. ✅

## Admin Portal

- Employee can create a patient, a folio and its first result in one step — a folio can no longer exist without a result. ✅ (DEC-016)
- Employee can search by folio, patient name (accent-insensitive) or phone in one box. ✅
- Employee can add a further result to an existing folio without touching the ones already there, and confirm it in one click. ✅
- Employee can open a patient and start a new folio for them without retyping their data. ✅
- Employee can confirm, withdraw a confirmation, and replace a file's PDF from any of UPLOADED/CONFIRMED/PUBLISHED. ✅ (DEC-018)
- Manager can publish a record. ✅
- Employee or manager can revoke a published record — no longer manager-only. ✅ (DEC-018)
- Manager has a mobile-first surface of their own (`/admin/manager`) — a three-tab queue (por publicar/publicados/revocados), a PDF viewer that never leaves the page, and a batch "ver siguiente" rhythm. ✅ (DEC-021, DEC-022)
- Manager queue matches the Phase 2 wireframes: results grouped by day then hour (hour shown once, not per card), an accessible roving-tabindex tablist, a dedicated publish-success screen, and an explicit consequence warning before revoking. ✅ (DEC-024)
- Internal users see each result's own status and a folio's derived tally, not a single folio-level status. ✅
- The manager queue (`?status=CONFIRMED`) includes a folio whose latest result is a fresh draft but which still has an older confirmed result waiting — previously excluded by mistake. ✅ — regression test in `backend/test/records.test.ts`.
- Keyboard: `/` focuses search from anywhere; the result menu supports arrow-key navigation; Esc returns focus to what opened it. ✅

## Public Website

- Keep the landing page stable during Phase 2 refactors.
- Add real photos when available.
- Add real, sourced Google reviews only when approved.

## Deployment

- Single-origin topology decided and configured: one Worker serves the built frontend and the API. ✅ (DEC-020)
- Reproducible local start: `pnpm dev:setup` applies migrations, `pnpm dev:seed` fills the database through the real API. ✅
- Ordered deploy runbook in `backend/README.md`. ✅ — written, not yet executed.
- Create the real D1 database and R2 bucket, replace the placeholder `database_id`, apply migrations with `--remote`.
- Set `RATE_LIMIT_KEY_SECRET` and `DOWNLOAD_TOKEN_SECRET` with `wrangler secret put`, using fresh values.
- Configure the Cloudflare Access application (six destinations, see DEC-020) and the real `CLOUDFLARE_ACCESS_AUDIENCE`.
- Seed the real staff addresses into `users` on the remote database — an Access-verified address with no row gets 403 (DEC-006).

## Bugs and UX review (2026-08)

A product review pass raised the items below. Checked against the current
code before filing — several were already fixed and are marked ✅ with the
evidence; the rest are genuinely open.

**Bugs / correcciones**

- Corregir visualización del PDF desde "NEW" (el estado inicial de un
  resultado recién subido) — no reproducido en esta pasada, necesita pasos
  exactos para diagnosticar.
- Error en `/admin/manager`: falla el import dinámico de
  `pdfjs-dist_build_pdf__mjs.js`. No reproducido en esta sesión (el flujo de
  manager se probó con datos hostiles pero no se ejercitó el visor PDF a
  fondo) — necesita repetirse con el visor abierto y la consola visible.
- Campo de búsqueda pierde estilos después de buscar — no reproducido; el
  campo (`input[data-admin-search]`, `frontend/src/styles/admin.css`) se
  revisó esta sesión por otro motivo (el `min-width` inline se movió a CSS)
  y no mostró pérdida de estilos en esa prueba, pero esa prueba no cubrió
  "después de buscar" específicamente.
- REVOCAR en móvil da error "undefined" + falta feedback + falta "deshacer"
  (10s) — no reproducido; `revokeConfirmBody`/`revokedExplanation`
  (`frontend/src/scripts/admin/manager.js`) no muestran un fallo obvio en
  lectura de código, pero eso no descarta un error en tiempo de ejecución.
  Falta "deshacer" es real y sencillo de confirmar: no existe ningún texto
  ni lógica de deshacer en `manager.js` ni `manager.astro`.
- Botón "ver" reemplaza la página en vez de abrir nueva pestaña — **parcialmente
  vigente**: en `/admin/folio` (`folio.astro:193,199`) ya abre con
  `window.open(..., "_blank", "noopener")`, correcto. `/admin/manager` mantiene
  el visor **dentro** de la página a propósito (DEC-022: "un visor PDF que
  nunca abandona la página") — si el reporte es sobre manager, es una decisión
  de producto ya tomada, no un bug; confirmar con quien reportó cuál pantalla
  vio.
- Header logo "[duolab] + duolab" no tiene sentido — **confirmado, real**.
  `frontend/public/logo/logo-mark.svg` es el wordmark completo (paths
  vectoriales del texto "dúolab", viewBox 494×130, sin `<text>` — el texto ya
  está dibujado). `AdminLayout.astro`'s topbar renderiza ese mismo SVG *más*
  un `<span class="topbar__name">dúolab</span>` al lado — el texto aparece
  visualmente dos veces. El landing (`Header.astro`) no tiene este problema:
  usa el mismo SVG pero sin texto hermano, solo `alt={brand}` (no visible).
  Fix: quitar `topbar__name`'s texto duplicado o usar un logo-mark real (sin
  texto) en el topbar.

**Performance**

- Optimizar página (carga lenta para todos los roles) — no perfilado esta
  sesión; necesita una pasada con Lighthouse/WebPageTest o el panel de
  Network real, no una suposición.

**UI consistency**

- Reemplazar emojis por iconos (todo el sitio) — **ya hecho**: no se encontró
  ningún emoji en `frontend/src` (`grep` sin resultados). El sistema de
  iconos (DEC-028, `components/Icon.astro`) ya cubre el sitio. Verificar con
  quien reportó si vio esto en una build vieja.
- Corregir espaciados/márgenes/paddings — consistencia general. Sigue abierto
  y es amplio; no acotado a una pantalla — necesita ejemplos concretos
  (capturas o rutas) antes de convertirse en una tarea accionable.
- Placeholders más claros (ej. JPKR → ABCD) — **ya hecho**: tanto
  `resultados.astro:91` como `admin/nuevo.astro:70` ya usan
  `placeholder="ABCD-010126-0001"`.
- "resultados" → "tus resultados" — **ya hecho**: el `<h1>` en
  `resultados.astro:64` ya dice "Consulta tus resultados aquí" y el
  `<title>` ya dice "Consulta tus resultados". Si el reporte es sobre otro
  texto (un link de nav, un footer), señalar cuál.

**Funcionalidad**

- Búsqueda automática en tiempo real (sin botón "Buscar") — abierto, cambio
  de flujo real, no un bug.
- ¿Qué pasa cuando se actualizan datos del paciente? (definir
  comportamiento) — abierto; `PATCH /patients/:patientId` existe (DEC-026)
  pero el comportamiento esperado en pantallas relacionadas (folios ya
  publicados con el nombre viejo, por ejemplo) no está definido en
  `docs/01-domain.md`. Necesita una decisión de producto, no una
  implementación a ciegas.
- No mostrar al usuario cuándo se publicó un resultado — contradice
  directamente lo ya implementado: `.result__expiry`/publishedAt se muestran
  hoy en `/resultados` a propósito (ver `resultados.astro`). Si la intención
  es ocultarlo, es un cambio de decisión de producto, no un bug — confirmar
  el motivo antes de tocarlo.
- Footer: Aviso de Privacidad, Términos de uso, datos de contacto — **ya
  hecho, condicionado**: `PublicFooter.astro` ya tiene la columna Legal
  (gateada por `LEGAL_ENABLED`, ver `docs/10-public-site-restructure-plan.md`)
  y el `wa-float`/WhatsApp como contacto. Si falta un teléfono/email visible
  fuera de WhatsApp, señalar cuál.
- Mensaje de error único y genérico para búsquedas fallidas — **ya hecho**:
  verificado en vivo esta sesión (folio incorrecto, teléfono incorrecto,
  fecha incorrecta y folio real sin nada publicado devuelven el mismo
  `{"error":"No encontramos un resultado con esos datos.","code":"LOOKUP_FAILED"}`).

**Seguridad / cumplimiento**

- Rate limiting — **ya hecho** (DEC-015, ver Patient Portal arriba).
  **Bloqueo progresivo — sigue abierto**: hoy son ventanas fijas de 10 min
  con presupuesto IP+folio (`backend/src/services/rate-limiter.ts`), sin
  escalamiento tras repetidos abusos. Es un plan aparte, ya priorizado en la
  propuesta de hardening de seguridad de esta sesión.
- Respuestas de error genéricas (no dar pistas) — **ya hecho**, ver arriba.
- `Cache-Control: no-store` en consulta y descarga — **ya hecho**:
  confirmado en `backend/src/http/routes/public/index.ts:20`.
- `X-Robots-Tag: noindex, noarchive` — **abierto**. Hoy solo existe
  `<meta name="robots" content="noindex">` en el HTML de `/resultados`,
  `/404` y las páginas legales — sin el header HTTP, que cubre también
  respuestas no-HTML. Ya está en el primer punto de la propuesta de
  hardening de headers de seguridad de esta sesión; añadir ahí, no aparte.
- No exponer nombres/teléfonos/fechas de nacimiento/folios completos en
  URLs, logs, Sentry, analítica — **parcialmente abierto**. No hay Sentry ni
  analítica en el código (nada que revisar ahí). El token de descarga sí
  viaja en la ruta de la URL (`/api/public/results/<token>/download/...`),
  lo que llega a logs de proxy igual que un query param — ya señalado como
  riesgo aceptado (TTL de 5 min, alcance por folio) en el análisis de
  seguridad de esta sesión; revisar si folios/teléfonos/nombres aparecen en
  algún log del Worker (`console.error` en `backend/src/http/errors.ts` solo
  registra el error, no el payload — confirmar que ningún handler hace
  `console.log` del body en una ruta pública).
- Procedimiento de respuesta a incidentes (detección, contención, evaluación,
  notificación, documentación) — abierto, ya priorizado (4c en la propuesta
  de hardening: runbook de rotación de secretos + respuesta a incidentes en
  `backend/README.md`).
- Acuerdos de confidencialidad con empleados — abierto, no técnico, no es
  trabajo de código.
- Vacíos identificados: cumplimiento documental, retención, evidencia de
  consentimiento, contratos con proveedores, respuesta a incidentes — todos
  abiertos, no técnicos, necesitan a alguien con autoridad legal/de negocio,
  no un agente.

## Later

- **Approved legal copy for `/aviso-de-privacidad` and `/terminos-de-uso`.**
  Structure shipped in `docs/10-public-site-restructure-plan.md`'s Phase 4:
  `LegalLayout.astro` and both pages exist, but every body section is a
  visible `[PENDIENTE — …]` placeholder — no privacy or terms claim has been
  written, let alone approved. Needs the business owner and, for the privacy
  notice specifically, someone who can sign off on LFPDPPP compliance
  (identidad y domicilio del responsable, datos recabados, finalidades,
  transferencias, medios para ejercer derechos ARCO). Until that lands, the
  pages are gated behind `LEGAL_ENABLED` (`frontend/src/config/features.js`,
  `frontend/astro.config.mjs`'s `injectRoute` block, `frontend/package.json`'s
  `build:staging`) so they exist in staging for review and nowhere else —
  `noindex` alone was judged insufficient, since it is a request to crawlers,
  not access control. Landing the real copy is one commit that: replaces every
  `[PENDIENTE]`, deletes `features.js`, deletes the `injectRoute` block and its
  sitemap-filter clause, moves both pages from `src/pages/_legal/` to
  `src/pages/` directly, makes `PublicFooter.astro`'s Legal column
  unconditional, and drops `noindex` plus the sitemap exclusion. Delete
  `frontend/test/legal-gating.test.js` in the same commit — it exists only to
  guard the flag that commit removes.

- ~~Patient editing (name/birth date/phone correction after creation).~~ **Done** — `PATCH /patients/:patientId` (DEC-026), the checkpoint B/C UX pass.
- "Descargar todos" (ZIP) on the patient result page. Still unblocked — multi-publish shipped — but not built: the patient downloads each result individually, which covers the need. Needs a zip library in the Worker and a multi-object streaming endpoint. Worth adding when a folio routinely carries enough studies that one-by-one is tedious.
- Surface `?supersedes=` as a deliberate action in the employee screens (DEC-011). The API supports correcting an already-released study atomically, but no UI reaches it since the ALREADY_PUBLISHED error that used to expose it is gone. Today the path is revoke-then-publish, which is two steps and leaves a brief gap.
- Audit trail for uploads and publications (an append-only `file_events` table). The trigger, per DEC-007, is the first time someone has to answer "who vouched for what, and when" for a real complaint — not before.
- Expiration or archival rules for old records.
- Sweep old `public_lookup_attempts` rows. Not a correctness issue (each row is scoped to its own window and inert once past), just accumulation — add a cleanup path if the table's size becomes a real cost, not before.
- Close the coverage gap on `backend/src/data/users.repo.ts` (0% today, see DEC-019) and raise `src/data/**`'s branch threshold accordingly.
- CI (GitHub Actions or equivalent) running `check` + `test` + `test:coverage` + `build` on every push — deliberately not set up alongside the coverage/QA policy in this pass; the policy is enforced by convention (`docs/06-quality.md`) until it's enforced by a pipeline.
- `Range`/`Accept-Ranges` support on `GET /files/:fileId` — not needed today since the manager viewer fetches the whole file as one `ArrayBuffer` (DEC-022), but would let pdf.js load progressively if result PDFs ever grow well past a few pages.
- Cursor pagination on `GET /records` — `?offset=` shipped in the checkpoint F UX pass (real `total`, `?q=`, manager "Cargar más"), but it is still offset, not cursor: it can repeat or skip a row if the underlying list changes between pages. Accepted at a queue of tens to low hundreds; revisit only if a tab or list routinely grows past that.
- pdf.js standard fonts/CMaps, deliberately left disabled (DEC-022) — add if a real lab result PDF ever renders with missing glyphs.
- Verify the DEC-024 refinement pass on real assistive tech: a screen-reader run (NVDA/VoiceOver) over the new skip links, per-field errors and dialog focus-return, an automated contrast audit, and `docs/06-quality.md`'s Flow D on a real iPhone. The pass in `docs/07-ux-refinement-plan.md` was verified by build, tests and a headless console check only — none of those prove any of the three.
- ~~Consolidate the dropzone wiring~~ **Done** — `scripts/shared/dropzone.js#attachDropzone`, checkpoint A of the 2026-08 UX pass; all three upload paths (`/admin/nuevo`, both of `/admin/folio`'s file sheets) share it now.
- Decide the phantom `delete` action: `ACTIONS.UPLOADED` in `frontend/src/scripts/admin/status.js` lists it, but no UI offers it, so an employee has no way to remove an erroneous draft before confirming (only replace its PDF). Either the table is stale or the flow was never built — needs a product call, not an agent's guess.
- **Open decision, needs a person, not an agent:** whether to relax DEC-015 for a caller who has already supplied a correct folio+phone+birth date, so `/resultados` could say "found your record, it's just not published yet" instead of the collapsed generic message. `docs/01-domain.md`'s patient story asks for exactly that; DEC-015 currently wins and the story is answered with static, unconditional copy instead. Revisit only with the product owner in the room — it's a real trade against `public-lookup.test.ts`'s non-enumeration guarantee, not a bug.
- **Open decision, needs a person, not an agent:** a 2026-08 UX-polish brief asked for email/address/doctor/ID icons on the patient record. None of those four fields exist in `patients`/`records` (`database/migrations/0002_records.sql`) — the icon system (DEC-028) can render them the moment the columns do, but adding the columns is a migration plus a validation, intake-form and public-lookup-surface decision, not something to add speculatively for an icon to point at.
- **Download token travels in the URL path.** `/api/public/results/<token>/download/<fileId>` lands in Cloudflare's own edge logs and any intermediate proxy log the same way a query param would, even though the token never enters browser history or the address bar (DEC-022's checkpoint E amendment already removed that half of the exposure via `fetch()` + `blob:` URLs). Blast radius is small — five-minute TTL, record-scoped (DEC-023) — but real if log retention is long. Moving the token to a header or a POST body is a real API-shape change (DEC-023's route signature), not a quick patch; revisit only if log retention policy actually makes this matter.
- **WARP-based device posture for the manager's iPhone.** Stated future direction, not yet scoped as work. A MAC address is not available to any web backend — it never survives a router hop — so "restrict admin to a known device" has to mean something Cloudflare Access actually offers: IP allowlisting (closest to "known device" if the admin team has a fixed egress IP), WARP device posture (Cloudflare's real device-trust mechanism, needs per-device enrollment), or mTLS client certificates (same enrollment cost as posture checks). All three are Access dashboard/policy configuration, not application code in this repo. No implementation work is scoped; this entry exists so the constraint isn't rediscovered from scratch next time it comes up.
- **Dev-only `pnpm audit` transitives, reviewed 2026-08-05.** 12 advisories remain after the hono/astro bumps that fixed the two runtime-reachable ones (DEC-030's commit): undici, postcss, sharp, svgo, yaml, fast-uri — all transitive dependencies of `wrangler`, `vitest`, or the Astro build toolchain. None of these run inside the deployed Worker or ship to a browser; they exist only in the local/CI dev and build environment. Deferred rather than chased — re-review if any of the direct dependencies that pull them in (`wrangler`, `@cloudflare/vitest-pool-workers`, `astro`) gets a major bump anyway.

- **astro check: 672 errors, all confined to inline page `<script>` blocks, zero in any extracted `scripts/**/*.js` module.** That split is itself the finding: `document.getElementById()`'s `T | null` return, combined with every page's own hand-rolled `const $ = (id) => document.getElementById(id)`, is what the errors are — TS correctly refusing to let `$(id).value` or `$(id).hidden` through without a null check or a cast. Tried and abandoned this pass: a JSDoc-typed `$` helper (`/** @type {HTMLElement} */ (document.getElementById(id))`) cast inline in `admin/index.astro` — it did not suppress the errors (Astro's inline-`<script>` checker does not appear to honor a JSDoc `@type` cast on an arrow-function `const` the way a real `.ts` file's checker would; the error count went *up*, from 16 to 20, and the change was reverted rather than shipped not working). The pattern that provably works, because every file under `scripts/` already proves it at 0 errors: extract a page's logic into a real, imported `.js`/`.ts` module instead of trying to type-annotate JSDoc inside an inline script. That is a real per-page refactor (each of the 8 admin/patient pages, worst offenders `manager.astro` at 164 and `folio.astro` at 155), not a mechanical sweep — sequence it as its own pass, one page at a time, each with its own before/after error count and a full test run, not attempted alongside unrelated feature work.
