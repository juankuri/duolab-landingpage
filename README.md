# DuoLab

DuoLab is a product for a clinical analysis and pathology laboratory in Ciudad del Carmen, Campeche.

The product currently includes a public website and is evolving toward online result delivery through a patient portal and an internal administration panel.

## Product

Logical applications:

- Public website
- Patient portal
- Internal administration panel

Technical layers:

- `frontend/`
- `backend/`
- `database/`

Supporting knowledge:

- `docs/`
- `branding/`

## Architecture

```text
Frontend
   |
   v
Backend API
   |
   v
Persistence
```

The deployment direction is Cloudflare-first:

- Pages
- Workers
- D1
- R2
- Access

See `docs/02-architecture.md` and `docs/03-decisions.md` for the current architectural notes and decisions.

Backend framework and deployment are Cloudflare Workers (Hono) — see `backend/README.md`. The frontend is Astro, in `frontend/`. In production, staging, and any local run of the built app, one Worker serves both (DEC-020); local day-to-day development runs Astro and the Worker as two servers.

## Development

Two supported flows — pick either, they run the same commands:

```sh
# containerized (documented default)
docker compose up

# native
pnpm install
pnpm run dev:setup    # apply pending D1 migrations, first time and after every pull
pnpm run dev
```

Both put Astro on `:4321` and the API on `:8787`, with a local D1/R2 backed by Miniflare. See `backend/README.md` for seeding data and users, and `docs/08-environments.md` for how local relates to staging and production.

```sh
pnpm run check          # tsc --noEmit
pnpm run test           # backend + frontend
pnpm run test:coverage
pnpm run build          # frontend/dist, ready for the Worker to serve
```

## Environments

Local, staging, and production share one topology — a single Worker per environment, serving the built frontend and the API on one origin — and differ only in which resources back it. See `docs/08-environments.md` and DEC-025. Deploys are manual for now:

```sh
pnpm run deploy:staging
pnpm run deploy:production
```

## Documentation

Canonical documentation is intentionally small:

- `docs/01-domain.md`
- `docs/02-architecture.md`
- `docs/03-decisions.md`
- `docs/04-backlog.md`
- `branding/brand.md`
- `branding/copy.md`
- `branding/guidelines.md`

Documentation should preserve durable product knowledge, not raw discovery or temporary project-management artifacts.
