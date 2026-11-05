"use strict";
// SQLite storage (Node's built-in node:sqlite, no dependencies).

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA_VERSION = 9;

function open(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

function migrate(db) {
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version >= SCHEMA_VERSION) return;
  if (version < 1) {
    db.exec(`
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY,
        username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name  TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
        password_hash TEXT NOT NULL,
        class_id      INTEGER REFERENCES classes(id) ON DELETE SET NULL,
        created_at    TEXT NOT NULL
      );
      CREATE TABLE classes (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        code       TEXT NOT NULL UNIQUE,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE progress (
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id  TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, lesson_id)
      );
      CREATE TABLE attempts (
        id         INTEGER PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id  TEXT NOT NULL,
        task_id    TEXT NOT NULL,
        completed  INTEGER NOT NULL,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX attempts_user ON attempts (user_id, lesson_id, task_id);
      CREATE TABLE lessons (
        id         TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
  if (version < 2) {
    db.exec(`
      CREATE TABLE assignments (
        id         INTEGER PRIMARY KEY,
        class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id  TEXT NOT NULL,
        note       TEXT NOT NULL DEFAULT '',
        due_date   TEXT,
        created_at TEXT NOT NULL,
        archived   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX assignments_class ON assignments (class_id, archived);
      CREATE TABLE feedback (
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
      CREATE INDEX feedback_student ON feedback (student_id, created_at);
    `);
  }
  if (version < 3) {
    db.exec(`
      CREATE TABLE class_settings (
        class_id INTEGER PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
        rewards  INTEGER NOT NULL DEFAULT 1
      );
      ALTER TABLE assignments ADD COLUMN kind TEXT NOT NULL DEFAULT 'lesson';
    `);
  }
  if (version < 4) {
    db.exec(`
      CREATE TABLE chat (
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
      CREATE INDEX chat_student ON chat (student_id, id);
      CREATE INDEX chat_teacher ON chat (teacher_id, from_teacher, read_at);
    `);
  }
  if (version < 5) {
    db.exec(`
      CREATE TABLE site_feedback (
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
    `);
  }
  if (version < 6) {
    // a prov (generated test) is an assignment of kind 'prov' whose settings are kept here as JSON
    db.exec("ALTER TABLE assignments ADD COLUMN config TEXT;");
  }
  if (version < 7) {
    // a caregiver (vårdnadshavare) is a teacher account with this flag: the same classes (a family), assignments and messages,
    // but no editing of lessons and no teacher code needed
    db.exec("ALTER TABLE users ADD COLUMN caregiver INTEGER NOT NULL DEFAULT 0;");
  }
  if (version < 8) {
    // a student can be in several classes (a school class and a family), and a class has several guides (two parents, two teachers):
    // class_members and class_guides. users.class_id stays as the first class of a student. Messages and cheers belong to a class, so that
    // what the teacher wrote stays out of the family and the other way round.
    db.exec(`
      CREATE TABLE class_members (
        class_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (class_id, user_id)
      );
      CREATE INDEX class_members_user ON class_members (user_id);
      CREATE TABLE class_guides (
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (class_id, user_id)
      );
      CREATE INDEX class_guides_user ON class_guides (user_id);
      ALTER TABLE classes ADD COLUMN guide_code TEXT;
      ALTER TABLE chat ADD COLUMN class_id INTEGER;
      ALTER TABLE feedback ADD COLUMN class_id INTEGER;
      INSERT INTO class_members (class_id, user_id, joined_at) SELECT class_id, id, created_at FROM users WHERE class_id IS NOT NULL AND role = 'student';
      INSERT INTO class_guides (class_id, user_id) SELECT id, teacher_id FROM classes;
      UPDATE classes SET guide_code = 'V' || UPPER(HEX(RANDOMBLOB(5)));
      UPDATE chat SET class_id = (SELECT class_id FROM users WHERE users.id = chat.student_id);
      UPDATE feedback SET class_id = (SELECT class_id FROM users WHERE users.id = feedback.student_id);
      CREATE UNIQUE INDEX classes_guide_code ON classes (guide_code);
    `);
  }
  if (version < 9) {
    // e-mail for adults, the terms they accepted, and who may use the site (free, trial, paid): cloudflare/migrations/008-account-billing.sql
    db.exec(`
      ALTER TABLE users ADD COLUMN email TEXT;
      ALTER TABLE users ADD COLUMN email_verified_at TEXT;
      ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
      ALTER TABLE users ADD COLUMN terms_version TEXT;
      CREATE UNIQUE INDEX users_email ON users (email) WHERE email IS NOT NULL;
      CREATE TABLE email_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
        email      TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at    TEXT
      );
      CREATE INDEX email_tokens_user ON email_tokens (user_id);
      CREATE TABLE entitlements (
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
      CREATE TABLE billing_events (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE TABLE access_codes (
        code       TEXT PRIMARY KEY,
        reason     TEXT,
        days       INTEGER,
        uses_left  INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO entitlements (user_id, plan, free_reason, updated_at) SELECT id, 'free', 'founder', strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM users WHERE role = 'teacher';
    `);
  }
  db.exec("PRAGMA user_version = " + SCHEMA_VERSION);
}

module.exports = { open };
