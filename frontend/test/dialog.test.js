import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression guard for the D1 defect (docs/09-ux-completion-plan.md §C1):
 * `.sheet--pdf { display: flex }` on the bare selector overrode the browser's
 * own `dialog { display: none } dialog[open] { display: block }` pair —
 * specificity (0,0,1) loses to a class selector's (0,1,0), so any author
 * class rule with `display` and no `[open]` requirement wins regardless of
 * whether the dialog is open. The fullscreen PDF `<dialog>` on /admin/nuevo
 * painted — non-modally, full of its own flex layout — even while closed,
 * making the entire form unreachable behind it.
 *
 * This is a static check, not a computed-style one: jsdom hardcodes a closed
 * `<dialog>` to `display: none` independent of author CSS (verified directly
 * — an unconditional `.x { display: flex }` with no `!important` still
 * computed to `none` for a closed dialog in jsdom), so a computed-style
 * assertion here would pass whether or not the bug is present and is not a
 * real guard. Real browsers do not do this — MDN's dialog rendering section
 * confirms the actual UA rule is the specificity-(0,0,1) pair above, which is
 * exactly what let the low-specificity author bug win in production.
 */
const ADMIN_CSS = readFileSync(
  join(import.meta.dirname, "../src/styles/admin.css"),
  "utf-8",
);

/** Strips /* ... *\/ comments before splitting into rule blocks — a naive
 * split on `}` breaks when a comment contains literal selector text with no
 * matching braces, which is exactly the shape of this file's own
 * documentation of the bug it's guarding against. */
function ruleBlocks(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutComments
    .split("}")
    .map((block) => block.trim())
    .filter(Boolean);
}

describe("admin.css — no unscoped display on a .sheet-family selector", () => {
  it("every rule whose selector matches .sheet and sets `display` requires [open] or is ::backdrop", () => {
    const offenders = ruleBlocks(ADMIN_CSS)
      .map((block) => {
        const [selector = "", body = ""] = block.split("{");
        return { selector: selector.trim(), body };
      })
      .filter(({ selector }) => /\.sheet/.test(selector))
      .filter(({ body }) => /display\s*:/.test(body))
      .filter(({ selector }) => !/\[open\]/.test(selector) && !/::backdrop/.test(selector));

    expect(offenders).toEqual([]);
  });

  it("the fullscreen dialog's flex layout is scoped to [open] — the actual fix", () => {
    const hasScopedRule = ruleBlocks(ADMIN_CSS)
      .map((block) => block.split("{")[0]?.trim())
      .filter(Boolean)
      .some((selector) => selector === ".sheet--pdf[open]");

    expect(hasScopedRule).toBe(true);
  });

  it("the bare .sheet--pdf selector (sizing only) sets no display", () => {
    const bareRule = ruleBlocks(ADMIN_CSS).find(
      (block) => block.split("{")[0]?.trim() === ".sheet--pdf",
    );

    expect(bareRule).toBeDefined();
    expect(/display\s*:/.test(bareRule.split("{")[1] ?? "")).toBe(false);
  });
});
