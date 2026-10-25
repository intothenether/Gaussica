"use strict";
// A long lesson introduction is read on several pages. Cutting it into pages must never lose or change text.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
require(ROOT + "lesson-model.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
let longest = 0;
idx.lessons.forEach((f) => {
  const l = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  if (!l.explanation) return;
  const parts = L.explanationParts(l.explanation);
  const joined = norm(parts.map((p) => p.join(" ")).join(" "));
  ok(joined === norm(l.explanation), l.id + ": the pages do not add up to the explanation");
  ok(parts.every((p) => p.length && p.every((x) => x.trim())), l.id + ": an empty page or paragraph");
  parts.forEach((p) => { longest = Math.max(longest, norm(p.join(" ")).length); });
  // the steps carry the page numbers, and the figure and the rule come after the text
  const steps = L.steps(l).filter((s) => s.keys && s.keys[0] === "explanation");
  ok(steps.length === parts.length, l.id + ": one step per page");
});
ok(longest <= 1100, "no page is longer than 1100 characters (longest was " + longest + ")");

// decimals and abbreviations are not the end of a sentence
const one = L.explanationParts("Hur mycket är 7.2 delat med 3? Det är 2.4, t.ex. i kronor. Sedan går vi vidare.");
ok(one.length === 1, "a short text is one page");
const long = "Problemet: " + new Array(14).join("Det här är en längre mening med talet 3,5 och t.ex. en förkortning. ");
const pages = L.explanationParts(long);
ok(pages.length > 1, "a long text is cut into pages");
ok(pages.every((p) => !/t\.ex\.$/.test(p.join(" "))), "a page never ends in the middle of t.ex.");

console.log(failures ? failures + " FAILED" : "All explanation-page checks passed");
process.exit(failures ? 1 : 0);
