-- Run ONCE on a database created before assignments had a kind (practice assignments):
--   npx wrangler d1 execute gaussica --remote --file=migrations/002-assignment-kind.sql
-- (A fresh database already has the column through schema.sql; running this there reports "duplicate column", which is harmless.)
ALTER TABLE assignments ADD COLUMN kind TEXT NOT NULL DEFAULT 'lesson';
