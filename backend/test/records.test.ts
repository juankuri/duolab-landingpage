import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { createRecord, createRecordWithFile, json, request } from "./helpers";

// Characterization tests: these describe what the API does today, warts
// included. Assertions that pin down a known defect name it, so that when a
// later iteration fixes it the failing test is self-explaining rather than
// looking like a regression.

describe("POST /records", () => {
  it("creates a patient and a record", async () => {
    const { response, body } = await createRecord({ folio: "MALO-010919-01" });

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ folio: "MALO-010919-01" });
    expect(body.recordId).toBeTruthy();
    expect(body.patientId).toBeTruthy();

    const stored = await env.DB.prepare(
      "SELECT full_name, birth_date, phone_number FROM patients WHERE patient_id = ?",
    )
      .bind(body.patientId)
      .first();

    expect(stored).toMatchObject({
      full_name: "Maria Lopez Ruiz",
      birth_date: "1990-01-09",
      phone_number: "9381234567",
    });
  });

  it("rejects a body missing any required field", async () => {
    const response = await request("/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Solo Nombre" }),
    });

    expect(response.status).toBe(400);
    const body = await json(response);
    expect(body.code).toBe("INVALID_INPUT");
    // Every missing field is reported at once, not one per submission.
    expect(Object.keys(body.fields).sort()).toEqual([
      "birthDate",
      "folio",
      "phoneNumber",
    ]);
  });

  it("rejects fields that are only whitespace", async () => {
    const { response, body } = await createRecord({ fullName: "   " });

    expect(response.status).toBe(400);
    expect(body.fields.fullName).toBeTruthy();
  });

  it("rejects a malformed json body as a validation error, not a crash", async () => {
    const response = await request("/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });

    expect(response.status).toBe(400);
  });

  it("rejects impossible dates and nonsense phone numbers", async () => {
    const { response, body } = await createRecord({
      birthDate: "2026-02-30",
      phoneNumber: "x",
    });

    expect(response.status).toBe(400);
    expect(body.fields.birthDate).toBeTruthy();
    expect(body.fields.phoneNumber).toBeTruthy();
  });

  it("normalizes what it stores", async () => {
    const { body } = await createRecord({
      folio: "malo-010919-77",
      fullName: "  Maria   Lopez  ",
      phoneNumber: "+52 938 123 4567",
    });

    expect(body.folio).toBe("MALO-010919-77");

    const stored = await env.DB.prepare(
      "SELECT full_name, phone_number FROM patients WHERE patient_id = ?",
    )
      .bind(body.patientId)
      .first();

    expect(stored).toMatchObject({
      full_name: "Maria Lopez",
      phone_number: "9381234567",
    });
  });

  it("returns 409 with the existing record when the folio is taken", async () => {
    await createRecord({ folio: "DUPE-010919-01", fullName: "Primera Paciente" });

    const { response, body } = await createRecord({
      folio: "DUPE-010919-01",
      fullName: "Segunda Paciente",
    });

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/folio/i);
    expect(body.existingRecord).toMatchObject({
      folio: "DUPE-010919-01",
      patientName: "Primera Paciente",
    });
    expect(body.existingRecord.recordId).toBeTruthy();
  });

  it("does not leave an orphaned patient behind when the folio collides", async () => {
    await createRecord({ folio: "DUPE-010919-02" });
    await createRecord({ folio: "DUPE-010919-02" });

    const patients = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM patients",
    ).first<{ total: number }>();

    // The two inserts run in one batch, so the failed record insert rolls the
    // patient back with it.
    expect(patients?.total).toBe(1);
  });

  // C7: the same person registered under two folios becomes two patient rows.
  it("C7: creates a second patient row for the same person on a new folio", async () => {
    await createRecord({ folio: "SAME-010919-01", fullName: "Misma Paciente" });
    await createRecord({ folio: "SAME-010919-02", fullName: "Misma Paciente" });

    const patients = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM patients WHERE full_name = ?",
    )
      .bind("Misma Paciente")
      .first<{ total: number }>();

    expect(patients?.total).toBe(2);
  });
});

describe("GET /records", () => {
  it("reports NO_FILE for a record with no upload", async () => {
    await createRecord({ folio: "NONE-010919-01" });

    const body = await json(await request("/records"));

    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({
      folio: "NONE-010919-01",
      status: "NO_FILE",
    });
  });

  it("reports the status of the latest file", async () => {
    await createRecordWithFile();

    const body = await json(await request("/records"));

    expect(body.records[0].status).toBe("UPLOADED");
  });

  it("clamps the limit between 1 and 100", async () => {
    for (let index = 0; index < 3; index += 1) {
      await createRecord({ folio: `LIST-010919-0${index}` });
    }

    expect((await json(await request("/records?limit=2"))).records).toHaveLength(2);
    expect((await json(await request("/records?limit=0"))).records).toHaveLength(1);
    expect((await json(await request("/records?limit=-5"))).records).toHaveLength(1);
  });

  it("falls back to the default limit when the query is not a number", async () => {
    await createRecord({ folio: "LIST-010919-99" });

    const body = await json(await request("/records?limit=abc"));

    expect(body.records).toHaveLength(1);
  });
});

describe("GET /records/:recordId", () => {
  it("returns the record with its patient and files", async () => {
    const { record, file } = await createRecordWithFile("informe.pdf");

    const body = await json(await request(`/records/${record.recordId}`));

    expect(body.record).toMatchObject({
      recordId: record.recordId,
      folio: record.folio,
    });
    expect(body.record.patient).toMatchObject({
      fullName: "Maria Lopez Ruiz",
      birthDate: "1990-01-09",
      phoneNumber: "9381234567",
    });
    expect(body.record.files).toHaveLength(1);
    expect(body.record.files[0]).toMatchObject({
      fileId: file.fileId,
      originalFilename: "informe.pdf",
      status: "UPLOADED",
      previewUrl: `/files/${file.fileId}`,
    });
  });

  it("returns 404 for an unknown record", async () => {
    const response = await request(`/records/${crypto.randomUUID()}`);

    expect(response.status).toBe(404);
  });
});

describe("GET /records/by-folio/:folio", () => {
  it("returns the same shape as the by-id lookup", async () => {
    const { record } = await createRecordWithFile();

    const byId = await json(await request(`/records/${record.recordId}`));
    const byFolio = await json(
      await request(`/records/by-folio/${encodeURIComponent(record.folio)}`),
    );

    expect(byFolio).toEqual(byId);
  });

  it("returns 404 for a folio that does not exist", async () => {
    const response = await request("/records/by-folio/NOPE-010919-01");

    expect(response.status).toBe(404);
  });

  // Folios are read off printed paper, so lookup must not care about case.
  it("matches a folio typed in a different case", async () => {
    await createRecord({ folio: "CASE-010919-01" });

    const response = await request("/records/by-folio/case-010919-01");

    expect(response.status).toBe(200);
  });

  it("rejects a folio containing characters that are not allowed", async () => {
    const response = await request(
      `/records/by-folio/${encodeURIComponent("../secrets")}`,
    );

    expect(response.status).toBe(400);
  });
});
