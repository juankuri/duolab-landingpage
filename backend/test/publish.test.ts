import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import {
  FILE_STATUSES,
  type FileStatus,
  canTransition,
} from "../src/domain/file-lifecycle";
import {
  createRecord,
  createRecordWithFile,
  fileRow,
  json,
  pdfFile,
  request,
} from "./helpers";

const asManager = { envOverrides: { DEV_ROLE: "manager" } };
const asEmployee = { envOverrides: { DEV_ROLE: "employee" } };

const publish = (fileId: string, query = "", options = asManager) =>
  request(`/files/${fileId}/publish${query}`, { method: "POST", ...options });

const revoke = (fileId: string, body?: unknown, options = asManager) =>
  request(`/files/${fileId}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    ...options,
  });

/** Uploads and confirms a file on the given record. */
async function confirmedFile(recordId: string, name = "resultado.pdf") {
  const form = new FormData();
  form.set("file", pdfFile(name));

  const uploaded = await json(
    await request(`/records/${recordId}/files`, { method: "POST", body: form }),
  );

  await request(`/files/${uploaded.fileId}/confirm`, { method: "POST" });

  return uploaded.fileId as string;
}

/** Puts a file directly into a status, for testing moves out of it. */
async function forceStatus(fileId: string, status: FileStatus) {
  await env.DB.prepare("UPDATE files SET status = ? WHERE file_id = ?")
    .bind(status, fileId)
    .run();
}

describe("authorization", () => {
  it("refuses publish to an employee", async () => {
    const { record, file } = await createRecordWithFile();
    await request(`/files/${file.fileId}/confirm`, { method: "POST" });

    const published = await publish(file.fileId, "", asEmployee);
    expect(published.status).toBe(403);
    expect((await json(published)).code).toBe("FORBIDDEN");

    // Nothing changed as a side effect of being refused.
    expect((await fileRow(file.fileId))!.status).toBe("CONFIRMED");
    expect(record.recordId).toBeTruthy();
  });

  // Widened from manager-only (DEC-013): an employee spotting a mistake in a
  // published result should not need a manager to pull it. Publish stays
  // the gated action — making something visible is the asymmetric risk.
  it("permits revoke to an employee, unlike publish", async () => {
    const { file } = await createRecordWithFile();
    await request(`/files/${file.fileId}/confirm`, { method: "POST" });
    await forceStatus(file.fileId, "PUBLISHED");

    const revoked = await revoke(file.fileId, {}, asEmployee);
    expect(revoked.status).toBe(200);
    expect((await fileRow(file.fileId))!.status).toBe("REVOKED");
  });

  it("refuses publish without any identity", async () => {
    const { file } = await createRecordWithFile();

    const response = await request(`/files/${file.fileId}/publish`, {
      method: "POST",
      envOverrides: { ENVIRONMENT: "production" },
    });

    expect(response.status).toBe(401);
  });
});

describe("publish", () => {
  it("releases a confirmed file and records who did it", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);

    const response = await publish(fileId);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      status: "PUBLISHED",
      publishedBy: "local-dev@duolab.test",
      supersededFileId: null,
    });

    const row = await fileRow(fileId);
    expect(row).toMatchObject({
      status: "PUBLISHED",
      published_by: "local-dev@duolab.test",
    });
    expect(row!.published_at).toBeTruthy();
  });

  it("refuses to publish a file that was never confirmed", async () => {
    const { file } = await createRecordWithFile();

    const response = await publish(file.fileId);

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ currentStatus: "UPLOADED" });
  });

  it("refuses a second publish on the same file", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);
    await publish(fileId);

    expect((await publish(fileId)).status).toBe(409);
  });

  it("returns 404 for a file that does not exist", async () => {
    expect((await publish(crypto.randomUUID())).status).toBe(404);
  });
});

describe("one published file per record", () => {
  it("refuses to publish while another file is published, and names it", async () => {
    const { body: record } = await createRecord();
    const first = await confirmedFile(record.recordId, "primero.pdf");
    await publish(first);

    const second = await confirmedFile(record.recordId, "segundo.pdf");
    const response = await publish(second);

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      code: "ALREADY_PUBLISHED",
      currentFileId: first,
      currentFilename: "primero.pdf",
    });

    // The published one is untouched.
    expect((await fileRow(first))!.status).toBe("PUBLISHED");
    expect((await fileRow(second))!.status).toBe("CONFIRMED");
  });

  // The application could be wrong; the index cannot be bypassed.
  it("is enforced by the database, not only by the service", async () => {
    const { body: record } = await createRecord();
    const first = await confirmedFile(record.recordId, "primero.pdf");
    const second = await confirmedFile(record.recordId, "segundo.pdf");
    await publish(first);

    await expect(forceStatus(second, "PUBLISHED")).rejects.toThrow();
  });
});

describe("supersede", () => {
  it("revokes the current file and publishes the replacement atomically", async () => {
    const { body: record } = await createRecord();
    const first = await confirmedFile(record.recordId, "primero.pdf");
    await publish(first);
    const second = await confirmedFile(record.recordId, "corregido.pdf");

    const response = await publish(second, `?supersedes=${first}`);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ supersededFileId: first });

    expect((await fileRow(first))!.status).toBe("REVOKED");
    expect((await fileRow(second))!.status).toBe("PUBLISHED");

    // Exactly one published row, at every point a reader could look.
    const published = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM files WHERE record_id = ? AND status = 'PUBLISHED'",
    )
      .bind(record.recordId)
      .first<{ total: number }>();
    expect(published?.total).toBe(1);
  });

  it("records who revoked the superseded file and why", async () => {
    const { body: record } = await createRecord();
    const first = await confirmedFile(record.recordId, "primero.pdf");
    await publish(first);
    const second = await confirmedFile(record.recordId, "corregido.pdf");

    await request(`/files/${second}/publish?supersedes=${first}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Valores corregidos" }),
      ...asManager,
    });

    expect(await fileRow(first)).toMatchObject({
      status: "REVOKED",
      revoked_by: "local-dev@duolab.test",
      revoked_reason: "Valores corregidos",
    });
  });

  it("refuses to supersede a file on a different record", async () => {
    const { body: recordA } = await createRecord({ folio: "AAAA-010919-01" });
    const { body: recordB } = await createRecord({ folio: "BBBB-010919-01" });

    const onA = await confirmedFile(recordA.recordId);
    await publish(onA);
    const onB = await confirmedFile(recordB.recordId);

    // B has nothing published, so naming A's file is not a valid supersede.
    const response = await publish(onB, `?supersedes=${onA}`);

    expect(response.status).toBe(409);
    expect((await fileRow(onA))!.status).toBe("PUBLISHED");
  });

  it("rejects a malformed supersedes identifier", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);

    expect((await publish(fileId, "?supersedes=not-a-uuid")).status).toBe(400);
  });
});

