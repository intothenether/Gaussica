"use strict";
// The same deletion checks as tests/api-delete.js, run against the Cloudflare worker. The worker's database (D1) is
// stood in for by node:sqlite with cloudflare/schema.sql, so the SQL the worker sends is really executed.
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
    // like D1: all statements or none
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

  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(path.join(ROOT, "cloudflare", "schema.sql"), "utf8"));
  const env = { DB: d1(db), TEACHER_CODE: "TESTCODE12", ALLOWED_ORIGINS: "https://test.example" };

  function who() {
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
  }
  const count = (sql, ...args) => db.prepare(sql).get(...args).n;

  const T1 = who(), T2 = who(), S1 = who(), S2 = who(), S3 = who(), S4 = who();
  await T1.call("POST", "/api/register", { role: "teacher", username: "lararX", displayName: "Fröken Xenia", password: "hemligt-123", teacherCode: "TESTCODE12" });
  const clsA = (await T1.call("POST", "/api/teacher/classes", { name: "4A" })).json["class"];
  const clsB = (await T1.call("POST", "/api/teacher/classes", { name: "4B" })).json["class"];
  await T2.call("POST", "/api/register", { role: "teacher", username: "lararY", displayName: "Herr Yngve", password: "hemligt-123", teacherCode: "TESTCODE12" });
  const clsC = (await T2.call("POST", "/api/teacher/classes", { name: "9C" })).json["class"];
  const make = async (agent, username, name, cls) => {
    const res = await agent.call("POST", "/api/register", { role: "student", username, displayName: name, password: "hemligt-123", classCode: cls.code });
    if (res.status !== 201) throw new Error("register failed: " + JSON.stringify(res.json));
    return res.json.user.id;
  };
  const id1 = await make(S1, "elevX1", "Alva", clsA);
  const id2 = await make(S2, "elevX2", "Bo", clsA);
  const id3 = await make(S3, "elevX3", "Cleo", clsB);
  const id4 = await make(S4, "elevX4", "Dan", clsC);

  const fill = async (agent, teacher, id, text) => {
    await agent.call("PUT", "/api/progress/addition", { data: { answers: { t1: { value: "5" } }, updatedAt: 1 } });
    await agent.call("POST", "/api/attempts", { lessonId: "addition", taskId: "t1", feedbackType: "correct", answer: "5" });
    await agent.call("POST", "/api/me/chat", { text: "Hjälp med " + text });
    await agent.call("POST", "/api/feedback", { kind: "annat", text: "Hej från " + text });
    await teacher.call("POST", "/api/teacher/feedback", { studentId: id, text: "Bra jobbat " + text });
  };
  await fill(S1, T1, id1, "Alva");
  await fill(S2, T1, id2, "Bo");
  await fill(S3, T1, id3, "Cleo");
  await fill(S4, T2, id4, "Dan");
  await T1.call("POST", "/api/teacher/assignments", { classId: clsA.id, lessonId: "addition" });
  await T1.call("POST", "/api/teacher/assignments", { classId: clsB.id, lessonId: "addition" });
  await T2.call("POST", "/api/teacher/assignments", { classId: clsC.id, lessonId: "addition" });
  const rowsFor = (id) => ["progress", "attempts", "sessions"].reduce((n, t) => n + count("SELECT COUNT(*) AS n FROM " + t + " WHERE user_id = ?", id), 0)
    + count("SELECT COUNT(*) AS n FROM chat WHERE student_id = ?", id) + count("SELECT COUNT(*) AS n FROM feedback WHERE student_id = ?", id)
    + count("SELECT COUNT(*) AS n FROM users WHERE id = ?", id);
  const mail = (name) => count("SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE ?", name + " (%");
  ok(rowsFor(id1) > 4 && mail("Alva") === 1, "set-up: the student has data of every kind");

  let r = await S1.call("POST", "/api/me/delete", { password: "fel-losenord" });
  ok(r.status === 400 && rowsFor(id1) > 0, "the wrong password does not delete the account");
  r = await S1.call("POST", "/api/me/delete", { password: "hemligt-123" });
  ok(r.status === 200, "the right password deletes the account");
  ok(rowsFor(id1) === 0 && mail("Alva") === 0, "no rows and no feedback messages left for the student");
  ok(rowsFor(id2) > 0 && mail("Bo") === 1, "the classmate's data is untouched");

  r = await T2.call("DELETE", "/api/teacher/classes/" + clsB.id);
  ok(r.status === 404 && rowsFor(id3) > 0, "another teacher cannot delete the class");
  r = await T1.call("DELETE", "/api/teacher/classes/" + clsB.id);
  ok(r.status === 200 && r.json.students === 1, "the teacher deletes the class");
  ok(rowsFor(id3) === 0 && mail("Cleo") === 0 && count("SELECT COUNT(*) AS n FROM classes WHERE id = ?", clsB.id) === 0 && count("SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?", clsB.id) === 0,
    "the class, its student, their messages and assignments are gone");
  ok(count("SELECT COUNT(*) AS n FROM classes WHERE id = ?", clsA.id) === 1 && rowsFor(id2) > 0, "the other class is untouched");

  r = await T1.call("POST", "/api/me/delete", { password: "hemligt-123" });
  ok(r.status === 200, "the teacher account is deleted");
  ok(count("SELECT COUNT(*) AS n FROM users WHERE username IN ('lararX', 'elevX1', 'elevX2', 'elevX3')") === 0 && rowsFor(id2) === 0, "the teacher and all their students are gone");
  ok(mail("Bo") === 0 && count("SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Fröken Xenia (%'") === 0, "feedback messages from the deleted people are gone");
  ok(count("SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?", clsA.id) === 0 && count("SELECT COUNT(*) AS n FROM class_settings WHERE class_id = ?", clsA.id) === 0
    && count("SELECT COUNT(*) AS n FROM classes WHERE teacher_id NOT IN (SELECT id FROM users)") === 0, "classes, assignments and settings are gone");
  ok(rowsFor(id4) > 0 && mail("Dan") === 1 && count("SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?", clsC.id) === 1, "the other teacher's class, student and assignment are untouched");
  r = await T2.call("GET", "/api/teacher/students");
  ok(r.status === 200 && r.json.students.length === 1, "the other teacher still sees their student");

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* still in use */ }
  console.log(failures ? failures + " FAILED" : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
