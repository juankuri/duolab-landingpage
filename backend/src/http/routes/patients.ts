import { Hono } from "hono";

import * as recordsRepo from "../../data/records.repo";
import { AppError } from "../../domain/errors";
import {
  isUuid,
  validateBirthDate,
  validateFullName,
  validatePhoneNumber,
} from "../../domain/validation";
import type { AppEnv } from "../../env";

export const patients = new Hono<AppEnv>();

/**
 * A patient and every folio they have, each with its own tally — the
 * Flow C entry point: "+ Nuevo folio" here needs only a folio and a PDF,
 * because the patient is already known.
 */
patients.get("/:patientId", async (c) => {
  const patientId = c.req.param("patientId");

  if (!isUuid(patientId)) {
    throw new AppError("INVALID_INPUT", "El identificador del paciente no es válido.");
  }

  const patient = await recordsRepo.findPatient(c.env.DB, patientId);

  if (!patient) {
    throw new AppError("NOT_FOUND", "No encontramos al paciente.");
  }

  const folios = await recordsRepo.listFoliosForPatient(c.env.DB, patientId);

  return c.json({
    patient: {
      patientId: patient.patient_id,
      fullName: patient.full_name,
      birthDate: patient.birth_date,
      phoneNumber: patient.phone_number,
      folios: folios.results.map((row) => ({
        recordId: row.record_id,
        folio: row.folio,
        results: recordsRepo.tallyFromCounts(row),
      })),
    },
  });
});

/**
 * Edits an existing patient's name, phone or birth date — each field
 * optional, `patientId` never among them. Mounted behind `requireAccess`
 * only, exactly like every other non-publish route: MANAGER may do this
 * because it is a strict superset of EMPLOYEE (DEC-013's satisfies()),
 * not because of a new rule invented for this endpoint. `POST
 * /files/:id/publish` remains the only role-gated action in the app.
 *
 * Phone and birth date are two of the three public-lookup authentication
 * factors (see services/public-result-service.ts) — editing either re-keys
 * who can download this patient's published results. The frontend is
 * responsible for surfacing that consequence before submitting; this route
 * only validates and writes.
 */
patients.patch("/:patientId", async (c) => {
  const patientId = c.req.param("patientId");

  if (!isUuid(patientId)) {
    throw new AppError("INVALID_INPUT", "El identificador del paciente no es válido.");
  }

  const existing = await recordsRepo.findPatient(c.env.DB, patientId);

  if (!existing) {
    throw new AppError("NOT_FOUND", "No encontramos al paciente.");
  }

  const body: Record<string, unknown> = await c.req.json().catch(() => ({}));
  const fields: Record<string, string> = {};
  const changes: { fullName?: string; birthDate?: string; phoneNumber?: string } = {};

  if (body.fullName !== undefined) {
    const name = validateFullName(body.fullName);
    if (!name.ok) fields.fullName = name.error;
    else changes.fullName = name.value;
  }

  if (body.birthDate !== undefined) {
    const birth = validateBirthDate(body.birthDate);
    if (!birth.ok) fields.birthDate = birth.error;
    else changes.birthDate = birth.value;
  }

  if (body.phoneNumber !== undefined) {
    const phone = validatePhoneNumber(body.phoneNumber);
    if (!phone.ok) fields.phoneNumber = phone.error;
    else changes.phoneNumber = phone.value;
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("INVALID_INPUT", "Revisa los datos del formulario.", { fields });
  }

  if (Object.keys(changes).length === 0) {
    throw new AppError("INVALID_INPUT", "No hay cambios para guardar.");
  }

  await recordsRepo.updatePatient(c.env.DB, patientId, changes);
  const updated = await recordsRepo.findPatient(c.env.DB, patientId);

  return c.json({
    patient: {
      patientId: updated!.patient_id,
      fullName: updated!.full_name,
      birthDate: updated!.birth_date,
      phoneNumber: updated!.phone_number,
    },
  });
});
