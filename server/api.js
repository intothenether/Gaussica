"use strict";
// JSON API under /api. All state-changing requests need a session cookie (SameSite=Lax),
// a same-origin Origin header and a JSON body.

const sec = require("./security");

const COOKIE = "gs";
const SESSION_DAYS = 30;
const COLORS = ["#425b9a", "#ef6f88", "#4fa8dc", "#8a74c9", "#d99a2b", "#2f9d88", "#7a8db8"];
const ID_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const CHAT_UNANSWERED_MAX = 6;   // a student can send this many messages in a row before the teacher has answered
const STICKERS = ["star", "thumbs", "muscle", "rocket", "bulb", "party", "heart"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function str(v, max) {
  if (v === undefined || v === null) return "";
  return String(v).slice(0, max);
}

function nowIso() { return new Date().toISOString(); }

function createApi(db, options) {
  options = options || {};
  const secureCookie = Boolean(options.secureCookie);

  const loginIpLimit = sec.createLimiter(60, 15 * 60 * 1000);
  const loginUserLimit = sec.createLimiter(8, 15 * 60 * 1000);
  const registerLimit = sec.createLimiter(20, 60 * 60 * 1000);
  setInterval(function () {
    loginIpLimit.sweep(); loginUserLimit.sweep(); registerLimit.sweep();
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  }, 10 * 60 * 1000).unref();

  const q = {
    userByName: db.prepare("SELECT * FROM users WHERE username = ?"),
    userById: db.prepare("SELECT u.*, c.name AS class_name, COALESCE(cs.rewards, 1) AS rewards FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN class_settings cs ON cs.class_id = u.class_id WHERE u.id = ?"),
    insertUser: db.prepare("INSERT INTO users (username, display_name, role, password_hash, class_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
    classByCode: db.prepare("SELECT * FROM classes WHERE code = ?"),
    insertClass: db.prepare("INSERT INTO classes (name, code, teacher_id, created_at) VALUES (?, ?, ?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    sessionUser: db.prepare(
      "SELECT u.*, c.name AS class_name, COALESCE(cs.rewards, 1) AS rewards FROM sessions s JOIN users u ON u.id = s.user_id " +
      "LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN class_settings cs ON cs.class_id = u.class_id WHERE s.token_hash = ? AND s.expires_at > ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteUserSessions: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
    deleteOtherSessions: db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?"),
    setPassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
    progressByUser: db.prepare("SELECT lesson_id, data FROM progress WHERE user_id = ?"),
    upsertProgress: db.prepare(
      "INSERT INTO progress (user_id, lesson_id, data, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (user_id, lesson_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"),
    attemptsByUser: db.prepare("SELECT id, data, created_at FROM attempts WHERE user_id = ? ORDER BY id"),
    countAttempts: db.prepare("SELECT COUNT(*) AS n FROM attempts WHERE user_id = ? AND lesson_id = ? AND task_id = ?"),
    insertAttempt: db.prepare("INSERT INTO attempts (user_id, lesson_id, task_id, completed, data, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
    allLessons: db.prepare("SELECT data FROM lessons"),
    upsertLesson: db.prepare(
      "INSERT INTO lessons (id, data, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by"),
    teacherClasses: db.prepare(
      "SELECT c.id, c.name, c.code, c.created_at, (SELECT COUNT(*) FROM users u WHERE u.class_id = c.id) AS students, " +
      "COALESCE((SELECT rewards FROM class_settings WHERE class_id = c.id), 1) AS rewards " +
      "FROM classes c WHERE c.teacher_id = ? ORDER BY c.name"),
    setRewards: db.prepare("INSERT INTO class_settings (class_id, rewards) VALUES (?, ?) ON CONFLICT (class_id) DO UPDATE SET rewards = excluded.rewards"),
    teacherStudents: db.prepare(
      "SELECT u.id, u.username, u.display_name, u.created_at, u.class_id, c.name AS class_name FROM users u " +
      "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ? AND u.role = 'student' ORDER BY u.display_name"),
    studentOfTeacher: db.prepare(
      "SELECT u.* FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND c.teacher_id = ? AND u.role = 'student'"),
    deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
    classOfTeacher: db.prepare("SELECT * FROM classes WHERE id = ? AND teacher_id = ?"),
    insertAssignment: db.prepare("INSERT INTO assignments (class_id, student_id, teacher_id, lesson_id, note, due_date, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    assignmentsForStudent: db.prepare(
      "SELECT a.id, a.lesson_id, a.kind, a.note, a.due_date, a.created_at, u.display_name AS teacher FROM assignments a JOIN users u ON u.id = a.teacher_id " +
      "WHERE a.archived = 0 AND a.class_id = ? AND (a.student_id IS NULL OR a.student_id = ?) ORDER BY a.due_date IS NULL, a.due_date, a.id"),
    assignmentsForTeacher: db.prepare(
      "SELECT a.id, a.class_id, a.student_id, a.lesson_id, a.kind, a.note, a.due_date, a.created_at, c.name AS class_name, s.display_name AS student_name " +
      "FROM assignments a JOIN classes c ON c.id = a.class_id LEFT JOIN users s ON s.id = a.student_id " +
      "WHERE a.archived = 0 AND a.teacher_id = ? ORDER BY a.due_date IS NULL, a.due_date, a.id"),
    archiveAssignment: db.prepare("UPDATE assignments SET archived = 1 WHERE id = ? AND teacher_id = ?"),
    insertFeedback: db.prepare("INSERT INTO feedback (student_id, teacher_id, lesson_id, task_id, text, sticker, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    feedbackForStudent: db.prepare(
      "SELECT f.id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at, u.display_name AS teacher FROM feedback f " +
      "JOIN users u ON u.id = f.teacher_id WHERE f.student_id = ? ORDER BY f.id DESC LIMIT 200"),
    feedbackForTeacher: db.prepare(
      "SELECT f.id, f.student_id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at FROM feedback f WHERE f.teacher_id = ? ORDER BY f.id"),
    markFeedbackRead: db.prepare("UPDATE feedback SET read_at = ? WHERE id = ? AND student_id = ? AND read_at IS NULL"),
    deleteFeedback: db.prepare("DELETE FROM feedback WHERE id = ? AND teacher_id = ?"),
    classTeacher: db.prepare("SELECT teacher_id FROM classes WHERE id = ?"),
    insertChat: db.prepare("INSERT INTO chat (student_id, teacher_id, from_teacher, text, lesson_id, task_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    chatForStudent: db.prepare(
      "SELECT id, student_id, from_teacher, text, lesson_id, task_id, context, created_at, read_at FROM chat WHERE student_id = ? ORDER BY id DESC LIMIT 200"),
    chatForTeacher: db.prepare(
      "SELECT id, student_id, from_teacher, text, lesson_id, task_id, context, created_at, read_at FROM chat WHERE teacher_id = ? ORDER BY id DESC LIMIT 1000"),
    chatUnanswered: db.prepare(
      "SELECT COUNT(*) AS n FROM chat WHERE student_id = ? AND from_teacher = 0 AND id > COALESCE((SELECT MAX(id) FROM chat WHERE student_id = ? AND from_teacher = 1), 0)"),
    chatReadByStudent: db.prepare("UPDATE chat SET read_at = ? WHERE student_id = ? AND from_teacher = 1 AND read_at IS NULL"),
    chatReadByTeacher: db.prepare("UPDATE chat SET read_at = ? WHERE student_id = ? AND teacher_id = ? AND from_teacher = 0 AND read_at IS NULL"),
    chatUnreadForTeacher: db.prepare("SELECT COUNT(*) AS n FROM chat WHERE teacher_id = ? AND from_teacher = 0 AND read_at IS NULL"),
    getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
    setSetting: db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
  };

  // ----- teacher code -----
  function teacherCode() {
    if (process.env.TEACHER_CODE) return sec.normalizeCode(process.env.TEACHER_CODE);
    const row = q.getSetting.get("teacher_code");
    if (row) return row.value;
    const code = sec.randomCode(10);
    q.setSetting.run("teacher_code", code);
    return code;
  }

  // ----- request helpers -----
  function parseCookies(req) {
    const out = {};
    String(req.headers.cookie || "").split(";").forEach(function (part) {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
    return out;
  }

  function currentSession(req) {
    const token = parseCookies(req)[COOKIE];
    if (!token) return null;
    const hash = sec.hashToken(token);
    const user = q.sessionUser.get(hash, nowIso());
    return user ? { user: user, tokenHash: hash } : null;
  }

  function setSessionCookie(res, token) {
    res.setHeader("Set-Cookie", COOKIE + "=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" +
      SESSION_DAYS * 86400 + (secureCookie ? "; Secure" : ""));
  }

  function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" + (secureCookie ? "; Secure" : ""));
  }

  function startSession(res, userId) {
    const token = sec.newToken();
    const created = new Date();
    q.insertSession.run(sec.hashToken(token), userId, created.toISOString(),
      new Date(created.getTime() + SESSION_DAYS * 86400000).toISOString());
    setSessionCookie(res, token);
  }

  function readJson(req, limit) {
    return new Promise(function (resolve, reject) {
      const type = String(req.headers["content-type"] || "");
      if (!/^application\/json\b/i.test(type)) return reject(new ApiError(415, "Förfrågan måste vara JSON."));
      let size = 0;
      const chunks = [];
      req.on("data", function (chunk) {
        size += chunk.length;
        if (size > limit) { reject(new ApiError(413, "För stor förfrågan.")); req.destroy(); return; }
        chunks.push(chunk);
      });
      req.on("end", function () {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
          resolve(body);
        } catch (e) {
          reject(new ApiError(400, "Ogiltig JSON."));
        }
      });
      req.on("error", reject);
    });
  }

  function send(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(json);
  }

  function publicUser(u) {
    return {
      id: u.id, username: u.username, name: u.display_name, role: u.role,
      classId: u.class_id || null, className: u.class_name || null, color: COLORS[u.id % COLORS.length],
      rewards: u.rewards === undefined || u.rewards === null ? true : Boolean(u.rewards)
    };
  }

  function requireUser(req) {
    const s = currentSession(req);
    if (!s) throw new ApiError(401, "Du måste logga in.");
    return s;
  }

  function requireTeacher(req) {
    const s = requireUser(req);
    if (s.user.role !== "teacher") throw new ApiError(403, "Endast lärare har tillgång.");
    return s;
  }

  function ip(req) { return req.socket.remoteAddress || "?"; }

  // ----- validation -----
  function validUsername(u) {
    return typeof u === "string" && u.length >= 3 && u.length <= 30 && /^[\p{L}\p{N}._-]+$/u.test(u);
  }
  function checkPassword(pw, username) {
    if (typeof pw !== "string" || pw.length < 8) throw new ApiError(400, "Lösenordet måste vara minst 8 tecken.");
    if (pw.length > 200) throw new ApiError(400, "Lösenordet är för långt.");
    if (username && pw.toLowerCase() === String(username).toLowerCase()) throw new ApiError(400, "Lösenordet får inte vara samma som användarnamnet.");
  }

  // ----- handlers -----
  async function register(req, res) {
    const wait = registerLimit.check(ip(req));
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    const b = await readJson(req, 10000);
    const role = b.role === "teacher" ? "teacher" : "student";
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw new ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw new ApiError(400, "Ange ditt namn.");
    checkPassword(b.password, username);

    let classId = null;
    if (role === "student") {
      const cls = q.classByCode.get(sec.normalizeCode(b.classCode));
      if (!cls) throw new ApiError(400, "Klasskoden stämmer inte. Fråga din lärare efter rätt kod.");
      classId = cls.id;
    } else if (!sec.safeEqual(sec.normalizeCode(b.teacherCode), teacherCode())) {
      throw new ApiError(403, "Lärarkoden stämmer inte.");
    }

    if (q.userByName.get(username)) throw new ApiError(409, "Användarnamnet är redan upptaget.");
    const hash = await sec.hashPassword(b.password);
    let userId;
    try {
      userId = Number(q.insertUser.run(username, displayName, role, hash, classId, nowIso()).lastInsertRowid);
    } catch (e) {
      throw new ApiError(409, "Användarnamnet är redan upptaget.");
    }
    startSession(res, userId);
    send(res, 201, { user: publicUser(q.userById.get(userId)) });
  }

  async function login(req, res) {
    const b = await readJson(req, 10000);
    const username = str(b.username, 40).trim();
    const password = str(b.password, 200);
    const userKey = ip(req) + "|" + username.toLowerCase();
    const wait = Math.max(loginIpLimit.check(ip(req)), loginUserLimit.check(userKey));
    if (wait) throw new ApiError(429, "För många inloggningsförsök. Försök igen om " + Math.ceil(wait / 60) + " min.");
    const user = q.userByName.get(username);
    let ok = false;
    if (user) ok = await sec.verifyPassword(password, user.password_hash);
    else await sec.dummyVerify(password);
    if (!ok) throw new ApiError(401, "Fel användarnamn eller lösenord.");
    loginUserLimit.reset(userKey);
    startSession(res, user.id);
    send(res, 200, { user: publicUser(q.userById.get(user.id)) });
  }

  async function changePassword(req, res) {
    const s = requireUser(req);
    const b = await readJson(req, 10000);
    const full = q.userByName.get(s.user.username);
    if (!(await sec.verifyPassword(str(b.current, 200), full.password_hash))) throw new ApiError(400, "Nuvarande lösenord stämmer inte.");
    checkPassword(b.next, s.user.username);
    q.setPassword.run(await sec.hashPassword(b.next), s.user.id);
    q.deleteOtherSessions.run(s.user.id, s.tokenHash);
    send(res, 200, { ok: true });
  }

  function myData(req, res) {
    const s = requireUser(req);
    const student = s.user.role === "student" && s.user.class_id;
    send(res, 200, {
      progress: progressOf(s.user.id), attempts: attemptsOf(s.user.id),
      assignments: student ? q.assignmentsForStudent.all(s.user.class_id, s.user.id).map(publicAssignment) : [],
      feedback: s.user.role === "student" ? q.feedbackForStudent.all(s.user.id).map(publicFeedback) : [],
      chat: s.user.role === "student" ? q.chatForStudent.all(s.user.id).reverse().map(publicChat) : []
    });
  }

  // ----- chat between a student and the teacher of their class -----
  function publicChat(r) {
    let context = null;
    try { context = r.context ? JSON.parse(r.context) : null; } catch (e) { /* skip corrupt context */ }
    return {
      id: r.id, studentId: String(r.student_id), fromTeacher: Boolean(r.from_teacher), text: r.text,
      lessonId: r.lesson_id || null, taskId: r.task_id || null, context: context, createdAt: r.created_at, read: Boolean(r.read_at)
    };
  }

  // What the student was looking at when they wrote. Everything is length limited.
  function cleanChatContext(c) {
    if (!c || typeof c !== "object") return null;
    const out = {};
    ["prompt", "answer", "lessonTitle", "taskName", "correctAnswer"].forEach(function (k) {
      if (c[k] !== undefined && c[k] !== null && String(c[k]).trim()) out[k] = str(c[k], k === "prompt" ? 600 : 200);
    });
    if (Number.isInteger(c.tries) && c.tries >= 0) out.tries = Math.min(c.tries, 99);
    if (["done", "fix", "todo", "read"].indexOf(c.status) >= 0) out.status = c.status;
    return Object.keys(out).length ? JSON.stringify(out) : null;
  }

  async function studentChat(req, res) {
    const s = requireUser(req);
    if (s.user.role !== "student") throw new ApiError(403, "Bara elever kan skriva till läraren här.");
    if (!s.user.class_id) throw new ApiError(400, "Du är inte med i någon klass än.");
    const teacher = q.classTeacher.get(s.user.class_id);
    if (!teacher) throw new ApiError(400, "Klassen har ingen lärare.");
    const b = await readJson(req, 8000);
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw new ApiError(400, "Ogiltigt id.");
    if (q.chatUnanswered.get(s.user.id, s.user.id).n >= CHAT_UNANSWERED_MAX) {
      throw new ApiError(429, "Du har redan skickat flera meddelanden. Vänta tills din lärare har svarat.");
    }
    const id = Number(q.insertChat.run(s.user.id, teacher.teacher_id, 0, text, lessonId, taskId, cleanChatContext(b.context), nowIso()).lastInsertRowid);
    send(res, 201, { id: id });
  }

  function studentChatRead(req, res) {
    const s = requireUser(req);
    q.chatReadByStudent.run(nowIso(), s.user.id);
    send(res, 200, { ok: true });
  }

  async function teacherChat(req, res) {
    const s = requireTeacher(req);
    const b = await readJson(req, 5000);
    const student = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    const id = Number(q.insertChat.run(student.id, s.user.id, 1, text, null, null, null, nowIso()).lastInsertRowid);
    q.chatReadByTeacher.run(nowIso(), student.id, s.user.id);   // answering means having read
    send(res, 201, { id: id });
  }

  async function teacherChatRead(req, res) {
    const s = requireTeacher(req);
    const b = await readJson(req, 2000);
    const student = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    q.chatReadByTeacher.run(nowIso(), student.id, s.user.id);
    send(res, 200, { ok: true });
  }

  function teacherChatUnread(req, res) {
    const s = requireTeacher(req);
    send(res, 200, { unread: q.chatUnreadForTeacher.get(s.user.id).n });
  }

  function publicAssignment(r) {
    return {
      id: r.id, lessonId: r.lesson_id, kind: r.kind || "lesson", note: r.note, dueDate: r.due_date, createdAt: r.created_at, teacher: r.teacher || null,
      classId: r.class_id || null, className: r.class_name || null, studentId: r.student_id || null, studentName: r.student_name || null
    };
  }

  function publicFeedback(r) {
    return {
      id: r.id, studentId: r.student_id || null, lessonId: r.lesson_id || null, taskId: r.task_id || null, text: r.text,
      sticker: r.sticker || null, createdAt: r.created_at, read: Boolean(r.read_at), teacher: r.teacher || null
    };
  }

  async function markRead(req, res) {
    const s = requireUser(req);
    const b = await readJson(req, 5000);
    const now = nowIso();
    (Array.isArray(b.ids) ? b.ids.slice(0, 100) : []).forEach(function (id) {
      if (Number.isInteger(id)) q.markFeedbackRead.run(now, id, s.user.id);
    });
    send(res, 200, { ok: true });
  }

  function progressOf(userId) {
    const out = {};
    q.progressByUser.all(userId).forEach(function (r) {
      try { out[r.lesson_id] = JSON.parse(r.data); } catch (e) { /* skip corrupt row */ }
    });
    return out;
  }

  function attemptsOf(userId) {
    return q.attemptsByUser.all(userId).map(function (r) {
      let data = {};
      try { data = JSON.parse(r.data); } catch (e) { /* ignore */ }
      data.id = "att-" + r.id;
      data.timestamp = r.created_at;
      return data;
    });
  }

  async function putProgress(req, res, lessonId) {
    const s = requireUser(req);
    if (!ID_RE.test(lessonId)) throw new ApiError(400, "Ogiltigt lektions-id.");
    const b = await readJson(req, 800000);
    if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) throw new ApiError(400, "Saknar data.");
    const json = JSON.stringify(b.data);
    if (json.length > 600000) throw new ApiError(413, "För mycket data.");
    q.upsertProgress.run(s.user.id, lessonId, json, nowIso());
    send(res, 200, { ok: true });
  }

  async function postAttempt(req, res) {
    const s = requireUser(req);
    const b = await readJson(req, 150000);
    const lessonId = str(b.lessonId, 80), taskId = str(b.taskId, 80);
    if (!ID_RE.test(lessonId) || !ID_RE.test(taskId)) throw new ApiError(400, "Ogiltigt id.");
    if (b.feedbackType !== "correct" && b.feedbackType !== "hint") throw new ApiError(400, "Ogiltig typ av försök.");
    const completed = b.feedbackType === "correct";
    const attemptNo = q.countAttempts.get(s.user.id, lessonId, taskId).n + 1;
    const seconds = Number.isFinite(Number(b.seconds)) && b.seconds !== null ? Math.max(0, Math.min(86400, Math.round(Number(b.seconds)))) : null;
    const data = {
      lessonId: lessonId, lessonTitle: str(b.lessonTitle, 200), taskId: taskId, taskName: str(b.taskName, 100),
      prompt: str(b.prompt, 2000), answer: str(b.answer, 500), scratchpad: str(b.scratchpad, 5000),
      completed: completed, feedback: str(b.feedback, 2000), feedbackType: b.feedbackType,
      misconception: b.misconception ? str(b.misconception, 500) : null,
      attemptNo: attemptNo, correctAnswer: str(b.correctAnswer, 500), seconds: seconds
    };
    if (typeof b.canvas === "string" && b.canvas) data.canvas = str(b.canvas, 60000);
    const created = nowIso();
    const id = Number(q.insertAttempt.run(s.user.id, lessonId, taskId, completed ? 1 : 0, JSON.stringify(data), created).lastInsertRowid);
    data.id = "att-" + id;
    data.timestamp = created;
    send(res, 201, { attempt: data });
  }

  function listLessons(req, res) {
    requireUser(req);
    const lessons = [];
    q.allLessons.all().forEach(function (r) {
      try { lessons.push(JSON.parse(r.data)); } catch (e) { /* skip */ }
    });
    send(res, 200, { lessons: lessons });
  }

  async function putLesson(req, res, id) {
    const s = requireTeacher(req);
    if (!ID_RE.test(id)) throw new ApiError(400, "Ogiltigt lektions-id.");
    const b = await readJson(req, 1500000);
    const l = b.lesson;
    if (!l || typeof l !== "object" || Array.isArray(l) || l.id !== id) throw new ApiError(400, "Lektionen saknas eller har fel id.");
    if (typeof l.title !== "string" || !l.title.trim() || typeof l.area !== "string" || !Array.isArray(l.prerequisites) ||
        !l.exercise || !Array.isArray(l.exercise.answer) || !Array.isArray(l.exercise.feedback)) {
      throw new ApiError(400, "Lektionen saknar obligatoriska fält.");
    }
    q.upsertLesson.run(id, JSON.stringify(l), nowIso(), s.user.id);
    send(res, 200, { ok: true });
  }

  // ----- teacher -----
  function listClasses(req, res) {
    const s = requireTeacher(req);
    send(res, 200, { classes: q.teacherClasses.all(s.user.id).map(function (c) { return Object.assign({}, c, { rewards: Boolean(c.rewards) }); }) });
  }

  async function updateClass(req, res, id) {
    const s = requireTeacher(req);
    const cls = q.classOfTeacher.get(Number(id), s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte.");
    const b = await readJson(req, 2000);
    if (typeof b.rewards === "boolean") q.setRewards.run(cls.id, b.rewards ? 1 : 0);
    send(res, 200, { ok: true });
  }

  async function createClass(req, res) {
    const s = requireTeacher(req);
    const b = await readJson(req, 2000);
    const name = str(b.name, 60).trim();
    if (!name) throw new ApiError(400, "Ge klassen ett namn.");
    let code, row;
    for (let i = 0; i < 10; i++) {
      code = sec.randomCode(6);
      if (!q.classByCode.get(code)) break;
    }
    const id = Number(q.insertClass.run(name, code, s.user.id, nowIso()).lastInsertRowid);
    row = { id: id, name: name, code: code, students: 0 };
    send(res, 201, { class: row });
  }

  function teacherStudents(req, res) {
    const s = requireTeacher(req);
    const sent = {};
    q.feedbackForTeacher.all(s.user.id).forEach(function (r) { (sent[r.student_id] = sent[r.student_id] || []).push(publicFeedback(r)); });
    const chat = {};
    q.chatForTeacher.all(s.user.id).reverse().forEach(function (r) { (chat[r.student_id] = chat[r.student_id] || []).push(publicChat(r)); });
    const students = q.teacherStudents.all(s.user.id).map(function (u) {
      return {
        feedback: sent[u.id] || [], chat: chat[u.id] || [],
        id: String(u.id), username: u.username, name: u.display_name, class: u.class_name, classId: u.class_id,
        color: COLORS[u.id % COLORS.length], createdAt: u.created_at,
        lessonProgress: progressOf(u.id), attempts: attemptsOf(u.id)
      };
    });
    send(res, 200, { students: students });
  }

  // ----- assignments and feedback (teacher) -----
  function listAssignments(req, res) {
    const s = requireTeacher(req);
    send(res, 200, { assignments: q.assignmentsForTeacher.all(s.user.id).map(publicAssignment) });
  }

  async function createAssignment(req, res) {
    const s = requireTeacher(req);
    const b = await readJson(req, 5000);
    const cls = q.classOfTeacher.get(Number(b.classId), s.user.id);
    if (!cls) throw new ApiError(400, "Välj en av dina klasser.");
    let studentId = null;
    if (b.studentId !== undefined && b.studentId !== null && b.studentId !== "") {
      const st = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
      if (!st || st.class_id !== cls.id) throw new ApiError(400, "Eleven går inte i den klassen.");
      studentId = st.id;
    }
    const lessonId = str(b.lessonId, 80);
    if (!ID_RE.test(lessonId)) throw new ApiError(400, "Välj en lektion.");
    const dueDate = str(b.dueDate, 10);
    if (dueDate && (!DATE_RE.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) throw new ApiError(400, "Ogiltigt datum.");
    const note = str(b.note, 400).trim();
    const kind = b.kind === "practice" ? "practice" : "lesson";
    const id = Number(q.insertAssignment.run(cls.id, studentId, s.user.id, lessonId, note, dueDate || null, nowIso(), kind).lastInsertRowid);
    send(res, 201, { id: id });
  }

  function archiveAssignment(req, res, id) {
    const s = requireTeacher(req);
    q.archiveAssignment.run(Number(id), s.user.id);
    send(res, 200, { ok: true });
  }

  async function createFeedback(req, res) {
    const s = requireTeacher(req);
    const b = await readJson(req, 5000);
    const student = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    const text = str(b.text, 600).trim();
    const sticker = b.sticker ? str(b.sticker, 20) : null;
    if (sticker && STICKERS.indexOf(sticker) < 0) throw new ApiError(400, "Okänd dekal.");
    if (!text && !sticker) throw new ApiError(400, "Skriv något eller välj en dekal.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw new ApiError(400, "Ogiltigt id.");
    const id = Number(q.insertFeedback.run(student.id, s.user.id, lessonId, taskId, text, sticker, nowIso()).lastInsertRowid);
    send(res, 201, { id: id });
  }

  function removeFeedback(req, res, id) {
    const s = requireTeacher(req);
    q.deleteFeedback.run(Number(id), s.user.id);
    send(res, 200, { ok: true });
  }

  async function resetStudentPassword(req, res, studentId) {
    const s = requireTeacher(req);
    const student = q.studentOfTeacher.get(Number(studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    const temp = sec.randomCode(10);
    q.setPassword.run(await sec.hashPassword(temp), student.id);
    q.deleteUserSessions.run(student.id);
    send(res, 200, { password: temp });
  }

  function deleteStudent(req, res, studentId) {
    const s = requireTeacher(req);
    const student = q.studentOfTeacher.get(Number(studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    q.deleteUser.run(student.id);
    send(res, 200, { ok: true });
  }

  // ----- router -----
  async function handle(req, res, url) {
    const method = req.method;
    const p = url.pathname;
    try {
      if (method !== "GET" && method !== "HEAD") {
        const origin = req.headers.origin;
        if (origin) {
          let host = "";
          try { host = new URL(origin).host; } catch (e) { /* invalid */ }
          if (host !== req.headers.host) throw new ApiError(403, "Otillåten ursprungsadress.");
        }
      }
      let m;
      if (method === "GET" && p === "/api/me") {
        const s = currentSession(req);
        return send(res, 200, { user: s ? publicUser(s.user) : null });
      }
      if (method === "POST" && p === "/api/register") return await register(req, res);
      if (method === "POST" && p === "/api/login") return await login(req, res);
      if (method === "POST" && p === "/api/logout") {
        const s = currentSession(req);
        if (s) q.deleteSession.run(s.tokenHash);
        clearSessionCookie(res);
        return send(res, 200, { ok: true });
      }
      if (method === "POST" && p === "/api/me/password") return await changePassword(req, res);
      if (method === "GET" && p === "/api/me/data") return myData(req, res);
      if (method === "POST" && p === "/api/me/feedback/read") return await markRead(req, res);
      if (method === "POST" && p === "/api/me/chat") return await studentChat(req, res);
      if (method === "POST" && p === "/api/me/chat/read") return studentChatRead(req, res);
      if (method === "POST" && p === "/api/teacher/chat") return await teacherChat(req, res);
      if (method === "POST" && p === "/api/teacher/chat/read") return await teacherChatRead(req, res);
      if (method === "GET" && p === "/api/teacher/chat/unread") return teacherChatUnread(req, res);
      if ((m = /^\/api\/progress\/([^/]+)$/.exec(p)) && method === "PUT") return await putProgress(req, res, decodeURIComponent(m[1]));
      if (method === "POST" && p === "/api/attempts") return await postAttempt(req, res);
      if (method === "GET" && p === "/api/lessons") return listLessons(req, res);
      if ((m = /^\/api\/lessons\/([^/]+)$/.exec(p)) && method === "PUT") return await putLesson(req, res, decodeURIComponent(m[1]));
      if (method === "GET" && p === "/api/teacher/classes") return listClasses(req, res);
      if (method === "POST" && p === "/api/teacher/classes") return await createClass(req, res);
      if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p)) && method === "PUT") return await updateClass(req, res, m[1]);
      if (method === "GET" && p === "/api/teacher/students") return teacherStudents(req, res);
      if (method === "GET" && p === "/api/teacher/assignments") return listAssignments(req, res);
      if (method === "POST" && p === "/api/teacher/assignments") return await createAssignment(req, res);
      if ((m = /^\/api\/teacher\/assignments\/(\d+)$/.exec(p)) && method === "DELETE") return archiveAssignment(req, res, m[1]);
      if (method === "POST" && p === "/api/teacher/feedback") return await createFeedback(req, res);
      if ((m = /^\/api\/teacher\/feedback\/(\d+)$/.exec(p)) && method === "DELETE") return removeFeedback(req, res, m[1]);
      if ((m = /^\/api\/teacher\/students\/(\d+)\/password$/.exec(p)) && method === "POST") return await resetStudentPassword(req, res, m[1]);
      if ((m = /^\/api\/teacher\/students\/(\d+)$/.exec(p)) && method === "DELETE") return deleteStudent(req, res, m[1]);
      throw new ApiError(404, "Hittades inte.");
    } catch (err) {
      if (err instanceof ApiError) return send(res, err.status, { error: err.message });
      console.error(err);
      return send(res, 500, { error: "Något gick fel på servern." });
    }
  }

  return { handle: handle, teacherCode: teacherCode };
}

module.exports = { createApi };
