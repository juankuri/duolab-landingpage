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
    const oversized = new Uint8Array(15 * 1024 * 1024 + 1024);
    oversized.set(PDF_BYTES, 0);

    const response = await upload(
      record.recordId,
      new File([oversized], "grande.pdf", { type: "application/pdf" }),
    );

    expect(response.status).toBe(413);

    // Nothing reached storage.
    const stored = await env.RESULTS_BUCKET.list();
    expect(stored.objects).toHaveLength(0);
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

  // C3: there is no status guard, so a confirmed file can be hard deleted.
  // Iteration 6 restricts deletion to UPLOADED and adds a withdraw transition.
  it("C3: deletes a confirmed file with no guard", async () => {
    const { record, file } = await createRecordWithFile();
    await request(`/files/${file.fileId}/confirm`, { method: "POST" });

    const response = await request(
      `/records/${record.recordId}/files/${file.fileId}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(200);
    expect(await fileRow(file.fileId)).toBeNull();
  });
});
