"use strict";
// Prov: every student gets their own variant, the same one every time, and the record of a student is read back.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const P = require(ROOT + "prov.js");
const T = (() => { require(ROOT + "test-mode.js"); return window.GaussicaTest; })();

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const withTemplates = lessons.filter((l) => !l.isParentLesson && window.GaussicaPractice.has(l));
const config = { title: "Prov", lessons: withTemplates.slice(0, 3).map((l) => l.id), perLesson: 4, minutes: 20, showResult: true };

const a1 = P.items(config, lessons, "7:11"), a2 = P.items(config, lessons, "7:11"), b = P.items(config, lessons, "7:12");
ok(a1.length === 12, "three lessons with four questions each: " + a1.length);
ok(JSON.stringify(a1.map((i) => i.problem.prompt)) === JSON.stringify(a2.map((i) => i.problem.prompt)), "the same student gets the same questions every time");
ok(JSON.stringify(a1.map((i) => i.problem.prompt)) !== JSON.stringify(b.map((i) => i.problem.prompt)), "another student gets other numbers");
ok(a1.every((i, n) => i.key === "q" + (n + 1)), "the questions are numbered");
ok(new Set(a1.map((i) => i.problem.prompt)).size === a1.length, "no question twice");

// every lesson with templates gives a prov, for several students
let bad = [];
withTemplates.forEach((l) => {
  ["1:1", "1:2", "1:3"].forEach((seed) => {
    const it = P.items({ lessons: [l.id], perLesson: 5 }, lessons, seed);
    if (it.length < Math.min(3, 5) || it.some((x) => !x.problem.prompt || /[{}]/.test(x.problem.prompt))) bad.push(l.id + "@" + seed);
  });
});
ok(!bad.length, "lessons that give a broken prov: " + bad.slice(0, 5).join(", "));

// a lesson without templates gives its own questions
const plain = lessons.find((l) => !l.isParentLesson && !window.GaussicaPractice.has(l));
if (plain) ok(P.items({ lessons: [plain.id], perLesson: 2 }, lessons, "x").length >= 1, "a lesson without templates gives its own questions");

// the record
const student = { id: "5", lessonProgress: { "prov-9": { v: 1, answers: [{ correct: true }, { correct: false }], total: 5 } } };
const rec = P.recordOf(student, { id: 9 });
ok(rec && P.status(rec) === "started" && P.scoreOf(rec) === 1, "a started prov is read back with its score");
ok(P.status(Object.assign({}, rec, { finishedAt: "2026-01-01" })) === "done" && P.status(null) === "new" && P.recordOf(student, { id: 8 }) === null, "status and missing records");

// marking: the same rules as in a lesson (strict), more generous when it is not
const lesson = { id: "x" };
const q = { prompt: "Räkna ut 36/6.", answer: ["6"], feedback: [], correct: "" };
ok(T.judge(lesson, q, "6", { strict: true }).correct, "the right answer is right");
ok(!T.judge(lesson, q, "36/6", { strict: true, allowsExpression: () => false }).correct, "a calculation is not a number in a prov");
ok(T.judge(lesson, q, "36/6", { strict: false }).correct, "a calculation is accepted in the placement test");
ok(!T.judge(lesson, q, "", { strict: true }).correct && !T.judge(lesson, q, "7", {}).correct, "empty and wrong answers are wrong");
const tf = { prompt: "Sant eller falskt?", statements: [{ text: "a", answer: true }, { text: "b", answer: false }] };
ok(T.judge(lesson, tf, [true, false]).correct && !T.judge(lesson, tf, [true, true]).correct && !T.judge(lesson, tf, [true]).correct, "true or false is marked per statement");
const pairs = { prompt: "Para ihop", pairs: [{ term: "a", definition: "x" }, { term: "b", definition: "y" }] };
ok(T.judge(lesson, pairs, [0, 1]).correct && !T.judge(lesson, pairs, [1, 0]).correct, "matching is marked per term");
const form = { prompt: "Skriv 3/4 i blandad form", answer: ["1 3/4"], form: "blandad" };
ok(!T.judge(lesson, { prompt: "p", answer: ["7/4"], form: "blandad" }, "7/4", { strict: true, formNote: (f, r) => (r.indexOf("/") >= 0 ? "x" : "") }).correct, "the form rule of a question counts in a prov");

console.log(failures ? failures + " FAILED" : "All prov checks passed");
process.exit(failures ? 1 : 0);
