"use strict";
// algebra.js: the solutions of an equation, a line of a solution checked against the line above, the mistakes behind wrong answers, and the equation put
// together with an answer. And on the whole course: every equation in an algebra question is satisfied by the answer that the question says is right.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = global;
require(ROOT + "pyssel.js");
const S = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
const A = require(ROOT + "algebra.js");
const PR = window.GaussicaPractice;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL " + m); } };
const ev = (s, x) => S.evaluateAST(S.parse(s), { x: x });

// ----- the reading of a minus sign and of ² -----
ok(ev("-x^2", 3) === -9 && ev("-3^2", 0) === -9 && ev("(-x)^2", 3) === 9 && ev("2^-1", 0) === 0.5 && ev("2^3^2", 0) === 512 && ev("3*-2", 0) === -6, "a minus sign in front of a power applies to the whole power: −x² is −(x²)");
ok(!S.areEquivalent("-x^2", "x^2") && S.areEquivalent("-x^2", "-(x^2)") && !S.areEquivalent("-x^2", "(-x)^2"), "so −x² is not x²");
ok(S.areEquivalent("x²", "x^2") && S.areEquivalent("(x+1)²", "x^2+2x+1") && S.areEquivalent("2x²−x³", "2x^2-x^3"), "² and ³ are powers");

// ----- the solutions of an equation -----
const sol = (e) => A.solutions(e);
const near = (a, b) => Math.abs(a - b) < 1e-9;
ok(near(sol("3x+2=14").roots[0], 4) && near(sol("2x+3=x+9").roots[0], 6) && near(sol("x/3+1=5").roots[0], 12), "linear equations: " + JSON.stringify([sol("3x+2=14"), sol("2x+3=x+9"), sol("x/3+1=5")]));
ok(sol("x^2-5x+6=0").roots.join() === "2,3" && sol("x²=49").roots.join() === "-7,7" && sol("x^2+1=0").type === "none" && sol("x^2-4x+4=0").roots.join() === "2", "quadratic: two, one or no solutions");
ok(sol("2(x+1)=2x+2").type === "all" && sol("x+1=x+2").type === "none", "an equation that is always true or never");
ok(A.sameSolutions("3x+2=14", "x=4") === true && A.sameSolutions("3x+2=14", "3x=16") === false && A.sameSolutions("x^2=9", "x=3") === false && A.sameSolutions("x^2-5x+6=0", "(x-2)(x-3)=0") === true, "the same solutions or not");
ok(A.sameSolutions("3x+2=14", "x+y=2") === null, "two letters: not known");

// ----- a line of a solution -----
const step = (a, b) => A.stepCheck(a, b);
ok(step("3x+2=14", "3x=12").ok && step("3x+2=14", "x=4").ok && step("2x+3=x+9", "x+3=9").ok && step("2x+3=x+9", "x=6").ok && step("3x=12", "x=4").ok, "right steps");
ok(step("3x+2=14", "14=3x+2").ok, "the sides turned over is the same equation");
ok(step("3(x+4)", "3x+12").ok && !step("3(x+4)", "3x+4").ok, "lines of an expression: the same value or not");
ok(step("3x+2=14", "3x=16").kind === "sign" && step("2x+3=x+9", "2x=x+12").kind === "sign", "a term moved without changing sign");
ok(step("3x+2=14", "3x=14").kind === "one-side" && step("5x-3=22", "5x=22").kind === "one-side", "something done to one side only");
ok(step("6x+4=10", "3x+4=5").kind === "some-terms" && step("6x+4=10", "3x+2=10").kind === "some-terms", "only some terms divided");
ok(step("3x=12", "x=12-3").kind === "wrong-operation" && step("3x=12", "x=36").kind === "wrong-operation", "the wrong operation to free the letter");
ok(step("2x+3=x+9", "3x=9").kind === "arithmetic" && step("3x+2=14", "3x=11").kind === "arithmetic", "a number that is wrong in a right kind of step");
ok(step("x=6", "x=6").kind === "same" && step("3x+2=14", "").kind === "empty" && step("3x+2=14", "3x+").kind === "syntax" && step("3x+2=14", "3x").kind === "mix", "the same line, an empty line, one that cannot be read, a line without an equals sign");
ok(step("3x+2=14", "3x=16").message.length > 40 && !/16|12|4/.test(step("3x+2=14", "3x=16").message), "what is said never names a number of the solution: " + step("3x+2=14", "3x=16").message);

