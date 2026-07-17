# Agent Notes

## Repository Identity

This is the DuoLab product repository.

The top-level structure is intentionally organized by technical layer:

- `frontend/`
- `backend/`
- `database/`
- `docs/`
- `branding/`

Do not treat the repository as only an Astro landing page. The landing is one logical application within the broader product.

## Product Applications

- Public website
- Patient portal
- Internal administration panel

These applications share the same backend API and persistence layer.

## Documentation

Canonical documentation lives in:

- `docs/01-domain.md`
- `docs/02-architecture.md`
- `docs/03-decisions.md`
- `docs/04-backlog.md`
- `branding/brand.md`
- `branding/copy.md`
- `branding/guidelines.md`

Preserve domain knowledge. Remove raw discovery, stale handoffs, generated specs, and process-heavy artifacts when they no longer serve the product.

## Frontend Development

The frontend is in `frontend/`.

When starting the Astro dev server, use background mode:

```sh
cd frontend
astro dev --background
```

Manage the background server with:

```sh
astro dev stop
astro dev status
astro dev logs
```

Do not introduce frontend feature folders until there are multiple implemented product features that justify that structure.

## Architecture Direction

Cloudflare-first:

- Pages
- Workers
- D1
- R2
- Access

Backend framework choices belong in `docs/03-decisions.md` until implementation makes them definitive.
