# DuoLab Backend

Cloudflare Worker (Hono) backing the admin tool and, later, the patient portal. See `docs/01-domain.md`, `docs/02-architecture.md`, and `docs/03-decisions.md` at the repo root for the product and architecture context this assumes.

## Structure

```
src/
  index.ts               app wiring only — middleware, route mounting, error handlers
  env.ts                 Bindings, Variables, AppContext types
  domain/                pure functions — no I/O, no Hono, no D1
  data/                  the only code that touches D1 or R2
  services/              operations spanning two stores or enforcing lifecycle rules
  http/                  middleware and route modules
```

Two invariants are worth keeping and are grep-checkable:

```sh
grep -rnE "SELECT |INSERT INTO|UPDATE .*SET|DELETE FROM" src --include="*.ts" | grep -v "^src/data/"
grep -rn "RESULTS_BUCKET" src --include="*.ts" | grep -vE "^src/(data/storage|env)\.ts"
```

Both should print nothing. See `docs/03-decisions.md` DEC-005 for why the structure stops here rather than going further.

## Local development

```sh
cp .dev.vars.example .dev.vars    # first time only; gitignored, never deployed
pnpm install
pnpm dev:setup                    # applies pending D1 migrations — do this first
pnpm dev                          # wrangler dev, default port 8787
pnpm dev:seed                     # in another terminal, with dev running
```

This is the native flow, run from `backend/`. From the repo root, `docker compose up` runs the equivalent commands for both `frontend/` and `backend/` inside a container — same ports, same Miniflare-backed D1/R2, `.dev.vars` seeded from `.dev.vars.example` on first start. Local D1/R2 state lives in a named Docker volume rather than `backend/.wrangler/`, so the two flows never share or corrupt each other's data; run `docker compose down -v` to reset it. See the root `README.md` and `docs/08-environments.md`.

`dev:setup` before `dev` is not optional after pulling a branch that added a migration: `wrangler dev` will happily start against a stale local schema and every request touching the new column 500s with `no such column`. It is idempotent, so running it when nothing is pending costs nothing.

`dev:seed` fills the local database with data worth walking a QA script over — an accented patient name, one patient with two folios, and a folio carrying all four result states at once. It talks to the running Worker rather than to D1 directly, so R2 and D1 stay in step (see `scripts/seed.mjs`). Publishing needs `DEV_ROLE=manager`.

`.dev.vars` enables the Cloudflare Access bypass (`ENVIRONMENT=local`) — Access JWTs are injected at Cloudflare's edge and cannot exist on localhost — and picks the role the bypass identity gets (`DEV_ROLE=employee|manager`). Restart `wrangler dev` after changing `DEV_ROLE`.

It also carries two self-generated secrets the public routes need — neither is a Cloudflare resource id, generate your own rather than reusing the values below:

```sh
RATE_LIMIT_KEY_SECRET=$(openssl rand -base64 24)   # HMAC key for rate-limit fingerprints
DOWNLOAD_TOKEN_SECRET=$(openssl rand -base64 32)   # AES-256-GCM key for download tokens, must decode to exactly 32 bytes
```

### Migrations

```sh
pnpm wrangler d1 migrations apply duolab --local
```

Migrations are applied in order from `../database/migrations/`. The test suite applies the same files, so there is one schema, not two.

`wrangler dev` does not re-apply migrations to an already-initialized local D1 state on its own — after adding a new migration file, run the command above again (it only applies the ones not yet recorded) before starting the dev server, or requests touching the new table will 500 with `no such table`.

### Public routes

`POST /api/public/results/lookup` and `GET /api/public/results/:downloadToken/download` (`http/routes/public/`) carry no `requireAccess` — patients are never Cloudflare Access users (DEC-012). Everything that keeps them safe to expose is in the handler itself: rate limiting on the lookup route, one generic failure response for every non-rate-limit failure, and an opaque encrypted download token re-checked against a live `PUBLISHED` status on every download (DEC-014, DEC-015). Do not add `requireAccess` to these — and do not widen the internal `GET /files/:fileId` to serve patients instead.

### Seeding a user

