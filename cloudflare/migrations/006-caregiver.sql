-- Run ONCE on a database created before caregiver accounts (vårdnadshavare) existed:
--   npx wrangler d1 execute gaussica --remote --file=migrations/006-caregiver.sql
-- (A fresh database already has the column through schema.sql; running this there reports "duplicate column", which is harmless.)
ALTER TABLE users ADD COLUMN caregiver INTEGER NOT NULL DEFAULT 0;
