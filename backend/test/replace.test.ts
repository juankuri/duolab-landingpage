import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import * as filesRepo from "../src/data/files.repo";
import * as storage from "../src/data/storage";
import {
  createRecord,
  createRecordWithFile,
  fileRow,
  json,
  pdfFile,
  publishedRecord,
  request,
} from "./helpers";

const asManager = { envOverrides: { DEV_ROLE: "manager" } };
const asEmployee = { envOverrides: { DEV_ROLE: "employee" } };

function replace(recordId: string, fileId: string, file: File, options = {}) {
  const form = new FormData();
  form.set("file", file);

  return request(`/records/${recordId}/files/${fileId}/replace`, {
    method: "POST",
    body: form,
    ...options,
  });
}

describe("POST /records/:recordId/files/:fileId/replace", () => {
  it("replaces an UPLOADED file's PDF, staying UPLOADED", async () => {
    const { record, file } = await createRecordWithFile("original.pdf");

    const response = await replace(record.recordId, file.fileId, pdfFile("corregido.pdf"));

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ fileId: file.fileId, status: "UPLOADED" });

    const row = await fileRow(file.fileId);
    expect(row).toMatchObject({ status: "UPLOADED", original_filename: "corregido.pdf" });
  });

  it("replaces a CONFIRMED file, sending it back to UPLOADED and clearing confirmed_by/at", async () => {
    const { record, file } = await createRecordWithFile();
    await request(`/files/${file.fileId}/confirm`, { method: "POST" });

    await replace(record.recordId, file.fileId, pdfFile("corregido.pdf"));

    const row = await fileRow(file.fileId);
    expect(row).toMatchObject({
      status: "UPLOADED",
      confirmed_by: null,
      confirmed_at: null,
    });
  });

  it("replaces a PUBLISHED file, clearing both confirmed_by/at and published_by/at", async () => {
    const { record, fileId } = await publishedRecord({ folio: "REPL-010919-01" });

    const response = await replace(record.recordId, fileId, pdfFile("corregido.pdf"));

    expect(response.status).toBe(200);

    const row = await fileRow(fileId);
    expect(row).toMatchObject({
      status: "UPLOADED",
      confirmed_by: null,
      confirmed_at: null,
      published_by: null,
      published_at: null,
    });
  });

  it("refuses to replace a REVOKED file", async () => {
    const { record, fileId } = await publishedRecord({ folio: "REPL-010919-02" });
    await request(`/files/${fileId}/revoke`, { method: "POST", ...asManager });

    const response = await replace(record.recordId, fileId, pdfFile());

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ currentStatus: "REVOKED" });

    // Still revoked, not silently moved.
    expect((await fileRow(fileId))!.status).toBe("REVOKED");
  });

  it("is available to an employee, not just a manager", async () => {
    const { record, file } = await createRecordWithFile();

    const response = await replace(
      record.recordId,
      file.fileId,
      pdfFile("corregido.pdf"),
      asEmployee,
    );

    expect(response.status).toBe(200);
  });

  it("rejects a non-PDF replacement", async () => {
    const { record, file } = await createRecordWithFile();
    const notPdf = new File([new TextEncoder().encode("<html></html>")], "fake.pdf", {
      type: "application/pdf",
    });

    const response = await replace(record.recordId, file.fileId, notPdf);

    expect(response.status).toBe(415);
    expect((await fileRow(file.fileId))!.original_filename).not.toBe("fake.pdf");
  });

  it("overwrites the object at the same R2 key rather than creating a new one", async () => {
    const { record, file } = await createRecordWithFile();
    const before = await fileRow(file.fileId);

    await replace(record.recordId, file.fileId, pdfFile("corregido.pdf"));

    const after = await fileRow(file.fileId);
    expect(after!.r2_key).toBe(before!.r2_key);

    const stored = await env.RESULTS_BUCKET.get(after!.r2_key as string);
    expect(stored).not.toBeNull();
  });

  it("stops working the instant a live download token's file is replaced", async () => {
    const { record, fileId } = await publishedRecord({
      folio: "REPL-010919-03",
      phoneNumber: "9381234567",
      birthDate: "1990-01-01",
    });

    const lookupResponse = await request("/api/public/results/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folio: "REPL-010919-03",
        phone: "9381234567",
        birthDate: "1990-01-01",
      }),
    });
    const { downloadToken } = await json(lookupResponse);

    await replace(record.recordId, fileId, pdfFile("corregido.pdf"));

    const download = await request(
      `/api/public/results/${encodeURIComponent(downloadToken)}/download`,
    );

    expect(download.status).toBe(404);
    expect((await json(download)).code).toBe("LOOKUP_FAILED");
  });

  it("updates the D1 row before writing the new object to R2 (DEC-014 ordering)", async () => {
    const { record, file } = await createRecordWithFile();

    const calls: string[] = [];
    const realReplace = filesRepo.replace.bind(filesRepo);

    const replaceSpy = vi
      .spyOn(filesRepo, "replace")
      .mockImplementation(async (...args) => {
        calls.push("d1");
        return realReplace(...args);
      });
    const putSpy = vi.spyOn(storage, "putResult").mockImplementation(async () => {
      calls.push("r2");
      return {} as never;
    });

    await replace(record.recordId, file.fileId, pdfFile("corregido.pdf"));

    expect(calls).toEqual(["d1", "r2"]);

    replaceSpy.mockRestore();
    putSpy.mockRestore();
  });
});
