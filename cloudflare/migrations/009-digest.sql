-- The weekly summary by e-mail that a caregiver can ask for (Mitt konto): who has asked for it, and when it was last sent.
-- Run ONCE on a database made before this existed, BEFORE the worker is deployed:
--   npx wrangler d1 execute gaussica --remote --file=migrations/009-digest.sql
-- (A fresh database already has it through schema.sql; running this there changes nothing.)

CREATE TABLE IF NOT EXISTS digests (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT
);
