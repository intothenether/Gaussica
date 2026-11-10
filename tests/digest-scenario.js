"use strict";
// The weekly summary by e-mail: one scenario, run against the Node server (tests/api-account.js) and the Cloudflare worker (tests/worker-account.js), after the
// scenario of the accounts. The sites are set up with DIGEST_ENABLED=1, MAIL_DEV and an ADMIN_TOKEN (same h as in tests/account-scenario.js).
module.exports = async function digestScenario(h, ok) {
  const link = (mail, kind) => { const m = new RegExp("#" + kind + "/([A-Za-z0-9_-]+)").exec(mail.text); return m ? m[1] : null; };
  const mailsTo = async (to) => (await h.mails()).filter((m) => m.to === to);
  const admin = (c, p, body) => c.call("POST", p, body, { Authorization: "Bearer " + h.adminToken });

  const A = h.client();
  let r = await A.call("POST", "/api/register", { role: "caregiver", username: "vecka1", displayName: "Vera Veckosson", password: "hemligt-123", email: "vecka@example.se", acceptTerms: true });
  ok(r.status === 201 && r.json.user.digest && r.json.user.digest.available === true && r.json.user.digest.enabled === false, "a caregiver is told that the summary is there and off: " + JSON.stringify(r.json.user && r.json.user.digest));
  r = await A.call("POST", "/api/me/digest", { enabled: true });
  ok(r.status === 400 && /bekräfta/i.test(r.json.error), "it cannot be switched on before the address is verified");
  const verify = link((await mailsTo("vecka@example.se")).pop(), "verifiera");
  await A.call("POST", "/api/auth/verify-email", { token: verify });
  r = await A.call("POST", "/api/me/digest", { enabled: true });
  ok(r.status === 200 && r.json.enabled === true, "and can be when it is");

  // a child of the family, with some answers
  r = await A.call("GET", "/api/teacher/classes");
  const family = r.json.classes[0];
  const K = h.client();
  r = await K.call("POST", "/api/register", { role: "student", username: "veckabarn", displayName: "Siri Sjöberg", password: "hemligt-123", classCode: family.code });
  ok(r.status === 201, "a child joins the family");
  for (const [done, type] of [[true, "correct"], [true, "correct"], [false, "hint"]]) {
    await K.call("POST", "/api/attempts", { lessonId: "addition", lessonTitle: "Addition: lägg ihop tal", taskId: "exercise", feedbackType: type, answer: "1", seconds: 40 });
  }
  r = await A.call("GET", "/api/me");
  ok(r.json.user.digest.enabled === true, "the setting is kept");

  // nobody can send them but the person who runs the site
  r = await A.call("POST", "/api/admin/digest", {});
  ok(r.status === 401 || r.status === 503, "an adult cannot send the summaries");
  const before = (await mailsTo("vecka@example.se")).length;
  r = await admin(A, "/api/admin/digest", {});
  ok(r.status === 200 && r.json.sent === 1, "the person who runs the site sends them: " + JSON.stringify(r.json));
  const mail = (await mailsTo("vecka@example.se")).pop();
  ok((await mailsTo("vecka@example.se")).length === before + 1 && mail.subject === "Veckan på Gaussica", "one mail goes to the caregiver");
  ok(/Hej Vera!/.test(mail.text) && /Siri: övade en dag, ungefär 2 minuter\. 2 av 3 svar var rätt\. Jobbade med: Addition: lägg ihop tal\./.test(mail.text), "it tells how the child did, in plain words: " + mail.text.split("\n").filter((x) => /Siri/.test(x)).join(" "));
  ok(/stänger av den under Mitt konto/.test(mail.text) && /https:\/\/test\.example/.test(mail.text), "and says how to turn it off, with the address of the site");
  r = await admin(A, "/api/admin/digest", {});
  ok(r.status === 200 && r.json.sent === 0, "it is not sent twice within a week");
  r = await admin(A, "/api/admin/digest", { force: true });
  ok(r.json.sent === 1, "unless it is asked for by force");

  // turned off
  r = await A.call("POST", "/api/me/digest", { enabled: false });
  ok(r.status === 200 && r.json.enabled === false, "it can be turned off");
  r = await admin(A, "/api/admin/digest", { force: true });
  ok(r.json.sent === 0, "and then nothing is sent");
  r = await K.call("POST", "/api/me/digest", { enabled: true });
  ok(r.status === 403, "a child cannot ask for one");
};
