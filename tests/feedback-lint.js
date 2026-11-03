"use strict";
// Checks of the feedback that the lessons carry, so that a hint that is wrong, unreachable or about other numbers does not get to a student.
//
//   1. every wrong answer of a rule differs from the right answer
//   2. no rule is unreachable because earlier rules in the same question already take all of its answers (first match wins)
//   3. no message says a sum that is not true ("12 + 5 = 18"), and the numbers it names come from the question, the answers or a calculation with them
//   4. the same for the questions that Öva mer makes: every template is built with many seeds, and a rule has to apply in them
//   5. the automatic hints (misconceptions.js, symbolic-math.js, slips.js) only name numbers that stand in the question or come from the answers
//
// node tests/feedback-lint.js --all   also lists the warnings (what is not an error yet)
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = global;
require(ROOT + "pyssel.js");
const S = require(ROOT + "symbolic-math.js");
const MC = require(ROOT + "misconceptions.js");
const SL = require(ROOT + "slips.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
const PR = window.GaussicaPractice;
const showAll = process.argv.includes("--all");

const errors = [], warnings = [];
const bad = (where, msg) => errors.push(where + ": " + msg);
const warn = (where, msg) => warnings.push(where + ": " + msg);

const equal = (a, b) => { try { return S.areEquivalent(String(a), String(b)); } catch (e) { return false; } };
const NUMBER = /\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
const toNumber = (t) => Number(String(t).replace(/[  ]/g, "").replace(",", "."));
const numbersIn = (t) => (String(t).match(NUMBER) || []).map(toNumber).filter(Number.isFinite);
const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

// ----- 3. sums that are said in a message -----
// "12 + 5 = 17", "3 · 12 − 5 = 31": a chain of numbers with signs, then = and a number. Evaluated with · and : before + and −.
const OP = "[+−·×*÷]|(?<=\\s)[:-](?=\\s)";
const CHAIN = new RegExp("(?<![\\d,./^·×*+−÷]\\s?|\\w\\s?[=<>])(" + NUMBER.source + ")((?:\\s*(?:" + OP + ")\\s*(?:" + NUMBER.source + ")){1,8})\\s*=\\s*(−?-?" + NUMBER.source + ")(?![\\d,]|\\s*(?:" + OP + ")\\s*\\d|\\s*[a-zåäö]\\s*=)", "g");
function value(first, rest) {
  const parts = [{ op: "+", v: toNumber(first) }];
  const re = new RegExp("\\s*(" + OP + ")\\s*(" + NUMBER.source + ")", "g");
  let m;
  while ((m = re.exec(rest))) parts.push({ op: m[1], v: toNumber(m[2]) });
  // · and : first
  const terms = [];
  parts.forEach((p) => {
    const op = p.op === "−" || p.op === "-" ? "-" : p.op === "+" ? "+" : p.op === ":" || p.op === "÷" ? "/" : "*";
    if (op === "*" || op === "/") {
      if (!terms.length) return;
      const last = terms[terms.length - 1];
      last.v = op === "*" ? last.v * p.v : last.v / p.v;
    } else terms.push({ sign: op === "-" ? -1 : 1, v: p.v });
  });
  return terms.reduce((s, t) => s + t.sign * t.v, 0);
}
function falseSums(text) {
  const out = [];
  const t = String(text).replace(/\s+/g, " ");
  let m;
  CHAIN.lastIndex = 0;
  while ((m = CHAIN.exec(t))) {
    const claimed = toNumber(m[3].replace(/[−-]/, ""));
    const negative = /^[−-]/.test(m[3]);
    const got = value(m[1], m[2]);
    const said = negative ? -claimed : claimed;
    if (!near(got, said) && !near(Math.round(got * 100) / 100, said)) out.push(m[0]);
  }
  return out;
}

// the numbers that a message may name: those of the question and of the answers, and what two or three of them give together, and a few that every
// explanation uses (60 minutes, 100, 1000 ...)
const COMMON = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 24, 60, 100, 1000];
function grounded(base) {
  const set = new Set(base.concat(COMMON).map((x) => Math.round(x * 1e6) / 1e6));
  const first = Array.from(set).filter((x) => base.some((b) => near(b, x)));
  const add = (v) => { if (Number.isFinite(v)) set.add(Math.round(v * 1e6) / 1e6); };
  const pool = Array.from(new Set(base)).slice(0, 14);
  pool.forEach((a) => { pool.forEach((b) => { add(a + b); add(a - b); add(a * b); if (b) add(a / b); }); });
  const second = Array.from(set);
  second.slice(0, 160).forEach((a) => { pool.forEach((b) => { add(a + b); add(a - b); add(a * b); if (b) add(a / b); }); });
  return first && set;
}
// the digits of the numbers count too: "8 + 7 = 15 ental" is about the ones of 38 + 47
const withDigits = (base) => base.concat(base.filter((n) => Number.isInteger(n) && n >= 10 && n < 1e6).reduce((all, n) => all.concat(String(n).split("").map(Number)), []));
function ungroundedNumbers(message, base) {
  const ok = grounded(withDigits(base));
  return numbersIn(message).filter((n) => !ok.has(Math.round(n * 1e6) / 1e6) && Number.isInteger(n) === Number.isInteger(n));
}
const answersAsNumbers = (list) => list.map((a) => numbersIn(a)).reduce((x, y) => x.concat(y), []);

