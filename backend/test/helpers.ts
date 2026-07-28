import { env } from "cloudflare:test";

import app from "../src/index";

/** Smallest byte sequence that passes the magic-byte check and is a real PDF. */
export const PDF_BYTES = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

export function pdfFile(name = "resultado.pdf", bytes: Uint8Array = PDF_BYTES) {
  return new File([bytes], name, { type: "application/pdf" });
}

type RequestOptions = {
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  /** Overrides the worker env, e.g. to drop the local Access bypass. */
  envOverrides?: Record<string, unknown>;
};

export function request(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, headers, envOverrides } = options;

  return app.fetch(
    new Request(`http://api.test${path}`, { method, body, headers }),
    { ...env, ...envOverrides },
  );
}

export async function json<T = any>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/**
 * Creates a patient + folio + first result through the API (POST /records
 * is multipart and atomic — a folio cannot exist without a result) and
 * returns its ids. `file` defaults to a real PDF; pass `null` to send the
 * request without one, for tests of the validation path itself.
 */
export async function createRecord(
  overrides: Partial<{
    fullName: string;
    birthDate: string;
    phoneNumber: string;
    folio: string;
    patientId: string;
    file: File | null;
  }> = {},
) {
  const { file, ...fields } = overrides;
  const form = new FormData();

  if (fields.patientId) {
    form.set("patientId", fields.patientId);
  } else {
    form.set("fullName", fields.fullName ?? "Maria Lopez Ruiz");
    form.set("birthDate", fields.birthDate ?? "1990-01-09");
    form.set("phoneNumber", fields.phoneNumber ?? "9381234567");
  }

  form.set("folio", fields.folio ?? `MALO-010919-${Math.floor(Math.random() * 100000)}`);

  if (file !== null) {
    form.set("file", file ?? pdfFile());
  }

  const response = await request("/records", { method: "POST", body: form });

  return { response, body: await json(response) };
}

/**
 * Alias kept for tests that read better naming the file explicitly — every
 * createRecord() call already includes one. `name` renames the PDF that
 * comes back as the folio's first result.
 */
export async function createRecordWithFile(name = "resultado.pdf") {
  const { response, body: record } = await createRecord({ file: pdfFile(name) });

  return {
    record,
    file: { fileId: record.fileId, recordId: record.recordId, status: record.status },
    response,
  };
}

const asManager = { envOverrides: { DEV_ROLE: "manager" } };

/** Creates a record with its first result, then confirms and publishes it. */
export async function publishedRecord(
  overrides: Partial<{
    fullName: string;
    birthDate: string;
    phoneNumber: string;
    folio: string;
  }> = {},
) {
  const { body: record } = await createRecord(overrides);

  await request(`/files/${record.fileId}/confirm`, { method: "POST" });
  await request(`/files/${record.fileId}/publish`, { method: "POST", ...asManager });

  return { record, fileId: record.fileId as string };
}

export function fileRow(fileId: string) {
  return env.DB.prepare("SELECT * FROM files WHERE file_id = ?")
    .bind(fileId)
    .first<Record<string, unknown>>();
}
