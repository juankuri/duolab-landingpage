import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Admin markup is built at runtime via document.createElement + textContent
 * on purpose (render.js's own comment) — every value it renders is patient
 * data or a filename typed by someone, and textContent cannot be talked into
 * executing any of it. That is a convention today, not a guard: nothing fails
 * if a future change swaps textContent for innerHTML on a value that came
 * from a request. This test is that guard, in the family of
 * legal-gating.test.js's source-text assertions.
 *
 * The allowlist below is every current innerHTML/outerHTML/
 * insertAdjacentHTML/document.write/set:html use in the frontend, each one
 * a build-time-constant SVG path string from @phosphor-icons/core (DEC-028)
 * or a JSON.stringify()'d literal — never a request-derived value. It is
 * keyed by file AND the exact matched line, so swapping the safe expression
 * on an allowlisted line for something request-derived still fails this
 * test; only that literal line is exempt, not the whole file.
 */
const ROOT = process.cwd();
const SCAN_DIRS = ["src/scripts", "src/pages", "src/components", "src/layouts"];
const PATTERN = /\.(innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\(|document\.write\(|set:html=/;

const ALLOWED = new Set([
  "src/scripts/admin/render.js:svg.innerHTML = icon.inner;",
  "src/scripts/shared/icons.js:svg.innerHTML = icon.inner;",
  'src/components/Icon.astro:set:html={icon.inner}',
  'src/layouts/Layout.astro:set:html={JSON.stringify(localBusinessSchema)}',
]);

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(js|astro)$/.test(entry)) {
      files.push(full);
    }
  }

  return files;
}

describe("no innerHTML/outerHTML/insertAdjacentHTML/document.write on non-literal data", () => {
  const violations = [];

  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const relative = file.slice(ROOT.length + 1);
      const lines = readFileSync(file, "utf8").split("\n");

      lines.forEach((line, i) => {
        if (!PATTERN.test(line)) return;

        const key = `${relative}:${line.trim()}`;
        if (!ALLOWED.has(key)) {
          violations.push(`${relative}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }

  it("has no occurrence outside the named, build-time-constant allowlist", () => {
    expect(violations).toEqual([]);
  });
});
