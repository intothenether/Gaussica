"use strict";
// E-mail for adults (verify the address, reset a lost password), who may use the site (free, trial, paid: billing-core.js), the payments through
// Paddle (checkout, the customer portal and the webhook), codes that give free access, and what the person who runs the site can do (admin).
// cloudflare/worker.js has the same rules in its own way (it is one file and uses D1): change both.
//
// Settings (environment variables; none of them is needed to run the site, the features just stay off):
//   RESEND_API_KEY, MAIL_FROM            send e-mail through Resend (MAIL_FROM like "Gaussica <no-reply@your-domain>", on a domain verified at Resend)
//   SITE_URL                             where the links in the e-mails go (default https://gaussica.se)
//   CAREGIVER_EMAIL_REQUIRED=1           a caregiver has to give an e-mail address and accept the terms to make an account
//   BILLING_ENABLED=1                    charge: a family without free access, a trial or a subscription cannot use the site (off: everybody is in)
//   TRIAL_DAYS                           days of free trial for a new family (14)
//   PADDLE_ENV=production                sandbox by default; PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRICES (JSON, see below), PADDLE_API_BASE (tests)
//   ADMIN_TOKEN                          a long secret that allows /api/admin/... (give free access, make codes), see scripts/admin.js
//   MAIL_DEV=1                           keep the e-mails in memory (GET /api/dev/outbox) instead of sending them (tests)
// PADDLE_PRICES: {"manad": {"priceId": "pri_...", "label": "Månad", "text": "49 kr per månad"}, "ar": {...}}

const crypto = require("node:crypto");
const sec = require("./security");
const core = require("./billing-core");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VERIFY_MINUTES = 24 * 60;
const RESET_MINUTES = 60;

