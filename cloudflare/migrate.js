"use strict";
// Shows which migrations the Cloudflare database is missing, and runs them in order.
//
//   npm run db:status                    which migrations the database has had (does not change anything)
//   npm run db:migrate -- --yes          runs the ones it is missing, in order
//   node cloudflare/migrate.js --local   the same for the local test database of "wrangler dev"
//   node cloudflare/migrate.js --db namn the database has another name than in wrangler.toml
//
// It uses wrangler (npx wrangler d1 execute ...), so you have to be signed in to Cloudflare (npx wrangler login). Run it BEFORE the worker is
// deployed: the migrations only add things, so the old worker keeps working on the migrated database.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const lib = require("./migrate-lib");

const args = process.argv.slice(2);
const local = args.includes("--local");
const apply = args.includes("--apply");
const yes = args.includes("--yes");
const dbIndex = args.indexOf("--db");

function databaseName() {
  if (dbIndex >= 0 && args[dbIndex + 1]) return args[dbIndex + 1];
  try {
    const m = /database_name\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(__dirname, "wrangler.toml"), "utf8"));
    if (m) return m[1];
  } catch (e) { /* no wrangler.toml */ }
  return "gaussica";
}

const db = databaseName();
const where = local ? "--local" : "--remote";

function wrangler(extra) {
  const how = lib.wranglerInvocation(["d1", "execute", db, where].concat(extra), process.platform, process.execPath, fs.existsSync);
  const r = spawnSync(how.command, how.args, { cwd: __dirname, encoding: "utf8", shell: how.shell });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "wrangler failed").trim());
  return r.stdout;
}

function query(sql) {
  const out = wrangler(["--json", "--command", sql]);
  // wrangler may print a banner or a warning (which can have a "[" in it) before the JSON: the JSON is the array that starts a line
  const start = out.search(/^\[\s*(?:\{|\])/m);
  if (start < 0) throw new Error("svaret från wrangler gick inte att läsa: " + out.trim().slice(0, 200));
  const parsed = JSON.parse(out.slice(start));
  return (parsed[0] && parsed[0].results) || [];
}

(async () => {
  const forgotten = lib.unlisted();
  if (forgotten.length) console.log("OBS: " + forgotten.join(", ") + " finns i migrations/ men inte i migrate-lib.js, så den kontrolleras inte.\n");
  console.log("Databas: " + db + (local ? " (lokal)" : " (Cloudflare)") + "\n");
  const steps = await lib.plan(query);
  steps.forEach((s) => console.log((s.applied ? "  gjord      " : "  SAKNAS     ") + s.file + "  " + s.about));
  const missing = steps.filter((s) => !s.applied);
  if (!missing.length) { console.log("\nDatabasen är uppdaterad."); return; }
  if (!apply) {
    console.log("\n" + missing.length + " migrering" + (missing.length === 1 ? "" : "ar") + " saknas. Kör dem med:  npm run db:migrate -- --yes");
    process.exitCode = 1;
    return;
  }
  if (!yes) { console.log("\nLägg till --yes för att köra dem:  npm run db:migrate -- --yes"); process.exitCode = 1; return; }
  for (const s of missing) {
    process.stdout.write("\nKör " + s.file + " ... ");
    wrangler(["--file=" + path.join("migrations", s.file)]);
    console.log("klar");
  }
  const after = await lib.plan(query);
  const still = after.filter((s) => !s.applied);
  console.log(still.length ? "\nDet saknas fortfarande: " + still.map((s) => s.file).join(", ") : "\nDatabasen är uppdaterad. Driftsätt API:t nu:  cd cloudflare && npx wrangler deploy");
  if (still.length) process.exitCode = 1;
})().catch((e) => { console.error("\nMisslyckades: " + e.message); process.exit(1); });
