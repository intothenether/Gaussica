"use strict";
// The questions about terms (practice.js: examples with the word missing, terms that are easily mixed up in the same round) and how well each term
// is known (terms.js: ny, övar, kan, säker), and that Öva mer asks more about the terms that are not safe.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = global;
require(ROOT + "pyssel.js");
require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
const PR = window.GaussicaPractice;
const T = require(ROOT + "terms.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL " + m); } };
const lessonOf = (n) => JSON.parse(fs.readFileSync(ROOT + "lessons/begrepp-" + n + ".json", "utf8"));
const names = fs.readdirSync(ROOT + "lessons").filter((f) => /^begrepp-.*\.json$/.test(f)).map((f) => f.replace(/^begrepp-|\.json$/g, ""));

// ----- the ways to ask about a term -----
let leaks = [], questions = 0, asExample = 0;
names.forEach((n) => {
  const lesson = lessonOf(n);
  const pool = lesson.practice.find((t) => t.id === "fraga").pool;
  const seen = {};
  for (let s = 1; s <= 300; s++) {
    const q = PR.generate(lesson, "fraga", s * 7919);
    if (!q) continue;
    const p = q.problem;
    questions++;
    if (/^Vilket ord fattas/.test(p.prompt)) {
      asExample++;
      seen[p.answer[0]] = true;
      const sentence = p.prompt.split("”")[1] || "";
      if (!/___/.test(sentence) || p.answer.some((a) => sentence.toLowerCase().includes(a.toLowerCase()))) leaks.push(n + ": " + sentence);
    }
    ok(Array.isArray(p.terms) && p.terms[0] === p.answer[0] && p.level === 2, n + ": a question about a term says which term, at level 2");
    ok(Array.isArray(p.bank) && p.bank.length >= 3 && !p.bank.includes(p.answer[0]), n + ": and the words that it is most easily mixed up with for the word bank");
  }
  const without = pool.filter((p) => !seen[p.term]).map((p) => p.term);
  ok(without.length === 0, n + ": every term is also asked about with an example: not " + without.join(", "));
});
ok(leaks.length === 0, "an example never has the word in it: " + leaks.slice(0, 3).join(" | "));
ok(asExample / questions > 0.35 && asExample / questions < 0.8, "about half of the questions are about an example, not the explanation (" + Math.round(100 * asExample / questions) + " %)");

// a round of matching has the terms that are most like each other
const rakna = lessonOf("rakna");
const family = new Set(["summa", "differens", "produkt", "kvot"]);
let together = 0, rounds = 0;
for (let s = 1; s <= 200; s++) {
  const p = PR.generate(rakna, "koppla", s * 104729).problem;
  const asked = p.terms.filter((t) => family.has(t)).length;
  rounds++;
  if (family.has(p.terms[0])) { if (asked === 4) together++; } else if (asked >= 0) together++;
  ok(p.pairs.length === 4 && p.level === 1 && p.pairs.every((x) => x.definition && x.term) && new Set(p.pairs.map((x) => x.definition)).size === 4, "a round has four pairs with different explanations");
}
let familyRounds = 0, familyFull = 0;
for (let s = 1; s <= 200; s++) {
  const p = PR.generate(rakna, "koppla", s * 104729).problem;
  if (family.has(p.terms[0])) { familyRounds++; if (p.terms.filter((t) => family.has(t)).length >= 3) familyFull++; }
}
ok(familyRounds > 30 && familyFull === familyRounds, "a round that starts with summa, differens, produkt or kvot has at least three of the four: the ones with the same first words (" + familyFull + " of " + familyRounds + ")");
const withExample = [];
for (let s = 1; s <= 100; s++) PR.generate(rakna, "koppla", s * 31).problem.pairs.forEach((x) => { if (/___/.test(x.definition)) withExample.push(x.definition); });
ok(withExample.length > 30 && withExample.every((d) => !/summa|differens|produkt|kvot|term|faktor|addition|subtraktion|multiplikation|division/i.test(d.replace(/___/g, ""))), "some pairs are an example with the term left out (" + withExample.length + ")");

// ----- the templates say which terms they are about -----
names.forEach((n) => {
  const lesson = lessonOf(n);
  const known = new Set(lesson.practice.find((t) => t.id === "fraga").pool.map((p) => p.term));
  const numeric = lesson.practice.filter((t) => !t.pool && !t.mode && !t.statements && /^(r|t|b|d|a|g|k|s|st)-/.test(t.id));
  ok(numeric.length > 0 && numeric.every((t) => Array.isArray(t.terms) && t.terms.length && t.terms.every((x) => known.has(x))), n + ": every template with numbers names terms of the lesson");
  numeric.forEach((t) => { const q = PR.generate(lesson, t.id, 99).problem; ok(q.level === 3 && q.terms.join() === t.terms.join(), n + "/" + t.id + ": the question says its terms and level 3"); });
});

