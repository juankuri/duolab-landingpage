import { apiJson } from "./api.js";

/**
 * Who is looking at this screen, and what their initials/role read as in the
 * top bar. `GET /me` is the only source — role never comes from anywhere
 * else in the frontend, and this is cosmetic either way: `requireRole` on
 * the server is the actual gate (see auth.ts). A failed lookup defaults to
 * EMPLOYEE, the more restrictive of the two, rather than assuming MANAGER.
 */
export async function loadActor() {
  try {
    const { ok, payload } = await apiJson("/me");
    if (ok && payload?.role) return { role: payload.role };
  } catch {
    // Network failure reads the same as "no role" — EMPLOYEE below.
  }

  return { role: "EMPLOYEE" };
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
