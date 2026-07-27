import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as recordsRepo from "../../data/records.repo";
import { MAX_UPLOAD_BYTES, isPdf } from "../../domain/validation";
import type { AppContext, AppEnv } from "../../env";
import * as recordService from "../../services/record-service";
import { requestId } from "../errors";

export const records = new Hono<AppEnv>();

records.post("/", async (c) => {
  const body: {
    fullName?: unknown;
    birthDate?: unknown;
    phoneNumber?: unknown;
    folio?: unknown;
  } = await c.req.json().catch(() => ({}));

  if (
    typeof body.fullName !== "string" ||
    typeof body.birthDate !== "string" ||
    typeof body.phoneNumber !== "string" ||
    typeof body.folio !== "string"
  ) {
    return c.json(
      { error: "fullName, birthDate, phoneNumber, and folio are required." },
      400,
    );
  }

  const fullName = body.fullName.trim();
  const birthDate = body.birthDate.trim();
  const phoneNumber = body.phoneNumber.trim();
  const folio = body.folio.trim();

  if (!fullName || !birthDate || !phoneNumber || !folio) {
    return c.json(
      { error: "fullName, birthDate, phoneNumber, and folio cannot be empty." },
      400,
    );
  }

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

  const rows = await recordsRepo.listRecent(c.env.DB, limit);

  return c.json({
    records: rows.results.map((row) => ({
      recordId: row.record_id,
      folio: row.folio,
      patientName: row.full_name,
      status: row.latest_status ?? "NO_FILE",
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
    return c.json({ error: "Record not found." }, 404);
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
  const folio = c.req.param("folio");

  if (!folio) {
    return c.json({ error: "Folio is required." }, 400);
  }

  return recordDetailResponse(c, { by: "folio", value: folio });
});

records.get("/:recordId", async (c) => {
  const recordId = c.req.param("recordId");

  if (!recordId) {
    return c.json({ error: "Record id is required." }, 400);
  }

  return recordDetailResponse(c, { by: "id", value: recordId });
});

records.post("/:recordId/files", async (c) => {
  const recordId = c.req.param("recordId");

  if (!recordId) {
    return c.json({ error: "Record id is required." }, 400);
  }

  if (!(await recordsRepo.exists(c.env.DB, recordId))) {
    return c.json({ error: "Record not found." }, 404);
  }

  // Best-effort rejection before the body is read. The header is advisory,
  // so the authoritative check is on the parsed file below.
  const declaredLength = Number(c.req.header("Content-Length") ?? "");

  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "The file is too large." }, 413);
  }

  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return c.json({ error: "No file uploaded, please upload a file." }, 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "The file is too large." }, 413);
  }

  if (!(await isPdf(file))) {
    return c.json({ error: "Only PDF files are allowed." }, 400);
  }

  const { fileId } = await recordService.uploadResult(c.env, {
    recordId,
    file,
    uploadedBy: c.get("employee").email,
    requestId: requestId(c),
  });

  return c.json({ fileId, recordId, status: "UPLOADED" }, 201);
});

records.delete("/:recordId/files/:fileId", async (c) => {
  const recordId = c.req.param("recordId");
  const fileId = c.req.param("fileId");

  if (!recordId || !fileId) {
    return c.json({ error: "Record id and file id are required." }, 400);
  }

  await recordService.deleteResult(c.env, {
    recordId,
    fileId,
    requestId: requestId(c),
  });

  return c.json({ deleted: true, fileId });
});
