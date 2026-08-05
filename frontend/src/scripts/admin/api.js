/**
 * The one place the admin surfaces learn where the API lives.
 *
 * Previously this constant was copy-pasted into admin.astro and resultados.astro,
 * which meant the deployment story had to be remembered in two files. It now comes
 * from PUBLIC_API_BASE, which Astro inlines at build time — note this only works in
 * a bundled <script>, never in <script is:inline>, where import.meta.env is left
 * untouched and would reach the browser as literal source.
 *
 * An EMPTY value is meaningful and must survive: in production the Worker serves
 * both the built frontend and the API, so every path is same-origin and the
 * correct base is "" (relative URLs). `??` rather than `||` for exactly that —
 * `||` treats "" as unset and would fall back to localhost, producing a
 * production bundle that calls http://localhost:8787 and fails everywhere. Only
 * a genuinely undefined value falls back, which is the two-server dev setup
 * (Astro on :4321, wrangler on :8787) running without an .env file.
 */
export const API_BASE =
  import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8787";

// A lazy require-shaped import, not a static one: session.js imports
// `apiJson` from this module, so a top-level `import { clearCachedActor }
// from "./session.js"` here would be circular. Both sides only ever touch
// the other's export from inside a function body (never at module-eval
// time), which is safe for a circular ES import — but the dynamic import
// keeps the dependency direction honest in the source rather than relying
// on that being remembered.
let clearCachedActorPromise = null;
function clearCachedActor() {
  clearCachedActorPromise ??= import("./session.js");
  clearCachedActorPromise.then((mod) => mod.clearCachedActor()).catch(() => {});
}

/**
 * Failures carry the request id that the server logged. Showing it means a report
 * of "it did not save" comes with the exact line to look up.
 */
export function withRef(payload, fallback) {
  const message = payload?.error || fallback;
  return payload?.requestId ? `${message} (Ref: ${payload.requestId})` : message;
}

/**
 * A JSON call that always resolves to { ok, status, payload }.
 *
 * Deliberately does not throw on a non-2xx: every caller in this module branches
 * on the status code (409 folio conflict, 400 field errors, 404 not found) and a
 * thrown error would force each of them to unwrap it again. A network failure is
 * still a rejection, because that is the one case with no payload to inspect.
 */
export async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const payload = await res.json().catch(() => ({}));

  // Any 401/403 from anywhere clears the cached actor role in one place —
  // a session that ended mid-visit (expired Access, revoked user row)
  // must not keep a stale MANAGER/EMPLOYEE reading in sessionStorage past
  // the first request that actually finds out.
  if (res.status === 401 || res.status === 403) clearCachedActor();

  return { ok: res.ok, status: res.status, payload };
}

/** Same, for a request whose body is FormData (no Content-Type: the browser sets the boundary). */
export function apiForm(path, formData, method = "POST") {
  return apiJson(path, { method, body: formData });
}
