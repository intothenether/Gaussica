"use strict";
// Caregiver accounts (vårdnadshavare): a teacher account with a family as the class, that cannot edit lessons.
// usage: node tests/api-caregiver.js <base> cookie <teacherCode>
const BASE = process.argv[2];
const TEACHER_CODE = process.argv[4] || "LARARE1";
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function who() {
  const jar = { cookie: null };
  return {
    async call(method, path, body) {
      const headers = { "Content-Type": "application/json", Origin: BASE };
      if (jar.cookie) headers.Cookie = jar.cookie;
      const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get("set-cookie");
      if (sc && /^gs=[^;]+/.test(sc)) jar.cookie = sc.split(";")[0];
      let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
      return { status: res.status, json };
    }
  };
}

(async () => {
  const C = who(), C2 = who(), K = who(), T = who(), K2 = who();

  let r = await C.call("POST", "/api/register", { role: "caregiver", username: "vardnad1", displayName: "Maria Andersson", password: "hemligt-123" });
  ok(r.status === 201 && r.json.user.role === "caregiver", "a caregiver registers without any code, and is told the role caregiver");
  r = await C.call("GET", "/api/me");
  ok(r.json.user.role === "caregiver", "/api/me says caregiver");

  r = await C.call("GET", "/api/teacher/classes");
  ok(r.json.classes.length === 1 && r.json.classes[0].name === "Familjen Andersson" && /^[A-Z0-9]{6}$/.test(r.json.classes[0].code), "the family is made at once, with a code");
  const family = r.json.classes[0];
  r = await C.call("POST", "/api/teacher/classes", { name: "Till" });
  ok(r.status === 400, "a caregiver has one family only");

  r = await C.call("PUT", "/api/lessons/min-lektion", { lesson: { id: "min-lektion", title: "x", area: "tal", prerequisites: [], exercise: { answer: ["1"], feedback: [] } } });
  ok(r.status === 403, "a caregiver cannot edit lessons");

  // children join with the family code
  r = await K.call("POST", "/api/register", { role: "student", username: "barn.ett", displayName: "Lo Andersson", password: "hemligt-123", classCode: family.code });
  ok(r.status === 201 && r.json.user.className === "Familjen Andersson" && r.json.user.guide === "caregiver", "a child joins with the family code and is told the guide is a caregiver");
  r = await K.call("GET", "/api/me");
  ok(r.json.user.guide === "caregiver", "/api/me tells the child too");

  // or the caregiver makes the account
  r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "barn.tva", displayName: "Alva Andersson", password: "hemligt-123" });
  ok(r.status === 201 && r.json.student.name === "Alva Andersson", "the caregiver makes the account of a child");
  r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "barn.tva", displayName: "Alva", password: "hemligt-123" });
  ok(r.status === 409, "a taken user name is refused");
  r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "barn.tre", displayName: "Tre", password: "kort" });
  ok(r.status === 400, "a short password is refused");
  const K2login = await K2.call("POST", "/api/login", { username: "barn.tva", password: "hemligt-123" });
  ok(K2login.status === 200 && K2login.json.user.role === "student" && K2login.json.user.className === "Familjen Andersson", "the child can sign in with it");

  r = await C.call("GET", "/api/teacher/students");
  ok(r.json.students.length === 2, "the caregiver sees both children");
  const lo = r.json.students.find((s) => s.username === "barn.ett");

  // what a teacher can do with a class, a caregiver can do with the family
  r = await C.call("POST", "/api/teacher/feedback", { studentId: lo.id, text: "Bra jobbat!", sticker: "star" });
  ok(r.status === 201, "a cheer (a sticker and a text) is sent");
  r = await K.call("GET", "/api/me/data");
  ok(r.json.feedback.length === 1 && r.json.feedback[0].sticker === "star", "the child gets it");
  r = await C.call("POST", "/api/teacher/assignments", { classId: family.id, studentId: lo.id, lessonId: "addition", note: "Gör den här i helgen" });
  ok(r.status === 201, "an assignment is made");
  r = await K.call("POST", "/api/me/chat", { text: "Hur gör man?" });
  ok(r.status === 201, "the child writes to the caregiver");
  r = await C.call("GET", "/api/teacher/chat/unread");
  ok(r.json.unread === 1, "the caregiver has one unread message");
  r = await C.call("POST", "/api/teacher/chat", { studentId: lo.id, text: "Vi tittar på det ihop" });
  ok(r.status === 201, "the caregiver answers");
  r = await C.call("POST", "/api/teacher/students/" + lo.id + "/password");
  ok(r.status === 200 && r.json.password, "a new password can be made for a child");

  // somebody else's family is out of sight
  r = await C2.call("POST", "/api/register", { role: "caregiver", username: "vardnad2", displayName: "Per Svensson", password: "hemligt-123" });
  r = await C2.call("GET", "/api/teacher/students");
  ok(r.json.students.length === 0, "another caregiver sees none of the children");
  r = await C2.call("POST", "/api/teacher/feedback", { studentId: lo.id, text: "hej" });
  ok(r.status === 404, "and cannot write to them");
  r = await C2.call("POST", "/api/teacher/students", { classId: family.id, username: "intrang", displayName: "X", password: "hemligt-123" });
  ok(r.status === 400, "nor add a child to a family that is not theirs");

  // a teacher can still do everything, and a student cannot use the teacher endpoints
  r = await T.call("POST", "/api/register", { role: "teacher", username: "vardLarare", displayName: "Fröken", password: "hemligt-123", teacherCode: TEACHER_CODE });
  ok(r.status === 201 && r.json.user.role === "teacher", "a teacher registers with the code as before");
  r = await K2.call("POST", "/api/teacher/students", { classId: family.id, username: "ny.elev", displayName: "Ny", password: "hemligt-123" });
  ok(r.status === 403, "a student cannot make accounts");

  // a family has room for ten
  let made = 2;
  for (let i = 3; i <= 12; i++) {
    r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "barn.n" + i, displayName: "Barn " + i, password: "hemligt-123" });
    if (r.status === 201) made++;
  }
  ok(made === 10 && r.status === 400, "a family has room for ten children");
  r = await who().call("POST", "/api/register", { role: "student", username: "barn.elva", displayName: "Elva", password: "hemligt-123", classCode: family.code });
  ok(r.status === 400, "and the code no longer lets another one in");

  // deleting the caregiver deletes the family
  r = await C.call("POST", "/api/me/delete", { password: "hemligt-123" });
  ok(r.status === 200, "the caregiver deletes the account");
  r = await K2.call("POST", "/api/login", { username: "barn.tva", password: "hemligt-123" });
  ok(r.status === 401, "and the children are gone with it");

  console.log(failures ? "\n" + failures + " FAILED" : "\nAll caregiver checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
