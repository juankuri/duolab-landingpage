import { describe, expect, it } from "vitest";

import { createRecord, json, request } from "./helpers";

describe("GET /search", () => {
  it("returns both groups empty for an empty query", async () => {
    const body = await json(await request("/search?q="));

    expect(body).toEqual({ folios: [], patients: [] });
  });

  it("returns both groups empty for a whitespace-only query", async () => {
    const body = await json(await request(`/search?q=${encodeURIComponent("   ")}`));

    expect(body).toEqual({ folios: [], patients: [] });
  });

  it("finds a folio by an exact match", async () => {
    await createRecord({ folio: "SRCH-010919-01" });

    const body = await json(await request("/search?q=SRCH-010919-01"));

    expect(body.folios).toHaveLength(1);
    expect(body.folios[0]).toMatchObject({
      folio: "SRCH-010919-01",
      results: { total: 1, byStatus: { UPLOADED: 1 } },
    });
  });

  it("ranks an exact folio match before a folio prefix match", async () => {
    await createRecord({ folio: "SRCH-010919-01" });
    await createRecord({ folio: "SRCH-010919-01-B", fullName: "Otra Paciente" });

    const body = await json(await request("/search?q=SRCH-010919-01"));

    expect(body.folios.map((f: { folio: string }) => f.folio)).toEqual([
      "SRCH-010919-01",
      "SRCH-010919-01-B",
    ]);
  });

  it("finds a folio by a partial prefix", async () => {
    await createRecord({ folio: "PART-010919-01" });

    const body = await json(await request("/search?q=PART-0109"));

    expect(body.folios).toHaveLength(1);
  });

  it("matches a patient name without the query's accents", async () => {
    await createRecord({ folio: "ACNT-010919-01", fullName: "María Núñez" });

    const body = await json(await request(`/search?q=${encodeURIComponent("nunez")}`));

    expect(body.folios).toHaveLength(1);
    expect(body.folios[0].patientName).toBe("María Núñez");
    expect(body.patients).toHaveLength(1);
  });

  it("matches a patient name with the query's accents", async () => {
    await createRecord({ folio: "ACNT-010919-02", fullName: "María Núñez" });

    const body = await json(await request(`/search?q=${encodeURIComponent("Núñez")}`));

    expect(body.folios).toHaveLength(1);
  });

  it("matches a patient by a phone prefix", async () => {
    await createRecord({ folio: "PHON-010919-01", phoneNumber: "9381234567" });

    const body = await json(await request("/search?q=938123"));

    expect(body.folios).toHaveLength(1);
    expect(body.patients).toHaveLength(1);
    expect(body.patients[0].phoneNumber).toBe("9381234567");
  });

  it("returns both groups empty when nothing matches", async () => {
    await createRecord({ folio: "NOPE-010919-01" });

    const body = await json(await request("/search?q=zzzznotfound"));

    expect(body.folios).toHaveLength(0);
    expect(body.patients).toHaveLength(0);
  });

  it("returns every matching folio, one per record, even when patients share a name", async () => {
    // Each createRecord() call makes its own patient row today (see C7 in
    // records.test.ts) — a query matching the name has to surface both
    // folios, not collapse them because the names read the same.
    await createRecord({ folio: "DUPL-010919-01", fullName: "Paciente Repetida" });
    await createRecord({
      folio: "DUPL-010919-02",
      fullName: "Paciente Repetida",
      phoneNumber: "9381112222",
    });

    const body = await json(
      await request(`/search?q=${encodeURIComponent("Repetida")}`),
    );

    expect(body.folios).toHaveLength(2);
    expect(body.folios.map((f: { folio: string }) => f.folio).sort()).toEqual([
      "DUPL-010919-01",
      "DUPL-010919-02",
    ]);
  });

  it("returns 401 without an authenticated actor", async () => {
    const response = await request("/search?q=anything", {
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(401);
  });
});
