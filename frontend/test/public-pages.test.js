import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the public site, in the same spirit as dialog.test.js
 * and format.test.js: contracts that no unit test can reach, because they live
 * in .astro markup rather than in an importable module, and that do not justify
 * standing up a browser suite on their own (docs/06-quality.md, "Pages").
 *
 * These assert on source text, so they are blunt. Each one exists because the
 * thing it checks has either already broken once or would break silently.
 */

const SRC = join(process.cwd(), "src");
const PUBLIC_DIR = join(process.cwd(), "public");

/** Every .astro file under src/, recursively. */
function astroFiles(dir = SRC) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return astroFiles(path);
    return path.endsWith(".astro") ? [path] : [];
  });
}

describe("root-relative asset references resolve to a real file in public/", () => {
  // The regression this exists for: Header.astro pointed at
  // /clients/duolab/logo/logo-mark.svg for the entire life of the landing page,
  // while the asset has always been at /logo/logo-mark.svg. It shipped — the
  // built dist/index.html carried the dead path — and the header rendered its
  // alt text instead of the wordmark. Nothing caught it, because a 404 on an
  // <img> is silent in every build, test and type check this repo runs.
  const files = astroFiles();

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))("%s", (_label, file) => {
    const source = readFileSync(file, "utf8");

    // src="/…" and href="/…" pointing at a file extension — i.e. an asset, not
    // a route. Routes have no extension and are checked by the build itself.
    const refs = [...source.matchAll(/(?:src|href)="(\/[^"?#]*\.[a-z0-9]{2,5})"/gi)]
      .map((m) => m[1])
      // Astro rewrites anything it resolves through import/bundling; only
      // literal public/ paths are ours to verify.
      .filter((ref) => !ref.startsWith("/_astro/"));

    for (const ref of refs) {
      expect(existsSync(join(PUBLIC_DIR, ref)), `${ref} is not in public/`).toBe(true);
    }
  });
});

describe("pages that render their own <html> import the brand token stylesheet", () => {
  // The regression this exists for: 404.astro built its own <head> like every
  // other top-level page, but never imported styles/clients/duolab.css. Its
  // scoped <style> block was correct CSS — every var(--color-*), var(--space-*)
  // just resolved to nothing, so the page rendered unstyled. Nothing caught it:
  // astro check doesn't evaluate custom properties, and no test rendered the page.
  const files = astroFiles().filter((f) => readFileSync(f, "utf8").includes("<html"));

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))("%s", (_label, file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/import\s+["']..?\/(?:..\/)*styles\/clients\/duolab\.css["'];?/);
  });
});
