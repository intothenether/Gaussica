"use strict";
// The documents for schools (docs/skola): every link works, the agreement has its required parts, and the house rules
// for text hold (no em dash, no multiplication sign).
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "docs", "skola");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
["README.md", "personuppgiftsbitradesavtal.md", "konsekvensbedomning.md", "dataplats-och-underbitraden.md", "radering-och-gallring.md"].forEach((f) => ok(files.includes(f), f + " exists"));

files.forEach((f) => {
  const text = fs.readFileSync(path.join(DIR, f), "utf8");
  ok(!/[—×]/.test(text), f + ": no em dash and no multiplication sign");
  const bad = [];
  (text.match(/\]\(([^)#]+\.md)(#[^)]*)?\)/g) || []).forEach((l) => {
    const target = /\]\(([^)#]+\.md)/.exec(l)[1];
    if (!fs.existsSync(path.join(DIR, target))) bad.push(target);
  });
  ok(!bad.length, f + ": links resolve" + (bad.length ? " (missing " + bad.join(", ") + ")" : ""));
});

// what article 28(3) requires an agreement to say
const dpa = fs.readFileSync(path.join(DIR, "personuppgiftsbitradesavtal.md"), "utf8");
[
  ["instructions", /dokumenterade instruktioner/], ["confidentiality", /tystnadsplikt/], ["security measures", /Bilaga 2/],
  ["sub-processors", /Underbiträden/], ["data subject rights", /Registrerades rättigheter/], ["incidents", /personuppgiftsincident/],
  ["deletion or return", /radera alla personuppgifter/], ["audits", /granskning/i], ["third countries", /tredje land/]
].forEach(([name, re]) => ok(re.test(dpa), "agreement covers: " + name));

// the documents must describe the deletion the product actually has
const radering = fs.readFileSync(path.join(DIR, "radering-och-gallring.md"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const teacher = fs.readFileSync(path.join(__dirname, "..", "teacher-view.js"), "utf8");
ok(/Radera mitt konto/.test(radering) && /Radera mitt konto/.test(app), "the account deletion in the documents matches the button");
ok(/Radera klassen/.test(radering) && /Radera klassen/.test(teacher), "the class deletion in the documents matches the button");
ok(/Ladda ner elevens uppgifter/.test(radering) && /Ladda ner elevens uppgifter/.test(teacher), "the student export in the documents matches the button");

console.log(failures ? failures + " FAILED" : "ALL PASSED");
process.exit(failures ? 1 : 0);
