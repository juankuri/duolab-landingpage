import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import * as filesRepo from "../src/data/files.repo";
import * as storage from "../src/data/storage";
import * as recordService from "../src/services/record-service";
import { createRecord, createRecordWithFile, json, pdfFile, request } from "./helpers";

// These describe what happens when one of the two stores fails. The point is
// not that failure is impossible, it is that each failure leaves a state
// somebody can recover from.

describe("upload consistency", () => {
  it("deletes the stored object when the metadata insert fails", async () => {
    const { body: record } = await createRecord();

    const insert = vi
      .spyOn(filesRepo, "insert")
      .mockRejectedValueOnce(new Error("d1 unavailable"));

    await expect(
      recordService.uploadResult(env, {
        recordId: record.recordId,
        file: pdfFile(),
        uploadedBy: "employee@duolab.test",
        requestId: "test",
      }),
    ).rejects.toThrow("d1 unavailable");

    insert.mockRestore();

    // Neither store kept anything.
    const stored = await env.RESULTS_BUCKET.list();
    expect(stored.objects).toHaveLength(0);

    const rows = await env.DB.prepare("SELECT COUNT(*) AS total FROM files").first<{
      total: number;
    }>();
    expect(rows?.total).toBe(0);
  });

  it("logs an orphan when the compensating delete also fails", async () => {
    const { body: record } = await createRecord();

    const insert = vi
      .spyOn(filesRepo, "insert")
      .mockRejectedValueOnce(new Error("d1 unavailable"));
    const remove = vi
      .spyOn(storage, "deleteResult")
      .mockRejectedValueOnce(new Error("r2 unavailable"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordService.uploadResult(env, {
        recordId: record.recordId,
        file: pdfFile(),
        uploadedBy: "employee@duolab.test",
        requestId: "abc123",
      }),
    ).rejects.toThrow("d1 unavailable");

    const lines = logged.mock.calls.map((call) => String(call[0]));
    const orphan = lines.find((line) => line.includes("ORPHAN_R2_OBJECT"));

    expect(orphan, "an unrecoverable orphan must be logged").toBeTruthy();

    const entry = JSON.parse(orphan!);
    expect(entry).toMatchObject({
      event: "ORPHAN_R2_OBJECT",
      recordId: record.recordId,
      requestId: "abc123",
    });
    // The key is deterministic, so the log line is enough to delete it.
    expect(entry.r2Key).toBe(`records/${record.recordId}/${entry.fileId}.pdf`);

    insert.mockRestore();
    remove.mockRestore();
    logged.mockRestore();
  });

  it("reports an upload failure as a server fault, not the caller's mistake", async () => {
    const { body: record } = await createRecord();
    const insert = vi
      .spyOn(filesRepo, "insert")
      .mockRejectedValueOnce(new Error("d1 unavailable"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const form = new FormData();
    form.set("file", pdfFile());
    const response = await request(`/records/${record.recordId}/files`, {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(500);
    const body = await json(response);
    expect(body.code).toBe("INTERNAL");
    expect(body.requestId).toBeTruthy();
    // No internal detail reaches the client.
    expect(JSON.stringify(body)).not.toContain("d1 unavailable");

    insert.mockRestore();
    logged.mockRestore();
  });
});

describe("delete consistency", () => {
  it("removes the row even when the object delete fails, and logs the orphan", async () => {
    const { record, file } = await createRecordWithFile();
    const remove = vi
      .spyOn(storage, "deleteResult")
      .mockRejectedValueOnce(new Error("r2 unavailable"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await request(
      `/records/${record.recordId}/files/${file.fileId}`,
      { method: "DELETE" },
    );

    // The caller's intent was satisfied: the file is gone as far as the
    // product is concerned.
    expect(response.status).toBe(200);

    const row = await env.DB.prepare("SELECT * FROM files WHERE file_id = ?")
      .bind(file.fileId)
      .first();
    expect(row).toBeNull();

    const orphan = logged.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes("ORPHAN_R2_OBJECT"));
    expect(orphan).toBeTruthy();

    remove.mockRestore();
    logged.mockRestore();
  });

  it("never leaves a visible row whose object is missing", async () => {
    const { record, file } = await createRecordWithFile();

    await request(`/records/${record.recordId}/files/${file.fileId}`, {
      method: "DELETE",
    });

    const detail = await json(await request(`/records/${record.recordId}`));
    expect(detail.record.files).toHaveLength(0);
  });
});

describe("recent list", () => {
  it("returns one row per record when two files share an upload second", async () => {
    const { record, file } = await createRecordWithFile("primero.pdf");

    // Second file on the same record, forced to the same timestamp. This is
    // what used to duplicate the record in the list.
    const second = await json(
      await (async () => {
        const form = new FormData();
        form.set("file", pdfFile("segundo.pdf"));
        return request(`/records/${record.recordId}/files`, {
          method: "POST",
          body: form,
        });
      })(),
    );

    await env.DB.prepare(
      "UPDATE files SET uploaded_at = '2026-07-27 10:00:00' WHERE file_id IN (?, ?)",
    )
      .bind(file.fileId, second.fileId)
      .run();

    const body = await json(await request("/records"));
    const forRecord = body.records.filter(
      (row: { recordId: string }) => row.recordId === record.recordId,
    );

    expect(forRecord).toHaveLength(1);
  });
});
