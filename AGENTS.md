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

## Calidad y pruebas

The full policy — test taxonomy, per-slice Definition of Done, coverage thresholds, manual QA scripts, and the guardrail tests no agent may weaken — lives in `docs/06-quality.md`. Read it before touching `backend/` or `frontend/`. The non-negotiables:

- New logic ships with tests in the same commit — the happy path, the edges, and the expected failure by its error code.
- Before calling anything done, run the full Definition of Done from `docs/06-quality.md`: `check`, `test`, `test:coverage`, `build`, plus the relevant manual QA script.
- Coverage thresholds only move up. Never lower one to make a command pass.

## Learning First

This repository is both a real product and a learning project.

When introducing a new framework, library or platform:

1. Prefer the smallest complete implementation.
2. Explain architectural decisions.
3. Avoid hiding important abstractions.
4. Let the developer implement the first representative example.
5. Automate repetitive work only after the pattern has been understood.