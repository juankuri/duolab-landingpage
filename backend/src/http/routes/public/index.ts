import { Hono } from "hono";

import { decryptToken } from "../../../domain/download-token";
import { AppError } from "../../../domain/errors";
import { contentDisposition } from "../../../domain/validation";
import * as filesRepo from "../../../data/files.repo";
import * as storage from "../../../data/storage";
import { lookupPublicResult } from "../../../services/public-result-service";
import type { AppEnv } from "../../../env";

export const publicRoutes = new Hono<AppEnv>();

// Applies to every response from this sub-app. DEC-014: a patient-facing
// response must never be cached at the edge or in the browser, since a
// revoke has to take effect immediately. Referrer-Policy keeps the download
// URL (which carries the token) out of any Referer header a linked resource
// might send; nosniff is defence in depth around the PDF response.
publicRoutes.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Content-Type-Options", "nosniff");
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
publicRoutes.get("/results/:downloadToken/download", async (c) => {
  const decrypted = await decryptToken(
    c.env.DOWNLOAD_TOKEN_SECRET,
    c.req.param("downloadToken"),
  );

  if (!decrypted.ok) {
    throw downloadFailed();
  }

  const file = await filesRepo.findPublishedForDownload(
    c.env.DB,
    decrypted.payload.fileId,
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
