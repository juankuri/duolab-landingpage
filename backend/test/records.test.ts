import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  PDF_BYTES,
  createRecord,
  createRecordWithFile,
  fileRow,
  json,
  pdfFile,
  request,
} from "./helpers";

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

  it("rejects a form missing any required field", async () => {
    const form = new FormData();
    form.set("fullName", "Solo Nombre");

    const response = await request("/records", { method: "POST", body: form });

    expect(response.status).toBe(400);
    const body = await json(response);
    expect(body.code).toBe("INVALID_INPUT");
    // Every missing field is reported at once, not one per submission.
    expect(Object.keys(body.fields).sort()).toEqual([
      "birthDate",
      "file",
      "folio",
      "phoneNumber",
    ]);
  });

  it("rejects a malformed body that is not multipart at all", async () => {
    const response = await request("/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not multipart",
    });

    expect(response.status).toBe(400);
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

  it("does not leave an orphaned R2 object behind when the folio collides", async () => {
    await createRecord({ folio: "DUPE-010919-03" });
    const before = await env.RESULTS_BUCKET.list();

    // The second attempt's PDF is written before the D1 batch is even
    // attempted (object-first ordering, see record-service.ts), so the
    // folio conflict has to compensate with an R2 delete just like a D1
    // failure would.
    await createRecord({ folio: "DUPE-010919-03" });

    const after = await env.RESULTS_BUCKET.list();
    expect(after.objects).toHaveLength(before.objects.length);
  });

  it("Flow A: creates the patient, the folio and the first result together", async () => {
    const { response, body } = await createRecord({ folio: "FLOA-010919-01" });

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ folio: "FLOA-010919-01", status: "UPLOADED" });
    expect(body.recordId).toBeTruthy();
    expect(body.patientId).toBeTruthy();
    expect(body.fileId).toBeTruthy();

    const row = await fileRow(body.fileId);
    expect(row).toMatchObject({ record_id: body.recordId, status: "UPLOADED" });
  });

  it("Flow A: reports every invalid field at once, including a missing file", async () => {
    const form = new FormData();
    form.set("fullName", "  ");
    form.set("birthDate", "not-a-date");
    form.set("phoneNumber", "x");
    form.set("folio", "@@");

    const response = await request("/records", { method: "POST", body: form });

    expect(response.status).toBe(400);
    const body = await json(response);
    expect(Object.keys(body.fields).sort()).toEqual([
      "birthDate",
      "file",
      "folio",
      "fullName",
      "phoneNumber",
    ]);
  });

  it("Flow C: reuses an existing patient instead of creating a new row", async () => {
    const { body: first } = await createRecord({
      folio: "FLOC-010919-01",
      fullName: "Paciente Existente",
    });

    const { response, body: second } = await createRecord({
      folio: "FLOC-010919-02",
      patientId: first.patientId,
    });

    expect(response.status).toBe(201);
    expect(second.patientId).toBe(first.patientId);

    const patients = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM patients WHERE full_name = ?",
    )
      .bind("Paciente Existente")
      .first<{ total: number }>();
    expect(patients?.total).toBe(1);
  });

  it("Flow C: 404s on an unknown patientId, without creating anything", async () => {
    const form = new FormData();
    form.set("patientId", crypto.randomUUID());
    form.set("folio", "FLOC-010919-99");
    form.set("file", pdfFile());

    const response = await request("/records", { method: "POST", body: form });

    expect(response.status).toBe(404);

    const record = await env.DB.prepare("SELECT record_id FROM records WHERE folio = ?")
      .bind("FLOC-010919-99")
      .first();
    expect(record).toBeNull();
  });

  it("does not leave an orphaned R2 object when the D1 batch fails for a reason other than a folio conflict", async () => {
    const before = await env.RESULTS_BUCKET.list();

    const form = new FormData();
    form.set("patientId", crypto.randomUUID()); // valid-shaped, but unknown
    form.set("folio", "ORPH-010919-01");
    form.set("file", pdfFile());

    const response = await request("/records", { method: "POST", body: form });
    expect(response.status).toBe(404);

    // The service checks the patient exists before ever touching R2, so
    // nothing should have been written in the first place.
    const after = await env.RESULTS_BUCKET.list();
    expect(after.objects).toHaveLength(before.objects.length);
  });
});

