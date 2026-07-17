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

## Frontend

The frontend is an Astro app.

```sh
cd frontend
pnpm install
pnpm dev
pnpm build
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
