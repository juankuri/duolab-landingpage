import { describe, expect, it } from "vitest";

import { isCurrentPath } from "../src/scripts/public/nav.js";

describe("isCurrentPath", () => {
  it("matches an exact path", () => {
    expect(isCurrentPath("/resultados", "/resultados")).toBe(true);
  });

  it("matches across a trailing slash in either position", () => {
    // The case this function exists for: Astro's static build emits
    // /resultados/index.html, so the browser reports "/resultados/" while
    // every link in the site is written "/resultados".
    expect(isCurrentPath("/resultados/", "/resultados")).toBe(true);
    expect(isCurrentPath("/resultados", "/resultados/")).toBe(true);
    expect(isCurrentPath("/resultados/", "/resultados/")).toBe(true);
  });

  it("treats the root as current only for the root", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/", "/resultados")).toBe(false);
    expect(isCurrentPath("/resultados", "/")).toBe(false);
  });

  it("does not match a different path", () => {
    expect(isCurrentPath("/terminos-de-uso", "/aviso-de-privacidad")).toBe(false);
  });

  it("does not match on a shared prefix", () => {
    expect(isCurrentPath("/resultados-viejos", "/resultados")).toBe(false);
  });

  it("is never current for an anchor or an external href", () => {
    expect(isCurrentPath("/", "#ubicacion")).toBe(false);
    expect(isCurrentPath("/", "https://wa.me/529381156464")).toBe(false);
    expect(isCurrentPath("/", "")).toBe(false);
  });

  it("returns false rather than throwing on missing input", () => {
    expect(isCurrentPath(undefined, "/")).toBe(false);
    expect(isCurrentPath("", "/")).toBe(false);
    expect(isCurrentPath("/", undefined)).toBe(false);
    expect(isCurrentPath("/", null)).toBe(false);
  });
});
