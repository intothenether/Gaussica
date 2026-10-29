"use strict";
// Caregiver accounts against the Cloudflare worker (the same checks as tests/api-caregiver.js, in short). The database (D1) is stood in
// for by node:sqlite with cloudflare/schema.sql, so the SQL the worker sends is really executed.
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
  const file = path.join(dir, "worker.mjs");
  fs.copyFileSync(path.join(ROOT, "cloudflare", "worker.js"), file);
  const worker = (await import("file://" + file.replace(/\\/g, "/"))).default;
  const schema = fs.readFileSync(path.join(ROOT, "cloudflare", "schema.sql"), "utf8");

  function setup(sql) {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(sql);
    const env = { DB: d1(db), TEACHER_CODE: "TESTCODE12", ALLOWED_ORIGINS: "https://test.example" };
    const who = () => {
      const me = { token: null };
      me.call = async (method, p, body) => {
        const headers = { "Content-Type": "application/json", Origin: "https://test.example" };
        if (me.token) headers.Authorization = "Bearer " + me.token;
        const res = await worker.fetch(new Request("https://api.example" + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
        let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
        if (json && json.token) me.token = json.token;
        return { status: res.status, json };
      };
      return me;
    };
    return { db, who };
  }

  const { db, who } = setup(schema);
  const count = (sql, ...args) => db.prepare(sql).get(...args).n;
  const C = who(), C2 = who(), K = who(), K2 = who(), T = who();

  let r = await C.call("POST", "/api/register", { role: "caregiver", username: "vardnadW", displayName: "Maria Andersson", password: "hemligt-123" });
  ok(r.status === 201 && r.json.user.role === "caregiver", "a caregiver registers without a code");
  r = await C.call("GET", "/api/me");
  ok(r.json.user.role === "caregiver", "/api/me says caregiver");
  r = await C.call("GET", "/api/teacher/classes");
  ok(r.json.classes.length === 1 && r.json.classes[0].name === "Familjen Andersson", "the family is made at once");
  const family = r.json.classes[0];
  r = await C.call("POST", "/api/teacher/classes", { name: "Till" });
  ok(r.status === 400, "a caregiver has one family only");
  r = await C.call("PUT", "/api/lessons/min-lektion", { lesson: { id: "min-lektion", title: "x", area: "tal", prerequisites: [], exercise: { answer: ["1"], feedback: [] } } });
  ok(r.status === 403, "a caregiver cannot edit lessons");

  r = await K.call("POST", "/api/register", { role: "student", username: "barnW1", displayName: "Lo", password: "hemligt-123", classCode: family.code });
  ok(r.status === 201 && r.json.user.guide === "caregiver", "a child joins with the code and is told the guide is a caregiver");
  r = await K.call("GET", "/api/me");
  ok(r.json.user.guide === "caregiver", "/api/me tells the child too");
  r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "barnW2", displayName: "Alva", password: "hemligt-123" });
  ok(r.status === 201, "the caregiver makes the account of a child");
  r = await K2.call("POST", "/api/login", { username: "barnW2", password: "hemligt-123" });
  ok(r.status === 200 && r.json.user.role === "student" && r.json.user.guide === "caregiver", "the child signs in");
  r = await K2.call("POST", "/api/teacher/students", { classId: family.id, username: "barnW9", displayName: "X", password: "hemligt-123" });
  ok(r.status === 403, "a child cannot make accounts");

  r = await C.call("GET", "/api/teacher/students");
  const lo = r.json.students.find((s) => s.username === "barnW1");
  ok(r.json.students.length === 2, "the caregiver sees both children");
  r = await C.call("POST", "/api/teacher/feedback", { studentId: lo.id, text: "Bra!", sticker: "star" });
  ok(r.status === 201, "a cheer is sent");
  r = await C.call("POST", "/api/teacher/assignments", { classId: family.id, lessonId: "addition" });
  ok(r.status === 201, "an assignment is made");
  r = await K.call("POST", "/api/me/chat", { text: "Hjälp" });
  r = await C.call("GET", "/api/teacher/chat/unread");
  ok(r.json.unread === 1, "a question from the child arrives");

  r = await C2.call("POST", "/api/register", { role: "caregiver", username: "vardnadW2", displayName: "Per Svensson", password: "hemligt-123" });
  r = await C2.call("GET", "/api/teacher/students");
  ok(r.json.students.length === 0, "another caregiver sees no children");
  r = await C2.call("POST", "/api/teacher/students", { classId: family.id, username: "intrangW", displayName: "X", password: "hemligt-123" });
  ok(r.status === 400, "and cannot add one to this family");

  r = await T.call("POST", "/api/register", { role: "teacher", username: "lararW", displayName: "Fröken", password: "hemligt-123", teacherCode: "TESTCODE12" });
  ok(r.status === 201 && r.json.user.role === "teacher", "a teacher registers with the code as before");

  let made = 2;
  for (let i = 3; i <= 12; i++) {
    r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "barnW" + (10 + i), displayName: "Barn " + i, password: "hemligt-123" });
    if (r.status === 201) made++;
  }
  ok(made === 10 && r.status === 400, "a family has room for ten children");

  r = await C.call("POST", "/api/me/delete", { password: "hemligt-123" });
  ok(r.status === 200, "the caregiver deletes the account");
  ok(count("SELECT COUNT(*) AS n FROM users WHERE username LIKE 'barnW%' OR username = 'vardnadW'") === 0 && count("SELECT COUNT(*) AS n FROM classes WHERE name = 'Familjen Andersson'") === 0,
    "the family and the children are gone with it");

  // a database from before the column: caregivers are told to run the migration, the rest works
  const old = setup(schema.replace(/,\s*\n\s*caregiver[^\n]*\n/, "\n"));
  ok(!/caregiver\s+INTEGER/.test(schema.replace(/,\s*\n\s*caregiver[^\n]*\n/, "\n")), "set-up: the old schema has no column caregiver");
  const OC = old.who(), OS = old.who(), OT = old.who();
  r = await OC.call("POST", "/api/register", { role: "caregiver", username: "gammalW", displayName: "Gamla Databasen", password: "hemligt-123" });
  ok(r.status === 503 && /006-caregiver/.test(r.json.error), "an old database tells how to update it (" + r.status + " " + JSON.stringify(r.json) + ")");
  r = await OT.call("POST", "/api/register", { role: "teacher", username: "gammalL", displayName: "Fröken", password: "hemligt-123", teacherCode: "TESTCODE12" });
  const cls = (await OT.call("POST", "/api/teacher/classes", { name: "4A" })).json["class"];
  r = await OS.call("POST", "/api/register", { role: "student", username: "gammalE", displayName: "Elev", password: "hemligt-123", classCode: cls.code });
  ok(r.status === 201 && r.json.user.guide === "teacher", "teachers and students still work on it");

  console.log(failures ? "\n" + failures + " FAILED" : "\nAll worker caregiver checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
