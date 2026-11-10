"use strict";
// Which of the migrations a database has had. The migrations in migrations/ were run by hand, so nothing says which ones a database has had: each
// one is recognised by what it adds (a column or a table). The same check runs against the real database (migrate.js, through wrangler) and, in the
// tests, against SQLite files made the old way.

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "migrations");

const hasTable = (name) => ({ sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '" + name + "'", test: (rows) => rows.length > 0 });
const hasColumn = (table, column) => ({ sql: "SELECT name FROM pragma_table_info('" + table + "') WHERE name = '" + column + "'", test: (rows) => rows.length > 0 });

// In the order they are run. `adds` is what shows that it has been run.
const MIGRATIONS = [
  { file: "002-assignment-kind.sql", about: "uppdrag av olika slag (kind)", adds: hasColumn("assignments", "kind") },
  { file: "003-chat.sql", about: "chatt mellan elev och lärare", adds: hasTable("chat") },
  { file: "004-site-feedback.sql", about: "feedback om sidan", adds: hasTable("site_feedback") },
  { file: "005-prov.sql", about: "prov (config på uppdrag)", adds: hasColumn("assignments", "config") },
  { file: "006-caregiver.sql", about: "konton för vårdnadshavare", adds: hasColumn("users", "caregiver") },
  { file: "007-multi.sql", about: "flera vuxna per klass och flera klasser per elev", adds: hasTable("class_members") },
  { file: "008-account-billing.sql", about: "e-post för vuxna och vem som får använda sidan (gratis, prov, betald)", adds: hasTable("entitlements") },
  { file: "009-digest.sql", about: "veckosammanfattning på mejl till vårdnadshavare", adds: hasTable("digests") }
];

// `query(sql)` gives the rows (an array of objects) of a SELECT, as a promise or directly.
async function plan(query) {
  const out = [];
  for (const m of MIGRATIONS) {
    const rows = await query(m.adds.sql);
    out.push({ file: m.file, about: m.about, applied: m.adds.test(rows || []) });
  }
  return out;
}

function sqlOf(file) { return fs.readFileSync(path.join(DIR, file), "utf8"); }

// Every migration file in the folder has to be in the list above, or a new one would be forgotten.
function unlisted() {
  const known = new Set(MIGRATIONS.map((m) => m.file));
  return fs.readdirSync(DIR).filter((f) => /\.sql$/.test(f) && !known.has(f));
}

// How to run `npx wrangler <args>` so that every argument arrives as one argument (the SQL has spaces and quotes in it). A shell would split it, so none
// is used: node runs npx's own script directly. Only if that script is not found is a shell used, and then every argument is quoted.
function wranglerInvocation(args, platform, nodeExecPath, exists) {
  const dir = path.dirname(nodeExecPath);
  const candidates = [path.join(dir, "node_modules", "npm", "bin", "npx-cli.js"), path.join(dir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js")];
  const script = candidates.find(exists);
  if (script) return { command: nodeExecPath, args: [script, "wrangler"].concat(args), shell: false };
  if (platform === "win32") return { command: "npx", args: ["wrangler"].concat(args).map((a) => (/[\s"&|<>^%()]/.test(a) ? '"' + String(a).replace(/"/g, '""') + '"' : a)), shell: true };
  return { command: "npx", args: ["wrangler"].concat(args), shell: false };
}

module.exports = { MIGRATIONS, plan, sqlOf, unlisted, wranglerInvocation, DIR };