describe("GET /records", () => {
  it("reports an empty tally for a record with no upload", async () => {
    // A folio can no longer be created without a first result, so the only
    // way to get one down to zero files is deleting it afterward — this
    // exercises the tally's empty case, not the (now impossible) creation
    // path directly.
    const { body: record } = await createRecord({ folio: "NONE-010919-01" });
    await request(`/records/${record.recordId}/files/${record.fileId}`, {
      method: "DELETE",
    });

    const body = await json(await request("/records"));

    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({
      folio: "NONE-010919-01",
      results: { total: 0, byStatus: {} },
    });
  });

  it("tallies a record's results by status", async () => {
    await createRecordWithFile();

    const body = await json(await request("/records"));

    expect(body.records[0].results).toEqual({
      total: 1,
      byStatus: { UPLOADED: 1 },
    });
  });

  it("includes a folio in the ?status= filter when ANY of its results is in that state, not only the latest", async () => {
    // This is the regression the tally rewrite fixes: a folio whose latest
    // result is a fresh draft used to disappear from the manager queue even
    // though it still had an older CONFIRMED result waiting on it. The
    // folio's first result (from atomic create) plays that older, confirmed
    // one; a second upload on top of it plays the newer draft.
    const { body: record } = await createRecord({ folio: "MIXD-010919-01" });
    await request(`/files/${record.fileId}/confirm`, { method: "POST" });

    const form2 = new FormData();
    form2.set("file", new File([PDF_BYTES], "b.pdf", { type: "application/pdf" }));
    await request(`/records/${record.recordId}/files`, {
      method: "POST",
      body: form2,
    });

    const body = await json(await request("/records?status=CONFIRMED"));

    const found = body.records.find((r: { folio: string }) => r.folio === "MIXD-010919-01");
    expect(found).toBeTruthy();
    expect(found.results).toEqual({
      total: 2,
      byStatus: { UPLOADED: 1, CONFIRMED: 1 },
    });
  });

  it("excludes a folio from the ?status= filter when none of its results match", async () => {
    await createRecordWithFile();

    const body = await json(await request("/records?status=PUBLISHED"));

    expect(body.records).toHaveLength(0);
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

  it("rejects an unknown ?include= value", async () => {
    const response = await request("/records?include=bogus");

    expect(response.status).toBe(400);
    expect((await json(response)).code).toBe("INVALID_INPUT");
  });

  it("omits the files key entirely without ?include=files", async () => {
    // Backward-compat guard: this is what keeps the employee home's two
    // /records calls (no ?include=) working untouched.
    await createRecordWithFile();

    const body = await json(await request("/records"));

    expect(body.records[0].files).toBeUndefined();
  });

  it("attaches each record's files with ?include=files", async () => {
    const { record, file } = await createRecordWithFile("informe.pdf");

    const body = await json(await request("/records?include=files"));

    const found = body.records.find((r: { recordId: string }) => r.recordId === record.recordId);
    expect(found.files).toEqual([
      {
        fileId: file.fileId,
        originalFilename: "informe.pdf",
        status: "UPLOADED",
        sequence: 1,
        uploadedAt: expect.any(String),
        previewUrl: `/files/${file.fileId}`,
      },
    ]);
  });

  it("filters the attached files to the requested status, not just the record", async () => {
    // Same fixture as the "any of its results" test above: a folio whose
    // first result is CONFIRMED and a second, freshly uploaded draft on top.
    const { body: record } = await createRecord({ folio: "MIXF-010919-01" });
    await request(`/files/${record.fileId}/confirm`, { method: "POST" });

    const form2 = new FormData();
    form2.set("file", new File([PDF_BYTES], "b.pdf", { type: "application/pdf" }));
    await request(`/records/${record.recordId}/files`, { method: "POST", body: form2 });

    const body = await json(await request("/records?status=CONFIRMED&include=files"));

    const found = body.records.find((r: { folio: string }) => r.folio === "MIXF-010919-01");
    expect(found.files).toHaveLength(1);
    expect(found.files[0]).toMatchObject({ fileId: record.fileId, status: "CONFIRMED" });
  });

  it("returns an empty files array for a record with none", async () => {
    const { body: record } = await createRecord({ folio: "ZERO-010919-01" });
    await request(`/records/${record.recordId}/files/${record.fileId}`, { method: "DELETE" });

    const body = await json(await request("/records?include=files"));

    const found = body.records.find((r: { recordId: string }) => r.recordId === record.recordId);
    expect(found.files).toEqual([]);
  });

  it("attaches files for more than one chunk of records (D1's 100-binding ceiling)", async () => {
    for (let index = 0; index < 60; index += 1) {
      await createRecord({ folio: `CHNK-0109${String(index).padStart(2, "0")}-01` });
    }

    const body = await json(await request("/records?limit=100&include=files"));

    const chunked = body.records.filter((r: { folio: string }) => r.folio.startsWith("CHNK-"));
    expect(chunked).toHaveLength(60);
    for (const record of chunked) {
      expect(record.files).toHaveLength(1);
    }
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
      sequence: 1,
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
