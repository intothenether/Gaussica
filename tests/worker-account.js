"use strict";
// E-mail for adults, access and Paddle (tests/account-scenario.js) against the Cloudflare worker. The database (D1) is stood in for by node:sqlite with
// cloudflare/schema.sql, and Paddle by a small server of the test.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const scenario = require("./account-scenario");
const digestScenario = require("./digest-scenario");

const ROOT = path.join(__dirname, "..");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

function d1(db) {
  return {
    prepare(sql) {
      const st = db.prepare(sql);
      let args = [];
      const o = {
        bind(...a) { args = a; return o; },
        async first() { return st.get(...args) || null; },
        async all() { return { results: st.all(...args) }; },
        async run() { const r = st.run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; }
      };
      return o;
    },
    async batch(stmts) {
      db.exec("BEGIN");
      try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  };
}

(async () => {
  const paddleLog = [];
  const fake = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let json = null; try { json = JSON.parse(body || "{}"); } catch (e) { /* none */ }
      paddleLog.push({ method: req.method, path: req.url, body: json, auth: req.headers.authorization });
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url === "/transactions") res.end(JSON.stringify({ data: { id: "txn_1", checkout: { url: "https://pay.example/checkout/txn_1" } } }));
      else if (/portal-sessions$/.test(req.url)) res.end(JSON.stringify({ data: { urls: { general: { overview: "https://portal.example/overview" } } } }));
      else res.end("{}");
    });
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-worker-account-"));
  const file = path.join(dir, "worker.mjs");
  fs.copyFileSync(path.join(ROOT, "cloudflare", "worker.js"), file);
  const worker = (await import("file://" + file.replace(/\\/g, "/"))).default;
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(path.join(ROOT, "cloudflare", "schema.sql"), "utf8"));
  const mails = [];
  const secret = "pdl_ntfset_test_secret";
  const adminToken = "admin-token-for-the-test-1234";
  const teacherCode = "TESTCODE12";
  const env = {
    DB: d1(db), TEACHER_CODE: teacherCode, ALLOWED_ORIGINS: "https://test.example", MAIL_DEV: "1", DIGEST_ENABLED: "1", MAIL_OUTBOX: mails, CAREGIVER_EMAIL_REQUIRED: "1", BILLING_ENABLED: "1", TRIAL_DAYS: "14",
    SITE_URL: "https://test.example", ADMIN_TOKEN: adminToken, PADDLE_API_KEY: "pdl_test_key", PADDLE_WEBHOOK_SECRET: secret, PADDLE_API_BASE: "http://127.0.0.1:" + fake.address().port,
    PADDLE_PRICES: JSON.stringify({ manad: { priceId: "pri_manad", label: "Månad", text: "49 kr per månad" }, ar: { priceId: "pri_ar", label: "År", text: "490 kr per år" } })
  };
  const client = () => {
    const me = { token: null };
    return {
      async call(method, p, body, headers) {
        const h = Object.assign({ "Content-Type": "application/json", Origin: "https://test.example" }, headers || {});
        if (me.token && !h.Authorization) h.Authorization = "Bearer " + me.token;
        const res = await worker.fetch(new Request("https://api.example" + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env);
        let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
        if (json && json.token) me.token = json.token;
        return { status: res.status, json };
      }
    };
  };
  const h = {
    client,
    async raw(method, p, text, headers) {
      const res = await worker.fetch(new Request("https://api.example" + p, { method, headers: headers || {}, body: text }), env);
      let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
      return { status: res.status, json };
    },
    async mails() { return mails; },
    paddle: paddleLog, secret, adminToken, teacherCode
  };
  try {
    await scenario(h, ok);
    await digestScenario(h, ok);
  } finally {
    fake.close();
  }
  if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
  console.log("All account checks passed (worker)");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
