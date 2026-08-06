import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * The config half of what test/auth.test.ts already pins on the code half.
 *
 * isLocalDev() (http/middleware/auth.ts) is a strict-equality check on
 * ENVIRONMENT === "local", and the whole Access bypass it gates is inert in
 * production ONLY because ENVIRONMENT is never set in wrangler.jsonc's
 * shipped `vars` — it lives exclusively in backend/.dev.vars, which
 * `wrangler deploy` never uploads. That is currently true by omission,
 * verified by reading the file, not by anything that fails if it changes.
 *
 * If this test ever fails, the fix is removing ENVIRONMENT from
 * wrangler.jsonc, not loosening this assertion: a single misplaced line
 * here would silently make the local Access bypass live in a real
 * environment, in every environment that inherits the top-level vars.
 *
 * The suite runs inside workerd, which has no node:fs — the raw file text is
 * read in Node by vitest.config.ts and injected as TEST_WRANGLER_CONFIG_SOURCE,
 * same mechanism as TEST_MIGRATIONS.
 */
describe("wrangler.jsonc never sets ENVIRONMENT", () => {
  it("has no ENVIRONMENT key anywhere in the file", () => {
    expect(env.TEST_WRANGLER_CONFIG_SOURCE).not.toMatch(/["']?ENVIRONMENT["']?\s*:/);
  });
});
