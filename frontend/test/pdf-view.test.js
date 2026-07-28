import { describe, expect, it } from "vitest";

import {
  ZOOM_STEPS,
  canvasPixels,
  clampPage,
  fitWidthScale,
  nextZoom,
} from "../src/scripts/admin/pdf-view.js";

describe("clampPage", () => {
  it("keeps a page inside [1, total]", () => {
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-2, 5)).toBe(1);
    expect(clampPage(99, 5)).toBe(5);
  });

  it("returns 0 for a document with no pages", () => {
    expect(clampPage(1, 0)).toBe(0);
  });

  it("clamps to the single page of a one-page document", () => {
    expect(clampPage(1, 1)).toBe(1);
    expect(clampPage(5, 1)).toBe(1);
  });
});

describe("nextZoom", () => {
  it("steps forward through the ladder", () => {
    expect(nextZoom("fit-width", 1)).toBe(1.5);
    expect(nextZoom(1.5, 1)).toBe(2);
    expect(nextZoom(2, 1)).toBe(3);
  });

  it("steps backward through the ladder", () => {
    expect(nextZoom(3, -1)).toBe(2);
    expect(nextZoom(1.5, -1)).toBe("fit-width");
  });

  it("clamps at the top instead of wrapping", () => {
    expect(nextZoom(3, 1)).toBe(3);
  });

  it("clamps at the bottom instead of wrapping", () => {
    expect(nextZoom("fit-width", -1)).toBe("fit-width");
  });

  it("treats an unknown current value as the start of the ladder", () => {
    expect(nextZoom("bogus", 1)).toBe(ZOOM_STEPS[1]);
  });
});

describe("fitWidthScale", () => {
  it("scales the page to exactly the viewport width", () => {
    expect(fitWidthScale(400, 200)).toBe(2);
    expect(fitWidthScale(300, 600)).toBe(0.5);
  });

  it("falls back to 1 for a degenerate page width", () => {
    expect(fitWidthScale(400, 0)).toBe(1);
    expect(fitWidthScale(400, -10)).toBe(1);
  });
});

describe("canvasPixels", () => {
  it("uses the requested scale when comfortably under the cap", () => {
    const result = canvasPixels(1, 600, 800, 2, 12_000_000);

    // scale * dpr = 2; pixel count = (600*2) * (800*2)
    expect(result.scale).toBe(2);
    expect(result.pixels).toBe(1200 * 1600);
  });

  it("clamps the scale down when it would exceed the cap", () => {
    const cap = 1_000_000;
    const result = canvasPixels(3, 600, 800, 3, cap);

    expect(result.pixels).toBeCloseTo(cap, 0);
    expect(result.scale).toBeLessThan(3 * 3);
  });

  it("holds at a dpr of 3 on a very wide page without exceeding the cap", () => {
    const cap = 10_000_000;
    const result = canvasPixels(2, 3000, 4000, 3, cap);

    expect(result.pixels).toBeLessThanOrEqual(cap + 1);
  });
});
