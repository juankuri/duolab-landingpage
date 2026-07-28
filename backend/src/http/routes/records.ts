import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as recordsRepo from "../../data/records.repo";
import { AppError } from "../../domain/errors";
import { isFileStatus } from "../../domain/file-lifecycle";
import {
  MAX_UPLOAD_BYTES,
  isPdf,
  isRecordInclude,
  isUuid,
  validateBirthDate,
  validateFolio,
  validateFullName,
  validatePhoneNumber,
} from "../../domain/validation";
import type { AppContext, AppEnv } from "../../env";
import * as fileService from "../../services/file-service";
import * as recordService from "../../services/record-service";
import { requestId } from "../errors";

export const records = new Hono<AppEnv>();

/**
 * Creates a patient + folio + first result in one request. A folio without
 * a result no longer exists — this is the only path that creates a record
 * row, and it always carries a PDF with it (Flow A). Either supply
 * `patientId` for an existing patient (Flow C — no new patient row, only
 * folio + PDF are required) or the three patient fields for a new one
 * (Flow A); `folio` and `file` are required either way.
 */
records.post("/", async (c) => {
  // Best-effort rejection before the body is read, same as the add-a-result
  // endpoint below — the header is advisory, the parsed file is authoritative.
  const declaredLength = Number(c.req.header("Content-Length") ?? "");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "El archivo supera los 15 MB.");
  }

  const formData = await c.req.formData().catch(() => null);

  if (!formData) {
    throw new AppError("INVALID_INPUT", "Revisa los datos del formulario.");
  }

  const rawPatientId = formData.get("patientId");
  const usingExistingPatient = typeof rawPatientId === "string" && rawPatientId.length > 0;

  const reference = validateFolio(formData.get("folio"));
  const fields: Record<string, string> = {};

  let folio: string | undefined;
  if (reference.ok) folio = reference.value;
  else fields.folio = reference.error;

  let patientId: string | undefined;
  let fullName: string | undefined;
  let birthDate: string | undefined;
  let phoneNumber: string | undefined;

  if (usingExistingPatient) {
    if (!isUuid(rawPatientId)) {
      fields.patientId = "El identificador del paciente no es válido.";
    } else {
      patientId = rawPatientId;
    }
  } else {
    // Every field is validated before any is used, so one response can name
    // every problem at once instead of making the employee submit again to
    // discover the next one.
    const name = validateFullName(formData.get("fullName"));
    const birth = validateBirthDate(formData.get("birthDate"));
    const phone = validatePhoneNumber(formData.get("phoneNumber"));

    if (!name.ok) fields.fullName = name.error;
    if (!birth.ok) fields.birthDate = birth.error;
    if (!phone.ok) fields.phoneNumber = phone.error;

    if (name.ok) fullName = name.value;
    if (birth.ok) birthDate = birth.value;
    if (phone.ok) phoneNumber = phone.value;
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    fields.file = "Adjunta el archivo PDF.";
  } else if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "El archivo supera los 15 MB.");
  } else if (file.size === 0 || !(await isPdf(file))) {
    fields.file = "Solo se admiten archivos PDF.";
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("INVALID_INPUT", "Revisa los datos del formulario.", { fields });
  }

  // Every field above either populated `fields` or its own variable; the
  // throw just above means every one of these is now set.
  const validFolio = folio as string;

  try {
    const created = await recordService.createWithFirstResult(c.env, {
      patientId,
      fullName,
      birthDate,
      phoneNumber,
      folio: validFolio,
      file: file as File,
      uploadedBy: c.get("actor").email,
      requestId: requestId(c),
    });

    return c.json(
      {
        recordId: created.recordId,
        patientId: created.patientId,
        folio: validFolio,
        fileId: created.fileId,
        status: "UPLOADED",
      },
      201,
    );
  } catch (error) {
    if (recordsRepo.isFolioConflict(error)) {
      const existing = await recordsRepo.findByFolio(c.env.DB, validFolio);

      return c.json(
        {
          error: "Folio already exists.",
          code: "FOLIO_CONFLICT",
          requestId: requestId(c),
          existingRecord: existing
            ? {
                recordId: existing.record_id,
                folio: validFolio,
                patientName: existing.full_name,
              }
            : { folio: validFolio },
        },
        409,
      );
    }

    // Anything else here — including a bad patientId, which the service
    // reports as NOT_FOUND — is not the folio's fault. It used to answer
    // 400 for every failure here, which told the UI to blame input for a
    // database or lookup problem.
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

  const include = c.req.query("include");

  if (include !== undefined && !isRecordInclude(include)) {
    throw new AppError("INVALID_INPUT", "El include solicitado no existe.");
  }

  const rows = await recordsRepo.listRecent(c.env.DB, limit, status);

  // Additive: without ?include=files the response is byte-identical to
  // before, which is what keeps every existing caller (the employee home's
  // two /records calls) working untouched.
  let filesByRecord: Map<string, recordsRepo.QueueFileRow[]> | null = null;

  if (include === "files") {
    const recordIds = rows.results.map((row) => row.record_id);
    const fileRows = await recordsRepo.listFilesForRecords(c.env.DB, recordIds, status);

    filesByRecord = new Map();
    for (const file of fileRows) {
      const bucket = filesByRecord.get(file.record_id) ?? [];
      bucket.push(file);
      filesByRecord.set(file.record_id, bucket);
    }
  }

  return c.json({
    records: rows.results.map((row) => {
      const base = {
        recordId: row.record_id,
        folio: row.folio,
        patientName: row.full_name,
        results: recordsRepo.tallyFromCounts(row),
        updatedAt: row.latest_uploaded_at ?? row.created_at,
      };

      if (!filesByRecord) {
        return base;
      }

      return {
        ...base,
        files: (filesByRecord.get(row.record_id) ?? []).map((file) => ({
          fileId: file.file_id,
          originalFilename: file.original_filename,
          status: file.status,
          sequence: file.sequence,
          uploadedAt: file.uploaded_at,
          // Employee/manager-only, same convention as the detail endpoint.
          previewUrl: `/files/${file.file_id}`,
        })),
      };
    }),
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

/**
 * Swaps a result's PDF for a corrected one. Reachable from UPLOADED,
 * CONFIRMED, or PUBLISHED (see canReplace() in file-lifecycle.ts) and
 * always lands back on UPLOADED — see file-service.ts's replaceFile() for
 * why the D1-before-R2 ordering here is load-bearing, not incidental.
 */
records.post("/:recordId/files/:fileId/replace", async (c) => {
  const recordId = c.req.param("recordId");
  const fileId = c.req.param("fileId");

  if (!isUuid(recordId) || !isUuid(fileId)) {
    throw new AppError("INVALID_INPUT", "El identificador no es válido.");
  }

  const declaredLength = Number(c.req.header("Content-Length") ?? "");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "El archivo supera los 15 MB.");
  }

  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new AppError("INVALID_INPUT", "Adjunta el archivo PDF.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "El archivo supera los 15 MB.");
  }

  if (!(await isPdf(file))) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Solo se admiten archivos PDF.");
  }

  await fileService.replaceFile(c.env, {
    recordId,
    fileId,
    file,
    requestId: requestId(c),
  });

  return c.json({ fileId, status: "UPLOADED", replacedAt: new Date().toISOString() });
});
