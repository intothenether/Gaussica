-- Gaussica database for Cloudflare D1 (same tables as the Node server's SQLite file, plus rate_limits).
-- Create once with:  npx wrangler d1 execute gaussica --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  password_hash TEXT NOT NULL,
  class_id      INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  task_id    TEXT NOT NULL,
  completed  INTEGER NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_user ON attempts (user_id, lesson_id, task_id);
CREATE TABLE IF NOT EXISTS lessons (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id         INTEGER PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  due_date   TEXT,
  created_at TEXT NOT NULL,
  archived   INTEGER NOT NULL DEFAULT 0,
  kind       TEXT NOT NULL DEFAULT 'lesson'
);
CREATE INDEX IF NOT EXISTS assignments_class ON assignments (class_id, archived);
CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT,
  task_id    TEXT,
  text       TEXT NOT NULL DEFAULT '',
  sticker    TEXT,
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX IF NOT EXISTS feedback_student ON feedback (student_id, created_at);
CREATE TABLE IF NOT EXISTS class_settings (
  class_id INTEGER PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  rewards  INTEGER NOT NULL DEFAULT 1
);
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
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
