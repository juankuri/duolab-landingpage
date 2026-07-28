import { defineConfig } from "vitest/config";

/**
 * Covers scripts/admin/ only.
 *
 * These are the pure modules the employee screens are built from: the status
 * vocabulary, the folio suggestion, the validation mirror and the DOM builders.
 * They hold the rules worth pinning and they run without Astro, a server or a
 * real browser.
 *
 * The pages themselves are not covered here. Testing them would mean rendering
 * Astro output and stubbing the API, which buys much less than it costs while
 * the manual smoke walk is still the gate for page behaviour.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Only the pure modules these tests actually exercise. api.js and
      // upload.js are thin fetch()/XHR wrappers — same role as backend's
      // data/ layer — and are exercised through manual smoke testing, not
      // unit coverage; measuring them here would just report 0% on I/O this
      // suite was never meant to drive. Including the .astro pages would be
      // the same mistake at a larger scale.
      include: [
        "src/scripts/admin/status.js",
        "src/scripts/admin/folio.js",
        "src/scripts/admin/render.js",
        "src/scripts/admin/validation.js",
        "src/scripts/admin/session.js",
      ],
      thresholds: {
        statements: 85,
        branches: 75,
      },
    },
  },
});
