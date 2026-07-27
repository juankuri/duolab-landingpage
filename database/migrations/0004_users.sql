-- Internal staff and what each may do.
--
-- Cloudflare Access answers "is this a real person we let in". It does not
-- answer "may this person publish a result", and that is the distinction the
-- manager flow needs. Roles live here rather than in an Access group claim so
-- they are auditable in our own data, testable without the edge, and
-- changeable without touching the Cloudflare dashboard.
--
-- No rows are seeded. Real staff addresses are not committed to the
-- repository; see backend/README.md for the command that adds them.

CREATE TABLE users (
  -- NOCASE so a row inserted by hand with capitals still resolves. Note this
  -- folds ASCII only, which is why the application lowercases as well; that
  -- is the primary control and this is defence in depth.
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  role       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (role IN ('EMPLOYEE', 'MANAGER')),
  -- Makes a non-normalized address impossible to store, so the application
  -- and the database cannot quietly disagree about who a user is.
  --
  -- COLLATE BINARY is required, not decorative: the column is NOCASE, and
  -- without overriding it here this comparison would itself be case
  -- insensitive, making 'Ana@Duolab.MX' = lower('Ana@Duolab.MX') true and the
  -- constraint a no-op for exactly the case it exists to catch.
  CHECK (email = lower(trim(email)) COLLATE BINARY)
);

-- files.confirmed_by, published_by and revoked_by stay plain text rather than
-- referencing this table on purpose: an audit trail has to survive a user
-- being removed, and a foreign key would either block the removal or take the
-- history with it.
