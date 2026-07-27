// `cloudflare:test` types its `env` as `Cloudflare.Env`, which is empty unless
// `wrangler types` has been run. Rather than commit the half-megabyte of
// generated runtime types that command produces, the bindings the suite
// actually touches are declared here. `pnpm cf-typegen` still works for
// anyone who wants the full generated set locally.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    RESULTS_BUCKET: R2Bucket;
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
    CLOUDFLARE_ACCESS_AUDIENCE: string;
    ENVIRONMENT?: string;
    /** Supplied by vitest.config.ts, applied by test/setup.ts. */
    TEST_MIGRATIONS: import("@cloudflare/vitest-pool-workers").D1Migration[];
  }
}
