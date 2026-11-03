"use strict";
// Where the feedback has a gap (gaps.js and scripts/feedback-gaps.js): wrong answers that only got the general hint.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const G = require("../gaps.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL " + m); } };

const GENERIC = "Generellt beräkningsfel";
let n = 0;
const att = (lessonId, taskId, answer, misconception, extra) => Object.assign({
  id: "a" + (++n), lessonId: lessonId, lessonTitle: "Lektion " + lessonId, taskId: taskId, taskName: taskId === "exercise" ? "Din tur" : "Uppgift", prompt: "Vad är 6 · 9?", answer: answer,
  completed: false, feedbackType: "hint", misconception: misconception, correctAnswer: "54"
}, extra || {});

const students = [
  { id: 1, name: "Anna Hemlig", attempts: [att("mult", "exercise", "56", GENERIC), att("mult", "exercise", " 56 ", GENERIC), att("mult", "exercise", "45", GENERIC), att("mult", "exercise", "54", null, { feedbackType: "correct", completed: true })] },
  { id: 2, name: "Bo Hemlig", attempts: [att("mult", "exercise", "56", GENERIC), att("mult", "exercise", "63", "Lade ihop i stället för att multiplicera"), att("add", "exercise", "17", GENERIC, { prompt: "Vad är 8 + 9?", correctAnswer: "17", taskName: "Din tur" })] },
  { id: 3, name: "Cleo Hemlig", attempts: [
    att("mult", "practice-tabell-1a", "70", GENERIC, { prompt: "Vad är 7 · 9?", correctAnswer: "63" }), att("mult", "practice-tabell-2b", "80", GENERIC, { prompt: "Vad är 8 · 9?", correctAnswer: "72" }),
    att("mult", "practice-tabell-3c", "60", GENERIC, { prompt: "Vad är 5 · 9?", correctAnswer: "45" }), att("mult", "practice-tabell-4d", "10", GENERIC, { prompt: "Vad är 4 · 9?", correctAnswer: "36" }),
    att("mult", "exercise", "", GENERIC)] }
];
const gaps = G.collect(students);

const fixed = gaps.find((g) => g.lessonId === "mult" && g.fixed);
ok(fixed && fixed.count === 4 && fixed.students === 2, "a question of a lesson: four general hints from two students (" + JSON.stringify(fixed && [fixed.count, fixed.students]) + ")");
ok(fixed && fixed.answers[0].answer === "56" && fixed.answers[0].count === 3 && fixed.answers[1].answer === "45", "the answers are counted, most common first, and written the same way");
ok(!gaps.some((g) => g.answers.some((a) => a.answer === "63")), "an answer that got a hint of its own is no gap");
ok(!gaps.some((g) => g.answers.some((a) => a.answer === "54")), "and a right one neither");
ok(!gaps.some((g) => g.answers.some((a) => a.answer === "")), "an empty answer is not an answer");
const practice = gaps.find((g) => !g.fixed);
ok(practice && practice.task === "practice-tabell" && practice.count === 4 && practice.examples.length === 3, "the questions of Öva mer are one entry per template, with three examples");
ok(practice && practice.answers.length === 0, "and no answers counted (the next question has other numbers)");
ok(gaps[0] === fixed || gaps[0].count >= gaps[1].count, "the biggest gap first");
ok(gaps.every((g) => g.lessonTitle && g.name), "each has a lesson and a name");

ok(G.suggest(fixed) === '{ "answers": ["56", "45"], "message": "..." }', "a fixed question: the rule to write, with the answers: " + G.suggest(fixed));
ok(/practice/.test(G.suggest(practice)), "a template: told where to look");
const text = G.report(gaps);
ok(/Vad är 6 · 9\?/.test(text) && /Rätt svar: 54/.test(text) && /56 \(3\)/.test(text), "the report has the question, the right answer and the counts");
ok(!/Hemlig/.test(text), "and no names");
ok(/Inga felsvar saknar/.test(G.report([])), "nothing to write: it says so");

// the script reads the export of the teacher view
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaussica-gaps-"));
const file = path.join(dir, "elever.json");
fs.writeFileSync(file, JSON.stringify({ exportedAt: "2026-11-03", classes: [], students: students }));
const run = (extra) => spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "feedback-gaps.js"), file].concat(extra || []), { encoding: "utf8" });
let r = run();
ok(r.status === 0 && /Vad är 6 · 9\?/.test(r.stdout) && !/Hemlig/.test(r.stdout), "the script prints the list without names");
r = run(["--top", "1"]);
ok(r.status === 0 && (r.stdout.match(/^\d+\. /gm) || []).length === 1, "--top 1 prints one");
r = run(["--json"]);
ok(r.status === 0 && Array.isArray(JSON.parse(r.stdout)) && JSON.parse(r.stdout).length === gaps.length, "--json prints JSON");
const one = path.join(dir, "elev.json");
fs.writeFileSync(one, JSON.stringify({ attempts: students[0].attempts }));
r = spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "feedback-gaps.js"), one], { encoding: "utf8" });
ok(r.status === 0 && /56/.test(r.stdout), "the file of one student works too");
r = spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "feedback-gaps.js"), path.join(dir, "finns-inte.json")], { encoding: "utf8" });
ok(r.status === 1 && /Could not read/.test(r.stderr), "a missing file is told, not a crash");

console.log(failures ? "\n" + failures + " FAILED" : "All checks on feedback gaps passed");
process.exit(failures ? 1 : 0);
