"use strict";
// Mina knepiga: which questions count as tricky, when they are put away, and the round of new questions to practise.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const N = require(ROOT + "notebook.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const lesson = { id: "add", title: "Addition", practice: [
  { id: "med", for: ["exercise"], vars: { a: [11, 99], b: [11, 99] }, derive: [{ name: "s", expr: "a+b" }], prompt: "Räkna ut {a} + {b}.", answer: ["=s"], correct: "Rätt!", steps: ["Lägg ihop entalen.", "{a} + {b} = {s}"] },
  { id: "ord", for: ["word-0"], vars: { a: [2, 9] }, prompt: "Kim har {a} äpplen. Vad är {a}?", answer: ["=a"], correct: "Rätt!" }
] };
const plain = { id: "geo", title: "Former", practice: [] };
const lessons = [lesson, plain];

const T0 = Date.UTC(2026, 5, 1, 9);
let clock = 0;
const at = () => new Date(T0 + (clock += 60000)).toISOString();
const att = (lessonId, taskId, correct, extra) => Object.assign({ lessonId, taskId, completed: correct, feedbackType: correct ? "correct" : "hint", answer: correct ? "ok" : "fel", prompt: "Fråga " + taskId, correctAnswer: "rätt", timestamp: at() }, extra || {});
const student = (attempts, hidden) => ({ attempts, lessonProgress: hidden ? { notebook: { v: 1, hidden } } : {} });
const ctxOf = (attempts, hidden) => ({ lessons, student: student(attempts, hidden) });

// ----- what counts -----
let e = N.entries(ctxOf([att("add", "exercise", true), att("add", "word-0", true)]));
ok(!e.open.length && !e.mastered.length, "questions solved at the first try are not tricky");
e = N.entries(ctxOf([]));
ok(!e.open.length && e.total === 0, "an empty log gives an empty notebook");

let log = [att("add", "exercise", false, { answer: "5" }), att("add", "exercise", false, { answer: "6" }), att("add", "exercise", true, { answer: "7" })];
e = N.entries(ctxOf(log));
ok(e.open.length === 1 && e.open[0].key === "add|t:med" && e.open[0].template === "med" && e.open[0].canRetry, "a question that went wrong before it was solved is tricky, grouped by its practice template: " + JSON.stringify(e.open[0] && e.open[0].key));
ok(e.open[0].dirty === 1 && e.open[0].answers.join() === "5,6" && e.open[0].correct === "rätt" && e.open[0].prompt === "Fråga exercise" && e.open[0].lessonTitle === "Addition", "it keeps the prompt, the wrong answers and the right answer");
ok(e.open[0].clean === 0 && e.open[0].need === 2, "nothing is put away yet");

// a question never solved
log = [att("add", "word-0", false), att("add", "word-0", false)];
e = N.entries(ctxOf(log));
ok(e.open.length === 1 && e.open[0].template === "ord" && e.open[0].dirty === 1, "a question that was never solved is tricky too");

// a question without a template cannot be practised with new numbers
e = N.entries(ctxOf([att("geo", "figur", false)]));
ok(e.open.length === 1 && !e.open[0].canRetry && e.open[0].key === "geo|q:figur", "a question without a practice template is listed, but cannot be retried");
ok(N.retryRound(ctxOf([att("geo", "figur", false)]), 5).length === 0, "and gives no practice round");

// putting a question away: two in a row at the first try, with new generated questions
const wrongOnce = [att("add", "exercise", false), att("add", "exercise", true)];
let seeds = 0;
const variant = (correct) => att("add", "practice-med-" + (++seeds + 100).toString(36), correct);
e = N.entries(ctxOf(wrongOnce.concat([variant(true)])));
ok(e.open.length === 1 && e.open[0].clean === 1 && !e.mastered.length, "one clean solve is not enough");
e = N.entries(ctxOf(wrongOnce.concat([variant(true), variant(true)])));
ok(!e.open.length && e.mastered.length === 1 && e.mastered[0].key === "add|t:med", "two clean solves in a row put the question away, into the list of what is known");
e = N.entries(ctxOf(wrongOnce.concat([variant(true), variant(false), variant(true)])));
ok(e.open.length === 1 && e.open[0].clean === 1 && e.open[0].dirty === 2, "a slip in between starts the count again, and the question is tricky twice");
e = N.entries(ctxOf(wrongOnce.concat([variant(true), variant(true), variant(false)])));
ok(e.open.length === 1 && e.open[0].clean === 0, "a question that was known and goes wrong again comes back");
// a clean solve of the lesson question itself (second round of the same task) counts too
e = N.entries(ctxOf([att("add", "exercise", false), att("add", "exercise", true), att("add", "exercise", true), att("add", "exercise", true)]));
ok(e.mastered.length === 1, "solving the same question again at the first try counts as well");

