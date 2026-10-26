"use strict";
// The class heatmap: every kind of square is found from the data, and "who needs me today" gives the right reasons.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "placement.js");
require(ROOT + "coach.js");
const H = require(ROOT + "heatmap.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const course = { lessons: lessons, areas: idx.areas };
const lesson = lessons.find((l) => l.id === "addition");
const tasks = L.tasks(lesson);
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

function answers(done) {
  const out = {};
  tasks.forEach((t, i) => { if (i < done) out[t.id] = { answer: "x", feedbackType: "correct", completed: true }; });
  return out;
}
function wrong(n, ms) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ lessonId: "addition", taskId: tasks[0].id, completed: false, feedbackType: "hint", attemptNo: i + 1, timestamp: iso(ms) });
  return out;
}
const mk = (id, name, progress, attempts, extra) => Object.assign({ id: id, name: name, classId: 1, lessonProgress: progress, attempts: attempts || [], chat: [] }, extra || {});

const students = [
  mk("1", "Strong", { addition: { started: true, answers: answers(tasks.length), updatedAt: now } }),
  mk("2", "Shaky", { addition: { started: true, answers: answers(tasks.length), updatedAt: now } }, wrong(2, now - 1000)),
  mk("3", "Going", { addition: { started: true, answers: answers(1), updatedAt: now } }),
  mk("4", "Stuck", { addition: { started: true, answers: { [tasks[0].id]: { answer: "9", feedbackType: "hint", completed: false } }, updatedAt: now } }, wrong(4, now - 1000)),
  mk("5", "Known", { placement: { known: ["addition"], unknown: [], start: [], level: 3 } }),
  mk("6", "None", {})
];
const data = H.cells(course, students);
const cell = data.find((c) => c.lesson.id === "addition");
const kinds = cell.states.map((s) => s.kind);
ok(JSON.stringify(kinds) === JSON.stringify(["strong", "shaky", "going", "stuck", "known", "none"]), "the squares: " + kinds.join(", "));
ok(data.every((c, i) => i === 0 || data[i - 1].grade <= c.grade), "the lessons are in school year order");
ok(data.every((c) => !c.lesson.isParentLesson), "chapter headings are left out");

// who needs me today
const ctx = { course: course, assignments: [] };
const more = students.concat([
  mk("7", "Asker", {}, [], { chat: [{ fromTeacher: false, read: false, text: "hjälp" }] }),
  mk("8", "Idle", { addition: { started: true, answers: answers(1), updatedAt: now - 30 * 86400000 } }, [{ lessonId: "addition", taskId: tasks[0].id, completed: true, feedbackType: "correct", attemptNo: 1, timestamp: iso(now - 30 * 86400000) }])
]);
global.window.GaussicaMailbox = { practiceSummary: () => ({ state: "new" }), practiceCount: () => 0 };
const list = H.attention(ctx, more, []);
const byName = Object.fromEntries(list.map((x) => [x.student.name, x.reasons.map((r) => r.kind)]));
ok(byName.Stuck && byName.Stuck[0] === "stuck", "a student with many wrong answers lately is stuck: " + JSON.stringify(byName));
ok(byName.Asker && byName.Asker.includes("chat"), "an unanswered question is a reason");
ok(byName.Idle && byName.Idle.includes("idle"), "a student who has been away for a month is idle");
ok(!byName.Strong && !byName.None, "students without a reason are not listed");
ok(list[0].student.name === "Stuck", "stuck comes first: " + list.map((x) => x.student.name).join(", "));

console.log(failures ? failures + " FAILED" : "All heatmap checks passed");
process.exit(failures ? 1 : 0);
