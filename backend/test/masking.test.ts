import { describe, expect, it } from "vitest";

import { maskPatientName } from "../src/domain/masking";

describe("maskPatientName", () => {
  it("masks the second half of a 4-word name as surnames", () => {
    expect(maskPatientName("Juan Pablo Kuri Ricardez")).toBe("Juan Pablo K. R.");
  });

  it("masks only the last word of a 3-word name — floor(3/2) = 1 surname", () => {
    expect(maskPatientName("Maria Lopez Ruiz")).toBe("Maria Lopez R.");
  });

  it("returns a single-word name unchanged — nothing to mask", () => {
    expect(maskPatientName("Madonna")).toBe("Madonna");
  });

  it("masks the surname of a 2-word name", () => {
    expect(maskPatientName("Juan Perez")).toBe("Juan P.");
  });

  it("collapses extra whitespace the same way validateFullName does", () => {
    expect(maskPatientName("  Juan   Pablo  Kuri  Ricardez  ")).toBe("Juan Pablo K. R.");
  });

  it("the full legal name never appears verbatim in the output for a multi-word name", () => {
    const full = "Rosa Elena Chan Pech";
    const masked = maskPatientName(full);
    expect(masked).not.toBe(full);
    expect(masked).not.toContain("Chan");
    expect(masked).not.toContain("Pech");
  });

  it("preserves accented given names untouched, masks only the last (3-word) surname", () => {
    expect(maskPatientName("Ángel Núñez Beltrán")).toBe("Ángel Núñez B.");
  });
});
