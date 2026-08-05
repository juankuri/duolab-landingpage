import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { labDayUtcBounds } from "../src/domain/folio";
import { createRecord, json, request } from "./helpers";

const suggest = (query: string) => request(`/records/folio-suggestion?${query}`);

/** Places an existing record's created_at outside "today" (the lab-local
 * day the suggestion endpoint will actually compute against right now), so
 * a test can assert it does NOT contribute to today's sequence. */
async function backdateToYesterday(recordId: string) {
  const bounds = labDayUtcBounds(new Date());
  const todayStartInstant = new Date(bounds.startUtc.replace(" ", "T") + "Z");
  const yesterday = new Date(todayStartInstant.getTime() - 60_000);
  const stamp = yesterday.toISOString().slice(0, 19).replace("T", " ");

  await env.DB.prepare("UPDATE records SET created_at = ? WHERE record_id = ?")
    .bind(stamp, recordId)
    .run();
}

describe("GET /records/folio-suggestion", () => {
  it("suggests sequence 1 for the first folio of an (empty) day", async () => {
    const res = await suggest("name=" + encodeURIComponent("Juan Perez"));
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.initials).toBe("JUPE");
    expect(body.sequence).toBe(1);
    expect(body.folio).toBe(`JUPE-${body.day}-0131`);
  });

  it("the sequence is global across DIFFERENT patients created the same day, not per patient", async () => {
    // The regression this checkpoint exists to fix: the sequence must not
    // reset or collide per initials/date base.
    const first = await json(await suggest("name=Ana"));
    await createRecord({ fullName: "Ana Torres", folio: first.folio });

    const second = await json(await suggest("name=" + encodeURIComponent("Beto Ruiz")));
    expect(second.sequence).toBe(first.sequence + 1);
    expect(second.initials).toBe("BERU");

    await createRecord({ fullName: "Beto Ruiz", folio: second.folio });

    const third = await json(await suggest("name=Carla"));
    expect(third.sequence).toBe(first.sequence + 2);
  });

  it("skips a folio outside today's lab-local day rather than counting it", async () => {
    const created = await createRecord({ fullName: "Vieja Fecha", folio: "VIFE-010101-01319" });
    await backdateToYesterday(created.body.recordId);

    const suggestion = await json(await suggest("name=Nueva"));
    // Nothing else was created "today" in this isolated test DB, so the
    // sequence must still be 1 — the backdated -01319 folio must not count.
    expect(suggestion.sequence).toBe(1);
  });

  it("skips a folio that doesn't follow the {PREFIX}{n} convention (a paper folio)", async () => {
    await createRecord({ fullName: "Sin Convencion", folio: "PAPER-OLD-001" });
    await createRecord({ fullName: "Con Convencion", folio: `ANY-000000-0131` });

    const suggestion = await json(await suggest("name=Siguiente"));
    expect(suggestion.sequence).toBe(2);
  });

  it("does not zero-pad — the tenth folio of the day is -01310, not -013010", async () => {
    for (let n = 1; n <= 9; n++) {
      await createRecord({ fullName: `Persona ${n}`, folio: `AAAA-000000-013${n}` });
    }

    const suggestion = await json(await suggest("name=Decima"));
    expect(suggestion.sequence).toBe(10);
    expect(suggestion.folio.endsWith("-01310")).toBe(true);
  });

  it("Flow C: derives initials from the existing patient via ?patientId=", async () => {
    const created = await createRecord({ fullName: "Rosa Elena Chan Pech" });

    const res = await suggest(`patientId=${created.body.patientId}`);
    expect(res.status).toBe(200);

    const body = await json(res);
    // 4 words: first letter of each of the first four (initialsFromName's rule).
    expect(body.initials).toBe("RECP");
  });

  it("400 for an unknown/malformed patientId, distinct from a bare missing param", async () => {
    const malformed = await suggest("patientId=not-a-uuid");
    expect(malformed.status).toBe(400);

    const missing = await suggest("");
    expect(missing.status).toBe(400);
  });

  it("404 for a well-formed but nonexistent patientId", async () => {
    const res = await suggest(`patientId=${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });

  it("400 for an empty ?name=", async () => {
    expect((await suggest("name=" + encodeURIComponent("   "))).status).toBe(400);
  });

  it("401 unauthenticated", async () => {
    const res = await request("/records/folio-suggestion?name=Ana", {
      envOverrides: { ENVIRONMENT: "production" },
    });
    expect(res.status).toBe(401);
  });

  it("is advisory only — a genuine race still surfaces as 409 FOLIO_CONFLICT from POST /records, not from here", async () => {
    const suggestion = await json(await suggest("name=Carrera"));

    // Two employees who both saw the same suggestion and both submit it —
    // the UNIQUE index on records.folio is the actual guard, not this
    // endpoint, which does no reservation or locking of its own.
    const [a, b] = await Promise.all([
      createRecord({ fullName: "Primero", folio: suggestion.folio }),
      createRecord({ fullName: "Segundo", folio: suggestion.folio }),
    ]);

    const statuses = [a.response.status, b.response.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflicted = a.response.status === 409 ? a.body : b.body;
    expect(conflicted.code).toBe("FOLIO_CONFLICT");
  });
});
