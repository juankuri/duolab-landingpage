import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  downloadUrl,
  filesPublishedLabel,
  firstEmptyField,
  formatMsLeft,
  formatPublishedAt,
  lookupErrorMessage,
  resultsHeading,
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
    expect(lookupErrorMessage(404)).toContain(
      "No fue posible mostrar tus resultados con la información proporcionada",
    );
  });

  it("the generic message tells the patient what to do next, without naming which check failed", () => {
    const message = lookupErrorMessage(404);
    expect(message).toContain("Verifica tus datos");
    expect(message).toContain("comunícate con el laboratorio");
    // Never reveal which factor was wrong.
    expect(message.toLowerCase()).not.toContain("folio");
    expect(message.toLowerCase()).not.toContain("teléfono");
    expect(message.toLowerCase()).not.toContain("nacimiento");
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

describe("downloadUrl", () => {
  it("puts the token and the file id in the path, both encoded", () => {
    expect(downloadUrl("", "tok+en", "file/1")).toBe(
      "/api/public/results/tok%2Ben/download/file%2F1",
    );
  });

  it("prefixes the API base when there is one (split dev)", () => {
    expect(downloadUrl("http://localhost:8787", "t", "f")).toBe(
      "http://localhost:8787/api/public/results/t/download/f",
    );
  });
});

describe("formatPublishedAt", () => {
  it("reads the server's zoneless timestamp as UTC, not local", () => {
    // Parsed as local time this would land on 25 jul for anyone west of
    // UTC — the same trap render.js's formatMoment documents.
    expect(formatPublishedAt("2026-07-26 02:30:00")).toContain("26");
    expect(formatPublishedAt("2026-07-26 02:30:00")).toContain("2026");
  });

  it("returns an empty string for missing or unparseable input", () => {
    expect(formatPublishedAt(null)).toBe("");
    expect(formatPublishedAt(undefined)).toBe("");
    expect(formatPublishedAt("")).toBe("");
    expect(formatPublishedAt("not-a-date")).toBe("");
  });
});

describe("resultsHeading", () => {
  it("singularizes exactly one result", () => {
    expect(resultsHeading(1)).toBe("Encontramos 1 resultado");
  });

  it("pluralizes anything else", () => {
    expect(resultsHeading(2)).toBe("Encontramos 2 resultados");
    expect(resultsHeading(5)).toBe("Encontramos 5 resultados");
  });
});

describe("filesPublishedLabel", () => {
  it("singularizes exactly one file", () => {
    expect(filesPublishedLabel(1)).toBe("1 archivo publicado");
  });

  it("pluralizes anything else, including zero", () => {
    expect(filesPublishedLabel(0)).toBe("0 archivos publicados");
    expect(filesPublishedLabel(2)).toBe("2 archivos publicados");
    expect(filesPublishedLabel(5)).toBe("5 archivos publicados");
  });
});
