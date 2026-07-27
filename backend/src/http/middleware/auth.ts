import type { Next } from "hono";

import type { AppContext } from "../../env";
import { createRemoteJWKSet, jwtVerify } from "jose";

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

export async function requireAccess(c: AppContext, next: Next) {
  if (isLocalDev(c)) {
    c.set("employee", {
      email: "local-dev@duolab.test",
      subject: "local-dev",
    });

    return next();
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const jwks = accessJwks(c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://${c.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`,
      audience: c.env.CLOUDFLARE_ACCESS_AUDIENCE,
    });

    if (typeof payload.email !== "string" || typeof payload.sub !== "string") {
      return c.json({ error: "Access token is missing identity claims." }, 401);
    }

    c.set("employee", {
      email: payload.email,
      subject: payload.sub,
    });

    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}
