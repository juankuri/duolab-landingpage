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

function upload(recordId: string, file: File) {
  const form = new FormData();
  form.set("file", file);

  return request(`/records/${recordId}/files`, { method: "POST", body: form });
}

describe("POST /records/:recordId/files", () => {
  it("stores the pdf in r2 and its metadata in d1", async () => {
    const { body: record } = await createRecord();
    const response = await upload(record.recordId, pdfFile("informe.pdf"));
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      recordId: record.recordId,
      status: "UPLOADED",
    });
    // The internal storage key is not part of the response.
    expect(body).not.toHaveProperty("r2Key");

    const row = await fileRow(body.fileId);
    expect(row).toMatchObject({
      record_id: record.recordId,
      original_filename: "informe.pdf",
      mime_type: "application/pdf",
      status: "UPLOADED",
      uploaded_by: "local-dev@duolab.test",
      size_bytes: PDF_BYTES.byteLength,
    });

    const stored = await env.RESULTS_BUCKET.get(row!.r2_key as string);
    expect(stored).not.toBeNull();
    expect(await stored!.text()).toContain("%PDF-");
  });

  it("derives the storage key from the record and file ids, not the filename", async () => {
    const { body: record } = await createRecord();
    const body = await json(await upload(record.recordId, pdfFile("../../escape.pdf")));
    const row = await fileRow(body.fileId);

    expect(row!.r2_key).toBe(`records/${record.recordId}/${body.fileId}.pdf`);
  });

  it("returns 404 for an unknown record", async () => {
    const response = await upload(crypto.randomUUID(), pdfFile());

    expect(response.status).toBe(404);
  });

  it("returns 400 when no file field is present", async () => {
    const { body: record } = await createRecord();
    const response = await request(`/records/${record.recordId}/files`, {
      method: "POST",
      body: new FormData(),
    });

    expect(response.status).toBe(400);
    expect((await json(response)).code).toBe("INVALID_INPUT");
  });

  it("rejects a file whose bytes are not a pdf", async () => {
    const { body: record } = await createRecord();
    const notPdf = new File([new TextEncoder().encode("<html></html>")], "fake.pdf", {
      type: "application/pdf",
    });

    const response = await upload(record.recordId, notPdf);

    // Declared as PDF, but the bytes disagree: the content is what is
    // unsupported, so 415 rather than 400.
    expect(response.status).toBe(415);
    expect((await json(response)).code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects a real pdf declared as another content type", async () => {
    const { body: record } = await createRecord();
    const mislabelled = new File([PDF_BYTES], "informe.png", {
      type: "image/png",
    });

    expect((await upload(record.recordId, mislabelled)).status).toBe(415);
  });

  it("rejects an empty file", async () => {
    const { body: record } = await createRecord();
    const empty = new File([], "vacio.pdf", { type: "application/pdf" });

    expect((await upload(record.recordId, empty)).status).toBe(415);
  });

  it("rejects an upload over the size cap with 413", async () => {
    const { body: record } = await createRecord();
    const before = await env.RESULTS_BUCKET.list();

    const oversized = new Uint8Array(15 * 1024 * 1024 + 1024);
    oversized.set(PDF_BYTES, 0);

    const response = await upload(
      record.recordId,
      new File([oversized], "grande.pdf", { type: "application/pdf" }),
    );

    expect(response.status).toBe(413);

    // Nothing new reached storage — only the folio's own first result
    // (created atomically alongside it) is there.
    const after = await env.RESULTS_BUCKET.list();
    expect(after.objects).toHaveLength(before.objects.length);
  });

  it("assigns sequence 1 to a folio's first result, from atomic create", async () => {
    const { body: record } = await createRecord();

    const row = await fileRow(record.fileId);
    expect(row!.sequence).toBe(1);
  });

  it("assigns a monotonically increasing sequence per record", async () => {
    const { body: record } = await createRecord();

    const second = await json(await upload(record.recordId, pdfFile("b.pdf")));
    const third = await json(await upload(record.recordId, pdfFile("c.pdf")));

    expect((await fileRow(record.fileId))!.sequence).toBe(1);
    expect((await fileRow(second.fileId))!.sequence).toBe(2);
    expect((await fileRow(third.fileId))!.sequence).toBe(3);
  });

  it("keeps each record's sequence independent of other records", async () => {
    const { body: recordA } = await createRecord({ folio: "SEQA-010919-01" });
    const { body: recordB } = await createRecord({ folio: "SEQB-010919-01" });

    // A second upload on A must not perturb B's own first result.
    await upload(recordA.recordId, pdfFile());

    expect((await fileRow(recordB.fileId))!.sequence).toBe(1);
  });
});

