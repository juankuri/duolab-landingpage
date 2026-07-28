import { describe, expect, it } from "vitest";

import {
  validateBirthDate,
  validateCreation,
  validateFolio,
  validatePdf,
  validatePhoneNumber,
} from "../src/scripts/admin/validation.js";

/*
 * These cases mirror backend/test/validation.test.ts. The point is not to test
 * the same rules twice — the server is the authority and enforces all of them
 * again — but to catch the client drifting away from it, which shows up as an
 * employee being told a value is fine and then rejected on submit.
 */

describe("validateFolio", () => {
  it("uppercases, so a folio read off paper in lower case still matches", () => {
    expect(validateFolio("a-1024").value).toBe("A-1024");
  });

  it("accepts letters, digits and hyphens", () => {
    expect(validateFolio("JPKR-260726-01").ok).toBe(true);
  });

  it("rejects anything outside that charset", () => {
    // The folio travels in a URL path.
    expect(validateFolio("A/1024").ok).toBe(false);
    expect(validateFolio("A 1024").ok).toBe(false);
  });

  it("bounds the length at 3 and 32", () => {
    expect(validateFolio("AB").ok).toBe(false);
    expect(validateFolio("A".repeat(32)).ok).toBe(true);
    expect(validateFolio("A".repeat(33)).ok).toBe(false);
  });
});

describe("validatePhoneNumber", () => {
  it("accepts ten national digits", () => {
    expect(validatePhoneNumber("9381234567").value).toBe("9381234567");
  });

  it("ignores punctuation", () => {
    expect(validatePhoneNumber("938 123 4567").value).toBe("9381234567");
  });

  it("drops a leading 52 so the same phone typed either way is one phone", () => {
    expect(validatePhoneNumber("529381234567").value).toBe("9381234567");
  });

  it("rejects a wrong-length number", () => {
    expect(validatePhoneNumber("93812345").ok).toBe(false);
    expect(validatePhoneNumber("12345678901").ok).toBe(false);
  });
});

describe("validateBirthDate", () => {
  const today = new Date("2026-07-28T00:00:00Z");

  it("accepts a real date", () => {
    expect(validateBirthDate("1990-07-26", today).ok).toBe(true);
  });

  it("rejects a day that does not exist in that month", () => {
    // The reason it round-trips through Date instead of trusting the pattern.
    expect(validateBirthDate("2026-02-30", today).ok).toBe(false);
  });

  it("rejects the future", () => {
    expect(validateBirthDate("2027-01-01", today).ok).toBe(false);
  });

  it("rejects a date before 1900", () => {
    expect(validateBirthDate("1899-12-31", today).ok).toBe(false);
  });

  it("requires AAAA-MM-DD", () => {
    expect(validateBirthDate("26/07/1990", today).ok).toBe(false);
  });
});

describe("validatePdf", () => {
  const file = (type, size) => ({ type, size });

  it("accepts a PDF within the cap", () => {
    expect(validatePdf(file("application/pdf", 1024)).ok).toBe(true);
  });

  it("rejects another type", () => {
    expect(validatePdf(file("image/png", 1024)).ok).toBe(false);
  });

  it("rejects an empty file and one over 15 MB", () => {
    expect(validatePdf(file("application/pdf", 0)).ok).toBe(false);
    expect(validatePdf(file("application/pdf", 16 * 1024 * 1024)).ok).toBe(false);
  });

  it("rejects no file at all", () => {
    expect(validatePdf(undefined).ok).toBe(false);
  });
});

describe("validateCreation", () => {
  const valid = {
    fullName: "Ana Sofía Ruiz Méndez",
    birthDate: "1988-03-14",
    phoneNumber: "9381234567",
    folio: "asrm-140326-01",
    pdf: { type: "application/pdf", size: 900_000 },
  };

  it("returns the normalized values when everything passes", () => {
    const { ok, values } = validateCreation(valid);

    expect(ok).toBe(true);
    expect(values.folio).toBe("ASRM-140326-01");
    expect(values.phoneNumber).toBe("9381234567");
  });

  it("names every problem at once, like the server does", () => {
    // routes/records.ts validates all four fields before reporting any, so the
    // employee does not submit repeatedly to discover the next mistake.
    const { ok, errors } = validateCreation({
      ...valid,
      phoneNumber: "938",
      folio: "A/1",
      birthDate: "nope",
    });

    expect(ok).toBe(false);
    expect(Object.keys(errors).sort()).toEqual(["birthDate", "folio", "phoneNumber"]);
  });

  it("checks only the fields asked for, so Flow C can skip the patient", () => {
    const { ok } = validateCreation({ folio: "A-1024", pdf: valid.pdf }, ["folio", "pdf"]);
    expect(ok).toBe(true);
  });
});
