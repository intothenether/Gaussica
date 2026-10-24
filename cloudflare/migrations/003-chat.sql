-- Run ONCE on a database created before the chat between student and teacher existed:
--   npx wrangler d1 execute gaussica --remote --file=migrations/003-chat.sql
-- Safe to run again: the table and indexes are only created if they are missing.
CREATE TABLE IF NOT EXISTS chat (
  id           INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_teacher INTEGER NOT NULL DEFAULT 0,
  text         TEXT NOT NULL,
  lesson_id    TEXT,
  task_id      TEXT,
  context      TEXT,
  created_at   TEXT NOT NULL,
  read_at      TEXT
);
CREATE INDEX IF NOT EXISTS chat_student ON chat (student_id, id);
CREATE INDEX IF NOT EXISTS chat_teacher ON chat (teacher_id, from_teacher, read_at);
