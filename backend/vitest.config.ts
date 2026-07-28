import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Read in Node, applied inside the worker by test/setup.ts. The migrations in
// database/migrations are the schema's single source of truth, so tests run
// against the real files rather than a copy that could drift from them.
const migrations = await readD1Migrations("../database/migrations");

// Tests run inside workerd with real D1 and R2 bindings backed by Miniflare,
// not mocks. Repository SQL and storage calls are therefore exercised for
// real, which is the whole reason for this pool over plain vitest: the parts
// most likely to be wrong are the ones that touch the two stores.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          // The Access bypass is keyed on this. Tests that need an
          // unauthenticated request override it per call.
          ENVIRONMENT: "local",
          TEST_MIGRATIONS: migrations,
          // Fixed test-fixture values, not real secrets: local dev and
          // deploy get their own via backend/.dev.vars and `wrangler secret
          // put` respectively, neither of which is checked into git.
          RATE_LIMIT_KEY_SECRET: "test-rate-limit-key-secret-not-for-deploy",
          // 32 zero bytes, base64-encoded — a valid-shaped key, not a secret.
          DOWNLOAD_TOKEN_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
      },
    }),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
    coverage: {
      // v8 does not instrument code running inside workerd; istanbul does,
      // via source transform, so it is the only provider that works with
      // cloudflareTest. See docs/06-quality.md for the measured baseline.
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["src/**"],
      thresholds: {
        // Deliberately not a single global number: domain/ and services/
        // hold the rules worth pinning tightly, data/ is thinner because
        // some branches only trigger under real D1/R2 failure injection.
        "src/domain/**": { statements: 90, branches: 85 },
        "src/services/**": { statements: 90, branches: 80 },
        // Branches held at the measured floor, not the target: users.repo.ts
        // has no direct test today (only exercised indirectly through
        // auth.ts) and sits at 0%. Documented as a known gap in
        // docs/06-quality.md rather than papered over with a lower number
        // that would hide it; raise this the day that gap is closed.
        "src/data/**": { statements: 80, branches: 55 },
        "src/http/**": { statements: 80, branches: 70 },
      },
    },
  },
});
