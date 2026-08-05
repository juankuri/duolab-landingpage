# Flow

## Public

Patient -> Landing -> Find Result -> Download PDF

## Inside

Search (folio · name · phone) -> Folio (N results, N statuses) -> Add result / Review & confirm -> Publish (manager) -> Replace / Revoke

Create -> Patient + folio + first result, one step -> Review & confirm -> back to Folio

## API

Internal (behind Cloudflare Access — `requireAccess`; see `docs/03-decisions.md` DEC-006, DEC-012):

```
POST   /records                                 — patient + folio + first result, multipart, atomic (DEC-016)
GET    /records                                 — ?limit=&status=, each with a results tally, not a single status
GET    /records/:recordId
GET    /records/by-folio/:folio
POST   /records/:recordId/files                 — add a further result to an existing folio
DELETE /records/:recordId/files/:fileId         — UPLOADED only
POST   /records/:recordId/files/:fileId/replace — swap a result's PDF (DEC-018)
GET    /files/:fileId                           — inline preview, employee-only
POST   /files/:fileId/confirm
POST   /files/:fileId/withdraw
POST   /files/:fileId/publish                   — manager only
POST   /files/:fileId/revoke                    — employee or manager (DEC-018)
GET    /search                                  — ?q=, folio/name/phone in one query
GET    /patients/:patientId                     — a patient with every folio they have
PATCH  /patients/:patientId                     — name/phone/birthDate, each optional (DEC-026); no requireRole, MANAGER inherits via DEC-013
GET    /records/folio-suggestion                — ?name= or ?patientId= -> {folio, initials, day, sequence} (DEC-027)
GET    /me
```

Public (no `requireAccess`; DEC-012, DEC-014, DEC-015):

```
POST /api/public/results/lookup                        — {folio, phone, birthDate} -> {downloadToken, expiresAt, patientDisplayName, results}
GET  /api/public/results/:downloadToken/download/:fileId
```

## Contract — POST /records

Multipart. Either `patientId` (an existing patient, Flow C) **or** `fullName` + `birthDate` + `phoneNumber` (a new one, Flow A). Always: `folio`, `file`.

Request (`multipart/form-data`)

```
fullName | patientId
birthDate       (omitted with patientId)
phoneNumber     (omitted with patientId)
folio
file            (PDF)
```

Response

```
201
{
  recordId, patientId, folio, fileId, status: "UPLOADED"
}
```

`409 FOLIO_CONFLICT` with `{ existingRecord }` if the folio already has a record.
