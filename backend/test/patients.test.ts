import { describe, expect, it } from "vitest";

import { createRecord, json, request } from "./helpers";

describe("GET /patients/:patientId", () => {
  it("returns the patient with every folio and its tally", async () => {
    const { body: first } = await createRecord({
      folio: "PATT-010919-01",
      fullName: "Paciente Detalle",
      birthDate: "1985-05-20",
      phoneNumber: "9381112233",
    });

    const { body: second } = await createRecord({
      folio: "PATT-010919-02",
      patientId: first.patientId,
    });

    const body = await json(await request(`/patients/${first.patientId}`));

    expect(body.patient).toMatchObject({
      patientId: first.patientId,
      fullName: "Paciente Detalle",
      birthDate: "1985-05-20",
      phoneNumber: "9381112233",
    });
    expect(body.patient.folios).toHaveLength(2);

    const folios = body.patient.folios.map((f: { folio: string }) => f.folio).sort();
    expect(folios).toEqual(["PATT-010919-01", "PATT-010919-02"]);

    const opened = body.patient.folios.find(
      (f: { recordId: string }) => f.recordId === second.recordId,
    );
    expect(opened.results).toEqual({ total: 1, byStatus: { UPLOADED: 1 } });
  });

  it("returns 404 for an unknown patient", async () => {
    const response = await request(`/patients/${crypto.randomUUID()}`);

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed patient id", async () => {
    const response = await request("/patients/not-a-uuid");

    expect(response.status).toBe(400);
  });

  it("returns 401 without an authenticated actor", async () => {
    const { body: record } = await createRecord();

    const response = await request(`/patients/${record.patientId}`, {
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(401);
  });
});
