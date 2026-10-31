-- Several adults per class (two parents, two teachers) and a student in several classes (a school class and a family).
-- Run ONCE on a database made before this existed, BEFORE the worker is deployed (the old worker keeps working on the new tables):
--   npx wrangler d1 execute gaussica --remote --file=migrations/007-multi.sql
-- (A fresh database already has all of it through schema.sql; running this there reports "duplicate column", which is harmless.)
-- users.class_id stays as the first class of a student. Messages and cheers belong to a class (class_id), so that what the teacher wrote
-- stays out of the family and the other way round.
CREATE TABLE IF NOT EXISTS class_members (
  class_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS class_members_user ON class_members (user_id);
CREATE TABLE IF NOT EXISTS class_guides (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS class_guides_user ON class_guides (user_id);
ALTER TABLE classes ADD COLUMN guide_code TEXT;
ALTER TABLE chat ADD COLUMN class_id INTEGER;
ALTER TABLE feedback ADD COLUMN class_id INTEGER;
INSERT OR IGNORE INTO class_members (class_id, user_id, joined_at) SELECT class_id, id, created_at FROM users WHERE class_id IS NOT NULL AND role = 'student';
INSERT OR IGNORE INTO class_guides (class_id, user_id) SELECT id, teacher_id FROM classes;
UPDATE classes SET guide_code = 'V' || UPPER(HEX(RANDOMBLOB(5))) WHERE guide_code IS NULL;
UPDATE chat SET class_id = (SELECT class_id FROM users WHERE users.id = chat.student_id) WHERE class_id IS NULL;
UPDATE feedback SET class_id = (SELECT class_id FROM users WHERE users.id = feedback.student_id) WHERE class_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS classes_guide_code ON classes (guide_code);
