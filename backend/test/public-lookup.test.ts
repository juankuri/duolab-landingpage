import { describe, expect, it } from "vitest";

import { createRecord, json, publishedRecord, request } from "./helpers";

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
    // Never leaks an internal identifier.
    expect(body).not.toHaveProperty("fileId");
    expect(body).not.toHaveProperty("recordId");
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
});
