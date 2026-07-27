import type { Context } from "hono";

export type Bindings = {
  DB: D1Database;
  RESULTS_BUCKET: R2Bucket;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
  CLOUDFLARE_ACCESS_AUDIENCE: string;
  // Set to "local" only via backend/.dev.vars (never deployed). Enables the
  // Access bypass in http/middleware/auth.ts, since Cloudflare Access JWTs
  // cannot exist on localhost.
  ENVIRONMENT?: string;
};

export type EmployeeIdentity = {
  email: string;
  subject: string;
};

export type Variables = {
  employee: EmployeeIdentity;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

export type AppContext = Context<AppEnv>;
