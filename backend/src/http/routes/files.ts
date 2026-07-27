import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as storage from "../../data/storage";
import { AppError } from "../../domain/errors";
import { contentDisposition, isUuid } from "../../domain/validation";
import type { AppEnv } from "../../env";
import * as fileService from "../../services/file-service";

export const files = new Hono<AppEnv>();

function fileIdParam(raw: string | undefined): string {
  if (!isUuid(raw)) {
    throw new AppError("INVALID_INPUT", "El identificador del archivo no es válido.");
  }

  return raw;
}

files.get("/:fileId", async (c) => {
  const fileId = fileIdParam(c.req.param("fileId"));
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
  const fileId = fileIdParam(c.req.param("fileId"));
  const employee = c.get("employee");

  await fileService.transition(c.env.DB, {
    fileId,
    to: "CONFIRMED",
    apply: () => filesRepo.confirm(c.env.DB, fileId, employee.email),
    rejection: "El archivo ya no está pendiente de confirmar.",
  });

  return c.json({
    fileId,
    status: "CONFIRMED",
    confirmedBy: employee.email,
  });
});

/**
 * Un-vouches for a file confirmed by mistake, so it can be replaced or
 * removed. Pre-publication only: a PUBLISHED file was visible to a patient
 * and is withdrawn by a manager revoking it, not by an employee stepping
 * back from a confirmation.
 */
files.post("/:fileId/withdraw", async (c) => {
  const fileId = fileIdParam(c.req.param("fileId"));

  await fileService.transition(c.env.DB, {
    fileId,
    to: "UPLOADED",
    apply: () => filesRepo.withdraw(c.env.DB, fileId),
    rejection: "Solo se puede retirar la confirmación de un archivo confirmado.",
  });

  return c.json({ fileId, status: "UPLOADED" });
});
