import { describe, expect, it } from "vitest";

import {
  fillPatientCard,
  folioRowNode,
  formatSize,
  formatValue,
  initials,
  patientRowNode,
  resultName,
  setStatusLine,
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

describe("setStatusLine", () => {
  it("sets the text and tone", () => {
    const node = document.createElement("p");
    setStatusLine(node, "Cargando…", "info");
    expect(node.textContent).toBe("Cargando…");
    expect(node.dataset.tone).toBe("info");
  });

  it("clears the tone when none is given", () => {
    const node = document.createElement("p");
    node.dataset.tone = "error";
    setStatusLine(node, "");
    expect(node.textContent).toBe("");
    expect(node.dataset.tone).toBeUndefined();
  });

  it("treats a falsy message as empty text", () => {
    const node = document.createElement("p");
    setStatusLine(node, null);
    expect(node.textContent).toBe("");
  });
});

describe("folioRowNode", () => {
  const folio = { folio: "A-1024", patientName: "Juan Pablo Kuri", results: [] };

  it("links to the folio by default, with the patient name as meta", () => {
    const li = folioRowNode(folio);
    const link = li.querySelector("a");
    expect(link.getAttribute("href")).toBe("/admin/folio?f=A-1024");
    expect(li.querySelector(".frow__name").textContent).toBe("A-1024");
    expect(li.querySelector(".frow__meta").textContent).toBe("Juan Pablo Kuri");
  });

  it("accepts an override href and meta text", () => {
    const li = folioRowNode(folio, { href: "/x", metaText: "custom" });
    expect(li.querySelector("a").getAttribute("href")).toBe("/x");
    expect(li.querySelector(".frow__meta").textContent).toBe("custom");
  });

  it("omits the meta line when explicitly suppressed with null", () => {
    const li = folioRowNode(folio, { metaText: null });
    expect(li.querySelector(".frow__meta")).toBeNull();
  });

  it("carries the full folio and meta text in `title`, for a name too long to display in full", () => {
    const longName = "A".repeat(120);
    const li = folioRowNode({ ...folio, patientName: longName });
    expect(li.querySelector(".frow__name").title).toBe("A-1024");
    expect(li.querySelector(".frow__meta").title).toBe(longName);
  });
});

describe("patientRowNode", () => {
  it("renders avatar, name, phone and folio count", () => {
    const li = patientRowNode({
      patientId: "p1",
      fullName: "Ana Ruiz",
      phoneNumber: "9381234567",
      folioCount: 3,
    });

    expect(li.querySelector("a").getAttribute("href")).toBe("/admin/paciente?id=p1");
    expect(li.querySelector(".pavatar").textContent).toBe("AR");
    expect(li.querySelector(".frow__name").textContent).toBe("Ana Ruiz");
    expect(li.querySelector(".frow__meta").textContent).toBe("9381234567 · 3 folios");
  });

  it("uses the singular word for exactly one folio", () => {
    const li = patientRowNode({
      patientId: "p1",
      fullName: "Ana Ruiz",
      phoneNumber: "9381234567",
      folioCount: 1,
    });
    expect(li.querySelector(".frow__meta").textContent).toContain("1 folio");
    expect(li.querySelector(".frow__meta").textContent).not.toContain("folios");
  });

  it("carries the full name in `title` for a name too long to display in full", () => {
    const longName = "B".repeat(120);
    const li = patientRowNode({
      patientId: "p1",
      fullName: longName,
      phoneNumber: "9381234567",
      folioCount: 1,
    });
    expect(li.querySelector(".frow__name").title).toBe(longName);
  });
});

describe("fillPatientCard", () => {
  it("fills avatar initials, name and the birthDate · phone meta line", () => {
    const avatar = document.createElement("span");
    const name = document.createElement("h1");
    const meta = document.createElement("p");

    fillPatientCard(
      { avatar, name, meta },
      { fullName: "Juan Pablo Kuri", birthDate: "1990-01-01", phoneNumber: "9381234567" },
    );

    expect(avatar.textContent).toBe("JK");
    expect(name.textContent).toBe("Juan Pablo Kuri");
    // The name node is visually clamped for a long name (admin.css .clamp-2)
    // — `title` is what makes the full value reachable regardless.
    expect(name.title).toBe("Juan Pablo Kuri");
    expect(meta.title).toBe("1990-01-01 · 9381234567");
    // The meta line pairs an icon with each value (brief §5: never icon
    // alone) — birthDate and phoneNumber must both still be reachable as
    // text, and a calendar + phone icon must both be present.
    expect(meta.textContent).toContain("1990-01-01");
    expect(meta.textContent).toContain("9381234567");
    expect(meta.querySelectorAll("svg")).toHaveLength(2);
  });

  it("tolerates a missing avatar/meta node", () => {
    const name = document.createElement("h1");
    expect(() =>
      fillPatientCard({ name }, { fullName: "X", birthDate: "d", phoneNumber: "p" }),
    ).not.toThrow();
    expect(name.textContent).toBe("X");
  });
});

describe("formatValue — the null convention: never a blank cell", () => {
  it.each([null, undefined, ""])("renders an explicit dash for %p, not blank text", (value) => {
    const node = formatValue(value);
    expect(node.textContent).toBe("—");
    expect(node.className).toBe("data-empty");
    expect(node.getAttribute("aria-label")).toBe("sin dato");
  });

  it("renders a real value as plain text, not the empty marker", () => {
    const node = formatValue("9381234567");
    expect(node.textContent).toBe("9381234567");
    expect(node.nodeType).toBe(Node.TEXT_NODE);
  });

  it("stringifies a non-string value rather than rejecting it", () => {
    expect(formatValue(0).textContent).toBe("0");
    expect(formatValue(false).textContent).toBe("false");
  });
});
