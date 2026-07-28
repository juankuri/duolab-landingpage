# Domain

## Objective

Allow DuoLab patients to access their laboratory result PDFs online while preserving a simple operating model for the laboratory team.

The product should reduce manual friction without forcing the lab into a complex clinical system.

## Context

DuoLab is a clinical analysis and pathology laboratory in Ciudad del Carmen, Campeche.

The current public website helps people understand the lab, resolve common doubts, and start a WhatsApp conversation. Phase 2 introduces the foundation for online result delivery and internal administration.

The long-term product is composed of:

- Landing
- Patient Portal
- Admin Portal

The repository should preserve product and domain knowledge, not raw project-management artifacts.

## Vocabulary

Patient
: Person who consults laboratory results.

Record
: Represents one laboratory result delivery identified by a folio.

File
: PDF belonging to a Record.

Employee
: Authorized internal user who can upload result files.

Manager
: Authorized internal user who can publish result files.

Folio
: Human-readable identifier used by employees and patients to find a Record.

Landing
: Public website used by prospective patients to understand DuoLab and contact the lab.

Patient Portal
: Private area where patients consult published result files.

Admin Portal
: Internal area where authorized staff upload and publish result files.

## Domain

The core Phase 2 domain is result delivery.

A patient receives or knows a folio. A record is created for that folio together with its first result — a folio cannot exist without one. A record holds one or more results, each with its own independent status; the record itself has no status of its own, only a derived tally of what its results are in. Internal staff manage each result's lifecycle. Patients can only access results that have been published.

## Entities

Patient
: External user who consults results.

Record
: Result delivery unit. Identified by folio. Owns files and publication state.

File
: Stored PDF attached to a record.

Employee
: Internal actor who uploads files.

Manager
: Internal actor who can publish files.

Folio
: Stable, human-readable lookup key.

## File Lifecycle

A file moves through four states, each owned by a different actor's decision:

```
                 confirm            publish           revoke
    UPLOADED ─────────────> CONFIRMED ────────> PUBLISHED ────────> REVOKED
        ^                       │       ↖           (terminal)
        └────── withdraw ───────┘ ──────replace──────────┘
```

UPLOADED
: An employee attached the PDF. Nobody has vouched for it yet.

CONFIRMED
: An employee reviewed it and put their name to it. Ready for managerial validation. May be returned to UPLOADED ("withdraw") if the employee confirmed by mistake — this is the only backward move confined to before publication, where nothing has been visible to a patient.

PUBLISHED
: A manager released it. This is the only state a patient may see. At most one file per record may be in this state at a time.

REVOKED
: A file was withdrawn — by an employee or a manager, either may revoke. Terminal — a revoked file is never published again. Correcting a mistake means uploading and confirming a new file, not resurrecting the old one.

Only an UPLOADED file may be deleted outright. A CONFIRMED file must be withdrawn first; a PUBLISHED or REVOKED file is never deleted — after publication, the record of what a patient could see is the point.

A result's PDF may also be **replaced** — from UPLOADED, CONFIRMED, or PUBLISHED — which swaps the file and sends it back to UPLOADED, clearing whatever confirmation or publication it had. This is the one path that reaches back from the patient-visible half of the lifecycle: replacing a published result hides it from the patient immediately, before the new PDF is even written, and the corrected file must be confirmed and published again like any other result. REVOKED stays terminal for the revoke path specifically — a revoked file cannot be replaced; correcting it means a fresh upload.

## Business Rules

- A patient must not access unpublished records.
- Result files are PDFs.
- A record is identified by a folio.
- Employees may upload files.
- Managers may publish files.
- Raw internal workflows should stay simple unless the domain proves they need more structure.
- Unique and immutable folio
- Folio, name, phone and a first PDF are all required to create a record — a record cannot exist without a result
- Employees or managers may revoke a published file, not managers alone
- Replacing a PDF deletes the previous one (not versioned)

## User Stories

### Patient

- As a patient, I want to find my results using my folio, phone number, and birth date so I can access my available result files.
- As a patient, I want to download all published PDFs associated with my record so I can receive results released on different dates.
- As a patient, I want to know when my results are not yet available so I understand I should check back later.
- As a patient, I want to have an help button to whatsapp so when I have an issue or a problem I cant contact the lab and get help.

### Employee

- As an employee, I want to create a patient, a folio and its first result in one step so a folio is never left without a result.
- As an employee, I want to search by folio, patient name or phone so I can find a folio or a patient without knowing which one I have.
- As an employee, I want to add another result to an existing folio without touching the results already there.
- As an employee, I want to start a new folio for a patient I already have on file without retyping their information.
- As an employee, I want to have a "preview" button so I can make sure I am uploading the right file at any moment.
- As an employee, I want to confirm that I reviewed an uploaded PDF so it is ready for managerial validation, in one click.
- As an employee, I want a way to replace the file I have uploaded — even after it was confirmed or published — so when I see a mistake I can fix it.
- As an employee, I want to revoke a published PDF myself when I spot a mistake, without needing a manager to do it for me.

### Manager

- As a manager, I want to review confirmed PDFs so I can ensure they are correct before publishing them.
- As a manager, I want to publish a result file so patients can access it.
- As a manager, I want to revoke a published PDF so incorrect files are no longer accessible to patients.

## Out of Scope

- Full laboratory information management system.
- Medical interpretation of results.
- Online payment.
- Appointment scheduling.
- Patient medical history beyond result delivery.
