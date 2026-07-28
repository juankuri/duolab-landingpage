import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppContext, AppEnv } from "./env";
import { onError } from "./http/errors";
import { isLocalDev, requireAccess } from "./http/middleware/auth";
import { files } from "./http/routes/files";
import { me } from "./http/routes/me";
import { publicRoutes } from "./http/routes/public";
import { records } from "./http/routes/records";
import { search } from "./http/routes/search";

const app = new Hono<AppEnv>();

// First middleware, so every later one and every error handler can report it.
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID().slice(0, 8));
  await next();
});

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
const protectedRoutes = () => new Hono<AppEnv>().use("*", requireAccess);

app.route("/me", protectedRoutes().route("/", me));
app.route("/records", protectedRoutes().route("/", records));
app.route("/files", protectedRoutes().route("/", files));
app.route("/search", protectedRoutes().route("/", search));

// No requireAccess: patients are never Access users (DEC-012). Rate limiting
// and non-enumerating responses are the boundary here, not authentication.
app.route("/api/public", publicRoutes);

// Every route in this Worker answers with JSON, so the two paths Hono handles
// on its own should too. Without these, an unknown path or an unhandled throw
// returns text the admin UI cannot parse, and its error handling falls back to
// a generic message that hides what actually happened.
app.notFound((c) => {
  return c.json({ error: "Not found." }, 404);
});

app.onError(onError);

export default app;
