"use strict";
// The check of which migrations a database has had (cloudflare/migrate-lib.js), against SQLite files made the old way, and the health answer of the worker.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const lib = require("../cloudflare/migrate-lib");

const ROOT = path.join(__dirname, "..");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

const open = (sql) => { const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON;"); db.exec(sql); return db; };
const query = (db) => (sql) => db.prepare(sql).all();
const state = async (db) => (await lib.plan(query(db))).map((s) => (s.applied ? "+" : "-")).join("");

(async () => {
  ok(lib.unlisted().length === 0, "every file in cloudflare/migrations/ is in the list (" + lib.unlisted().join(", ") + ")");
  ok(lib.MIGRATIONS.length === fs.readdirSync(lib.DIR).filter((f) => /\.sql$/.test(f)).length, "and the list has no file that is not there");

  // a new database, made from schema.sql, has had all of them
  const fresh = open(fs.readFileSync(path.join(ROOT, "cloudflare", "schema.sql"), "utf8"));
  ok((await state(fresh)) === "++++++++", "a new database (schema.sql) has had all of them");

  // a database from before the tables for several adults and classes
  const before = open(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "schema-before-multi.sql"), "utf8"));
  ok((await state(before)) === "+++++---", "a database from before 007 is missing 007, 008 and 009");
  before.exec(lib.sqlOf("007-multi.sql"));
  before.exec(lib.sqlOf("008-account-billing.sql"));
  before.exec(lib.sqlOf("009-digest.sql"));
  ok((await state(before)) === "++++++++", "and has had all of them when 007, 008 and 009 have been run");

  // the oldest: nothing of the later ones. They are run in order, one at a time, and the check follows each.
  const oldest = open(
    "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, role TEXT, password_hash TEXT, class_id INTEGER, created_at TEXT);" +
    "CREATE TABLE classes (id INTEGER PRIMARY KEY, name TEXT, code TEXT, teacher_id INTEGER, created_at TEXT);" +
    "CREATE TABLE assignments (id INTEGER PRIMARY KEY, class_id INTEGER, student_id INTEGER, teacher_id INTEGER, lesson_id TEXT, note TEXT, due_date TEXT, created_at TEXT, archived INTEGER DEFAULT 0);" +
    "CREATE TABLE feedback (id INTEGER PRIMARY KEY, student_id INTEGER, teacher_id INTEGER, text TEXT, created_at TEXT);");
  ok((await state(oldest)) === "--------", "the oldest database is missing all of them");
  const seen = [];
  for (const step of (await lib.plan(query(oldest))).filter((s) => !s.applied)) {
    oldest.exec(lib.sqlOf(step.file));
    seen.push(await state(oldest));
  }
  ok(seen.join(" ") === "+------- ++------ +++----- ++++---- +++++--- ++++++-- +++++++- ++++++++", "each migration is recognised once it has been run, in order (" + seen.join(" ") + ")");

  // wrangler is started so that the SQL arrives as one argument (a shell would cut it at the spaces)
  const sqlArg = "SELECT name FROM pragma_table_info('assignments') WHERE name = 'kind'";
  const direct = lib.wranglerInvocation(["d1", "execute", "gaussica", "--remote", "--command", sqlArg], "win32", "C:/node/node.exe", (p) => p.endsWith("npx-cli.js") && p.includes("node_modules"));
  ok(direct.shell === false && direct.command === "C:/node/node.exe" && direct.args.includes(sqlArg), "wrangler is run by node itself, without a shell, and the SQL is one argument");
  const quoted = lib.wranglerInvocation(["d1", "execute", "gaussica", "--command", sqlArg], "win32", "C:/node/node.exe", () => false);
  ok(quoted.shell === true && quoted.args.includes('"' + sqlArg + '"') && quoted.args.includes("gaussica"), "without npx's script, the shell gets every argument in quotes");
  const unix = lib.wranglerInvocation(["d1", "--command", sqlArg], "linux", "/usr/bin/node", () => false);
  ok(unix.shell === false && unix.command === "npx" && unix.args.includes(sqlArg), "elsewhere npx is started without a shell");
  const real = lib.wranglerInvocation(["x"], process.platform, process.execPath, fs.existsSync);
  ok(real.args[real.args.length - 1] === "x", "on this computer it finds how to start wrangler (" + (real.shell ? "through a shell" : "node runs npx-cli.js") + ")");

  // the answer of the worker on /health says if the database has the tables
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-health-"));
  const file = path.join(dir, "worker.mjs");
  fs.copyFileSync(path.join(ROOT, "cloudflare", "worker.js"), file);
  const worker = (await import("file://" + file.replace(/\\/g, "/"))).default;
  const d1 = (db) => ({ prepare(sql) { const st = db.prepare(sql); let a = []; const o = { bind(...x) { a = x; return o; }, async first() { return st.get(...a) || null; }, async all() { return { results: st.all(...a) }; }, async run() { st.run(...a); return { meta: {} }; } }; return o; } });
  const health = async (db) => { const res = await worker.fetch(new Request("https://api.example/health"), { DB: d1(db), ALLOWED_ORIGINS: "https://test.example" }); return res.json(); };
  let h = await health(fresh);
  ok(h.ok === true && h.schema === "ok", "/health: a database with the tables is ok");
  const missing = open(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "schema-before-multi.sql"), "utf8"));
  h = await health(missing);
  ok(h.ok === true && /007-multi/.test(h.schema), "/health: a database without them says which migration it needs (" + h.schema + ")");

  console.log(failures ? "\n" + failures + " FAILED" : "\nAll migration checks passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
