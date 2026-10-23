// Browser-only stand-in for the Node server (server/api.js), used when the site is hosted
// statically, for example on GitHub Pages. It answers the same /api requests but keeps
// accounts, progress and edited lessons in this browser's localStorage, so they are not
// shared between devices or browsers.
//
// GaussicaAPI (auth-view.js) switches to this automatically when /api does not answer with JSON.

window.GaussicaLocal = (function () {
  "use strict";

  const KEY = "gaussica.local.v1";
  const TEACHER_CODE = "GAUSSICA";
  const COLORS = ["#425b9a", "#ef6f88", "#4fa8dc", "#8a74c9", "#d99a2b", "#2f9d88", "#7a8db8"];
  const ID_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
  const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function ApiError(status, message) {
    const e = new Error(message);
    e.status = status;
    return e;
  }

  function str(v, max) { return v === undefined || v === null ? "" : String(v).slice(0, max); }
  function nowIso() { return new Date().toISOString(); }
  function copy(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function normalizeCode(code) { return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  // ----- storage -----
  function empty() {
    return { users: [], classes: [], progress: {}, attempts: [], lessons: {}, next: { user: 1, cls: 1, attempt: 1 }, session: null };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) return Object.assign(empty(), parsed);
      }
    } catch (e) { /* storage blocked or corrupt: start empty */ }
    return empty();
  }

  let db = load();
  let memoryOnly = false;

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      memoryOnly = true;   // private window or full storage: keep working until the page closes
    }
  }

  // ----- passwords (PBKDF2 where the browser allows it) -----
  function b64(bytes) {
    let s = "";
    bytes.forEach(function (b) { s += String.fromCharCode(b); });
    return btoa(s);
  }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }

  async function derive(password, salt, iterations) {
    const subtle = window.crypto && window.crypto.subtle;
    if (!subtle) {   // insecure context: weak fallback so the demo still works
      let h = 5381;
      const text = b64(salt) + password;
      for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
      return new Uint8Array([h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255]);
    }
    const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iterations }, key, 256));
  }

  async function hashPassword(password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100000;
    return ["pbkdf2", iterations, b64(salt), b64(await derive(password, salt, iterations))].join("$");
  }

  async function verifyPassword(password, stored) {
    const parts = String(stored).split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    return b64(await derive(password, unb64(parts[2]), Number(parts[1]))) === parts[3];
  }

  function randomCode(length) {
    const bytes = window.crypto.getRandomValues(new Uint8Array(length));
    let out = "";
    bytes.forEach(function (b) { out += CODE_ALPHABET[b % CODE_ALPHABET.length]; });
    return out;
  }

  // ----- helpers -----
  function className(u) {
    const c = db.classes.find(function (x) { return x.id === u.classId; });
    return c ? c.name : null;
  }

  function publicUser(u) {
    return {
      id: u.id, username: u.username, name: u.displayName, role: u.role,
      classId: u.classId || null, className: className(u), color: COLORS[u.id % COLORS.length]
    };
  }

  function currentUser() {
    return db.session ? db.users.find(function (u) { return u.id === db.session; }) || null : null;
  }

  function requireUser() {
    const u = currentUser();
    if (!u) throw ApiError(401, "Du måste logga in.");
    return u;
  }

  function requireTeacher() {
    const u = requireUser();
    if (u.role !== "teacher") throw ApiError(403, "Endast lärare har tillgång.");
    return u;
  }

  function validUsername(u) {
    return typeof u === "string" && u.length >= 3 && u.length <= 30 && /^[\p{L}\p{N}._-]+$/u.test(u);
  }

  function checkPassword(pw, username) {
    if (typeof pw !== "string" || pw.length < 8) throw ApiError(400, "Lösenordet måste vara minst 8 tecken.");
    if (pw.length > 200) throw ApiError(400, "Lösenordet är för långt.");
    if (username && pw.toLowerCase() === String(username).toLowerCase()) throw ApiError(400, "Lösenordet får inte vara samma som användarnamnet.");
  }

  function progressOf(userId) {
    return copy(db.progress[userId] || {});
  }

  function attemptsOf(userId) {
    return db.attempts.filter(function (a) { return a.userId === userId; }).map(function (a) {
      const data = copy(a.data);
      data.id = "att-" + a.id;
      data.timestamp = a.createdAt;
      return data;
    });
  }

  function teacherClassIds(teacherId) {
    return db.classes.filter(function (c) { return c.teacherId === teacherId; }).map(function (c) { return c.id; });
  }

  function studentOfTeacher(studentId, teacherId) {
    const ids = teacherClassIds(teacherId);
    return db.users.find(function (u) { return u.id === studentId && u.role === "student" && ids.indexOf(u.classId) >= 0; }) || null;
  }

  // ----- handlers -----
  async function register(b) {
    const role = b.role === "teacher" ? "teacher" : "student";
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw ApiError(400, "Ange ditt namn.");
    checkPassword(b.password, username);

    let classId = null;
    if (role === "student") {
      const code = normalizeCode(b.classCode);
      const cls = db.classes.find(function (c) { return c.code === code; });
      if (!cls) throw ApiError(400, "Klasskoden stämmer inte. Fråga din lärare efter rätt kod.");
      classId = cls.id;
    } else if (normalizeCode(b.teacherCode) !== TEACHER_CODE) {
      throw ApiError(403, "Lärarkoden stämmer inte.");
    }

    if (db.users.some(function (u) { return u.username === username; })) throw ApiError(409, "Användarnamnet är redan upptaget.");
    const user = {
      id: db.next.user++, username: username, displayName: displayName, role: role,
      passwordHash: await hashPassword(b.password), classId: classId, createdAt: nowIso()
    };
    db.users.push(user);
    db.session = user.id;
    save();
    return { user: publicUser(user) };
  }

  async function login(b) {
    const username = str(b.username, 40).trim();
    const user = db.users.find(function (u) { return u.username === username; });
    const ok = user ? await verifyPassword(str(b.password, 200), user.passwordHash) : false;
    if (!ok) throw ApiError(401, "Fel användarnamn eller lösenord.");
    db.session = user.id;
    save();
    return { user: publicUser(user) };
  }

  async function changePassword(b) {
    const u = requireUser();
    if (!(await verifyPassword(str(b.current, 200), u.passwordHash))) throw ApiError(400, "Nuvarande lösenord stämmer inte.");
    checkPassword(b.next, u.username);
    u.passwordHash = await hashPassword(b.next);
    save();
    return { ok: true };
  }

  function putProgress(lessonId, b) {
    const u = requireUser();
    if (!ID_RE.test(lessonId)) throw ApiError(400, "Ogiltigt lektions-id.");
    if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) throw ApiError(400, "Saknar data.");
    const json = JSON.stringify(b.data);
    if (json.length > 600000) throw ApiError(413, "För mycket data.");
    if (!db.progress[u.id]) db.progress[u.id] = {};
    db.progress[u.id][lessonId] = JSON.parse(json);
    save();
    return { ok: true };
  }

  function postAttempt(b) {
    const u = requireUser();
    const lessonId = str(b.lessonId, 80), taskId = str(b.taskId, 80);
    if (!ID_RE.test(lessonId) || !ID_RE.test(taskId)) throw ApiError(400, "Ogiltigt id.");
    if (b.feedbackType !== "correct" && b.feedbackType !== "hint") throw ApiError(400, "Ogiltig typ av försök.");
    const completed = b.feedbackType === "correct";
    const attemptNo = db.attempts.filter(function (a) { return a.userId === u.id && a.lessonId === lessonId && a.taskId === taskId; }).length + 1;
    const seconds = Number.isFinite(Number(b.seconds)) && b.seconds !== null ? Math.max(0, Math.min(86400, Math.round(Number(b.seconds)))) : null;
    const data = {
      lessonId: lessonId, lessonTitle: str(b.lessonTitle, 200), taskId: taskId, taskName: str(b.taskName, 100),
      prompt: str(b.prompt, 2000), answer: str(b.answer, 500), scratchpad: str(b.scratchpad, 5000),
      completed: completed, feedback: str(b.feedback, 2000), feedbackType: b.feedbackType,
      misconception: b.misconception ? str(b.misconception, 500) : null,
      attemptNo: attemptNo, correctAnswer: str(b.correctAnswer, 500), seconds: seconds
    };
    if (typeof b.canvas === "string" && b.canvas) data.canvas = str(b.canvas, 60000);
    const row = { id: db.next.attempt++, userId: u.id, lessonId: lessonId, taskId: taskId, completed: completed, data: data, createdAt: nowIso() };
    db.attempts.push(row);
    save();
    const out = copy(data);
    out.id = "att-" + row.id;
    out.timestamp = row.createdAt;
    return { attempt: out };
  }

  function putLesson(id, b) {
    requireTeacher();
    if (!ID_RE.test(id)) throw ApiError(400, "Ogiltigt lektions-id.");
    const l = b.lesson;
    if (!l || typeof l !== "object" || Array.isArray(l) || l.id !== id) throw ApiError(400, "Lektionen saknas eller har fel id.");
    if (typeof l.title !== "string" || !l.title.trim() || typeof l.area !== "string" || !Array.isArray(l.prerequisites) ||
        !l.exercise || !Array.isArray(l.exercise.answer) || !Array.isArray(l.exercise.feedback)) {
      throw ApiError(400, "Lektionen saknar obligatoriska fält.");
    }
    db.lessons[id] = copy(l);
    save();
    return { ok: true };
  }

  function listClasses() {
    const u = requireTeacher();
    return {
      classes: db.classes.filter(function (c) { return c.teacherId === u.id; }).map(function (c) {
        return { id: c.id, name: c.name, code: c.code, created_at: c.createdAt, students: db.users.filter(function (s) { return s.classId === c.id; }).length };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, "sv"); })
    };
  }

  function createClass(b) {
    const u = requireTeacher();
    const name = str(b.name, 60).trim();
    if (!name) throw ApiError(400, "Ge klassen ett namn.");
    let code;
    for (let i = 0; i < 10; i++) {
      code = randomCode(6);
      if (!db.classes.some(function (c) { return c.code === code; })) break;
    }
    const cls = { id: db.next.cls++, name: name, code: code, teacherId: u.id, createdAt: nowIso() };
    db.classes.push(cls);
    save();
    return { "class": { id: cls.id, name: name, code: code, students: 0 } };
  }

  function teacherStudents() {
    const u = requireTeacher();
    const ids = teacherClassIds(u.id);
    const students = db.users.filter(function (s) { return s.role === "student" && ids.indexOf(s.classId) >= 0; })
      .sort(function (a, b) { return a.displayName.localeCompare(b.displayName, "sv"); })
      .map(function (s) {
        return {
          id: String(s.id), username: s.username, name: s.displayName, "class": className(s), classId: s.classId,
          color: COLORS[s.id % COLORS.length], createdAt: s.createdAt, lessonProgress: progressOf(s.id), attempts: attemptsOf(s.id)
        };
      });
    return { students: students };
  }

  async function resetStudentPassword(studentId) {
    const t = requireTeacher();
    const student = studentOfTeacher(Number(studentId), t.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    const temp = randomCode(10);
    student.passwordHash = await hashPassword(temp);
    if (db.session === student.id) db.session = null;
    save();
    return { password: temp };
  }

  function deleteStudent(studentId) {
    const t = requireTeacher();
    const student = studentOfTeacher(Number(studentId), t.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    db.users = db.users.filter(function (u) { return u.id !== student.id; });
    db.attempts = db.attempts.filter(function (a) { return a.userId !== student.id; });
    delete db.progress[student.id];
    save();
    return { ok: true };
  }

  // ----- router -----
  async function handle(method, path, body) {
    body = copy(body) || {};
    let m;
    if (method === "GET" && path === "/api/me") { const u = currentUser(); return { user: u ? publicUser(u) : null }; }
    if (method === "POST" && path === "/api/register") return register(body);
    if (method === "POST" && path === "/api/login") return login(body);
    if (method === "POST" && path === "/api/logout") { db.session = null; save(); return { ok: true }; }
    if (method === "POST" && path === "/api/me/password") return changePassword(body);
    if (method === "GET" && path === "/api/me/data") { const u = requireUser(); return { progress: progressOf(u.id), attempts: attemptsOf(u.id) }; }
    if ((m = /^\/api\/progress\/([^/]+)$/.exec(path)) && method === "PUT") return putProgress(decodeURIComponent(m[1]), body);
    if (method === "POST" && path === "/api/attempts") return postAttempt(body);
    if (method === "GET" && path === "/api/lessons") { requireUser(); return { lessons: Object.keys(db.lessons).map(function (k) { return copy(db.lessons[k]); }) }; }
    if ((m = /^\/api\/lessons\/([^/]+)$/.exec(path)) && method === "PUT") return putLesson(decodeURIComponent(m[1]), body);
    if (method === "GET" && path === "/api/teacher/classes") return listClasses();
    if (method === "POST" && path === "/api/teacher/classes") return createClass(body);
    if (method === "GET" && path === "/api/teacher/students") return teacherStudents();
    if ((m = /^\/api\/teacher\/students\/(\d+)\/password$/.exec(path)) && method === "POST") return resetStudentPassword(m[1]);
    if ((m = /^\/api\/teacher\/students\/(\d+)$/.exec(path)) && method === "DELETE") return deleteStudent(m[1]);
    throw ApiError(404, "Hittades inte.");
  }

  return { handle: handle, teacherCode: TEACHER_CODE, isMemoryOnly: function () { return memoryOnly; } };
}());
