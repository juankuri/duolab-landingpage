import type { Context } from "hono";

import type { Role } from "./domain/roles";

export type Bindings = {
  DB: D1Database;
  RESULTS_BUCKET: R2Bucket;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
  CLOUDFLARE_ACCESS_AUDIENCE: string;
  // Set to "local" only via backend/.dev.vars (never deployed). Enables the
  // Access bypass in http/middleware/auth.ts, since Cloudflare Access JWTs
  // cannot exist on localhost.
  ENVIRONMENT?: string;
  // Which role the local bypass identity gets, so both flows are testable
  // offline. Read only after the ENVIRONMENT check has already passed.
  DEV_ROLE?: string;
  // Keys the public lookup's rate-limit fingerprints (domain/fingerprint.ts).
  // Self-generated application secret, not a Cloudflare resource id: set via
  // backend/.dev.vars locally, `wrangler secret put` before deploy.
  RATE_LIMIT_KEY_SECRET: string;
  // Encrypts public download tokens (domain/download-token.ts). Must decode
  // from base64 to exactly 32 bytes — generate with `openssl rand -base64
  // 32`. Self-generated application secret, not a Cloudflare resource id.
  DOWNLOAD_TOKEN_SECRET: string;
};

export type Actor = {
  email: string;
  subject: string;
  role: Role;
};

export type Variables = {
  /**
   * Named "actor" rather than "employee": once managers exist, the old name
   * implied a role it no longer guarantees.
   */
  actor: Actor;
  /** Correlates a client-visible failure with the server log line. */
  requestId: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

export type AppContext = Context<AppEnv>;
