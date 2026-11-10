"use strict";
// Provträning: the three sets only name lessons that exist, give a full test with new numbers every round, and the rounds and the results are read back
// from the progress of a student.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const P = require(ROOT + "prov.js");
const T = require(ROOT + "provtraining.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const byId = new Map(lessons.map((l) => [l.id, l]));

ok(T.SETS.map((s) => s.id).join() === "ak3,ak6,ak9", "there are sets for åk 3, 6 and 9");
T.SETS.forEach((s) => {
  const missing = s.lessons.filter((id) => !byId.has(id) || byId.get(id).isParentLesson || byId.get(id).kind);
  ok(!missing.length && new Set(s.lessons).size === s.lessons.length, s.id + ": every lesson exists, is an ordinary lesson and is there once" + (missing.length ? " (" + missing.join(", ") + ")" : ""));
  const maxGrade = Math.max.apply(null, s.lessons.map((id) => Number(byId.get(id).grade)));
  ok(maxGrade <= s.grade + 2, s.id + ": no lesson is much higher than the year (highest åk " + maxGrade + ")");
  const a = T.assignment(s.id, 1), b = T.assignment(s.id, 2);
  const items1 = P.items(a.config, lessons, a.id + ":7"), items1again = P.items(a.config, lessons, a.id + ":7"), items2 = P.items(b.config, lessons, b.id + ":7");
  ok(items1.length >= s.lessons.length - 2 && items1.length <= s.lessons.length * s.perLesson, s.id + ": a full test of " + items1.length + " questions");
  ok(JSON.stringify(items1.map((i) => i.problem.prompt)) === JSON.stringify(items1again.map((i) => i.problem.prompt)), s.id + ": the same round gives the same questions");
  const same = items1.filter((i, n) => items2[n] && i.problem.prompt === items2[n].problem.prompt).length;
  ok(same < items1.length * 0.6, s.id + ": another round has other numbers (" + same + " of " + items1.length + " are the same)");
  ok(items1.every((i) => i.problem.prompt && !/[{}]/.test(i.problem.prompt)), s.id + ": no question is broken");
});

// rounds and results
const rec = (finished, score, total) => ({ v: 1, assignmentId: "x", title: "t", startedAt: 1, minutes: 60, total: total, answers: new Array(total).fill({ correct: false }), finishedAt: finished, score: score });
const now = Date.parse("2026-12-10T12:00:00Z");
const student = { lessonProgress: {} };
ok(T.state(student, "ak6").round === 1 && T.state(student, "ak6").status === "new", "a student who has not started gets round 1");
student.lessonProgress["prov-tr-ak6-1"] = rec(null, 0, 28);
ok(T.state(student, "ak6").round === 1 && T.state(student, "ak6").status === "started", "a round in progress is the one to continue");
student.lessonProgress["prov-tr-ak6-1"] = rec("2026-12-09T10:00:00Z", 21, 28);
ok(T.state(student, "ak6").round === 2 && T.state(student, "ak6").status === "new" && T.state(student, "ak6").done.length === 1, "when it is finished the next round is a new one");
ok(T.state(student, "ak3").round === 1, "the sets do not mix");
const f = T.finished(student, now);
ok(f.length === 1 && f[0].name === "Åk 6" && f[0].score === 21 && f[0].total === 28, "what was finished in the last seven days is told to the adult");
ok(T.finished(student, Date.parse("2026-12-30T00:00:00Z")).length === 0, "and an old result is not");
ok(T.assignment("nej", 1) === null, "a set that does not exist gives nothing");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All checks on Provträning passed");