// ----- the questions -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
let checkedFixed = 0, checkedRules = 0, builtProblems = 0, templates = 0;

function checkRules(where, q, tally) {
  const rules = Array.isArray(q.feedback) ? q.feedback : [];
  const right = (q.answer || []).map(String);
  const base = numbersIn(q.prompt || "").concat(answersAsNumbers(right));
  const covered = [];   // the answers of the earlier rules
  rules.forEach((rule, i) => {
    const at = where + " rule " + (i + 1);
    const answers = (rule.answers || []).map(String);
    if (!answers.length || !String(rule.message || "").trim()) { bad(at, "a rule needs answers and a message"); return; }
    checkedRules++;
    answers.forEach((a) => { if (right.some((r) => equal(a, r))) tally.rightAnswer.push(at + ": " + a); });
    const free = answers.filter((a) => !covered.some((c) => equal(a, c)));
    if (!free.length) tally.shadowed.push(at);
    answers.forEach((a) => covered.push(a));
    const message = String(rule.message);
    falseSums(message).forEach((s) => tally.sums.push(at + ": \"" + s + "\" in: " + message));
    const extra = ungroundedNumbers(message, base.concat(answersAsNumbers(answers)));
    if (extra.length) tally.numbers.push(at + ": " + extra.join(", ") + " in: " + message);
  });
  falseSums(String(q.correct || "")).forEach((s) => tally.sums.push(where + " correct: \"" + s + "\" in: " + q.correct));
}

const fresh = () => ({ rightAnswer: [], shadowed: [], sums: [], numbers: [] });
const fixed = fresh();
lessons.forEach((lesson) => {
  const list = [["exercise", lesson.exercise]].concat((lesson.wordProblems || []).map((w, i) => ["word-" + i, w]),
    (lesson.components || []).map((c, i) => ["comp-" + i, c]).filter((x) => x[1] && x[1].prompt && Array.isArray(x[1].answer) && Array.isArray(x[1].feedback)));
  list.forEach(([name, q]) => {
    if (!q || !Array.isArray(q.answer)) return;
    // questions with {} are filled in at the moment of the question (names, numbers of a template): looked at below, in their built form
    if (/[{}]/.test([q.prompt, q.correct].concat((q.feedback || []).map((r) => r.message)).join(" "))) return;
    checkedFixed++;
    checkRules(lesson.id + "/" + name, q, fixed);
  });
});
fixed.rightAnswer.forEach((x) => bad(x.split(" rule")[0], "a wrong answer of a rule is the right answer (" + x + ")"));
fixed.shadowed.forEach((x) => bad(x, "unreachable: an earlier rule of the question already takes all of its answers"));
fixed.sums.forEach((x) => bad("fixed", "a sum in a message is not true: " + x));
fixed.numbers.forEach((x) => warn("fixed", "names a number that is not in the question or the answers: " + x));

// ----- 4. the questions of Öva mer, built with many seeds -----
const SEEDS = 40;
const built = fresh();
const dead = [], mostlyDead = [];
lessons.forEach((lesson) => {
  PR.templates(lesson).forEach((t) => {
    if (!Array.isArray(t.feedback) || !t.feedback.length || t.mode || Array.isArray(t.pool)) return;
    templates++;
    const where = lesson.id + "/" + t.id;
    t.feedback.forEach((rule, i) => {
      // this rule alone: how often does it still have an answer once the numbers are chosen (a rule that is the right answer is dropped)
      const only = Object.assign({}, t, { feedback: [rule] });
      let made = 0, kept = 0;
      for (let s = 1; s <= SEEDS; s++) {
        const q = PR.generate({ practice: [only] }, t.id, s * 104729);
        if (!q) continue;
        made++;
        if (q.problem.feedback.length) kept++;
      }
      if (made >= 10 && kept === 0) dead.push(where + " rule " + (i + 1));
      else if (made >= 10 && kept / made < 0.25) mostlyDead.push(where + " rule " + (i + 1) + " (" + kept + " of " + made + ")");
    });
    for (let s = 1; s <= SEEDS; s++) {
      const q = PR.generate(lesson, t.id, s * 104729);
      if (!q) continue;
      builtProblems++;
      const tally = fresh();
      checkRules(where + " seed " + s, q.problem, tally);
      tally.shadowed.forEach((x) => built.shadowed.push(x));
      tally.sums.forEach((x) => built.sums.push(x));
      tally.numbers.forEach((x) => built.numbers.push(x));
    }
  });
});
dead.forEach((x) => bad(x.split(" rule")[0], "a rule that never applies, with any numbers (" + x + ")"));
mostlyDead.forEach((x) => warn("templates", "a rule that rarely applies: " + x));
const once = (list) => Array.from(new Set(list.map((x) => x.replace(/ seed \d+/, ""))));
once(built.shadowed).forEach((x) => warn("templates", "shadowed by an earlier rule for some numbers: " + x));
once(built.sums).forEach((x) => bad("templates", "a sum in a message is not true: " + x));
once(built.numbers).forEach((x) => warn("templates", "names a number that is not in the question or the answers: " + x));

