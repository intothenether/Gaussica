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
  const STICKERS = ["star", "thumbs", "muscle", "rocket", "bulb", "party", "heart", "mynt5", "mynt10", "mynt25"];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    return { users: [], classes: [], progress: {}, attempts: [], lessons: {}, assignments: [], feedback: [], chat: [], next: { user: 1, cls: 1, attempt: 1, assignment: 1, feedback: 1, chat: 1 }, session: null };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          const merged = Object.assign(empty(), parsed);
          merged.next = Object.assign(empty().next, parsed.next);   // data saved before assignments existed
          return merged;
        }
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

  // Stars and badges are on unless the teacher has switched them off for the class.
  function classRewards(classId) {
    const c = db.classes.find(function (x) { return x.id === classId; });
    return !c || c.rewards !== false;
  }

  // A caregiver is stored as a teacher with the flag `caregiver`; the site is told the role "caregiver". A student whose class belongs to a
  // caregiver (a family) gets guide: "caregiver", so that the pages can say vårdnadshavare where they say lärare.
  function classOwner(classId) {
    const c = db.classes.find(function (x) { return x.id === classId; });
    return c ? db.users.find(function (x) { return x.id === c.teacherId; }) : null;
  }

  function publicUser(u) {
    return {
      id: u.id, username: u.username, name: u.displayName, role: u.role === "teacher" && u.caregiver ? "caregiver" : u.role,
      guide: u.role === "student" ? ((classOwner(u.classId) || {}).caregiver ? "caregiver" : "teacher") : undefined,
      classId: u.classId || null, className: className(u), color: COLORS[u.id % COLORS.length],
      rewards: classRewards(u.classId)
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

  // Teachers and caregivers: everything about their classes. Only teachers may edit lessons (requireTeacher).
  function requireGuide() {
    const u = requireUser();
    if (u.role !== "teacher") throw ApiError(403, "Endast lärare och vårdnadshavare har tillgång.");
    return u;
  }

  function requireTeacher() {
    const u = requireGuide();
    if (u.caregiver) throw ApiError(403, "Endast lärare kan ändra lektioner.");
    return u;
  }

  const FAMILY_MAX = 10;   // children in the family of a caregiver

  function newClassCode() {
    let code;
    for (let i = 0; i < 10; i++) {
      code = randomCode(6);
      if (!db.classes.some(function (c) { return c.code === code; })) break;
    }
    return code;
  }

  function familyName(displayName) {
    return "Familjen " + String(displayName).trim().split(/\s+/).pop();
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

  function publicAssignment(a, extra) {
    const teacher = db.users.find(function (u) { return u.id === a.teacherId; });
    const cls = db.classes.find(function (c) { return c.id === a.classId; });
    const student = a.studentId ? db.users.find(function (u) { return u.id === a.studentId; }) : null;
    return {
      id: a.id, lessonId: a.lessonId, kind: a.kind || "lesson", config: a.config || null, note: a.note, dueDate: a.dueDate, createdAt: a.createdAt, teacher: teacher ? teacher.displayName : null,
      classId: extra ? a.classId : null, className: extra && cls ? cls.name : null, studentId: extra ? a.studentId : null, studentName: extra && student ? student.displayName : null
    };
  }

  function publicFeedback(f, withStudent) {
    const teacher = db.users.find(function (u) { return u.id === f.teacherId; });
    return {
      id: f.id, studentId: withStudent ? f.studentId : null, lessonId: f.lessonId, taskId: f.taskId, text: f.text,
      sticker: f.sticker, createdAt: f.createdAt, read: Boolean(f.readAt), teacher: teacher ? teacher.displayName : null
    };
  }

  function byDue(a, b) {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.id - b.id;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.id - b.id;
  }

  // ----- handlers -----
  async function register(b) {
    const kind = b.role === "teacher" ? "teacher" : b.role === "caregiver" ? "caregiver" : "student";
    const role = kind === "student" ? "student" : "teacher";
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw ApiError(400, "Ange ditt namn.");
    checkPassword(b.password, username);

    let classId = null;
    if (role === "student") {
      const code = normalizeCode(b.classCode);
      const cls = db.classes.find(function (c) { return c.code === code; });
      if (!cls) throw ApiError(400, "Koden stämmer inte. Fråga din lärare eller vårdnadshavare efter rätt kod.");
      const owner = classOwner(cls.id);
      if (owner && owner.caregiver && db.users.filter(function (s) { return s.classId === cls.id && s.role === "student"; }).length >= FAMILY_MAX) throw ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
      classId = cls.id;
    } else if (kind === "caregiver") {
      /* no code: anyone may be a caregiver */
    } else if (normalizeCode(b.teacherCode) !== TEACHER_CODE) {
      throw ApiError(403, "Lärarkoden stämmer inte.");
    }

    if (db.users.some(function (u) { return u.username === username; })) throw ApiError(409, "Användarnamnet är redan upptaget.");
    const user = {
      id: db.next.user++, username: username, displayName: displayName, role: role,
      passwordHash: await hashPassword(b.password), classId: classId, createdAt: nowIso()
    };
    if (kind === "caregiver") user.caregiver = true;
    db.users.push(user);
    // a caregiver starts with a family, so there is a code to give the children at once
    if (kind === "caregiver") db.classes.push({ id: db.next.cls++, name: familyName(displayName), code: newClassCode(), teacherId: user.id, createdAt: nowIso() });
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

  // ----- assignments and feedback -----
  function listAssignments() {
    const u = requireGuide();
    return { assignments: db.assignments.filter(function (a) { return a.teacherId === u.id && !a.archived; }).sort(byDue).map(function (a) { return publicAssignment(a, true); }) };
  }

  // The settings of a prov: { title, lessons: [ids], perLesson, minutes (0 = no time limit), showResult }
  function cleanProv(c) {
    if (!c || typeof c !== "object") throw ApiError(400, "Provet saknar inställningar.");
    const lessons = (Array.isArray(c.lessons) ? c.lessons : []).map(function (x) { return str(x, 80); }).filter(function (x, i, a) { return ID_RE.test(x) && a.indexOf(x) === i; }).slice(0, 12);
    if (!lessons.length) throw ApiError(400, "Välj minst en lektion till provet.");
    const int = function (v, lo, hi, d) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    return { title: str(c.title, 80).trim() || "Prov", lessons: lessons, perLesson: int(c.perLesson, 1, 20, 4), minutes: int(c.minutes, 0, 240, 0), showResult: c.showResult !== false };
  }

  function createAssignment(b) {
    const u = requireGuide();
    const cls = db.classes.find(function (c) { return c.id === Number(b.classId) && c.teacherId === u.id; });
    if (!cls) throw ApiError(400, "Välj en av dina klasser.");
    let studentId = null;
    if (b.studentId !== undefined && b.studentId !== null && b.studentId !== "") {
      const st = studentOfTeacher(Number(b.studentId), u.id);
      if (!st || st.classId !== cls.id) throw ApiError(400, "Eleven går inte i den klassen.");
      studentId = st.id;
    }
    const lessonId = str(b.lessonId, 80);
    if (!ID_RE.test(lessonId)) throw ApiError(400, "Välj en lektion.");
    const dueDate = str(b.dueDate, 10);
    if (dueDate && (!DATE_RE.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) throw ApiError(400, "Ogiltigt datum.");
    const kind = b.kind === "practice" ? "practice" : b.kind === "prov" ? "prov" : "lesson";
    const config = kind === "prov" ? cleanProv(b.config) : null;
    const a = { id: db.next.assignment++, classId: cls.id, studentId: studentId, teacherId: u.id, lessonId: config ? config.lessons[0] : lessonId,
      note: str(b.note, 400).trim(), dueDate: dueDate || null, createdAt: nowIso(), archived: false, kind: kind, config: config };
    db.assignments.push(a);
    save();
    return { id: a.id };
  }

  function archiveAssignment(id) {
    const u = requireGuide();
    const a = db.assignments.find(function (x) { return x.id === Number(id) && x.teacherId === u.id; });
    if (a) { a.archived = true; save(); }
    return { ok: true };
  }

  function createFeedback(b) {
    const u = requireGuide();
    const student = studentOfTeacher(Number(b.studentId), u.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    const text = str(b.text, 600).trim();
    const sticker = b.sticker ? str(b.sticker, 20) : null;
    if (sticker && STICKERS.indexOf(sticker) < 0) throw ApiError(400, "Okänd dekal.");
    if (!text && !sticker) throw ApiError(400, "Skriv något eller välj en dekal.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw ApiError(400, "Ogiltigt id.");
    const f = { id: db.next.feedback++, studentId: student.id, teacherId: u.id, lessonId: lessonId, taskId: taskId, text: text, sticker: sticker, createdAt: nowIso(), readAt: null };
    db.feedback.push(f);
    save();
    return { id: f.id };
  }

  function removeFeedback(id) {
    const u = requireGuide();
    db.feedback = db.feedback.filter(function (f) { return !(f.id === Number(id) && f.teacherId === u.id); });
    save();
    return { ok: true };
  }

  // ----- chat between a student and the teacher of their class -----
  const CHAT_UNANSWERED_MAX = 6;

  function publicChat(c) {
    return {
      id: c.id, studentId: String(c.studentId), fromTeacher: c.fromTeacher, text: c.text,
      lessonId: c.lessonId || null, taskId: c.taskId || null, context: c.context || null, createdAt: c.createdAt, read: Boolean(c.readAt)
    };
  }

  function cleanChatContext(c) {
    if (!c || typeof c !== "object") return null;
    const out = {};
    ["prompt", "answer", "lessonTitle", "taskName", "correctAnswer"].forEach(function (k) {
      if (c[k] !== undefined && c[k] !== null && String(c[k]).trim()) out[k] = str(c[k], k === "prompt" ? 600 : 200);
    });
    if (Number.isInteger(c.tries) && c.tries >= 0) out.tries = Math.min(c.tries, 99);
    if (["done", "fix", "todo", "read"].indexOf(c.status) >= 0) out.status = c.status;
    return Object.keys(out).length ? out : null;
  }

  function studentChat(b) {
    const u = requireUser();
    if (u.role !== "student") throw ApiError(403, "Bara elever kan skriva till läraren här.");
    const cls = u.classId && db.classes.find(function (c) { return c.id === u.classId; });
    if (!cls) throw ApiError(400, "Du är inte med i någon klass än.");
    const text = str(b.text, 600).trim();
    if (!text) throw ApiError(400, "Skriv något först.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw ApiError(400, "Ogiltigt id.");
    let open = 0;
    db.chat.filter(function (c) { return c.studentId === u.id; }).forEach(function (c) { open = c.fromTeacher ? 0 : open + 1; });
    if (open >= CHAT_UNANSWERED_MAX) throw ApiError(429, "Du har redan skickat flera meddelanden. Vänta tills din lärare har svarat.");
    const c = { id: db.next.chat++, studentId: u.id, teacherId: cls.teacherId, fromTeacher: false, text: text, lessonId: lessonId, taskId: taskId,
      context: cleanChatContext(b.context), createdAt: nowIso(), readAt: null };
    db.chat.push(c);
    save();
    return { id: c.id };
  }

  function studentChatRead() {
    const u = requireUser();
    const now = nowIso();
    db.chat.forEach(function (c) { if (c.studentId === u.id && c.fromTeacher && !c.readAt) c.readAt = now; });
    save();
    return { ok: true };
  }

  function markChatReadByTeacher(studentId, teacherId) {
    const now = nowIso();
    db.chat.forEach(function (c) { if (c.studentId === studentId && c.teacherId === teacherId && !c.fromTeacher && !c.readAt) c.readAt = now; });
  }

  function teacherChat(b) {
    const t = requireGuide();
    const student = studentOfTeacher(Number(b.studentId), t.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    const text = str(b.text, 600).trim();
    if (!text) throw ApiError(400, "Skriv något först.");
    const c = { id: db.next.chat++, studentId: student.id, teacherId: t.id, fromTeacher: true, text: text, lessonId: null, taskId: null, context: null, createdAt: nowIso(), readAt: null };
    db.chat.push(c);
    markChatReadByTeacher(student.id, t.id);   // answering means having read
    save();
    return { id: c.id };
  }

  function teacherChatRead(b) {
    const t = requireGuide();
    const student = studentOfTeacher(Number(b.studentId), t.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    markChatReadByTeacher(student.id, t.id);
    save();
    return { ok: true };
  }

  function teacherChatUnread() {
    const t = requireGuide();
    return { unread: db.chat.filter(function (c) { return c.teacherId === t.id && !c.fromTeacher && !c.readAt; }).length };
  }

  function markRead(b) {
    const u = requireUser();
    const ids = Array.isArray(b.ids) ? b.ids.slice(0, 100) : [];
    const now = nowIso();
    db.feedback.forEach(function (f) { if (f.studentId === u.id && !f.readAt && ids.indexOf(f.id) >= 0) f.readAt = now; });
    save();
    return { ok: true };
  }

  function listClasses() {
    const u = requireGuide();
    return {
      classes: db.classes.filter(function (c) { return c.teacherId === u.id; }).map(function (c) {
        return { id: c.id, name: c.name, code: c.code, created_at: c.createdAt, students: db.users.filter(function (s) { return s.classId === c.id; }).length, rewards: c.rewards !== false };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, "sv"); })
    };
  }

  function updateClass(id, b) {
    const u = requireGuide();
    const c = db.classes.find(function (x) { return x.id === Number(id) && x.teacherId === u.id; });
    if (!c) throw ApiError(404, "Klassen finns inte.");
    if (typeof b.rewards === "boolean") { c.rewards = b.rewards; save(); }
    return { ok: true };
  }

  // A guide makes the account of a child (a young child has no one else to do it): the name, a user name and a password.
  async function createStudent(b) {
    const u = requireGuide();
    const cls = db.classes.find(function (c) { return c.id === Number(b.classId) && c.teacherId === u.id; });
    if (!cls) throw ApiError(400, "Välj en av dina klasser.");
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw ApiError(400, "Ange namnet.");
    checkPassword(b.password, username);
    if (u.caregiver && db.users.filter(function (s) { return s.classId === cls.id && s.role === "student"; }).length >= FAMILY_MAX) throw ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
    if (db.users.some(function (x) { return x.username === username; })) throw ApiError(409, "Användarnamnet är redan upptaget.");
    const user = { id: db.next.user++, username: username, displayName: displayName, role: "student", passwordHash: await hashPassword(b.password), classId: cls.id, createdAt: nowIso() };
    db.users.push(user);
    save();
    return { student: { id: String(user.id), username: username, name: displayName, classId: cls.id } };
  }

  function createClass(b) {
    const u = requireGuide();
    const name = str(b.name, 60).trim();
    if (!name) throw ApiError(400, "Ge klassen ett namn.");
    if (u.caregiver && db.classes.some(function (c) { return c.teacherId === u.id; })) throw ApiError(400, "Du har redan en familj.");
    const code = newClassCode();
    const cls = { id: db.next.cls++, name: name, code: code, teacherId: u.id, createdAt: nowIso() };
    db.classes.push(cls);
    save();
    return { "class": { id: cls.id, name: name, code: code, students: 0 } };
  }

  function teacherStudents() {
    const u = requireGuide();
    const ids = teacherClassIds(u.id);
    const students = db.users.filter(function (s) { return s.role === "student" && ids.indexOf(s.classId) >= 0; })
      .sort(function (a, b) { return a.displayName.localeCompare(b.displayName, "sv"); })
      .map(function (s) {
        return {
          id: String(s.id), username: s.username, name: s.displayName, "class": className(s), classId: s.classId,
          color: COLORS[s.id % COLORS.length], createdAt: s.createdAt, lessonProgress: progressOf(s.id), attempts: attemptsOf(s.id),
          feedback: db.feedback.filter(function (f) { return f.studentId === s.id && f.teacherId === u.id; }).map(function (f) { return publicFeedback(f, true); }),
          chat: db.chat.filter(function (c) { return c.studentId === s.id && c.teacherId === u.id; }).slice(-300).map(publicChat)
        };
      });
    return { students: students };
  }

  async function resetStudentPassword(studentId) {
    const t = requireGuide();
    const student = studentOfTeacher(Number(studentId), t.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    const temp = randomCode(10);
    student.passwordHash = await hashPassword(temp);
    if (db.session === student.id) db.session = null;
    save();
    return { password: temp };
  }

  // Removes a user and everything that belongs to them. A teacher's classes and students go with the teacher.
  function purgeUser(id) {
    const user = db.users.find(function (u) { return u.id === id; });
    if (!user) return;
    if (user.role === "teacher") {
      db.classes.filter(function (c) { return c.teacherId === id; }).forEach(function (c) { purgeClass(c.id); });
    }
    db.users = db.users.filter(function (u) { return u.id !== id; });
    db.attempts = db.attempts.filter(function (a) { return a.userId !== id; });
    delete db.progress[id];
    db.feedback = db.feedback.filter(function (f) { return f.studentId !== id && f.teacherId !== id; });
    db.chat = db.chat.filter(function (c) { return c.studentId !== id && c.teacherId !== id; });
    db.assignments = db.assignments.filter(function (a) { return a.studentId !== id && a.teacherId !== id; });
    if (db.session === id) db.session = null;
  }

  function purgeClass(classId) {
    db.users.filter(function (u) { return u.classId === classId && u.role === "student"; }).forEach(function (u) { purgeUser(u.id); });
    db.assignments = db.assignments.filter(function (a) { return a.classId !== classId; });
    db.classes = db.classes.filter(function (c) { return c.id !== classId; });
  }

  function deleteStudent(studentId) {
    const t = requireGuide();
    const student = studentOfTeacher(Number(studentId), t.id);
    if (!student) throw ApiError(404, "Eleven finns inte i dina klasser.");
    purgeUser(student.id);
    save();
    return { ok: true };
  }

  function deleteClass(id) {
    const t = requireGuide();
    const cls = db.classes.find(function (c) { return c.id === Number(id) && c.teacherId === t.id; });
    if (!cls) throw ApiError(404, "Klassen finns inte.");
    const students = db.users.filter(function (u) { return u.classId === cls.id && u.role === "student"; }).length;
    purgeClass(cls.id);
    save();
    return { ok: true, students: students };
  }

  async function deleteMyAccount(b) {
    const u = requireUser();
    if (!(await verifyPassword(str(b.password, 200), u.passwordHash))) throw ApiError(400, "Lösenordet stämmer inte.");
    purgeUser(u.id);
    db.session = null;
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
    if (method === "POST" && path === "/api/me/delete") return deleteMyAccount(body);
    if (method === "GET" && path === "/api/me/data") {
      const u = requireUser();
      const isStudent = u.role === "student";
      return {
        progress: progressOf(u.id), attempts: attemptsOf(u.id),
        assignments: isStudent ? db.assignments.filter(function (a) {
          return !a.archived && a.classId === u.classId && (!a.studentId || a.studentId === u.id);
        }).sort(byDue).map(function (a) { return publicAssignment(a, false); }) : [],
        feedback: isStudent ? db.feedback.filter(function (f) { return f.studentId === u.id; }).sort(function (a, b) { return b.id - a.id; }).slice(0, 200)
          .map(function (f) { return publicFeedback(f, false); }) : [],
        chat: isStudent ? db.chat.filter(function (c) { return c.studentId === u.id; }).slice(-200).map(publicChat) : []
      };
    }
    if (method === "POST" && path === "/api/me/feedback/read") return markRead(body);
    if (method === "POST" && path === "/api/me/chat") return studentChat(body);
    if (method === "POST" && path === "/api/me/chat/read") return studentChatRead();
    if (method === "POST" && path === "/api/teacher/chat") return teacherChat(body);
    if (method === "POST" && path === "/api/teacher/chat/read") return teacherChatRead(body);
    if (method === "GET" && path === "/api/teacher/chat/unread") return teacherChatUnread();
    if ((m = /^\/api\/progress\/([^/]+)$/.exec(path)) && method === "PUT") return putProgress(decodeURIComponent(m[1]), body);
    if (method === "POST" && path === "/api/attempts") return postAttempt(body);
    if (method === "GET" && path === "/api/lessons") { requireUser(); return { lessons: Object.keys(db.lessons).map(function (k) { return copy(db.lessons[k]); }) }; }
    if ((m = /^\/api\/lessons\/([^/]+)$/.exec(path)) && method === "PUT") return putLesson(decodeURIComponent(m[1]), body);
    if (method === "GET" && path === "/api/teacher/classes") return listClasses();
    if (method === "POST" && path === "/api/teacher/classes") return createClass(body);
    if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(path)) && method === "PUT") return updateClass(m[1], body);
    if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(path)) && method === "DELETE") return deleteClass(m[1]);
    if (method === "GET" && path === "/api/teacher/students") return teacherStudents();
    if (method === "POST" && path === "/api/teacher/students") return createStudent(body);
    if (method === "GET" && path === "/api/teacher/assignments") return listAssignments();
    if (method === "POST" && path === "/api/teacher/assignments") return createAssignment(body);
    if ((m = /^\/api\/teacher\/assignments\/(\d+)$/.exec(path)) && method === "DELETE") return archiveAssignment(m[1]);
    if (method === "POST" && path === "/api/teacher/feedback") return createFeedback(body);
    if ((m = /^\/api\/teacher\/feedback\/(\d+)$/.exec(path)) && method === "DELETE") return removeFeedback(m[1]);
    if ((m = /^\/api\/teacher\/students\/(\d+)\/password$/.exec(path)) && method === "POST") return resetStudentPassword(m[1]);
    if ((m = /^\/api\/teacher\/students\/(\d+)$/.exec(path)) && method === "DELETE") return deleteStudent(m[1]);
    throw ApiError(404, "Hittades inte.");
  }

  return { handle: handle, teacherCode: TEACHER_CODE, isMemoryOnly: function () { return memoryOnly; } };
}());
