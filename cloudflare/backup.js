"use strict";
// A copy of everything in the database, on your own computer, so that a mistake or a failure at the host does not take the accounts and the progress with it.
//
//   npm run backup                          the Cloudflare database (D1) to backups/gaussica-ÅÅÅÅ-MM-DD.sql (through wrangler: npx wrangler login first)
//   npm run backup -- --keep 12             keep the 12 newest copies and delete older ones (the default is 8)
//   npm run backup -- --node-db data/gaussica.db   the SQLite file of the Node server instead (a safe copy made by SQLite itself, also while the server runs)
//   npm run backup -- --db namn             the database has another name than in wrangler.toml
//
// The copy holds personal data (names, user names, answers): keep it somewhere that only you can reach, never in the repository (backups/ is in .gitignore),
// and delete old copies. How to restore one is in docs/drift.md. Cloudflare keeps D1 for seven days as well (wrangler d1 time-travel), but that is not a copy of your own.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const lib = require("./migrate-lib");

// the name of today's copy, and what to delete
function fileName(now, ext) { return "gaussica-" + new Date(now).toISOString().slice(0, 10) + "." + ext; }
function toDelete(files, keep) {
  return files.filter((f) => /^gaussica-\d{4}-\d{2}-\d{2}\.(sql|db)$/.test(f)).sort().reverse().slice(Math.max(1, keep));
}

// a SQL dump that is a real one: it has the tables, and is not just an error message
function looksRight(text) { return /CREATE TABLE/i.test(text) && /\busers\b/.test(text) && text.length > 500; }

function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const dir = path.join(__dirname, "..", "backups");
  const keep = Number(get("--keep")) || 8;
  fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  const nodeDb = get("--node-db");
  let out;
  if (nodeDb) {
    const { DatabaseSync } = require("node:sqlite");
    out = path.join(dir, fileName(now, "db"));
    if (fs.existsSync(out)) fs.rmSync(out);
    const db = new DatabaseSync(path.resolve(nodeDb), { readOnly: true });
    try { db.exec("VACUUM INTO '" + out.replace(/'/g, "''") + "'"); } finally { db.close(); }
  } else {
    let name = get("--db");
    if (!name) {
      try { const m = /database_name\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, "wrangler.toml"), "utf8")); if (m) name = m[1]; } catch (e) { /* no wrangler.toml */ }
    }
    out = path.join(dir, fileName(now, "sql"));
    const how = lib.wranglerInvocation(["d1", "export", name || "gaussica", "--remote", "--output=" + out], process.platform, process.execPath, fs.existsSync);
    const r = spawnSync(how.command, how.args, { cwd: __dirname, encoding: "utf8", shell: how.shell });
    if (r.status !== 0) { console.error((r.stderr || r.stdout || "wrangler failed").trim()); process.exit(1); }
    if (!fs.existsSync(out) || !looksRight(fs.readFileSync(out, "utf8"))) { console.error("Kopian ser inte rätt ut (" + out + "). Den sparas inte som en säkerhetskopia."); process.exit(1); }
  }
  const size = fs.statSync(out).size;
  console.log("Klart: " + out + " (" + Math.round(size / 1024) + " kB)");
  toDelete(fs.readdirSync(dir), keep).forEach((f) => { fs.rmSync(path.join(dir, f)); console.log("Tog bort den äldsta kopian " + f); });
  console.log("Förvara kopian säkert, den innehåller personuppgifter. Så återställer du den: docs/drift.md");
}

if (require.main === module) main();
module.exports = { fileName, toDelete, looksRight };