// ----- 5. the automatic hints -----
function probesOf(q) {
  const right = SL.numberPart(q.answer[0]);
  if (!right) return [];
  const n = right.value, nums = SL.numbersOf(q.prompt), out = new Set();
  const add = (v) => { if (Number.isFinite(v) && Math.abs(v - n) > 1e-9) out.add(String(Math.round(v * 1000) / 1000).replace(".", ",")); };
  [1, -1, 10, -10, 2].forEach((d) => add(n + d));
  add(-n); add(n * 10); add(n * 100); add(n / 10); add(n / 100); add(n * 2); add(n / 2);
  if (nums.length >= 2) { add(nums[0] + nums[1]); add(nums[0] - nums[1]); add(nums[0] * nums[1]); if (nums[1]) add(nums[0] / nums[1]); add(nums[0] * nums[1] / 100); }
  nums.forEach(add);
  return Array.from(out);
}
const autoQuestions = [];
lessons.forEach((lesson) => {
  [lesson.exercise].concat(lesson.wordProblems || [], (lesson.components || []).filter((c) => c && c.prompt && Array.isArray(c.answer))).forEach((q) => {
    if (q && q.prompt && Array.isArray(q.answer) && !/[{}]/.test(String(q.prompt))) autoQuestions.push({ where: lesson.id, lesson: lesson, prompt: String(q.prompt), answer: q.answer.map(String) });
  });
  PR.templates(lesson).forEach((t) => {
    for (let s = 1; s <= 4; s++) {
      const q = PR.generate(lesson, t.id, s * 7919);
      if (q && q.problem && q.problem.prompt && Array.isArray(q.problem.answer)) autoQuestions.push({ where: lesson.id + "/" + t.id, lesson: lesson, prompt: String(q.problem.prompt), answer: q.problem.answer.map(String) });
    }
  });
});
const ungroundedAuto = new Map();
let autoSaid = 0;
autoQuestions.forEach((q) => {
  const w = q.answer.map(SL.numberPart);
  if (!w.length || w.some((x) => !x)) return;
  probesOf(q).forEach((raw) => {
    const found = [["misconceptions", MC.diagnose(raw, q.prompt, q.answer)],
      ["symbolic", S.diagnoseMisconception(raw, q.answer[0], { prompt: q.prompt, explanation: q.lesson.explanation })],
      ["slips", SL.diagnose(raw, q.prompt, q.answer)]];
    found.forEach(([who, d]) => {
      if (!d) return;
      autoSaid++;
      const base = numbersIn(q.prompt).concat(answersAsNumbers(q.answer), numbersIn(raw), numbersIn(String(q.lesson.explanation || "")).slice(0, 0));
      const extra = ungroundedNumbers(d.explanation, base);
      falseSums(d.explanation).forEach((s) => bad(who, "a hint says a sum that is not true: \"" + s + "\" (" + d.title + ")"));
      if (extra.length) {
        const key = who + " | " + d.title + " | " + extra.join(",");
        if (!ungroundedAuto.has(key)) ungroundedAuto.set(key, q.where + ": \"" + q.prompt.slice(0, 70) + "\" answer " + raw + " -> " + d.explanation.slice(0, 160));
      }
    });
  });
});
ungroundedAuto.forEach((example, key) => bad("automatic hint", "names numbers that are not in the question, the answers or the answer given [" + key + "]: " + example));

console.log("feedback checked: " + checkedFixed + " fixed questions (" + checkedRules + " rules), " + templates + " templates with hints built " + builtProblems + " times, " + autoSaid + " automatic hints on " + autoQuestions.length + " questions");
if (warnings.length) {
  console.log(warnings.length + " warnings" + (showAll ? ":" : " (node tests/feedback-lint.js --all lists them)"));
  if (showAll) warnings.forEach((w) => console.log("  warn " + w));
}
if (errors.length) {
  console.log(errors.length + " errors:");
  errors.slice(0, 60).forEach((e) => console.log("  FAIL " + e));
  if (errors.length > 60) console.log("  ... " + (errors.length - 60) + " more");
  process.exit(1);
}
console.log("All feedback checks passed");
