import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

type Bindings = {
  DB: D1Database;
  RESULTS_BUCKET: R2Bucket;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
  CLOUDFLARE_ACCESS_AUDIENCE: string;
  // Set to "local" only via backend/.dev.vars (never deployed). Enables the
  // Access bypass below, since Cloudflare Access JWTs cannot exist on localhost.
  ENVIRONMENT?: string;
};

type EmployeeIdentity = {
  email: string;
  subject: string;
};

type Variables = {
  employee: EmployeeIdentity;
};

type AppContext = Context<{
  Bindings: Bindings;
  Variables: Variables;
}>;

type FilePreviewRow = {
  file_id: string;
  r2_key: string;
  original_filename: string;
  mime_type: string;
};

type RecordDetailRow = {
  record_id: string;
  folio: string;
  patient_id: string;
  full_name: string;
  birth_date: string;
  phone_number: string;
};

type RecordFileRow = {
  file_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  uploaded_by: string;
  uploaded_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

async function isPdf(file: File): Promise<boolean> {
  if (file.size === 0) {
    return false;
  }

  if (file.type !== "application/pdf") {
    return false;
  }

  const header = new Uint8Array(
    await file.slice(0, PDF_MAGIC_BYTES.length).arrayBuffer(),
  );

  return PDF_MAGIC_BYTES.every((byte, index) => header[index] === byte);
}

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
    const certsUrl = new URL(
      `https://${c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`,
    );
    const jwks = createRemoteJWKSet(certsUrl);

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
const LOCAL_FRONTEND_ORIGIN = "http://localhost:4321";

app.use(
  "*",
  cors({
    origin: (origin, c: AppContext) =>
      isLocalDev(c) && origin === LOCAL_FRONTEND_ORIGIN ? origin : null,
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

app.post("/learning/d1", async (c) => {
  const body: { message?: unknown } = await c.req.json().catch(() => ({}));
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : "D1 connected";

  const result = await c.env.DB.prepare(
    "INSERT INTO learning_notes (message) VALUES (?) RETURNING id, message, created_at",
  )
    .bind(message)
    .first();

  return c.json(result, 201);
});

app.get("/learning/d1", async (c) => {
  const notes = await c.env.DB.prepare(
    "SELECT id, message, created_at FROM learning_notes ORDER BY id DESC LIMIT 10",
  ).all();

  return c.json({
    notes: notes.results,
  });
});

app.post("/learning/r2", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return c.json({ error: "No file uploaded, please upload a file." }, 400);
  }

  if (!(await isPdf(file))) {
    return c.json({ error: "Only PDF files are allowed." }, 400);
  }

  const key = `learning/${crypto.randomUUID()}-${file.name}`;

  await c.env.RESULTS_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
    customMetadata: {
      originalFilename: file.name,
    },
  });

  return c.json(
    {
      key,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    },
    201,
  );
});

