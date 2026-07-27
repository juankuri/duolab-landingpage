import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { hmacFingerprint } from "../src/domain/fingerprint";
import { incrementAndCheck } from "../src/data/rate-limit.repo";
import { checkPublicLookupRateLimit } from "../src/services/rate-limiter";

describe("hmacFingerprint", () => {
  it("is deterministic for the same secret, label and value", async () => {
    const a = await hmacFingerprint("secret", "ip", "203.0.113.1");
    const b = await hmacFingerprint("secret", "ip", "203.0.113.1");

    expect(a).toBe(b);
  });

  it("differs across labels for the same value", async () => {
    const asIp = await hmacFingerprint("secret", "ip", "same-value");
    const asFolio = await hmacFingerprint("secret", "folio", "same-value");

    expect(asIp).not.toBe(asFolio);
  });

  it("differs across secrets for the same input", async () => {
    const a = await hmacFingerprint("secret-one", "ip", "203.0.113.1");
    const b = await hmacFingerprint("secret-two", "ip", "203.0.113.1");

    expect(a).not.toBe(b);
  });

  it("is not recoverable to the raw value by inspection", async () => {
    const fingerprint = await hmacFingerprint("secret", "ip", "203.0.113.1");

    expect(fingerprint).not.toContain("203.0.113.1");
  });
});

describe("incrementAndCheck", () => {
  it("allows requests at and under the limit, denies over it", async () => {
    const window = "2026-01-01T00:00:00.000Z";

    for (let i = 1; i <= 3; i++) {
      const result = await incrementAndCheck(env.DB, "fp-a", window, 3);
      expect(result.count).toBe(i);
      expect(result.allowed).toBe(true);
    }

    const fourth = await incrementAndCheck(env.DB, "fp-a", window, 3);
    expect(fourth.count).toBe(4);
    expect(fourth.allowed).toBe(false);
  });

  it("keeps independent counters per fingerprint", async () => {
    const window = "2026-01-01T00:00:00.000Z";

    await incrementAndCheck(env.DB, "fp-b", window, 1);
    const other = await incrementAndCheck(env.DB, "fp-c", window, 1);

    expect(other.count).toBe(1);
    expect(other.allowed).toBe(true);
  });

  it("resets in a new window", async () => {
    await incrementAndCheck(env.DB, "fp-d", "2026-01-01T00:00:00.000Z", 1);
    const nextWindow = await incrementAndCheck(
      env.DB,
      "fp-d",
      "2026-01-01T00:10:00.000Z",
      1,
    );

    expect(nextWindow.count).toBe(1);
    expect(nextWindow.allowed).toBe(true);
  });

  // Proves the increment is a single atomic statement, not an application-
  // side read-modify-write: N concurrent callers against the same fingerprint
  // must land on exactly N total, never fewer from a lost update.
  it("counts every increment exactly once under concurrency", async () => {
    const window = "2026-01-01T00:00:00.000Z";
    const concurrency = 25;

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        incrementAndCheck(env.DB, "fp-concurrent", window, concurrency),
      ),
    );

    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(
      Array.from({ length: concurrency }, (_, i) => i + 1),
    );
  });
});

describe("checkPublicLookupRateLimit", () => {
  const secret = "test-secret";
  const now = new Date("2026-01-01T00:00:00.000Z").getTime();

  it("allows requests within both the IP and folio budgets", async () => {
    const allowed = await checkPublicLookupRateLimit(
      env.DB,
      secret,
      "203.0.113.5",
      "ABC-123",
      now,
    );

    expect(allowed).toBe(true);
  });

  it("denies once the folio-scoped budget is exceeded, even from different IPs", async () => {
    for (let i = 0; i < 10; i++) {
      await checkPublicLookupRateLimit(
        env.DB,
        secret,
        `203.0.113.${i}`,
        "TARGETED-FOLIO",
        now,
      );
    }

    const eleventh = await checkPublicLookupRateLimit(
      env.DB,
      secret,
      "203.0.113.99",
      "TARGETED-FOLIO",
      now,
    );

    expect(eleventh).toBe(false);
  });

  it("denies once the IP-scoped budget is exceeded, even across different folios", async () => {
    for (let i = 0; i < 30; i++) {
      await checkPublicLookupRateLimit(
        env.DB,
        secret,
        "203.0.113.200",
        `FOLIO-${i}`,
        now,
      );
    }

    const overLimit = await checkPublicLookupRateLimit(
      env.DB,
      secret,
      "203.0.113.200",
      "ONE-MORE-FOLIO",
      now,
    );

    expect(overLimit).toBe(false);
  });
});