No users are seeded by migration — real staff addresses do not belong in the repository (DEC-006). Add one by hand:

```sh
pnpm wrangler d1 execute duolab --local --command \
  "INSERT INTO users (email, role) VALUES ('ana@duolab.mx', 'MANAGER');"
```

Email must already be lowercase and trimmed — the schema's `CHECK` constraint enforces this and will reject anything else. Deactivate a departing staff member rather than deleting them, so `confirmed_by`/`published_by` history stays attributable:

```sh
pnpm wrangler d1 execute duolab --local --command \
  "UPDATE users SET active = 0 WHERE email = 'ana@duolab.mx';"
```

## Testing

```sh
pnpm test          # vitest run, once
pnpm test:watch
pnpm check          # tsc --noEmit
```

Tests run inside workerd with real D1 and R2 bindings via `@cloudflare/vitest-pool-workers` and Miniflare — not mocks. `@cloudflare/vitest-pool-workers` is pinned to `0.18.6` because it depends on `miniflare@4.20260714.0`, which is what the installed `wrangler` version resolves; newer releases have moved past what is currently installable. Check both before bumping either package.

## Recovering an orphaned R2 object

See DEC-009. If the compensating delete after a failed upload also fails, the object is unreachable (no code path reads by unlisted key) but still billed. Grep the Worker logs for the structured event:

```
{"event":"ORPHAN_R2_OBJECT","reason":"...","r2Key":"records/<recordId>/<fileId>.pdf","recordId":"...","fileId":"...","requestId":"..."}
```

Confirm no `files` row holds that key, then delete it directly:

```sh
pnpm wrangler r2 object delete duolab-results/records/<recordId>/<fileId>.pdf
```

There is no automated reconciliation sweep. Add one if these start appearing at a rate this can't keep up with.

## Deploying

One Worker serves both the built frontend and the API on a single origin (DEC-020). This is true in every environment (DEC-025), so both runbooks below share the same shape — staging is not a lighter version of this, it is a rehearsal of it against separate resources. `pnpm run deploy:staging` / `pnpm run deploy:production` build the frontend with an empty `PUBLIC_API_BASE` and then deploy the matching Worker — run one of those rather than `wrangler deploy` directly, or the Worker ships whatever `frontend/dist` happened to be lying around, built against the wrong API base. The bare `pnpm run deploy` refuses to run; there is deliberately no unqualified deploy.

Staging deploys from a clean `develop`. Production deploys from a clean `main`, and only after the same change has already gone through staging.

### Staging (first-time setup)

Nothing below has been done yet — `wrangler.jsonc`'s `env.staging` still carries the placeholders `STAGING_DATABASE_ID_PENDING` and `STAGING_ACCESS_AUD_PENDING`. In order:

**1. Create the resources**

```sh
wrangler d1 create duolab-staging
wrangler r2 bucket create duolab-results-staging
```

Put the returned database id into `wrangler.jsonc`, replacing `STAGING_DATABASE_ID_PENDING` under `env.staging.d1_databases`.

**2. Apply the migrations remotely**

```sh
pnpm run migrate:staging
```

Tracked independently from local and from production — each `--remote`/environment pair has its own applied-migrations record.

**3. Set the secrets**

```sh
wrangler secret put RATE_LIMIT_KEY_SECRET --env staging     # openssl rand -base64 24
wrangler secret put DOWNLOAD_TOKEN_SECRET --env staging     # openssl rand -base64 32, must decode to exactly 32 bytes
```

Generate fresh values, independent from both local and production. A staging-minted download token must never validate in production, and it won't as long as this step is never skipped by reusing a value from somewhere else.

**4. Configure Cloudflare Access**

Set `env.staging.vars.CLOUDFLARE_ACCESS_AUDIENCE` in `wrangler.jsonc` to the real value once the application below exists — it currently ships as `STAGING_ACCESS_AUD_PENDING`. `CLOUDFLARE_ACCESS_TEAM_DOMAIN` is already correct; staging uses the same Cloudflare Access account as production, a separate application within it.

Create one self-hosted Access application for `staging.laboratoriosduolab.com`, with a destination for **each** of these paths — the same list as production, not the whole hostname (DEC-025):

