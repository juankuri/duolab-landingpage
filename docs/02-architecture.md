# Architecture

## Principles

- Security
- Simplicity
- Maintainability
- Scalability
- DRY
- SOLID
- No overengineering

## Context

DuoLab is a product repository, not only a public website.

The product has three logical applications that share the same backend and persistence layer:

- Landing
- Patient Portal
- Admin Portal

## Logical Applications

Landing
: Public website for patients and prospective patients. It explains the laboratory, answers common questions, and sends users to WhatsApp.

Patient Portal
: Private experience where patients consult published result records and download result PDFs.

Admin Portal
: Internal experience where authorized staff upload, review, and publish result files.

## Technical Layers

Frontend
: User interfaces for the logical applications. Currently Astro.

Backend API
: Shared application boundary for portal and admin workflows. The concrete framework is tracked in decisions.

Persistence
: Durable data and file storage.

## Logical Architecture

```text
Frontend
   |
   v
Backend API
   |
   v
Persistence
```

## Repository Layers

```text
frontend/
backend/
database/
docs/
branding/
```

The top-level repository is intentionally organized by technical layer. Inside each layer, the structure can evolve when the product has enough features to justify more organization.

## Deployment

Cloudflare-first, on a single origin:

- One Worker serves both the built frontend (as static assets) and the API. See DEC-020.
- D1 for relational persistence.
- R2 for result PDF storage.
- Cloudflare Access for authentication boundaries.

Cloudflare Pages was the earlier intention and is no longer used: a separate frontend host would put the browser on a different origin from the API, which the CORS policy deliberately does not allow (DEC-020).

This topology is deployed to three environments — local, staging and production — that differ in resource identity and never in shape. See `docs/08-environments.md` and DEC-025.

## Persistence

D1 stores structured product data such as records, folios, publication state, and audit-relevant metadata.

R2 stores binary result files such as PDFs.
