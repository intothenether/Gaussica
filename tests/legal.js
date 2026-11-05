"use strict";
// The pages of the terms (villkor.html, integritet.html, angerratt.html): made from docs/juridik by scripts/build-legal.js, up to date, not published with a
// placeholder in them unless they say they are a draft, and linked, served and deployed.
const fs = require("fs");
const path = require("path");
const { build, markdown } = require("../scripts/build-legal.js");

const ROOT = path.join(__dirname, "..");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

const made = build();
Object.keys(made.pages).forEach((file) => {
  const onDisk = fs.existsSync(path.join(ROOT, file)) ? read(file) : null;
  ok(onDisk === made.pages[file].replace(/\r\n/g, "\n"), file + " is made from docs/juridik (run: node scripts/build-legal.js)");
  const text = made.pages[file];
  ok(!/\{\{|\}\}/.test(text), file + " has no {{detail}} left");
  ok(!/<script|https?:\/\/(?!gaussica\.se)[^"' <]*\.(js|css)/i.test(text), file + " has no script and loads nothing from elsewhere");
  ok(!/—/.test(text), file + " has no long dash");
  if (made.info.utkast) ok(/class="draft"/.test(text), file + " says that it is a draft");
  else ok(!/\[[^\]\n]*\]/.test(text.replace(/<[^>]*>/g, "")), file + " is not a draft, so it has no [placeholder] left");
});

const v = made.pages["villkor.html"], p = made.pages["integritet.html"], a = made.pages["angerratt.html"];
ok(/14 dagars ångerrätt/.test(v) && /14 dagars ångerrätt/.test(a), "the withdrawal right of 14 days is in the terms and has its page");
ok(/Provperiod/.test(v) && /sägs upp|säga upp/i.test(v) && /förnyas automatiskt/.test(v), "the trial, the cancellation and the automatic renewal are told");
ok(/Paddle/.test(v) && /Paddle/.test(p) && /Cloudflare/.test(p) && /Resend/.test(p), "the companies that handle the payment, the data and the mail are named");
ok(/under 13/.test(v) && /under 13/.test(p), "the consent of a guardian for children under 13 is in both");
ok(/Integritetsskyddsmyndigheten/.test(p) && /radera/i.test(p) && /personuppgiftsansvarig/.test(p), "the controller, the right to erasure and the authority are in the privacy policy");
ok(/\.\/integritet\.html|href="integritet\.html"/.test(v) && /href="angerratt\.html"/.test(v), "the terms link to the privacy policy and the page about withdrawal");

// the same version as the server writes down when an adult accepts the terms
const account = read("server/account.js"), worker = read("cloudflare/worker.js");
ok(new RegExp('TERMS_VERSION \\|\\| "' + made.info.version + '"').test(account) && new RegExp('TERMS_VERSION \\|\\| "' + made.info.version + '"').test(worker), "the servers write down the version " + made.info.version + " when the terms are accepted");

// the sign-up links to them, the Node server serves them and Pages publishes them
ok(/villkor\.html/.test(read("auth-view.js")) && /integritet\.html/.test(read("auth-view.js")), "the sign-up links to the terms and the privacy policy");
ok(/villkor\.html/.test(read("server.js")) && /angerratt\.html/.test(read("server.js")), "the Node server hands the pages out");
ok(/cp [^\n]*\*\.html/.test(read(".github/workflows/deploy-pages.yml")), "the Pages workflow copies every .html file");
ok(markdown("# A\n\ntext **fet** och [länk](x.html)\n\n- ett\n- två").includes("<li>två</li>") && markdown("1. a\n2. b").includes("<ol>"), "the small Markdown converter makes headings, lists, bold and links");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All checks on the legal pages passed");