// practice questions (generated) group with the lesson question they mirror
e = N.entries(ctxOf([att("add", "practice-med-5", false), att("add", "practice-med-5", true), att("add", "exercise", false), att("add", "exercise", true)]));
ok(e.open.length === 1 && e.open[0].dirty === 2, "generated questions and the lesson question of the same kind belong together");
e = N.entries(ctxOf([att("add", "practice-med-5", false), att("add", "word-0", false)]));
ok(e.open.length === 2, "other kinds of questions are listed separately");

// order: the latest first
e = N.entries(ctxOf([att("add", "word-0", false), att("add", "exercise", false)]));
ok(e.open[0].template === "med", "the most recent tricky question comes first");

// ----- "Jag kan det här" -----
const trickyLog = [att("add", "exercise", false), att("add", "exercise", true)];
const key = N.entries(ctxOf(trickyLog)).open[0].key;
const rec = N.hide(N.recordOf(student([])), key, Date.now() + 10 * 86400000);
e = N.entries(ctxOf(trickyLog, rec.hidden));
ok(!e.open.length && e.hidden === 1, "a question put away by the student leaves the list (and is counted)");
e = N.entries(ctxOf(trickyLog.concat([att("add", "exercise", false)]), { [key]: T0 + 30000 }));
ok(e.open.length === 1 && e.hidden === 0, "it comes back if it goes wrong again afterwards");
ok(N.recordOf(null).hidden && N.recordOf({}).hidden && N.recordOf({ lessonProgress: { notebook: "x" } }).v === 1, "odd records are handled");
ok(Object.keys(N.hide(rec, "x|t:y", 5).hidden).length === 2 && !rec.hidden["x|t:y"], "hiding does not change the old record");

// questions from lessons that do not exist any more are ignored
e = N.entries({ lessons: [plain], student: student([att("add", "exercise", false)]) });
ok(!e.open.length, "answers to unknown lessons are ignored");
// drafts (not submitted) are not counted
e = N.entries(ctxOf([{ lessonId: "add", taskId: "exercise", completed: false, feedbackType: "", answer: "1", timestamp: at() }]));
ok(!e.open.length, "typing drafts are not answers");

// ----- the practice round -----
const tricky = ctxOf([att("add", "exercise", false), att("add", "exercise", true), att("add", "word-0", false)]);
const round = N.retryRound(tricky, 5);
ok(round.length >= 2 && round.length <= 4, "a round has questions from the tricky kinds (" + round.length + ")");
ok(round.every((it) => it.lessonId === "add" && /^practice-(med|ord)-/.test(it.taskId) && it.problem && it.problem.prompt && ["med", "ord"].includes(it.templateId)), "every question is a generated one of a tricky kind");
ok(new Set(round.map((it) => it.problem.prompt)).size === round.length, "no question is repeated in a round");
ok(round.some((it) => it.templateId === "med") && round.some((it) => it.templateId === "ord"), "all the kinds come up");
ok(!round.some((it) => it.problem.prompt === "Fråga exercise"), "the question that went wrong is not asked again as it was");
ok(N.retryRound(ctxOf([]), 5).length === 0, "nothing tricky, nothing to practise");
ok(N.retryRound(ctxOf(trickyLog), 50).length <= 2, "a round is never longer than twice the number of tricky kinds");

// ----- real lessons: the keys and the templates exist -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const real = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const withPractice = real.filter((l) => window.GaussicaPractice.has(l));
ok(withPractice.length >= 10, "there are lessons with practice templates (" + withPractice.length + ")");
const lp = withPractice[0];
const tpl = window.GaussicaPractice.templates(lp)[0];
const fakeLog = [att(lp.id, "practice-" + tpl.id + "-abc", false)];
const re = N.entries({ lessons: real, student: student(fakeLog) });
ok(re.open.length === 1 && re.open[0].canRetry && N.retryRound({ lessons: real, student: student(fakeLog) }, 3).length >= 1, "a wrong generated question in a real lesson can be practised again");

console.log(failures ? failures + " FAILED" : "All notebook checks passed");
process.exit(failures ? 1 : 0);
