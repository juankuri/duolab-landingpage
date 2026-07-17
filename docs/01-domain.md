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

A patient receives or knows a folio. A record is created for that folio. One or more PDF files can belong to that record. Internal staff manage the record lifecycle. Patients can only access records that have been published.

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

## Business Rules

- A patient must not access unpublished records.
- Result files are PDFs.
- A record is identified by a folio.
- Employees may upload files.
- Managers may publish files.
- Raw internal workflows should stay simple unless the domain proves they need more structure.
- Unique and immutable folio
- Folio, name and phone are obligatory when creating a record
- A record must have a PDF so it can be confirmed
- Replacing a PDF, deletes the previous one (not versioned)

## User Stories

### Patient

- As a patient, I want to find my results using my folio, phone number, and birth date so I can access my available result files.
- As a patient, I want to download all published PDFs associated with my record so I can receive results released on different dates.
- As a patient, I want to know when my results are not yet available so I understand I should check back later.
- As a patient, I want to have an help button to whatsapp so when I have an issue or a problem I cant contact the lab and get help.

### Employee

- As an employee, I want to create a patient record with a folio so future result files can be associated with it.
- As an employee, I want to upload a result PDF to a record so it can be prepared for delivery.
- As an employee, I want to have a "preview" button so I can make sure I am uploading the right file at any moment.
- As an employee, I want to confirm that I reviewed an uploaded PDF so it is ready for managerial validation.
- As an employee, I want a way to change the file I have uploaded to a patient so when I see a mistake I can fix it

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
