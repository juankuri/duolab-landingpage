import { apiJson } from "./api.js";

/**
 * Who is looking at this screen, and what their initials/role read as in the
 * top bar. `GET /me` is the only source — role never comes from anywhere
 * else in the frontend, and this is cosmetic either way: `requireRole` on
 * the server is the actual gate (see auth.ts). A failed lookup defaults to
 * EMPLOYEE, the more restrictive of the two, rather than assuming MANAGER.
 *
 * `sessionStorage` cache (checkpoint F performance pass), subject to every
 * one of these — see docs/09-ux-completion-plan.md §F3:
 *   - a render hint only, NEVER the source of truth for authorization —
 *     requireRole("MANAGER") on publish remains the only real gate;
 *   - served immediately, but GET /me is always revalidated in the
 *     background on the same call (never trusted alone past one page load);
 *   - updated, and the caller's onChange fires, when revalidation disagrees
 *     with what was cached;
 *   - cleared by api.js on any 401 or 403, from one place (`apiJson`),
 *     so a session ending mid-visit can't keep serving a stale role;
 *   - cleared on logout — there is no app-level logout today (Cloudflare
 *     Access sessions are managed entirely at the edge, DEC-006), so this
 *     is a requirement on whichever screen adds one later, not code that
 *     exists yet; `clearCachedActor` is exported specifically so that
 *     screen only has to call it, not reinvent the cache key;
 *   - sessionStorage, not localStorage — dies with the tab, never persists
 *     across a browser restart on a shared machine.
 */
const ACTOR_CACHE_KEY = "duolab:actor";

export function getCachedActor() {
  try {
    const raw = sessionStorage.getItem(ACTOR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role ? parsed : null;
  } catch {
    // Private-browsing Safari throws on sessionStorage access in some
    // configurations; no cache is a correctness-preserving fallback.
    return null;
  }
}

export function setCachedActor(actor) {
  try {
    sessionStorage.setItem(ACTOR_CACHE_KEY, JSON.stringify(actor));
  } catch {
    // Storage full or unavailable — the page still works, just uncached.
  }
}

export function clearCachedActor() {
  try {
    sessionStorage.removeItem(ACTOR_CACHE_KEY);
  } catch {
    // Nothing to clear if storage was never reachable.
  }
}

/**
 * Resolves immediately with a cached role if one exists (a render hint, so
 * the page doesn't flash a loading state on every navigation), while a real
 * `GET /me` always runs in the background. `onChange(actor)` fires only if
 * the real answer disagrees with what was cached, so a caller can reconcile
 * anything decided from the fast, possibly-stale answer (a redirect, a
 * gated action) — never call this expecting it to gate the one publish
 * action that actually matters; that gate is server-side regardless.
 */
export function loadActor(onChange) {
  const cached = getCachedActor();

  const revalidate = (async () => {
    let actor = { role: "EMPLOYEE" };
    try {
      const { ok, payload } = await apiJson("/me");
      if (ok && payload?.role) actor = { role: payload.role };
    } catch {
      // Network failure reads the same as "no role" — EMPLOYEE.
    }

    setCachedActor(actor);
    // Only a reconciliation notice: when there was no cache, the caller
    // already gets this same value as loadActor()'s own return — a second,
    // redundant onChange call would just be duplicate work for every
    // first-ever page load, which is the common case, not the rare one.
    if (onChange && cached && cached.role !== actor.role) onChange(actor);
    return actor;
  })();

  // Cached value first, without waiting on the network — the caller gets a
  // role synchronously-ish either way, from cache when there is one.
  if (cached) {
    revalidate.catch(() => {}); // background; failures are handled above
    return Promise.resolve(cached);
  }

  return revalidate;
}

/** Fills the top bar's #who-name/#who-initials, wherever they exist on the page. */
export function fillWho(role) {
  const name = document.getElementById("who-name");
  const avatar = document.getElementById("who-initials");

  if (name) name.textContent = role === "MANAGER" ? "Gerencia" : "Recepción";
  if (avatar) avatar.textContent = role === "MANAGER" ? "GE" : "RE";
}

/**
 * Where a landing on `pathname` should bounce to, given `role` — or `null`
 * to stay put. Pure on purpose: this is the one place the manager/employee
 * split could loop, so it is the one place worth testing without a DOM.
 *
 * `/admin/manager` is exclusive to MANAGER: an EMPLOYEE there is sent back
 * to `/admin`, which never bounces anyone, so there is no ping-pong. A
 * MANAGER landing on `/admin` is sent to `/admin/manager` UNLESS `desktop`
 * is set — the `?desktop=1` escape hatch, otherwise a manager (or a
 * developer with DEV_ROLE=manager) could never reach the dense admin at all.
 */
export function roleRedirect(role, pathname, { desktop = false } = {}) {
  if (pathname === "/admin/manager") {
    return role === "MANAGER" ? null : "/admin";
  }

  if (pathname === "/admin") {
    return role === "MANAGER" && !desktop ? "/admin/manager" : null;
  }

  return null;
}
