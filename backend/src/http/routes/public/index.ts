import { Hono } from "hono";

import { decryptToken } from "../../../domain/download-token";
import { AppError } from "../../../domain/errors";
import { contentDisposition, isUuid } from "../../../domain/validation";
import * as filesRepo from "../../../data/files.repo";
import * as storage from "../../../data/storage";
import { lookupPublicResult } from "../../../services/public-result-service";
import type { AppEnv } from "../../../env";

export const publicRoutes = new Hono<AppEnv>();

// Applies to every response from this sub-app. DEC-014: a patient-facing
// response must never be cached at the edge or in the browser, since a
// revoke has to take effect immediately. Referrer-Policy and nosniff are set
// globally now (http/middleware/security-headers.ts, DEC-030) — no-store is
// the one header still specific to this route, so it's the only one left
// here.
publicRoutes.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

publicRoutes.post("/results/lookup", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError("INVALID_INPUT", "El cuerpo de la solicitud no es JSON válido.");
  }

  const { folio, phone, birthDate } = (body ?? {}) as Record<string, unknown>;

  const result = await lookupPublicResult(c, { folio, phone, birthDate });

  return c.json(result);
});

const downloadFailed = () =>
  new AppError("LOOKUP_FAILED", "El enlace de descarga ya no es válido.");

// A separate handler from the internal GET /files/:fileId, deliberately: that
// one has no status check and is employee-only by construction (mounted
// behind requireAccess). This one re-checks PUBLISHED live in the same query
// that fetches the row, so a still-unexpired token stops working the moment
// the file is revoked (DEC-014).
//
// The token names a RECORD, the path names a FILE (DEC-023). Both halves are
// checked in one query — the file must be published AND belong to the token's
// record. Dropping the record half would turn a token for one folio into a
// key for any file id a caller could guess, including another patient's;
// that is the failure mode this route exists to make impossible, and
// public-lookup.test.ts pins it.
publicRoutes.get("/results/:downloadToken/download/:fileId", async (c) => {
  const decrypted = await decryptToken(
    c.env.DOWNLOAD_TOKEN_SECRET,
    c.req.param("downloadToken"),
  );

  if (!decrypted.ok) {
    throw downloadFailed();
  }

  // Validated inline rather than with files.ts's fileIdParam helper, which
  // raises a distinguishable 400: on this route a malformed file id must
  // fail exactly like a valid-but-wrong one, or the shape of the id becomes
  // a signal.
  const fileId = c.req.param("fileId");

  if (!isUuid(fileId)) {
    throw downloadFailed();
  }

  const file = await filesRepo.findPublishedInRecord(
    c.env.DB,
    decrypted.payload.recordId,
    fileId,
  );

  if (!file) {
    throw downloadFailed();
  }

  const object = await storage.getResult(c.env.RESULTS_BUCKET, file.r2_key);

  if (!object) {
    throw downloadFailed();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", file.mime_type);
  headers.set(
    "content-disposition",
    contentDisposition(file.original_filename, "attachment"),
  );

  return new Response(object.body, { headers });
});
