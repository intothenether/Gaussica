"use strict";
// Worksheets: every lesson gives a sheet with questions and an answer key, the same options give the same sheet,
// and different students get different numbers.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "worksheet.js");
const WS = window.GaussicaWorksheet;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const lessons = fs.readdirSync(ROOT + "lessons").filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "bundle.json")
  .map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"))).filter((l) => l && l.id);
ok(lessons.length > 50, "the lessons were read");

let differing = 0, withTemplates = 0, empty = [];
lessons.forEach((lesson) => {
  const a = WS.build({ lessons: [lesson], perLesson: 6, names: ["Anna", "Bo"] });
  const b = WS.build({ lessons: [lesson], perLesson: 6, names: ["Anna", "Bo"] });
  const qs = (r, i) => r.sheets[i].sections[0].questions;
  ok(JSON.stringify(qs(a, 0).map((q) => q.problem.prompt)) === JSON.stringify(qs(b, 0).map((q) => q.problem.prompt)), lesson.id + ": the same options give the same sheet");
  if (!qs(a, 0).length) { empty.push(lesson.id); return; }
  qs(a, 0).forEach((q, i) => {
    ok(q.number === i + 1, lesson.id + ": numbered in order");
    ok(typeof q.problem.prompt === "string" && q.problem.prompt.trim(), lesson.id + ": a question has a prompt");
    ok(!/[{}]/.test(q.problem.prompt), lesson.id + ": no unresolved braces in " + q.problem.prompt);
    const text = WS.answerText(q);
    ok(text && text.trim(), lesson.id + ": question " + q.number + " has an answer in the key");
    if (q.kind === "pairs") ok(q.order.slice().sort().join() === q.problem.pairs.map((p, k) => k).join(), lesson.id + ": the order of a matching question is a permutation");
  });
  if (window.GaussicaPractice.has(lesson)) {
    withTemplates++;
    if (JSON.stringify(qs(a, 0).map((q) => q.problem.prompt)) !== JSON.stringify(qs(a, 1).map((q) => q.problem.prompt))) differing++;
    const prompts = qs(a, 0).map((q) => JSON.stringify([q.problem.prompt, q.problem.statements, q.problem.pairs]));
    ok(new Set(prompts).size === prompts.length, lesson.id + ": no question twice on one sheet");
  }
});
ok(empty.length === 0, "lessons without any question for a sheet: " + empty.join(", "));
ok(differing >= withTemplates * 0.95, "different students get different numbers (" + differing + " of " + withTemplates + ")");

// several lessons on one sheet are numbered through
const two = WS.build({ lessons: lessons.slice(0, 2), perLesson: 4, names: [""] });
const nums = two.sheets[0].sections.reduce((all, s) => all.concat(s.questions.map((q) => q.number)), []);
ok(nums.join() === nums.map((_, i) => i + 1).join(), "the numbers continue over the lessons: " + nums.join());

console.log(failures ? failures + " FAILED" : "All worksheet checks passed (" + lessons.length + " lessons)");
process.exit(failures ? 1 : 0);
