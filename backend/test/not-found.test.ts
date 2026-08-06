import { describe, expect, it } from "vitest";

import { request } from "./helpers";

/**
 * app.notFound (src/index.ts). Two audiences hit an unrouted path:
 *
 *   - Every API client (the admin UI, /resultados' lookup.js, this test
 *     helper) sends a plain fetch() with no explicit Accept header, which
 *     browsers default to a wildcard — never "text/html". They keep getting
 *     JSON.
 *   - A real browser navigation sends "Accept: text/html,...". Only that case
 *     gets the built 404 page, with a real 404 status.
 *
 * The dividing line is deliberately the Accept header, not the path: an
 * unmatched path under /api/* must still answer JSON for a browser tab
 * someone navigated there by hand, same as any other unmatched path.
 *
 * frontend/dist/404.html does not exist in this test run (the frontend build
 * runs separately, and docs/06-quality.md's Definition of Done runs backend
 * tests before it) — so the "page.ok" branch is never taken here, and every
 * case below observes the JSON fallback. That fallback is exactly what ships
 * to a real browser too if a deploy ever goes out without a frontend build,
 * which is the failure this test suite would rather show than hide.
 */
describe("app.notFound", () => {
  it("answers an unmatched path with the existing JSON contract", async () => {
    const res = await request("/nope");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Not found." });
  });

  it("answers the same for an unmatched /api/* path", async () => {
    const res = await request("/api/nope");

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("serves the built 404 page for a real browser Accept header, or falls back to JSON if unbuilt", async () => {
    const res = await request("/nope", {
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });

    // Whether frontend/dist/404.html exists depends on build order — it does
    // not when this suite runs before `pnpm --filter duolab build` (this
    // repo's own Definition of Done, docs/06-quality.md), and it does once
    // that build has run. Both are legitimate; the one thing that must never
    // happen in either is a 200.
    expect(res.status).toBe(404);

    const contentType = res.headers.get("Content-Type") ?? "";
    expect(contentType.includes("text/html") || contentType.includes("application/json")).toBe(
      true,
    );
  });

  it("never 500s or hangs on a HEAD request to an unmatched path", async () => {
    const res = await request("/nope", {
      method: "HEAD",
      headers: { Accept: "text/html" },
    });

    expect(res.status).toBe(404);
    // A HEAD response must carry no body, in either build state.
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  it("treats a plain fetch()'s default Accept (*/*) as an API client, not a browser", async () => {
    // This is the actual contract every existing caller relies on: fetch()
    // with no explicit Accept header — what the admin UI and lookup.js both
    // do — must not suddenly start receiving HTML.
    const res = await request("/nope", { headers: { Accept: "*/*" } });

    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("still routes every protected and public prefix to its real handler", async () => {
    // The one thing this change must never do: shadow an existing route.
    // 401 (no Access identity) or a real 4xx from the handler are both fine —
    // a 404 here would mean the route stopped being reachable.
    for (const path of ["/records", "/me", "/search", "/health"]) {
      const res = await request(path);
      expect(res.status).not.toBe(404);
    }

    // /files and /patients have no bare GET "/" route (only GET
    // "/:fileId"/"/:patientId") — routing to the handler with a real-shaped
    // id, rather than 404ing, is the "still routed" assertion for these two.
    for (const path of ["/files/some-id", "/patients/some-id"]) {
      const res = await request(path);
      expect(res.status).not.toBe(404);
    }

    // An empty body legitimately produces a 404 LOOKUP_FAILED here — the
    // route's own non-enumerating "no match" response (DEC-015), not the
    // routing-level 404 this file is otherwise about. What this asserts is
    // narrower: that it's *that* shaped error, not app.notFound's generic
    // "Not found." — i.e. the request actually reached the handler.
    const publicRes = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(await publicRes.json()).toMatchObject({ code: "LOOKUP_FAILED" });
  });
});
