"use strict";
const base = process.env.TEST_BASE || "http://127.0.0.1:8123";
const TEACHER_CODE = process.env.TEST_TEACHER_CODE || "TESTCODE12";
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; console.log("FAIL:", name, extra === undefined ? "" : JSON.stringify(extra)); }
}

function client() {
  let cookie = "";
  return async function call(method, path, body, opts) {
    const headers = { "Content-Type": "application/json" };
    if (cookie) headers.Cookie = cookie;
    if (opts && opts.origin) headers.Origin = opts.origin;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
    let json = null;
    try { json = await res.json(); } catch (e) { /* not json */ }
    res.setCookie = sc;
    return { status: res.status, json, res };
  };
}

(async () => {
  const t1 = client(), t2 = client(), s1 = client(), s2 = client(), anon = client();

  // --- registration rules ---
  let r = await anon("POST", "/api/register", { role: "teacher", username: "lara", displayName: "Lära Lärare", password: "hemligt123", teacherCode: "WRONG" });
  check("teacher with wrong code rejected", r.status === 403, r);
  r = await t1("POST", "/api/register", { role: "teacher", username: "lara", displayName: "Lära Lärare", password: "hemligt123", teacherCode: "testcode-12" });
  check("teacher registers (code normalised)", r.status === 201 && r.json.user.role === "teacher", r);
  check("session cookie is HttpOnly+SameSite", /HttpOnly/.test(r.res.setCookie) && /SameSite=Lax/.test(r.res.setCookie), r.res.setCookie);
  r = await t2("POST", "/api/register", { role: "teacher", username: "Annan", displayName: "Annan Lärare", password: "hemligt123", teacherCode: TEACHER_CODE });
  check("second teacher", r.status === 201);

  r = await t1("GET", "/api/me");
  check("me returns teacher", r.json.user && r.json.user.username === "lara", r);

  r = await anon("POST", "/api/register", { role: "student", username: "elev1", displayName: "Elev Ett", password: "kort", classCode: "XXXXXX" });
  check("short password rejected", r.status === 400, r);
  r = await anon("POST", "/api/register", { role: "student", username: "elev1", displayName: "Elev Ett", password: "lösenord123", classCode: "NOPE00" });
  check("student with bad class code rejected", r.status === 400, r);
  r = await anon("POST", "/api/register", { role: "student", username: "a b", displayName: "x", password: "lösenord123", classCode: "NOPE00" });
  check("bad username rejected", r.status === 400, r);

  // --- classes ---
  r = await s1("GET", "/api/teacher/classes");
  check("anonymous cannot list classes", r.status === 401, r);
  r = await t1("POST", "/api/teacher/classes", { name: "Klass 5A" });
  check("teacher creates class", r.status === 201 && /^[A-Z0-9]{6}$/.test(r.json.class.code), r);
  const code5a = r.json.class.code;
  r = await t2("POST", "/api/teacher/classes", { name: "Klass 7B" });
  const code7b = r.json.class.code;

  // --- student registration ---
  r = await s1("POST", "/api/register", { role: "student", username: "Elev1", displayName: "Elev Ett", password: "lösenord123", classCode: code5a.toLowerCase() });
  check("student registers with class code", r.status === 201 && r.json.user.className === "Klass 5A" && r.json.user.role === "student", r);
  r = await s2("POST", "/api/register", { role: "student", username: "elev2", displayName: "Elev Två", password: "lösenord123", classCode: code7b });
  check("second student in other class", r.status === 201, r);
  r = await anon("POST", "/api/register", { role: "student", username: "ELEV1", displayName: "Dubbel", password: "lösenord123", classCode: code5a });
  check("duplicate username (case-insensitive) rejected", r.status === 409, r);

  // --- student cannot use teacher endpoints, cannot become teacher ---
  r = await s1("GET", "/api/teacher/students");
  check("student blocked from teacher students", r.status === 403, r);
  r = await s1("PUT", "/api/lessons/x", { lesson: { id: "x" } });
  check("student cannot save lessons", r.status === 403, r);

  // --- login / logout ---
  const l = client();
  r = await l("POST", "/api/login", { username: "elev1", password: "fel" });
  check("wrong password rejected (generic)", r.status === 401 && /Fel användarnamn eller lösenord/.test(r.json.error), r);
  r = await l("POST", "/api/login", { username: "finnsinte", password: "fel" });
  check("unknown user same message", r.status === 401 && /Fel användarnamn eller lösenord/.test(r.json.error), r);
  r = await l("POST", "/api/login", { username: "ELEV1", password: "lösenord123" });
  check("login ok (case-insensitive name)", r.status === 200 && r.json.user.name === "Elev Ett", r);
  r = await l("POST", "/api/logout");
  r = await l("GET", "/api/me");
  check("after logout no user", r.json.user === null, r);

  // --- progress + attempts ---
  r = await s1("PUT", "/api/progress/addition", { data: { started: true, answers: { exercise: { answer: "5", completed: false } }, interactive: {} } });
  check("save progress", r.status === 200, r);
  r = await s1("POST", "/api/attempts", { lessonId: "addition", lessonTitle: "Addition", taskId: "exercise", taskName: "Din tur", prompt: "2+2?", answer: "5", feedbackType: "hint", feedback: "Nej", misconception: "Fel", correctAnswer: "4", seconds: 12, completed: true });
  check("attempt saved; server decides completed + attemptNo", r.status === 201 && r.json.attempt.completed === false && r.json.attempt.attemptNo === 1, r);
  r = await s1("POST", "/api/attempts", { lessonId: "addition", taskId: "exercise", answer: "4", feedbackType: "correct", correctAnswer: "4", seconds: 5 });
  check("second attempt no=2", r.json.attempt.attemptNo === 2 && r.json.attempt.completed === true, r);
  r = await s1("POST", "/api/attempts", { lessonId: "addition", taskId: "exercise", answer: "4", feedbackType: "" });
  check("draft (no result) rejected", r.status === 400, r);
  r = await s1("GET", "/api/me/data");
  check("my data round trip", r.json.attempts.length === 2 && r.json.progress.addition.started === true, r);

  // --- teacher isolation ---
  r = await t1("GET", "/api/teacher/students");
  check("teacher 1 sees only own class student", r.json.students.length === 1 && r.json.students[0].username === "Elev1" && r.json.students[0].attempts.length === 2, r);
  check("student payload has no password hash", !JSON.stringify(r.json).includes("scrypt"), null);
  r = await t2("GET", "/api/teacher/students");
  check("teacher 2 sees only theirs", r.json.students.length === 1 && r.json.students[0].username === "elev2", r);
  const s1id = (await t1("GET", "/api/teacher/students")).json.students[0].id;
  r = await t2("POST", "/api/teacher/students/" + s1id + "/password");
  check("other teacher cannot reset student pw", r.status === 404, r);
  r = await t2("DELETE", "/api/teacher/students/" + s1id);
  check("other teacher cannot delete student", r.status === 404, r);
  r = await t1("POST", "/api/teacher/students/" + s1id + "/password");
  check("teacher resets own student's pw", r.status === 200 && r.json.password.length === 10, r);
  const temp = r.json.password;
  r = await s1("GET", "/api/me");
  check("reset logs student out", r.json.user === null, r);
  r = await l("POST", "/api/login", { username: "elev1", password: temp });
  check("login with temp password", r.status === 200, r);
  r = await l("POST", "/api/me/password", { current: temp, next: "nyttlosen99" });
  check("change password", r.status === 200, r);
  r = await l("POST", "/api/me/password", { current: "fel", next: "nyttlosen99" });
  check("change password needs current", r.status === 400, r);

  // --- lessons saved by teacher ---
  const lesson = { id: "ny-lektion", title: "Ny", area: "tal", prerequisites: [], exercise: { prompt: "?", answer: ["1"], feedback: [] }, wordProblems: [] };
  r = await t1("PUT", "/api/lessons/ny-lektion", { lesson });
  check("teacher saves lesson", r.status === 200, r);
  r = await t1("PUT", "/api/lessons/annat", { lesson });
  check("id mismatch rejected", r.status === 400, r);
  r = await t1("PUT", "/api/lessons/bad", { lesson: { id: "bad", title: "x" } });
  check("invalid lesson rejected", r.status === 400, r);
  r = await l("GET", "/api/lessons");
  check("student can read saved lessons", r.json.lessons.length === 1 && r.json.lessons[0].id === "ny-lektion", r);
  r = await anon("GET", "/api/lessons");
  check("lessons need login", r.status === 401, r);

  // --- csrf / content-type ---
  r = await t1("POST", "/api/teacher/classes", { name: "X" }, { origin: "http://evil.example" });
  check("cross-origin POST rejected", r.status === 403, r);
  const raw = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
  check("non-JSON content type rejected", raw.status === 415, raw.status);

  // --- brute force ---
  let blocked = false;
  for (let i = 0; i < 12; i++) {
    r = await anon("POST", "/api/login", { username: "elev2", password: "fel" + i });
    if (r.status === 429) { blocked = true; break; }
  }
  check("login rate-limited after repeated failures", blocked);
  r = await anon("POST", "/api/login", { username: "elev2", password: "lösenord123" });
  check("correct password also blocked while limited", r.status === 429, r);

  // --- static files ---
  for (const [path, expected] of [["/", 200], ["/app.js", 200], ["/lessons/addition.json", 200], ["/server.js", 404], ["/server/db.js", 404],
    ["/data/gaussica.db", 404], ["/package.json", 404], ["/../server.js", 404], ["/%2e%2e/server.js", 404], ["/lessons/../server.js", 404], ["/.claude/launch.json", 404]]) {
    const res = await fetch(base + path, { redirect: "manual" });
    check("static " + path + " -> " + expected, res.status === expected, res.status);
  }
  const home = await fetch(base + "/");
  check("CSP header present", /default-src 'self'/.test(home.headers.get("content-security-policy") || ""));

  console.log(pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
