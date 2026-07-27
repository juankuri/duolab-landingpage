import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as storage from "../../data/storage";
import { AppError } from "../../domain/errors";
import { contentDisposition, isUuid } from "../../domain/validation";
import type { AppEnv } from "../../env";

export const files = new Hono<AppEnv>();

files.get("/:fileId", async (c) => {
  const fileId = c.req.param("fileId");

  if (!isUuid(fileId)) {
    throw new AppError("INVALID_INPUT", "El identificador del archivo no es válido.");
  }

  const file = await filesRepo.findForPreview(c.env.DB, fileId);

  if (!file) {
    throw new AppError("NOT_FOUND", "No encontramos el archivo.");
  }

  const object = await storage.getResult(c.env.RESULTS_BUCKET, file.r2_key);

  if (!object) {
    // The row exists but the bytes do not. Distinct message on purpose: this
    // is an inconsistency to investigate, not a caller mistake.
    throw new AppError("NOT_FOUND", "Stored file not found.");
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", file.mime_type);
  headers.set("content-disposition", contentDisposition(file.original_filename));
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
});

files.post("/:fileId/confirm", async (c) => {
  const fileId = c.req.param("fileId");

  if (!isUuid(fileId)) {
    throw new AppError("INVALID_INPUT", "El identificador del archivo no es válido.");
  }

  // Read first so "no such file" and "wrong state" can be told apart. They
  // used to be the same 404, which left the UI unable to say whether the
  // employee should look for the record or stop trying to confirm twice.
  const current = await filesRepo.findStatus(c.env.DB, fileId);

  if (!current) {
    throw new AppError("NOT_FOUND", "No encontramos el archivo.");
  }

  if (current.status !== "UPLOADED") {
    throw new AppError(
      "INVALID_TRANSITION",
      "El archivo ya no está pendiente de confirmar.",
      { currentStatus: current.status },
    );
  }

  const employee = c.get("employee");
  const result = await filesRepo.confirm(c.env.DB, fileId, employee.email);

  // The UPDATE carries `AND status = 'UPLOADED'`, so zero changes here means
  // a concurrent request won the race between the read above and this write.
  if (result.meta.changes === 0) {
    throw new AppError(
      "INVALID_TRANSITION",
      "El archivo ya no está pendiente de confirmar.",
    );
  }

  return c.json({
    fileId,
    status: "CONFIRMED",
    confirmedBy: employee.email,
  });
});
