import type { Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";

import * as usersRepo from "../../data/users.repo";
import { AppError } from "../../domain/errors";
import { type Role, isRole, satisfies } from "../../domain/roles";
import { normalizeEmail } from "../../domain/validation";
import type { AppContext } from "../../env";

// Browsers cannot obtain a Cf-Access-Jwt-Assertion header on localhost: it is
// injected by Cloudflare's edge, which local dev does not go through. Without
// this, every protected route returns 401 during frontend development.
//
// This is inert in production. ENVIRONMENT is set only in backend/.dev.vars,
// which wrangler reads for `wrangler dev` and never uploads on deploy. It is
// deliberately NOT in wrangler.jsonc, whose top-level `vars` DO ship.
//
// The comparison is strict equality on purpose: "Local", "local " and
// "development" must all fail it. test/auth.test.ts holds that shut.
export function isLocalDev(c: AppContext): boolean {
  return c.env.ENVIRONMENT === "local";
}

// createRemoteJWKSet keeps its key cache on the returned function, so building
// a new one per request re-fetches Cloudflare's signing keys on every call.
// Cached per team domain at module scope, which lives as long as the isolate.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function accessJwks(teamDomain: string) {
  const cached = jwksCache.get(teamDomain);

  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(
    new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
  );
  jwksCache.set(teamDomain, jwks);

  return jwks;
}

/**
 * Local dev has no Access identity, so one is synthesized. DEV_ROLE decides
 * which one, so both the employee and the manager flow can be exercised
 * offline by editing .dev.vars and restarting.
 *
 * This reads DEV_ROLE only after isLocalDev has already passed, so it is
 * gated by the same single check rather than adding a second way in.
 */
function localActor(c: AppContext) {
  const requested = c.env.DEV_ROLE?.toUpperCase();
  const role: Role = isRole(requested) ? requested : "EMPLOYEE";

  return {
    email: "local-dev@duolab.test",
    subject: "local-dev",
    role,
  };
}

/**
 * Verifies the Access token, then resolves what that person may do.
 *
 * The two answers are kept distinct on purpose. A valid token with no users
 * row is 403, not 401: the identity is real, the authorization is missing.
 * Collapsing them into 401 is what makes access problems hard to diagnose,
 * because "log in again" is useless advice to someone already logged in.
 *
 * Default deny: an unknown or inactive address is refused. Absence of a row
 * never falls back to EMPLOYEE.
 */
export async function requireAccess(c: AppContext, next: Next) {
  if (isLocalDev(c)) {
    c.set("actor", localActor(c));

    return next();
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");

  if (!token) {
    throw new AppError("UNAUTHENTICATED", "Unauthorized");
  }

  let email: string;

  try {
    const jwks = accessJwks(c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`,
      audience: c.env.CLOUDFLARE_ACCESS_AUDIENCE,
    });

    if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
      throw new AppError("UNAUTHENTICATED", "Access token is missing identity claims.");
    }

    // Normalized before it is used as a key, so Ana@Duolab.mx and
    // ana@duolab.mx are one person rather than two.
    email = normalizeEmail(payload.email);
    c.set("actor", { email, subject: payload.sub, role: "EMPLOYEE" });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("UNAUTHENTICATED", "Unauthorized");
  }

  const user = await usersRepo.findByEmail(c.env.DB, email);

  if (!user || user.active !== 1 || !isRole(user.role)) {
    throw new AppError("FORBIDDEN", "Esta cuenta no tiene acceso.");
  }

  // The role comes from this lookup and nowhere else. It is never read from a
  // header, a body or a token claim the client could influence.
  c.set("actor", { email, subject: c.get("actor").subject, role: user.role });

  await next();
}

export function requireRole(required: Role) {
  return async (c: AppContext, next: Next) => {
    const actor = c.get("actor");

    if (!actor || !satisfies(actor.role, required)) {
      throw new AppError("FORBIDDEN", "No tienes permiso para esta acción.");
    }

    await next();
  };
}
