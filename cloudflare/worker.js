// Gaussica API on Cloudflare Workers + D1. Same endpoints and rules as server/api.js,
// but logged-in users are identified by a bearer token (Authorization header) instead of a
// cookie, so the site can be served from GitHub Pages or from a PC and use the same database.

const SESSION_DAYS = 30;
const COLORS = ["#425b9a", "#ef6f88", "#4fa8dc", "#8a74c9", "#d99a2b", "#2f9d88", "#7a8db8"];
const ID_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PBKDF2_ITERATIONS = 100000;   // the most Workers allow

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const enc = new TextEncoder();
const str = (v, max) => (v === undefined || v === null ? "" : String(v).slice(0, max));
const nowIso = () => new Date().toISOString();
const normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ----- crypto -----
function b64(bytes) { let s = ""; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); }
function unb64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
function b64url(bytes) { return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ["pbkdf2", PBKDF2_ITERATIONS, b64(salt), b64(await derive(password, salt, PBKDF2_ITERATIONS))].join("$");
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  return safeEqual(b64(await derive(password, unb64(parts[2]), Number(parts[1]))), parts[3]);
}

let dummyHash = null;
async function dummyVerify(password) {   // unknown usernames cost as much time as wrong passwords
  if (!dummyHash) dummyHash = await hashPassword(b64url(crypto.getRandomValues(new Uint8Array(12))));
  await verifyPassword(password, dummyHash);
}

async function sha256Hex(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}

function randomCode(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  bytes.forEach((b) => { out += CODE_ALPHABET[b % CODE_ALPHABET.length]; });
  return out;
}

// ----- http helpers -----
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const h = { "Vary": "Origin" };
  if (origin && allowedOrigins(env).includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function reply(status, body, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, cors)
  });
}