describe("GET /files/:fileId", () => {
  it("streams the pdf back with a safe disposition header", async () => {
    const { file } = await createRecordWithFile("informe.pdf");
    const response = await request(`/files/${file.fileId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toContain('filename="informe.pdf"');
    expect(await response.text()).toContain("%PDF-");
  });

  // A filename carrying CRLF cannot survive multipart encoding, so it is
  // written straight to the row here. That is the case that matters anyway:
  // the header is built from whatever the database holds.
  it("strips control characters and carries the real name in filename*", async () => {
    const { file } = await createRecordWithFile();

    await env.DB.prepare("UPDATE files SET original_filename = ? WHERE file_id = ?")
      .bind("a\r\nx-injected: yes Ángel.pdf", file.fileId)
      .run();

    const disposition = (await request(`/files/${file.fileId}`)).headers.get(
      "content-disposition",
    );

    expect(disposition).toBeTruthy();
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).toContain("filename*=UTF-8''");
    // CR and LF each become an underscore; the accented character is not
    // representable in the quoted form and is replaced there too.
    expect(disposition).toContain('filename="a__x-injected: yes _ngel.pdf"');
  });

  it("returns 404 for an unknown file", async () => {
    expect((await request(`/files/${crypto.randomUUID()}`)).status).toBe(404);
  });

  it("returns 404 when the row exists but the object is gone", async () => {
    const { file } = await createRecordWithFile();
    const row = await fileRow(file.fileId);
    await env.RESULTS_BUCKET.delete(row!.r2_key as string);

    const response = await request(`/files/${file.fileId}`);

    expect(response.status).toBe(404);
    expect((await json(response)).error).toMatch(/stored/i);
  });
});

describe("POST /files/:fileId/confirm", () => {
  it("moves an uploaded file to confirmed and records who did it", async () => {
    const { file } = await createRecordWithFile();
    const response = await request(`/files/${file.fileId}/confirm`, { method: "POST" });

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      fileId: file.fileId,
      status: "CONFIRMED",
      confirmedBy: "local-dev@duolab.test",
    });

    const row = await fileRow(file.fileId);
    expect(row).toMatchObject({
      status: "CONFIRMED",
      confirmed_by: "local-dev@duolab.test",
    });
    expect(row!.confirmed_at).toBeTruthy();
  });

  it("tells a second confirm apart from a file that does not exist", async () => {
    const { file } = await createRecordWithFile();
    await request(`/files/${file.fileId}/confirm`, { method: "POST" });

    const second = await request(`/files/${file.fileId}/confirm`, { method: "POST" });
    const missing = await request(`/files/${crypto.randomUUID()}/confirm`, {
      method: "POST",
    });

    // Confirming twice is a state problem; an unknown id is a missing thing.
    expect(second.status).toBe(409);
    expect(await json(second)).toMatchObject({
      code: "INVALID_TRANSITION",
      currentStatus: "CONFIRMED",
    });

    expect(missing.status).toBe(404);
    expect((await json(missing)).code).toBe("NOT_FOUND");
  });
});

describe("DELETE /records/:recordId/files/:fileId", () => {
  it("removes both the metadata row and the stored object", async () => {
    const { record, file } = await createRecordWithFile();
    const row = await fileRow(file.fileId);

    const response = await request(
      `/records/${record.recordId}/files/${file.fileId}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ deleted: true, fileId: file.fileId });
    expect(await fileRow(file.fileId)).toBeNull();
    expect(await env.RESULTS_BUCKET.get(row!.r2_key as string)).toBeNull();
  });

  it("returns 404 when the file does not belong to the record", async () => {
    const { file } = await createRecordWithFile();
    const { body: other } = await createRecord({ folio: "OTHR-010919-01" });

    const response = await request(
      `/records/${other.recordId}/files/${file.fileId}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(404);
    expect(await fileRow(file.fileId)).not.toBeNull();
  });

  it("refuses to delete a confirmed file, pointing at withdraw", async () => {
    const { record, file } = await createRecordWithFile();
    await request(`/files/${file.fileId}/confirm`, { method: "POST" });

    const response = await request(
      `/records/${record.recordId}/files/${file.fileId}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({
      code: "INVALID_TRANSITION",
      currentStatus: "CONFIRMED",
    });
    // Still there, in both stores.
    expect(await fileRow(file.fileId)).not.toBeNull();
  });

  it("does not renumber later results when an earlier draft is deleted", async () => {
    // record.fileId is #1, from atomic create.
    const { body: record } = await createRecord();

    const second = await json(await upload(record.recordId, pdfFile("b.pdf")));
    const third = await json(await upload(record.recordId, pdfFile("c.pdf")));

    await request(`/records/${record.recordId}/files/${second.fileId}`, {
      method: "DELETE",
    });

    // #1 and #3 keep their original numbers — sequence is assigned once and
    // never recomputed, so "FOLIO · #3" still names the same physical result.
    expect((await fileRow(record.fileId))!.sequence).toBe(1);
    expect((await fileRow(third.fileId))!.sequence).toBe(3);

    const fourth = await json(await upload(record.recordId, pdfFile("d.pdf")));
    expect((await fileRow(fourth.fileId))!.sequence).toBe(4);
  });
});

