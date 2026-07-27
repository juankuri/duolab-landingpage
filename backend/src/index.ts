import { Hono, type Next } from "hono";
import { cors } from "hono/cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

import * as filesRepo from "./data/files.repo";
import * as recordsRepo from "./data/records.repo";
import * as storage from "./data/storage";
import { MAX_UPLOAD_BYTES, contentDisposition, isPdf } from "./domain/validation";
import type { AppContext, AppEnv } from "./env";

const app = new Hono<AppEnv>();

// Browsers cannot obtain a Cf-Access-Jwt-Assertion header on localhost: it is
// injected by Cloudflare's edge, which local dev does not go through. Without
// this, every protected route returns 401 during frontend development.
//
// This is inert in production. ENVIRONMENT is set only in backend/.dev.vars,
// which wrangler reads for `wrangler dev` and never uploads on deploy. It is
// deliberately NOT in wrangler.jsonc, whose top-level `vars` DO ship.
function isLocalDev(c: AppContext): boolean {
  return c.env.ENVIRONMENT === "local";
}

// createRemoteJWKSet keeps its key cache on the returned function, so building
// a new one per request re-fetches Cloudflare's signing keys on every call.
// Cached per team domain at module scope, which lives as long as the isolate.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function accessJwks(teamDomain: string) {
  const cached = jwksCache.get(teamDomain);

  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(
    new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
  );
  jwksCache.set(teamDomain, jwks);

  return jwks;
}

async function requireAccess(c: AppContext, next: Next) {
  if (isLocalDev(c)) {
    c.set("employee", {
      email: "local-dev@duolab.test",
      subject: "local-dev",
    });

    return next();
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const jwks = accessJwks(c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`,
      audience: c.env.CLOUDFLARE_ACCESS_AUDIENCE,
    });

    if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
      return c.json({ error: "Access token is missing identity claims." }, 401);
    }

    c.set("employee", {
      email: payload.email,
      subject: payload.sub,
    });

    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}

// The admin UI runs on the Astro dev server (:4321) and calls this Worker on
// :8787, so local requests are cross-origin. The origin callback returns null
// outside local dev, which omits the CORS headers entirely in production.
//
// Both loopback spellings are listed because the browser sends whichever one is
// in the address bar, and they are not interchangeable to the CORS check: on
// 127.0.0.1 an allowlist of only "localhost" blocks every request.
const LOCAL_FRONTEND_ORIGINS = new Set([
  "http://localhost:4321",
  "http://127.0.0.1:4321",
]);

app.use(
  "*",
  cors({
    origin: (origin, c: AppContext) =>
      isLocalDev(c) && LOCAL_FRONTEND_ORIGINS.has(origin) ? origin : null,
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "duolab-api",
  });
});

app.post("/records", requireAccess, async (c) => {
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
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: records.folio")
    ) {
      const existing = await recordsRepo.findByFolio(c.env.DB, folio);

      return c.json(
        {
          error: "Folio already exists.",
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

    console.error(error);

    return c.json({ error: "Could not create record." }, 400);
  }
});

app.get("/records", requireAccess, async (c) => {
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
        previewUrl: `/files/${file.file_id}`,
      })),
    },
  });
}

app.get("/records/:recordId", requireAccess, async (c) => {
  const recordId = c.req.param("recordId");

  if (!recordId) {
    return c.json({ error: "Record id is required." }, 400);
  }

  return recordDetailResponse(c, { by: "id", value: recordId });
});

app.get("/records/by-folio/:folio", requireAccess, async (c) => {
  const folio = c.req.param("folio");

  if (!folio) {
    return c.json({ error: "Folio is required." }, 400);
  }

  return recordDetailResponse(c, { by: "folio", value: folio });
});

app.post("/records/:recordId/files", requireAccess, async (c) => {
  try {
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

    const employee = c.get("employee");
    const fileId = crypto.randomUUID();
    const r2Key = storage.resultKey(recordId, fileId);

    await storage.putResult(c.env.RESULTS_BUCKET, r2Key, file, {
      recordId,
      fileId,
    });

    await filesRepo.insert(c.env.DB, {
      fileId,
      recordId,
      r2Key,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedBy: employee.email,
    });

    return c.json({ fileId, recordId, status: "UPLOADED" }, 201);
  } catch (error) {
    console.error(error);

    return c.json({ error: "Could not upload file." }, 500);
  }
});

app.delete("/records/:recordId/files/:fileId", requireAccess, async (c) => {
  const recordId = c.req.param("recordId");
  const fileId = c.req.param("fileId");

  if (!recordId || !fileId) {
    return c.json({ error: "Record id and file id are required." }, 400);
  }

  const file = await filesRepo.findInRecord(c.env.DB, recordId, fileId);

  if (!file) {
    return c.json({ error: "File not found." }, 404);
  }

  await storage.deleteResult(c.env.RESULTS_BUCKET, file.r2_key);
  await filesRepo.remove(c.env.DB, fileId);

  return c.json({ deleted: true, fileId });
});

app.get("/files/:fileId", requireAccess, async (c) => {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File id is required." }, 400);
  }

  const file = await filesRepo.findForPreview(c.env.DB, fileId);

  if (!file) {
    return c.json({ error: "File not found." }, 404);
  }

  const object = await storage.getResult(c.env.RESULTS_BUCKET, file.r2_key);

  if (!object) {
    return c.json({ error: "Stored file not found." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", file.mime_type);
  headers.set("content-disposition", contentDisposition(file.original_filename));
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
});

app.post("/files/:fileId/confirm", requireAccess, async (c) => {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File id is required." }, 400);
  }

  const employee = c.get("employee");
  const result = await filesRepo.confirm(c.env.DB, fileId, employee.email);

  if (result.meta.changes === 0) {
    return c.json({ error: "File not found or cannot be confirmed." }, 404);
  }

  return c.json({
    fileId,
    status: "CONFIRMED",
    confirmedBy: employee.email,
  });
});

// Every route in this Worker answers with JSON, so the two paths Hono handles
// on its own should too. Without these, an unknown path or an unhandled throw
// returns text the admin UI cannot parse, and its error handling falls back to
// a generic message that hides what actually happened.
app.notFound((c) => {
  return c.json({ error: "Not found." }, 404);
});

app.onError((error, c) => {
  console.error(error);

  // Deliberately generic: the cause is in the logs, not in the response. A
  // stack trace or a driver message here would describe the schema to anyone
  // who can trigger a fault.
  return c.json({ error: "Something went wrong." }, 500);
});

export default app;
