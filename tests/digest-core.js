"use strict";
// The weekly summary by e-mail (server/digest-core.js): what it says, and that the copy in the worker is the same code. And that wrangler.toml is valid and
// leaves e-mail, billing and the summary off until they are switched on.
const fs = require("fs");
const path = require("path");
const { digestWeek, digestMail } = require("../server/digest-core.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const DAY = 86400000;
const NOW = Date.parse("2026-12-06T16:00:00Z");
const at = (days) => new Date(NOW - days * DAY).toISOString();

const w = digestWeek([
  { at: at(1), completed: true, seconds: 40, lessonTitle: "Addition" }, { at: at(1), completed: false, seconds: 20, lessonTitle: "Addition" },
  { at: at(3), completed: true, seconds: 9999, lessonTitle: "Division" }, { at: at(9), completed: true, seconds: 60, lessonTitle: "Gammalt" }
], NOW);
ok(w.answers === 3 && w.right === 2 && w.days === 2 && w.lessons.join() === "Addition,Division", "a week counts the answers of the last seven days, the right ones, the days and the lessons");
ok(w.minutes === 6, "and the time, with at most five minutes for one answer: " + w.minutes);
ok(digestWeek([], NOW).answers === 0 && digestWeek(null, NOW).days === 0, "no answers, nothing counted");

const mail = digestMail({ guardian: "Vera Veckosson", siteUrl: "https://gaussica.se", now: NOW, children: [
  { name: "Siri Sjöberg", attempts: [{ at: at(1), completed: true, seconds: 120, lessonTitle: "Addition" }] }, { name: "Ola Olsson", attempts: [] }] });
ok(mail.subject === "Veckan på Gaussica" && /^Hej Vera!/.test(mail.text), "the mail has a subject and greets the caregiver by first name");
ok(/Siri: övade en dag, ungefär 2 minuter\. 1 av 1 svar var rätt\. Jobbade med: Addition\./.test(mail.text) && /Ola: inget har gjorts de senaste sju dagarna\./.test(mail.text), "each child has a line, also the one that did nothing");
ok(/stänger av den under Mitt konto/.test(mail.text) && !/—/.test(mail.text), "it says how to turn it off, and has no long dash");

// the copy in the worker
const core = fs.readFileSync(path.join(__dirname, "..", "server", "digest-core.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "..", "cloudflare", "worker.js"), "utf8");
const cut = (text) => { const a = text.indexOf("// BEGIN digest-core"), b = text.indexOf("// END digest-core"); return a >= 0 && b > a ? text.slice(a, b).replace(/\r\n/g, "\n") : null; };
ok(cut(core) !== null && cut(worker) !== null && cut(core) === cut(worker), "cloudflare/worker.js has the same summary code as server/digest-core.js (copy the block between BEGIN and END)");

// wrangler.toml: valid, and nothing that costs or asks for anything is on until it is switched on
const toml = fs.readFileSync(path.join(__dirname, "..", "cloudflare", "wrangler.toml"), "utf8").split(/\r?\n/);
const bad = toml.map((l, i) => [l, i + 1]).filter(([l]) => l.trim() && !/^\s*#/.test(l) && !/^\[\[?[\w.]+\]\]?$/.test(l.trim()) && !/^[A-Za-z_]\w*\s*=\s*(".*"|'.*'|\[.*\]|\d+|true|false)\s*(#.*)?$/.test(l.trim()));
ok(bad.length === 0, "wrangler.toml has only comments, tables and key = value" + (bad.length ? ": line " + bad[0][1] + " " + bad[0][0] : ""));
const keys = toml.filter((l) => /^[A-Za-z_]\w*\s*=/.test(l)).map((l) => l.split("=")[0].trim());
ok(!["BILLING_ENABLED", "CAREGIVER_EMAIL_REQUIRED", "DIGEST_ENABLED", "MAIL_FROM", "PADDLE_API_KEY"].some((k) => keys.includes(k)), "e-mail, billing and the summary are off in wrangler.toml until the line is switched on");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All checks on the weekly summary passed");
