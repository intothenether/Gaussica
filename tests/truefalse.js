"use strict";
// The true/false question format: the lesson model, generated rounds and the editor's check.
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "practice-editor.js");
const L = window.GaussicaLesson, PR = window.GaussicaPractice, PE = window.GaussicaPracticeEditor;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

// a lesson with a true/false component is one task, sf-<index of the component>
const lesson = {
  id: "t", area: "tal", title: "T", prerequisites: [], grade: 4, explanation: "x", explanationTitle: "x",
  exercise: { prompt: "p", answer: ["1"], correct: "r", feedback: [] }, wordProblems: [],
  components: [{ type: "santfalskt", prompt: "Sant eller falskt?", statements: [{ text: "En kvadrat har fyra sidor.", answer: true, explain: "Fyra lika långa sidor." }, { text: "En cirkel har fyra hörn.", answer: false }] }],
  layout: ["explanation", "comp:0", "exercise"],
  practice: [
    { id: "ord", for: ["sf-0"], mode: "santfalskt", size: 2, pool: [{ text: "A", answer: true }, { text: "B", answer: false }, { text: "C", answer: true }, { text: "D", answer: false }] },
    { id: "tal", for: ["sf-0"], vars: { a: [3, 9], b: [3, 9] }, derive: [{ name: "s", expr: "a+b" }],
      statements: [{ text: "{a} + {b} = {s}", answer: true }, { text: "{a} + {b} = {s+1}", answer: false, explain: "{a} + {b} är {s}." }, { text: "{a} är större än {b}", answer: { expr: "a-b", min: 1 } }] }
  ]
};
const tasks = L.tasks(lesson);
ok(tasks.some((t) => t.id === "sf-0" && Array.isArray(t.problem.statements) && t.problem.statements.length === 2), "tasks() has the task sf-0 with its statements");
ok(L.isTrueFalseComponent(lesson.components[0]) && !L.isTrueFalseComponent({ type: "santfalskt", statements: [] }), "isTrueFalseComponent");
ok(L.steps(lesson).filter((s) => s.type === "question").length === 2, "the true/false task is a question step");

// a round from a pool: two statements, both kinds when the pool has both
let mixed = 0;
for (let i = 0; i < 100; i++) {
  const q = PR.generate(lesson, "ord", 1000 + i);
  ok(q && q.problem.statements.length === 2, "pool round has size statements");
  if (q.problem.statements[0].answer !== q.problem.statements[1].answer) mixed++;
  ok(q.problem.answer[0] === "alla rätt" && q.taskId.indexOf("practice-ord-") === 0, "pool round has a task id and the answer");
}
ok(mixed > 80, "pool rounds mostly have one true and one false statement (" + mixed + " of 100)");

// a round with random numbers: the truth of each statement follows the numbers
for (let i = 0; i < 200; i++) {
  const q = PR.generate(lesson, "tal", 500 + i);
  const s = q.problem.statements;
  const m = /^(\d+) \+ (\d+) = (\d+)$/.exec(s[0].text), n = /^(\d+) \+ (\d+) = (\d+)$/.exec(s[1].text), c = /^(\d+) är större än (\d+)$/.exec(s[2].text);
  ok(m && Number(m[1]) + Number(m[2]) === Number(m[3]) && s[0].answer === true, "the true sum is true");
  ok(n && Number(n[1]) + Number(n[2]) !== Number(n[3]) && s[1].answer === false, "the wrong sum is false");
  ok(c && s[2].answer === (Number(c[1]) > Number(c[2])), "a condition decides the answer: " + s[2].text + " is " + s[2].answer);
  ok(!s.some((x) => /[{}]/.test(x.text + (x.explain || ""))), "no unresolved text");
}

// the editor's check accepts it and catches a missing name
ok(!PE.check(lesson.practice[0]).errors.length, "the editor accepts a pool round");
const bad = PE.check(Object.assign({}, lesson.practice[1], { statements: [{ text: "{zzz} + 1", answer: true }] }));
ok(bad.errors.length > 0, "the editor reports an unknown name in a statement");

console.log(failures ? failures + " FAILED" : "All true/false checks passed");
process.exit(failures ? 1 : 0);
