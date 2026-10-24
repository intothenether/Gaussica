"use strict";
// Feedback about the site: POST /api/feedback. The test server has no e-mail keys, so nothing is e-mailed.
// usage: node tests/api-feedback.js <base> cookie <teacherCode>
const BASE = process.argv[2];
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

async function post(body, cookie) {
  const headers = { "Content-Type": "application/json", Origin: BASE };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + "/api/feedback", { method: "POST", headers, body: JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
  return { status: res.status, json };
}

(async () => {
  let r = await post({ kind: "fel", text: "  " });
  ok(r.status === 400, "an empty message is rejected");
  r = await post({ kind: "fel", text: "Knappen fungerar inte", email: "inte-en-adress" });
  ok(r.status === 400, "a bad e-mail address is rejected");
  r = await post({ kind: "fel", text: "Texten är fel", website: "http://spam.example" });
  ok(r.status === 201 && r.json.emailed === false, "the hidden field makes a robot look successful, without saving");
  r = await post({ kind: "forslag", text: "Fler uppgifter om bråk, tack!", email: "elev@example.com", page: "#play/brak-del", context: { prompt: "Vad är 1/2 + 1/4?", answer: "2/6", evil: "x" } });
  ok(r.status === 201 && r.json.ok === true && r.json.emailed === false, "feedback is accepted (and not e-mailed without keys)");
  r = await post({ kind: "okänd", text: "Vilken typ är det här?" });
  ok(r.status === 201, "an unknown type becomes 'annat'");
  for (let i = 0; i < 3; i++) await post({ kind: "annat", text: "Fler meddelanden " + i });
  r = await post({ kind: "annat", text: "Ett meddelande för mycket" });
  ok(r.status === 429, "too many messages from one address are refused");
  console.log(failures ? failures + " FAILED" : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})();
