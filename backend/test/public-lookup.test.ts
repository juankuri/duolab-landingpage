import { afterEach, describe, expect, it, vi } from "vitest";

import { createRecord, json, pdfFile, publishedRecord, request } from "./helpers";

const asManager = { envOverrides: { DEV_ROLE: "manager" } };

const FOLIO = "PUB-010190-1";
const PHONE = "9381234567";
const BIRTH_DATE = "1990-01-01";

function lookup(body: unknown, headers: Record<string, string> = {}) {
  return request("/api/public/results/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** A record with a PUBLISHED file, ready to be looked up publicly. */
function publishedResultRecord(overrides: Partial<{
  folio: string;
  phoneNumber: string;
  birthDate: string;
}> = {}) {
  return publishedRecord({
    folio: FOLIO,
    phoneNumber: PHONE,
    birthDate: BIRTH_DATE,
    ...overrides,
  });
}

describe("POST /api/public/results/lookup", () => {
  it("returns a download token for a correct folio, phone and birth date", async () => {
    await publishedResultRecord();

    const response = await lookup({ folio: FOLIO, phone: PHONE, birthDate: BIRTH_DATE });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(typeof body.downloadToken).toBe("string");
    expect(typeof body.expiresAt).toBe("string");
    // The record id stays internal — the token carries it, encrypted.
    expect(body).not.toHaveProperty("recordId");
  });

  it("returns the patient's masked name, never the full legal name, once verified", async () => {
    await publishedResultRecord({ folio: "MASK-010190-1" });
    // publishedRecord (test/helpers.ts) defaults fullName to "Maria Lopez Ruiz".

    const response = await lookup({ folio: "MASK-010190-1", phone: PHONE, birthDate: BIRTH_DATE });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.patientDisplayName).toBe("Maria Lopez R.");
    expect(body.patientDisplayName).not.toContain("Ruiz");
  });

  // A folio is an order and may hold several released studies at once. The
  // patient is entitled to all of them from one verification.
  it("returns every published result on the folio, with a name and a date", async () => {
    const { record } = await publishedResultRecord({ folio: "MULTI-010190-1" });

    // A second study on the same folio, published alongside the first.
    const form = new FormData();
    form.set("file", pdfFile("quimica.pdf"));
    const upload = await request(`/records/${record.recordId}/files`, {
      method: "POST",
      body: form,
    });
    const { fileId } = await json(upload);
    await request(`/files/${fileId}/confirm`, { method: "POST" });
    await request(`/files/${fileId}/publish`, { method: "POST", ...asManager });

    const response = await lookup({
      folio: "MULTI-010190-1",
      phone: PHONE,
      birthDate: BIRTH_DATE,
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(2);
    expect(body.results.map((r: { filename: string }) => r.filename)).toContain(
      "quimica.pdf",
    );

    for (const result of body.results) {
      expect(typeof result.fileId).toBe("string");
      expect(typeof result.filename).toBe("string");
      expect(typeof result.publishedAt).toBe("string");
    }
  });

  // Multi-publish must not become an enumeration channel: the number of
  // published results is only ever revealed to a caller who already matched
  // folio, phone AND birth date.
  it("reveals nothing about how many results exist when verification fails", async () => {
    await publishedResultRecord({ folio: "COUNT-010190-1" });

    const wrongPhone = await lookup({
      folio: "COUNT-010190-1",
      phone: "9389999999",
      birthDate: BIRTH_DATE,
    });
    const noSuchFolio = await lookup({
      folio: "NOPE-010190-9",
      phone: PHONE,
      birthDate: BIRTH_DATE,
    });

    expect(wrongPhone.status).toBe(404);
    expect(noSuchFolio.status).toBe(404);

    // requestId is per-request by design, so it is the one field allowed to
    // differ; everything a caller could read a signal from must match.
    const { requestId: _a, ...wrongPhoneBody } = await json(wrongPhone);
    const { requestId: _b, ...noSuchFolioBody } = await json(noSuchFolio);

    expect(wrongPhoneBody).toEqual(noSuchFolioBody);
    expect(wrongPhoneBody).not.toHaveProperty("results");
  });

  it("sets no-store, no-referrer and nosniff on every response", async () => {
    const response = await lookup({ folio: "NOPE", phone: PHONE, birthDate: BIRTH_DATE });

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  describe("indistinguishable failures", () => {
    async function expectGenericFailure(body: unknown) {
      const response = await lookup(body);
      const parsed = await json(response);

      expect(response.status).toBe(404);
      expect(parsed.code).toBe("LOOKUP_FAILED");
      // The masked-name field (patientDisplayName, added alongside the
      // checkpoint E patient-experience pass) is exactly the kind of field
      // this guardrail exists to catch: it must never appear on a failure
      // response, no matter which of the underlying reasons caused it —
      // its mere presence would tell a caller "a record for this input
      // exists" even without leaking the name itself.
      expect(parsed).not.toHaveProperty("patientDisplayName");
      return parsed;
    }

    it("wrong folio", async () => {
      await publishedResultRecord();
      const a = await expectGenericFailure({
        folio: "WRONG-FOLIO",
        phone: PHONE,
        birthDate: BIRTH_DATE,
      });
      const b = await expectGenericFailure({
        folio: FOLIO,
        phone: "9999999999",
        birthDate: BIRTH_DATE,
      });
      expect(a.error).toBe(b.error);
    });

    it("wrong phone", async () => {
      await publishedResultRecord();
      await expectGenericFailure({ folio: FOLIO, phone: "9999999999", birthDate: BIRTH_DATE });
    });

    it("wrong birth date", async () => {
      await publishedResultRecord();
      await expectGenericFailure({ folio: FOLIO, phone: PHONE, birthDate: "2000-05-05" });
    });

    it("folio exists but nothing was ever published", async () => {
      const { body: record } = await createRecord({
        folio: "UNPUB-010190-1",
        phoneNumber: PHONE,
        birthDate: BIRTH_DATE,
      });
      expect(record.recordId).toBeTruthy();

      await expectGenericFailure({
        folio: "UNPUB-010190-1",
        phone: PHONE,
        birthDate: BIRTH_DATE,
      });
    });

    it("folio exists but the file was revoked", async () => {
      const { fileId } = await publishedResultRecord({ folio: "REV-010190-1" });
      await request(`/files/${fileId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        ...asManager,
      });

      await expectGenericFailure({
        folio: "REV-010190-1",
        phone: PHONE,
        birthDate: BIRTH_DATE,
      });
    });

    it("malformed folio, phone and birth date", async () => {
      await expectGenericFailure({ folio: "!!", phone: "123", birthDate: "not-a-date" });
    });

    it("missing fields", async () => {
      await expectGenericFailure({});
    });

    it("malformed JSON body gets a distinct 400, the one allowed exception", async () => {
      const response = await request("/api/public/results/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 once the folio-scoped budget is exceeded", async () => {
      await publishedResultRecord({ folio: "RATE-010190-1" });

      let last: Response | undefined;
      for (let i = 0; i < 11; i++) {
        last = await lookup({
          folio: "RATE-010190-1",
          phone: "0000000000",
          birthDate: "1999-09-09",
        });
      }

      expect(last!.status).toBe(429);
      expect((await json(last!)).code).toBe("RATE_LIMITED");
    });

    it("still consumes budget for a malformed folio, not just a valid one", async () => {
      let last: Response | undefined;
      for (let i = 0; i < 11; i++) {
        last = await lookup({ folio: "malformed folio!!", phone: "0", birthDate: "x" });
      }

      expect(last!.status).toBe(429);
    });
  });

  describe("logging", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("never writes the phone or birth date to the server log, success or failure", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      await publishedResultRecord({ folio: "LOG-010190-1" });

      await lookup({ folio: "LOG-010190-1", phone: PHONE, birthDate: BIRTH_DATE });
      await lookup({ folio: "LOG-010190-1", phone: "0000000000", birthDate: BIRTH_DATE });

      const logged = spy.mock.calls.flat().map(String).join("\n");
      expect(logged).not.toContain(PHONE);
      expect(logged).not.toContain(BIRTH_DATE);
      expect(logged).not.toContain("0000000000");
    });
  });
});
