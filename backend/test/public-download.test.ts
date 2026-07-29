import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { encryptToken } from "../src/domain/download-token";
import { json, publishedRecord, request } from "./helpers";

const asManager = { envOverrides: { DEV_ROLE: "manager" } };

const FOLIO = "DL-010190-1";
const PHONE = "9381234567";
const BIRTH_DATE = "1990-01-01";

async function getToken(overrides: Partial<{ folio: string }> = {}) {
  const { record, fileId } = await publishedRecord({
    folio: overrides.folio ?? FOLIO,
    phoneNumber: PHONE,
    birthDate: BIRTH_DATE,
  });

  const lookupResponse = await request("/api/public/results/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folio: overrides.folio ?? FOLIO,
      phone: PHONE,
      birthDate: BIRTH_DATE,
    }),
  });
  const { downloadToken, results } = await json(lookupResponse);

  return {
    record,
    fileId,
    downloadToken: downloadToken as string,
    results: results as { fileId: string; filename: string; publishedAt: string }[],
  };
}

function download(token: string, fileId: string) {
  return request(
    `/api/public/results/${encodeURIComponent(token)}/download/${encodeURIComponent(fileId)}`,
  );
}

describe("GET /api/public/results/:downloadToken/download/:fileId", () => {
  it("streams the PDF for a valid token against a published file", async () => {
    const { downloadToken, fileId } = await getToken();

    const response = await download(downloadToken, fileId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(await response.text()).toContain("%PDF-");
  });

  it("sets no-store, no-referrer and nosniff", async () => {
    const { downloadToken, fileId } = await getToken();

    const response = await download(downloadToken, fileId);

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("stops working the instant the file is revoked, even with a still-valid token", async () => {
    const { fileId, downloadToken } = await getToken({ folio: "DL-REV-1" });

    await request(`/files/${fileId}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      ...asManager,
    });

    const response = await download(downloadToken, fileId);

    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("LOOKUP_FAILED");
  });

  // The guard the record-scoped token (DEC-023) makes necessary. A token is
  // now a key to a folio, so nothing but this check stops it from serving
  // another patient's file to whoever holds it.
  it("refuses a file that belongs to a different record than the token", async () => {
    const mine = await getToken({ folio: "DL-SCOPE-A" });
    const theirs = await getToken({ folio: "DL-SCOPE-B" });

    const response = await download(mine.downloadToken, theirs.fileId);

    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("LOOKUP_FAILED");
  });

  it("rejects an expired token", async () => {
    const { fileId, record } = await getToken({ folio: "DL-EXP-1" });

    const expiredToken = await encryptToken(env.DOWNLOAD_TOKEN_SECRET, {
      recordId: record.recordId,
      exp: Date.now() - 1,
    });

    const response = await download(expiredToken, fileId);

    expect(response.status).toBe(404);
  });

  it("rejects a tampered token", async () => {
    const { downloadToken, fileId } = await getToken({ folio: "DL-TAMPER-1" });
    const [iv, ciphertext] = downloadToken.split(".");
    // Flips a character in the middle, not the last one: the trailing
    // base64url character can carry padding bits outside the actual byte
    // count, so mutating it doesn't reliably change the decoded bytes.
    const middle = Math.floor(ciphertext.length / 2);
    const flipped = ciphertext[middle] === "A" ? "B" : "A";
    const tampered = `${iv}.${ciphertext.slice(0, middle)}${flipped}${ciphertext.slice(middle + 1)}`;

    const response = await download(tampered, fileId);

    expect(response.status).toBe(404);
  });

  it("rejects a malformed token string", async () => {
    const { fileId } = await getToken({ folio: "DL-BADTOK-1" });

    for (const bad of ["not-a-token", "a.b.c", "a."]) {
      const response = await download(bad, fileId);
      expect(response.status).toBe(404);
    }
  });

  it("rejects a malformed file id exactly like a wrong one — no 400", async () => {
    const { downloadToken } = await getToken({ folio: "DL-BADFILE-1" });

    const malformed = await download(downloadToken, "not-a-uuid");
    const wellFormedButWrong = await download(downloadToken, crypto.randomUUID());

    expect(malformed.status).toBe(404);
    expect(wellFormedButWrong.status).toBe(404);
    expect((await json(malformed)).code).toBe("LOOKUP_FAILED");
    expect((await json(wellFormedButWrong)).code).toBe("LOOKUP_FAILED");
  });

  it("rejects a token for a record that has nothing published", async () => {
    const token = await encryptToken(env.DOWNLOAD_TOKEN_SECRET, {
      recordId: crypto.randomUUID(),
      exp: Date.now() + 60_000,
    });

    const response = await download(token, crypto.randomUUID());

    expect(response.status).toBe(404);
  });
});
