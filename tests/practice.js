"use strict";
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
require(ROOT + "pyssel.js");
const S = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const PR = window.GaussicaPractice;
const verbose = process.argv.includes("--samples");

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const problems = [];
const bad = (where, msg) => { if (problems.length < 60) problems.push(where + ": " + msg); else if (problems.length === 60) problems.push("... more"); };
let templates = 0, generated = 0;

idx.lessons.forEach((f) => {
  const lesson = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  const list = PR.templates(lesson);
  if (!list.length) return;
  const ids = new Set();
  list.forEach((t) => {
    templates++;
    const where = lesson.id + "/" + t.id;
    if (ids.has(t.id)) bad(where, "duplicate template id"); ids.add(t.id);
    if (!/^[A-Za-z0-9_-]+$/.test(t.id)) bad(where, "template id has odd characters");
    (t.for || []).forEach((k) => {
      const ok = k === "exercise" || /^match-\d+$/.test(k) || /^sf-\d+$/.test(k) || /^word-\d+$/.test(k) && Number(k.slice(5)) < (lesson.wordProblems || []).length + 1;
      if (!ok) bad(where, "for: unknown task " + k);
    });
    const prompts = new Set();
    let fails = 0, tfSame = 0;
    for (let i = 0; i < 300; i++) {
      const seed = 1000 + i * 7919;
      const q = PR.generate(lesson, t.id, seed);
      if (!q) { fails++; continue; }
      generated++;
      const p = q.problem;
      prompts.add(p.prompt + JSON.stringify(p.visual || "") + JSON.stringify(p.pairs || "") + JSON.stringify(p.statements || ""));
      if (p.statements) {
        // a true/false round: every statement has text and a true or false answer, and no text is left unresolved
        if (!p.statements.length || p.statements.some((s) => !String(s.text || "").trim() || typeof s.answer !== "boolean")) { bad(where, "a statement without text or a true/false answer"); break; }
        if (p.statements.some((s) => /NaN|undefined|Infinity|[{}$]/.test(s.text + " " + (s.explain || "")))) { bad(where, "unresolved text in a statement: " + p.statements[0].text); break; }
        if (p.statements.length > 1 && p.statements.every((s) => s.answer === p.statements[0].answer) && i < 30) tfSame++;
      }
      if (q.taskId.length > 80 || !/^[\p{L}\p{N}_-]+$/u.test(q.taskId)) bad(where, "bad task id " + q.taskId);
      const again = PR.generate(lesson, t.id, seed);
      if (JSON.stringify(again.problem) !== JSON.stringify(p)) bad(where, "not reproducible from seed");
      const strings = [p.prompt, p.correct].concat(p.answer).concat(p.feedback.map((x) => x.message)).concat(p.feedback.reduce((acc, x) => acc.concat(x.answers), []));
      if (strings.some((s) => /NaN|undefined|Infinity|[{}$]/.test(s))) { bad(where, "unresolved text: " + p.prompt); break; }
      if (/\?\?|[^\s(]\?[^\s)]/.test(p.prompt.replace(/\?\s*$/, "").replace(/□|\?\//g, ""))) { /* a lone "?" inside the prompt is fine */ }
      if (!p.answer.length) { bad(where, "no answer"); break; }
      if (p.solution && p.solution.some((s) => /NaN|undefined|Infinity|[{}$]/.test(s))) { bad(where, "unresolved text in the solution steps: " + p.solution[0]); break; }
      p.answer.forEach((a) => { if (!S.areEquivalent(a, a)) bad(where, "answer '" + a + "' not accepted as typed"); });
      const numericOnes = p.answer.filter((a) => /^-?\d+([.,]\d+)?$/.test(a));
      numericOnes.forEach((a) => { if (!S.areEquivalent(a, numericOnes[0])) bad(where, "answers disagree: " + a + " vs " + numericOnes[0]); });
      p.feedback.forEach((fb) => fb.answers.forEach((w) => {
        p.answer.forEach((a) => { if (S.areEquivalent(w, a)) bad(where, "hint answer '" + w + "' equals accepted '" + a + "' for " + p.prompt); });
      }));
      // typing the first number with the unit the other answers use must be accepted
      const unitCm = p.answer.some((a) => /\scm$/.test(a)), unitM = p.answer.some((a) => /\sm$/.test(a));
      const first = numericOnes[0];
      if (first !== undefined) {
        const typed = [];
        if (unitCm) typed.push(first + "cm", first + " cm");
        if (unitM) typed.push(first + "m", first + " m");
        typed.forEach((v) => { if (!p.answer.some((a) => S.areEquivalent(v, a))) bad(where, "typing '" + v + "' would be rejected"); });
      }
      if (!p.correct || p.correct.length < 4) bad(where, "no correct message");
    }
    if (tfSame > 20) bad(where, "most true/false rounds have only true or only false statements (" + tfSame + " of the first 30)");
    if (fails > 3) bad(where, "could not build " + fails + " of 300 questions (constraints too strict?)");
    if (prompts.size < Math.min(5, 300 - fails)) bad(where, "only " + prompts.size + " different prompts in 300");
    if (verbose) {
      const q = PR.generate(lesson, t.id, 4242);
      if (q) console.log("[" + where + "] " + q.problem.prompt + "  =>  " + q.problem.answer.slice(0, 2).join(" | ") + (q.problem.feedback[0] ? "   (hint: " + q.problem.feedback[0].answers[0] + ")" : ""));
    }
  });
});

console.log(templates + " templates, " + generated + " questions generated");
console.log(problems.length ? problems.join("\n") : "NO PROBLEMS FOUND");
process.exit(problems.length ? 1 : 0);
