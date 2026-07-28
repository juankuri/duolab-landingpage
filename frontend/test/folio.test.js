import { describe, expect, it } from "vitest";

import {
  initialsFromName,
  stripDiacritics,
  suggestFolio,
  todayDDMMYY,
} from "../src/scripts/admin/folio.js";

describe("stripDiacritics", () => {
  it("keeps the base letter and drops the mark", () => {
    expect(stripDiacritics("Ángel Núñez")).toBe("Angel Nunez");
    expect(stripDiacritics("José María Íñiguez")).toBe("Jose Maria Iniguez");
  });

  it("leaves unaccented text alone", () => {
    expect(stripDiacritics("Juan Perez")).toBe("Juan Perez");
  });
});

describe("initialsFromName", () => {
  it("takes two letters from each of two words", () => {
    expect(initialsFromName("Maria Lopez")).toBe("MALO");
  });

  it("takes two, one and one from three words", () => {
    expect(initialsFromName("Mario Jimenez Perez")).toBe("MAJP");
  });

  it("pads a single word to four letters", () => {
    expect(initialsFromName("Alejandro")).toBe("ALEJ");
    expect(initialsFromName("Ana")).toBe("ANAX");
  });

  it("takes one letter each from four or more words", () => {
    expect(initialsFromName("Juan Pablo Kuri Ricardez")).toBe("JPKR");
    expect(initialsFromName("Ana Sofia Ruiz Mendez Lopez")).toBe("ASRM");
  });

  it("ignores Spanish particles", () => {
    // "de", "del", "la", "las", "los", "y" are not part of anyone's initials.
    expect(initialsFromName("Maria de la Luz Soto")).toBe("MALS");
  });

  it("strips accents, because the server's folio charset is A-Z0-9-", () => {
    // The folio travels in a URL path and validateFolio rejects anything else,
    // so a suggestion of ÁNNÚ would be rejected the moment it was submitted.
    expect(initialsFromName("Ángel Núñez")).toBe("ANNU");
    expect(initialsFromName("Ángel Núñez")).toMatch(/^[A-Z0-9]*$/);
  });

  it("returns nothing for an empty name", () => {
    expect(initialsFromName("")).toBe("");
    expect(initialsFromName("   ")).toBe("");
  });

  it("collapses runs of whitespace", () => {
    expect(initialsFromName("Maria    Lopez")).toBe("MALO");
  });
});

describe("todayDDMMYY", () => {
  it("pads every component to two digits", () => {
    expect(todayDDMMYY(new Date(2026, 6, 5))).toBe("050726");
  });

  it("uses the last two digits of the year", () => {
    expect(todayDDMMYY(new Date(2026, 11, 31))).toBe("311226");
  });
});

describe("suggestFolio", () => {
  it("leaves the sequence open for the employee to type", () => {
    expect(suggestFolio("Juan Pablo Kuri Ricardez", new Date(2026, 6, 26))).toBe(
      "JPKR-260726-",
    );
  });

  it("suggests nothing until there is a name", () => {
    // An empty field beats a stub with no initials in it.
    expect(suggestFolio("", new Date())).toBe("");
    expect(suggestFolio("  ", new Date())).toBe("");
  });

  it("only ever suggests folios the server would accept", () => {
    const folio = suggestFolio("Ángel de la Cruz Núñez", new Date(2026, 6, 26));
    expect(folio).toMatch(/^[A-Z0-9-]+$/);
    expect(folio.length).toBeLessThanOrEqual(32);
  });
});
