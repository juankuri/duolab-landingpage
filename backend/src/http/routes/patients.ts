import { Hono } from "hono";

import * as recordsRepo from "../../data/records.repo";
import { AppError } from "../../domain/errors";
import { isUuid } from "../../domain/validation";
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