describe("POST /files/:fileId/withdraw", () => {
  const confirm = (fileId: string) =>
    request(`/files/${fileId}/confirm`, { method: "POST" });
  const withdraw = (fileId: string) =>
    request(`/files/${fileId}/withdraw`, { method: "POST" });

  it("returns a confirmed file to uploaded and clears the confirmation", async () => {
    const { file } = await createRecordWithFile();
    await confirm(file.fileId);

    const response = await withdraw(file.fileId);

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ status: "UPLOADED" });

    const row = await fileRow(file.fileId);
    expect(row).toMatchObject({ status: "UPLOADED" });
    // A file in UPLOADED that still named a confirmer would record something
    // that is no longer true.
    expect(row!.confirmed_by).toBeNull();
    expect(row!.confirmed_at).toBeNull();
  });

  it("refuses to withdraw a file that was never confirmed", async () => {
    const { file } = await createRecordWithFile();

    const response = await withdraw(file.fileId);

    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ currentStatus: "UPLOADED" });
  });

  it("refuses to withdraw a published file", async () => {
    const { file } = await createRecordWithFile();
    await env.DB.prepare("UPDATE files SET status = 'PUBLISHED' WHERE file_id = ?")
      .bind(file.fileId)
      .run();

    // Withdrawal is an employee stepping back from their own confirmation.
    // Undoing publication is a manager revoking, and must not be reachable
    // through this route.
    const response = await withdraw(file.fileId);

    expect(response.status).toBe(409);
    expect((await fileRow(file.fileId))!.status).toBe("PUBLISHED");
  });

  it("returns 404 for a file that does not exist", async () => {
    expect((await withdraw(crypto.randomUUID())).status).toBe(404);
  });

  it("allows delete once the confirmation is withdrawn", async () => {
    const { record, file } = await createRecordWithFile();
    await confirm(file.fileId);
    await withdraw(file.fileId);

    const response = await request(
      `/records/${record.recordId}/files/${file.fileId}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(200);
    expect(await fileRow(file.fileId)).toBeNull();
  });

  // Documents the cost of allowing the cycle: only the last confirmation
  // survives. See the note in domain/file-lifecycle.ts.
  it("keeps only the most recent confirmation after a re-confirm", async () => {
    const { file } = await createRecordWithFile();
    await confirm(file.fileId);
    await withdraw(file.fileId);
    await confirm(file.fileId);

    const row = await fileRow(file.fileId);
    expect(row).toMatchObject({
      status: "CONFIRMED",
      confirmed_by: "local-dev@duolab.test",
    });
  });
});
