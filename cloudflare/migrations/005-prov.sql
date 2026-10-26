-- Run ONCE on a database created before the prov (generated tests) existed:
--   npx wrangler d1 execute gaussica --remote --file=migrations/005-prov.sql
-- (A fresh database already has the column through schema.sql; running this there reports "duplicate column", which is harmless.)
ALTER TABLE assignments ADD COLUMN config TEXT;
