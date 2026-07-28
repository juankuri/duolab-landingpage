import { afterEach, describe, expect, it, vi } from "vitest";

import { fillWho, loadActor, roleRedirect } from "../src/scripts/admin/session.js";

describe("roleRedirect", () => {
  it("sends a MANAGER on /admin straight to /admin/manager", () => {
    expect(roleRedirect("MANAGER", "/admin")).toBe("/admin/manager");
  });

  it("leaves an EMPLOYEE on /admin alone", () => {
    expect(roleRedirect("EMPLOYEE", "/admin")).toBeNull();
  });

  it("leaves a MANAGER on /admin/manager alone", () => {
    expect(roleRedirect("MANAGER", "/admin/manager")).toBeNull();
  });

  it("sends an EMPLOYEE on /admin/manager back to /admin", () => {
    expect(roleRedirect("EMPLOYEE", "/admin/manager")).toBe("/admin");
  });

  it("treats an unknown role the same as EMPLOYEE", () => {
    expect(roleRedirect("SOMETHING_ELSE", "/admin")).toBeNull();
    expect(roleRedirect("SOMETHING_ELSE", "/admin/manager")).toBe("/admin");
  });

  it("does not redirect anywhere else", () => {
    expect(roleRedirect("MANAGER", "/admin/folio")).toBeNull();
    expect(roleRedirect("EMPLOYEE", "/admin/buscar")).toBeNull();
  });

  it("the ?desktop=1 escape hatch keeps a MANAGER on /admin", () => {
    expect(roleRedirect("MANAGER", "/admin", { desktop: true })).toBeNull();
  });

  it("the escape hatch has no effect on /admin/manager itself", () => {
    // desktop=1 only ever means "let me see the dense admin"; it must not
    // also let an EMPLOYEE stay on the manager-only screen.
    expect(roleRedirect("EMPLOYEE", "/admin/manager", { desktop: true })).toBe("/admin");
  });
});

describe("fillWho", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("labels a manager", () => {
    document.body.innerHTML = '<span id="who-name"></span><span id="who-initials"></span>';
    fillWho("MANAGER");

    expect(document.getElementById("who-name").textContent).toBe("Gerencia");
    expect(document.getElementById("who-initials").textContent).toBe("GE");
  });

  it("labels an employee", () => {
    document.body.innerHTML = '<span id="who-name"></span><span id="who-initials"></span>';
    fillWho("EMPLOYEE");

    expect(document.getElementById("who-name").textContent).toBe("Recepción");
    expect(document.getElementById("who-initials").textContent).toBe("RE");
  });

  it("does nothing when the elements are not on the page", () => {
    document.body.innerHTML = "";
    expect(() => fillWho("MANAGER")).not.toThrow();
  });
});

describe("loadActor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the role from a successful /me", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ email: "gerencia@duolab.test", role: "MANAGER" }),
      }),
    );

    expect(await loadActor()).toEqual({ role: "MANAGER" });
  });

  it("defaults to EMPLOYEE when /me fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    expect(await loadActor()).toEqual({ role: "EMPLOYEE" });
  });

  it("defaults to EMPLOYEE when the network call itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await loadActor()).toEqual({ role: "EMPLOYEE" });
  });

  it("defaults to EMPLOYEE when the payload has no role", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );

    expect(await loadActor()).toEqual({ role: "EMPLOYEE" });
  });
});
