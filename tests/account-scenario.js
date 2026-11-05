"use strict";
// E-mail for adults, access (free, trial, paid) and the payments through Paddle: one scenario, run against the Node server (tests/api-account.js) and
// the Cloudflare worker (tests/worker-account.js). The sites are set up with CAREGIVER_EMAIL_REQUIRED=1, BILLING_ENABLED=1, a trial of 14 days, a Paddle
// that is a small server of the test, MAIL_DEV (the e-mails are kept, not sent) and an ADMIN_TOKEN.
//
// h: { client() -> { call(method, path, body, headers) -> { status, json } }, raw(method, path, text, headers) -> { status, json }, mails() -> [{ to, subject, text }],
//      paddle: [{ method, path, body }] (what the site asked Paddle), secret, adminToken, teacherCode }
const crypto = require("crypto");

module.exports = async function scenario(h, ok) {
  const link = (mail, kind) => { const m = new RegExp("#" + kind + "/([A-Za-z0-9_-]+)").exec(mail.text); return m ? m[1] : null; };
  const lastMail = async (to) => (await h.mails()).filter((m) => m.to === to).pop();
  const admin = (c, path, body) => c.call("POST", path, body, { Authorization: "Bearer " + h.adminToken });
  const sign = (event) => {
    const raw = JSON.stringify(event);
    const ts = String(Math.floor(Date.now() / 1000));
    return { raw, headers: { "Paddle-Signature": "ts=" + ts + ";h1=" + crypto.createHmac("sha256", h.secret).update(ts + ":" + raw).digest("hex") } };
  };
  const sub = (type, userId, data, id) => ({ event_id: id, event_type: type, data: Object.assign({ id: "sub_" + userId, customer_id: "ctm_" + userId, status: "active", custom_data: { user_id: String(userId) }, current_billing_period: { ends_at: new Date(Date.now() + 30 * 86400000).toISOString() } }, data) });

  // ----- registration of a caregiver: e-mail and terms -----
  const A = h.client();
  let r = await A.call("POST", "/api/register", { role: "caregiver", username: "forald1", displayName: "Maria Svensson", password: "hemligt-123" });
  ok(r.status === 400 && /e-post/i.test(r.json.error), "a caregiver has to give an e-mail address");
  r = await A.call("POST", "/api/register", { role: "caregiver", username: "forald1", displayName: "Maria Svensson", password: "hemligt-123", email: "inte-en-adress" });
  ok(r.status === 400, "an address that is not one is turned down");
  r = await A.call("POST", "/api/register", { role: "caregiver", username: "forald1", displayName: "Maria Svensson", password: "hemligt-123", email: "Maria@Example.se" });
  ok(r.status === 400 && /villkor/i.test(r.json.error), "and the terms have to be accepted");
  r = await A.call("POST", "/api/register", { role: "caregiver", username: "forald1", displayName: "Maria Svensson", password: "hemligt-123", email: "Maria@Example.se", acceptTerms: true });
  ok(r.status === 201 && r.json.user.email === "maria@example.se" && r.json.user.emailVerified === false, "an account is made, with the address in lower case and not verified");
  ok(r.json.user.access.state === "active" && r.json.user.access.plan === "trial" && r.json.user.access.daysLeft >= 13 && r.json.user.access.daysLeft <= 14, "a new family starts a trial of 14 days: " + JSON.stringify(r.json.user.access));
  const mailA = await lastMail("maria@example.se");
  ok(mailA && /Bekräfta/.test(mailA.subject) && link(mailA, "verifiera"), "a mail with a link to verify the address is sent");
  r = await h.client().call("POST", "/api/register", { role: "caregiver", username: "forald2", displayName: "Annan Person", password: "hemligt-123", email: "maria@example.se", acceptTerms: true });
  ok(r.status === 409, "the same address cannot be used for two accounts");

  // ----- verify the address -----
  r = await A.call("POST", "/api/auth/verify-email", { token: "fel-lank-123" });
  ok(r.status === 400, "a link that is wrong is turned down");
  r = await A.call("POST", "/api/auth/verify-email", { token: link(mailA, "verifiera") });
  ok(r.status === 200 && r.json.email === "maria@example.se", "the link verifies the address");
  r = await A.call("GET", "/api/me");
  ok(r.json.user.emailVerified === true, "and the account says so");
  r = await A.call("POST", "/api/auth/verify-email", { token: link(mailA, "verifiera") });
  ok(r.status === 400, "a link can be used once");

  // ----- a lost password -----
  const F = h.client();
  const before = (await h.mails()).length;
  r = await F.call("POST", "/api/auth/forgot", { email: "ingen@example.se" });
  ok(r.status === 200 && r.json.ok === true && (await h.mails()).length === before, "an address nobody has gets the same answer and no mail");
  r = await F.call("POST", "/api/auth/forgot", { email: "maria@example.se" });
  const mailR = (await h.mails()).filter((m) => m.to === "maria@example.se" && /Nytt lösenord/.test(m.subject)).pop();
  ok(r.status === 200 && mailR && link(mailR, "aterstall"), "a verified address gets a link to choose a new password");
  r = await F.call("POST", "/api/auth/reset", { token: link(mailR, "aterstall"), password: "kort" });
  ok(r.status === 400, "a password that is too short is turned down, and the link still works");
  r = await F.call("POST", "/api/auth/reset", { token: link(mailR, "aterstall"), password: "nytt-hemligt-456" });
  ok(r.status === 200 && r.json.username === "forald1", "the new password is set");
  r = await F.call("POST", "/api/auth/reset", { token: link(mailR, "aterstall"), password: "annat-hemligt-789" });
  ok(r.status === 400, "the link cannot be used again");
  r = await A.call("GET", "/api/me");
  ok(r.json.user === null || r.status === 401, "the sessions from before are ended");
  r = await h.client().call("POST", "/api/login", { username: "forald1", password: "hemligt-123" });
  ok(r.status === 401, "the old password no longer works");
  const A2 = h.client();
  r = await A2.call("POST", "/api/login", { username: "forald1", password: "nytt-hemligt-456" });
  ok(r.status === 200 && r.json.user.access.state === "active", "the new one does");

  // an address that is not verified cannot get a new password (nobody can take over an account with somebody else's address)
  const U = h.client();
  r = await U.call("POST", "/api/register", { role: "caregiver", username: "forald3", displayName: "Tredje Personen", password: "hemligt-123", email: "tredje@example.se", acceptTerms: true });
  const beforeU = (await h.mails()).length;
  await h.client().call("POST", "/api/auth/forgot", { email: "tredje@example.se" });
  ok(r.status === 201 && (await h.mails()).length === beforeU, "an address that is not verified gets no link");
  // the same address asked for too often
  for (let i = 0; i < 3; i++) r = await h.client().call("POST", "/api/auth/forgot", { email: "maria@example.se" });
  ok(r.status === 429, "asking for a link again and again is stopped");

  // the e-mail of an account that exists: add it, and change it with the password
  const T = h.client();
  r = await T.call("POST", "/api/register", { role: "teacher", username: "larare1", displayName: "Fröken Ek", password: "hemligt-123", teacherCode: h.teacherCode });
  ok(r.status === 201 && r.json.user.access.plan === "school" && r.json.user.access.state === "active", "a teacher registers without an address, and a school is not asked to pay");
  r = await T.call("POST", "/api/me/email", { email: "froken@example.se" });
  ok(r.status === 200 && r.json.verified === false, "an adult can add an address later");
  r = await T.call("POST", "/api/me/email", { email: "annan@example.se" });
  ok(r.status === 400, "changing it needs the password");
  r = await T.call("POST", "/api/me/email", { email: "annan@example.se", password: "hemligt-123" });
  ok(r.status === 200, "and works with it");

  // ----- the family: a child, and the access of the family -----
  r = await A2.call("GET", "/api/teacher/classes");
  const family = r.json.classes[0];
  const K = h.client();
  r = await K.call("POST", "/api/register", { role: "student", username: "barnA", displayName: "Lo Svensson", password: "hemligt-123", classCode: family.code });
  ok(r.status === 201 && r.json.user.access.state === "active" && r.json.user.access.plan === "trial", "a child uses the access of the family");
  r = await K.call("PUT", "/api/progress/addition", { data: { started: true, answers: {} } });
  ok(r.status === 200, "and can save its progress during the trial");

  // the trial ends (the person who runs the site can end it by hand)
  r = await A2.call("POST", "/api/admin/access", { username: "forald1", action: "revoke" });
  ok(r.status === 401 || r.status === 503, "nobody can use the admin without the key");
  r = await admin(A2, "/api/admin/access", { username: "forald1", action: "revoke" });
  ok(r.status === 200 && r.json.access.state === "expired", "the admin can end the access of a family");
  r = await K.call("PUT", "/api/progress/addition", { data: { started: true, answers: {} } });
  ok(r.status === 402 && r.json.code === "subscription", "a child of a family without access cannot save (402)");
  r = await K.call("POST", "/api/attempts", { lessonId: "addition", taskId: "exercise", feedbackType: "correct", answer: "1" });
  ok(r.status === 402, "or send an answer");
  r = await K.call("GET", "/api/me");
  ok(r.json.user.access.state === "expired", "and is told that the access has ended");
  r = await A2.call("GET", "/api/me/data");
  ok(r.status === 200, "the adult still reaches the data (download and delete are never locked)");
  r = await A2.call("GET", "/api/billing");
  ok(r.status === 200 && r.json.billing === true && r.json.access.state === "expired" && r.json.plans.length === 2 && r.json.checkout === true && r.json.owner === true, "the page for the subscription knows: " + JSON.stringify(r.json));

  // free access
  r = await admin(A2, "/api/admin/access", { username: "forald1", action: "grant", reason: "vän", days: 5 });
  ok(r.status === 200 && r.json.access.state === "active" && r.json.access.plan === "free" && r.json.access.daysLeft === 5 && r.json.access.reason === "vän", "the admin can give free access for some days");
  r = await K.call("PUT", "/api/progress/addition", { data: { started: true, answers: {} } });
  ok(r.status === 200, "and the child can save again");
  r = await admin(A2, "/api/admin/access", { username: "forald1", action: "grant", reason: "founder" });
  ok(r.json.access.state === "active" && r.json.access.until === null, "or for good");

  // a code
  r = await admin(T, "/api/admin/codes", { reason: "testare", days: 30, uses: 1 });
  const code = r.json.code;
  ok(r.status === 201 && /^[A-Z0-9]{10}$/.test(code), "the admin makes a code");
  const B = h.client();
  r = await B.call("POST", "/api/register", { role: "caregiver", username: "forald4", displayName: "Fjärde Personen", password: "hemligt-123", email: "fjarde@example.se", acceptTerms: true });
  await admin(B, "/api/admin/access", { username: "forald4", action: "revoke" });
  r = await B.call("POST", "/api/billing/redeem", { code: "FEL" });
  ok(r.status === 400, "a wrong code is turned down");
  r = await B.call("POST", "/api/billing/redeem", { code: code.slice(0, 5) + "-" + code.slice(5).toLowerCase() });
  ok(r.status === 200 && r.json.access.state === "active" && r.json.access.plan === "free" && r.json.access.daysLeft === 30, "a code gives access (written with a dash and in lower case too)");
  r = await h.client().call("POST", "/api/login", { username: "forald3", password: "hemligt-123" }).then(async (x) => x);
  const C3 = h.client();
  await C3.call("POST", "/api/login", { username: "forald3", password: "hemligt-123" });
  r = await C3.call("POST", "/api/billing/redeem", { code: code });
  ok(r.status === 400, "a code that has been used up does not work again");

  // ----- Paddle -----
  const P = h.client();
  r = await P.call("POST", "/api/register", { role: "caregiver", username: "forald5", displayName: "Femte Personen", password: "hemligt-123", email: "femte@example.se", acceptTerms: true });
  const userId = r.json.user.id;
  r = await P.call("POST", "/api/billing/checkout", { plan: "finns-inte" });
  ok(r.status === 400, "a plan that does not exist is turned down");
  r = await P.call("POST", "/api/billing/checkout", { plan: "manad" });
  const ask = h.paddle.filter((x) => x.path === "/transactions").pop();
  ok(r.status === 200 && /^https:\/\/pay\.example\//.test(r.json.url) && ask && ask.body.items[0].price_id === "pri_manad" && ask.body.custom_data.user_id === String(userId), "a checkout asks Paddle for a payment page for this family and gives its address");
  r = await h.client().call("POST", "/api/billing/checkout", { plan: "manad" });
  ok(r.status === 401, "only a signed in adult can start one");
  r = await K.call("POST", "/api/billing/checkout", { plan: "manad" });
  ok(r.status === 403, "a child cannot");

  let w = sign(sub("subscription.created", userId, {}, "evt_1"));
  r = await h.raw("POST", "/api/billing/webhook", w.raw, Object.assign({ "Content-Type": "application/json" }, w.headers));
  ok(r.status === 200, "a webhook that is signed is accepted");
  r = await P.call("GET", "/api/billing");
  ok(r.json.access.plan === "paid" && r.json.access.state === "active" && r.json.manage === true, "the family has a subscription now");
  r = await h.raw("POST", "/api/billing/webhook", w.raw, Object.assign({ "Content-Type": "application/json" }, w.headers));
  ok(r.status === 200 && r.json.duplicate === true, "the same event is not handled twice");
  r = await h.raw("POST", "/api/billing/webhook", w.raw, { "Content-Type": "application/json", "Paddle-Signature": "ts=" + Math.floor(Date.now() / 1000) + ";h1=" + "0".repeat(64) });
  ok(r.status === 400, "a signature that is wrong is turned down");
  w = sign(sub("subscription.updated", userId, { scheduled_change: { action: "cancel", effective_at: "2027-01-01T00:00:00Z" } }, "evt_2"));
  await h.raw("POST", "/api/billing/webhook", w.raw, Object.assign({ "Content-Type": "application/json" }, w.headers));
  r = await P.call("GET", "/api/billing");
  ok(r.json.access.cancelAtPeriodEnd === true && r.json.access.state === "active", "a cancel that is scheduled is in until the end of the period");
  r = await P.call("POST", "/api/billing/portal", {});
  const pq = h.paddle.filter((x) => /portal-sessions/.test(x.path)).pop();
  ok(r.status === 200 && /^https:\/\/portal\.example\//.test(r.json.url) && pq && pq.path === "/customers/ctm_" + userId + "/portal-sessions", "the customer portal of Paddle is asked for and its address given");
  w = sign(sub("subscription.canceled", userId, { status: "canceled", canceled_at: new Date(Date.now() - 86400000).toISOString() }, "evt_3"));
  await h.raw("POST", "/api/billing/webhook", w.raw, Object.assign({ "Content-Type": "application/json" }, w.headers));
  r = await P.call("GET", "/api/billing");
  ok(r.json.access.state === "expired", "a subscription that is cancelled and over is out");
  // an account with free access for good keeps it, and only learns the ids
  r = await admin(A2, "/api/admin/access", { username: "forald1", action: "show" });
  const founderId = r.json.entitlement.user_id;
  w = sign(sub("subscription.created", founderId, {}, "evt_4"));
  await h.raw("POST", "/api/billing/webhook", w.raw, Object.assign({ "Content-Type": "application/json" }, w.headers));
  r = await admin(A2, "/api/admin/access", { username: "forald1", action: "show" });
  ok(r.json.entitlement.plan === "free" && r.json.entitlement.paddle_customer_id === "ctm_" + founderId, "an account that is free for good stays free when it also subscribes");
};
