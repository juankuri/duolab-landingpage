import { API_BASE, withRef } from "./api.js";

/**
 * PDF upload with real progress.
 *
 * fetch() cannot report upload progress, so the PDF goes over XHR to drive a bar
 * that reflects actual transferred bytes. The bar is never faked: a determinate
 * <progress> that lies is worse than an indeterminate one that does not.
 *
 * `onProgress` receives a whole percentage, or is not called at all when the
 * length is not computable — the caller decides what to show in that case.
 *
 * Resolves to `{ ok, status, payload }` — same shape as api.js's apiJson(),
 * and for the same reason: a 409 folio conflict carries a structured
 * `existingRecord` the caller needs to read, which throwing away into a
 * plain Error message would lose.
 */
function xhrRequest(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {}

      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, payload });
    });

    xhr.addEventListener("error", () =>
      reject(new Error("No se pudo conectar con el servidor.")),
    );

    xhr.send(formData);
  });
}

/**
 * Adds a NEW result to a folio. Never replaces an existing one.
 *
 * Throws on any non-2xx response, unlike createRecord() below — every
 * caller of this one branches on success/failure only, never on the
 * specific status code, so throwing keeps their call sites a plain
 * try/catch instead of an extra `if (!ok)`.
 */
export async function uploadResult(recordId, file, onProgress) {
  const body = new FormData();
  body.append("file", file);

  const { ok, payload } = await xhrRequest(
    `${API_BASE}/records/${recordId}/files`,
    body,
    onProgress,
  );

  if (!ok) throw new Error(withRef(payload, "No se pudo subir el archivo."));
  return payload;
}

/**
 * Creates a patient + folio + first result in one request (atomic create,
 * Flow A/C). `fields` is either `{ fullName, birthDate, phoneNumber, folio }`
 * (Flow A) or `{ patientId, folio }` (Flow C — the patient is already
 * chosen). Returns `{ ok, status, payload }` rather than throwing, because
 * the caller has to distinguish a 409 folio conflict (show the fork dialog)
 * from a 400 field error (show it inline) from success.
 */
export function createRecord(fields, file, onProgress) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) body.append(key, value);
  }
  body.append("file", file);

  return xhrRequest(`${API_BASE}/records`, body, onProgress);
}
