import { describe, expect, it } from "vitest";

import {
  AUTH_FACTOR_FIELDS,
  diffPatientChanges,
  needsConsequenceConfirmation,
} from "../src/scripts/admin/patient-edit.js";

const patient = { fullName: "Maria Lopez", phoneNumber: "9381234567", birthDate: "1990-01-09" };

describe("diffPatientChanges", () => {
  it("returns nothing when every field matches the current patient", () => {
    expect(diffPatientChanges(patient, { ...patient })).toEqual({});
  });

  it("includes only the fields that actually changed", () => {
    expect(diffPatientChanges(patient, { ...patient, fullName: "Maria Lopez Ruiz" })).toEqual({
      fullName: "Maria Lopez Ruiz",
    });
  });

  it("can report multiple changed fields at once", () => {
    expect(
      diffPatientChanges(patient, {
        ...patient,
        phoneNumber: "9385556677",
        birthDate: "1988-03-15",
      }),
    ).toEqual({ phoneNumber: "9385556677", birthDate: "1988-03-15" });
  });

  it("ignores a field that isn't part of the input at all", () => {
    expect(diffPatientChanges(patient, { fullName: patient.fullName })).toEqual({});
  });
});

describe("needsConsequenceConfirmation — public-lookup auth factors only", () => {
  it("is false for a name-only change", () => {
    expect(needsConsequenceConfirmation({ fullName: "Nuevo Nombre" })).toBe(false);
  });

  it("is true when the phone number changes", () => {
    expect(needsConsequenceConfirmation({ phoneNumber: "9385556677" })).toBe(true);
  });

  it("is true when the birth date changes", () => {
    expect(needsConsequenceConfirmation({ birthDate: "1988-03-15" })).toBe(true);
  });

  it("is true when an auth factor changes alongside the name", () => {
    expect(needsConsequenceConfirmation({ fullName: "Nuevo Nombre", phoneNumber: "9385556677" })).toBe(
      true,
    );
  });

  it("is false for no changes at all", () => {
    expect(needsConsequenceConfirmation({})).toBe(false);
  });

  it("AUTH_FACTOR_FIELDS is exactly phone and birth date, not name", () => {
    expect(AUTH_FACTOR_FIELDS.sort()).toEqual(["birthDate", "phoneNumber"]);
  });
});
