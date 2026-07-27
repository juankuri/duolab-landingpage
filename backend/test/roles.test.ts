import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { satisfies } from "../src/domain/roles";
import { json, request } from "./helpers";

async function seed(email: string, role: string, active = 1) {
  await env.DB.prepare(
    "INSERT INTO users (email, role, active) VALUES (?, ?, ?)",
  )
    .bind(email, role, active)
    .run();
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("role model", () => {
  it("treats MANAGER as a superset of EMPLOYEE", () => {
    expect(satisfies("MANAGER", "EMPLOYEE")).toBe(true);
    expect(satisfies("MANAGER", "MANAGER")).toBe(true);
    expect(satisfies("EMPLOYEE", "EMPLOYEE")).toBe(true);
    // The one thing an employee cannot do.
    expect(satisfies("EMPLOYEE", "MANAGER")).toBe(false);
  });
});

describe("users table", () => {
  it("refuses to store a non-normalized address", async () => {
    await expect(seed("Ana@Duolab.MX", "EMPLOYEE")).rejects.toThrow();
    await expect(seed(" ana@duolab.mx", "EMPLOYEE")).rejects.toThrow();
  });

  it("refuses a role outside the known set", async () => {
    await expect(seed("ana@duolab.mx", "ADMIN")).rejects.toThrow();
  });

  it("matches an address regardless of case", async () => {
    await seed("ana@duolab.mx", "MANAGER");

    const found = await env.DB.prepare("SELECT role FROM users WHERE email = ?")
      .bind("ANA@DUOLAB.MX")
      .first<{ role: string }>();

    expect(found?.role).toBe("MANAGER");
  });
});

describe("the local development bypass", () => {
  it("defaults to the employee role", async () => {
    const body = await json(await request("/me"));

    expect(body).toEqual({ email: "local-dev@duolab.test", role: "EMPLOYEE" });
  });

  it("grants the manager role when DEV_ROLE asks for it", async () => {
    const body = await json(
      await request("/me", { envOverrides: { DEV_ROLE: "manager" } }),
    );

    expect(body.role).toBe("MANAGER");
  });

  it("falls back to employee for a DEV_ROLE it does not recognize", async () => {
    for (const value of ["admin", "", "MANAGERS", "superuser"]) {
      const body = await json(
        await request("/me", { envOverrides: { DEV_ROLE: value } }),
      );

      expect(body.role, `DEV_ROLE=${JSON.stringify(value)}`).toBe("EMPLOYEE");
    }
  });

  // The critical one: DEV_ROLE must be inert outside local development, or it
  // becomes a way to hand out the manager role from configuration.
  it("ignores DEV_ROLE entirely when ENVIRONMENT is not local", async () => {
    const response = await request("/me", {
      envOverrides: { ENVIRONMENT: "production", DEV_ROLE: "manager" },
    });

    expect(response.status).toBe(401);
  });
});

describe("role resolution behind Access", () => {
  // Without a verifiable token these all stop at authentication, which is the
  // point: the users lookup is never reached by an unauthenticated caller.
  it("refuses a request with no token before any lookup", async () => {
    await seed("ana@duolab.mx", "MANAGER");

    const response = await request("/me", {
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(401);
    expect((await json(response)).code).toBe("UNAUTHENTICATED");
  });

  it("ignores a role supplied by the client", async () => {
    const body = await json(
      await request("/me", {
        headers: { "X-Role": "MANAGER", "Cf-Access-Jwt-Assertion": "forged" },
      }),
    );

    // Local dev, so DEV_ROLE decides. Nothing the client sent is consulted.
    expect(body.role).toBe("EMPLOYEE");
  });

  it("does not accept a forged token outside local dev", async () => {
    const response = await request("/me", {
      envOverrides: { ENVIRONMENT: "production" },
      headers: { "Cf-Access-Jwt-Assertion": "forged.token.value" },
    });

    expect(response.status).toBe(401);
  });
});
