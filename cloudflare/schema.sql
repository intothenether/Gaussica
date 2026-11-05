-- Gaussica database for Cloudflare D1 (same tables as the Node server's SQLite file, plus rate_limits).
-- Create once with:  npx wrangler d1 execute gaussica --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  password_hash TEXT NOT NULL,
  class_id      INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  email              TEXT,                   -- of an adult: to verify it and to reset a lost password (lower case, unique)
  email_verified_at  TEXT,
  terms_accepted_at  TEXT,                   -- when an adult accepted the terms, and which version
  terms_version      TEXT,
  caregiver     INTEGER NOT NULL DEFAULT 0   -- 1: a caregiver (vårdnadshavare), a teacher account whose class is a family
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS classes (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  guide_code TEXT UNIQUE   -- the code that makes another adult a guide of the class (the other parent, a second teacher)
);
-- a student can be in several classes (a school class and a family), and a class has several guides (the owner is classes.teacher_id)
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
  kind       TEXT NOT NULL DEFAULT 'lesson',
  config     TEXT
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
  read_at    TEXT,
  class_id   INTEGER
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
  read_at      TEXT,
  class_id     INTEGER
);
CREATE INDEX IF NOT EXISTS chat_student ON chat (student_id, id);
CREATE INDEX IF NOT EXISTS chat_teacher ON chat (teacher_id, from_teacher, read_at);
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
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
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
