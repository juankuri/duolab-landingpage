import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source-text guard on the two halves of the security headers policy
 * (DEC-030), in the same family as legal-gating.test.js: this file pins the
 * config against an edit that quietly drops a header or a directive, since
 * neither half is otherwise exercised by an automated test (public/_headers
 * is parsed by wrangler/Cloudflare, not by this suite; the CSP meta tag is
 * only present in a real build's output).
 */
const ROOT = process.cwd();
const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");

describe("frontend/public/_headers", () => {
  const source = read("public", "_headers");

  it("applies to every response", () => {
    expect(source).toMatch(/^\/\*\s*$/m);
  });

  it("carries only frame-ancestors in its Content-Security-Policy", () => {
    const match = source.match(/Content-Security-Policy:\s*(.+)/);
    expect(match?.[1].trim()).toBe("frame-ancestors 'none'");
  });

  it("sets the rest of the header set", () => {
    expect(source).toMatch(/X-Frame-Options:\s*DENY/);
    expect(source).toMatch(/X-Content-Type-Options:\s*nosniff/);
    expect(source).toMatch(/Referrer-Policy:\s*no-referrer/);
    expect(source).toMatch(
      /Strict-Transport-Security:\s*max-age=31536000; includeSubDomains/,
    );
    expect(source).toMatch(
      /Permissions-Policy:\s*camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\)/,
    );
  });

  it("never ships HSTS preload", () => {
    const match = source.match(/Strict-Transport-Security:\s*(.+)/);
    expect(match?.[1]).not.toMatch(/preload/i);
  });
});

describe("astro.config.mjs security.csp", () => {
  const config = read("astro.config.mjs");

  it("is enabled", () => {
    expect(config).toMatch(/security:\s*{\s*csp:\s*{/);
  });

  it("carries the expected resource directives", () => {
    for (const directive of [
      "default-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-src https://www.google.com",
      "object-src 'self' blob:",
      "worker-src 'self' blob:",
      "base-uri 'none'",
      "form-action 'self'",
    ]) {
      expect(config).toContain(directive);
    }
  });

  it("does not add frame-ancestors to the directive list — a <meta> CSP ignores it", () => {
    const directives = config.match(/directives:\s*\[([\s\S]*?)\],/)?.[1] ?? "";
    expect(directives).not.toContain("frame-ancestors");
  });
});
