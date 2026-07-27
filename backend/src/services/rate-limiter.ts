import { hmacFingerprint } from "../domain/fingerprint";
import { incrementAndCheck } from "../data/rate-limit.repo";

// Fixed-size windows, not a sliding log: cheap (one row per key per window,
// no history to prune for correctness) and precise enough for abuse
// resistance — the worst case is an attacker gets a fresh budget right at a
// window boundary, not that the limit fails to apply.
const WINDOW_MS = 10 * 60 * 1000;

// Two independent budgets. IP is the broader one (a single attacker trying
// many folios); folio is the narrower one (many attackers, or one rotating
// IPs, all guessing phone/birthdate for one specific folio — the actual
// enumeration target). Either tripping blocks the request, so neither budget
// alone is a way around the other.
const IP_LIMIT_PER_WINDOW = 30;
const FOLIO_LIMIT_PER_WINDOW = 10;

function windowStart(now: number): string {
  return new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS).toISOString();
}

/**
 * `folioInput` is deliberately taken as whatever the caller has after best-
 * effort normalization, even if it never passes full validation — a request
 * with a malformed folio must still consume that folio-shaped fingerprint's
 * budget, or failing validation first becomes a way to dodge rate limiting
 * entirely.
 */
export async function checkPublicLookupRateLimit(
  db: D1Database,
  secret: string,
  ip: string,
  folioInput: string,
  now: number = Date.now(),
): Promise<boolean> {
  const window = windowStart(now);

  const [ipFingerprint, folioFingerprint] = await Promise.all([
    hmacFingerprint(secret, "ip", ip),
    hmacFingerprint(secret, "folio", folioInput),
  ]);

  const [ipResult, folioResult] = await Promise.all([
    incrementAndCheck(db, ipFingerprint, window, IP_LIMIT_PER_WINDOW),
    incrementAndCheck(db, folioFingerprint, window, FOLIO_LIMIT_PER_WINDOW),
  ]);

  return ipResult.allowed && folioResult.allowed;
}