function createAccount(deps) {
  const { db, ApiError, send, readJson, readRaw, requireUser, requireGuide, str, nowIso, ip, checkPassword } = deps;

  const env = () => process.env;
  const billingOn = () => env().BILLING_ENABLED === "1";
  const emailRequired = () => env().CAREGIVER_EMAIL_REQUIRED === "1";
  const trialDays = () => Math.max(1, Math.min(90, Math.round(Number(env().TRIAL_DAYS)) || 14));
  const siteUrl = () => String(env().SITE_URL || "https://gaussica.se").replace(/\/+$/, "");
  const termsVersion = () => env().TERMS_VERSION || "2026-11";
  const paddleBase = () => env().PADDLE_API_BASE || (env().PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com");
  const paddleReady = () => Boolean(env().PADDLE_API_KEY && plans().length);
  const outbox = [];

  const forgotIp = sec.createLimiter(10, 60 * 60 * 1000);
  const forgotMail = sec.createLimiter(3, 60 * 60 * 1000);
  const verifyLimit = sec.createLimiter(5, 60 * 60 * 1000);
  setInterval(function () { forgotIp.sweep(); forgotMail.sweep(); verifyLimit.sweep(); }, 10 * 60 * 1000).unref();

  const q = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    userByName: db.prepare("SELECT * FROM users WHERE username = ?"),
    setEmail: db.prepare("UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?"),
    verifyEmail: db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ? AND email = ?"),
    setTerms: db.prepare("UPDATE users SET terms_accepted_at = ?, terms_version = ? WHERE id = ?"),
    setPassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
    deleteSessionsOf: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
    insertToken: db.prepare("INSERT INTO email_tokens (token_hash, user_id, purpose, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)"),
    tokenByHash: db.prepare("SELECT * FROM email_tokens WHERE token_hash = ?"),
    useToken: db.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL"),
    deleteTokens: db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?"),
    entOf: db.prepare("SELECT * FROM entitlements WHERE user_id = ?"),
    insertEnt: db.prepare("INSERT OR IGNORE INTO entitlements (user_id, plan, free_reason, free_until, trial_ends_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"),
    setEnt: db.prepare("UPDATE entitlements SET plan = ?, free_reason = ?, free_until = ?, trial_ends_at = ?, status = ?, period_end = ?, cancel_at_period_end = ?, paddle_customer_id = ?, paddle_subscription_id = ?, updated_at = ? WHERE user_id = ?"),
    ownersOfStudent: db.prepare("SELECT DISTINCT c.teacher_id AS owner, g.caregiver AS caregiver FROM class_members m JOIN classes c ON c.id = m.class_id JOIN users g ON g.id = c.teacher_id WHERE m.user_id = ?"),
    ownersOfGuide: db.prepare("SELECT DISTINCT c.teacher_id AS owner, g.caregiver AS caregiver FROM class_guides cg JOIN classes c ON c.id = cg.class_id JOIN users g ON g.id = c.teacher_id WHERE cg.user_id = ?"),
    eventSeen: db.prepare("INSERT OR IGNORE INTO billing_events (id, type, received_at) VALUES (?, ?, ?)"),
    insertCode: db.prepare("INSERT INTO access_codes (code, reason, days, uses_left, created_at) VALUES (?, ?, ?, ?, ?)"),
    codeByCode: db.prepare("SELECT * FROM access_codes WHERE code = ?"),
    useCode: db.prepare("UPDATE access_codes SET uses_left = uses_left - 1 WHERE code = ? AND uses_left > 0")
  };

  // ----- e-mail -----
  async function sendMail(to, subject, text) {
    if (env().MAIL_DEV === "1") { outbox.push({ to: to, subject: subject, text: text, at: nowIso() }); if (outbox.length > 50) outbox.shift(); return true; }
    if (!env().RESEND_API_KEY || !env().MAIL_FROM) return false;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env().RESEND_API_KEY },
        body: JSON.stringify({ from: env().MAIL_FROM, to: [to], subject: subject, text: text })
      });
      return res.ok;
    } catch (e) { return false; }
  }

  const SIGNATURE = "\n\nHälsningar\nGaussica";
  const verifyMail = (name, link) => ["Bekräfta din e-postadress till Gaussica", "Hej " + name + "!\n\nBekräfta din e-postadress genom att öppna länken:\n" + link + "\n\nLänken fungerar i 24 timmar. Det är med den här adressen du kan få ett nytt lösenord om du glömmer det." + SIGNATURE];
  const resetMail = (name, link) => ["Nytt lösenord till Gaussica", "Hej " + name + "!\n\nDu (eller någon annan) bad om ett nytt lösenord. Öppna länken för att välja ett:\n" + link + "\n\nLänken fungerar i 1 timme och kan bara användas en gång. Bad du inte om det kan du strunta i det här mejlet: ditt lösenord ändras inte." + SIGNATURE];

  function newToken(userId, purpose, email, minutes) {
    const token = sec.newToken();
    q.deleteTokens.run(userId, purpose);
    q.insertToken.run(sec.hashToken(token), userId, purpose, email, nowIso(), new Date(Date.now() + minutes * 60000).toISOString());
    return token;
  }

  async function sendVerification(user) {
    if (!user.email) return false;
    const token = newToken(user.id, "verify", user.email, VERIFY_MINUTES);
    const m = verifyMail(user.display_name, siteUrl() + "/#verifiera/" + token);
    return sendMail(user.email, m[0], m[1]);
  }

  const cleanEmail = (v) => str(v, 120).trim().toLowerCase();
  function validEmail(e) { return EMAIL_RE.test(e) && e.length <= 120; }

  // ----- entitlements and access -----
  function startEntitlement(userId) {
    const now = nowIso();
    if (billingOn()) q.insertEnt.run(userId, "trial", null, null, new Date(Date.now() + trialDays() * 86400000).toISOString(), now);
    else q.insertEnt.run(userId, "free", "beta", null, null, now);
  }

  const better = (a, b) => (a.state !== b.state ? (a.state === "active" ? a : b) : (a.until === null && b.until !== null ? a : b.until === null && a.until !== null ? b : (String(a.until) >= String(b.until) ? a : b)));

  // The access of a user: a caregiver's family (or the family of the caregiver that the user is a second adult in), a child's families, and for a teacher
  // (school) always in. When a user has several (a child in a school class and a family) the best of them counts.
  function accessOfUser(u) {
    const billing = billingOn();
    const owners = u.role === "student" ? q.ownersOfStudent.all(u.id) : q.ownersOfGuide.all(u.id);
    const school = { state: "active", plan: "school", reason: null, until: null, daysLeft: null, cancelAtPeriodEnd: false, billing: billing };
    if (u.role === "teacher" && !u.caregiver) return school;
    if (!owners.length) return Object.assign({}, school, { plan: "free", reason: "ingen familj" });
    const list = owners.map(function (o) { return o.caregiver ? core.accessOf(q.entOf.get(o.owner) || null, { billing: billing }) : school; });
    return list.reduce(better);
  }

  function requireAccess(u) {
    if (accessOfUser(u).state !== "active") throw new ApiError(402, "Familjens prenumeration har gått ut. Be din vårdnadshavare förnya den.", "subscription");
  }

  // ----- e-mail endpoints -----
  async function setEmail(req, res) {
    const s = requireUser(req);
    if (s.user.role !== "teacher") throw new ApiError(403, "Bara vuxna har en e-postadress.");
    const b = await readJson(req, 4000);
    const email = cleanEmail(b.email);
    if (!validEmail(email)) throw new ApiError(400, "E-postadressen ser inte rätt ut.");
    const full = q.userById.get(s.user.id);
    if (full.email && full.email !== email) {
      if (!(await sec.verifyPassword(str(b.password, 200), full.password_hash))) throw new ApiError(400, "Skriv ditt lösenord för att byta e-postadress.");
    }
    const other = q.userByEmail.get(email);
    if (other && other.id !== s.user.id) throw new ApiError(409, "Den e-postadressen går inte att använda. Har du redan ett konto? Logga in med det.");
    if (full.email === email && full.email_verified_at) return send(res, 200, { ok: true, verified: true, sent: false });
    const wait = verifyLimit.check("v:" + s.user.id);
    if (wait) throw new ApiError(429, "För många mejl. Vänta " + Math.ceil(wait / 60) + " min.");
    q.setEmail.run(email, s.user.id);
    const sent = await sendVerification(Object.assign({}, full, { email: email }));
    send(res, 200, { ok: true, verified: false, sent: sent });
  }

  async function resendVerification(req, res) {
    const s = requireUser(req);
    const full = q.userById.get(s.user.id);
    if (!full.email) throw new ApiError(400, "Du har ingen e-postadress än.");
    if (full.email_verified_at) return send(res, 200, { ok: true, verified: true, sent: false });
    const wait = verifyLimit.check("v:" + s.user.id);
    if (wait) throw new ApiError(429, "För många mejl. Vänta " + Math.ceil(wait / 60) + " min.");
    send(res, 200, { ok: true, verified: false, sent: await sendVerification(full) });
  }

  async function verifyEmailToken(req, res) {
    const b = await readJson(req, 2000);
    const row = q.tokenByHash.get(sec.hashToken(str(b.token, 200)));
    if (!row || row.purpose !== "verify" || row.used_at || row.expires_at < nowIso()) throw new ApiError(400, "Länken har gått ut eller är redan använd. Be om en ny i Konto.");
    if (!q.verifyEmail.run(nowIso(), row.user_id, row.email).changes) throw new ApiError(400, "Länken gäller en adress du inte har längre.");
    q.useToken.run(nowIso(), row.token_hash);
    send(res, 200, { ok: true, email: row.email });
  }

  async function forgot(req, res) {
    const b = await readJson(req, 2000);
    const email = cleanEmail(b.email);
    const wait = Math.max(forgotIp.check(ip(req)), validEmail(email) ? forgotMail.check(email) : 0);
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    if (validEmail(email)) {
      const user = q.userByEmail.get(email);
      // only an address that has been verified can get a new password, so that nobody can take over an account by putting its name on another address
      if (user && user.email_verified_at) {
        const token = newToken(user.id, "reset", email, RESET_MINUTES);
        const m = resetMail(user.display_name, siteUrl() + "/#aterstall/" + token);
        await sendMail(email, m[0], m[1]);
      }
    }
    send(res, 200, { ok: true });   // the same answer whether the address exists or not
  }

  async function resetPassword(req, res) {
    const b = await readJson(req, 4000);
    const row = q.tokenByHash.get(sec.hashToken(str(b.token, 200)));
    if (!row || row.purpose !== "reset" || row.used_at || row.expires_at < nowIso()) throw new ApiError(400, "Länken har gått ut eller är redan använd. Be om en ny.");
    const user = q.userById.get(row.user_id);
    if (!user) throw new ApiError(400, "Länken har gått ut eller är redan använd. Be om en ny.");
    checkPassword(b.password, user.username);
    q.setPassword.run(await sec.hashPassword(b.password), user.id);
    q.useToken.run(nowIso(), row.token_hash);
    q.deleteTokens.run(user.id, "reset");
    q.deleteSessionsOf.run(user.id);
    send(res, 200, { ok: true, username: user.username });
  }

  // ----- billing -----
  function plans() {
    try {
      const p = JSON.parse(env().PADDLE_PRICES || "{}");
      return Object.keys(p).filter(function (id) { return p[id] && typeof p[id].priceId === "string"; }).map(function (id) { return { id: id, priceId: p[id].priceId, label: String(p[id].label || id), text: String(p[id].text || "") }; });
    } catch (e) { return []; }
  }

  function billingStatus(req, res) {
    const s = requireUser(req);
    const ent = s.user.role === "teacher" && s.user.caregiver ? q.entOf.get(s.user.id) : null;
    send(res, 200, {
      billing: billingOn(), checkout: billingOn() && paddleReady(), access: accessOfUser(s.user),
      plans: plans().map(function (p) { return { id: p.id, label: p.label, text: p.text }; }),
      manage: Boolean(ent && ent.paddle_customer_id), owner: Boolean(s.user.role === "teacher" && s.user.caregiver && ent)
    });
  }

  async function paddle(method, path, body) {
    const res = await fetch(paddleBase() + path, { method: method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + env().PADDLE_API_KEY }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) throw new ApiError(502, "Betalningstjänsten svarade inte som den ska. Försök igen om en stund.");
    return json && json.data;
  }

  async function checkout(req, res) {
    const s = requireGuide(req);
    if (!s.user.caregiver) throw new ApiError(403, "Prenumerationen är för familjer.");
    if (!billingOn() || !paddleReady()) throw new ApiError(503, "Betalning är inte påslagen än.");
    const b = await readJson(req, 2000);
    const plan = plans().find(function (p) { return p.id === str(b.plan, 40); });
    if (!plan) throw new ApiError(400, "Välj en prenumeration.");
    const data = await paddle("POST", "/transactions", { items: [{ price_id: plan.priceId, quantity: 1 }], collection_mode: "automatic", custom_data: { user_id: String(s.user.id) } });
    const url = data && data.checkout && data.checkout.url;
    if (!url) throw new ApiError(502, "Betalningstjänsten gav ingen betalsida. Försök igen om en stund.");
    send(res, 200, { url: url });
  }

  async function portal(req, res) {
    const s = requireGuide(req);
    const ent = q.entOf.get(s.user.id);
    if (!ent || !ent.paddle_customer_id) throw new ApiError(400, "Det finns ingen prenumeration att hantera.");
    const data = await paddle("POST", "/customers/" + encodeURIComponent(ent.paddle_customer_id) + "/portal-sessions", ent.paddle_subscription_id ? { subscription_ids: [ent.paddle_subscription_id] } : {});
    const url = data && data.urls && data.urls.general && data.urls.general.overview;
    if (!url) throw new ApiError(502, "Betalningstjänsten gav ingen sida. Försök igen om en stund.");
    send(res, 200, { url: url });
  }

  // "ts=1671552777;h1=<hex>" is the HMAC-SHA256 of "<ts>:<raw body>" with the secret of the notification
  function paddleSignatureOk(header, raw) {
    const secret = env().PADDLE_WEBHOOK_SECRET;
    if (!secret) return false;
    const parts = {};
    String(header || "").split(";").forEach(function (kv) { const i = kv.indexOf("="); if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    if (!parts.ts || !parts.h1) return false;
    if (Math.abs(Date.now() / 1000 - Number(parts.ts)) > 300) return false;
    const want = crypto.createHmac("sha256", secret).update(parts.ts + ":" + raw).digest("hex");
    return sec.safeEqual(want, parts.h1);
  }

  async function webhook(req, res) {
    const raw = await readRaw(req, 200000);
    if (!paddleSignatureOk(req.headers["paddle-signature"], raw)) throw new ApiError(400, "Ogiltig signatur.");
    let event;
    try { event = JSON.parse(raw); } catch (e) { throw new ApiError(400, "Ogiltig JSON."); }
    if (event.event_id && !q.eventSeen.run(String(event.event_id), String(event.event_type || ""), nowIso()).changes) return send(res, 200, { ok: true, duplicate: true });
    const change = core.paddleChange(event);
    if (change) {
      const user = q.userById.get(change.userId);
      if (user) {
        startEntitlement(user.id);
        const cur = q.entOf.get(user.id);
        // an account with free access for good keeps it (it only learns the ids), a trial or a lapsed one becomes paid
        const keepFree = cur.plan === "free" && !cur.free_until;
        q.setEnt.run(keepFree ? "free" : "paid", cur.free_reason, keepFree ? cur.free_until : null, cur.trial_ends_at, change.status, change.periodEnd, change.cancelAtPeriodEnd ? 1 : 0, change.customerId || cur.paddle_customer_id, change.subscriptionId || cur.paddle_subscription_id, nowIso(), user.id);
      }
    }
    send(res, 200, { ok: true });
  }

  // ----- free access by a code, and by the person who runs the site -----
  const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function newCode() { let c = ""; for (let i = 0; i < 10; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]; return c; }
  const normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  function grantFree(userId, reason, days) {
    startEntitlement(userId);
    const cur = q.entOf.get(userId);
    const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
    q.setEnt.run("free", str(reason, 80) || "gratis", until, cur.trial_ends_at, cur.status, cur.period_end, cur.cancel_at_period_end, cur.paddle_customer_id, cur.paddle_subscription_id, nowIso(), userId);
  }

  async function redeem(req, res) {
    const s = requireGuide(req);
    if (!s.user.caregiver) throw new ApiError(403, "Koden är för familjer.");
    const b = await readJson(req, 1000);
    const wait = verifyLimit.check("c:" + s.user.id);
    if (wait) throw new ApiError(429, "För många försök. Vänta " + Math.ceil(wait / 60) + " min.");
    const code = normalizeCode(b.code);
    const row = code ? q.codeByCode.get(code) : null;
    if (!row || row.uses_left < 1) throw new ApiError(400, "Koden stämmer inte eller är redan använd.");
    startEntitlement(s.user.id);
    const cur = q.entOf.get(s.user.id);
    if (cur.plan === "paid" && core.accessOf(cur, { billing: billingOn() }).state === "active") throw new ApiError(409, "Du har redan en prenumeration.");
    if (!q.useCode.run(code).changes) throw new ApiError(400, "Koden stämmer inte eller är redan använd.");
    grantFree(s.user.id, row.reason || "kod", row.days);
    send(res, 200, { ok: true, access: accessOfUser(q.userById.get(s.user.id)) });
  }

  function requireAdmin(req) {
    const token = env().ADMIN_TOKEN;
    if (!token || String(token).length < 16) throw new ApiError(503, "Admin är inte påslaget. Sätt ADMIN_TOKEN (minst 16 tecken).");
    const m = /^Bearer\s+(.+)$/.exec(String(req.headers.authorization || ""));
    if (!m || !sec.safeEqual(m[1], token)) throw new ApiError(401, "Fel admin-nyckel.");
  }

  async function adminAccess(req, res) {
    requireAdmin(req);
    const b = await readJson(req, 2000);
    const user = q.userByName.get(str(b.username, 40).trim());
    if (!user || user.role !== "teacher") throw new ApiError(404, "Hittar ingen vuxen med det användarnamnet.");
    const action = str(b.action, 20);
    if (action === "grant") grantFree(user.id, b.reason, Number(b.days) > 0 ? Math.round(Number(b.days)) : 0);
    else if (action === "revoke") {
      startEntitlement(user.id);
      const cur = q.entOf.get(user.id);
      q.setEnt.run("trial", null, null, nowIso(), cur.status, cur.period_end, cur.cancel_at_period_end, cur.paddle_customer_id, cur.paddle_subscription_id, nowIso(), user.id);
    } else if (action !== "show") throw new ApiError(400, "action ska vara grant, revoke eller show.");
    send(res, 200, { ok: true, username: user.username, entitlement: q.entOf.get(user.id) || null, access: accessOfUser(user) });
  }

  async function adminCodes(req, res) {
    requireAdmin(req);
    const b = await readJson(req, 2000);
    const uses = Math.max(1, Math.min(1000, Math.round(Number(b.uses)) || 1));
    const days = Number(b.days) > 0 ? Math.min(3650, Math.round(Number(b.days))) : null;
    const code = newCode();
    q.insertCode.run(code, str(b.reason, 80) || "kod", days, uses, nowIso());
    send(res, 201, { code: code, uses: uses, days: days });
  }

  // returns true when the request was one of ours
  async function route(req, res, method, p) {
    if (method === "POST" && p === "/api/me/email") { await setEmail(req, res); return true; }
    if (method === "POST" && p === "/api/me/email/resend") { await resendVerification(req, res); return true; }
    if (method === "POST" && p === "/api/auth/verify-email") { await verifyEmailToken(req, res); return true; }
    if (method === "POST" && p === "/api/auth/forgot") { await forgot(req, res); return true; }
    if (method === "POST" && p === "/api/auth/reset") { await resetPassword(req, res); return true; }
    if (method === "GET" && p === "/api/billing") { billingStatus(req, res); return true; }
    if (method === "POST" && p === "/api/billing/checkout") { await checkout(req, res); return true; }
    if (method === "POST" && p === "/api/billing/portal") { await portal(req, res); return true; }
    if (method === "POST" && p === "/api/billing/webhook") { await webhook(req, res); return true; }
    if (method === "POST" && p === "/api/billing/redeem") { await redeem(req, res); return true; }
    if (method === "POST" && p === "/api/admin/access") { await adminAccess(req, res); return true; }
    if (method === "POST" && p === "/api/admin/codes") { await adminCodes(req, res); return true; }
    if (method === "GET" && p === "/api/dev/outbox" && env().MAIL_DEV === "1") { send(res, 200, { mails: outbox }); return true; }
    return false;
  }

  return {
    route: route, accessOfUser: accessOfUser, requireAccess: requireAccess, startEntitlement: startEntitlement, sendVerification: sendVerification,
    emailRequired: emailRequired, termsVersion: termsVersion, validEmail: validEmail, cleanEmail: cleanEmail, setTerms: (id) => q.setTerms.run(nowIso(), termsVersion(), id),
    setEmail: (id, email) => q.setEmail.run(email, id), emailTaken: (email) => Boolean(q.userByEmail.get(email))
  };
}

module.exports = { createAccount };
