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
pnpm dev                          # wrangler dev, default port 8787
```

`.dev.vars` enables the Cloudflare Access bypass (`ENVIRONMENT=local`) — Access JWTs are injected at Cloudflare's edge and cannot exist on localhost — and picks the role the bypass identity gets (`DEV_ROLE=employee|manager`). Restart `wrangler dev` after changing `DEV_ROLE`.

### Migrations

```sh
pnpm wrangler d1 migrations apply duolab --local
```

Migrations are applied in order from `../database/migrations/`. The test suite applies the same files, so there is one schema, not two.

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

## Before deploying

Not done yet — `wrangler.jsonc` still ships placeholders:

- `d1_databases[0].database_id` is `00000000-0000-0000-0000-000000000000`.
- `vars.CLOUDFLARE_ACCESS_AUDIENCE` is `"my-access-aud"`.

Both must be replaced with real values, and Cloudflare Access must be configured for the admin origin, before this Worker can be deployed. Confirm `.dev.vars` is absent from the deployed bundle (it is gitignored and not read by `wrangler deploy`, but verify).
