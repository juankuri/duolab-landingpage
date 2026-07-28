import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  firstEmptyField,
  formatMsLeft,
  lookupErrorMessage,
  tokenExpiry,
} from "../src/scripts/public/lookup.js";

describe("firstEmptyField", () => {
  it("returns null when all three are filled", () => {
    expect(
      firstEmptyField({ folio: "A-1024", phone: "9381234567", birthDate: "1990-01-01" }),
    ).toBeNull();
  });

  it("names folio first when everything is empty", () => {
    expect(firstEmptyField({ folio: "", phone: "", birthDate: "" })).toBe("folio");
  });

  it("names the next empty field once earlier ones are filled", () => {
    expect(firstEmptyField({ folio: "A-1024", phone: "", birthDate: "" })).toBe("phone");
    expect(firstEmptyField({ folio: "A-1024", phone: "9381234567", birthDate: "" })).toBe(
      "birthDate",
    );
  });

  it("treats whitespace-only input as empty", () => {
    expect(firstEmptyField({ folio: "   ", phone: "9381234567", birthDate: "1990-01-01" })).toBe(
      "folio",
    );
  });

  it("treats a missing key the same as empty", () => {
    expect(firstEmptyField({ phone: "9381234567", birthDate: "1990-01-01" })).toBe("folio");
  });
});

describe("digitsOnly", () => {
  it("strips everything but digits", () => {
    expect(digitsOnly("938 123 4567")).toBe("9381234567");
    expect(digitsOnly("(938) 123-4567")).toBe("9381234567");
  });

  it("returns an empty string for no digits at all", () => {
    expect(digitsOnly("abc")).toBe("");
    expect(digitsOnly("")).toBe("");
  });

  it("handles null/undefined without throwing", () => {
    expect(digitsOnly(null)).toBe("");
    expect(digitsOnly(undefined)).toBe("");
  });
});

describe("lookupErrorMessage", () => {
  it("gives rate limiting its own message, distinct from the generic one", () => {
    const message = lookupErrorMessage(429);
    expect(message).toContain("Demasiados intentos");
  });

  it("gives a 5xx a server-failure message", () => {
    expect(lookupErrorMessage(500)).toBe("Ocurrió un error. Intenta de nuevo más tarde.");
    expect(lookupErrorMessage(503)).toBe("Ocurrió un error. Intenta de nuevo más tarde.");
  });

  it("collapses every other failure to the same non-enumerating message", () => {
    // 400 (malformed body) and 404 (no match / not published / revoked) must
    // read identically — this is the regression DEC-015 exists to prevent.
    expect(lookupErrorMessage(400)).toBe(lookupErrorMessage(404));
    expect(lookupErrorMessage(404)).toContain("No encontramos un resultado");
  });
});

describe("tokenExpiry", () => {
  const NOW = Date.parse("2026-07-28T12:00:00Z");

  it("reports time left for a token still inside its window", () => {
    const expiresAt = new Date(NOW + 4 * 60_000).toISOString();
    const result = tokenExpiry(expiresAt, NOW);

    expect(result.expired).toBe(false);
    expect(result.msLeft).toBe(4 * 60_000);
  });

  it("reports expired the instant msLeft hits zero", () => {
    expect(tokenExpiry(new Date(NOW).toISOString(), NOW)).toEqual({ expired: true, msLeft: 0 });
  });

  it("reports expired for a timestamp already in the past", () => {
    const result = tokenExpiry(new Date(NOW - 1000).toISOString(), NOW);
    expect(result.expired).toBe(true);
    expect(result.msLeft).toBe(0);
  });

  it("fails toward expired for a missing or malformed expiresAt", () => {
    expect(tokenExpiry(undefined, NOW)).toEqual({ expired: true, msLeft: 0 });
    expect(tokenExpiry("not-a-date", NOW)).toEqual({ expired: true, msLeft: 0 });
  });
});

describe("formatMsLeft", () => {
  it("rounds down to whole minutes", () => {
    expect(formatMsLeft(4 * 60_000 + 30_000)).toBe("4 minutos");
  });

  it("singularizes exactly one minute", () => {
    expect(formatMsLeft(60_000)).toBe("1 minuto");
  });

  it("has a distinct phrase for under a minute rather than '0 minutos'", () => {
    expect(formatMsLeft(30_000)).toBe("menos de un minuto");
    expect(formatMsLeft(0)).toBe("menos de un minuto");
  });
});
