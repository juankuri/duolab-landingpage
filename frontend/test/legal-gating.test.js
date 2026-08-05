import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The guard that placeholder legal copy cannot reach production.
 *
 * /aviso-de-privacidad and /terminos-de-uso carry [PENDIENTE] bodies. A
 * placeholder privacy notice on the production origin is worse than no page:
 * it looks like a commitment nobody made. `noindex` does not prevent that — it
 * asks crawlers not to list the page and does nothing about a typed URL — so
 * the actual mechanism is the LEGAL_ENABLED flag, and these tests are what
 * keep someone from quietly removing it.
 *
 * Delete this file in the same commit as the approved legal copy.
 */

const ROOT = process.cwd();
const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");

describe("LEGAL_ENABLED fails safe", () => {
  // Read rather than imported: import.meta.env.LEGAL_ENABLED is substituted by
  // Vite at build time, so importing the module here would test this test
  // runner's environment, not the production build's.
  const source = read("src", "config", "features.js");

  it("is on only for the exact string \"1\"", () => {
    expect(source).toContain('import.meta.env.LEGAL_ENABLED === "1"');
  });

  it("has no default that turns it on", () => {
    // e.g. `?? "1"` or `!== "0"` — anything that makes an unset variable mean
    // "enabled" inverts the whole point of the flag.
    expect(source).not.toMatch(/\?\?\s*["']1["']/);
    expect(source).not.toMatch(/!==\s*["']0["']/);
  });
});

describe("the legal routes exist only under the flag", () => {
  it("keeps both pages out of Astro's file-based routing", () => {
    // Directly under src/pages/ they would be routed unconditionally and the
    // flag would gate nothing.
    expect(existsSync(join(ROOT, "src/pages/_legal/aviso-de-privacidad.astro"))).toBe(true);
    expect(existsSync(join(ROOT, "src/pages/_legal/terminos-de-uso.astro"))).toBe(true);
    expect(existsSync(join(ROOT, "src/pages/aviso-de-privacidad.astro"))).toBe(false);
    expect(existsSync(join(ROOT, "src/pages/terminos-de-uso.astro"))).toBe(false);
  });

  it("injects them behind a LEGAL_ENABLED guard", () => {
    const config = read("astro.config.mjs");
    expect(config).toContain('process.env.LEGAL_ENABLED === "1"');
    expect(config).toContain("if (!LEGAL_ENABLED) return;");
    expect(config).toContain("./src/pages/_legal/aviso-de-privacidad.astro");
    expect(config).toContain("./src/pages/_legal/terminos-de-uso.astro");
  });

  it("keeps both out of the sitemap while they hold placeholders", () => {
    const config = read("astro.config.mjs");
    expect(config).toContain('!page.includes("/aviso-de-privacidad")');
    expect(config).toContain('!page.includes("/terminos-de-uso")');
  });
});

describe("the footer's Legal column is gated too", () => {
  const footer = read("src", "components", "public", "PublicFooter.astro");

  it("imports the flag and renders the column behind it", () => {
    expect(footer).toContain('import { LEGAL_ENABLED } from "../../config/features.js"');
    expect(footer).toContain("LEGAL_ENABLED && (");
  });

  it("has no unconditional link to either legal route", () => {
    // Every occurrence of a legal path must sit inside the gated block, which
    // is the only place `legal.privacy.path` / `legal.terms.path` appear.
    expect(footer).not.toContain('href="/aviso-de-privacidad"');
    expect(footer).not.toContain('href="/terminos-de-uso"');
  });
});
