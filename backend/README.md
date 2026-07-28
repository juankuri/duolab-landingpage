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

One Worker serves both the built frontend and the API on a single origin (DEC-020). `pnpm deploy` from the repo root builds the frontend with an empty `PUBLIC_API_BASE` and then deploys the Worker — run it that way rather than `wrangler deploy` directly, or the Worker ships whatever `frontend/dist` happened to be lying around, built against the wrong API base.

Nothing below has been done yet. In order:

**1. Create the resources**

```sh
wrangler d1 create duolab
wrangler r2 bucket create duolab-results
```

Put the returned database id into `wrangler.jsonc` — it currently ships the placeholder `00000000-0000-0000-0000-000000000000`.

**2. Apply the migrations remotely**

```sh
wrangler d1 migrations apply duolab --remote
```

A separate step from the local one, and easy to forget: `--local` and `--remote` track what they have applied independently.

**3. Set the secrets**

```sh
wrangler secret put RATE_LIMIT_KEY_SECRET     # openssl rand -base64 24
wrangler secret put DOWNLOAD_TOKEN_SECRET     # openssl rand -base64 32, must decode to exactly 32 bytes
```

Generate fresh values. A local `.dev.vars` value is dev-only by convention, and copying it makes that convention false.

**4. Configure Cloudflare Access**

Set `vars.CLOUDFLARE_ACCESS_TEAM_DOMAIN` and `vars.CLOUDFLARE_ACCESS_AUDIENCE` in `wrangler.jsonc` to the real values — the audience currently ships as `"my-access-aud"`.

Then create one self-hosted application with a destination for **each** of these paths, and a policy allowing the lab's staff addresses:

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
pnpm deploy      # from the repo root
```

Then confirm both halves answer on the deployed origin — the landing and `/admin` as HTML, `/health` as JSON. If `/health` returns the 404 page instead of JSON, `assets.not_found_handling` is wrong; it must be `"none"` (DEC-020).

Finally, verify `.dev.vars` did not ship. It is gitignored and `wrangler deploy` does not read it, but the cost of checking is far below the cost of being wrong.
