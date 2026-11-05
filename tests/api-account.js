"use strict";
// E-mail for adults, access and Paddle (tests/account-scenario.js) against the Node server. This test starts its own server (with the settings that
// switch these features on) and a small server that stands in for Paddle.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const scenario = require("./account-scenario");

const ROOT = path.join(__dirname, "..");
const NODE_FLAGS = ["--disable-warning=ExperimentalWarning"];
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

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
  const paddlePort = await listen(fake);

  const probe = http.createServer(); const port = await listen(probe); await new Promise((r) => probe.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-account-"));
  const secret = "pdl_ntfset_test_secret";
  const adminToken = "admin-token-for-the-test-1234";
  const teacherCode = "TESTCODE12";
  const server = spawn(process.execPath, NODE_FLAGS.concat([path.join(ROOT, "server.js")]), {
    cwd: ROOT, stdio: "ignore",
    env: Object.assign({}, process.env, {
      PORT: String(port), DATA_DIR: dir, TEACHER_CODE: teacherCode, HOST: "127.0.0.1",
      MAIL_DEV: "1", CAREGIVER_EMAIL_REQUIRED: "1", BILLING_ENABLED: "1", TRIAL_DAYS: "14", SITE_URL: "https://test.example", ADMIN_TOKEN: adminToken,
      PADDLE_API_KEY: "pdl_test_key", PADDLE_WEBHOOK_SECRET: secret, PADDLE_API_BASE: "http://127.0.0.1:" + paddlePort,
      PADDLE_PRICES: JSON.stringify({ manad: { priceId: "pri_manad", label: "Månad", text: "49 kr per månad" }, ar: { priceId: "pri_ar", label: "År", text: "490 kr per år" } })
    })
  });
  const BASE = "http://127.0.0.1:" + port;
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + "/api/me")).status) break; } catch (e) { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }
    const client = () => {
      const jar = { cookie: null };
      return {
        async call(method, p, body, headers) {
          const h = Object.assign({ "Content-Type": "application/json", Origin: BASE }, headers || {});
          if (jar.cookie) h.Cookie = jar.cookie;
          const res = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
          const sc = res.headers.get("set-cookie");
          if (sc && /^gs=[^;]+/.test(sc)) jar.cookie = sc.split(";")[0];
          let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
          return { status: res.status, json };
        }
      };
    };
    const h = {
      client,
      async raw(method, p, text, headers) {
        const res = await fetch(BASE + p, { method, headers: headers || {}, body: text });
        let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
        return { status: res.status, json };
      },
      async mails() { return (await (await fetch(BASE + "/api/dev/outbox")).json()).mails; },
      paddle: paddleLog, secret, adminToken, teacherCode
    };
    await scenario(h, ok);
  } finally {
    server.kill();
    fake.close();
    setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* still in use */ } }, 1500);
  }
  if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
  console.log("All account checks passed (Node server)");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
