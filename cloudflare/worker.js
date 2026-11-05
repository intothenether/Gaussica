// Gaussica API on Cloudflare Workers + D1. Same endpoints and rules as server/api.js,
// but logged-in users are identified by a bearer token (Authorization header) instead of a
// cookie, so the site can be served from GitHub Pages or from a PC and use the same database.

const SESSION_DAYS = 30;
const COLORS = ["#425b9a", "#ef6f88", "#4fa8dc", "#8a74c9", "#d99a2b", "#2f9d88", "#7a8db8"];
const ID_RE = /^[\p{L}\p{N}_-]{1,80}$/u;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CHAT_UNANSWERED_MAX = 6;   // a student can send this many messages in a row before the teacher has answered
const STICKERS = ["star", "thumbs", "muscle", "rocket", "bulb", "party", "heart", "mynt5", "mynt10", "mynt25"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PBKDF2_ITERATIONS = 100000;   // the most Workers allow

class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
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

// How a signed-in sender is written in site_feedback (and the e-mail), so that the messages can be found again when the
// account is deleted. Keep in step with the SQL in studentPurge.
function senderLabel(u, className) {
  return u.display_name + " (" + (u.role === "teacher" ? (u.caregiver ? "vårdnadshavare" : "lärare") : "elev") + (className ? ", klass " + className : "") + ")";
}

// ----- who may use the site (the same code as server/billing-core.js: tests/billing-core.js checks it) -----
// BEGIN billing-core
const BILLING_GRACE_DAYS = 7;       // a payment that is late or a webhook that is missed does not lock a family out at once
const BILLING_DAY_MS = 86400000;

function billingMs(v) {
  const t = typeof v === "number" ? v : Date.parse(v || "");
  return Number.isFinite(t) ? t : null;
}

function billingIso(ms) { return ms === null || ms === undefined ? null : new Date(ms).toISOString(); }

// { state: "active" | "expired", plan, reason, until, daysLeft, cancelAtPeriodEnd, billing }
function accessOf(ent, opts) {
  opts = opts || {};
  const now = billingMs(opts.now) === null ? Date.now() : billingMs(opts.now);
  const out = (state, plan, extra) => Object.assign({ state: state, plan: plan, reason: null, until: null, daysLeft: null, cancelAtPeriodEnd: false, billing: Boolean(opts.billing) }, extra || {});
  const left = (until) => (until === null ? null : Math.max(0, Math.ceil((until - now) / BILLING_DAY_MS)));
  if (!ent) return out("active", "free", { reason: "ingen" });
  // while the site is not charging anyone, everybody is in
  if (!opts.billing) return out("active", ent.plan || "free", { reason: ent.free_reason || "beta", until: billingIso(billingMs(ent.free_until)) });
  if (ent.plan === "free") {
    const until = billingMs(ent.free_until);
    if (until !== null && until <= now) return out("expired", "free", { reason: ent.free_reason || null, until: billingIso(until), daysLeft: 0 });
    return out("active", "free", { reason: ent.free_reason || "gratis", until: billingIso(until), daysLeft: left(until) });
  }
  if (ent.plan === "trial") {
    const until = billingMs(ent.trial_ends_at);
    if (until === null || until <= now) return out("expired", "trial", { until: billingIso(until), daysLeft: 0 });
    return out("active", "trial", { until: billingIso(until), daysLeft: left(until) });
  }
  // paid
  const end = billingMs(ent.period_end);
  const cancel = Boolean(ent.cancel_at_period_end);
  const status = String(ent.status || "");
  if (status === "canceled") {
    if (end !== null && end > now) return out("active", "paid", { until: billingIso(end), daysLeft: left(end), cancelAtPeriodEnd: true });
    return out("expired", "paid", { until: billingIso(end), daysLeft: 0 });
  }
  if (status === "active" || status === "trialing" || status === "past_due") {
    const lastDay = end === null ? null : end + BILLING_GRACE_DAYS * BILLING_DAY_MS;
    if (lastDay !== null && lastDay <= now) return out("expired", "paid", { until: billingIso(end), daysLeft: 0 });
    return out("active", "paid", { until: billingIso(end), daysLeft: left(end), cancelAtPeriodEnd: cancel });
  }
  return out("expired", "paid", { until: billingIso(end), daysLeft: 0 });
}

// What a Paddle webhook says about a subscription, as a change to the entitlement: { userId, customerId, subscriptionId, status, periodEnd,
// cancelAtPeriodEnd } or null for events that are not about a subscription of one of our users. custom_data.user_id is set when the checkout is made.
function paddleChange(event) {
  const type = event && typeof event.event_type === "string" ? event.event_type : "";
  const d = event && event.data;
  if (!/^subscription\./.test(type) || !d || typeof d !== "object") return null;
  const userId = Number(d.custom_data && d.custom_data.user_id);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const status = String(d.status || "");
  const period = d.current_billing_period && d.current_billing_period.ends_at;
  const cancel = Boolean(d.scheduled_change && d.scheduled_change.action === "cancel");
  let periodEnd = billingIso(billingMs(period));
  if (status === "canceled") periodEnd = billingIso(billingMs(d.canceled_at) === null ? billingMs(period) : billingMs(d.canceled_at));
  return { userId: userId, customerId: d.customer_id ? String(d.customer_id) : null, subscriptionId: d.id ? String(d.id) : null, status: status, periodEnd: periodEnd, cancelAtPeriodEnd: cancel };
}
// END billing-core

// ----- validation -----
const FAMILY_MAX = 10;   // children in the family of a caregiver

// Set when the database has been seen to have the tables of migrations/007-multi.sql (checked once for each running copy of the worker).
let multiSchemaSeen = false;

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
  // a query that may name a column an old database does not have yet: no row, instead of an error
  const tryOne = async (sql, ...args) => { try { return await one(sql, ...args); } catch (e) { return null; } };
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

  // A caregiver is stored as a teacher with the flag `caregiver` (migrations/006-caregiver.sql); the site is told the role "caregiver". A
  // student whose class belongs to a caregiver (a family) gets guide: "caregiver", so that the pages can say vårdnadshavare where they say lärare.
  // A student can be in several classes: a school class and a family. guide is "caregiver" when all of them are families, "teacher" when none is,
  // and "both" when there are both kinds. Stars and animals are on when any of the classes has them on.
  const publicUser = (u) => {
    const classes = u.classes || [];
    const families = classes.filter((c) => c.owner_caregiver).length;
    return {
      id: u.id, username: u.username, name: u.display_name, role: u.role === "teacher" && u.caregiver ? "caregiver" : u.role,
      guide: u.role === "student" ? (!classes.length ? "teacher" : families === classes.length ? "caregiver" : families ? "both" : "teacher") : undefined,
      classId: classes.length ? classes[0].id : (u.class_id || null), className: classes.length ? classes.map((c) => c.name).join(" · ") : (u.class_name || null),
      classes: u.role === "student" ? classes.map((c) => ({ id: c.id, name: c.name, family: Boolean(c.owner_caregiver) })) : undefined,
      email: u.role === "teacher" ? (u.email || null) : undefined, emailVerified: u.role === "teacher" ? Boolean(u.email_verified_at) : undefined,
      access: u.access,
      color: COLORS[u.id % COLORS.length],
      rewards: u.role === "student" && classes.length ? classes.some((c) => Boolean(c.rewards)) : (u.rewards === undefined || u.rewards === null ? true : Boolean(u.rewards))
    };
  };

  // (a database that has not had migrations/006-caregiver.sql yet has no column caregiver: no family then)
  const classesOfStudent = (id) => {
    const sql = (owner) => "SELECT c.id, c.name, c.code, " + owner + " AS owner_caregiver, COALESCE(cs.rewards, 1) AS rewards FROM class_members m JOIN classes c ON c.id = m.class_id " +
      "JOIN users g ON g.id = c.teacher_id LEFT JOIN class_settings cs ON cs.class_id = c.id WHERE m.user_id = ? ORDER BY m.joined_at, c.id";
    return all(sql("g.caregiver"), id).catch(() => all(sql("0"), id));
  };

  // the classes of a student are looked up only where the user is handed to the site (not on every request)
  async function withGuide(u) {
    if (u && u.role === "student") u.classes = await classesOfStudent(u.id);
    if (u) u.access = await accessOfUser(u);
    return u;
  }

  // The first class of a student is kept in users.class_id; it follows the memberships.
  async function fixPrimaryClass(userId) {
    const list = await classesOfStudent(userId);
    await run("UPDATE users SET class_id = ? WHERE id = ?", list.length ? list[0].id : null, userId);
  }

  async function addMember(classId, userId) {
    await run("INSERT OR IGNORE INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)", classId, userId, nowIso());
    await run("UPDATE users SET class_id = ? WHERE id = ? AND class_id IS NULL", classId, userId);
  }

  async function newGuideCode() {
    let code;
    for (let i = 0; i < 10; i++) {
      code = "V" + randomCode(9);
      if (!(await one("SELECT 1 AS x FROM classes WHERE guide_code = ?", code))) break;
    }
    return code;
  }

  // A class with its owner as its first guide.
  async function makeClass(name, ownerId) {
    const code = await newClassCode();
    const guideCode = await newGuideCode();
    const res = await run("INSERT INTO classes (name, code, guide_code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?)", name, code, guideCode, ownerId, nowIso());
    const id = res.meta.last_row_id;
    await run("INSERT OR IGNORE INTO class_guides (class_id, user_id) VALUES (?, ?)", id, ownerId);
    return { id, code, guideCode };
  }

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

  // Teachers and caregivers: everything about their classes. Only teachers may edit lessons (requireTeacher).
  async function requireGuide() {
    const s = await requireUser();
    if (s.user.role !== "teacher") throw new ApiError(403, "Endast lärare och vårdnadshavare har tillgång.");
    return s;
  }

  async function requireTeacher() {
    const s = await requireGuide();
    if (s.user.caregiver) throw new ApiError(403, "Endast lärare kan ändra lektioner.");
    return s;
  }

  async function newClassCode() {
    let code;
    for (let i = 0; i < 10; i++) {
      code = randomCode(6);
      if (!(await one("SELECT 1 AS x FROM classes WHERE code = ?", code))) break;
    }
    return code;
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

  // ----- e-mail, access and billing (the same rules as server/account.js: change both) -----
  // Settings are variables or secrets of the worker, see cloudflare/README.md: RESEND_API_KEY, MAIL_FROM, SITE_URL, CAREGIVER_EMAIL_REQUIRED, BILLING_ENABLED,
  // TRIAL_DAYS, PADDLE_ENV, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRICES, ADMIN_TOKEN. None is needed to run the site: the features stay off.
  const billingOn = () => env.BILLING_ENABLED === "1";
  const emailRequired = () => env.CAREGIVER_EMAIL_REQUIRED === "1";
  const trialDays = () => Math.max(1, Math.min(90, Math.round(Number(env.TRIAL_DAYS)) || 14));
  const siteUrl = () => String(env.SITE_URL || "https://gaussica.se").replace(/\/+$/, "");
  const termsVersion = () => env.TERMS_VERSION || "2026-11";
  const paddleBase = () => env.PADDLE_API_BASE || (env.PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com");
  const cleanEmail = (v) => str(v, 120).trim().toLowerCase();
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
  const VERIFY_MINUTES = 24 * 60;
  const RESET_MINUTES = 60;

  function plans() {
    try {
      const p = JSON.parse(env.PADDLE_PRICES || "{}");
      return Object.keys(p).filter((id) => p[id] && typeof p[id].priceId === "string").map((id) => ({ id, priceId: p[id].priceId, label: String(p[id].label || id), text: String(p[id].text || "") }));
    } catch (e) { return []; }
  }
  const paddleReady = () => Boolean(env.PADDLE_API_KEY && plans().length);

  async function sendMail(to, subject, text) {
    if (env.MAIL_DEV === "1") { if (Array.isArray(env.MAIL_OUTBOX)) env.MAIL_OUTBOX.push({ to, subject, text, at: nowIso() }); return true; }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.RESEND_API_KEY },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text })
      });
      return res.ok;
    } catch (e) { return false; }
  }

  const SIGNATURE = "\n\nHälsningar\nGaussica";
  const verifyMail = (name, link) => ["Bekräfta din e-postadress till Gaussica", "Hej " + name + "!\n\nBekräfta din e-postadress genom att öppna länken:\n" + link + "\n\nLänken fungerar i 24 timmar. Det är med den här adressen du kan få ett nytt lösenord om du glömmer det." + SIGNATURE];
  const resetMail = (name, link) => ["Nytt lösenord till Gaussica", "Hej " + name + "!\n\nDu (eller någon annan) bad om ett nytt lösenord. Öppna länken för att välja ett:\n" + link + "\n\nLänken fungerar i 1 timme och kan bara användas en gång. Bad du inte om det kan du strunta i det här mejlet: ditt lösenord ändras inte." + SIGNATURE];

  async function newEmailToken(userId, purpose, email, minutes) {
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    await run("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?", userId, purpose);
    await run("INSERT INTO email_tokens (token_hash, user_id, purpose, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      await sha256Hex(token), userId, purpose, email, nowIso(), new Date(Date.now() + minutes * 60000).toISOString());
    return token;
  }

  async function sendVerification(user) {
    if (!user.email) return false;
    const m = verifyMail(user.display_name, siteUrl() + "/#verifiera/" + (await newEmailToken(user.id, "verify", user.email, VERIFY_MINUTES)));
    return sendMail(user.email, m[0], m[1]);
  }

  async function startEntitlement(userId) {
    const now = nowIso();
    if (billingOn()) await run("INSERT OR IGNORE INTO entitlements (user_id, plan, free_reason, free_until, trial_ends_at, updated_at) VALUES (?, 'trial', NULL, NULL, ?, ?)", userId, new Date(Date.now() + trialDays() * 86400000).toISOString(), now);
    else await run("INSERT OR IGNORE INTO entitlements (user_id, plan, free_reason, free_until, trial_ends_at, updated_at) VALUES (?, 'free', 'beta', NULL, NULL, ?)", userId, now);
  }

  const betterAccess = (a, b) => (a.state !== b.state ? (a.state === "active" ? a : b) : (a.until === null && b.until !== null ? a : b.until === null && a.until !== null ? b : (String(a.until) >= String(b.until) ? a : b)));

  // The access of a user (see server/account.js). A database that has not had migrations/008-account-billing.sql yet lets everybody in.
  async function accessOfUser(u) {
    const billing = billingOn();
    const school = { state: "active", plan: "school", reason: null, until: null, daysLeft: null, cancelAtPeriodEnd: false, billing };
    try {
      if (u.role === "teacher" && !u.caregiver) return school;
      const owners = await all(u.role === "student"
        ? "SELECT DISTINCT c.teacher_id AS owner, g.caregiver AS caregiver FROM class_members m JOIN classes c ON c.id = m.class_id JOIN users g ON g.id = c.teacher_id WHERE m.user_id = ?"
        : "SELECT DISTINCT c.teacher_id AS owner, g.caregiver AS caregiver FROM class_guides cg JOIN classes c ON c.id = cg.class_id JOIN users g ON g.id = c.teacher_id WHERE cg.user_id = ?", u.id);
      if (!owners.length) return Object.assign({}, school, { plan: "free", reason: "ingen familj" });
      const list = [];
      for (const o of owners) list.push(o.caregiver ? accessOf(await one("SELECT * FROM entitlements WHERE user_id = ?", o.owner), { billing }) : school);
      return list.reduce(betterAccess);
    } catch (e) {
      return Object.assign({}, school, { plan: "free", reason: "databasen är inte uppdaterad", billing: false });
    }
  }

  async function requireAccess(u) {
    if (u.role === "student" && (await accessOfUser(u)).state !== "active") throw new ApiError(402, "Familjens prenumeration har gått ut. Be din vårdnadshavare förnya den.", "subscription");
  }

  async function setEmail() {
    const s = await requireUser();
    if (s.user.role !== "teacher") throw new ApiError(403, "Bara vuxna har en e-postadress.");
    const b = await readJson(request, 4000);
    const email = cleanEmail(b.email);
    if (!validEmail(email)) throw new ApiError(400, "E-postadressen ser inte rätt ut.");
    const full = await one("SELECT * FROM users WHERE id = ?", s.user.id);
    if (full.email && full.email !== email && !(await verifyPassword(str(b.password, 200), full.password_hash))) throw new ApiError(400, "Skriv ditt lösenord för att byta e-postadress.");
    const other = await tryOne("SELECT id FROM users WHERE email = ?", email);
    if (other && other.id !== s.user.id) throw new ApiError(409, "Den e-postadressen går inte att använda. Har du redan ett konto? Logga in med det.");
    if (full.email === email && full.email_verified_at) return [200, { ok: true, verified: true, sent: false }];
    const wait = await limit("verify:" + s.user.id, 5, 3600 * 1000);
    if (wait) throw new ApiError(429, "För många mejl. Vänta " + Math.ceil(wait / 60) + " min.");
    try { await run("UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?", email, s.user.id); }
    catch (e) { throw new ApiError(503, "Databasen är inte uppdaterad för e-post. Kör migrations/008-account-billing.sql (se cloudflare/README.md)."); }
    return [200, { ok: true, verified: false, sent: await sendVerification(Object.assign({}, full, { email })) }];
  }

  async function resendVerification() {
    const s = await requireUser();
    const full = await one("SELECT * FROM users WHERE id = ?", s.user.id);
    if (!full.email) throw new ApiError(400, "Du har ingen e-postadress än.");
    if (full.email_verified_at) return [200, { ok: true, verified: true, sent: false }];
    const wait = await limit("verify:" + s.user.id, 5, 3600 * 1000);
    if (wait) throw new ApiError(429, "För många mejl. Vänta " + Math.ceil(wait / 60) + " min.");
    return [200, { ok: true, verified: false, sent: await sendVerification(full) }];
  }

  async function verifyEmailToken() {
    const b = await readJson(request, 2000);
    const row = await one("SELECT * FROM email_tokens WHERE token_hash = ?", await sha256Hex(str(b.token, 200)));
    if (!row || row.purpose !== "verify" || row.used_at || row.expires_at < nowIso()) throw new ApiError(400, "Länken har gått ut eller är redan använd. Be om en ny i Konto.");
    const res = await run("UPDATE users SET email_verified_at = ? WHERE id = ? AND email = ?", nowIso(), row.user_id, row.email);
    if (!res.meta.changes) throw new ApiError(400, "Länken gäller en adress du inte har längre.");
    await run("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?", nowIso(), row.token_hash);
    return [200, { ok: true, email: row.email }];
  }

  async function forgot() {
    const b = await readJson(request, 2000);
    const email = cleanEmail(b.email);
    const wait = Math.max(await limit("forgotip:" + ip, 10, 3600 * 1000), validEmail(email) ? await limit("forgotmail:" + email, 3, 3600 * 1000) : 0);
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    if (validEmail(email)) {
      const user = await tryOne("SELECT * FROM users WHERE email = ?", email);
      // only an address that has been verified can get a new password, so that nobody can take over an account by putting its name on another address
      if (user && user.email_verified_at) {
        const m = resetMail(user.display_name, siteUrl() + "/#aterstall/" + (await newEmailToken(user.id, "reset", email, RESET_MINUTES)));
        await sendMail(email, m[0], m[1]);
      }
    }
    return [200, { ok: true }];   // the same answer whether the address exists or not
  }

  async function resetPassword() {
    const b = await readJson(request, 4000);
    const row = await one("SELECT * FROM email_tokens WHERE token_hash = ?", await sha256Hex(str(b.token, 200)));
    if (!row || row.purpose !== "reset" || row.used_at || row.expires_at < nowIso()) throw new ApiError(400, "Länken har gått ut eller är redan använd. Be om en ny.");
    const user = await one("SELECT * FROM users WHERE id = ?", row.user_id);
    if (!user) throw new ApiError(400, "Länken har gått ut eller är redan använd. Be om en ny.");
    checkPassword(b.password, user.username);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(b.password), user.id);
    await run("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?", nowIso(), row.token_hash);
    await run("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'reset'", user.id);
    await run("DELETE FROM sessions WHERE user_id = ?", user.id);
    return [200, { ok: true, username: user.username }];
  }

  async function billingStatus() {
    const s = await requireUser();
    const owner = s.user.role === "teacher" && s.user.caregiver;
    const ent = owner ? await tryOne("SELECT * FROM entitlements WHERE user_id = ?", s.user.id) : null;
    return [200, {
      billing: billingOn(), checkout: billingOn() && paddleReady(), access: await accessOfUser(s.user),
      plans: plans().map((p) => ({ id: p.id, label: p.label, text: p.text })), manage: Boolean(ent && ent.paddle_customer_id), owner: Boolean(owner && ent)
    }];
  }

  async function paddle(method, path, body) {
    const res = await fetch(paddleBase() + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.PADDLE_API_KEY }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new ApiError(502, "Betalningstjänsten svarade inte som den ska. Försök igen om en stund.");
    return json && json.data;
  }

  async function checkout() {
    const s = await requireGuide();
    if (!s.user.caregiver) throw new ApiError(403, "Prenumerationen är för familjer.");
    if (!billingOn() || !paddleReady()) throw new ApiError(503, "Betalning är inte påslagen än.");
    const b = await readJson(request, 2000);
    const plan = plans().find((p) => p.id === str(b.plan, 40));
    if (!plan) throw new ApiError(400, "Välj en prenumeration.");
    const data = await paddle("POST", "/transactions", { items: [{ price_id: plan.priceId, quantity: 1 }], collection_mode: "automatic", custom_data: { user_id: String(s.user.id) } });
    const url = data && data.checkout && data.checkout.url;
    if (!url) throw new ApiError(502, "Betalningstjänsten gav ingen betalsida. Försök igen om en stund.");
    return [200, { url }];
  }

  async function portal() {
    const s = await requireGuide();
    const ent = await tryOne("SELECT * FROM entitlements WHERE user_id = ?", s.user.id);
    if (!ent || !ent.paddle_customer_id) throw new ApiError(400, "Det finns ingen prenumeration att hantera.");
    const data = await paddle("POST", "/customers/" + encodeURIComponent(ent.paddle_customer_id) + "/portal-sessions", ent.paddle_subscription_id ? { subscription_ids: [ent.paddle_subscription_id] } : {});
    const url = data && data.urls && data.urls.general && data.urls.general.overview;
    if (!url) throw new ApiError(502, "Betalningstjänsten gav ingen sida. Försök igen om en stund.");
    return [200, { url }];
  }

  async function hmacHex(secret, text) {
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text))), (x) => x.toString(16).padStart(2, "0")).join("");
  }

  // "ts=1671552777;h1=<hex>" is the HMAC-SHA256 of "<ts>:<raw body>" with the secret of the notification
  async function paddleSignatureOk(header, raw) {
    if (!env.PADDLE_WEBHOOK_SECRET) return false;
    const parts = {};
    String(header || "").split(";").forEach((kv) => { const i = kv.indexOf("="); if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    if (!parts.ts || !parts.h1) return false;
    if (Math.abs(Date.now() / 1000 - Number(parts.ts)) > 300) return false;
    return safeEqual(await hmacHex(env.PADDLE_WEBHOOK_SECRET, parts.ts + ":" + raw), parts.h1);
  }

  async function webhook() {
    const raw = await request.text();
    if (raw.length > 200000) throw new ApiError(413, "För stor förfrågan.");
    if (!(await paddleSignatureOk(request.headers.get("Paddle-Signature"), raw))) throw new ApiError(400, "Ogiltig signatur.");
    let event;
    try { event = JSON.parse(raw); } catch (e) { throw new ApiError(400, "Ogiltig JSON."); }
    if (event.event_id && !(await run("INSERT OR IGNORE INTO billing_events (id, type, received_at) VALUES (?, ?, ?)", String(event.event_id), String(event.event_type || ""), nowIso())).meta.changes) return [200, { ok: true, duplicate: true }];
    const change = paddleChange(event);
    if (change) {
      const user = await one("SELECT * FROM users WHERE id = ?", change.userId);
      if (user) {
        await startEntitlement(user.id);
        const cur = await one("SELECT * FROM entitlements WHERE user_id = ?", user.id);
        // an account with free access for good keeps it (it only learns the ids), a trial or a lapsed one becomes paid
        const keepFree = cur.plan === "free" && !cur.free_until;
        await run("UPDATE entitlements SET plan = ?, free_reason = ?, free_until = ?, trial_ends_at = ?, status = ?, period_end = ?, cancel_at_period_end = ?, paddle_customer_id = ?, paddle_subscription_id = ?, updated_at = ? WHERE user_id = ?",
          keepFree ? "free" : "paid", cur.free_reason, keepFree ? cur.free_until : null, cur.trial_ends_at, change.status, change.periodEnd, change.cancelAtPeriodEnd ? 1 : 0,
          change.customerId || cur.paddle_customer_id, change.subscriptionId || cur.paddle_subscription_id, nowIso(), user.id);
      }
    }
    return [200, { ok: true }];
  }

  async function grantFree(userId, reason, days) {
    await startEntitlement(userId);
    const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
    await run("UPDATE entitlements SET plan = 'free', free_reason = ?, free_until = ?, updated_at = ? WHERE user_id = ?", str(reason, 80) || "gratis", until, nowIso(), userId);
  }

  async function redeem() {
    const s = await requireGuide();
    if (!s.user.caregiver) throw new ApiError(403, "Koden är för familjer.");
    const b = await readJson(request, 1000);
    const wait = await limit("redeem:" + s.user.id, 5, 3600 * 1000);
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    const code = normalizeCode(b.code);
    const row = code ? await tryOne("SELECT * FROM access_codes WHERE code = ?", code) : null;
    if (!row || row.uses_left < 1) throw new ApiError(400, "Koden stämmer inte eller är redan använd.");
    await startEntitlement(s.user.id);
    const cur = await one("SELECT * FROM entitlements WHERE user_id = ?", s.user.id);
    if (cur.plan === "paid" && accessOf(cur, { billing: billingOn() }).state === "active") throw new ApiError(409, "Du har redan en prenumeration.");
    if (!(await run("UPDATE access_codes SET uses_left = uses_left - 1 WHERE code = ? AND uses_left > 0", code)).meta.changes) throw new ApiError(400, "Koden stämmer inte eller är redan använd.");
    await grantFree(s.user.id, row.reason || "kod", row.days);
    return [200, { ok: true, access: await accessOfUser(await one("SELECT * FROM users WHERE id = ?", s.user.id)) }];
  }

  function requireAdmin() {
    const token = env.ADMIN_TOKEN;
    if (!token || String(token).length < 16) throw new ApiError(503, "Admin är inte påslaget. Sätt ADMIN_TOKEN (minst 16 tecken).");
    const m = /^Bearer\s+(.+)$/.exec(request.headers.get("Authorization") || "");
    if (!m || !safeEqual(m[1], token)) throw new ApiError(401, "Fel admin-nyckel.");
  }

  async function adminAccess() {
    requireAdmin();
    const b = await readJson(request, 2000);
    const user = await one("SELECT * FROM users WHERE username = ?", str(b.username, 40).trim());
    if (!user || user.role !== "teacher") throw new ApiError(404, "Hittar ingen vuxen med det användarnamnet.");
    const action = str(b.action, 20);
    if (action === "grant") await grantFree(user.id, b.reason, Number(b.days) > 0 ? Math.round(Number(b.days)) : 0);
    else if (action === "revoke") { await startEntitlement(user.id); await run("UPDATE entitlements SET plan = 'trial', free_reason = NULL, free_until = NULL, trial_ends_at = ?, updated_at = ? WHERE user_id = ?", nowIso(), nowIso(), user.id); }
    else if (action !== "show") throw new ApiError(400, "action ska vara grant, revoke eller show.");
    return [200, { ok: true, username: user.username, entitlement: (await tryOne("SELECT * FROM entitlements WHERE user_id = ?", user.id)) || null, access: await accessOfUser(user) }];
  }

  async function adminCodes() {
    requireAdmin();
    const b = await readJson(request, 2000);
    const uses = Math.max(1, Math.min(1000, Math.round(Number(b.uses)) || 1));
    const days = Number(b.days) > 0 ? Math.min(3650, Math.round(Number(b.days))) : null;
    const code = randomCode(10);
    await run("INSERT INTO access_codes (code, reason, days, uses_left, created_at) VALUES (?, ?, ?, ?, ?)", code, str(b.reason, 80) || "kod", days, uses, nowIso());
    return [201, { code, uses, days }];
  }

  // [status, body] when the request was one of ours, otherwise null
  async function accountRoute(method, p) {
    if (method === "POST" && p === "/api/me/email") return setEmail();
    if (method === "POST" && p === "/api/me/email/resend") return resendVerification();
    if (method === "POST" && p === "/api/auth/verify-email") return verifyEmailToken();
    if (method === "POST" && p === "/api/auth/forgot") return forgot();
    if (method === "POST" && p === "/api/auth/reset") return resetPassword();
    if (method === "GET" && p === "/api/billing") return billingStatus();
    if (method === "POST" && p === "/api/billing/checkout") return checkout();
    if (method === "POST" && p === "/api/billing/portal") return portal();
    if (method === "POST" && p === "/api/billing/webhook") return webhook();
    if (method === "POST" && p === "/api/billing/redeem") return redeem();
    if (method === "POST" && p === "/api/admin/access") return adminAccess();
    if (method === "POST" && p === "/api/admin/codes") return adminCodes();
    return null;
  }

  // ----- handlers -----
  async function register() {
    const wait = await limit("reg:" + ip, 20, 3600 * 1000);
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    const b = await readJson(request, 10000);
    const kind = b.role === "teacher" ? "teacher" : b.role === "caregiver" ? "caregiver" : "student";
    const role = kind === "student" ? "student" : "teacher";
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw new ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw new ApiError(400, "Ange ditt namn.");
    checkPassword(b.password, username);
    // an adult can give an e-mail address (to verify it and to reset a lost password); a caregiver has to when the site is set up for it, and accepts the terms
    const email = cleanEmail(b.email);
    if (email && !validEmail(email)) throw new ApiError(400, "E-postadressen ser inte rätt ut.");
    if (kind === "caregiver" && emailRequired()) {
      if (!email) throw new ApiError(400, "Ange din e-postadress. Den behövs om du glömmer lösenordet.");
      if (b.acceptTerms !== true) throw new ApiError(400, "Du behöver godkänna villkoren och läsa integritetstexten.");
    }
    if (email && role === "student") throw new ApiError(400, "Barn har ingen e-postadress.");
    if (email && (await tryOne("SELECT id FROM users WHERE email = ?", email))) throw new ApiError(409, "Den e-postadressen går inte att använda. Har du redan ett konto? Logga in med det.");

    let classId = null;
    let joinClass = null;   // a caregiver who joins the family of somebody else
    if (role === "student") {
      const cls = await one("SELECT id FROM classes WHERE code = ?", normalizeCode(b.classCode));
      if (!cls) throw new ApiError(400, "Koden stämmer inte. Fråga din lärare eller vårdnadshavare efter rätt kod.");
      const owner = await tryOne("SELECT g.caregiver AS c FROM classes c JOIN users g ON g.id = c.teacher_id WHERE c.id = ?", cls.id);
      if (owner && owner.c && (await one("SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?", cls.id)).n >= FAMILY_MAX) throw new ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
      classId = cls.id;
    } else if (kind === "caregiver") {
      if (env.CAREGIVER_SIGNUP === "off") throw new ApiError(403, "Konton för vårdnadshavare är avstängda här.");
      if (str(b.guideCode, 40).trim()) {
        joinClass = await one("SELECT id FROM classes WHERE guide_code = ?", normalizeCode(b.guideCode));
        if (!joinClass) throw new ApiError(400, "Koden för vuxna stämmer inte. Fråga den som skapade familjen.");
      }
    } else {
      if (!env.TEACHER_CODE) throw new ApiError(503, "Lärarregistrering är inte påslagen. Sätt hemligheten TEACHER_CODE i Cloudflare.");
      if (!safeEqual(normalizeCode(b.teacherCode), normalizeCode(env.TEACHER_CODE))) throw new ApiError(403, "Lärarkoden stämmer inte.");
    }

    if (await one("SELECT 1 AS x FROM users WHERE username = ?", username)) throw new ApiError(409, "Användarnamnet är redan upptaget.");
    const hash = await hashPassword(b.password);
    let userId;
    try {
      const res = kind === "caregiver"
        ? await run("INSERT INTO users (username, display_name, role, password_hash, class_id, created_at, caregiver) VALUES (?, ?, ?, ?, ?, ?, 1)", username, displayName, role, hash, classId, nowIso())
        : await run("INSERT INTO users (username, display_name, role, password_hash, class_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", username, displayName, role, hash, classId, nowIso());
      userId = res.meta.last_row_id;
    } catch (e) {
      if (/no such column|has no column/i.test(String(e && e.message))) throw new ApiError(503, "Databasen är inte uppdaterad för vårdnadshavare. Kör migrations/006-caregiver.sql (se cloudflare/README.md).");
      throw new ApiError(409, "Användarnamnet är redan upptaget.");
    }
    if (role === "student") await addMember(classId, userId);
    // a caregiver starts with a family, so there is a code to give the children at once, or joins the family of the other adult
    if (kind === "caregiver") {
      if (joinClass) await run("INSERT OR IGNORE INTO class_guides (class_id, user_id) VALUES (?, ?)", joinClass.id, userId);
      else await makeClass("Familjen " + displayName.trim().split(/\s+/).pop(), userId);
    }
    if (email) {
      try { await run("UPDATE users SET email = ? WHERE id = ?", email, userId); }
      catch (e) { throw new ApiError(503, "Databasen är inte uppdaterad för e-post. Kör migrations/008-account-billing.sql (se cloudflare/README.md)."); }
    }
    if (kind === "caregiver" && b.acceptTerms === true) await run("UPDATE users SET terms_accepted_at = ?, terms_version = ? WHERE id = ?", nowIso(), termsVersion(), userId).catch(() => null);
    // a family that starts one has a trial (or free access while the site charges nobody); a second adult joins the access of the family
    if (kind === "caregiver" && !joinClass) await startEntitlement(userId).catch(() => null);
    if (email) await sendVerification({ id: userId, display_name: displayName, email }).catch(() => null);
    const token = await startSession(userId);
    return [201, { user: publicUser(await withGuide(await userById(userId))), token }];
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
    return [200, { user: publicUser(await withGuide(await userById(user.id))), token }];
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

  // The settings of a prov: { title, lessons: [ids], perLesson, minutes (0 = no time limit), showResult }
  function cleanProv(c) {
    if (!c || typeof c !== "object") throw new ApiError(400, "Provet saknar inställningar.");
    const lessons = (Array.isArray(c.lessons) ? c.lessons : []).map((x) => str(x, 80)).filter((x, i, a) => ID_RE.test(x) && a.indexOf(x) === i).slice(0, 12);
    if (!lessons.length) throw new ApiError(400, "Välj minst en lektion till provet.");
    const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    return { title: str(c.title, 80).trim() || "Prov", lessons, perLesson: int(c.perLesson, 1, 20, 4), minutes: int(c.minutes, 0, 240, 0), showResult: c.showResult !== false };
  }

  const publicAssignment = (r) => ({
    id: r.id, lessonId: r.lesson_id, kind: r.kind || "lesson", config: parseConfig(r.config), note: r.note, dueDate: r.due_date, createdAt: r.created_at, teacher: r.teacher || null,
    classId: r.class_id || null, className: r.class_name || null, studentId: r.student_id || null, studentName: r.student_name || null
  });

  const publicFeedback = (r) => ({
    id: r.id, studentId: r.student_id || null, lessonId: r.lesson_id || null, taskId: r.task_id || null, text: r.text,
    sticker: r.sticker || null, createdAt: r.created_at, read: Boolean(r.read_at), teacher: r.teacher || null
  });

  function parseConfig(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  // with the prov settings when the database has them (migrations/005-prov.sql), without when it does not
  function studentAssignments(userId) {
    const sql = (cols) => "SELECT a.id, a.lesson_id, a.kind, " + cols + "a.note, a.due_date, a.created_at, u.display_name AS teacher FROM assignments a JOIN users u ON u.id = a.teacher_id " +
      "WHERE a.archived = 0 AND a.class_id IN (SELECT class_id FROM class_members WHERE user_id = ?) AND (a.student_id IS NULL OR a.student_id = ?) ORDER BY a.due_date IS NULL, a.due_date, a.id";
    return all(sql("a.config, "), userId, userId).catch(() => all(sql(""), userId, userId));
  }

  async function myData() {
    const s = await requireUser();
    const isStudent = s.user.role === "student";
    const [progress, attempts, assignments, feedback, chat] = await Promise.all([
      progressOf(s.user.id),
      all("SELECT id, data, created_at FROM attempts WHERE user_id = ? ORDER BY id", s.user.id),
      isStudent ? studentAssignments(s.user.id) : [],
      isStudent ? all(
        "SELECT f.id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at, u.display_name AS teacher FROM feedback f " +
        "JOIN users u ON u.id = f.teacher_id WHERE f.student_id = ? ORDER BY f.id DESC LIMIT 200", s.user.id) : [],
      // An older database without the chat table must not break the rest of the page.
      isStudent ? all("SELECT c.id, c.student_id, c.from_teacher, c.text, c.lesson_id, c.task_id, c.context, c.created_at, c.read_at, c.class_id, u.display_name AS guide " +
        "FROM chat c LEFT JOIN users u ON u.id = c.teacher_id AND c.from_teacher = 1 WHERE c.student_id = ? ORDER BY c.id DESC LIMIT 200", s.user.id).catch(() => []) : []
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
      sender = senderLabel(s.user, cls && cls.name);
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
      id: r.id, studentId: String(r.student_id), fromTeacher: Boolean(r.from_teacher), text: r.text, classId: r.class_id || null, guide: r.guide || null,
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
    const b = await readJson(request, 8000);
    // to the guides of one of the classes of the student: the one asked for, or the first
    const mine = await classesOfStudent(s.user.id);
    if (!mine.length) throw new ApiError(400, "Du är inte med i någon klass än.");
    const chosen = b.classId === undefined || b.classId === null ? mine[0] : mine.find((c) => c.id === Number(b.classId));
    if (!chosen) throw new ApiError(400, "Du är inte med i den klassen.");
    const teacher = await one("SELECT teacher_id FROM classes WHERE id = ?", chosen.id);
    if (!teacher) throw new ApiError(400, "Klassen har ingen lärare.");
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
      const res = await run("INSERT INTO chat (student_id, teacher_id, from_teacher, text, lesson_id, task_id, context, created_at, class_id) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)",
        s.user.id, teacher.teacher_id, text, lessonId, taskId, cleanChatContext(b.context), nowIso(), chosen.id);
      return [201, { id: res.meta.last_row_id }];
    } catch (err) { return chatMissing(err); }
  }

  async function studentChatRead() {
    const s = await requireUser();
    await run("UPDATE chat SET read_at = ? WHERE student_id = ? AND from_teacher = 1 AND read_at IS NULL", nowIso(), s.user.id).catch(() => null);
    return [200, { ok: true }];
  }

  async function teacherChat() {
    const s = await requireGuide();
    const b = await readJson(request, 5000);
    const student = await studentOfTeacher(b.studentId, s.user.id);
    const text = str(b.text, 600).trim();
    if (!text) throw new ApiError(400, "Skriv något först.");
    try {
      // the answer goes to the class the question came from (the last one that was asked), or else the first class the two have in common
      const shared = await sharedClasses(student.id, s.user.id);
      const asked = await one("SELECT class_id FROM chat WHERE student_id = ? AND from_teacher = 0 AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY id DESC LIMIT 1", student.id, s.user.id);
      const cls = (b.classId !== undefined && shared.find((c) => c.id === Number(b.classId))) || (asked && shared.find((c) => c.id === asked.class_id)) || shared[0];
      const res = await run("INSERT INTO chat (student_id, teacher_id, from_teacher, text, created_at, class_id) VALUES (?, ?, 1, ?, ?, ?)", student.id, s.user.id, text, nowIso(), cls.id);
      await run("UPDATE chat SET read_at = ? WHERE student_id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) AND from_teacher = 0 AND read_at IS NULL", nowIso(), student.id, s.user.id);   // answering means having read
      return [201, { id: res.meta.last_row_id }];
    } catch (err) { return chatMissing(err); }
  }

  async function teacherChatRead() {
    const s = await requireGuide();
    const b = await readJson(request, 2000);
    const student = await studentOfTeacher(b.studentId, s.user.id);
    await run("UPDATE chat SET read_at = ? WHERE student_id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) AND from_teacher = 0 AND read_at IS NULL", nowIso(), student.id, s.user.id).catch(() => null);
    return [200, { ok: true }];
  }

  async function teacherChatUnread() {
    const s = await requireGuide();
    const r = await one("SELECT COUNT(*) AS n FROM chat WHERE class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) AND from_teacher = 0 AND read_at IS NULL", s.user.id).catch(() => ({ n: 0 }));
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
    await requireAccess(s.user);
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
    await requireAccess(s.user);
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
    const s = await requireGuide();
    const rows = await all(
      "SELECT c.id, c.name, c.code, c.guide_code, c.teacher_id, c.created_at, (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS students, " +
      "COALESCE((SELECT rewards FROM class_settings WHERE class_id = c.id), 1) AS rewards " +
      "FROM classes c JOIN class_guides cg ON cg.class_id = c.id WHERE cg.user_id = ? ORDER BY c.name", s.user.id);
    const out = [];
    for (const c of rows) {
      const own = c.teacher_id === s.user.id;
      const guides = await all("SELECT u.id, u.display_name, u.caregiver FROM class_guides cg JOIN users u ON u.id = cg.user_id WHERE cg.class_id = ? ORDER BY cg.rowid", c.id);
      out.push({
        id: c.id, name: c.name, code: c.code, created_at: c.created_at, students: c.students, rewards: Boolean(c.rewards),
        owner: own, guideCode: own ? c.guide_code : null,
        guides: guides.map((g) => ({ id: g.id, name: g.display_name, caregiver: Boolean(g.caregiver), owner: g.id === c.teacher_id, you: g.id === s.user.id }))
      });
    }
    return [200, { classes: out }];
  }

  // Another adult joins a class as a guide (the other parent joins the family) with the code for adults.
  async function joinAsGuide() {
    const s = await requireGuide();
    const b = await readJson(request, 2000);
    const cls = await one("SELECT id, name FROM classes WHERE guide_code = ?", normalizeCode(b.guideCode));
    if (!cls) throw new ApiError(400, "Koden för vuxna stämmer inte. Fråga den som skapade klassen eller familjen.");
    await run("INSERT OR IGNORE INTO class_guides (class_id, user_id) VALUES (?, ?)", cls.id, s.user.id);
    return [200, { ok: true, classId: cls.id, name: cls.name }];
  }

  // The owner removes a guide; a guide who is not the owner can leave. The owner cannot leave (the class is deleted instead).
  async function removeGuide(classId, userId) {
    const s = await requireGuide();
    const cls = await guidedClass(classId, s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte.");
    const target = Number(userId);
    if (target === cls.teacher_id) throw new ApiError(400, "Den som skapade klassen kan inte lämna den. Radera klassen i stället.");
    if (target !== s.user.id && cls.teacher_id !== s.user.id) throw new ApiError(403, "Bara den som skapade klassen kan ta bort en annan vuxen.");
    await run("DELETE FROM class_guides WHERE class_id = ? AND user_id = ?", cls.id, target);
    return [200, { ok: true }];
  }

  // A student joins another class with its code (a school class, a family), or leaves one.
  async function joinClass() {
    const s = await requireUser();
    if (s.user.role !== "student") throw new ApiError(403, "Bara elever kan gå med i en klass.");
    const b = await readJson(request, 2000);
    const cls = await one("SELECT id FROM classes WHERE code = ?", normalizeCode(b.classCode));
    if (!cls) throw new ApiError(400, "Koden stämmer inte. Fråga din lärare eller vårdnadshavare efter rätt kod.");
    const owner = await tryOne("SELECT g.caregiver AS c FROM classes c JOIN users g ON g.id = c.teacher_id WHERE c.id = ?", cls.id);
    const already = await one("SELECT 1 AS x FROM class_members WHERE class_id = ? AND user_id = ?", cls.id, s.user.id);
    if (owner && owner.c && !already && (await one("SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?", cls.id)).n >= FAMILY_MAX) throw new ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
    await addMember(cls.id, s.user.id);
    return [200, { user: publicUser(await withGuide(await userById(s.user.id))) }];
  }

  async function leaveClass(classId) {
    const s = await requireUser();
    if (s.user.role !== "student") throw new ApiError(403, "Bara elever kan lämna en klass.");
    const id = Number(classId);
    if (!(await one("SELECT 1 AS x FROM class_members WHERE class_id = ? AND user_id = ?", id, s.user.id))) throw new ApiError(404, "Du är inte med i den klassen.");
    await run("DELETE FROM class_members WHERE class_id = ? AND user_id = ?", id, s.user.id);
    await fixPrimaryClass(s.user.id);
    return [200, { user: publicUser(await withGuide(await userById(s.user.id))) }];
  }

  // a class that the user is a guide of (any guide), and the classes a guide and a student have in common
  const guidedClass = (id, userId) => one("SELECT c.* FROM classes c JOIN class_guides cg ON cg.class_id = c.id WHERE c.id = ? AND cg.user_id = ?", Number(id), userId);
  const sharedClasses = (studentId, guideId) => all(
    "SELECT c.* FROM classes c JOIN class_members m ON m.class_id = c.id JOIN class_guides cg ON cg.class_id = c.id WHERE m.user_id = ? AND cg.user_id = ? ORDER BY c.id", studentId, guideId);

  async function updateClass(id) {
    const s = await requireGuide();
    const cls = await guidedClass(id, s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte.");
    const b = await readJson(request, 2000);
    if (typeof b.rewards === "boolean") {
      await run("INSERT INTO class_settings (class_id, rewards) VALUES (?, ?) ON CONFLICT (class_id) DO UPDATE SET rewards = excluded.rewards", cls.id, b.rewards ? 1 : 0);
    }
    return [200, { ok: true }];
  }

  async function createClass() {
    const s = await requireGuide();
    const b = await readJson(request, 2000);
    const name = str(b.name, 60).trim();
    if (!name) throw new ApiError(400, "Ge klassen ett namn.");
    if (s.user.caregiver && (await one("SELECT COUNT(*) AS n FROM classes WHERE teacher_id = ?", s.user.id)).n >= 1) throw new ApiError(400, "Du har redan en familj.");
    const made = await makeClass(name, s.user.id);
    return [201, { "class": { id: made.id, name, code: made.code, guideCode: made.guideCode, students: 0, owner: true } }];
  }

  // A guide makes the account of a child (a young child has no one else to do it): the name, a user name and a password.
  async function createStudent() {
    const s = await requireGuide();
    const b = await readJson(request, 5000);
    const cls = await guidedClass(b.classId, s.user.id);
    if (!cls) throw new ApiError(400, "Välj en av dina klasser.");
    const username = str(b.username, 40).trim();
    const displayName = str(b.displayName, 80).trim();
    if (!validUsername(username)) throw new ApiError(400, "Användarnamnet ska vara 3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    if (!displayName) throw new ApiError(400, "Ange namnet.");
    checkPassword(b.password, username);
    if (s.user.caregiver && (await one("SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?", cls.id)).n >= FAMILY_MAX) throw new ApiError(400, "Familjen har redan " + FAMILY_MAX + " barn.");
    if (await one("SELECT 1 AS x FROM users WHERE username = ?", username)) throw new ApiError(409, "Användarnamnet är redan upptaget.");
    let id;
    try {
      id = (await run("INSERT INTO users (username, display_name, role, password_hash, class_id, created_at) VALUES (?, ?, 'student', ?, ?, ?)",
        username, displayName, await hashPassword(b.password), cls.id, nowIso())).meta.last_row_id;
    } catch (e) {
      throw new ApiError(409, "Användarnamnet är redan upptaget.");
    }
    await addMember(cls.id, id);
    return [201, { student: { id: String(id), username, name: displayName, classId: cls.id } }];
  }

  async function teacherStudents() {
    const s = await requireGuide();
    const [students, progressRows, attemptRows, feedbackRows, chatRows] = await Promise.all([
      all("SELECT u.id, u.username, u.display_name, u.created_at, GROUP_CONCAT(c.name, ' · ') AS class_name, GROUP_CONCAT(c.id) AS class_ids FROM users u " +
        "JOIN class_members m ON m.user_id = u.id JOIN class_guides cg ON cg.class_id = m.class_id AND cg.user_id = ? JOIN classes c ON c.id = m.class_id " +
        "WHERE u.role = 'student' GROUP BY u.id ORDER BY u.display_name", s.user.id),
      all("SELECT p.user_id, p.lesson_id, p.data FROM progress p WHERE p.user_id IN (" + MINE_STUDENTS + ")", s.user.id),
      all("SELECT a.id, a.user_id, a.data, a.created_at FROM attempts a WHERE a.user_id IN (" + MINE_STUDENTS + ") ORDER BY a.id", s.user.id),
      all("SELECT f.id, f.student_id, f.lesson_id, f.task_id, f.text, f.sticker, f.created_at, f.read_at FROM feedback f WHERE f.class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY f.id", s.user.id),
      all("SELECT id, student_id, from_teacher, text, lesson_id, task_id, context, created_at, read_at, class_id FROM chat WHERE class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY id DESC LIMIT 1000", s.user.id).catch(() => [])
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
      id: String(u.id), username: u.username, name: u.display_name, "class": u.class_name, classIds: String(u.class_ids).split(",").map(Number), classId: Number(String(u.class_ids).split(",")[0]),
      color: COLORS[u.id % COLORS.length], createdAt: u.created_at,
      lessonProgress: progress[u.id] || {}, attempts: attempts[u.id] || [], feedback: sent[u.id] || [], chat: chat[u.id] || []
    })) }];
  }

  async function studentOfTeacher(studentId, teacherId) {
    const st = await one("SELECT u.* FROM users u WHERE u.id = ? AND u.role = 'student' AND u.id IN (" + MINE_STUDENTS + ")", Number(studentId), teacherId);
    if (!st) throw new ApiError(404, "Eleven finns inte i dina klasser.");
    return st;
  }

  // ----- assignments and feedback (teacher) -----
  async function listAssignments() {
    const s = await requireGuide();
    const sql = (cols) => "SELECT a.id, a.class_id, a.student_id, a.lesson_id, a.kind, " + cols + "a.note, a.due_date, a.created_at, c.name AS class_name, s.display_name AS student_name " +
      "FROM assignments a JOIN classes c ON c.id = a.class_id LEFT JOIN users s ON s.id = a.student_id " +
      "WHERE a.archived = 0 AND a.class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?) ORDER BY a.due_date IS NULL, a.due_date, a.id";
    // a database made before prov existed has no column "config" (migrations/005-prov.sql adds it)
    const rows = await all(sql("a.config, "), s.user.id).catch(() => all(sql(""), s.user.id));
    return [200, { assignments: rows.map(publicAssignment) }];
  }

  async function createAssignment() {
    const s = await requireGuide();
    const b = await readJson(request, 5000);
    const cls = await guidedClass(b.classId, s.user.id);
    if (!cls) throw new ApiError(400, "Välj en av dina klasser.");
    let studentId = null;
    if (b.studentId !== undefined && b.studentId !== null && b.studentId !== "") {
      const st = await one("SELECT u.* FROM users u JOIN class_members m ON m.user_id = u.id WHERE u.id = ? AND m.class_id = ? AND u.role = 'student'", Number(b.studentId), cls.id);
      if (!st) throw new ApiError(400, "Eleven går inte i den klassen.");
      studentId = st.id;
    }
    const lessonId = str(b.lessonId, 80);
    if (!ID_RE.test(lessonId)) throw new ApiError(400, "Välj en lektion.");
    const dueDate = str(b.dueDate, 10);
    if (dueDate && (!DATE_RE.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) throw new ApiError(400, "Ogiltigt datum.");
    const note = str(b.note, 400).trim();
    const kind = b.kind === "practice" ? "practice" : b.kind === "prov" ? "prov" : "lesson";
    if (kind === "prov") {
      const config = cleanProv(b.config);
      try {
        const res = await run("INSERT INTO assignments (class_id, student_id, teacher_id, lesson_id, note, due_date, created_at, kind, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          cls.id, studentId, s.user.id, config.lessons[0], note, dueDate || null, nowIso(), kind, JSON.stringify(config));
        return [201, { id: res.meta.last_row_id }];
      } catch (e) {
        throw new ApiError(500, "Databasen behöver uppdateras innan prov kan skapas (migrations/005-prov.sql, se cloudflare/README.md).");
      }
    }
    const res = await run("INSERT INTO assignments (class_id, student_id, teacher_id, lesson_id, note, due_date, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      cls.id, studentId, s.user.id, lessonId, note, dueDate || null, nowIso(), kind);
    return [201, { id: res.meta.last_row_id }];
  }

  async function archiveAssignment(id) {
    const s = await requireGuide();
    await run("UPDATE assignments SET archived = 1 WHERE id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?)", Number(id), s.user.id);
    return [200, { ok: true }];
  }

  async function createFeedback() {
    const s = await requireGuide();
    const b = await readJson(request, 5000);
    const student = await studentOfTeacher(b.studentId, s.user.id);
    const text = str(b.text, 600).trim();
    const sticker = b.sticker ? str(b.sticker, 20) : null;
    if (sticker && STICKERS.indexOf(sticker) < 0) throw new ApiError(400, "Okänd dekal.");
    if (!text && !sticker) throw new ApiError(400, "Skriv något eller välj en dekal.");
    const lessonId = b.lessonId ? str(b.lessonId, 80) : null;
    const taskId = b.taskId ? str(b.taskId, 80) : null;
    if ((lessonId && !ID_RE.test(lessonId)) || (taskId && !ID_RE.test(taskId))) throw new ApiError(400, "Ogiltigt id.");
    const shared = await sharedClasses(student.id, s.user.id);
    const cls = (b.classId !== undefined && shared.find((c) => c.id === Number(b.classId))) || shared[0];
    const res = await run("INSERT INTO feedback (student_id, teacher_id, lesson_id, task_id, text, sticker, created_at, class_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      student.id, s.user.id, lessonId, taskId, text, sticker, nowIso(), cls.id);
    return [201, { id: res.meta.last_row_id }];
  }

  async function removeFeedback(id) {
    const s = await requireGuide();
    await run("DELETE FROM feedback WHERE id = ? AND class_id IN (SELECT class_id FROM class_guides WHERE user_id = ?)", Number(id), s.user.id);
    return [200, { ok: true }];
  }

  async function resetStudentPassword(studentId) {
    const s = await requireGuide();
    const student = await studentOfTeacher(studentId, s.user.id);
    const temp = randomCode(10);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(temp), student.id);
    await run("DELETE FROM sessions WHERE user_id = ?", student.id);
    return [200, { password: temp }];
  }

  // The statements that remove the students picked by `ids` (a SELECT of user ids, with its parameters) and everything that belongs to them. They
  // are meant for db.batch, which runs them as one transaction. Messages sent through the feedback form are found by the sender text (see senderLabel).
  function studentPurge(ids, ...params) {
    const del = (sql) => db.prepare(sql).bind(...params);
    return [
      del("DELETE FROM site_feedback WHERE sender IN (SELECT u.display_name || ' (elev' || COALESCE(', klass ' || c.name, '') || ')' FROM users u " +
        "LEFT JOIN classes c ON c.id = u.class_id WHERE u.id IN " + ids + ")"),
      del("DELETE FROM chat WHERE student_id IN " + ids),
      del("DELETE FROM attempts WHERE user_id IN " + ids),
      del("DELETE FROM progress WHERE user_id IN " + ids),
      del("DELETE FROM sessions WHERE user_id IN " + ids),
      del("DELETE FROM feedback WHERE student_id IN " + ids),
      del("DELETE FROM assignments WHERE student_id IN " + ids),
      del("DELETE FROM users WHERE role = 'student' AND id IN " + ids)
    ];
  }

  // The students who are in these classes and in no other (the classes are a SELECT of class ids, written twice in the parameters).
  const onlyIn = (classSelect) => "(SELECT m.user_id FROM class_members m WHERE m.class_id IN (" + classSelect + ") AND NOT EXISTS " +
    "(SELECT 1 FROM class_members m2 WHERE m2.user_id = m.user_id AND m2.class_id NOT IN (" + classSelect + ")))";

  async function deleteStudent(studentId) {
    const s = await requireGuide();
    const student = await studentOfTeacher(studentId, s.user.id);
    // the student leaves the classes the two share; the account goes when no class is left
    const shared = await sharedClasses(student.id, s.user.id);
    const left = await one("SELECT COUNT(*) AS n FROM class_members WHERE user_id = ? AND class_id NOT IN (SELECT class_id FROM class_guides WHERE user_id = ?)", student.id, s.user.id);
    if (left.n === 0) {
      await db.batch(studentPurge("(SELECT ?)", student.id).concat([db.prepare("DELETE FROM class_members WHERE user_id = ?").bind(student.id)]));
    } else {
      const statements = [];
      shared.forEach((c) => {
        statements.push(db.prepare("DELETE FROM class_members WHERE class_id = ? AND user_id = ?").bind(c.id, student.id));
        statements.push(db.prepare("DELETE FROM feedback WHERE student_id = ? AND class_id = ?").bind(student.id, c.id));
        statements.push(db.prepare("DELETE FROM chat WHERE student_id = ? AND class_id = ?").bind(student.id, c.id));
      });
      await db.batch(statements);
      await fixPrimaryClass(student.id);
    }
    return [200, { ok: true }];
  }

  // A class is removed by its owner, together with its students and their data (end of the school year). A student who is in another class too
  // keeps the account and loses only this class (and what belongs to it).
  async function deleteClass(id) {
    const s = await requireGuide();
    const cls = await one("SELECT id FROM classes WHERE id = ? AND teacher_id = ?", Number(id), s.user.id);
    if (!cls) throw new ApiError(404, "Klassen finns inte, eller så är det någon annan som har skapat den.");
    const count = await one("SELECT COUNT(*) AS n FROM class_members WHERE class_id = ?", cls.id);
    await db.batch(studentPurge(onlyIn("SELECT ?"), cls.id, cls.id).concat([
      db.prepare("DELETE FROM feedback WHERE class_id = ?").bind(cls.id),
      db.prepare("DELETE FROM chat WHERE class_id = ?").bind(cls.id),
      db.prepare("DELETE FROM assignments WHERE class_id = ?").bind(cls.id),
      db.prepare("DELETE FROM class_settings WHERE class_id = ?").bind(cls.id),
      db.prepare("DELETE FROM class_members WHERE class_id = ?").bind(cls.id),
      db.prepare("DELETE FROM class_guides WHERE class_id = ?").bind(cls.id),
      db.prepare("DELETE FROM classes WHERE id = ?").bind(cls.id)
    ]));
    // students who stay: their first class may have been this one
    const stay = await all("SELECT id FROM users WHERE role = 'student' AND class_id IS NULL AND id IN (SELECT user_id FROM class_members)");
    for (const u of stay) await fixPrimaryClass(u.id);
    return [200, { ok: true, students: count ? count.n : 0 }];
  }

  // "Radera mitt konto": needs the password. A teacher's classes, students and everything about them go with it.
  async function deleteMyAccount() {
    const s = await requireUser();
    const b = await readJson(request, 2000);
    if (!(await verifyPassword(str(b.password, 200), s.user.password_hash))) throw new ApiError(400, "Lösenordet stämmer inte.");
    const uid = s.user.id;
    let statements;
    if (s.user.role === "teacher") {
      const mine = "(SELECT id FROM classes WHERE teacher_id = ?)";
      statements = studentPurge(onlyIn("SELECT id FROM classes WHERE teacher_id = ?"), uid, uid).concat([
        db.prepare("DELETE FROM assignments WHERE class_id IN " + mine + " OR teacher_id = ?").bind(uid, uid),
        db.prepare("DELETE FROM class_settings WHERE class_id IN " + mine).bind(uid),
        db.prepare("DELETE FROM chat WHERE class_id IN " + mine + " OR teacher_id = ?").bind(uid, uid),
        db.prepare("DELETE FROM feedback WHERE class_id IN " + mine + " OR teacher_id = ?").bind(uid, uid),
        db.prepare("DELETE FROM class_members WHERE class_id IN " + mine).bind(uid),
        db.prepare("DELETE FROM class_guides WHERE class_id IN " + mine + " OR user_id = ?").bind(uid, uid),
        db.prepare("DELETE FROM classes WHERE teacher_id = ?").bind(uid),
        db.prepare("UPDATE lessons SET updated_by = NULL WHERE updated_by = ?").bind(uid),
        db.prepare("DELETE FROM site_feedback WHERE sender = ?").bind(senderLabel(s.user, null)),
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid),
        db.prepare("DELETE FROM attempts WHERE user_id = ?").bind(uid),
        db.prepare("DELETE FROM progress WHERE user_id = ?").bind(uid),
        db.prepare("DELETE FROM users WHERE id = ?").bind(uid)
      ]);
    } else {
      statements = studentPurge("(SELECT ?)", uid).concat([db.prepare("DELETE FROM class_members WHERE user_id = ?").bind(uid)]);
    }
    await db.batch(statements);
    return [200, { ok: true }];
  }

  // The students of a guide: those who are in a class the guide is a guide of.
  const MINE_STUDENTS = "SELECT m.user_id FROM class_members m JOIN class_guides cg ON cg.class_id = m.class_id WHERE cg.user_id = ?";

  // Without the tables of migrations/007-multi.sql nothing works, so that is said at once instead of failing in some query.
  async function requireMultiSchema() {
    if (multiSchemaSeen) return;
    try {
      await one("SELECT 1 AS x FROM class_members LIMIT 1");
      multiSchemaSeen = true;
    } catch (e) {
      if (/no such table/i.test(String(e && e.message))) throw new ApiError(503, "Databasen behöver uppdateras (migrations/007-multi.sql, se cloudflare/README.md).");
      throw e;
    }
  }

  async function handle(method, p) {
    let m;
    await requireMultiSchema();
    await housekeeping();
    if (method === "GET" && p === "/api/me") { const s = await currentSession(); return [200, { user: s ? publicUser(await withGuide(s.user)) : null }]; }
    if (method === "POST" && p === "/api/register") return register();
    if (method === "POST" && p === "/api/login") return login();
    if (method === "POST" && p === "/api/logout") {
      const token = bearer();
      if (token) await run("DELETE FROM sessions WHERE token_hash = ?", await sha256Hex(token));
      return [200, { ok: true }];
    }
    if (method === "POST" && p === "/api/me/password") return changePassword();
    if (method === "POST" && p === "/api/me/delete") return deleteMyAccount();
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
    if (method === "POST" && p === "/api/me/classes") return joinClass();
    if ((m = /^\/api\/me\/classes\/(\d+)$/.exec(p)) && method === "DELETE") return leaveClass(m[1]);
    if (method === "POST" && p === "/api/teacher/join") return joinAsGuide();
    if ((m = /^\/api\/teacher\/classes\/(\d+)\/guides\/(\d+)$/.exec(p)) && method === "DELETE") return removeGuide(m[1], m[2]);
    if (method === "GET" && p === "/api/teacher/classes") return listClasses();
    if (method === "POST" && p === "/api/teacher/classes") return createClass();
    if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p)) && method === "PUT") return updateClass(m[1]);
    if ((m = /^\/api\/teacher\/classes\/(\d+)$/.exec(p)) && method === "DELETE") return deleteClass(m[1]);
    if (method === "GET" && p === "/api/teacher/students") return teacherStudents();
    if (method === "POST" && p === "/api/teacher/students") return createStudent();
    if (method === "GET" && p === "/api/teacher/assignments") return listAssignments();
    if (method === "POST" && p === "/api/teacher/assignments") return createAssignment();
    if ((m = /^\/api\/teacher\/assignments\/(\d+)$/.exec(p)) && method === "DELETE") return archiveAssignment(m[1]);
    if (method === "POST" && p === "/api/teacher/feedback") return createFeedback();
    if ((m = /^\/api\/teacher\/feedback\/(\d+)$/.exec(p)) && method === "DELETE") return removeFeedback(m[1]);
    if ((m = /^\/api\/teacher\/students\/(\d+)\/password$/.exec(p)) && method === "POST") return resetStudentPassword(m[1]);
    if ((m = /^\/api\/teacher\/students\/(\d+)$/.exec(p)) && method === "DELETE") return deleteStudent(m[1]);
    const handled = await accountRoute(method, p);
    if (handled) return handled;
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
      if (url.pathname === "/") return reply(200, { ok: true, service: "gaussica-api" }, cors);
      if (url.pathname === "/health") {
        // for a monitor: does the database have what this version of the worker needs (see cloudflare/migrate.js)
        let schema = "ok";
        try { await env.DB.prepare("SELECT 1 AS x FROM class_members LIMIT 1").first(); }
        catch (e) { schema = /no such table/i.test(String(e && e.message)) ? "behöver migrations/007-multi.sql" : "fel: " + String(e && e.message).slice(0, 80); }
        return reply(200, { ok: true, service: "gaussica-api", schema: schema }, cors);
      }
      const [status, body] = await createApi(env, request).handle(request.method, url.pathname);
      return reply(status, body, cors);
    } catch (err) {
      if (err instanceof ApiError) return reply(err.status, err.code ? { error: err.message, code: err.code } : { error: err.message }, cors);
      console.error(err);
      return reply(500, { error: "Något gick fel på servern." }, cors);
    }
  }
};
