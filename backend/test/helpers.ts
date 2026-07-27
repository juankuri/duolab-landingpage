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

/** Creates a record through the API and returns its ids. */
export async function createRecord(
  overrides: Partial<{
    fullName: string;
    birthDate: string;
    phoneNumber: string;
    folio: string;
  }> = {},
) {
  const response = await request("/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Maria Lopez Ruiz",
      birthDate: "1990-01-09",
      phoneNumber: "9381234567",
      folio: `MALO-010919-${Math.floor(Math.random() * 100000)}`,
      ...overrides,
    }),
  });

  return { response, body: await json(response) };
}

/** Creates a record and attaches a PDF to it. */
export async function createRecordWithFile(name = "resultado.pdf") {
  const { body: record } = await createRecord();

  const form = new FormData();
  form.set("file", pdfFile(name));

  const response = await request(`/records/${record.recordId}/files`, {
    method: "POST",
    body: form,
  });

  return { record, file: await json(response), response };
}

export function fileRow(fileId: string) {
  return env.DB.prepare("SELECT * FROM files WHERE file_id = ?")
    .bind(fileId)
    .first<Record<string, unknown>>();
}
