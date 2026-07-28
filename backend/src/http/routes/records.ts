import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as recordsRepo from "../../data/records.repo";
import { AppError } from "../../domain/errors";
import { isFileStatus } from "../../domain/file-lifecycle";
import {
  MAX_UPLOAD_BYTES,
  isPdf,
  isUuid,
  validateBirthDate,
  validateFolio,
  validateFullName,
  validatePhoneNumber,
} from "../../domain/validation";
import type { AppContext, AppEnv } from "../../env";
import * as recordService from "../../services/record-service";
import { requestId } from "../errors";

export const records = new Hono<AppEnv>();

records.post("/", async (c) => {
  const body: Record<string, unknown> = await c.req.json().catch(() => ({}));

  // Every field is validated before any is used, so one response can name
  // every problem at once instead of making the employee submit again to
  // discover the next one.
  const name = validateFullName(body.fullName);
  const birth = validateBirthDate(body.birthDate);
  const phone = validatePhoneNumber(body.phoneNumber);
  const reference = validateFolio(body.folio);

  if (!name.ok || !birth.ok || !phone.ok || !reference.ok) {
    const fields: Record<string, string> = {};

    if (!name.ok) fields.fullName = name.error;
    if (!birth.ok) fields.birthDate = birth.error;
    if (!phone.ok) fields.phoneNumber = phone.error;
    if (!reference.ok) fields.folio = reference.error;

    throw new AppError("INVALID_INPUT", "Revisa los datos del formulario.", {
      fields,
    });
  }

  const fullName = name.value;
  const birthDate = birth.value;
  const phoneNumber = phone.value;
  const folio = reference.value;

  const patientId = crypto.randomUUID();
  const recordId = crypto.randomUUID();

  try {
    await recordsRepo.insertPatientAndRecord(c.env.DB, {
      recordId,
      patientId,
      folio,
      fullName,
      birthDate,
      phoneNumber,
    });

    return c.json({ recordId, patientId, folio }, 201);
  } catch (error) {
    if (recordsRepo.isFolioConflict(error)) {
      const existing = await recordsRepo.findByFolio(c.env.DB, folio);

      return c.json(
        {
          error: "Folio already exists.",
          code: "FOLIO_CONFLICT",
          requestId: requestId(c),
          existingRecord: existing
            ? {
                recordId: existing.record_id,
                folio,
                patientName: existing.full_name,
              }
            : { folio },
        },
        409,
      );
    }

    // Anything else here is a server fault, not the caller's mistake. It used
    // to answer 400, which told the UI to blame the employee's input for a
    // database problem.
    throw error;
  }
});

records.get("/", async (c) => {
  const limitParam = Number(c.req.query("limit") ?? "20");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 20;

  // The manager queue is this list filtered to CONFIRMED: everything
  // reviewed and waiting to be released.
  const status = c.req.query("status");

  if (status !== undefined && !isFileStatus(status)) {
    throw new AppError("INVALID_INPUT", "El estado solicitado no existe.");
  }

  const rows = await recordsRepo.listRecent(c.env.DB, limit, status);

  return c.json({
    records: rows.results.map((row) => ({
      recordId: row.record_id,
      folio: row.folio,
      patientName: row.full_name,
      results: recordsRepo.tallyFromCounts(row),
      updatedAt: row.latest_uploaded_at ?? row.created_at,
    })),
  });
});

/**
 * The admin UI opens a record by id after a click and by folio after a scan.
 * Both need the same payload, so one builder serves both handlers.
 */
async function recordDetailResponse(
  c: AppContext,
  lookup: { by: "id" | "folio"; value: string },
) {
  const record = await recordsRepo.findRecordDetail(c.env.DB, lookup);

  if (!record) {
    throw new AppError("NOT_FOUND", "No encontramos el registro.");
  }

  const files = await filesRepo.listForRecord(c.env.DB, record.record_id);

  return c.json({
    record: {
      recordId: record.record_id,
      folio: record.folio,
      patient: {
        patientId: record.patient_id,
        fullName: record.full_name,
        birthDate: record.birth_date,
        phoneNumber: record.phone_number,
      },
      files: files.results.map((file) => ({
        fileId: file.file_id,
        originalFilename: file.original_filename,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        status: file.status,
        uploadedBy: file.uploaded_by,
        uploadedAt: file.uploaded_at,
        confirmedBy: file.confirmed_by,
        confirmedAt: file.confirmed_at,
        publishedBy: file.published_by,
        publishedAt: file.published_at,
        revokedBy: file.revoked_by,
        revokedAt: file.revoked_at,
        revokedReason: file.revoked_reason,
        sequence: file.sequence,
        // Employee-only. The patient download will be a separate route with
        // its own authorization and a PUBLISHED-only filter; do not widen
        // this one to serve it.
        previewUrl: `/files/${file.file_id}`,
      })),
    },
  });
}

// Registered before /:recordId so the literal segment is not captured as an id.
records.get("/by-folio/:folio", async (c) => {
  const folio = validateFolio(c.req.param("folio"));

  if (!folio.ok) {
    throw new AppError("INVALID_INPUT", folio.error);
  }

  // Normalized here as well as on write, so a folio read off paper in lower
  // case finds the record that was stored in upper case.
  return recordDetailResponse(c, { by: "folio", value: folio.value });
});

records.get("/:recordId", async (c) => {
  const recordId = c.req.param("recordId");

  if (!isUuid(recordId)) {
    throw new AppError("INVALID_INPUT", "El identificador del registro no es válido.");
  }

  return recordDetailResponse(c, { by: "id", value: recordId });
});

records.post("/:recordId/files", async (c) => {
  const recordId = c.req.param("recordId");

  if (!isUuid(recordId)) {
    throw new AppError("INVALID_INPUT", "El identificador del registro no es válido.");
  }

  if (!(await recordsRepo.exists(c.env.DB, recordId))) {
    throw new AppError("NOT_FOUND", "No encontramos el registro.");
  }

  // Best-effort rejection before the body is read. The header is advisory,
  // so the authoritative check is on the parsed file below.
  const declaredLength = Number(c.req.header("Content-Length") ?? "");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "El archivo supera los 15 MB.");
  }

  const formData = await c.req.formData();
  const file = formData.get("file");

  // No file field at all is a malformed request; a file that is present but
  // is not a PDF is an unsupported type. They are different mistakes and the
  // status should say which one it was.
  if (!(file instanceof File)) {
    throw new AppError("INVALID_INPUT", "Adjunta el archivo PDF.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "El archivo supera los 15 MB.");
  }

  // Covers a declared type that is not PDF and a declared PDF whose bytes
  // disagree. In both cases the content is what is unsupported.
  if (!(await isPdf(file))) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Solo se admiten archivos PDF.");
  }

  const { fileId } = await recordService.uploadResult(c.env, {
    recordId,
    file,
    uploadedBy: c.get("actor").email,
    requestId: requestId(c),
  });

  return c.json({ fileId, recordId, status: "UPLOADED" }, 201);
});

records.delete("/:recordId/files/:fileId", async (c) => {
  const recordId = c.req.param("recordId");
  const fileId = c.req.param("fileId");

  if (!isUuid(recordId) || !isUuid(fileId)) {
    throw new AppError("INVALID_INPUT", "El identificador no es válido.");
  }

  await recordService.deleteResult(c.env, {
    recordId,
    fileId,
    requestId: requestId(c),
  });

  return c.json({ deleted: true, fileId });
});
