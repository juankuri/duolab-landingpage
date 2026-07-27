import { Hono } from "hono";

import type { AppEnv } from "../../env";

export const me = new Hono<AppEnv>();

/**
 * Lets the admin UI render for the signed-in role instead of guessing.
 *
 * This is a convenience for the interface, not a security boundary: hiding a
 * button does not stop the request, and every manager-only route enforces the
 * role itself. The reason to have it is usability — showing an action that
 * will be refused is worse than not showing it.
 */
me.get("/", (c) => {
  const actor = c.get("actor");

  return c.json({ email: actor.email, role: actor.role });
});
