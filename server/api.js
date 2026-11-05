"use strict";
// JSON API under /api. All state-changing requests need a session cookie (SameSite=Lax),
// a same-origin Origin header and a JSON body.

const sec = require("./security");
const { createAccount } = require("./account");

const COOKIE = "gs";
const SESSION_DAYS = 30;
const COLORS = ["#425b9a", "#ef6f88", "#4fa8dc", "#8a74c9", "#d99a2b", "#2f9d88", "#7a8db8"];
const ID_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const CHAT_UNANSWERED_MAX = 6;   // a student can send this many messages in a row before the teacher has answered
const STICKERS = ["star", "thumbs", "muscle", "rocket", "bulb", "party", "heart", "mynt5", "mynt10", "mynt25"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FAMILY_MAX = 10;   // children in the family of a caregiver

class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
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
  const feedbackLimit = sec.createLimiter(5, 60 * 60 * 1000);
  setInterval(function () {
    loginIpLimit.sweep(); loginUserLimit.sweep(); registerLimit.sweep(); feedbackLimit.sweep();
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  }, 10 * 60 * 1000).unref();

  const q = {
    userByName: db.prepare("SELECT * FROM users WHERE username = ?"),
    userById: db.prepare("SELECT u.*, c.name AS class_name, g.caregiver AS guide_caregiver, COALESCE(cs.rewards, 1) AS rewards FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN users g ON g.id = c.teacher_id LEFT JOIN class_settings cs ON cs.class_id = u.class_id WHERE u.id = ?"),
    insertUser: db.prepare("INSERT INTO users (username, display_name, role, password_hash, class_id, created_at, caregiver) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    countClassStudents: db.prepare("SELECT COUNT(*) AS n FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND u.role = 'student'"),
    insertMember: db.prepare("INSERT OR IGNORE INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)"),
    deleteMember: db.prepare("DELETE FROM class_members WHERE class_id = ? AND user_id = ?"),
    classesOfStudent: db.prepare(
      "SELECT c.id, c.name, c.code, g.caregiver AS owner_caregiver, COALESCE(cs.rewards, 1) AS rewards FROM class_members m JOIN classes c ON c.id = m.class_id " +
      "JOIN users g ON g.id = c.teacher_id LEFT JOIN class_settings cs ON cs.class_id = c.id WHERE m.user_id = ? ORDER BY m.joined_at, c.id"),
    isMember: db.prepare("SELECT 1 AS x FROM class_members WHERE class_id = ? AND user_id = ?"),
    setPrimaryClass: db.prepare("UPDATE users SET class_id = ? WHERE id = ?"),
    insertGuide: db.prepare("INSERT OR IGNORE INTO class_guides (class_id, user_id) VALUES (?, ?)"),
    deleteGuide: db.prepare("DELETE FROM class_guides WHERE class_id = ? AND user_id = ?"),
    guidesOfClass: db.prepare("SELECT u.id, u.display_name, u.caregiver FROM class_guides cg JOIN users u ON u.id = cg.user_id WHERE cg.class_id = ? ORDER BY cg.rowid"),
    classByGuideCode: db.prepare("SELECT * FROM classes WHERE guide_code = ?"),
    sharedClasses: db.prepare(
      "SELECT c.* FROM classes c JOIN class_members m ON m.class_id = c.id JOIN class_guides cg ON cg.class_id = c.id WHERE m.user_id = ? AND cg.user_id = ? ORDER BY c.id"),
    otherClassCount: db.prepare("SELECT COUNT(*) AS n FROM class_members WHERE user_id = ? AND class_id != ?"),
    deleteClassFeedback: db.prepare("DELETE FROM feedback WHERE class_id = ?"),
    deleteClassChat: db.prepare("DELETE FROM chat WHERE class_id = ?"),
    deleteFeedbackOf: db.prepare("DELETE FROM feedback WHERE student_id = ? AND class_id = ?"),
    deleteChatOf: db.prepare("DELETE FROM chat WHERE student_id = ? AND class_id = ?"),
    countClassesOf: db.prepare("SELECT COUNT(*) AS n FROM classes WHERE teacher_id = ?"),
    classOwner: db.prepare("SELECT u.caregiver AS caregiver FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.id = ?"),
    classByCode: db.prepare("SELECT * FROM classes WHERE code = ?"),
    insertClass: db.prepare("INSERT INTO classes (name, code, guide_code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?)"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    sessionUser: db.prepare(
      "SELECT u.*, c.name AS class_name, g.caregiver AS guide_caregiver, COALESCE(cs.rewards, 1) AS rewards FROM sessions s JOIN users u ON u.id = s.user_id " +
      "LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN users g ON g.id = c.teacher_id LEFT JOIN class_settings cs ON cs.class_id = u.class_id WHERE s.token_hash = ? AND s.expires_at > ?"),
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
      "SELECT c.id, c.name, c.code, c.guide_code, c.teacher_id, c.created_at, (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS students, " +
      "COALESCE((SELECT rewards FROM class_settings WHERE class_id = c.id), 1) AS rewards " +
      "FROM classes c JOIN class_guides cg ON cg.class_id = c.id WHERE cg.user_id = ? ORDER BY c.name"),
    setRewards: db.prepare("INSERT INTO class_settings (class_id, rewards) VALUES (?, ?) ON CONFLICT (class_id) DO UPDATE SET rewards = excluded.rewards"),
    teacherStudents: db.prepare(
      "SELECT u.id, u.username, u.display_name, u.created_at, GROUP_CONCAT(c.name, ' · ') AS class_name, GROUP_CONCAT(c.id) AS class_ids FROM users u " +
      "JOIN class_members m ON m.user_id = u.id JOIN class_guides cg ON cg.class_id = m.class_id AND cg.user_id = ? JOIN classes c ON c.id = m.class_id " +
      "WHERE u.role = 'student' GROUP BY u.id ORDER BY u.display_name"),
    studentOfTeacher: db.prepare(
      "SELECT u.* FROM users u WHERE u.id = ? AND u.role = 'student' AND EXISTS " +
      "(SELECT 1 FROM class_members m JOIN class_guides cg ON cg.class_id = m.class_id WHERE m.user_id = u.id AND cg.user_id = ?)"),
    deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
    deleteClass: db.prepare("DELETE FROM classes WHERE id = ?"),
    studentIdsOfClass: db.prepare("SELECT m.user_id AS id FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND u.role = 'student'"),
    classIdsOfTeacher: db.prepare("SELECT id FROM classes WHERE teacher_id = ?"),
    deleteSiteFeedbackBy: db.prepare("DELETE FROM site_feedback WHERE sender = ?"),
    classOfTeacher: db.prepare("SELECT c.* FROM classes c JOIN class_guides cg ON cg.class_id = c.id WHERE c.id = ? AND cg.user_id = ?"),
    classOwnedBy: db.prepare("SELECT * FROM classes WHERE id = ? AND teacher_id = ?"),
    insertAssignment: db.prepare("INSERT INTO assignments (class_id, student_id, teacher_id, lesson_id, note, due_date, created_at, kind, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    assignmentsForStudent: db.prepare(
      "SELECT a.id, a.lesson_id, a.kind, a.config, a.note, a.due_date, a.created_at, u.display_name AS teacher FROM assignments a JOIN users u ON u.id = a.teacher_id " +
      "WHERE a.archived = 0 AND a.class_id IN (SELECT class_id FROM class_members WHERE user_id = ?) AND (a.student_id IS NULL OR a.student_id = ?) ORDER BY a.due_date IS NULL, a.due_date, a.id"),
    assignmentsForTeacher: db.prepare(
      "SELECT a.id, a.class_id, a.student_id, a.lesson_id, a.kind, a.config, a.note, a.due_date, a.created_at, c.name AS class_name, s.display_name AS student_name " +
      "FROM assignments a JOIN classes c ON c.id = a.class_id LEFT JOIN users s ON s.id = a.student_id " +
      "WHERE a.archived = 0 AND a.class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY a.due_date IS NULL, a.due_date, a.id"),
    archiveAssignment: db.prepare("UPDATE assignments SET archived = 1 WHERE id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?)"),
    insertFeedback: db.prepare("INSERT INTO feedback (student_id, teacher_id, lesson_id, task_id, text, sticker, created_at, class_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    feedbackForStudent: db.prepare(
      "SELECT f.id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at, u.display_name AS teacher FROM feedback f " +
      "JOIN users u ON u.id = f.teacher_id WHERE f.student_id = ? ORDER BY f.id DESC LIMIT 200"),
    feedbackForTeacher: db.prepare(
      "SELECT f.id, f.student_id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at FROM feedback f WHERE f.class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY f.id"),
    markFeedbackRead: db.prepare("UPDATE feedback SET read_at = ? WHERE id = ? AND student_id = ? AND read_at IS NULL"),
    deleteFeedback: db.prepare("DELETE FROM feedback WHERE id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?)"),
    insertSiteFeedback: db.prepare("INSERT INTO site_feedback (kind, text, email, page, context, sender, agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    siteFeedbackEmailed: db.prepare("UPDATE site_feedback SET emailed = 1 WHERE id = ?"),
    classTeacher: db.prepare("SELECT teacher_id FROM classes WHERE id = ?"),
    insertChat: db.prepare("INSERT INTO chat (student_id, teacher_id, from_teacher, text, lesson_id, task_id, context, created_at, class_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    chatForStudent: db.prepare(
      "SELECT c.id, c.student_id, c.from_teacher, c.text, c.lesson_id, c.task_id, c.context, c.created_at, c.read_at, c.class_id, u.display_name AS guide " +
      "FROM chat c LEFT JOIN users u ON u.id = c.teacher_id AND c.from_teacher = 1 WHERE c.student_id = ? ORDER BY c.id DESC LIMIT 200"),
    chatForTeacher: db.prepare(
      "SELECT id, student_id, from_teacher, text, lesson_id, task_id, context, created_at, read_at, class_id FROM chat WHERE class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY id DESC LIMIT 1000"),
    chatUnanswered: db.prepare(
      "SELECT COUNT(*) AS n FROM chat WHERE student_id = ? AND from_teacher = 0 AND id > COALESCE((SELECT MAX(id) FROM chat WHERE student_id = ? AND from_teacher = 1), 0)"),
    chatReadByStudent: db.prepare("UPDATE chat SET read_at = ? WHERE student_id = ? AND from_teacher = 1 AND read_at IS NULL"),
    chatReadByTeacher: db.prepare("UPDATE chat SET read_at = ? WHERE student_id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) AND from_teacher = 0 AND read_at IS NULL"),
    chatUnreadForTeacher: db.prepare("SELECT COUNT(*) AS n FROM chat WHERE class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) AND from_teacher = 0 AND read_at IS NULL"),
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

  function readRaw(req, limit) {
    return new Promise(function (resolve, reject) {
      let size = 0;
      const chunks = [];
      req.on("data", function (chunk) {
        size += chunk.length;
        if (size > limit) { reject(new ApiError(413, "För stor förfrågan.")); req.destroy(); return; }
        chunks.push(chunk);
      });
      req.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
      req.on("error", reject);
    });
  }

  function send(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(json);
  }

  // A caregiver is stored as a teacher with the flag `caregiver`; the site is told the role "caregiver". A student whose class belongs to a
  // caregiver (a family) gets guide: "caregiver", so that the pages can say vårdnadshavare where they say lärare.
  function publicUser(u) {
    // a student can be in several classes: a school class and a family. guide is "caregiver" when all of them are families, "teacher" when
    // none is, and "both" when there are both kinds. Stars and animals are on when any of the classes has them on.
    const classes = u.role === "student" ? q.classesOfStudent.all(u.id) : [];
    const families = classes.filter(function (c) { return c.owner_caregiver; }).length;
    return {
      id: u.id, username: u.username, name: u.display_name, role: u.role === "teacher" && u.caregiver ? "caregiver" : u.role,
      guide: u.role === "student" ? (!classes.length ? "teacher" : families === classes.length ? "caregiver" : families ? "both" : "teacher") : undefined,
      classId: classes.length ? classes[0].id : (u.class_id || null), className: classes.length ? classes.map(function (c) { return c.name; }).join(" · ") : (u.class_name || null),
      classes: u.role === "student" ? classes.map(function (c) { return { id: c.id, name: c.name, family: Boolean(c.owner_caregiver) }; }) : undefined,
      email: u.role === "teacher" ? (u.email || null) : undefined, emailVerified: u.role === "teacher" ? Boolean(u.email_verified_at) : undefined,
      access: account.accessOfUser(u),
      color: COLORS[u.id % COLORS.length],
      rewards: u.role === "student" && classes.length ? classes.some(function (c) { return Boolean(c.rewards); }) : (u.rewards === undefined || u.rewards === null ? true : Boolean(u.rewards))
    };
  }

  function requireUser(req) {
    const s = currentSession(req);
    if (!s) throw new ApiError(401, "Du måste logga in.");
    return s;
  }

  // Teachers and caregivers: everything about their classes. Only teachers may edit lessons (requireTeacher).
  function requireGuide(req) {
    const s = requireUser(req);
    if (s.user.role !== "teacher") throw new ApiError(403, "Endast lärare och vårdnadshavare har tillgång.");
    return s;
  }

  function requireTeacher(req) {
    const s = requireGuide(req);
    if (s.user.caregiver) throw new ApiError(403, "Endast lärare kan ändra lektioner.");
    return s;
  }

  function caregiverSignup() { return process.env.CAREGIVER_SIGNUP !== "off"; }

  function familyName(displayName) {
    const last = String(displayName).trim().split(/\s+/).pop();
    return "Familjen " + last;
  }

  function newClassCode() {
    let code;
    for (let i = 0; i < 10; i++) {
      code = sec.randomCode(6);
      if (!q.classByCode.get(code)) break;
    }
    return code;
  }

  // The code that makes another adult a guide of a class (the other parent, a second teacher). It is longer than the code of the students.
  function newGuideCode() {
    let code;
    for (let i = 0; i < 10; i++) {
      code = "V" + sec.randomCode(9);
      if (!q.classByGuideCode.get(code)) break;
    }
    return code;
  }

  // A class with its owner as its first guide.
  function makeClass(name, ownerId) {
    const id = Number(q.insertClass.run(name, newClassCode(), newGuideCode(), ownerId, nowIso()).lastInsertRowid);
    q.insertGuide.run(id, ownerId);
    return id;
  }

  // The first class of a student is kept in users.class_id (for the old code and for the name shown); it follows the memberships.
  function fixPrimaryClass(userId) {
    const list = q.classesOfStudent.all(userId);
    q.setPrimaryClass.run(list.length ? list[0].id : null, userId);
  }

  function addMember(classId, userId) {
    q.insertMember.run(classId, userId, nowIso());
    const u = q.userById.get(userId);
    if (u && !u.class_id) q.setPrimaryClass.run(classId, userId);
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
    const kind = b.role === "teacher" ? "teacher" : b.role === "caregiver" ? "caregiver" : "student";
    const role = kind === "student" ? "student" : "teacher";
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw new ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw new ApiError(400, "Ange ditt namn.");
    checkPassword(b.password, username);
    // an adult can give an e-mail address (to verify it and to reset a lost password); a caregiver has to when the site is set up for it, and accepts the terms
    const email = account.cleanEmail(b.email);
    if (email && !account.validEmail(email)) throw new ApiError(400, "E-postadressen ser inte rätt ut.");
    if (kind === "caregiver" && account.emailRequired()) {
      if (!email) throw new ApiError(400, "Ange din e-postadress. Den behövs om du glömmer lösenordet.");
      if (b.acceptTerms !== true) throw new ApiError(400, "Du behöver godkänna villkoren och läsa integritetstexten.");
    }
    if (email && role === "student") throw new ApiError(400, "Barn har ingen e-postadress.");
    if (email && account.emailTaken(email)) throw new ApiError(409, "Den e-postadressen går inte att använda. Har du redan ett konto? Logga in med det.");

    let classId = null;
    let joinClass = null;   // a caregiver who joins the family of somebody else
    if (role === "student") {
      const cls = q.classByCode.get(sec.normalizeCode(b.classCode));
      if (!cls) throw new ApiError(400, "Koden stämmer inte. Fråga din lärare eller vårdnadshavare efter rätt kod.");
      const owner = q.classOwner.get(cls.id);
      if (owner && owner.caregiver && q.countClassStudents.get(cls.id).n >= FAMILY_MAX) throw new ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
      classId = cls.id;
    } else if (kind === "caregiver") {
      if (!caregiverSignup()) throw new ApiError(403, "Konton för vårdnadshavare är avstängda här.");
      if (str(b.guideCode, 40).trim()) {
        joinClass = q.classByGuideCode.get(sec.normalizeCode(b.guideCode));
        if (!joinClass) throw new ApiError(400, "Koden för vuxna stämmer inte. Fråga den som skapade familjen.");
      }
    } else if (!sec.safeEqual(sec.normalizeCode(b.teacherCode), teacherCode())) {
      throw new ApiError(403, "Lärarkoden stämmer inte.");
    }

    if (q.userByName.get(username)) throw new ApiError(409, "Användarnamnet är redan upptaget.");
    const hash = await sec.hashPassword(b.password);
    let userId;
    try {
      userId = Number(q.insertUser.run(username, displayName, role, hash, classId, nowIso(), kind === "caregiver" ? 1 : 0).lastInsertRowid);
    } catch (e) {
      throw new ApiError(409, "Användarnamnet är redan upptaget.");
    }
    if (role === "student") addMember(classId, userId);
    // a caregiver starts with a family, so there is a code to give the children at once, or joins the family of the other adult
    if (kind === "caregiver") { if (joinClass) q.insertGuide.run(joinClass.id, userId); else makeClass(familyName(displayName), userId); }
    if (email) account.setEmail(userId, email);
    if (kind === "caregiver" && b.acceptTerms === true) account.setTerms(userId);
    // a family that starts one has a trial (or free access while the site charges nobody); a second adult joins the access of the family
    if (kind === "caregiver" && !joinClass) account.startEntitlement(userId);
    if (email) account.sendVerification(Object.assign({}, q.userById.get(userId), { email: email })).catch(function () { /* the account is made whether the mail goes or not */ });
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
    const student = s.user.role === "student";
    send(res, 200, {
      progress: progressOf(s.user.id), attempts: attemptsOf(s.user.id),
      assignments: student ? q.assignmentsForStudent.all(s.user.id, s.user.id).map(publicAssignment) : [],
      feedback: s.user.role === "student" ? q.feedbackForStudent.all(s.user.id).map(publicFeedback) : [],
      chat: s.user.role === "student" ? q.chatForStudent.all(s.user.id).reverse().map(publicChat) : []
    });
  }

  // How a signed-in sender is written in site_feedback (and the e-mail), so that the messages can be found again when the
  // account is deleted.
  function senderLabel(u) {
    return u.display_name + " (" + (u.role === "teacher" ? (u.caregiver ? "vårdnadshavare" : "lärare") : "elev") + (u.class_name ? ", klass " + u.class_name : "") + ")";
  }

  // ----- feedback about the site, sent by e-mail to whoever runs it -----
  // Set RESEND_API_KEY and FEEDBACK_TO (and optionally FEEDBACK_FROM) to get an e-mail for every message.
  // Without them the messages are only saved in the table site_feedback.
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
    const key = process.env.RESEND_API_KEY, to = process.env.FEEDBACK_TO;
    if (!key || !to) return false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          from: process.env.FEEDBACK_FROM || "Gaussica <onboarding@resend.dev>", to: [to],
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

  async function postFeedback(req, res) {
    const b = await readJson(req, 12000);
    if (b.website) return send(res, 201, { ok: true, emailed: false });   // hidden field only a robot fills in
    const kind = FEEDBACK_KINDS[b.kind] ? b.kind : "annat";
    const text = str(b.text, 2000).trim();
    if (text.length < 3) throw new ApiError(400, "Skriv en rad eller två först.");
    const email = str(b.email, 120).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "E-postadressen ser inte rätt ut. Lämna fältet tomt om du inte vill ha svar.");
    const wait = feedbackLimit.check(ip(req));
    if (wait) throw new ApiError(429, "Du har skickat flera meddelanden på kort tid. Försök igen om en stund.");
    const s = currentSession(req);
    const sender = s ? senderLabel(s.user) : "Inte inloggad";
    const context = cleanChatContext(b.context);
    const f = {
      kind: kind, text: text, email: email || null, page: str(b.page, 200) || null, context: context ? JSON.parse(context) : null,
      sender: sender, agent: str(req.headers["user-agent"], 200) || null
    };
    const id = Number(q.insertSiteFeedback.run(f.kind, f.text, f.email, f.page, context, f.sender, f.agent, nowIso()).lastInsertRowid);
    const emailed = await mailFeedback(f);
    if (emailed) q.siteFeedbackEmailed.run(id);
    send(res, 201, { ok: true, emailed: emailed });
  }

  // ----- chat between a student and the teacher of their class -----
  function publicChat(r) {
    let context = null;
    try { context = r.context ? JSON.parse(r.context) : null; } catch (e) { /* skip corrupt context */ }
    return {
      id: r.id, studentId: String(r.student_id), fromTeacher: Boolean(r.from_teacher), text: r.text, classId: r.class_id || null, guide: r.guide || null,
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
    const b = await readJson(req, 8000);
    // to the guides of one of the classes of the student: the one asked for, or the first
    const mine = q.classesOfStudent.all(s.user.id);
    if (!mine.length) throw new ApiError(400, "Du är inte med i någon klass än.");
    const chosen = b.classId === undefined || b.classId === null ? mine[0] : mine.find(function (c) { return c.id === Number(b.classId); });
    if (!chosen) throw new ApiError(400, "Du är inte med i den klassen.");
    const teacher = q.classTeacher.get(chosen.id);
    if (!teacher) throw new ApiError(400, "Klassen har ingen lärare.");
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw new ApiError(400, "Ogiltigt id.");
    if (q.chatUnanswered.get(s.user.id, s.user.id).n >= CHAT_UNANSWERED_MAX) {
      throw new ApiError(429, "Du har redan skickat flera meddelanden. Vänta tills din lärare har svarat.");
    }
    const id = Number(q.insertChat.run(s.user.id, teacher.teacher_id, 0, text, lessonId, taskId, cleanChatContext(b.context), nowIso(), chosen.id).lastInsertRowid);
    send(res, 201, { id: id });
  }

  function studentChatRead(req, res) {
    const s = requireUser(req);
    q.chatReadByStudent.run(nowIso(), s.user.id);
    send(res, 200, { ok: true });
  }

  async function teacherChat(req, res) {
    const s = requireGuide(req);
    const b = await readJson(req, 5000);
    const student = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    // the answer goes to the class the question came from (the last one that was asked), or else the first class the two have in common
    const shared = q.sharedClasses.all(student.id, s.user.id);
    const asked = q.chatForTeacher.all(s.user.id).find(function (r) { return r.student_id === student.id && !r.from_teacher; });
    const cls = (b.classId !== undefined && shared.find(function (c) { return c.id === Number(b.classId); })) || (asked && shared.find(function (c) { return c.id === asked.class_id; })) || shared[0];
    const id = Number(q.insertChat.run(student.id, s.user.id, 1, text, null, null, null, nowIso(), cls.id).lastInsertRowid);
    q.chatReadByTeacher.run(nowIso(), student.id, s.user.id);   // answering means having read
    send(res, 201, { id: id });
  }

  async function teacherChatRead(req, res) {
    const s = requireGuide(req);
    const b = await readJson(req, 2000);
    const student = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    q.chatReadByTeacher.run(nowIso(), student.id, s.user.id);
    send(res, 200, { ok: true });
  }

  function teacherChatUnread(req, res) {
    const s = requireGuide(req);
    send(res, 200, { unread: q.chatUnreadForTeacher.get(s.user.id).n });
  }

  function publicAssignment(r) {
    let config = null;
    if (r.config) { try { config = JSON.parse(r.config); } catch (e) { /* corrupt row: shown without settings */ } }
    return {
      id: r.id, lessonId: r.lesson_id, kind: r.kind || "lesson", config: config, note: r.note, dueDate: r.due_date, createdAt: r.created_at, teacher: r.teacher || null,
      classId: r.class_id || null, className: r.class_name || null, studentId: r.student_id || null, studentName: r.student_name || null
    };
  }

  // The settings of a prov: { title, lessons: [ids], perLesson, minutes (0 = no time limit), showResult }
  function cleanProv(c) {
    if (!c || typeof c !== "object") throw new ApiError(400, "Provet saknar inställningar.");
    const lessons = (Array.isArray(c.lessons) ? c.lessons : []).map(function (x) { return str(x, 80); }).filter(function (x, i, a) { return ID_RE.test(x) && a.indexOf(x) === i; }).slice(0, 12);
    if (!lessons.length) throw new ApiError(400, "Välj minst en lektion till provet.");
    const int = function (v, lo, hi, d) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    return { title: str(c.title, 80).trim() || "Prov", lessons: lessons, perLesson: int(c.perLesson, 1, 20, 4), minutes: int(c.minutes, 0, 240, 0), showResult: c.showResult !== false };
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
    if (s.user.role === "student") account.requireAccess(s.user);
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
    if (s.user.role === "student") account.requireAccess(s.user);
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
    const s = requireGuide(req);
    send(res, 200, { classes: q.teacherClasses.all(s.user.id).map(function (c) {
      const own = c.teacher_id === s.user.id;
      return {
        id: c.id, name: c.name, code: c.code, created_at: c.created_at, students: c.students, rewards: Boolean(c.rewards),
        owner: own, guideCode: own ? c.guide_code : null,
        guides: q.guidesOfClass.all(c.id).map(function (g) { return { id: g.id, name: g.display_name, caregiver: Boolean(g.caregiver), owner: g.id === c.teacher_id, you: g.id === s.user.id }; })
      };
    }) });
  }

  // Another adult joins a class as a guide (the other parent joins the family) with the code for adults.
  async function joinAsGuide(req, res) {
    const s = requireGuide(req);
    const b = await readJson(req, 2000);
    const cls = q.classByGuideCode.get(sec.normalizeCode(b.guideCode));
    if (!cls) throw new ApiError(400, "Koden för vuxna stämmer inte. Fråga den som skapade klassen eller familjen.");
    q.insertGuide.run(cls.id, s.user.id);
    send(res, 200, { ok: true, classId: cls.id, name: cls.name });
  }

  // The owner removes a guide; a guide who is not the owner can leave. The owner cannot leave (the class is deleted instead).
  function removeGuide(req, res, classId, userId) {
    const s = requireGuide(req);
    const cls = q.classOfTeacher.get(Number(classId), s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte.");
    const target = Number(userId);
    if (target === cls.teacher_id) throw new ApiError(400, "Den som skapade klassen kan inte lämna den. Radera klassen i stället.");
    if (target !== s.user.id && cls.teacher_id !== s.user.id) throw new ApiError(403, "Bara den som skapade klassen kan ta bort en annan vuxen.");
    q.deleteGuide.run(cls.id, target);
    send(res, 200, { ok: true });
  }

  // A student joins another class with its code (a school class, a family), or leaves one.
  async function joinClass(req, res) {
    const s = requireUser(req);
    if (s.user.role !== "student") throw new ApiError(403, "Bara elever kan gå med i en klass.");
    const b = await readJson(req, 2000);
    const cls = q.classByCode.get(sec.normalizeCode(b.classCode));
    if (!cls) throw new ApiError(400, "Koden stämmer inte. Fråga din lärare eller vårdnadshavare efter rätt kod.");
    const owner = q.classOwner.get(cls.id);
    if (owner && owner.caregiver && !q.isMember.get(cls.id, s.user.id) && q.countClassStudents.get(cls.id).n >= FAMILY_MAX) throw new ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
    addMember(cls.id, s.user.id);
    send(res, 200, { user: publicUser(q.userById.get(s.user.id)) });
  }

  function leaveClass(req, res, classId) {
    const s = requireUser(req);
    if (s.user.role !== "student") throw new ApiError(403, "Bara elever kan lämna en klass.");
    const id = Number(classId);
    if (!q.isMember.get(id, s.user.id)) throw new ApiError(404, "Du är inte med i den klassen.");
    inTransaction(function () {
      q.deleteMember.run(id, s.user.id);
      fixPrimaryClass(s.user.id);
    });
    send(res, 200, { user: publicUser(q.userById.get(s.user.id)) });
  }

  async function updateClass(req, res, id) {
    const s = requireGuide(req);
    const cls = q.classOfTeacher.get(Number(id), s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte.");
    const b = await readJson(req, 2000);
    if (typeof b.rewards === "boolean") q.setRewards.run(cls.id, b.rewards ? 1 : 0);
    send(res, 200, { ok: true });
  }

  async function createClass(req, res) {
    const s = requireGuide(req);
    const b = await readJson(req, 2000);
    const name = str(b.name, 60).trim();
    if (!name) throw new ApiError(400, "Ge klassen ett namn.");
    if (s.user.caregiver && q.countClassesOf.get(s.user.id).n >= 1) throw new ApiError(400, "Du har redan en familj.");
    const id = makeClass(name, s.user.id);
    const made = q.classOwnedBy.get(id, s.user.id);
    send(res, 201, { class: { id: id, name: name, code: made.code, guideCode: made.guide_code, students: 0, owner: true } });
  }

  // A guide makes the account of a child (a young child has no one else to do it): the name, a user name and a password.
  async function createStudent(req, res) {
    const s = requireGuide(req);
    const b = await readJson(req, 5000);
    const cls = q.classOfTeacher.get(Number(b.classId), s.user.id);
    if (!cls) throw new ApiError(400, "Välj en av dina klasser.");
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw new ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw new ApiError(400, "Ange namnet.");
    checkPassword(b.password, username);
    if (s.user.caregiver && q.countClassStudents.get(cls.id).n >= FAMILY_MAX) throw new ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
    if (q.userByName.get(username)) throw new ApiError(409, "Användarnamnet är redan upptaget.");
    let id;
    try {
      id = Number(q.insertUser.run(username, displayName, "student", await sec.hashPassword(b.password), cls.id, nowIso(), 0).lastInsertRowid);
    } catch (e) {
      throw new ApiError(409, "Användarnamnet är redan upptaget.");
    }
    q.insertMember.run(cls.id, id, nowIso());
    send(res, 201, { student: { id: String(id), username: username, name: displayName, classId: cls.id } });
  }

  function teacherStudents(req, res) {
    const s = requireGuide(req);
    const sent = {};
    q.feedbackForTeacher.all(s.user.id).forEach(function (r) { (sent[r.student_id] = sent[r.student_id] || []).push(publicFeedback(r)); });
    const chat = {};
    q.chatForTeacher.all(s.user.id).reverse().forEach(function (r) { (chat[r.student_id] = chat[r.student_id] || []).push(publicChat(r)); });
    const students = q.teacherStudents.all(s.user.id).map(function (u) {
      return {
        feedback: sent[u.id] || [], chat: chat[u.id] || [],
        id: String(u.id), username: u.username, name: u.display_name, class: u.class_name, classIds: String(u.class_ids).split(",").map(Number), classId: Number(String(u.class_ids).split(",")[0]),
        color: COLORS[u.id % COLORS.length], createdAt: u.created_at,
        lessonProgress: progressOf(u.id), attempts: attemptsOf(u.id)
      };
    });
    send(res, 200, { students: students });
  }

  // ----- assignments and feedback (teacher) -----
  function listAssignments(req, res) {
    const s = requireGuide(req);
    send(res, 200, { assignments: q.assignmentsForTeacher.all(s.user.id).map(publicAssignment) });
  }

  async function createAssignment(req, res) {
    const s = requireGuide(req);
    const b = await readJson(req, 5000);
    const cls = q.classOfTeacher.get(Number(b.classId), s.user.id);
    if (!cls) throw new ApiError(400, "Välj en av dina klasser.");
    let studentId = null;
    if (b.studentId !== undefined && b.studentId !== null && b.studentId !== "") {
      const st = q.studentOfTeacher.get(Number(b.studentId), s.user.id);
      if (!st || !q.isMember.get(cls.id, st.id)) throw new ApiError(400, "Eleven går inte i den klassen.");
      studentId = st.id;
    }
    const lessonId = str(b.lessonId, 80);
    if (!ID_RE.test(lessonId)) throw new ApiError(400, "Välj en lektion.");
    const dueDate = str(b.dueDate, 10);
    if (dueDate && (!DATE_RE.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) throw new ApiError(400, "Ogiltigt datum.");
    const note = str(b.note, 400).trim();
    const kind = b.kind === "practice" ? "practice" : b.kind === "prov" ? "prov" : "lesson";
    const config = kind === "prov" ? cleanProv(b.config) : null;
    const id = Number(q.insertAssignment.run(cls.id, studentId, s.user.id, kind === "prov" ? config.lessons[0] : lessonId, note, dueDate || null, nowIso(), kind, config ? JSON.stringify(config) : null).lastInsertRowid);
    send(res, 201, { id: id });
  }

  function archiveAssignment(req, res, id) {
    const s = requireGuide(req);
    q.archiveAssignment.run(Number(id), s.user.id);
    send(res, 200, { ok: true });
  }

  async function createFeedback(req, res) {
    const s = requireGuide(req);
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
    const shared = q.sharedClasses.all(student.id, s.user.id);
    const cls = (b.classId !== undefined && shared.find(function (c) { return c.id === Number(b.classId); })) || shared[0];
    const id = Number(q.insertFeedback.run(student.id, s.user.id, lessonId, taskId, text, sticker, nowIso(), cls.id).lastInsertRowid);
    send(res, 201, { id: id });
  }

  function removeFeedback(req, res, id) {
    const s = requireGuide(req);
    q.deleteFeedback.run(Number(id), s.user.id);
    send(res, 200, { ok: true });
  }

  async function resetStudentPassword(req, res, studentId) {
    const s = requireGuide(req);
    const student = q.studentOfTeacher.get(Number(studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    const temp = sec.randomCode(10);
    q.setPassword.run(await sec.hashPassword(temp), student.id);
    q.deleteUserSessions.run(student.id);
    send(res, 200, { password: temp });
  }

  // Removing a user removes everything that belongs to them (progress, answers, messages, sessions) through the foreign keys;
  // messages the person sent through the feedback form are found by the sender text.
  function inTransaction(fn) {
    db.exec("BEGIN");
    try { fn(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
  }

  function purgeUser(id) {
    const u = q.userById.get(id);
    if (!u) return;
    q.deleteSiteFeedbackBy.run(senderLabel(u));
    q.deleteUser.run(id);
  }

  // The students of a class lose it; those who have no other class are deleted with everything about them. What belongs to the class (messages, cheers,
  // assignments) goes too.
  function purgeClass(classId) {
    q.studentIdsOfClass.all(classId).forEach(function (r) {
      if (q.otherClassCount.get(r.id, classId).n === 0) { purgeUser(r.id); return; }
      q.deleteMember.run(classId, r.id);
      fixPrimaryClass(r.id);
    });
    q.deleteClassFeedback.run(classId);
    q.deleteClassChat.run(classId);
    q.deleteClass.run(classId);
  }

  function deleteStudent(req, res, studentId) {
    const s = requireGuide(req);
    const student = q.studentOfTeacher.get(Number(studentId), s.user.id);
    if (!student) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    // the student leaves the classes the two share; the account goes when no class is left
    inTransaction(function () {
      q.sharedClasses.all(student.id, s.user.id).forEach(function (c) {
        q.deleteMember.run(c.id, student.id);
        q.deleteFeedbackOf.run(student.id, c.id);
        q.deleteChatOf.run(student.id, c.id);
      });
      if (!q.classesOfStudent.all(student.id).length) purgeUser(student.id); else fixPrimaryClass(student.id);
    });
    send(res, 200, { ok: true });
  }

  // A class is removed together with all its students and their data (end of the school year).
  function deleteClass(req, res, id) {
    const s = requireGuide(req);
    const cls = q.classOwnedBy.get(Number(id), s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte, eller så är det någon annan som har skapat den.");
    const students = q.studentIdsOfClass.all(cls.id).length;
    inTransaction(function () { purgeClass(cls.id); });
    send(res, 200, { ok: true, students: students });
  }

  // "Radera mitt konto": needs the password. A teacher's classes, students and everything about them go with it.
  async function deleteMyAccount(req, res) {
    const s = requireUser(req);
    const b = await readJson(req, 2000);
    if (!(await sec.verifyPassword(str(b.password, 200), s.user.password_hash))) throw new ApiError(400, "Lösenordet stämmer inte.");
    inTransaction(function () {
      if (s.user.role === "teacher") q.classIdsOfTeacher.all(s.user.id).forEach(function (c) { purgeClass(c.id); });
      purgeUser(s.user.id);
    });
    clearSessionCookie(res);
    send(res, 200, { ok: true });
  }

  const account = createAccount({ db: db, ApiError: ApiError, send: send, readJson: readJson, readRaw: readRaw, requireUser: requireUser, requireGuide: requireGuide, str: str, nowIso: nowIso, ip: ip, checkPassword: checkPassword });

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
      if (method === "POST" && p === "/api/me/delete") return await deleteMyAccount(req, res);
      if (method === "GET" && p === "/api/me/data") return myData(req, res);
      if (method === "POST" && p === "/api/me/feedback/read") return await markRead(req, res);
      if (method === "POST" && p === "/api/feedback") return await postFeedback(req, res);
      if (method === "POST" && p === "/api/me/chat") return await studentChat(req, res);
      if (method === "POST" && p === "/api/me/chat/read") return studentChatRead(req, res);
      if (method === "POST" && p === "/api/teacher/chat") return await teacherChat(req, res);
      if (method === "POST" && p === "/api/teacher/chat/read") return await teacherChatRead(req, res);
      if (method === "GET" && p === "/api/teacher/chat/unread") return teacherChatUnread(req, res);
      if ((m = /^\/api\/progress\/([^/]+)$/.exec(p)) && method === "PUT") return await putProgress(req, res, decodeURIComponent(m[1]));
      if (method === "POST" && p === "/api/attempts") return await postAttempt(req, res);
      if (method === "GET" && p === "/api/lessons") return listLessons(req, res);
      if ((m = /^\/api\/lessons\/([^/]+)$/.exec(p)) && method === "PUT") return await putLesson(req, res, decodeURIComponent(m[1]));
      if (method === "POST" && p === "/api/me/classes") return await joinClass(req, res);
      if ((m = /^\/api\/me\/classes\/(\d+)$/.exec(p)) && method === "DELETE") return leaveClass(req, res, m[1]);
      if (method === "POST" && p === "/api/teacher/join") return await joinAsGuide(req, res);
      if ((m = /^\/api\/teacher\/classes\/(\d+)\/guides\/(\d+)$/.exec(p)) && method === "DELETE") return removeGuide(req, res, m[1], m[2]);
      if (method === "GET" && p === "/api/teacher/classes") return listClasses(req, res);
      if (method === "POST" && p === "/api/teacher/classes") return await createClass(req, res);
      if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p)) && method === "PUT") return await updateClass(req, res, m[1]);
      if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p)) && method === "DELETE") return deleteClass(req, res, m[1]);
      if (method === "GET" && p === "/api/teacher/students") return teacherStudents(req, res);
      if (method === "POST" && p === "/api/teacher/students") return await createStudent(req, res);
      if (method === "GET" && p === "/api/teacher/assignments") return listAssignments(req, res);
      if (method === "POST" && p === "/api/teacher/assignments") return await createAssignment(req, res);
      if ((m = /^\/api\/teacher\/assignments\/(\d+)$/.exec(p)) && method === "DELETE") return archiveAssignment(req, res, m[1]);
      if (method === "POST" && p === "/api/teacher/feedback") return await createFeedback(req, res);
      if ((m = /^\/api\/teacher\/feedback\/(\d+)$/.exec(p)) && method === "DELETE") return removeFeedback(req, res, m[1]);
      if ((m = /^\/api\/teacher\/students\/(\d+)\/password$/.exec(p)) && method === "POST") return await resetStudentPassword(req, res, m[1]);
      if ((m = /^\/api\/teacher\/students\/(\d+)$/.exec(p)) && method === "DELETE") return deleteStudent(req, res, m[1]);
      if (await account.route(req, res, method, p)) return;
      throw new ApiError(404, "Hittades inte.");
    } catch (err) {
      if (err instanceof ApiError) return send(res, err.status, err.code ? { error: err.message, code: err.code } : { error: err.message });
      console.error(err);
      return send(res, 500, { error: "Något gick fel på servern." });
    }
  }

  return { handle: handle, teacherCode: teacherCode };
}

module.exports = { createApi };