app.get("/learning/r2", async (c) => {
  const key = c.req.query("key");

  if (!key) {
    return c.json({ error: "Pass the R2 object key as ?key=..." }, 400);
  }

  const object = await c.env.RESULTS_BUCKET.get(key);

  if (!object) {
    return c.json({ error: "File not found." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, {
    headers,
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
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO patients (patient_id, full_name, birth_date, phone_number) VALUES (?, ?, ?, ?)",
      ).bind(patientId, fullName, birthDate, phoneNumber),
      c.env.DB.prepare(
        "INSERT INTO records (record_id, folio, patient_id) VALUES (?, ?, ?)",
      ).bind(recordId, folio, patientId),
    ]);

    return c.json(
      {
        recordId,
        patientId,
        folio,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: records.folio")) {
      const existing = await c.env.DB.prepare(
        `SELECT records.record_id, patients.full_name
         FROM records
         JOIN patients ON patients.patient_id = records.patient_id
         WHERE records.folio = ?`,
      )
        .bind(folio)
        .first<{ record_id: string; full_name: string }>();

      return c.json(
        {
          error: "Folio already exists.",
          existingRecord: existing
            ? { recordId: existing.record_id, folio, patientName: existing.full_name }
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

  const rows = await c.env.DB.prepare(
    `SELECT
       records.record_id,
       records.folio,
       records.created_at,
       patients.full_name,
       latest.status AS latest_status,
       latest.uploaded_at AS latest_uploaded_at
     FROM records
     JOIN patients ON patients.patient_id = records.patient_id
     LEFT JOIN (
       SELECT f.record_id, f.status, f.uploaded_at
       FROM files f
       WHERE f.uploaded_at = (
         SELECT MAX(f2.uploaded_at) FROM files f2 WHERE f2.record_id = f.record_id
       )
     ) latest ON latest.record_id = records.record_id
     ORDER BY COALESCE(latest.uploaded_at, records.created_at) DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<{
      record_id: string;
      folio: string;
      created_at: string;
      full_name: string;
      latest_status: string | null;
      latest_uploaded_at: string | null;
    }>();

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

app.get("/records/:recordId", requireAccess, async (c) => {
  const recordId = c.req.param("recordId");

  if (!recordId) {
    return c.json({ error: "Record id is required." }, 400);
  }

  const record = await c.env.DB.prepare(
    `SELECT
       records.record_id,
       records.folio,
       patients.patient_id,
       patients.full_name,
       patients.birth_date,
       patients.phone_number
     FROM records
     JOIN patients ON patients.patient_id = records.patient_id
     WHERE records.record_id = ?`,
  )
    .bind(recordId)
    .first<RecordDetailRow>();

  if (!record) {
    return c.json({ error: "Record not found." }, 404);
  }

  const files = await c.env.DB.prepare(
    `SELECT
       file_id,
       original_filename,
       mime_type,
       size_bytes,
       status,
       uploaded_by,
       uploaded_at,
       confirmed_by,
       confirmed_at
     FROM files
     WHERE record_id = ?
     ORDER BY uploaded_at DESC`,
  )
    .bind(recordId)
    .all<RecordFileRow>();

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
});

app.get("/records/by-folio/:folio", requireAccess, async (c) => {
  const folio = c.req.param("folio");

  if (!folio) {
    return c.json({ error: "Folio is required." }, 400);
  }

  const record = await c.env.DB.prepare(
    `SELECT
       records.record_id,
       records.folio,
       patients.patient_id,
       patients.full_name,
       patients.birth_date,
       patients.phone_number
     FROM records
     JOIN patients ON patients.patient_id = records.patient_id
     WHERE records.folio = ?`,
  )
    .bind(folio)
    .first<RecordDetailRow>();

  if (!record) {
    return c.json({ error: "Record not found." }, 404);
  }

  const files = await c.env.DB.prepare(
    `SELECT
       file_id,
       original_filename,
       mime_type,
       size_bytes,
       status,
       uploaded_by,
       uploaded_at,
       confirmed_by,
       confirmed_at
     FROM files
     WHERE record_id = ?
     ORDER BY uploaded_at DESC`,
  )
    .bind(record.record_id)
    .all<RecordFileRow>();

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
});

app.post("/records/:recordId/files", requireAccess, async (c) => {
  try {
    const recordId = c.req.param("recordId");

    if (!recordId) {
      return c.json({ error: "Record id is required." }, 400);
    }

    const record = await c.env.DB.prepare(
      "SELECT record_id FROM records WHERE record_id = ?",
    )
      .bind(recordId)
      .first();

    if (!record) {
      return c.json({ error: "Record not found." }, 404);
    }

    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return c.json({ error: "No file uploaded, please upload a file." }, 400);
    }

    if (!(await isPdf(file))) {
      return c.json({ error: "Only PDF files are allowed." }, 400);
    }

    const employee = c.get("employee");
    const fileId = crypto.randomUUID();
    const r2Key = `records/${recordId}/${fileId}.pdf`;

    await c.env.RESULTS_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: "application/pdf",
      },
      customMetadata: {
        originalFilename: file.name,
        recordId,
        fileId,
      },
    });

    await c.env.DB.prepare(
      "INSERT INTO files (file_id, record_id, r2_key, original_filename, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        fileId,
        recordId,
        r2Key,
        file.name,
        "application/pdf",
        file.size,
        employee.email,
      )
      .run();

    return c.json(
      {
        fileId,
        recordId,
        status: "UPLOADED",
        r2Key,
      },
      201,
    );
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

  const file = await c.env.DB.prepare(
    "SELECT file_id, r2_key FROM files WHERE file_id = ? AND record_id = ?",
  )
    .bind(fileId, recordId)
    .first<{ file_id: string; r2_key: string }>();

  if (!file) {
    return c.json({ error: "File not found." }, 404);
  }

  await c.env.RESULTS_BUCKET.delete(file.r2_key);

  await c.env.DB.prepare("DELETE FROM files WHERE file_id = ?").bind(fileId).run();

  return c.json({ deleted: true, fileId });
});

app.get("/files/:fileId", requireAccess, async (c) => {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File id is required." }, 400);
  }

  const file = await c.env.DB.prepare(
    "SELECT file_id, r2_key, original_filename, mime_type FROM files WHERE file_id = ?",
  )
    .bind(fileId)
    .first<FilePreviewRow>();

  if (!file) {
    return c.json({ error: "File not found." }, 404);
  }

  const object = await c.env.RESULTS_BUCKET.get(file.r2_key);

  if (!object) {
    return c.json({ error: "Stored file not found." }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", file.mime_type);
  headers.set(
    "content-disposition",
    `inline; filename="${file.original_filename.replaceAll('"', "")}"`,
  );

  return new Response(object.body, {
    headers,
  });
});

app.post("/files/:fileId/confirm", requireAccess, async (c) => {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File id is required." }, 400);
  }

  const employee = c.get("employee");

  const result = await c.env.DB.prepare(
    `UPDATE files
     SET status = 'CONFIRMED',
         confirmed_by = ?,
         confirmed_at = CURRENT_TIMESTAMP
     WHERE file_id = ?
       AND status = 'UPLOADED'`,
  )
    .bind(employee.email, fileId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "File not found or cannot be confirmed." }, 404);
  }

  return c.json({
    fileId,
    status: "CONFIRMED",
    confirmedBy: employee.email,
  });
});

export default app;
