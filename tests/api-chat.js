"use strict";
// Chat between a student and the teacher of their class.
// usage: node tests/api-chat.js <base> cookie <teacherCode>
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
  const T = who(), S = who(), S2 = who(), X = who();
  let r = await T.call("POST", "/api/register", { role: "teacher", username: "chatLarare", displayName: "Fröken Chat", password: "hemligt-123", teacherCode: TEACHER_CODE });
  ok(r.status === 201, "teacher registered");
  const cls = (await T.call("POST", "/api/teacher/classes", { name: "4B" })).json["class"];
  r = await S.call("POST", "/api/register", { role: "student", username: "chatElev", displayName: "Kim Elev", password: "hemligt-123", classCode: cls.code });
  r = await S2.call("POST", "/api/register", { role: "student", username: "chatElev2", displayName: "Ola Elev", password: "hemligt-123", classCode: cls.code });
  await X.call("POST", "/api/register", { role: "teacher", username: "chatAnnan", displayName: "Annan", password: "hemligt-123", teacherCode: TEACHER_CODE });
  const kim = (await T.call("GET", "/api/teacher/students")).json.students.find((s) => s.username === "chatElev");
  ok(Array.isArray(kim.chat) && kim.chat.length === 0, "teacher students carry a chat list");

  r = await S.call("POST", "/api/me/chat", { text: "   " });
  ok(r.status === 400, "an empty message is rejected");
  r = await T.call("POST", "/api/me/chat", { text: "Hej" });
  ok(r.status === 403, "a teacher cannot use the student endpoint");
  r = await S.call("POST", "/api/me/chat", {
    text: "Jag förstår inte hur jag ska börja", lessonId: "addition", taskId: "word-0",
    context: { prompt: "Mira har 5 äpplen och får 3 till. Hur många har hon?", answer: "53", lessonTitle: "Addition", taskName: "Textuppgift 1", tries: 2, status: "fix", evil: "<script>" }
  });
  ok(r.status === 201, "student sends a question with context");
  r = await S.call("POST", "/api/me/chat", { text: "x", lessonId: "../etc" });
  ok(r.status === 400, "a bad lesson id is rejected");

  r = await T.call("GET", "/api/teacher/students");
  let k = r.json.students.find((s) => s.username === "chatElev");
  ok(k.chat.length === 1 && k.chat[0].fromTeacher === false && k.chat[0].read === false, "teacher sees the message as unread");
  ok(k.chat[0].context.prompt.startsWith("Mira har 5") && k.chat[0].context.answer === "53" && k.chat[0].context.status === "fix" && k.chat[0].context.tries === 2 && k.chat[0].context.evil === undefined,
    "the problem the student was working on arrives with the message (and nothing extra)");
  ok(k.chat[0].lessonId === "addition" && k.chat[0].taskId === "word-0", "lesson and task ids are stored");
  r = await T.call("GET", "/api/teacher/chat/unread");
  ok(r.json.unread === 1, "unread counter is 1");
  r = await X.call("GET", "/api/teacher/students");
  ok(r.json.students.length === 0, "another teacher sees nothing");
  r = await X.call("POST", "/api/teacher/chat", { studentId: kim.id, text: "Hej" });
  ok(r.status === 404, "another teacher cannot answer");
  r = await S2.call("GET", "/api/me/data");
  ok(Array.isArray(r.json.chat) && r.json.chat.length === 0, "another student does not see it");

  r = await T.call("POST", "/api/teacher/chat", { studentId: kim.id, text: "Börja med att rita äpplena!" });
  ok(r.status === 201, "teacher answers");
  r = await T.call("GET", "/api/teacher/chat/unread");
  ok(r.json.unread === 0, "answering marks the question as read");
  r = await S.call("GET", "/api/me/data");
  ok(r.json.chat.length === 2 && r.json.chat[1].fromTeacher === true && r.json.chat[1].read === false, "student sees the answer, in order, unread");
  r = await S.call("POST", "/api/me/chat/read", {});
  r = await S.call("GET", "/api/me/data");
  ok(r.json.chat.every((m) => m.read), "student marks the answer as read");

  // a student cannot flood the teacher
  for (let i = 0; i < 6; i++) r = await S.call("POST", "/api/me/chat", { text: "fråga " + i });
  r = await S.call("POST", "/api/me/chat", { text: "en till" });
  ok(r.status === 429, "too many unanswered messages are refused");
  r = await T.call("POST", "/api/teacher/chat/read", { studentId: kim.id });
  ok(r.status === 200, "teacher marks as read");
  r = await T.call("GET", "/api/teacher/chat/unread");
  ok(r.json.unread === 0, "unread counter back to 0");
  r = await T.call("POST", "/api/teacher/chat", { studentId: kim.id, text: "Nu svarar jag på allt" });
  r = await S.call("POST", "/api/me/chat", { text: "Tack!" });
  ok(r.status === 201, "after an answer the student can write again");

  r = await T.call("DELETE", "/api/teacher/students/" + kim.id);
  ok(r.status === 200, "student deleted");
  r = await T.call("GET", "/api/teacher/students");
  ok(r.json.students.every((s) => !(s.chat || []).some((m) => String(m.studentId) === String(kim.id))), "the chat is removed with the student");

  console.log(failures ? failures + " FAILED" : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})();
