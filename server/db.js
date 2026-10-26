"use strict";
// SQLite storage (Node's built-in node:sqlite, no dependencies).

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA_VERSION = 6;

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
  db.exec("PRAGMA user_version = " + SCHEMA_VERSION);
}

module.exports = { open };
