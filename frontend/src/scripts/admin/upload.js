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
 */
function xhrUpload(url, formData, onProgress, failureMessage) {
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

      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else reject(new Error(withRef(payload, failureMessage)));
    });

    xhr.addEventListener("error", () =>
      reject(new Error("No se pudo conectar con el servidor.")),
    );

    xhr.send(formData);
  });
}

/** Adds a NEW result to a folio. Never replaces an existing one. */
export function uploadResult(recordId, file, onProgress) {
  const body = new FormData();
  body.append("file", file);

  return xhrUpload(
    `${API_BASE}/records/${recordId}/files`,
    body,
    onProgress,
    "No se pudo subir el archivo.",
  );
}
