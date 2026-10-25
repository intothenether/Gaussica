"use strict";
// Runs all checks: syntax of every script, lessons, practice questions, answer rules and the server API.
//
//   npm test                 everything
//   node tests/run.js lessons   only the checks whose name contains "lessons"
//
// The API checks start the Node server on a free port with a temporary database, so they never touch data/.
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const NODE_FLAGS = ["--disable-warning=ExperimentalWarning"];
const filter = process.argv[2] || "";
const results = [];

function record(name, ok, output) {
  results.push({ name, ok });
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok && output) console.log(output.split("\n").map((l) => "     " + l).join("\n"));
}

function run(name, script, args, env) {
  if (filter && name.indexOf(filter) < 0) return;
  const r = spawnSync(process.execPath, NODE_FLAGS.concat([path.join(ROOT, script)], args || []), {
    cwd: ROOT, encoding: "utf8", env: Object.assign({}, process.env, env || {}), timeout: 300000
  });
  record(name, r.status === 0, (r.stdout || "") + (r.stderr || ""));
}

// ---- syntax of every script that ships ----
function jsFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === "node_modules" || e.name === "data" || e.name.startsWith(".") || e.name === "archive") return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  });
  return out;
}

function syntax() {
  if (filter && "syntax".indexOf(filter) < 0) return;
  const failed = [];
  jsFiles(ROOT, []).forEach((f) => {
    const source = fs.readFileSync(f, "utf8");
    if (/^export\s/m.test(source)) {   // the Cloudflare worker is an ES module: check it as one
      try { new (require("vm").Script)(source.replace(/^export\s+default\s+/m, "module.exports = ").replace(/^export\s+/gm, "")); } catch (e) { failed.push(path.relative(ROOT, f) + "\n" + e.message); }
      return;
    }
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    if (r.status !== 0) failed.push(path.relative(ROOT, f) + "\n" + r.stderr);
  });
  record("syntax", failed.length === 0, failed.join("\n"));
}

// ---- the server API, on a free port ----
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => { const port = srv.address().port; srv.close(() => resolve(port)); });
    srv.on("error", reject);
  });
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(url); if (r.status) return true; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function withServer(fn) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-test-"));
  const code = "TESTCODE12";
  const server = spawn(process.execPath, NODE_FLAGS.concat([path.join(ROOT, "server.js")]), {
    cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: dir, TEACHER_CODE: code, HOST: "127.0.0.1" }), stdio: "ignore"
  });
  try {
    const base = "http://127.0.0.1:" + port;
    if (!(await waitFor(base + "/api/me"))) throw new Error("the test server did not start");
    return await fn(base, code);
  } finally {
    server.kill();
    setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* still in use */ } }, 1500);
  }
}

async function api() {
  if (filter && "api".indexOf(filter) < 0) return;
  for (const [name, script, mode] of [["api basics", "tests/api-basic.js"], ["api assignments", "tests/api-assign.js", "cookie"], ["api chat", "tests/api-chat.js", "cookie"], ["api feedback", "tests/api-feedback.js", "cookie"]]) {
    try {
      await withServer(async (base, code) => {
        const args = mode ? [base, mode, code] : [];
        const r = spawnSync(process.execPath, NODE_FLAGS.concat([path.join(ROOT, script)], args), {
          cwd: ROOT, encoding: "utf8", env: Object.assign({}, process.env, { TEST_BASE: base, TEST_TEACHER_CODE: code }), timeout: 120000
        });
        record(name, r.status === 0, (r.stdout || "") + (r.stderr || ""));
      });
    } catch (e) {
      record(name, false, String(e.message || e));
    }
  }
}

(async () => {
  syntax();
  run("lessons", "tests/lessons.js");
  run("practice questions", "tests/practice.js");
  run("answer rules", "tests/answers.js");
  run("practice editor", "tests/practice-editor.js");
  run("explanation pages", "tests/explanation-pages.js");
  await api();
  const failed = results.filter((r) => !r.ok);
  console.log("\n" + (failed.length ? failed.length + " of " + results.length + " checks FAILED" : "All " + results.length + " checks passed"));
  process.exit(failed.length ? 1 : 0);
})();
