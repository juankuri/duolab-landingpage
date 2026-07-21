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

app.get("/learning/access", requireAccess, (c) => {
  return c.json({
    employee: c.get("employee"),
  });
});

// //dev
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
