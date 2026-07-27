import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppContext, AppEnv } from "./env";
import { isLocalDev, requireAccess } from "./http/middleware/auth";
import { files } from "./http/routes/files";
import { records } from "./http/routes/records";

const app = new Hono<AppEnv>();

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

// requireAccess is attached here, at the mount, rather than on each handler.
// A route added inside these modules is therefore protected by construction:
// forgetting the middleware is not something an individual handler can do.
app.route("/records", new Hono<AppEnv>().use("*", requireAccess).route("/", records));
app.route("/files", new Hono<AppEnv>().use("*", requireAccess).route("/", files));

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
