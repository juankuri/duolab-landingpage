import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearCachedActor,
  fillWho,
  getCachedActor,
  loadActor,
  roleRedirect,
  setCachedActor,
} from "../src/scripts/admin/session.js";

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
    clearCachedActor();
  });

  it("reads the role from a successful /me when nothing is cached", async () => {
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

  it("defaults to EMPLOYEE when /me fails and nothing is cached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    expect(await loadActor()).toEqual({ role: "EMPLOYEE" });
  });

  it("defaults to EMPLOYEE when the network call itself rejects and nothing is cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await loadActor()).toEqual({ role: "EMPLOYEE" });
  });

  it("defaults to EMPLOYEE when the payload has no role and nothing is cached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );

    expect(await loadActor()).toEqual({ role: "EMPLOYEE" });
  });

  it("serves the cached role immediately, without waiting on the network", async () => {
    setCachedActor({ role: "MANAGER" });
    // A fetch that never resolves — if loadActor() awaited it, this test
    // would hang instead of finishing.
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    await expect(loadActor()).resolves.toEqual({ role: "MANAGER" });
  });

  it("revalidates in the background even when a cached value was served", async () => {
    setCachedActor({ role: "EMPLOYEE" });
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "EMPLOYEE" }) });
    vi.stubGlobal("fetch", fetchSpy);

    await loadActor();
    // The revalidation call is fired, not awaited by the caller — give the
    // microtask queue a turn to let it actually run.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchSpy).toHaveBeenCalled();
  });

  it("updates the cache when revalidation disagrees with what was cached", async () => {
    setCachedActor({ role: "EMPLOYEE" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "MANAGER" }) }),
    );

    await loadActor();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getCachedActor()).toEqual({ role: "MANAGER" });
  });

  it("calls onChange only when the revalidated role actually differs from the cache", async () => {
    setCachedActor({ role: "MANAGER" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "MANAGER" }) }),
    );
    const onChange = vi.fn();

    await loadActor(onChange);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange with the new actor when revalidation finds a different role", async () => {
    setCachedActor({ role: "EMPLOYEE" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "MANAGER" }) }),
    );
    const onChange = vi.fn();

    await loadActor(onChange);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalledWith({ role: "MANAGER" });
  });

  it("without a cache, resolves to the revalidated value directly — no separate onChange call needed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ role: "MANAGER" }) }),
    );
    const onChange = vi.fn();

    const result = await loadActor(onChange);

    expect(result).toEqual({ role: "MANAGER" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("getCachedActor / setCachedActor / clearCachedActor", () => {
  afterEach(() => clearCachedActor());

  it("round-trips a cached actor", () => {
    setCachedActor({ role: "MANAGER" });
    expect(getCachedActor()).toEqual({ role: "MANAGER" });
  });

  it("returns null when nothing is cached", () => {
    expect(getCachedActor()).toBeNull();
  });

  it("clearCachedActor removes it", () => {
    setCachedActor({ role: "MANAGER" });
    clearCachedActor();
    expect(getCachedActor()).toBeNull();
  });

  it("ignores a malformed cached value rather than throwing", () => {
    sessionStorage.setItem("duolab:actor", "not json");
    expect(getCachedActor()).toBeNull();
  });

  it("ignores a well-formed but role-less cached value", () => {
    sessionStorage.setItem("duolab:actor", JSON.stringify({ notARole: true }));
    expect(getCachedActor()).toBeNull();
  });
});
