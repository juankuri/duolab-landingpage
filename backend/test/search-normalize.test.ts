import { describe, expect, it } from "vitest";

import { normalizeForSearch, normalizePhoneQuery } from "../src/domain/search";

// Same case table as frontend/test/folio.test.js's stripDiacritics() tests —
// the two implementations use the same NFD + \p{M} approach specifically so
// they cannot drift into stripping a different set of marks. Kept in sync by
// hand rather than by a shared file, since one is TS run in workerd and the
// other is plain JS run in jsdom; a mismatch here is the signal to look.
describe("normalizeForSearch", () => {
  it("keeps the base letter and drops the mark, then lowercases", () => {
    expect(normalizeForSearch("Ángel Núñez")).toBe("angel nunez");
    expect(normalizeForSearch("José María Íñiguez")).toBe("jose maria iniguez");
  });

  it("leaves unaccented text alone besides casing", () => {
    expect(normalizeForSearch("Juan Perez")).toBe("juan perez");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeForSearch("  Kuri  ")).toBe("kuri");
  });

  it("matches the same normalized form regardless of the query's own accents", () => {
    expect(normalizeForSearch("nunez")).toBe(normalizeForSearch("Núñez"));
  });
});

describe("normalizePhoneQuery", () => {
  it("keeps only digits", () => {
    expect(normalizePhoneQuery("+52 938 123 4567")).toBe("529381234567");
  });

  it("returns an empty string when there are no digits", () => {
    expect(normalizePhoneQuery("sin numero")).toBe("");
  });
});