// ----- the mistakes behind an answer -----
const d = (answer, prompt) => A.diagnose(answer, prompt);
ok(d("3x+4", "Förenkla 3(x + 4).").code === "distribute-first" && /18/.test(d("3x+4", "Förenkla 3(x + 4).").explanation) && /10/.test(d("3x+4", "Förenkla 3(x + 4).").explanation), "only the first term multiplied, with a check by numbers");
ok(d("a^2+b^2", "Utveckla (a + b)^2.").code === "square-sum" && d("2x^2", "Förenkla (2x)^2.").code === "square-product", "(a + b)² and (2x)²");
ok(d("-a+b", "Förenkla -(a + b).").code === "minus-bracket" && d("5x-2", "Förenkla 5x - (2 + 0).") === null, "a minus in front of a bracket");
ok(d("3x+2", "Förenkla (6x + 4)/2.") === null && d("3x+4", "Förenkla (6x + 4)/2.").code === "divide-one", "only one term divided");
ok(d("5x", "Förenkla 3x + 2.").code === "unlike-terms" && d("x^6", "Förenkla x^2 * x^3.").code === "power-product", "unlike terms added, exponents multiplied");
ok(d("3x+12", "Förenkla 3(x + 4).") === null, "a right answer is no mistake");
ok(d("12", "Lös ekvationen: 3x + 2 = 14.").code === "halfway" && d("36", "Lös ekvationen: 3x + 2 = 14.").code === "multiply" && d("-4", "Lös ekvationen: 3x + 2 = 14.").code === "negated", "solving: halfway, multiplied, wrong sign");
ok(d("16", "Lös ekvationen: 3x + 2 = 14.").code === "sign-const" && d("16/3", "Lös ekvationen: 3x + 2 = 14.").code === "sign-const" && d("14/3", "Lös ekvationen: 3x + 2 = 14.").code === "one-side", "solving: a term moved without changing sign, or taken from one side only");
ok(/blir vänster sida 110 och höger sida 14/.test(d("36", "Lös ekvationen: 3x + 2 = 14.").explanation), "the answer put into the equation shows that the sides are not equal");
ok(d("4", "Lös ekvationen: 3x + 2 = 14.") === null && d("x", "Lös ekvationen: 3x + 2 = 14.") === null && d("7", "Hur gammal är du?") === null, "a right answer, a word, and a question without algebra");

// ----- the equation with an answer in it -----
const sub = (p, a) => A.substitution(p, a);
let s = sub("Lös ekvationen: 3x + 2 = 14. Vad är x?", "x = 5");
ok(s && s.parts.before === "3x + 2 = 14" && s.parts.after === "3 · 5 + 2 = 14" && s.left === 17 && s.right === 14 && s.equal === false, "the equation with 5 for x: 17 = 14");
s = sub("Lös ekvationen: 3x + 2 = 14.", "4");
ok(s.equal && s.left === 14 && s.right === 14 && s.parts.after === "3 · 4 + 2 = 14", "and with the right answer 14 = 14");
s = sub("Lös ekvationen 2x − 3 = x + 5.", "−8");
ok(s && s.parts.after === "2 · (−8) − 3 = −8 + 5" && s.left === -19 && s.right === -3, "a negative answer is in brackets: " + (s && s.parts.after));
s = sub("Lös ekvationen x/4 = 3.", "12");
ok(s && s.equal && s.parts.after === "12 / 4 = 3", "a division: " + (s && s.parts.after));
s = sub("Lös x² − 5x + 6 = 0.", "3");
ok(s && s.equal && s.parts.after === "3^2 − 5 · 3 + 6 = 0", "a power: " + (s && s.parts.after));
s = sub("Lös ekvationen: 2x = 3.", "3/2");
ok(s && s.equal && s.value === 1.5, "a fraction as the answer");
ok(sub("Lös ekvationen: 3x + 2 = 14.", "fyra") === null && sub("f(x) = 3x + 2. Vad blir f(4)?", "14") === null && sub("Hur mycket är 3 · 4?", "12") === null && sub("Ett tal plus 2 är 14. Vilket tal?", "12") === null, "no equation, no animation");
ok(sub("Lös ekvationen: x + y = 5.", "3") === null, "two letters: no animation");

