-- Rate-limit counters for the public result lookup.
--
-- Keyed by an HMAC fingerprint, never a raw IP or raw folio: this table is
-- reachable by an unauthenticated caller's own request pattern, so nothing in
-- it should be reversible into the value that produced it. window_start pins
-- each row to one fixed-size window; a fingerprint gets a fresh row per
-- window rather than a single row updated forever, so the count naturally
-- resets and no expiry job is required for correctness (only for tidiness —
-- old rows are inert, not a correctness risk, and are swept only as a
-- documented follow-up).
CREATE TABLE public_lookup_attempts (
  fingerprint  TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fingerprint, window_start)
);
