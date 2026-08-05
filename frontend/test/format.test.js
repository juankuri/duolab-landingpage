import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatValue } from "../src/scripts/admin/render.js";

/**
 * The "ugly data" utilities (docs/09-ux-completion-plan.md §C3): every admin
 * screen is designed against backend/scripts/seed-hostile.ts, not demo data.
 * formatValue()'s behavior is exercised in depth in render.test.js; this file
 * covers the CSS half of the contract — that the utility classes it and the
 * pages depend on actually exist with the right properties — plus the
 * end-to-end pairing of the two.
 */
const ADMIN_CSS = readFileSync(
  join(import.meta.dirname, "../src/styles/admin.css"),
  "utf-8",
);

function ruleBody(css, selector) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = withoutComments.split("}").map((b) => b.trim());
  const rule = blocks.find((block) => block.split("{")[0]?.trim() === selector);
  return rule ? rule.split("{")[1] : null;
}

describe(".truncate — single-line ellipsis utility", () => {
  it("exists with the three properties an ellipsis requires", () => {
    const body = ruleBody(ADMIN_CSS, ".truncate");
    expect(body).not.toBeNull();
    expect(body).toMatch(/overflow\s*:\s*hidden/);
    expect(body).toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(body).toMatch(/white-space\s*:\s*nowrap/);
  });
});

describe(".clamp-2 — two-line clamp utility", () => {
  it("exists with a line-clamp of 2", () => {
    const body = ruleBody(ADMIN_CSS, ".clamp-2");
    expect(body).not.toBeNull();
    expect(body).toMatch(/-webkit-line-clamp\s*:\s*2/);
  });
});

describe(".data-empty — the null convention's visual treatment", () => {
  it("exists, and formatValue() is what actually emits it", () => {
    const body = ruleBody(ADMIN_CSS, ".data-empty");
    expect(body).not.toBeNull();

    const node = formatValue(null);
    expect(node.className).toBe("data-empty");
  });
});
