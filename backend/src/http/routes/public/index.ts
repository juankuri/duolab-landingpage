import { Hono } from "hono";

import { AppError } from "../../../domain/errors";
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
