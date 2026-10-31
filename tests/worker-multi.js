"use strict";
// The checks of tests/multi-scenario.js (several adults per child, a child in several classes) against the Cloudflare worker. The database (D1)
// is stood in for by node:sqlite with cloudflare/schema.sql, so the SQL the worker sends is really executed. Then the migration that brings an old
// database up to date is run on a database made the old way, and the worker is asked to use it.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.join(__dirname, "..");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function d1(db) {
  return {
    prepare(sql) {
      const st = db.prepare(sql);
      let args = [];
      const o = {
        bind(...a) { args = a; return o; },
        async first() { return st.get(...args) || null; },
        async all() { return { results: st.all(...args) }; },
        async run() { const r = st.run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; }
      };
      return o;
    },
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  };
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-worker-"));
  // each copy of the worker remembers by itself that its database has the tables, so the old database gets a copy of its own
  const load = async (name) => {
    const file = path.join(dir, name);
    fs.copyFileSync(path.join(ROOT, "cloudflare", "worker.js"), file);
    return (await import("file://" + file.replace(/\\/g, "/"))).default;
  };
  const worker = await load("worker.mjs");
  const workerOld = await load("worker-old.mjs");
  const schema = fs.readFileSync(path.join(ROOT, "cloudflare", "schema.sql"), "utf8");

  function setup(sql, w) {
    w = w || worker;
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(sql);
    const env = { DB: d1(db), TEACHER_CODE: "TESTCODE12", ALLOWED_ORIGINS: "https://test.example" };
    const who = () => {
      const me = { token: null };
      me.call = async (method, p, body) => {
        const headers = { "Content-Type": "application/json", Origin: "https://test.example" };
        if (me.token) headers.Authorization = "Bearer " + me.token;
        const res = await w.fetch(new Request("https://api.example" + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
        let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
        if (json && json.token) me.token = json.token;
        return { status: res.status, json };
      };
      return me;
    };
    return { db, who };
  }

  // 1. the same checks as against the Node server
  await require("./multi-scenario.js")(setup(schema).who, "TESTCODE12", ok);

  // 2. a database made before the tables existed: the worker says what to do, and after the migration the data is the same and works
  const oldSchema = fs.readFileSync(path.join(ROOT, "tests", "fixtures", "schema-before-multi.sql"), "utf8");
  const old = setup(oldSchema, workerOld);
  const T = old.who(), S = old.who();
  let r = await T.call("GET", "/api/me");
  ok(r.status === 503 && /007-multi/.test(r.json.error), "a database without the new tables is told to be updated (503, and which file)");
  old.db.exec("INSERT INTO users (id, username, display_name, role, password_hash, created_at) VALUES (1, 'gammalL', 'Fröken Gammal', 'teacher', 'x', '2026-01-01');" +
    "INSERT INTO classes (id, name, code, teacher_id, created_at) VALUES (1, '4A', 'ABC123', 1, '2026-01-01');" +
    "INSERT INTO users (id, username, display_name, role, password_hash, class_id, created_at) VALUES (2, 'gammalE', 'Elev Gammal', 'student', 'x', 1, '2026-01-01');" +
    "INSERT INTO chat (student_id, teacher_id, from_teacher, text, created_at) VALUES (2, 1, 0, 'Hej', '2026-01-02');" +
    "INSERT INTO feedback (student_id, teacher_id, text, created_at) VALUES (2, 1, 'Bra', '2026-01-02');");
  old.db.exec(fs.readFileSync(path.join(ROOT, "cloudflare", "migrations", "007-multi.sql"), "utf8"));
  const count = (sql) => old.db.prepare(sql).get().n;
  ok(count("SELECT COUNT(*) AS n FROM class_members WHERE class_id = 1 AND user_id = 2") === 1, "the migration makes the student a member of the class");
  ok(count("SELECT COUNT(*) AS n FROM class_guides WHERE class_id = 1 AND user_id = 1") === 1, "and the teacher a guide of it");
  ok(count("SELECT COUNT(*) AS n FROM classes WHERE guide_code IS NOT NULL") === 1 && count("SELECT COUNT(*) AS n FROM chat WHERE class_id = 1") === 1 && count("SELECT COUNT(*) AS n FROM feedback WHERE class_id = 1") === 1,
    "the class gets a code for adults, and the messages and cheers get their class");
  const OT = old.who();
  r = await OT.call("POST", "/api/login", { username: "gammalL", password: "x" });
  ok(r.status === 401, "set-up: the password of the fixture is not a real hash (a new teacher is made instead)");
  r = await OT.call("POST", "/api/register", { role: "teacher", username: "nyLarare", displayName: "Ny Lärare", password: "hemligt-123", teacherCode: "TESTCODE12" });
  ok(r.status === 201, "after the migration the worker works on the old database");
  r = await S.call("POST", "/api/register", { role: "student", username: "nyElev", displayName: "Ny Elev", password: "hemligt-123", classCode: "ABC123" });
  ok(r.status === 201 && r.json.user.classes.length === 1 && r.json.user.classes[0].name === "4A", "and a student can join a class that was made before the migration");

  console.log(failures ? "\n" + failures + " FAILED" : "\nAll worker multi-membership checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
