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
  },
});