```
/admin*      /records*      /files*      /me      /search*      /patients*
```

Do **not** include `/api/public/*` or the landing. Protecting the whole hostname was considered and rejected: it would make the patient flow — the most publicly exposed surface in the product — the one surface staging cannot exercise from a browser (DEC-025). Its policy can allow a narrower set of staff addresses than production; the path list itself must match.

**5. First deploy, then attach the custom domain**

Before the real deploy, dry-run it with `pnpm run deploy:staging:dry-run` — never `pnpm run deploy:staging -- --dry-run`. A trailing `--` terminates Wrangler's own option parsing, so everything after it (including `--dry-run`) is dropped and the "dry run" deploys for real. Confirm the dry-run output contains no `Uploaded`, no `Deployed`, no public URL, and no Version ID before proceeding.

The first deploy has no custom domain yet, so it lands on `*.workers.dev`:

```sh
pnpm run deploy:staging
```

Once it succeeds, add `staging.laboratoriosduolab.com` as a custom domain on the `duolab-staging` Worker, then in `wrangler.jsonc` set `env.staging.workers_dev` to `false` and uncomment `env.staging.routes`. Redeploy. Leaving `workers_dev: true` alongside a working custom domain would leave the app reachable on a second hostname the Access application above never covers.

**6. Seed the staff users**

```sh
wrangler d1 execute duolab-staging --env staging --remote --command \
  "INSERT INTO users (email, role) VALUES ('ana@duolab.mx', 'MANAGER');"
```

**7. Check**

Confirm both halves answer on `staging.laboratoriosduolab.com` — the landing and `/resultados` (public, no Access) as HTML, `/admin` behind the Access login page, `/health` as JSON. If `/health` returns the 404 page instead of JSON, `assets.not_found_handling` is wrong; it must be `"none"` (DEC-020).

### Production (first-time setup)

Only after the change has been verified on staging. Same shape as above, against the top-level (non-`env`) configuration:

**1. Create the resources**

```sh
wrangler d1 create duolab
wrangler r2 bucket create duolab-results
```

Put the returned database id into `wrangler.jsonc` — it currently ships the placeholder `00000000-0000-0000-0000-000000000000`.

**2. Apply the migrations remotely**

```sh
pnpm run migrate:production
```

**3. Set the secrets**

```sh
wrangler secret put RATE_LIMIT_KEY_SECRET     # openssl rand -base64 24
wrangler secret put DOWNLOAD_TOKEN_SECRET     # openssl rand -base64 32, must decode to exactly 32 bytes
```

Generate fresh values, independent from both local and staging.

**4. Configure Cloudflare Access**

Set `vars.CLOUDFLARE_ACCESS_TEAM_DOMAIN` and `vars.CLOUDFLARE_ACCESS_AUDIENCE` in `wrangler.jsonc` to the real values — the audience currently ships as `"my-access-aud"`.

Create one self-hosted application for `laboratoriosduolab.com` with a destination for **each** of these paths, and a policy allowing the lab's staff addresses:

```
/admin*      /records*      /files*      /me      /search*      /patients*
```

Do **not** include `/api/public/*` or the landing — patients are not Access users (DEC-012).

Access is not an extra layer here: it is what injects the `Cf-Access-Jwt-Assertion` header that `requireAccess` reads. A path left off this list receives no identity and answers 401, so the failure is loud rather than silent — but it is a failure. See DEC-020 for why the list is six entries rather than one, and what would shorten it.

**5. Seed the staff users**

An Access-verified address with no `users` row gets 403, not employee-by-default (DEC-006). For each staff member:

```sh
wrangler d1 execute duolab --remote --command \
  "INSERT INTO users (email, role) VALUES ('ana@duolab.mx', 'MANAGER');"
```

**6. Deploy and check**

```sh
pnpm run deploy:production
```

Then confirm both halves answer on the deployed origin — the landing and `/admin` as HTML, `/health` as JSON.

Finally, verify `.dev.vars` did not ship. It is gitignored and `wrangler deploy` does not read it, but the cost of checking is far below the cost of being wrong.
