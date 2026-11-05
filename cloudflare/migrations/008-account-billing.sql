-- E-mail for adults (to verify the address and to reset a lost password), the terms an adult has accepted, and who may use the site:
-- an entitlement for each teacher and caregiver (free, trial or paid), the events of Paddle that have been handled, and codes that give free access.
-- Run ONCE on a database made before this existed, BEFORE the worker is deployed (the old worker keeps working on the new tables):
--   npx wrangler d1 execute gaussica --remote --file=migrations/008-account-billing.sql
-- (A fresh database already has all of it through schema.sql; running this there reports "duplicate column", which is harmless.)
-- Every account that exists now gets free access for good (free_reason 'founder'); only accounts made later can start a trial.
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE users ADD COLUMN terms_version TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens (user_id);
CREATE TABLE IF NOT EXISTS entitlements (
  user_id                INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'trial', 'paid')),
  free_reason            TEXT,
  free_until             TEXT,
  trial_ends_at          TEXT,
  status                 TEXT,
  period_end             TEXT,
  cancel_at_period_end   INTEGER NOT NULL DEFAULT 0,
  paddle_customer_id     TEXT,
  paddle_subscription_id TEXT,
  updated_at             TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS access_codes (
  code       TEXT PRIMARY KEY,
  reason     TEXT,
  days       INTEGER,
  uses_left  INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO entitlements (user_id, plan, free_reason, updated_at) SELECT id, 'free', 'founder', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM users WHERE role = 'teacher';