// ----- how well each term is known -----
let clock = Date.parse("2026-01-01T10:00:00Z");
const attempt = (lesson, tpl, seed, right) => ({ lessonId: lesson.id, taskId: PR.makeId(tpl, seed), feedbackType: right ? "correct" : "hint", completed: right, timestamp: new Date(clock += 60000).toISOString() });
const stateOf = (s, term) => s.terms.find((x) => x.term === term);
ok(T.stats(rakna, { attempts: [] }).terms.every((t) => t.state === "new") && T.stats(rakna, { attempts: [] }).total === 10 && T.stats({ id: "x", practice: [] }, { attempts: [] }) === null, "at first every term is new, and a lesson without terms has none");
const ex = (term, kind) => { for (let s = 1; s < 4000; s++) { const q = PR.generate(rakna, kind, s); if (q && q.problem.terms.includes(term) && q.problem.terms.length === 1) return s; } throw new Error("no " + term); };
const sum1 = ex("summa", "r-roll-summa");
let a = [attempt(rakna, "r-roll-summa", 1, true)];
ok(stateOf(T.stats(rakna, { attempts: a }), "summa").state === "know", "used once on numbers: kan");
a.push(attempt(rakna, "r-roll-summa", 2, true));
ok(stateOf(T.stats(rakna, { attempts: a }), "summa").state === "know", "used twice but never written for its explanation: still kan, not säker");
let seedF = 0;
for (let s = 1; s < 4000 && !seedF; s++) { const q = PR.generate(rakna, "fraga", s); if (q && q.problem.terms[0] === "summa") seedF = s; }
a.push(attempt(rakna, "fraga", seedF, true));
ok(stateOf(T.stats(rakna, { attempts: a }), "summa").state === "safe", "used on two different questions and written for its explanation: säker");
a.push(attempt(rakna, "r-roll-summa", 3, false), attempt(rakna, "r-roll-summa", 3, false));
const forgotten = stateOf(T.stats(rakna, { attempts: a }), "summa");
ok(forgotten.state !== "safe" && forgotten.weak, "two wrong answers in a row and it is weak and no longer säker");
a = [attempt(rakna, "r-roll-summa", 1, true), attempt(rakna, "r-roll-summa", 1, true), attempt(rakna, "r-roll-summa", 1, true)];
ok(stateOf(T.stats(rakna, { attempts: a }), "summa").levels[3] === 1, "the same question answered again does not count as another");
a = [{ lessonId: "annat", taskId: PR.makeId("r-roll-summa", 1), feedbackType: "correct", completed: true, timestamp: "2026-01-01T10:00:00Z" }, { lessonId: rakna.id, taskId: "exercise", feedbackType: "correct", completed: true, timestamp: "2026-01-01T10:00:01Z" }];
ok(T.stats(rakna, { attempts: a }).terms.every((t) => t.state === "new"), "answers of other lessons and of the lesson itself are not counted");

// ----- Öva mer asks more about what is not safe -----
const safeAttempts = [];
["summa", "differens", "produkt", "kvot", "term"].forEach((term) => {
  const tpl = { summa: "r-roll-summa", differens: "r-roll-differens", produkt: "r-roll-produkt", kvot: "r-roll-kvot", term: "r-roll-term" }[term];
  safeAttempts.push(attempt(rakna, tpl, 1, true), attempt(rakna, tpl, 2, true));
  for (let s = 1; s < 4000; s++) { const q = PR.generate(rakna, "fraga", s); if (q && q.problem.terms[0] === term) { safeAttempts.push(attempt(rakna, "fraga", s, true)); break; } }
});
const student = { attempts: safeAttempts };
const st = T.stats(rakna, student);
ok(["summa", "differens", "produkt", "kvot", "term"].every((t) => stateOf(st, t).state === "safe") && st.safe === 5, "five terms are safe");
const bias = T.bias(rakna, student);
ok(typeof bias === "function" && T.bias({ id: "x", practice: [] }, student) === null, "there is a bias for a lesson with terms, and none for a lesson without");
const count = { safe: 0, other: 0 };
const known5 = new Set(["summa", "differens", "produkt", "kvot", "term"]);
for (let i = 0; i < 600; i++) {
  const q = PR.fresh(rakna, null, new Set(), bias);
  if (q.problem.terms && q.problem.terms.every((t) => known5.has(t))) count.safe++; else count.other++;
}
const plain = { safe: 0, other: 0 };
for (let i = 0; i < 600; i++) { const q = PR.fresh(rakna, null, new Set()); if (q.problem.terms && q.problem.terms.every((t) => known5.has(t))) plain.safe++; else plain.other++; }
console.log("Öva mer: questions only about safe terms " + plain.safe + " of 600 without the bias, " + count.safe + " with it");
ok(count.safe < plain.safe * 0.75, "with the bias the safe terms are asked about clearly less often (" + count.safe + " against " + plain.safe + ")");
ok(PR.fresh(rakna, null, new Set(["x"]), null) && PR.fresh(rakna, null, new Set(), bias).problem.prompt, "a round is still made, with and without it");

console.log(failures ? "\n" + failures + " FAILED" : "All checks on terms passed");
process.exit(failures ? 1 : 0);
