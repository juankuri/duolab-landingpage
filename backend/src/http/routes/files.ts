import { Hono } from "hono";

import * as filesRepo from "../../data/files.repo";
import * as storage from "../../data/storage";
import { AppError } from "../../domain/errors";
import { contentDisposition, isUuid } from "../../domain/validation";
import type { AppEnv } from "../../env";
import * as fileService from "../../services/file-service";
import { requireRole } from "../middleware/auth";

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
  // file.mime_type is whatever the browser reported at upload time, not what
  // R2 actually stores (always application/pdf — see storage.ts's
  // putResult). With nosniff below, a stray value there (an empty string, or
  // something a browser guessed) would make the file permanently
  // unrenderable in a viewer relying on this header. Coalesce rather than
  // trust it; isPdf() already verified the bytes are a real PDF at upload.
  headers.set(
    "content-type",
    file.mime_type === "application/pdf" ? file.mime_type : "application/pdf",
  );
  // ?download=1 is the only difference between "Ver PDF" and "Descargar" on
  // /admin/folio — before this, both called this same route and both got
  // `inline`, so "Descargar" only ever opened a new tab, never saved a file.
  // Default stays inline: the manager viewer and every other existing
  // caller fetch this route expecting an inline disposition and must not
  // change behavior.
  const disposition = c.req.query("download") ? "attachment" : "inline";
  headers.set("content-disposition", contentDisposition(file.original_filename, disposition));
  headers.set("x-content-type-options", "nosniff");
  // Never at the edge or in a shared cache — same reasoning as the patient
  // download route (DEC-014): a revoke must take effect on the very next
  // request, and a cached response would keep serving a hidden result.
  headers.set("cache-control", "private, no-store");

  return new Response(object.body, { headers });
});

files.post("/:fileId/confirm", async (c) => {
  const fileId = fileIdParam(c.req.param("fileId"));
  const employee = c.get("actor");

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

/** Free-text note on a revocation. Never shown to a patient. */
function revokeReason(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  const value = raw.trim();

  if (value.length > 500) {
    throw new AppError("INVALID_INPUT", "El motivo no puede superar 500 caracteres.");
  }

  return value;
}

/**
 * The moment a result becomes visible to a patient, and the most
 * consequential action in the product. Manager only, one named file at a
 * time: there is no bulk publish and no publish-by-folio, so the blast
 * radius of a mistake is a single file.
 */
files.post("/:fileId/publish", requireRole("MANAGER"), async (c) => {
  const fileId = fileIdParam(c.req.param("fileId"));
  const supersedes = c.req.query("supersedes");

  if (supersedes !== undefined && !isUuid(supersedes)) {
    throw new AppError("INVALID_INPUT", "El identificador a reemplazar no es válido.");
  }

  const body: Record<string, unknown> = await c.req.json().catch(() => ({}));
  const actor = c.get("actor");

  const result = await fileService.publish(c.env.DB, {
    fileId,
    actorEmail: actor.email,
    supersedes,
    reason: revokeReason(body.reason),
  });

  return c.json({
    fileId,
    status: "PUBLISHED",
    publishedBy: actor.email,
    supersededFileId: result.superseded,
  });
});

// Any authenticated employee or manager may revoke — widened from
// manager-only (DEC-013 named MANAGER a strict superset of EMPLOYEE without
// this). An employee spotting a mistake in a published result should not
// have to find a manager to pull it; publish stays the one gated action,
// since making something visible carries the asymmetric risk, not hiding it.
files.post("/:fileId/revoke", async (c) => {
  const fileId = fileIdParam(c.req.param("fileId"));
  const body: Record<string, unknown> = await c.req.json().catch(() => ({}));
  const actor = c.get("actor");

  await fileService.revoke(c.env.DB, {
    fileId,
    actorEmail: actor.email,
    reason: revokeReason(body.reason),
  });

  return c.json({ fileId, status: "REVOKED", revokedBy: actor.email });
});
