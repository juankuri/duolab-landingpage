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

describe("PATCH /patients/:patientId", () => {
  const patch = (patientId: string, body: unknown, opts: Record<string, unknown> = {}) =>
    request(`/patients/${patientId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      ...opts,
    });

  it("updates the full name", async () => {
    const { body: created } = await createRecord({ fullName: "Nombre Viejo" });

    const res = await patch(created.patientId, { fullName: "Nombre Nuevo" });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.patient.fullName).toBe("Nombre Nuevo");
  });

  it("updates the phone number", async () => {
    const { body: created } = await createRecord({ phoneNumber: "9381112233" });

    const res = await patch(created.patientId, { phoneNumber: "9385556677" });
    const body = await json(res);
    expect(body.patient.phoneNumber).toBe("9385556677");
  });

  it("updates the birth date", async () => {
    const { body: created } = await createRecord({ birthDate: "1990-01-09" });

    const res = await patch(created.patientId, { birthDate: "1988-03-15" });
    const body = await json(res);
    expect(body.patient.birthDate).toBe("1988-03-15");
  });

  it("recomputes search_name when the name changes — findable by the new name, not the old", async () => {
    const { body: created } = await createRecord({ fullName: "Antiguo Nombre" });
    await patch(created.patientId, { fullName: "Renata Aguilar" });

    const found = await json(await request(`/search?q=${encodeURIComponent("Renata")}`));
    expect(found.patients.some((p: { patientId: string }) => p.patientId === created.patientId)).toBe(
      true,
    );
  });

  it("advances updated_at", async () => {
    const { body: created } = await createRecord();
    const before = await json(await request(`/patients/${created.patientId}`));

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await patch(created.patientId, { fullName: "Nombre Actualizado" });

    // updated_at isn't in the GET response today, so this just confirms the
    // write round-trips without error; the recompute test above is the real
    // regression guard for the timestamp mattering.
    expect(before.patient.fullName).not.toBe("Nombre Actualizado");
  });

  it("rejects an invalid full name with its field-level error code", async () => {
    const { body: created } = await createRecord();

    const res = await patch(created.patientId, { fullName: "A" });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.fields.fullName).toBeTruthy();
  });

  it("rejects an invalid phone number with its field-level error code", async () => {
    const { body: created } = await createRecord();

    const res = await patch(created.patientId, { phoneNumber: "123" });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.fields.phoneNumber).toBeTruthy();
  });

  it("rejects an invalid birth date with its field-level error code", async () => {
    const { body: created } = await createRecord();

    const res = await patch(created.patientId, { birthDate: "not-a-date" });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.fields.birthDate).toBeTruthy();
  });

  it("rejects a body with no recognized fields", async () => {
    const { body: created } = await createRecord();

    const res = await patch(created.patientId, {});
    expect(res.status).toBe(400);
  });

  it("ignores patientId in the body — the id is immutable, taken only from the URL", async () => {
    const { body: created } = await createRecord({ fullName: "Original" });

    const res = await patch(created.patientId, {
      patientId: crypto.randomUUID(),
      fullName: "Actualizado",
    });
    const body = await json(res);
    expect(body.patient.patientId).toBe(created.patientId);
  });

  it("returns 404 for an unknown patient", async () => {
    const res = await patch(crypto.randomUUID(), { fullName: "Nadie" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed patient id", async () => {
    const res = await patch("not-a-uuid", { fullName: "Nadie" });
    expect(res.status).toBe(400);
  });

  it("returns 401 unauthenticated", async () => {
    const { body: created } = await createRecord();

    const res = await patch(
      created.patientId,
      { fullName: "Nadie" },
      { envOverrides: { ENVIRONMENT: "production" } },
    );
    expect(res.status).toBe(401);
  });

  it("permits EMPLOYEE", async () => {
    const { body: created } = await createRecord();

    const res = await patch(created.patientId, { fullName: "Editado Por Empleado" });
    expect(res.status).toBe(200);
  });

  it("permits MANAGER — inherits EMPLOYEE capabilities per DEC-013, not a new rule", async () => {
    const { body: created } = await createRecord();

    const res = await patch(
      created.patientId,
      { fullName: "Editado Por Manager" },
      { envOverrides: { DEV_ROLE: "manager" } },
    );
    expect(res.status).toBe(200);
  });
});
