"use strict";
// The copy of the database (cloudflare/backup.js): the names, which old copies go, what counts as a real dump, and a safe copy of an SQLite file made by SQLite
// itself (the way --node-db makes it), here with a temporary database and never the real one.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { DatabaseSync } = require("node:sqlite");
const { fileName, toDelete, looksRight } = require("../cloudflare/backup.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

ok(fileName(Date.parse("2026-12-06T23:59:00Z"), "sql") === "gaussica-2026-12-06.sql" && fileName(Date.parse("2026-12-07T00:01:00Z"), "db") === "gaussica-2026-12-07.db", "a copy is named after the day");
const files = ["gaussica-2026-11-01.sql", "gaussica-2026-11-08.sql", "gaussica-2026-11-15.sql", "gaussica-2026-11-22.db", "notes.txt", "gaussica-oops.sql"];
ok(toDelete(files, 2).join() === "gaussica-2026-11-08.sql,gaussica-2026-11-01.sql", "the oldest copies go, the newest are kept, and other files are left alone: " + toDelete(files, 2).join());
ok(toDelete(files, 0).length === 3, "at least one copy is always kept");
ok(!looksRight("Error: not logged in") && looksRight("PRAGMA foreign_keys=OFF;\nCREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);\n" + "INSERT INTO users VALUES (1, 'a');\n".repeat(30)), "a dump that is an error message is not taken for a copy");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-backup-"));
try {
  const source = path.join(dir, "source.db");
  const db = new DatabaseSync(source);
  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT); INSERT INTO users (username) VALUES ('maria'), ('lo');");
  db.close();
  // the script is run as the owner runs it, with the file of the Node server (a temporary one)
  const root = path.join(__dirname, "..");
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(root, "cloudflare", "backup.js"), "--node-db", source, "--keep", "3"], { cwd: root, encoding: "utf8" });
  const made = path.join(root, "backups", fileName(Date.now(), "db"));
  ok(r.status === 0 && fs.existsSync(made), "the script makes a copy of an SQLite file: " + (r.stderr || r.stdout).trim().split("\n")[0]);
  const copy = new DatabaseSync(made, { readOnly: true });
  const rows = copy.prepare("SELECT username FROM users ORDER BY id").all().map((x) => x.username);
  copy.close();
  ok(rows.join() === "maria,lo", "and the copy has what the database had");
  fs.rmSync(made, { force: true });
  try { fs.rmdirSync(path.join(root, "backups")); } catch (e) { /* has other copies of the owner: left */ }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

const ignore = fs.readFileSync(path.join(__dirname, "..", ".gitignore"), "utf8");
ok(/^backups\/$/m.test(ignore), "the copies are never in the repository (backups/ is in .gitignore)");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All checks on the copy of the database passed");
