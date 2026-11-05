"use strict";
// For the person who runs the site: give free access, take it away, look at an account, make a code that gives free access.
//
//   node scripts/admin.js grant <username> [--reason founder] [--days 30]   free access for good, or for some days
//   node scripts/admin.js revoke <username>                                  ends it: the account is a trial that has ended
//   node scripts/admin.js show <username>                                    what the account has now
//   node scripts/admin.js code [--reason testare] [--days 30] [--uses 10]    a code that a caregiver can use under Mitt konto
//
// Where the site is and the key: --api https://... and --token ..., or the variables GAUSSICA_API and GAUSSICA_ADMIN_TOKEN. The key is the secret
// ADMIN_TOKEN of the site (at least 16 characters; set it as a secret of the worker, see cloudflare/README.md, or as a variable of the Node server).
// While BILLING_ENABLED is not 1 nobody is charged and every account is in, so none of this changes anything for the users until billing is switched on.

function parseArgs(argv) {
  const out = { command: null, username: null, flags: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (/^--/.test(argv[i])) { out.flags[argv[i].slice(2)] = argv[i + 1] === undefined || /^--/.test(argv[i + 1]) ? true : argv[++i]; }
    else rest.push(argv[i]);
  }
  out.command = rest[0] || null;
  out.username = rest[1] || null;
  return out;
}

// the request for a command: { path, body } or an error text
function request(args) {
  const f = args.flags;
  if (args.command === "grant" || args.command === "revoke" || args.command === "show") {
    if (!args.username) return { error: "Skriv användarnamnet: node scripts/admin.js " + args.command + " <användarnamn>" };
    const body = { username: args.username, action: args.command };
    if (args.command === "grant") {
      if (f.reason && f.reason !== true) body.reason = String(f.reason);
      if (f.days && f.days !== true) body.days = Number(f.days);
    }
    return { path: "/api/admin/access", body: body };
  }
  if (args.command === "code") {
    const body = {};
    if (f.reason && f.reason !== true) body.reason = String(f.reason);
    if (f.days && f.days !== true) body.days = Number(f.days);
    if (f.uses && f.uses !== true) body.uses = Number(f.uses);
    return { path: "/api/admin/codes", body: body };
  }
  return { error: "Kommandon: grant, revoke, show, code. Se överst i scripts/admin.js." };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const api = String(args.flags.api || process.env.GAUSSICA_API || "").replace(/\/+$/, "");
  const token = String(args.flags.token || process.env.GAUSSICA_ADMIN_TOKEN || "");
  const req = request(args);
  if (req.error) { console.error(req.error); process.exit(2); }
  if (!api || !token) { console.error("Ange var sidan finns och nyckeln: --api https://... --token ... (eller GAUSSICA_API och GAUSSICA_ADMIN_TOKEN)."); process.exit(2); }
  const res = await fetch(api + req.path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(req.body) });
  let json = null; try { json = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) { console.error("Fel " + res.status + ": " + ((json && json.error) || "okänt")); process.exit(1); }
  console.log(JSON.stringify(json, null, 2));
}

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
module.exports = { parseArgs, request };