async function readJson(request, limit) {
  if (!/^application\/json\b/i.test(request.headers.get("Content-Type") || "")) throw new ApiError(415, "Förfrågan måste vara JSON.");
  const text = await request.text();
  if (text.length > limit) throw new ApiError(413, "För stor förfrågan.");
  try {
    const body = JSON.parse(text || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return body;
  } catch (e) {
    throw new ApiError(400, "Ogiltig JSON.");
  }
}

// ----- validation -----
const validUsername = (u) => typeof u === "string" && u.length >= 3 && u.length <= 30 && /^[\p{L}\p{N}._-]+$/u.test(u);

function checkPassword(pw, username) {
  if (typeof pw !== "string" || pw.length < 8) throw new ApiError(400, "Lösenordet måste vara minst 8 tecken.");
  if (pw.length > 200) throw new ApiError(400, "Lösenordet är för långt.");
  if (username && pw.toLowerCase() === String(username).toLowerCase()) throw new ApiError(400, "Lösenordet får inte vara samma som användarnamnet.");
}

// ----- the API -----
function createApi(env, request) {
  const db = env.DB;
  const ip = request.headers.get("CF-Connecting-IP") || "?";

  const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
  const all = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results || [];
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();

  // Counts a hit and returns the seconds to wait when over the limit (0 = fine).
  async function limit(key, max, windowMs) {
    const now = Date.now();
    const row = await one("SELECT count, window_start FROM rate_limits WHERE key = ?", key);
    if (!row || now - row.window_start >= windowMs) {
      await run("INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET count = 1, window_start = excluded.window_start", key, now);
      return 0;
    }
    if (row.count >= max) return Math.ceil((windowMs - (now - row.window_start)) / 1000);
    await run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
    return 0;
  }

  async function housekeeping() {
    if (Math.random() > 0.02) return;
    await run("DELETE FROM sessions WHERE expires_at < ?", nowIso());
    await run("DELETE FROM rate_limits WHERE window_start < ?", Date.now() - 24 * 3600 * 1000);
  }

  const publicUser = (u) => ({
    id: u.id, username: u.username, name: u.display_name, role: u.role,
    classId: u.class_id || null, className: u.class_name || null, color: COLORS[u.id % COLORS.length]
  });

  const userById = (id) => one("SELECT u.*, c.name AS class_name FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ?", id);

  function bearer() {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("Authorization") || "");
    return m ? m[1] : null;
  }

  async function currentSession() {
    const token = bearer();
    if (!token) return null;
    const hash = await sha256Hex(token);
    const user = await one(
      "SELECT u.*, c.name AS class_name FROM sessions s JOIN users u ON u.id = s.user_id " +
      "LEFT JOIN classes c ON c.id = u.class_id WHERE s.token_hash = ? AND s.expires_at > ?", hash, nowIso());
    return user ? { user, tokenHash: hash } : null;
  }

  async function requireUser() {
    const s = await currentSession();
    if (!s) throw new ApiError(401, "Du måste logga in.");
    return s;
  }

  async function requireTeacher() {
    const s = await requireUser();
    if (s.user.role !== "teacher") throw new ApiError(403, "Endast lärare har tillgång.");
    return s;
  }

  async function startSession(userId) {
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const created = new Date();
    await run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      await sha256Hex(token), userId, created.toISOString(), new Date(created.getTime() + SESSION_DAYS * 86400000).toISOString());
    return token;
  }

  async function progressOf(userId) {
    const out = {};
    (await all("SELECT lesson_id, data FROM progress WHERE user_id = ?", userId)).forEach((r) => {
      try { out[r.lesson_id] = JSON.parse(r.data); } catch (e) { /* skip corrupt row */ }
    });
    return out;
  }

  function attemptFromRow(r) {
    let data = {};
    try { data = JSON.parse(r.data); } catch (e) { /* ignore */ }
    data.id = "att-" + r.id;
    data.timestamp = r.created_at;
    return data;
  }

  // ----- handlers -----
  async function register() {
    const wait = await limit("reg:" + ip, 20, 3600 * 1000);
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    const b = await readJson(request, 10000);
    const role = b.role === "teacher" ? "teacher" : "student";
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw new ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw new ApiError(400, "Ange ditt namn.");
    checkPassword(b.password, username);

    let classId = null;
    if (role === "student") {
      const cls = await one("SELECT id FROM classes WHERE code = ?", normalizeCode(b.classCode));
      if (!cls) throw new ApiError(400, "Klasskoden stämmer inte. Fråga din lärare efter rätt kod.");
      classId = cls.id;
    } else {
      if (!env.TEACHER_CODE) throw new ApiError(503, "Lärarregistrering är inte påslagen. Sätt hemligheten TEACHER_CODE i Cloudflare.");
      if (!safeEqual(normalizeCode(b.teacherCode), normalizeCode(env.TEACHER_CODE))) throw new ApiError(403, "Lärarkoden stämmer inte.");
    }

    if (await one("SELECT 1 AS x FROM users WHERE username = ?", username)) throw new ApiError(409, "Användarnamnet är redan upptaget.");
    const hash = await hashPassword(b.password);
    let userId;
    try {
      const res = await run("INSERT INTO users (username, display_name, role, password_hash, class_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        username, displayName, role, hash, classId, nowIso());
      userId = res.meta.last_row_id;
    } catch (e) {
      throw new ApiError(409, "Användarnamnet är redan upptaget.");
    }
    const token = await startSession(userId);
    return [201, { user: publicUser(await userById(userId)), token }];
  }

  async function login() {
    const b = await readJson(request, 10000);
    const username = str(b.username, 40).trim();
    const password = str(b.password, 200);
    const userKey = "login:" + ip + "|" + username.toLowerCase();
    const wait = Math.max(await limit("loginip:" + ip, 60, 15 * 60 * 1000), await limit(userKey, 8, 15 * 60 * 1000));
    if (wait) throw new ApiError(429, "För många inloggningsförsök. Försök igen om " + Math.ceil(wait / 60) + " min.");
    const user = await one("SELECT * FROM users WHERE username = ?", username);
    let ok = false;
    if (user) ok = await verifyPassword(password, user.password_hash);
    else await dummyVerify(password);
    if (!ok) throw new ApiError(401, "Fel användarnamn eller lösenord.");
    await run("DELETE FROM rate_limits WHERE key = ?", userKey);
    const token = await startSession(user.id);
    return [200, { user: publicUser(await userById(user.id)), token }];
  }

  async function changePassword() {
    const s = await requireUser();
    const b = await readJson(request, 10000);
    if (!(await verifyPassword(str(b.current, 200), s.user.password_hash))) throw new ApiError(400, "Nuvarande lösenord stämmer inte.");
    checkPassword(b.next, s.user.username);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(b.next), s.user.id);
    await run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", s.user.id, s.tokenHash);
    return [200, { ok: true }];
  }

  async function myData() {
    const s = await requireUser();
    const [progress, attempts] = await Promise.all([
      progressOf(s.user.id),
      all("SELECT id, data, created_at FROM attempts WHERE user_id = ? ORDER BY id", s.user.id)
    ]);
    return [200, { progress, attempts: attempts.map(attemptFromRow) }];
  }

  async function putProgress(lessonId) {
    const s = await requireUser();
    if (!ID_RE.test(lessonId)) throw new ApiError(400, "Ogiltigt lektions-id.");
    const b = await readJson(request, 800000);
    if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) throw new ApiError(400, "Saknar data.");
    const json = JSON.stringify(b.data);
    if (json.length > 600000) throw new ApiError(413, "För mycket data.");
    await run("INSERT INTO progress (user_id, lesson_id, data, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (user_id, lesson_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
      s.user.id, lessonId, json, nowIso());
    return [200, { ok: true }];
  }

  async function postAttempt() {
    const s = await requireUser();
    const b = await readJson(request, 150000);
    const lessonId = str(b.lessonId, 80), taskId = str(b.taskId, 80);
    if (!ID_RE.test(lessonId) || !ID_RE.test(taskId)) throw new ApiError(400, "Ogiltigt id.");
    if (b.feedbackType !== "correct" && b.feedbackType !== "hint") throw new ApiError(400, "Ogiltig typ av försök.");
    const completed = b.feedbackType === "correct";
    const count = await one("SELECT COUNT(*) AS n FROM attempts WHERE user_id = ? AND lesson_id = ? AND task_id = ?", s.user.id, lessonId, taskId);
    const seconds = Number.isFinite(Number(b.seconds)) && b.seconds !== null ? Math.max(0, Math.min(86400, Math.round(Number(b.seconds)))) : null;
    const data = {
      lessonId, lessonTitle: str(b.lessonTitle, 200), taskId, taskName: str(b.taskName, 100),
      prompt: str(b.prompt, 2000), answer: str(b.answer, 500), scratchpad: str(b.scratchpad, 5000),
      completed, feedback: str(b.feedback, 2000), feedbackType: b.feedbackType,
      misconception: b.misconception ? str(b.misconception, 500) : null,
      attemptNo: count.n + 1, correctAnswer: str(b.correctAnswer, 500), seconds
    };
    if (typeof b.canvas === "string" && b.canvas) data.canvas = str(b.canvas, 60000);
    const created = nowIso();
    const res = await run("INSERT INTO attempts (user_id, lesson_id, task_id, completed, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      s.user.id, lessonId, taskId, completed ? 1 : 0, JSON.stringify(data), created);
    data.id = "att-" + res.meta.last_row_id;
    data.timestamp = created;
    return [201, { attempt: data }];
  }

  async function listLessons() {
    await requireUser();
    const lessons = [];
    (await all("SELECT data FROM lessons")).forEach((r) => { try { lessons.push(JSON.parse(r.data)); } catch (e) { /* skip */ } });
    return [200, { lessons }];
  }

  async function putLesson(id) {
    const s = await requireTeacher();
    if (!ID_RE.test(id)) throw new ApiError(400, "Ogiltigt lektions-id.");
    const b = await readJson(request, 1500000);
    const l = b.lesson;
    if (!l || typeof l !== "object" || Array.isArray(l) || l.id !== id) throw new ApiError(400, "Lektionen saknas eller har fel id.");
    if (typeof l.title !== "string" || !l.title.trim() || typeof l.area !== "string" || !Array.isArray(l.prerequisites) ||
        !l.exercise || !Array.isArray(l.exercise.answer) || !Array.isArray(l.exercise.feedback)) {
      throw new ApiError(400, "Lektionen saknar obligatoriska fält.");
    }
    await run("INSERT INTO lessons (id, data, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
      id, JSON.stringify(l), nowIso(), s.user.id);
    return [200, { ok: true }];
  }

  async function listClasses() {
    const s = await requireTeacher();
    return [200, { classes: await all(
      "SELECT c.id, c.name, c.code, c.created_at, (SELECT COUNT(*) FROM users u WHERE u.class_id = c.id) AS students " +
      "FROM classes c WHERE c.teacher_id = ? ORDER BY c.name", s.user.id) }];
  }

  async function createClass() {
    const s = await requireTeacher();
    const b = await readJson(request, 2000);
    const name = str(b.name, 60).trim();
    if (!name) throw new ApiError(400, "Ge klassen ett namn.");
    let code;
    for (let i = 0; i < 10; i++) {
      code = randomCode(6);
      if (!(await one("SELECT 1 AS x FROM classes WHERE code = ?", code))) break;
    }
    const res = await run("INSERT INTO classes (name, code, teacher_id, created_at) VALUES (?, ?, ?, ?)", name, code, s.user.id, nowIso());
    return [201, { "class": { id: res.meta.last_row_id, name, code, students: 0 } }];
  }

  async function teacherStudents() {
    const s = await requireTeacher();
    const [students, progressRows, attemptRows] = await Promise.all([
      all("SELECT u.id, u.username, u.display_name, u.created_at, u.class_id, c.name AS class_name FROM users u " +
        "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ? AND u.role = 'student' ORDER BY u.display_name", s.user.id),
      all("SELECT p.user_id, p.lesson_id, p.data FROM progress p JOIN users u ON u.id = p.user_id " +
        "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ?", s.user.id),
      all("SELECT a.id, a.user_id, a.data, a.created_at FROM attempts a JOIN users u ON u.id = a.user_id " +
        "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ? ORDER BY a.id", s.user.id)
    ]);
    const progress = {}, attempts = {};
    progressRows.forEach((r) => {
      try { (progress[r.user_id] = progress[r.user_id] || {})[r.lesson_id] = JSON.parse(r.data); } catch (e) { /* skip */ }
    });
    attemptRows.forEach((r) => { (attempts[r.user_id] = attempts[r.user_id] || []).push(attemptFromRow(r)); });
    return [200, { students: students.map((u) => ({
      id: String(u.id), username: u.username, name: u.display_name, "class": u.class_name, classId: u.class_id,
      color: COLORS[u.id % COLORS.length], createdAt: u.created_at,
      lessonProgress: progress[u.id] || {}, attempts: attempts[u.id] || []
    })) }];
  }

  async function studentOfTeacher(studentId, teacherId) {
    const st = await one("SELECT u.* FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND c.teacher_id = ? AND u.role = 'student'", Number(studentId), teacherId);
    if (!st) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    return st;
  }

  async function resetStudentPassword(studentId) {
    const s = await requireTeacher();
    const student = await studentOfTeacher(studentId, s.user.id);
    const temp = randomCode(10);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(temp), student.id);
    await run("DELETE FROM sessions WHERE user_id = ?", student.id);
    return [200, { password: temp }];
  }

  async function deleteStudent(studentId) {
    const s = await requireTeacher();
    const student = await studentOfTeacher(studentId, s.user.id);
    await db.batch([
      db.prepare("DELETE FROM attempts WHERE user_id = ?").bind(student.id),
      db.prepare("DELETE FROM progress WHERE user_id = ?").bind(student.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(student.id),
      db.prepare("DELETE FROM users WHERE id = ?").bind(student.id)
    ]);
    return [200, { ok: true }];
  }

  async function handle(method, p) {
    let m;
    await housekeeping();
    if (method === "GET" && p === "/api/me") { const s = await currentSession(); return [200, { user: s ? publicUser(s.user) : null }]; }
    if (method === "POST" && p === "/api/register") return register();
    if (method === "POST" && p === "/api/login") return login();
    if (method === "POST" && p === "/api/logout") {
      const token = bearer();
      if (token) await run("DELETE FROM sessions WHERE token_hash = ?", await sha256Hex(token));
      return [200, { ok: true }];
    }
    if (method === "POST" && p === "/api/me/password") return changePassword();
    if (method === "GET" && p === "/api/me/data") return myData();
    if ((m = /^\/api\/progress\/([^/]+)$/.exec(p)) && method === "PUT") return putProgress(decodeURIComponent(m[1]));
    if (method === "POST" && p === "/api/attempts") return postAttempt();
    if (method === "GET" && p === "/api/lessons") return listLessons();
    if ((m = /^\/api\/lessons\/([^/]+)$/.exec(p)) && method === "PUT") return putLesson(decodeURIComponent(m[1]));
    if (method === "GET" && p === "/api/teacher/classes") return listClasses();
    if (method === "POST" && p === "/api/teacher/classes") return createClass();
    if (method === "GET" && p === "/api/teacher/students") return teacherStudents();
    if ((m = /^\/api\/teacher\/students\/(\d+)\/password$/.exec(p)) && method === "POST") return resetStudentPassword(m[1]);
    if ((m = /^\/api\/teacher\/students\/(\d+)$/.exec(p)) && method === "DELETE") return deleteStudent(m[1]);
    throw new ApiError(404, "Hittades inte.");
  }

  return { handle };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    try {
      const origin = request.headers.get("Origin");
      if (origin && !cors["Access-Control-Allow-Origin"]) throw new ApiError(403, "Otillåten ursprungsadress.");
      if (url.pathname === "/" || url.pathname === "/health") return reply(200, { ok: true, service: "gaussica-api" }, cors);
      const [status, body] = await createApi(env, request).handle(request.method, url.pathname);
      return reply(status, body, cors);
    } catch (err) {
      if (err instanceof ApiError) return reply(err.status, { error: err.message }, cors);
      console.error(err);
      return reply(500, { error: "Något gick fel på servern." }, cors);
    }
  }
};
