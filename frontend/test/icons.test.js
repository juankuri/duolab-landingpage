import { describe, expect, it } from "vitest";

import { ICON_NAMES, ICONS, ICONS_FILL } from "../src/scripts/shared/icons.js";

describe("icons.js — every ICON_NAMES entry resolves to a real Phosphor path", () => {
  it.each(ICON_NAMES)("%s has a non-empty viewBox and inner markup", (name) => {
    const icon = ICONS[name];
    expect(icon).toBeDefined();
    expect(icon.viewBox).toMatch(/^\d+ \d+ \d+ \d+$/);
    expect(icon.inner.length).toBeGreaterThan(0);
    // Phosphor's regular weight is fill-based path data, not a raster or a
    // font reference — this is the actual guard that the icon is inlined
    // SVG, not something resolved at runtime.
    expect(icon.inner).toMatch(/<path/);
  });

  it("ICONS_FILL only contains names that also exist in ICONS (fill is a variant, not a separate set)", () => {
    for (const name of Object.keys(ICONS_FILL)) {
      expect(ICONS).toHaveProperty(name);
    }
  });

  it("a fill variant is visually distinct from its regular counterpart", () => {
    for (const [name, fillIcon] of Object.entries(ICONS_FILL)) {
      expect(fillIcon.inner).not.toBe(ICONS[name].inner);
    }
  });
});
