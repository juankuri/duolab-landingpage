import { Hono, Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";

type Bindings = {
  DB: D1Database;
  RESULTS_BUCKET: R2Bucket;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
  CLOUDFLARE_ACCESS_AUDIENCE: string;
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

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "duolab-api",
  });
});

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

async function isPdf(file: File): Promise<boolean> {
  if (file.size === 0){
    return false;
  }

  if (file.type !== "application/pdf"){
    return false;
  }

  const header = new Uint8Array (await file.slice(0, PDF_MAGIC_BYTES.length).arrayBuffer());

  return PDF_MAGIC_BYTES.every((byte, index) => header[index] === byte)
}

async function requireAccess(c: AppContext, next: Next){
  const token = c.req.header("Cf-Access-Jwt-Assertion");

  if(!token) {
    return c.json({error: "Unauthorized"}, 401)
  }

  try{
    const certsUrl = new URL(
      `https://${c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`,
    )
    
    const jwks = createRemoteJWKSet(certsUrl);
  
    const {payload} = await jwtVerify(token, jwks, {
      issuer: `https://${c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`,
      audience: c.env.CLOUDFLARE_ACCESS_AUDIENCE,
    });

    if(typeof payload.email !== "string" || typeof payload.sub !== "string") {
      return c.json({error: "Access token is missing identity claims."}, 401);
    }

    c.set("employee", {
      email: payload.email,
      subject: payload.sub,
    });

    await next();
  } catch {
    return c.json({error: "Unauthorized"}, 401);
  }
}

//dev mode
// async function requireAccess(c: AppContext, next: Next) {
//   const token = c.req.header("Cf-Access-Jwt-Assertion");

//   if (!token) {
//     return c.json({ error: "Unauthorized" }, 401);
//   }

//   c.set("employee", {
//     email: "local-dev@duolab.test",
//     subject: "local-dev",
//   });

//   await next();
// }


// app.get("/learning/access", requireAccess, (c) => {
//   return c.json({
//     employee: c.get("employee"),
//   });
// });

//dev
// app.get("/learning/access", requireAccess, (c) => {
//   return c.json({
//     ok: true,
//     message: "Access token header exists",
//   });
// });

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

//TODO: wrap in D1 batch or make it transactionist
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
    await c.env.DB.prepare(
      "INSERT INTO patients (patient_id, full_name, birth_date, phone_number) VALUES (?, ?, ?, ?)",
    )
      .bind(patientId, fullName, birthDate, phoneNumber)
      .run();

    await c.env.DB.prepare(
      "INSERT INTO records (record_id, folio, patient_id) VALUES (?, ?, ?)",
    )
      .bind(recordId, folio, patientId)
      .run();

    return c.json(
      {
        recordId,
        patientId,
        folio,
      },
      201,
    );
  } catch (error) {
  return c.json(
    {
      error: "Could not create record.",
    },
    400,
  );
}
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
      return c.json({ error: "Record not found" }, 404);
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

    return c.json(
      {
        error: "Could not upload file.",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

app.get("/files/:fileId", requireAccess, async (c) => {
  const fileId = c.req.param("fileId");

  if(!fileId) {
    return c.json({error: "File id is required"}, 400);
  }

const file = await c.env.DB.prepare(
  "SELECT file_id, r2_key, original_filename, mime_type FROM files WHERE file_id = ?",
)
.bind(fileId)
.first<{ //todo use Type FileRow
  file_id: string;
  r2_key: string;
  original_filename: string;
  mime_type: string;
}>();

if(!file) {
  return c.json({error: "File not found"}, 404);
}

const object = await c.env.RESULTS_BUCKET.get(file.r2_key);

if(!object) {
  return c.json({error: "Stored file not found."}, 404);
}

const headers = new Headers();
object.writeHttpMetadata(headers);
headers.set("content-type", file.mime_type);
headers.set(
  "content-disposition",
  `inline; filename=${file.original_filename.replaceAll('"', "")}"`,
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
    return c.json(
      { error: "File not found or cannot be confirmed." },
      404,
    );
  }

  return c.json({
    fileId,
    status: "CONFIRMED",
    confirmedBy: employee.email,
  });
});

app.post("/learning/r2", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if(!(file instanceof File)){
    return c.json({error: "No file uploaded, please upload a file"}, 400);
  }

  if (!(await isPdf(file))) {
    return c.json({ error: "Only PDF files are allowed, please upload a PDF file" }, 400);
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

export default app;
