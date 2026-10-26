"use strict";
// The course against the syllabus: every lesson is mapped, every item of central content has a lesson, and what a
// student has covered is worked out right.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
const G = require(ROOT + "lgr22.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const real = lessons.filter((l) => !l.isParentLesson);
const ids = new Set(lessons.map((l) => l.id));

// ----- the lists -----
const itemIds = G.CONTENT.map((c) => c.id);
ok(new Set(itemIds).size === itemIds.length, "every item of central content has its own id");
ok(G.CONTENT.every((c) => G.STAGES.some((s) => s.id === c.stage) && G.AREAS.some((a) => a.id === c.area) && c.text.length > 10), "every item has a stage, an area and a text");
ok(G.STAGES.every((s) => G.AREAS.every((a) => G.CONTENT.some((c) => c.stage === s.id && c.area === a.id) || (a.id === "samband" && s.id === "1-3"))), "every stage has something in every area");
Object.keys(G.MAP).forEach((id) => {
  ok(ids.has(id), "the map names a lesson that does not exist: " + id);
  ok(G.MAP[id].length >= 1 && G.MAP[id].every((i) => G.item(i)), id + ": the map names an unknown item of content");
});
const unmapped = real.filter((l) => !G.MAP[l.id]).map((l) => l.id);
ok(!unmapped.length, "lessons that are not connected to the syllabus (add them to MAP in lgr22.js): " + unmapped.join(", "));
const empty = G.CONTENT.filter((c) => c.area !== "problem" && !G.lessonsOf(c.id, lessons).length).map((c) => c.id);
ok(!empty.length, "central content with no lesson at all: " + empty.join(", "));
// the stage of a lesson fits the stage of what it is connected to (at most one stage away)
const stageNo = (s) => ({ "1-3": 1, "4-6": 2, "7-9": 3 }[s]);
real.forEach((l) => (G.MAP[l.id] || []).forEach((i) => {
  const d = Math.abs(stageNo(G.item(i).stage) - stageNo(G.stageOfGrade(L.effectiveGrade(l, lessons))));
  ok(d <= 1, l.id + " (årskurs " + l.grade + ") is connected to " + i + " from another stage");
}));

// ----- what a student has covered -----
const done = (l) => ({ started: true, answers: Object.fromEntries(L.tasks(l).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) });
const all = { lessonProgress: Object.fromEntries(real.map((l) => [l.id, done(l)])), attempts: [] };
const none = { lessonProgress: {}, attempts: [] };
ok(G.coverage(all, lessons).every((c) => c.status === "klar"), "a student who finished everything has covered everything");
ok(G.coverage(none, lessons).every((c) => c.status === "ingen"), "a student who has done nothing has covered nothing");
const one = real.find((l) => G.MAP[l.id].length && G.lessonsOf(G.MAP[l.id][0], lessons).length > 1);
const part = { lessonProgress: { [one.id]: done(one) }, attempts: [] };
const cp = G.coverage(part, lessons).find((c) => c.item.id === G.MAP[one.id][0]);
ok(cp.status === "delvis" && cp.lessons.filter((e) => e.state === "complete").length === 1, "one of several lessons finished is 'delvis'");
const placed = { lessonProgress: { placement: { known: G.lessonsOf("t13-tal", lessons).map((l) => l.id) } }, attempts: [] };
ok(G.coverage(placed, lessons).find((c) => c.item.id === "t13-tal").status === "nivatest", "lessons found known by the placement test show as such");
const wp = real.filter((l) => L.tasks(l).some((t) => String(t.id).indexOf("word-") === 0)).slice(0, 8);
const some = { lessonProgress: Object.fromEntries(wp.map((l) => [l.id, done(l)])), attempts: [] };
const pc = G.coverage(some, lessons).filter((c) => c.item.area === "problem");
ok(pc.some((c) => c.solved > 0 && c.status !== "ingen"), "solved word problems count for problem solving: " + JSON.stringify(pc.map((c) => [c.item.id, c.solved, c.status])));
const cc = G.classCoverage([all, none, part], lessons).find((c) => c.item.id === G.MAP[one.id][0]);
ok(cc.counts.klar === 0 || cc.n === 3, "class coverage counts the students");
ok(G.classCoverage([all, none], lessons).every((c) => c.counts.klar === 1 && c.counts.ingen === 1 || c.item.area === "problem"), "class coverage counts one finished and one not");

// ----- abilities and totals -----
const ab = G.abilities(all, lessons);
ok(ab.begrepp.total > 0 && ab.metod.total > 0 && ab.problemlosning.total > 0 && ab.begrepp.solved === ab.begrepp.total, "abilities are counted in three groups");
const sm = G.summary({ lessonProgress: all.lessonProgress, attempts: [
  { lessonId: "addition", taskId: "exercise", completed: false, feedbackType: "hint", timestamp: "2026-02-01T10:00:00Z" },
  { lessonId: "addition", taskId: "exercise", completed: true, feedbackType: "correct", timestamp: "2026-02-03T10:00:00Z" }
] }, lessons);
ok(sm.lessonsFinished === real.length && sm.activeDays === 2 && sm.wrong === 1 && sm.firstAt.slice(0, 10) === "2026-02-01" && sm.lastAt.slice(0, 10) === "2026-02-03", "totals: " + JSON.stringify(sm));

// ----- CSV for Excel -----
ok(G.csv([["a", "b;c", 'd"e'], [1, null, "x\ny"]]) === 'a;"b;c";"d""e"\r\n1;;"x\ny"', "csv quotes what needs it");

console.log(failures ? failures + " FAILED" : "All syllabus checks passed (" + G.CONTENT.length + " items, " + Object.keys(G.MAP).length + " lessons)");
process.exit(failures ? 1 : 0);
