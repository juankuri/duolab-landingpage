import { describe, expect, it } from "vitest";

import {
  formatSize,
  initials,
  resultName,
  statusBadge,
  tallyNode,
  tallyOf,
} from "../src/scripts/admin/render.js";

const result = (status) => ({ status });

describe("tallyOf", () => {
  it("counts a folio's results by state", () => {
    const tally = tallyOf([
      result("PUBLISHED"),
      result("CONFIRMED"),
      result("UPLOADED"),
    ]);

    expect(tally.total).toBe(3);
    expect(tally.byStatus).toEqual({ PUBLISHED: 1, CONFIRMED: 1, UPLOADED: 1 });
  });

  it("counts several results in the same state", () => {
    // The case a single folio-level badge cannot express: two published results
    // and one revoked, all in one folio.
    const tally = tallyOf([
      result("PUBLISHED"),
      result("PUBLISHED"),
      result("REVOKED"),
    ]);

    expect(tally.total).toBe(3);
    expect(tally.byStatus).toEqual({ PUBLISHED: 2, REVOKED: 1 });
  });

  it("handles a folio with no results yet", () => {
    expect(tallyOf([])).toEqual({ total: 0, byStatus: {} });
    expect(tallyOf()).toEqual({ total: 0, byStatus: {} });
  });
});

describe("tallyNode", () => {
  it("shows the total and one chip per state present", () => {
    const node = tallyNode(
      tallyOf([result("UPLOADED"), result("CONFIRMED"), result("PUBLISHED")]),
    );

    const chips = [...node.querySelectorAll(".tchip")].map((c) => c.textContent);
    expect(chips[0]).toBe("3 resultados");
    expect(chips).toHaveLength(4);
    expect(node.textContent).toContain("borrador");
    expect(node.textContent).toContain("confirmado");
    expect(node.textContent).toContain("publicado");
  });

  it("omits states with no results", () => {
    const node = tallyNode(tallyOf([result("PUBLISHED")]));

    expect(node.querySelectorAll(".tchip")).toHaveLength(2);
    expect(node.textContent).not.toContain("borrador");
  });

  it("orders chips along the lifecycle regardless of input order", () => {
    const node = tallyNode(
      tallyOf([result("REVOKED"), result("UPLOADED"), result("PUBLISHED")]),
    );

    const tones = [...node.querySelectorAll(".tchip")].map((c) => c.className);
    expect(tones).toEqual([
      "tchip tchip--total",
      "tchip tchip--draft",
      "tchip tchip--published",
      "tchip tchip--revoked",
    ]);
  });

  it("says 'resultado' for one and 'resultados' for the rest", () => {
    expect(tallyNode(tallyOf([result("UPLOADED")])).textContent).toContain("1 resultado");
    expect(tallyNode(tallyOf([])).textContent).toContain("0 resultados");
  });
});

describe("statusBadge", () => {
  it("renders a glyph and a label, never colour alone", () => {
    const badge = statusBadge("PUBLISHED");

    expect(badge.querySelector(".badge__glyph").textContent).toBe("●");
    expect(badge.textContent).toContain("Publicado");
    expect(badge.className).toBe("badge badge--published");
  });

  it("still renders something for an unknown status", () => {
    expect(statusBadge("WHATEVER").textContent).toContain("Sin resultado");
  });
});

describe("resultName", () => {
  it("derives the name from the folio and the result's sequence", () => {
    // There is no result-name input anywhere in the module; the name is derived.
    expect(resultName("A-1024", { sequence: 4 }, 3)).toBe("A-1024 · #4");
  });

  it("falls back to position while the server has no sequence", () => {
    expect(resultName("A-1024", {}, 0)).toBe("A-1024 · #1");
    expect(resultName("A-1024", {}, 2)).toBe("A-1024 · #3");
  });
});

describe("formatSize", () => {
  it("scales to the nearest useful unit", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });

  it("returns nothing rather than NaN", () => {
    expect(formatSize(undefined)).toBe("");
  });
});

describe("initials", () => {
  it("takes the first and last word", () => {
    expect(initials("Juan Pablo Kuri Ricardez")).toBe("JR");
    expect(initials("Maria Lopez")).toBe("ML");
  });

  it("takes two letters from a single word", () => {
    expect(initials("Alejandro")).toBe("AL");
  });

  it("never renders an empty avatar", () => {
    expect(initials("")).toBe("?");
    expect(initials(undefined)).toBe("?");
  });
});
