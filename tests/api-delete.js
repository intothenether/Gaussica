"use strict";
// Deleting data: a student deleting their own account, a teacher deleting a class, a teacher deleting their account.
// Everything that belongs to the people removed must be gone from the database, and nobody else's data touched.
// usage: node tests/api-delete.js <base> cookie <teacherCode>   (TEST_DATA_DIR is the folder of the test database)
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const BASE = process.argv[2];
const TEACHER_CODE = process.argv[4] || "LARARE1";
const DATA_DIR = process.env.TEST_DATA_DIR;
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function who() {
  const jar = { cookie: null };
  return {
    async call(method, p, body) {
      const headers = { "Content-Type": "application/json", Origin: BASE };
      if (jar.cookie) headers.Cookie = jar.cookie;
      const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc && /^gs=/.test(sc)) jar.cookie = sc.split(";")[0];
      let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
      return { status: res.status, json };
    }
  };
}

function count(db, sql, ...args) { return db.prepare(sql).get(...args).n; }

(async () => {
  const db = new DatabaseSync(path.join(DATA_DIR, "gaussica.db"), { readOnly: true });
  const T1 = who(), T2 = who(), S1 = who(), S2 = who(), S3 = who(), S4 = who();
  let r = await T1.call("POST", "/api/register", { role: "teacher", username: "lararX", displayName: "Fröken Xenia", password: "hemligt-123", teacherCode: TEACHER_CODE });
  ok(r.status === 201, "teacher 1 registered");
  const clsA = (await T1.call("POST", "/api/teacher/classes", { name: "4A" })).json["class"];
  const clsB = (await T1.call("POST", "/api/teacher/classes", { name: "4B" })).json["class"];
  await T2.call("POST", "/api/register", { role: "teacher", username: "lararY", displayName: "Herr Yngve", password: "hemligt-123", teacherCode: TEACHER_CODE });
  const clsC = (await T2.call("POST", "/api/teacher/classes", { name: "9C" })).json["class"];

  const make = async (agent, username, name, cls) => {
    const res = await agent.call("POST", "/api/register", { role: "student", username, displayName: name, password: "hemligt-123", classCode: cls.code });
    ok(res.status === 201, name + " registered");
    return res.json.user.id;
  };
  const id1 = await make(S1, "elevX1", "Alva", clsA);
  const id2 = await make(S2, "elevX2", "Bo", clsA);
  const id3 = await make(S3, "elevX3", "Cleo", clsB);
  const id4 = await make(S4, "elevX4", "Dan", clsC);

  // give every student some data of every kind
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
  ok(count(db, "SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Alva (%'") === 1, "set-up: feedback from Alva is stored with her name");

  // ----- a student deletes their own account -----
  r = await S1.call("POST", "/api/me/delete", { password: "fel-losenord" });
  ok(r.status === 400, "the wrong password does not delete the account");
  r = await S1.call("POST", "/api/me/delete", {});
  ok(r.status === 400, "no password does not delete the account");
  ok(count(db, "SELECT COUNT(*) AS n FROM users WHERE id = ?", id1) === 1, "the account is still there after refused attempts");
  r = await S1.call("POST", "/api/me/delete", { password: "hemligt-123" });
  ok(r.status === 200, "the right password deletes the account");
  r = await S1.call("GET", "/api/me");
  ok(r.json && r.json.user === null, "the session is gone");
  r = await who().call("POST", "/api/login", { username: "elevX1", password: "hemligt-123" });
  ok(r.status === 401, "the deleted student cannot sign in");
  const rowsFor = (id) => ["progress", "attempts", "sessions"].reduce((n, t) => n + count(db, "SELECT COUNT(*) AS n FROM " + t + " WHERE user_id = ?", id), 0)
    + count(db, "SELECT COUNT(*) AS n FROM chat WHERE student_id = ?", id) + count(db, "SELECT COUNT(*) AS n FROM feedback WHERE student_id = ?", id)
    + count(db, "SELECT COUNT(*) AS n FROM users WHERE id = ?", id);
  ok(rowsFor(id1) === 0, "no rows left for the deleted student");
  ok(count(db, "SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Alva (%'") === 0, "the deleted student's feedback messages are gone");
  ok(rowsFor(id2) > 0 && count(db, "SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Bo (%'") === 1, "the classmate's data is untouched");
  r = await T1.call("GET", "/api/teacher/students");
  ok(r.json.students.length === 2 && !r.json.students.some((s) => s.username === "elevX1"), "the teacher no longer lists the student");

  // ----- a teacher deletes a class -----
  r = await T2.call("DELETE", "/api/teacher/classes/" + clsB.id);
  ok(r.status === 404, "another teacher cannot delete the class");
  ok(count(db, "SELECT COUNT(*) AS n FROM classes WHERE id = ?", clsB.id) === 1 && rowsFor(id3) > 0, "the class and its student are still there");
  r = await T1.call("DELETE", "/api/teacher/classes/" + clsB.id);
  ok(r.status === 200 && r.json.students === 1, "the teacher deletes the class (one student)");
  ok(count(db, "SELECT COUNT(*) AS n FROM classes WHERE id = ?", clsB.id) === 0, "the class is gone");
  ok(rowsFor(id3) === 0 && count(db, "SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?", clsB.id) === 0, "the student's data and the class assignments are gone");
  ok(count(db, "SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Cleo (%'") === 0, "the student's feedback messages are gone");
  ok(count(db, "SELECT COUNT(*) AS n FROM classes WHERE id = ?", clsA.id) === 1 && rowsFor(id2) > 0, "the other class is untouched");

  // ----- a teacher deletes their account -----
  r = await T1.call("POST", "/api/me/delete", { password: "fel-losenord" });
  ok(r.status === 400, "a teacher needs the right password too");
  r = await T1.call("POST", "/api/me/delete", { password: "hemligt-123" });
  ok(r.status === 200, "the teacher account is deleted");
  ok(count(db, "SELECT COUNT(*) AS n FROM users WHERE username IN ('lararX', 'elevX1', 'elevX2', 'elevX3')") === 0, "the teacher and all their students are gone");
  ok(rowsFor(id2) === 0 && count(db, "SELECT COUNT(*) AS n FROM classes WHERE teacher_id IN (SELECT id FROM users WHERE username = 'lararX')") === 0, "no rows left for the students or the classes");
  ok(count(db, "SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Bo (%' OR sender LIKE 'Fröken Xenia (%'") === 0, "feedback messages from the deleted people are gone");
  ok(count(db, "SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?", clsA.id) === 0 && count(db, "SELECT COUNT(*) AS n FROM class_settings WHERE class_id = ?", clsA.id) === 0, "assignments and settings of the classes are gone");

  // ----- everything of the other teacher is intact -----
  ok(rowsFor(id4) > 0 && count(db, "SELECT COUNT(*) AS n FROM classes WHERE id = ?", clsC.id) === 1, "the other teacher's class and student are untouched");
  ok(count(db, "SELECT COUNT(*) AS n FROM assignments WHERE class_id = ?", clsC.id) === 1, "the other teacher's assignment is untouched");
  ok(count(db, "SELECT COUNT(*) AS n FROM site_feedback WHERE sender LIKE 'Dan (%'") === 1, "the other student's feedback message is untouched");
  r = await T2.call("GET", "/api/teacher/students");
  ok(r.status === 200 && r.json.students.length === 1, "the other teacher still sees their student");

  db.close();
  console.log(failures ? failures + " FAILED" : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})();
