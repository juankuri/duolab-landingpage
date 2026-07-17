# Decisions

## DEC-001: Keep top-level technical layers

Status: Accepted

The repository is organized by technical layer at the top level:

- `frontend/`
- `backend/`
- `database/`
- `docs/`
- `branding/`

This structure makes the repository feel like the DuoLab product rather than a single Astro project.

## DEC-002: Keep documentation lightweight

Status: Accepted

Documentation should preserve domain knowledge and product decisions. Raw discovery, handoff notes, generated specs, and process-heavy project-management artifacts should not be canonical documentation.

Canonical documentation lives in:

- `docs/01-domain.md`
- `docs/02-architecture.md`
- `docs/03-decisions.md`
- `docs/04-backlog.md`
- `branding/brand.md`
- `branding/copy.md`
- `branding/guidelines.md`

## DEC-003: Stay Cloudflare-first

Status: Accepted

The architectural direction is Cloudflare-first:

- Pages
- Workers
- D1
- R2
- Access

This keeps deployment and operations simple for the current product scale.

## DEC-005=4: Evaluate Hono for the Backend API

Status: Proposed

Hono is a candidate backend framework for the Cloudflare Workers API. It should not be treated as final until backend implementation begins.
