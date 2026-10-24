// Gaussica API on Cloudflare Workers + D1. Same endpoints and rules as server/api.js,
// but logged-in users are identified by a bearer token (Authorization header) instead of a
// cookie, so the site can be served from GitHub Pages or from a PC and use the same database.

const SESSION_DAYS = 30;
const COLORS = ["#425b9a", "#ef6f88", "#4fa8dc", "#8a74c9", "#d99a2b", "#2f9d88", "#7a8db8"];
const ID_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CHAT_UNANSWERED_MAX = 6;   // a student can send this many messages in a row before the teacher has answered
const STICKERS = ["star", "thumbs", "muscle", "rocket", "bulb", "party", "heart"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
    classId: u.class_id || null, className: u.class_name || null, color: COLORS[u.id % COLORS.length],
    rewards: u.rewards === undefined || u.rewards === null ? true : Boolean(u.rewards)
  });

  const userById = (id) => one("SELECT u.*, c.name AS class_name, COALESCE(cs.rewards, 1) AS rewards FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN class_settings cs ON cs.class_id = u.class_id WHERE u.id = ?", id);

  function bearer() {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("Authorization") || "");
    return m ? m[1] : null;
  }

  async function currentSession() {
    const token = bearer();
    if (!token) return null;
    const hash = await sha256Hex(token);
    const user = await one(
      "SELECT u.*, c.name AS class_name, COALESCE(cs.rewards, 1) AS rewards FROM sessions s JOIN users u ON u.id = s.user_id " +
      "LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN class_settings cs ON cs.class_id = u.class_id WHERE s.token_hash = ? AND s.expires_at > ?", hash, nowIso());
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

  const publicAssignment = (r) => ({
    id: r.id, lessonId: r.lesson_id, kind: r.kind || "lesson", note: r.note, dueDate: r.due_date, createdAt: r.created_at, teacher: r.teacher || null,
    classId: r.class_id || null, className: r.class_name || null, studentId: r.student_id || null, studentName: r.student_name || null
  });

  const publicFeedback = (r) => ({
    id: r.id, studentId: r.student_id || null, lessonId: r.lesson_id || null, taskId: r.task_id || null, text: r.text,
    sticker: r.sticker || null, createdAt: r.created_at, read: Boolean(r.read_at), teacher: r.teacher || null
  });

  async function myData() {
    const s = await requireUser();
    const isStudent = s.user.role === "student";
    const [progress, attempts, assignments, feedback, chat] = await Promise.all([
      progressOf(s.user.id),
      all("SELECT id, data, created_at FROM attempts WHERE user_id = ? ORDER BY id", s.user.id),
      isStudent && s.user.class_id ? all(
        "SELECT a.id, a.lesson_id, a.kind, a.note, a.due_date, a.created_at, u.display_name AS teacher FROM assignments a JOIN users u ON u.id = a.teacher_id " +
        "WHERE a.archived = 0 AND a.class_id = ? AND (a.student_id IS NULL OR a.student_id = ?) ORDER BY a.due_date IS NULL, a.due_date, a.id",
        s.user.class_id, s.user.id) : [],
      isStudent ? all(
        "SELECT f.id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at, u.display_name AS teacher FROM feedback f " +
        "JOIN users u ON u.id = f.teacher_id WHERE f.student_id = ? ORDER BY f.id DESC LIMIT 200", s.user.id) : [],
      // An older database without the chat table must not break the rest of the page.
      isStudent ? all("SELECT id, student_id, from_teacher, text, lesson_id, task_id, context, created_at, read_at FROM chat WHERE student_id = ? ORDER BY id DESC LIMIT 200", s.user.id).catch(() => []) : []
    ]);
    return [200, { progress, attempts: attempts.map(attemptFromRow), assignments: assignments.map(publicAssignment), feedback: feedback.map(publicFeedback), chat: chat.reverse().map(publicChat) }];
  }

  // ----- feedback about the site, sent by e-mail to whoever runs it -----
  // Secrets: RESEND_API_KEY and FEEDBACK_TO (see cloudflare/README.md). Without them the messages are only saved.
  const FEEDBACK_KINDS = { fel: "Något är fel", forslag: "Ett förslag", annat: "Något annat" };

  function feedbackMailText(f) {
    const lines = ["Ny feedback från Gaussica", "", "Typ: " + FEEDBACK_KINDS[f.kind], "", f.text, ""];
    if (f.email) lines.push("Svarsadress: " + f.email);
    lines.push("Från: " + f.sender);
    if (f.page) lines.push("Sida: " + f.page);
    if (f.context) {
      const c = f.context;
      const where = [c.taskName, c.lessonTitle].filter(Boolean).join(" i ");
      if (where) lines.push("Uppgift: " + where);
      if (c.prompt) lines.push("Fråga: " + c.prompt);
      if (c.answer) lines.push("Svar hittills: " + c.answer);
    }
    if (f.agent) lines.push("Webbläsare: " + f.agent);
    return lines.join("\n");
  }

  async function mailFeedback(f) {
    if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) return false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.RESEND_API_KEY },
        body: JSON.stringify({
          from: env.FEEDBACK_FROM || "Gaussica <onboarding@resend.dev>", to: [env.FEEDBACK_TO],
          subject: "Gaussica feedback: " + FEEDBACK_KINDS[f.kind], text: feedbackMailText(f), reply_to: f.email || undefined
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) console.error("Feedback e-mail failed:", res.status, (await res.text()).slice(0, 200));
      return res.ok;
    } catch (e) {
      console.error("Feedback e-mail failed:", e.message);
      return false;
    }
  }

  async function postFeedback() {
    const b = await readJson(request, 12000);
    if (b.website) return [201, { ok: true, emailed: false }];   // hidden field only a robot fills in
    const kind = FEEDBACK_KINDS[b.kind] ? b.kind : "annat";
    const text = str(b.text, 2000).trim();
    if (text.length < 3) throw new ApiError(400, "Skriv en rad eller två först.");
    const email = str(b.email, 120).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "E-postadressen ser inte rätt ut. Lämna fältet tomt om du inte vill ha svar.");
    if (await limit("feedback:" + ip, 5, 60 * 60 * 1000)) throw new ApiError(429, "Du har skickat flera meddelanden på kort tid. Försök igen om en stund.");
    const s = await currentSession();
    let sender = "Inte inloggad";
    if (s) {
      const cls = s.user.class_id ? await one("SELECT name FROM classes WHERE id = ?", s.user.class_id) : null;
      sender = s.user.display_name + " (" + (s.user.role === "teacher" ? "lärare" : "elev") + (cls ? ", klass " + cls.name : "") + ")";
    }
    const context = cleanChatContext(b.context);
    const f = {
      kind, text, email: email || null, page: str(b.page, 200) || null, context: context ? JSON.parse(context) : null,
      sender, agent: str(request.headers.get("User-Agent"), 200) || null
    };
    // saving is best effort: an older database without the table must not stop the e-mail
    await run("INSERT INTO site_feedback (kind, text, email, page, context, sender, agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      f.kind, f.text, f.email, f.page, context, f.sender, f.agent, nowIso()).catch((e) => console.error("Could not save feedback:", e.message));
    const emailed = await mailFeedback(f);
    return [201, { ok: true, emailed }];
  }

  // ----- chat between a student and the teacher of their class -----
  const publicChat = (r) => {
    let context = null;
    try { context = r.context ? JSON.parse(r.context) : null; } catch (e) { /* skip corrupt context */ }
    return {
      id: r.id, studentId: String(r.student_id), fromTeacher: Boolean(r.from_teacher), text: r.text,
      lessonId: r.lesson_id || null, taskId: r.task_id || null, context, createdAt: r.created_at, read: Boolean(r.read_at)
    };
  };

  // What the student was looking at when they wrote. Everything is length limited.
  function cleanChatContext(c) {
    if (!c || typeof c !== "object") return null;
    const out = {};
    ["prompt", "answer", "lessonTitle", "taskName", "correctAnswer"].forEach((k) => {
      if (c[k] !== undefined && c[k] !== null && String(c[k]).trim()) out[k] = str(c[k], k === "prompt" ? 600 : 200);
    });
    if (Number.isInteger(c.tries) && c.tries >= 0) out.tries = Math.min(c.tries, 99);
    if (["done", "fix", "todo", "read"].indexOf(c.status) >= 0) out.status = c.status;
    return Object.keys(out).length ? JSON.stringify(out) : null;
  }

  const chatMissing = (err) => { throw /no such table/i.test(String(err && err.message)) ? new ApiError(503, "Chatten är inte påslagen på servern än.") : err; };

  async function studentChat() {
    const s = await requireUser();
    if (s.user.role !== "student") throw new ApiError(403, "Bara elever kan skriva till läraren här.");
    if (!s.user.class_id) throw new ApiError(400, "Du är inte med i någon klass än.");
    const teacher = await one("SELECT teacher_id FROM classes WHERE id = ?", s.user.class_id);
    if (!teacher) throw new ApiError(400, "Klassen har ingen lärare.");
    const b = await readJson(request, 8000);
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw new ApiError(400, "Ogiltigt id.");
    try {
      const open = await one(
        "SELECT COUNT(*) AS n FROM chat WHERE student_id = ? AND from_teacher = 0 AND id > COALESCE((SELECT MAX(id) FROM chat WHERE student_id = ? AND from_teacher = 1), 0)",
        s.user.id, s.user.id);
      if (open.n >= CHAT_UNANSWERED_MAX) throw new ApiError(429, "Du har redan skickat flera meddelanden. Vänta tills din lärare har svarat.");
      const res = await run("INSERT INTO chat (student_id, teacher_id, from_teacher, text, lesson_id, task_id, context, created_at) VALUES (?, ?, 0, ?, ?, ?, ?, ?)",
        s.user.id, teacher.teacher_id, text, lessonId, taskId, cleanChatContext(b.context), nowIso());
      return [201, { id: res.meta.last_row_id }];
    } catch (err) { return chatMissing(err); }
  }

  async function studentChatRead() {
    const s = await requireUser();
    await run("UPDATE chat SET read_at = ? WHERE student_id = ? AND from_teacher = 1 AND read_at IS NULL", nowIso(), s.user.id).catch(() => null);
    return [200, { ok: true }];
  }

  async function teacherChat() {
    const s = await requireTeacher();
    const b = await readJson(request, 5000);
    const student = await studentOfTeacher(b.studentId, s.user.id);
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    try {
      const res = await run("INSERT INTO chat (student_id, teacher_id, from_teacher, text, created_at) VALUES (?, ?, 1, ?, ?)", student.id, s.user.id, text, nowIso());
      await run("UPDATE chat SET read_at = ? WHERE student_id = ? AND teacher_id = ? AND from_teacher = 0 AND read_at IS NULL", nowIso(), student.id, s.user.id);   // answering means having read
      return [201, { id: res.meta.last_row_id }];
    } catch (err) { return chatMissing(err); }
  }

  async function teacherChatRead() {
    const s = await requireTeacher();
    const b = await readJson(request, 2000);
    const student = await studentOfTeacher(b.studentId, s.user.id);
    await run("UPDATE chat SET read_at = ? WHERE student_id = ? AND teacher_id = ? AND from_teacher = 0 AND read_at IS NULL", nowIso(), student.id, s.user.id).catch(() => null);
    return [200, { ok: true }];
  }

  async function teacherChatUnread() {
    const s = await requireTeacher();
    const r = await one("SELECT COUNT(*) AS n FROM chat WHERE teacher_id = ? AND from_teacher = 0 AND read_at IS NULL", s.user.id).catch(() => ({ n: 0 }));
    return [200, { unread: r.n }];
  }

  async function markRead() {
    const s = await requireUser();
    const b = await readJson(request, 5000);
    const ids = (Array.isArray(b.ids) ? b.ids.slice(0, 100) : []).filter(Number.isInteger);
    const now = nowIso();
    if (ids.length) {
      await db.batch(ids.map((id) => db.prepare("UPDATE feedback SET read_at = ? WHERE id = ? AND student_id = ? AND read_at IS NULL").bind(now, id, s.user.id)));
    }
    return [200, { ok: true }];
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
    return [200, { classes: (await all(
      "SELECT c.id, c.name, c.code, c.created_at, (SELECT COUNT(*) FROM users u WHERE u.class_id = c.id) AS students, " +
      "COALESCE((SELECT rewards FROM class_settings WHERE class_id = c.id), 1) AS rewards " +
      "FROM classes c WHERE c.teacher_id = ? ORDER BY c.name", s.user.id)).map((c) => Object.assign({}, c, { rewards: Boolean(c.rewards) })) }];
  }

  async function updateClass(id) {
    const s = await requireTeacher();
    const cls = await one("SELECT id FROM classes WHERE id = ? AND teacher_id = ?", Number(id), s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte.");
    const b = await readJson(request, 2000);
    if (typeof b.rewards === "boolean") {
      await run("INSERT INTO class_settings (class_id, rewards) VALUES (?, ?) ON CONFLICT (class_id) DO UPDATE SET rewards = excluded.rewards", cls.id, b.rewards ? 1 : 0);
    }
    return [200, { ok: true }];
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
    const [students, progressRows, attemptRows, feedbackRows, chatRows] = await Promise.all([
      all("SELECT u.id, u.username, u.display_name, u.created_at, u.class_id, c.name AS class_name FROM users u " +
        "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ? AND u.role = 'student' ORDER BY u.display_name", s.user.id),
      all("SELECT p.user_id, p.lesson_id, p.data FROM progress p JOIN users u ON u.id = p.user_id " +
        "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ?", s.user.id),
      all("SELECT a.id, a.user_id, a.data, a.created_at FROM attempts a JOIN users u ON u.id = a.user_id " +
        "JOIN classes c ON c.id = u.class_id WHERE c.teacher_id = ? ORDER BY a.id", s.user.id),
      all("SELECT f.id, f.student_id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at FROM feedback f WHERE f.teacher_id = ? ORDER BY f.id", s.user.id),
      all("SELECT id, student_id, from_teacher, text, lesson_id, task_id, context, created_at, read_at FROM chat WHERE teacher_id = ? ORDER BY id DESC LIMIT 1000", s.user.id).catch(() => [])
    ]);
    const chat = {};
    chatRows.reverse().forEach((r) => { (chat[r.student_id] = chat[r.student_id] || []).push(publicChat(r)); });
    const sent = {};
    feedbackRows.forEach((r) => { (sent[r.student_id] = sent[r.student_id] || []).push(publicFeedback(r)); });
    const progress = {}, attempts = {};
    progressRows.forEach((r) => {
      try { (progress[r.user_id] = progress[r.user_id] || {})[r.lesson_id] = JSON.parse(r.data); } catch (e) { /* skip */ }
    });
    attemptRows.forEach((r) => { (attempts[r.user_id] = attempts[r.user_id] || []).push(attemptFromRow(r)); });
    return [200, { students: students.map((u) => ({
      id: String(u.id), username: u.username, name: u.display_name, "class": u.class_name, classId: u.class_id,
      color: COLORS[u.id % COLORS.length], createdAt: u.created_at,
      lessonProgress: progress[u.id] || {}, attempts: attempts[u.id] || [], feedback: sent[u.id] || [], chat: chat[u.id] || []
    })) }];
  }

  async function studentOfTeacher(studentId, teacherId) {
    const st = await one("SELECT u.* FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND c.teacher_id = ? AND u.role = 'student'", Number(studentId), teacherId);
    if (!st) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    return st;
  }

  // ----- assignments and feedback (teacher) -----
  async function listAssignments() {
    const s = await requireTeacher();
    return [200, { assignments: (await all(
      "SELECT a.id, a.class_id, a.student_id, a.lesson_id, a.kind, a.note, a.due_date, a.created_at, c.name AS class_name, s.display_name AS student_name " +
      "FROM assignments a JOIN classes c ON c.id = a.class_id LEFT JOIN users s ON s.id = a.student_id " +
      "WHERE a.archived = 0 AND a.teacher_id = ? ORDER BY a.due_date IS NULL, a.due_date, a.id", s.user.id)).map(publicAssignment) }];
  }

  async function createAssignment() {
    const s = await requireTeacher();
    const b = await readJson(request, 5000);
    const cls = await one("SELECT * FROM classes WHERE id = ? AND teacher_id = ?", Number(b.classId), s.user.id);
    if (!cls) throw new ApiError(400, "Välj en av dina klasser.");
    let studentId = null;
    if (b.studentId !== undefined && b.studentId !== null && b.studentId !== "") {
      const st = await one("SELECT u.* FROM users u JOIN classes c ON c.id = u.class_id WHERE u.id = ? AND c.teacher_id = ? AND u.role = 'student'", Number(b.studentId), s.user.id);
      if (!st || st.class_id !== cls.id) throw new ApiError(400, "Eleven går inte i den klassen.");
      studentId = st.id;
    }
    const lessonId = str(b.lessonId, 80);
    if (!ID_RE.test(lessonId)) throw new ApiError(400, "Välj en lektion.");
    const dueDate = str(b.dueDate, 10);
    if (dueDate && (!DATE_RE.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) throw new ApiError(400, "Ogiltigt datum.");
    const note = str(b.note, 400).trim();
    const kind = b.kind === "practice" ? "practice" : "lesson";
    const res = await run("INSERT INTO assignments (class_id, student_id, teacher_id, lesson_id, note, due_date, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      cls.id, studentId, s.user.id, lessonId, note, dueDate || null, nowIso(), kind);
    return [201, { id: res.meta.last_row_id }];
  }

  async function archiveAssignment(id) {
    const s = await requireTeacher();
    await run("UPDATE assignments SET archived = 1 WHERE id = ? AND teacher_id = ?", Number(id), s.user.id);
    return [200, { ok: true }];
  }

  async function createFeedback() {
    const s = await requireTeacher();
    const b = await readJson(request, 5000);
    const student = await studentOfTeacher(b.studentId, s.user.id);
    const text = str(b.text, 600).trim();
    const sticker = b.sticker ? str(b.sticker, 20) : null;
    if (sticker && STICKERS.indexOf(sticker) < 0) throw new ApiError(400, "Okänd dekal.");
    if (!text && !sticker) throw new ApiError(400, "Skriv något eller välj en dekal.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw new ApiError(400, "Ogiltigt id.");
    const res = await run("INSERT INTO feedback (student_id, teacher_id, lesson_id, task_id, text, sticker, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      student.id, s.user.id, lessonId, taskId, text, sticker, nowIso());
    return [201, { id: res.meta.last_row_id }];
  }

  async function removeFeedback(id) {
    const s = await requireTeacher();
    await run("DELETE FROM feedback WHERE id = ? AND teacher_id = ?", Number(id), s.user.id);
    return [200, { ok: true }];
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
      db.prepare("DELETE FROM chat WHERE student_id = ?").bind(student.id),
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
    if (method === "POST" && p === "/api/me/feedback/read") return markRead();
    if (method === "POST" && p === "/api/feedback") return postFeedback();
    if (method === "POST" && p === "/api/me/chat") return studentChat();
    if (method === "POST" && p === "/api/me/chat/read") return studentChatRead();
    if (method === "POST" && p === "/api/teacher/chat") return teacherChat();
    if (method === "POST" && p === "/api/teacher/chat/read") return teacherChatRead();
    if (method === "GET" && p === "/api/teacher/chat/unread") return teacherChatUnread();
    if ((m = /^\/api\/progress\/([^/]+)$/.exec(p)) && method === "PUT") return putProgress(decodeURIComponent(m[1]));
    if (method === "POST" && p === "/api/attempts") return postAttempt();
    if (method === "GET" && p === "/api/lessons") return listLessons();
    if ((m = /^\/api\/lessons\/([^/]+)$/.exec(p)) && method === "PUT") return putLesson(decodeURIComponent(m[1]));
    if (method === "GET" && p === "/api/teacher/classes") return listClasses();
    if (method === "POST" && p === "/api/teacher/classes") return createClass();
    if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p)) && method === "PUT") return updateClass(m[1]);
    if (method === "GET" && p === "/api/teacher/students") return teacherStudents();
    if (method === "GET" && p === "/api/teacher/assignments") return listAssignments();
    if (method === "POST" && p === "/api/teacher/assignments") return createAssignment();
    if ((m = /^\/api\/teacher\/assignments\/(\d+)$/.exec(p)) && method === "DELETE") return archiveAssignment(m[1]);
    if (method === "POST" && p === "/api/teacher/feedback") return createFeedback();
    if ((m = /^\/api\/teacher\/feedback\/(\d+)$/.exec(p)) && method === "DELETE") return removeFeedback(m[1]);
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
