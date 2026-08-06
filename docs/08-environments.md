# Environments

Three environments, one topology. The whole point of this document is that
staging is not a lighter version of production — it is the same shape with
different resources behind it. Anything that is true in production and false in
staging is a bug staging cannot catch.

## The model

| | local | staging | production |
|---|---|---|---|
| Purpose | day-to-day development | private release candidate | the live product |
| Branch | feature branches | `develop` | `main` |
| Worker | `wrangler dev` on `:8787` | `duolab-staging` | `duolab-api` |
| Hostname | `localhost` | `staging.laboratoriosduolab.com` | `laboratoriosduolab.com` |
| D1 | Miniflare local state | `duolab-staging` | `duolab` |
| R2 | Miniflare local state | `duolab-results-staging` | `duolab-results` |
| Access | bypassed (`ENVIRONMENT=local`) | real, production path policy | real |
| Deploy | n/a | manual, from a clean `develop` | manual, from a clean `main` |
| Audience | the developer | the lab, before release | patients and lab staff |

Promotion is one direction: feature branch → `develop` → staging → `main` →
production. A change reaches production only by having been on staging first.

## What is identical everywhere

These are not conveniences. Each one is a class of bug that staging exists to
catch, and breaking the symmetry in staging silently disables that.

**Single origin.** One Worker serves the built frontend as static assets and
falls through to the Hono API (DEC-020). `PUBLIC_API_BASE` is built empty in
both staging and production, so the browser uses relative URLs. The CORS policy
in `src/index.ts` sends no CORS headers outside local dev, which is only correct
because there is no cross-origin call to make. A staging setup that split the
frontend onto its own hostname would work in staging and break on the first
production deploy.

**The Access path policy.** Staging protects exactly the paths production
protects: `/admin*`, `/records*`, `/files*`, `/me`, `/search*`, `/patients*`,
excluding `/api/public/*` and the landing (DEC-020, DEC-012). Protecting the
whole staging hostname instead would be simpler and would make the patient flow
untestable in a browser — the surface with the most public exposure would be the
one surface staging never exercises.

**Schema and migrations.** Every environment runs the same ordered migrations
from `database/migrations`. Staging is never patched by hand; a schema change
reaches staging as a migration or not at all.

**The build.** `pnpm build` produces `frontend/dist` the same way for both, and
the Worker ships whatever is in that directory — which is why deploys go through
the root `deploy` script rather than a bare `wrangler deploy`.

## What differs, and only this

- **Resource identity**: separate D1 databases, separate R2 buckets, separate
  Worker names. No staging request can reach production data. This is the reason
  staging exists at all.
- **Secrets**: `RATE_LIMIT_KEY_SECRET` and `DOWNLOAD_TOKEN_SECRET` are generated
  independently per environment. A download token minted in staging must not
  validate in production.
- **Access application**: one per hostname, same path policy, staging's
  membership may be narrower.
- **Local only**: `ENVIRONMENT=local` and `DEV_ROLE` in `backend/.dev.vars`.
  These bypass Access, which cannot exist on `localhost` — Access JWTs are
  injected at Cloudflare's edge. They are read from a file `wrangler deploy`
  never uploads, and `isLocalDev()` gates every use, so they are inert anywhere
  else. Nothing else about local development is allowed to diverge.

## Configuration surface

`backend/wrangler.jsonc` holds one top-level configuration (local dev and
production) plus a `staging` environment. Wrangler environments do not inherit
bindings, so `env.staging` restates its D1, R2 and vars in full — a binding
omitted there is missing at runtime, not inherited.

Non-secret values live in `wrangler.jsonc` and are reviewable in git. Secrets
are set with `wrangler secret put --env <name>` and exist only in Cloudflare.
`backend/.dev.vars` is gitignored, never deployed, and its contents are never
printed into documentation, logs or issue threads.

## Cross-checking the live Access dashboard

Everything above about "the Access path policy" is a claim this repo makes about
Cloudflare dashboard configuration — nothing in the codebase can verify the live
dashboard actually matches it. This is a manual checklist to run by hand per
environment, not something a test suite here can cover.

**Per environment (staging, production), confirm in the Cloudflare Access dashboard:**

- The Access application's protected paths are exactly `/admin*`, `/records*`,
  `/files*`, `/me`, `/search*`, `/patients*` — no more, no fewer.
- `/api/public/*` and the landing (`/`, `/resultados`, the legal pages, `/404`)
  are **not** covered by any Access application.
- The session lifetime and refresh behavior configured for the application —
  this is pure dashboard config, `requireAccess` only verifies whatever JWT it's
  handed and has no opinion on how long that JWT is valid for or how it refreshes.
  Not verified as of this writing; record what's found here once checked.

**What each kind of drift actually looks like, so a finding can be read correctly:**

- **A protected path missing from the policy** fails loud, not open: no
  `Cf-Access-Jwt-Assertion` header reaches the Worker, `requireAccess` sees no
  token, and the route answers `401` to everyone, staff included. This is a
  broken feature to fix, not a silent exposure — the Worker's own
  `requireAccess` middleware is a second boundary regardless of what Access
  does (DEC-031 states plainly that it's the *only* one below Access itself).
- **`/api/public/*` accidentally included** makes the patient flow unreachable
  from a browser without an Access session — exactly the failure staging's
  policy is shaped to catch before it ever reaches production (see "What is
  identical everywhere" above).

## Local development

Two supported paths, deliberately equivalent:

- **Containerized** (documented default): `docker compose up`. The container
  pins Node and pnpm, so the environment is reproducible and disposable.
- **Native**: `pnpm install && pnpm dev`. Fully supported for anyone who already
  has the toolchain; it is the same commands the container runs.

Both run Astro on `:4321` and Wrangler on `:8787`, both use Miniflare's local
D1 and R2, and both are two-server setups — unlike staging and production, which
are single-origin. That difference is why `PUBLIC_API_BASE` defaults to
`http://localhost:8787` locally and is built empty for deploys, and it is the
one asymmetry the model accepts: `wrangler dev` cannot serve a live Astro dev
server as static assets. To exercise the real single-origin shape locally, build
first and run the Worker alone (see `README.md`).

## Deployment

Manual for now, from a clean working tree on the environment's branch. The
ordered runbook, including first-time Cloudflare resource creation and the
Access application, lives in `backend/README.md`.

GitHub automation is deliberately out of scope until the manual path has been
run end to end at least once. Automating a procedure nobody has performed
encodes assumptions instead of experience.

## Open items

- Production resources do not exist yet; `wrangler.jsonc` still carries the
  placeholder `database_id` and the placeholder Access audience.
- `develop` and `backup/phase-2-main` exist only locally. Staging deploys from
  `develop`, so `develop` must be published before that is meaningful.
