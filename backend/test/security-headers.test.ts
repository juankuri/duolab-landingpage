import { describe, expect, it } from "vitest";

import { json, publishedRecord, request } from "./helpers";

/**
 * http/middleware/security-headers.ts (DEC-030) — the Worker-side half of
 * the headers policy. frontend/public/_headers is the other half, covering
 * static asset responses this Worker never sees (DEC-020); nothing here
 * tests that file, since it's outside this suite's reach.
 */
const EXPECTED = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function expectSecurityHeaders(response: Response) {
  for (const [header, value] of Object.entries(EXPECTED)) {
    expect(response.headers.get(header)).toBe(value);
  }
}

describe("security headers on every response path", () => {
  it("sets them on a protected JSON route", async () => {
    const response = await request("/health");
    expectSecurityHeaders(response);
  });

  it("sets them on a public lookup success", async () => {
    await publishedRecord({ folio: "SH-010190-1" });
    const response = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folio: "SH-010190-1",
        phone: "9381234567",
        birthDate: "1990-01-09",
      }),
    });
    expectSecurityHeaders(response);
  });

  it("sets them on a public lookup failure (LOOKUP_FAILED)", async () => {
    const response = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folio: "NOPE-1", phone: "0", birthDate: "1990-01-09" }),
    });
    expectSecurityHeaders(response);
  });

  it("sets them on the public download response", async () => {
    await publishedRecord({ folio: "SH-020190-1" });
    const lookup = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folio: "SH-020190-1",
        phone: "9381234567",
        birthDate: "1990-01-09",
      }),
    });
    const { downloadToken, results } = await json(lookup);
    const fileId = results[0].fileId;

    const response = await request(
      `/api/public/results/${encodeURIComponent(downloadToken)}/download/${fileId}`,
    );
    expectSecurityHeaders(response);
  });

  it("sets them on an unexpected error response", async () => {
    // A malformed JSON body reaches onError's INVALID_INPUT path (400), which
    // still runs through the same global middleware as a 500 would.
    const response = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(response.status).toBe(400);
    expectSecurityHeaders(response);
  });

  it("sets them on the JSON 404", async () => {
    const response = await request("/nope");
    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
  });

  it("keeps Cache-Control: no-store on public routes alongside the global headers", async () => {
    const response = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folio: "NOPE-1", phone: "0", birthDate: "1990-01-09" }),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expectSecurityHeaders(response);
  });

  it("keeps Referrer-Policy: no-referrer on the public routes specifically", async () => {
    // Regression guard for the ordering trap noted in security-headers.ts:
    // publicRoutes' own middleware runs *inside* the global one, so a weaker
    // global default would silently overwrite the stricter value exactly on
    // the route whose URL carries a download token.
    await publishedRecord({ folio: "SH-030190-1" });

    const response = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folio: "SH-030190-1",
        phone: "9381234567",
        birthDate: "1990-01-09",
      }),
    });
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
