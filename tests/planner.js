"use strict";
// Planera efter mål: the goals with lessons, how the class is doing, the proposal for a goal and the assignments it creates.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lgr22.js");
const P = require(ROOT + "planner.js");
const G = window.GaussicaLgr22;
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const done = (lesson) => ({ started: true, answers: Object.fromEntries(L.tasks(lesson).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) });
const part = (lesson) => { const t = L.tasks(lesson)[0]; return { started: true, answers: { [t.id]: { answer: "x", feedbackType: "correct", completed: true } } }; };
const student = (id, prog) => ({ id: String(id), name: "Elev " + id, classId: 1, lessonProgress: prog || {}, attempts: [] });

// ----- the goals -----
const none = [student(1), student(2), student(3)];
const all = P.goals(none, lessons, {});
ok(all.length >= 25 && all.every((c) => c.lessons > 0 && c.item.area !== "problem"), "only goals with lessons, and not the problem solving ones: " + all.length);
ok(P.goals(none, lessons, { stage: "4-6" }).every((c) => c.item.stage === "4-6") && P.goals(none, lessons, { stage: "4-6" }).length < all.length, "a stage can be chosen");
ok(P.goals([], lessons, {}).length === all.length, "a class without students still gets goals");

// the goal where most are behind comes first when sorted by need
const target = all.find((c) => c.item.stage === "4-6");
const lessonsOfTarget = G.lessonsOf(target.item.id, lessons);
const prog = {};
lessonsOfTarget.forEach((l) => { prog[l.id] = done(l); });
const withProgress = [student(1, prog), student(2, prog), student(3, prog)];
const byNeed = P.goals(withProgress, lessons, { sort: "behov" });
ok(byNeed.length === all.length && byNeed[0].item.id !== target.item.id && byNeed[byNeed.length - 1].counts.klar >= byNeed[0].counts.klar, "sorted by need: the goals everyone has reached come last");
ok(byNeed[byNeed.length - 1].counts.klar === 3 || byNeed.some((c) => c.item.id === target.item.id && c.counts.klar === 3), "the coverage of the class is counted");

// ----- the proposal -----
let plan = P.proposal(target.item.id, none, lessons, [], 1);
ok(plan && plan.goal.id === target.item.id && plan.lessons.length === lessonsOfTarget.filter((l) => l.kind !== "pyssel").length, "the lessons of the goal (not play lessons): " + (plan && plan.lessons.length));
ok(plan.lessons.every((x, i) => i === 0 || x.grade >= plan.lessons[i - 1].grade), "easiest first");
ok(plan.lessons.every((x) => x.pick && x.n === 3 && x.counts.none === 3 && !x.everyone && !x.already) && plan.picked === plan.lessons.length, "a class that has done nothing: everything is proposed");
plan = P.proposal(target.item.id, withProgress, lessons, [], 1);
ok(plan.lessons.every((x) => x.everyone && !x.pick) && plan.picked === 0, "lessons that everyone has finished are not proposed");
const first = lessonsOfTarget.filter((l) => l.kind !== "pyssel")[0];
const mixed = [student(1, { [first.id]: done(first) }), student(2, { [first.id]: part(first) }), student(3)];
plan = P.proposal(target.item.id, mixed, lessons, [], 1);
const row = plan.lessons.find((x) => x.lesson.id === first.id);
ok(row.counts.done === 1 && row.counts.going === 1 && row.counts.none === 1 && row.pick, "done, begun and not begun are counted per lesson");
// a lesson that already is an assignment for the whole class is left out, an assignment for one student or another class is not
plan = P.proposal(target.item.id, none, lessons, [{ classId: 1, studentId: null, lessonId: first.id, kind: "lesson" }], 1);
ok(plan.lessons.find((x) => x.lesson.id === first.id).already && !plan.lessons.find((x) => x.lesson.id === first.id).pick, "a lesson that is already an assignment for the class is left out");
plan = P.proposal(target.item.id, none, lessons, [{ classId: 1, studentId: "7", lessonId: first.id, kind: "lesson" }, { classId: 2, studentId: null, lessonId: first.id, kind: "lesson" }, { classId: 1, studentId: null, lessonId: first.id, kind: "prov" }], 1);
ok(!plan.lessons.find((x) => x.lesson.id === first.id).already, "an assignment for one student, for another class or a prov does not count");
ok(P.proposal("finns-inte", none, lessons, [], 1) === null, "an unknown goal gives no proposal");
ok(plan.lessons.every((x) => typeof x.hasPractice === "boolean"), "it is known which lessons have practice questions");

// ----- the requests -----
plan = P.proposal(target.item.id, none, lessons, [], 1);
const ids = plan.lessons.slice(0, 3).map((x) => x.lesson.id);
let reqs = P.requests(plan, { classId: "1", ids: ids, prov: null, note: "Vi övar!", dueDate: "2026-11-20" });
ok(reqs.length === ids.length && reqs.every((r, i) => r.kind === "lesson" && r.lessonId === ids[i] && r.classId === 1 && r.studentId === null && r.note === "Vi övar!" && r.dueDate === "2026-11-20"), "one assignment for each lesson, to the whole class");
reqs = P.requests(plan, { classId: 1, ids: ids, prov: { perLesson: "4", minutes: 15 }, note: "", dueDate: "" });
const prov = reqs[reqs.length - 1];
const withPractice = ids.filter((id) => plan.lessons.find((x) => x.lesson.id === id).hasPractice);
ok(prov.kind === "prov" && prov.config.perLesson === 4 && prov.config.minutes === 15 && prov.config.showResult === true && prov.config.lessons.join() === withPractice.join() && prov.lessonId === withPractice[0], "a prov over the lessons that have practice questions");
ok(reqs.length === ids.length + (withPractice.length ? 1 : 0), "the prov comes after the assignments");
ok(/^Prov: /.test(prov.config.title) && prov.config.title.length <= 66, "the prov is named after the goal");
const noPractice = { goal: plan.goal, lessons: [{ lesson: { id: "x" }, hasPractice: false }] };
ok(P.requests(noPractice, { classId: 1, ids: ["x"], prov: { perLesson: 3 } }).every((r) => r.kind === "lesson"), "no prov when no lesson has practice questions");
ok(P.requests(plan, { classId: 1, ids: ids.concat(ids), prov: null }).length === ids.length, "a lesson is not given twice");
const manyPlan = { goal: plan.goal, lessons: [] };
ok(P.requests(manyPlan, { classId: 1, ids: Array.from({ length: 30 }, (_, i) => "l" + i) }).length === P.MAX_LESSONS, "no more than " + P.MAX_LESSONS + " at once");
ok(P.requests(plan, { classId: 1, ids: ids, note: "x".repeat(900) })[0].note.length === 400, "the note is cut at 400 characters");
ok(P.requests(plan, { classId: 1, ids: [] }).length === 0, "nothing chosen, nothing created");

// every goal gives a usable proposal
let usable = 0;
all.forEach((c) => { const pl = P.proposal(c.item.id, none, lessons, [], 1); if (pl && pl.lessons.length) usable += 1; });
ok(usable === all.length, "every goal that is shown has lessons to propose");

console.log(failures ? failures + " FAILED" : "All planner checks passed");
process.exit(failures ? 1 : 0);
