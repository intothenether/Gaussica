"use strict";
// usage: node assign-test.js <base> <token|cookie> <teacherCode>
const BASE = process.argv[2];
const MODE = process.argv[3] || "token";
const TEACHER_CODE = process.argv[4] || "LARARE1";
const ORIGIN = process.argv[5] || "http://localhost:8000";
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function who() {
  const jar = { token: null, cookie: null };
  return {
    async call(method, path, body) {
      const headers = { "Content-Type": "application/json", Origin: MODE === "cookie" ? BASE : ORIGIN };
      if (jar.token) headers.Authorization = "Bearer " + jar.token;
      if (jar.cookie) headers.Cookie = jar.cookie;
      const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc && /^gs=[^;]+/.test(sc)) jar.cookie = sc.split(";")[0];
      let json = null; try { json = await res.json(); } catch (e) {}
      if (json && json.token) jar.token = json.token;
      return { status: res.status, json };
    }
  };
}

(async () => {
  const T = who(), S = who(), S2 = who(), X = who();
  let r = await T.call("POST", "/api/register", { role: "teacher", username: "lararA", displayName: "Fröken Anna", password: "hemligt-123", teacherCode: TEACHER_CODE });
  ok(r.status === 201, "teacher registered");
  r = await T.call("POST", "/api/teacher/classes", { name: "3A" }); const cls = r.json["class"];
  r = await S.call("POST", "/api/register", { role: "student", username: "elevA", displayName: "Eli", password: "hemligt-123", classCode: cls.code });
  ok(r.status === 201, "student 1 registered");
  r = await S2.call("POST", "/api/register", { role: "student", username: "elevB", displayName: "Ola", password: "hemligt-123", classCode: cls.code });
  const s2id = r.json.user.id;
  r = await T.call("GET", "/api/teacher/students"); const st1 = r.json.students.find(s => s.username === "elevA");
  ok(Array.isArray(st1.feedback) && st1.feedback.length === 0, "teacher students carry a feedback list");

  // assignments
  r = await X.call("POST", "/api/register", { role: "teacher", username: "lararB", displayName: "Annan", password: "hemligt-123", teacherCode: TEACHER_CODE });
  const other = await X.call("POST", "/api/teacher/classes", { name: "9Z" });
  r = await T.call("POST", "/api/teacher/assignments", { classId: other.json["class"].id, lessonId: "addition" });
  ok(r.status === 400, "cannot assign to someone else's class");
  r = await T.call("POST", "/api/teacher/assignments", { classId: cls.id, lessonId: "addition", dueDate: "2026-13-45" });
  ok(r.status === 400, "bad date rejected");
  r = await T.call("POST", "/api/teacher/assignments", { classId: cls.id, lessonId: "addition", dueDate: "2026-11-05", note: "Ta det lugnt!" });
  ok(r.status === 201, "class assignment created"); const aid = r.json.id;
  r = await T.call("POST", "/api/teacher/assignments", { classId: cls.id, studentId: st1.id, lessonId: "subtraktion", note: "Bara till Eli" });
  ok(r.status === 201, "personal assignment created");
  r = await S.call("GET", "/api/me/data");
  ok(r.json.assignments.length === 2 && r.json.assignments[0].dueDate === "2026-11-05" && r.json.assignments[0].teacher === "Fröken Anna", "student 1 sees both, sorted by due date, with teacher name");
  r = await S2.call("GET", "/api/me/data");
  ok(r.json.assignments.length === 1 && r.json.assignments[0].lessonId === "addition", "student 2 sees only the class assignment");
  r = await T.call("GET", "/api/teacher/assignments");
  ok(r.json.assignments.length === 2 && r.json.assignments.some(a => a.studentName === "Eli") && r.json.assignments[0].className === "3A", "teacher list has class and student names");
  r = await X.call("DELETE", "/api/teacher/assignments/" + aid);
  r = await S2.call("GET", "/api/me/data");
  ok(r.json.assignments.length === 1, "another teacher cannot archive it");
  r = await T.call("DELETE", "/api/teacher/assignments/" + aid);
  r = await S2.call("GET", "/api/me/data");
  ok(r.json.assignments.length === 0, "archived assignment disappears for students");
  r = await S.call("POST", "/api/teacher/assignments", { classId: cls.id, lessonId: "addition" });
  ok(r.status === 403, "student cannot assign");

  // kinds and rewards
  r = await T.call("POST", "/api/teacher/assignments", { classId: cls.id, lessonId: "multiplikation", kind: "practice", note: "Öva lite" });
  ok(r.status === 201, "practice assignment created");
  r = await S.call("GET", "/api/me/data");
  ok(r.json.assignments.some(a => a.lessonId === "multiplikation" && a.kind === "practice") && r.json.assignments.some(a => a.lessonId === "subtraktion" && a.kind === "lesson"), "assignment kind reaches the student");
  r = await S.call("GET", "/api/me");
  ok(r.json.user.rewards === true, "rewards are on by default");
  r = await X.call("PUT", "/api/teacher/classes/" + cls.id, { rewards: false });
  ok(r.status === 404, "other teacher cannot change the class setting");
  r = await T.call("PUT", "/api/teacher/classes/" + cls.id, { rewards: false });
  ok(r.status === 200, "teacher switches rewards off");
  r = await S.call("GET", "/api/me");
  ok(r.json.user.rewards === false, "student sees rewards off");
  r = await T.call("GET", "/api/teacher/classes");
  ok(r.json.classes[0].rewards === false, "class list shows rewards off");
  r = await T.call("PUT", "/api/teacher/classes/" + cls.id, { rewards: true });
  r = await S.call("GET", "/api/me");
  ok(r.json.user.rewards === true, "rewards on again");

  // feedback
  r = await T.call("POST", "/api/teacher/feedback", { studentId: st1.id, text: "" });
  ok(r.status === 400, "empty feedback rejected");
  r = await T.call("POST", "/api/teacher/feedback", { studentId: st1.id, sticker: "banana" });
  ok(r.status === 400, "unknown sticker rejected");
  r = await X.call("POST", "/api/teacher/feedback", { studentId: st1.id, text: "hej" });
  ok(r.status === 404, "other teacher cannot write to the student");
  r = await T.call("POST", "/api/teacher/feedback", { studentId: st1.id, lessonId: "addition", taskId: "exercise", text: "Bra tänkt! Kolla minnessiffran.", sticker: "star" });
  ok(r.status === 201, "feedback on a task sent"); const fid = r.json.id;
  r = await T.call("POST", "/api/teacher/feedback", { studentId: st1.id, text: "Kul att se dig i dag" });
  ok(r.status === 201, "general feedback sent");
  r = await S.call("GET", "/api/me/data");
  ok(r.json.feedback.length === 2 && r.json.feedback[0].read === false && r.json.feedback.some(f => f.taskId === "exercise" && f.sticker === "star" && f.teacher === "Fröken Anna"), "student sees feedback, unread, newest first");
  r = await S2.call("GET", "/api/me/data");
  ok(r.json.feedback.length === 0, "other students do not see it");
  r = await S2.call("POST", "/api/me/feedback/read", { ids: [fid] });
  r = await S.call("GET", "/api/me/data");
  ok(r.json.feedback.every(f => !f.read), "another student cannot mark it read");
  r = await S.call("POST", "/api/me/feedback/read", { ids: [fid] });
  r = await S.call("GET", "/api/me/data");
  ok(r.json.feedback.find(f => f.id === fid).read === true && r.json.feedback.filter(f => !f.read).length === 1, "marking read works");
  r = await T.call("GET", "/api/teacher/students"); const t1 = r.json.students.find(s => s.username === "elevA");
  ok(t1.feedback.length === 2 && t1.feedback.find(f => f.id === fid).read === true, "teacher sees read status");
  r = await X.call("DELETE", "/api/teacher/feedback/" + fid);
  r = await T.call("GET", "/api/teacher/students");
  ok(r.json.students.find(s => s.username === "elevA").feedback.length === 2, "other teacher cannot delete it");
  r = await T.call("DELETE", "/api/teacher/feedback/" + fid);
  r = await S.call("GET", "/api/me/data");
  ok(r.json.feedback.length === 1, "teacher can delete feedback");

  // cleanup removes the student's data
  r = await T.call("DELETE", "/api/teacher/students/" + st1.id);
  ok(r.status === 200, "student deleted");
  r = await T.call("GET", "/api/teacher/assignments");
  ok(r.json.assignments.every(a => !a.studentId), "personal assignment removed with the student");

  console.log(failures ? failures + " FAILED" : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})();