// ----- on the whole course -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
let equations = 0, satisfied = 0;
const unsatisfied = [];
idx.lessons.forEach((f) => {
  const lesson = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  if (lesson.area !== "algebra" && !/ekvation|funktion/.test(lesson.id)) return;
  const questions = [lesson.exercise].concat(lesson.wordProblems || []).map((q) => ({ prompt: q.prompt, answer: q.answer, where: lesson.id }));
  (lesson.practice || []).forEach((t) => { for (let i = 1; i <= 12; i++) { const q = PR.generate(lesson, t.id, i * 7919); if (q && q.problem.prompt && q.problem.answer) questions.push({ prompt: q.problem.prompt, answer: q.problem.answer, where: lesson.id + "/" + t.id }); } });
  questions.forEach((q) => {
    const sb = A.substitution(q.prompt, q.answer[0]);
    if (!sb) return;
    equations++;
    if (sb.equal) satisfied++; else if (unsatisfied.length < 8) unsatisfied.push(q.where + ": " + sb.equation + " with " + q.answer[0] + " gives " + sb.left + " and " + sb.right);
  });
});
console.log("algebra: " + equations + " equations in questions, " + satisfied + " satisfied by the answer that the question says is right");
ok(equations > 150 && unsatisfied.length === 0, "the right answer of every equation question satisfies the equation: " + unsatisfied.join(" | "));

// ----- the worked examples and the models of the lessons are right -----
const Model = require(ROOT + "figures-algebra.js");
let examples = 0, lines = 0;
idx.lessons.forEach((f) => {
  const lesson = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  (lesson.components || []).forEach((c, i) => {
    if (c.type === "arbetat-exempel") {
      examples++;
      let prev = c.start;
      ok(Array.isArray(c.steps) && c.steps.length >= 1 && c.steps.every((s) => s.line && s.say), lesson.id + " comp " + i + ": a worked example needs steps with a line and a comment");
      (c.steps || []).forEach((s, k) => {
        lines++;
        const r = A.stepCheck(prev, s.line);
        ok(r.ok, lesson.id + " comp " + i + ": step " + (k + 1) + " of the worked example is not the same as the line above (" + prev + " -> " + s.line + "): " + r.message);
        prev = s.line;
      });
    }
    if (c.type === "ekvationsmodell") {
      const states = Model.states(c);
      const eq = Model.symbols(states[0].L, states[0].R);
      const last = states[states.length - 1];
      const final = Model.symbols((last.symbolsFor || last).L, (last.symbolsFor || last).R);
      const s = A.solutions(eq);
      ok(states.length >= 3 && s && s.type === "set" && final === "x = " + s.roots[0].toString(), lesson.id + " comp " + i + ": the model ends at x = " + (s && s.roots) + ", it says " + final);
    }
  });
});
console.log("algebra: " + examples + " worked examples, " + lines + " lines each the same as the one above");
ok(examples >= 5, "the lessons have worked examples (" + examples + ")");

console.log(failures ? "\n" + failures + " FAILED" : "All checks on algebra passed");
process.exit(failures ? 1 : 0);
