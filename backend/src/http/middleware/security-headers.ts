import type { Next } from "hono";

import type { AppContext } from "../../env";

/**
 * The Worker-side twin of frontend/public/_headers (DEC-030). wrangler's
 * assets binding serves static pages (/, /admin/*, /resultados) before this
 * Worker script ever runs (DEC-020), so that file covers those. This
 * middleware covers everything that DOES run here: every JSON route, the
 * public download PDF stream, every onError response, and the app.notFound
 * HTML passthrough — none of which _headers ever sees.
 *
 * Deliberately no Content-Security-Policy here beyond what a JSON body
 * needs: the 404 passthrough serves dist/404.html, which carries its own
 * <meta> CSP from Astro's build (astro.config.mjs) — a restrictive
 * default-src here would apply to that HTML response too and blank the
 * page. frame-ancestors is set anyway: it's a header-only directive, cheap
 * to repeat, and this response can be framed just as easily as any other.
 *
 * Referrer-Policy is no-referrer globally, not strict-origin-when-cross-origin
 * — publicRoutes' own middleware (routes/public/index.ts) already needs
 * no-referrer post-next() to keep a download token out of any Referer
 * header, and since that middleware runs *inside* this one, a weaker global
 * default would only ever get overwritten there, never strengthened. One
 * value everywhere removes the ordering trap instead of relying on it.
 */
export async function securityHeaders(c: AppContext, next: Next) {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Content-Security-Policy", "frame-ancestors 'none'");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
}
