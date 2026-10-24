-- Run ONCE on a database created before feedback about the site existed:
--   npx wrangler d1 execute gaussica --remote --file=migrations/004-site-feedback.sql
-- Safe to run again: the table is only created if it is missing.
CREATE TABLE IF NOT EXISTS site_feedback (
  id         INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL,
  text       TEXT NOT NULL,
  email      TEXT,
  page       TEXT,
  context    TEXT,
  sender     TEXT,
  agent      TEXT,
  emailed    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