describe("revoke", () => {
  it("withdraws a published file and records the reason", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);
    await publish(fileId);

    const response = await revoke(fileId, { reason: "Paciente equivocado" });

    expect(response.status).toBe(200);
    expect(await fileRow(fileId)).toMatchObject({
      status: "REVOKED",
      revoked_by: "local-dev@duolab.test",
      revoked_reason: "Paciente equivocado",
    });
  });

  it("accepts a revocation with no reason given", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);
    await publish(fileId);

    expect((await revoke(fileId)).status).toBe(200);
    expect((await fileRow(fileId))!.revoked_reason).toBeNull();
  });

  it("rejects a reason beyond the length cap", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);
    await publish(fileId);

    expect((await revoke(fileId, { reason: "x".repeat(501) })).status).toBe(400);
  });

  it("refuses to revoke a file that is not published", async () => {
    const { file } = await createRecordWithFile();

    const response = await revoke(file.fileId);

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ currentStatus: "UPLOADED" });
  });

  it("treats REVOKED as terminal", async () => {
    const { body: record } = await createRecord();
    const fileId = await confirmedFile(record.recordId);
    await publish(fileId);
    await revoke(fileId);

    // No way back: correcting a revoked result means a new upload.
    expect((await publish(fileId)).status).toBe(409);
    expect((await revoke(fileId)).status).toBe(409);
    expect(
      (await request(`/files/${fileId}/withdraw`, { method: "POST" })).status,
    ).toBe(409);
  });

  it("frees the record to publish a replacement", async () => {
    const { body: record } = await createRecord();
    const first = await confirmedFile(record.recordId, "primero.pdf");
    await publish(first);
    await revoke(first);

    const second = await confirmedFile(record.recordId, "nuevo.pdf");

    expect((await publish(second)).status).toBe(200);
  });
});

describe("the lifecycle as a whole", () => {
  // Exhaustive rather than sampled: every ordered pair of statuses is driven
  // through the real endpoints and must succeed exactly when the state
  // machine says it may.
  it("permits a transition through the API iff the domain allows it", async () => {
    for (const from of FILE_STATUSES) {
      for (const to of FILE_STATUSES) {
        const { body: record } = await createRecord({
          folio: `MTRX-${from.slice(0, 2)}${to.slice(0, 2)}-01`,
        });

        const form = new FormData();
        form.set("file", pdfFile());
        const uploaded = await json(
          await request(`/records/${record.recordId}/files`, {
            method: "POST",
            body: form,
          }),
        );
        await forceStatus(uploaded.fileId, from);

        const route =
          to === "CONFIRMED"
            ? "confirm"
            : to === "UPLOADED"
              ? "withdraw"
              : to === "PUBLISHED"
                ? "publish"
                : "revoke";

        const response = await request(`/files/${uploaded.fileId}/${route}`, {
          method: "POST",
          ...asManager,
        });

        const allowed = canTransition(from, to);

        expect(
          response.status === 200,
          `${from} -> ${to} answered ${response.status}, expected ${
            allowed ? "success" : "refusal"
          }`,
        ).toBe(allowed);
      }
    }
  });
});
