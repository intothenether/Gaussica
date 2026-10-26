"use strict";
// Solution steps in a template become the solution of the generated question (the worked example of the player).
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const PR = window.GaussicaPractice;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const lesson = { id: "t", practice: [
  { id: "med", for: ["exercise"], vars: { a: [11, 99], b: [11, 99] }, derive: [{ name: "s", expr: "a+b" }], prompt: "Räkna ut {a} + {b}.", answer: ["=s"], correct: "Rätt! {a} + {b} = {s}.", steps: ["Lägg ihop entalen och tiotalen.", "{a} + {b} = {s}"] },
  { id: "utan", for: ["word-0"], vars: { a: [11, 99] }, prompt: "Vad är {a}?", answer: ["=a"], correct: "Rätt!" }
] };
for (let i = 0; i < 100; i++) {
  const q = PR.generate(lesson, "med", 100 + i);
  ok(q.problem.solution && q.problem.solution.length === 2 && q.problem.solution[1] === q.problem.prompt.replace("Räkna ut ", "").replace(".", "") + " = " + q.problem.answer[0], "the steps are filled in with the numbers of the question: " + JSON.stringify(q.problem.solution));
}
ok(PR.generate(lesson, "utan", 5).problem.solution === undefined, "a template without steps has no solution");
console.log(failures ? failures + " FAILED" : "All worked-example checks passed");
process.exit(failures ? 1 : 0);
