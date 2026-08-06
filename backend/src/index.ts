import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppContext, AppEnv } from "./env";
import { onError } from "./http/errors";
import { isLocalDev, requireAccess } from "./http/middleware/auth";
import { securityHeaders } from "./http/middleware/security-headers";
import { files } from "./http/routes/files";
import { me } from "./http/routes/me";
import { patients } from "./http/routes/patients";
import { publicRoutes } from "./http/routes/public";
import { records } from "./http/routes/records";
import { search } from "./http/routes/search";

const app = new Hono<AppEnv>();

// First middleware, so every later one and every error handler can report it.
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID().slice(0, 8));
  await next();
});

// See security-headers.ts for what this covers and what it deliberately
// doesn't. Mounted early so it wraps onError responses and app.notFound too.
app.use("*", securityHeaders);

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
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
app.route("/patients", protectedRoutes().route("/", patients));

// No requireAccess: patients are never Access users (DEC-012). Rate limiting
// and non-enumerating responses are the boundary here, not authentication.
app.route("/api/public", publicRoutes);

// Every route in this Worker answers with JSON, so the two paths Hono handles
// on its own should too, for every caller except a browser navigation.
// Without the JSON default, an unknown path or an unhandled throw returns text
// the admin UI cannot parse, and its error handling falls back to a generic
// message that hides what actually happened.
//
// A browser hitting an unrouted path (a bad link, a typo) instead gets the
// built 404 page with a real 404 status — see DEC-029 for what this assumed
// going in and what verification actually found:
//   - env.ASSETS.fetch() applies the *same* not_found_handling ("none") to
//     its own lookups. Requesting an existing file (/404.html, once built)
//     is a direct hit and is unaffected by that setting; it only governs what
//     happens when nothing matches, which is not this call.
//   - A plain fetch() (the admin UI, lookup.js) sends "Accept: */*", not
//     "text/html" — this branch only fires for that header on a real browser
//     navigation, verified against every request already made in this repo.
//   - Passing only a URL to ASSETS.fetch() always resolves as GET, even for
//     an original HEAD request — the HEAD case is handled explicitly below
//     rather than relying on the binding to do it.
//   - If frontend/dist/404.html doesn't exist (no frontend build yet — local
//     dev, or this test suite, which runs before `pnpm build`), `page.ok` is
//     false and this falls through to the existing JSON 404. Never a 200.
app.notFound(async (c) => {
  const wantsHtml = c.req.header("Accept")?.includes("text/html") ?? false;

  if (wantsHtml) {
    const page = await c.env.ASSETS.fetch(new URL("/404.html", c.req.url));

    if (page.ok) {
      return new Response(c.req.method === "HEAD" ? null : page.body, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  return c.json({ error: "Not found." }, 404);
});

app.onError(onError);

export default app;
