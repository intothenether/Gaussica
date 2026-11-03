"use strict";
// Spelling of answers that are words (spelling.js) and the word bank (wordbank.js).
// The careful part is on the whole course: a slip is only taken for the right word, never for another term of the lesson.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = global;
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
require(ROOT + "pyssel.js");
require(ROOT + "symbolic-math.js");
const Sp = require(ROOT + "spelling.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
const WB = require(ROOT + "wordbank.js");
const PR = window.GaussicaPractice;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL " + m); } };
const m = (raw, acc, oth) => { const r = Sp.match(raw, acc, oth || []); return r ? r.word : null; };

// ----- single cases -----
const SUMMA = ["summa", "summan"], OTHERS = ["produkt", "differens", "kvot", "term", "faktor", "addition"];
ok(m("sumna", SUMMA, OTHERS) === "summa", "two letters swapped");
ok(m("suma", SUMMA, OTHERS) === "summa", "a double letter written single");
ok(m("summaa", SUMMA, OTHERS) === "summa", "a letter too many");
ok(m("sumaan", SUMMA, OTHERS) === "summan", "the other form is the nearer one");
ok(m("SUMMA ", SUMMA, OTHERS) === "summa" || m("SUMMA ", SUMMA, OTHERS) === null, "(capitals are the business of the normal comparison)");
ok(m("diferens", ["differens", "differensen"], ["summa", "produkt"]) === "differens", "a double letter missing in differens");
ok(m("taljare", ["täljare", "täljaren"], ["nämnare"]) === "täljare" && m("namnare", ["nämnare"], ["täljare"]) === "nämnare", "å ä ö written a and o");
ok(m("jamnt", ["jämnt", "jämna tal"], ["udda"]) === "jämnt", "jämnt written with a");
ok(m("x axeln", ["x-axeln", "x-axel"], ["y-axeln"]) === "x-axeln", "a space for a hyphen");
ok(m("produkt", SUMMA, OTHERS) === null && m("kvot", SUMMA, OTHERS) === null, "another term is not a slip");
ok(m("kvot", ["kvot", "kvoten"], ["kvotient"]) === "kvot", "the right word itself");
ok(m("y-axeln", ["x-axeln"], ["y-axeln"]) === null && m("yaxeln", ["x-axeln"], ["y-axeln"]) === null, "y-axeln is not a slip of x-axeln: it is the other term, also written without a hyphen");
ok(m("tern", ["term"], ["tern"]) === null, "a word that the lesson itself has is never taken for another");
ok(m("12", ["summa"], []) === null && m("3/4", ["fyra"], []) === null && m("x+1", ["xx"], []) === null, "numbers, fractions and calculations are never touched");
ok(m("sum", ["summa"], []) === "summa", "a short form: three letters");
ok(m("su", ["summa"], []) === null, "two letters is not enough to say anything");
ok(m("tal", ["tel"], []) === null, "words under four letters are not changed, only written differently");
ok(m("tall", ["tal"], []) === "tal", "a double letter, also in a short word");
ok(m("summa", ["12"], []) === null, "an answer that is a number is not for this");
ok(m("sumna", ["summa"], ["sumna"]) === null, "if the lesson has the word the student wrote, it is that word");
ok(Sp.isWord("summa") && Sp.isWord("lika troligt") && Sp.isWord("x-axeln") && !Sp.isWord("12") && !Sp.isWord("3/4") && !Sp.isWord("a=b") && !Sp.isWord(""), "what a word is");

// ----- on the course -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const questions = [];
const glossaries = [];
idx.lessons.forEach((f) => {
  const lesson = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  const add = (where, ex) => { if (ex && Array.isArray(ex.answer) && ex.answer.length && ex.answer.every(Sp.isWord)) questions.push({ lesson, where, ex }); };
  add(lesson.id + "/exercise", lesson.exercise);
  (lesson.wordProblems || []).forEach((w, i) => add(lesson.id + "/word-" + i, w));
  (lesson.components || []).forEach((c, i) => add(lesson.id + "/comp-" + i, c && c.prompt ? c : null));
  (lesson.practice || []).forEach((t) => {
    for (let seed = 1; seed <= 12; seed++) {
      const q = PR.generate(lesson, t.id, seed * 7919);
      if (q && q.problem) add(lesson.id + "/" + t.id, q.problem);
    }
    if (t.mode === "fraga") glossaries.push({ lesson: lesson.id, pool: t.pool });
  });
});
ok(questions.length > 300, "many questions have a word as the answer (" + questions.length + ")");

// 1. a wrong answer that has a hint of its own is never taken for a slip of the right word
let rules = 0, wrongTaken = [];
questions.forEach((q) => {
  const ctx = Sp.contextFor(q.lesson, q.ex);
  (q.ex.feedback || []).forEach((rule) => (rule.answers || []).forEach((w) => {
    if (!Sp.isWord(w)) return;
    rules++;
    if (Sp.match(w, q.ex.answer, ctx)) wrongTaken.push(q.where + ": " + w + " -> " + Sp.match(w, q.ex.answer, ctx).word);
  }));
});
ok(wrongTaken.length === 0, "no wrong answer with a hint is taken as the right word (" + rules + " checked): " + wrongTaken.slice(0, 5).join(" | "));

// 2. the terms of a lesson are never slips of each other, in any form
let pairs = 0, mixed = [];
glossaries.forEach((g) => {
  g.pool.forEach((p) => {
    const mine = [p.term].concat(p.alt || []);
    const others = g.pool.filter((q) => q !== p);
    const ctx = g.pool.reduce((all, q) => all.concat([q.term], q.alt || []), []);
    others.forEach((q) => [q.term].concat(q.alt || []).forEach((w) => {
      if (mine.some((x) => Sp.key(x) === Sp.key(w))) return;   // the same word is an alt of both (utfall, tal)
      pairs++;
      if (Sp.match(w, mine, ctx)) mixed.push(g.lesson + ": " + w + " taken for " + p.term);
    }));
  });
});
ok(mixed.length === 0, "no term of a lesson is taken for another (" + pairs + " pairs): " + mixed.slice(0, 5).join(" | "));

// 3. the usual slips of a young speller are taken for the right word
const slips = (w) => {
  const out = new Set();
  const letters = w.replace(/[\s-]/g, "");
  if (letters.length >= 5) {
    out.add(letters.slice(0, 2) + letters[3] + letters[2] + letters.slice(4));   // two swapped
    out.add(letters.slice(0, 3) + letters.slice(4));                             // one missing
    out.add(letters.slice(0, 3) + letters[3] + letters.slice(3));                // one doubled
  }
  out.add(w.replace(/ä/g, "a").replace(/å/g, "a").replace(/ö/g, "o"));
  return Array.from(out).filter((x) => x !== w && x.trim());
};
let tried = 0, taken = 0, missed = [], wrongWay = [];
glossaries.forEach((g) => {
  const ctx = g.pool.reduce((all, q) => all.concat([q.term], q.alt || []), []);
  g.pool.forEach((p) => {
    const mine = [p.term].concat(p.alt || []);
    slips(p.term).forEach((s) => {
      tried++;
      const r = Sp.match(s, mine, ctx);
      if (r) taken++; else missed.push(p.term + ": " + s);
      if (r && !mine.includes(r.word)) wrongWay.push(s + " -> " + r.word);
    });
  });
});
console.log("spelling: " + tried + " slips of " + glossaries.reduce((n, g) => n + g.pool.length, 0) + " terms tried, " + taken + " taken for the right word (" + Math.round(100 * taken / tried) + " %)");
ok(wrongWay.length === 0, "a slip is never taken for a word that is not the term's own: " + wrongWay.slice(0, 5).join(" | "));
ok(taken / tried > 0.8, "most slips are taken (" + Math.round(100 * taken / tried) + " %); not taken: " + missed.slice(0, 12).join(" | "));

// ----- the word bank -----
const rakna = JSON.parse(fs.readFileSync(ROOT + "lessons/begrepp-rakna.json", "utf8"));
const roll = PR.generate(rakna, "r-roll-summa", 4242).problem;
const bank = WB.options(roll, rakna);
ok(bank.length >= 3 && bank.length <= 5 && bank.includes("summa") && new Set(bank).size === bank.length, "a question that asks for a term has the right word among a few others: " + bank.join(", "));
ok(bank.every((w) => w === "summa" || !roll.answer.some((a) => Sp.key(a) === Sp.key(w))), "and none of the others is another way to write the right answer");
const seen = new Set();
for (let i = 0; i < 30; i++) seen.add(WB.options(roll, rakna).indexOf("summa"));
ok(seen.size > 1, "the right word is not always in the same place");
ok(WB.options(PR.generate(rakna, "r-gor-summa", 5).problem, rakna).length === 0, "a question with a number as the answer has no bank");
ok(WB.options({ prompt: "Är det sant?", answer: ["ja"], feedback: [{ answers: ["nej"], message: "x" }] }, rakna).length === 0, "ja or nej has no bank");
ok(WB.options({ prompt: "Är 6x + 3 ett uttryck eller en ekvation?", answer: ["uttryck"], feedback: [{ answers: ["ekvation"], message: "x" }] }, rakna).length === 0, "two choices only: nothing to choose from");
ok(WB.options({ prompt: "Vad?", answer: ["summa"], bank: ["produkt", "differens"], feedback: [] }, rakna).length === 3, "a list of words on the question is used");
const fraga = PR.generate(rakna, "fraga", 77).problem;
ok(WB.options(fraga, rakna).length >= 4 && WB.options(fraga, rakna).includes(fraga.answer[0]), "the questions with an explanation get one too: " + WB.options(fraga, rakna).join(", "));
ok(fraga.feedback.length >= 5 && fraga.feedback.every((r) => /betyder: .*Det är inte det som frågas/.test(r.message)), "and a hint about what the other term means");

// it goes as the student gets on, and a setting can hold it
ok(WB.when() === "show" && WB.points() === 0, "at first it is shown");
for (let i = 0; i < 4; i++) WB.add(2);
ok(WB.points() === 8 && WB.when() === "afterMiss", "after eight points: only after a wrong answer");
for (let i = 0; i < 4; i++) WB.add(2);
ok(WB.when() === "onRequest", "after sixteen: only when asked for");
global.GaussicaReading = { settings: () => ({ bank: "always" }) };
ok(WB.when() === "show", "set to always, it stays");
global.GaussicaReading = { settings: () => ({ bank: "off" }) };
ok(WB.when() === "none", "set to never, it is not there");

console.log(failures ? "\n" + failures + " FAILED" : "All checks on spelling and the word bank passed");
process.exit(failures ? 1 : 0);
