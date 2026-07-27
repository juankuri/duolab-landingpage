import { describe, expect, it } from "vitest";

import { request } from "./helpers";

// The local development bypass in requireAccess skips Cloudflare Access
// entirely. It is the single most dangerous line in the Worker, so these
// tests pin the gate shut: if a later change ever makes the bypass reachable
// without ENVIRONMENT=local, they fail.

const PROTECTED = [
  { method: "GET", path: "/records" },
  { method: "GET", path: "/records/any-id" },
  { method: "GET", path: "/records/by-folio/ANY-010919-01" },
  { method: "POST", path: "/records" },
  { method: "POST", path: "/records/any-id/files" },
  { method: "DELETE", path: "/records/any-id/files/any-file" },
  { method: "GET", path: "/files/any-file" },
  { method: "POST", path: "/files/any-file/confirm" },
];

describe("requireAccess", () => {
  it.each(PROTECTED)("refuses $method $path without a token", async (route) => {
    const response = await request(route.path, {
      method: route.method,
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(401);
  });

  it("refuses an unverifiable token", async () => {
    const response = await request("/records", {
      envOverrides: { ENVIRONMENT: "production" },
      headers: { "Cf-Access-Jwt-Assertion": "not.a.jwt" },
    });

    expect(response.status).toBe(401);
  });

  it("does not bypass for any value of ENVIRONMENT other than local", async () => {
    for (const environment of ["Local", "LOCAL", "local ", "development", ""]) {
      const response = await request("/records", {
        envOverrides: { ENVIRONMENT: environment },
      });

      expect(response.status, `ENVIRONMENT=${JSON.stringify(environment)}`).toBe(401);
    }
  });

  it("does not bypass when ENVIRONMENT is absent", async () => {
    const response = await request("/records", {
      envOverrides: { ENVIRONMENT: undefined },
    });

    expect(response.status).toBe(401);
  });

  it("bypasses only when ENVIRONMENT is exactly local", async () => {
    const response = await request("/records", {
      envOverrides: { ENVIRONMENT: "local" },
    });

    expect(response.status).toBe(200);
  });

  it("leaves the health check open", async () => {
    const response = await request("/health", {
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(200);
  });
});

describe("removed learning routes", () => {
  // These streamed and wrote arbitrary objects in the results bucket with no
  // authentication at all. They must never come back.
  const REMOVED = [
    { method: "GET", path: "/learning/r2?key=records/any/any.pdf" },
    { method: "POST", path: "/learning/r2" },
    { method: "GET", path: "/learning/d1" },
    { method: "POST", path: "/learning/d1" },
  ];

  it.each(REMOVED)("$method $path is gone", async (route) => {
    const response = await request(route.path, {
      method: route.method,
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(404);
  });
});
