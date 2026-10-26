"use strict";
// The placement test: a simulated student who knows every lesson up to a certain school year is placed there, with few
// questions, and the questions always come from the lesson being tried.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const P = require(ROOT + "placement.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const byId = new Map(lessons.map((l) => [l.id, l]));
const grade = (l) => L.effectiveGrade(l, lessons);

// a student who answers right when the lesson is at or below `level`
function simulate(level, startGrade, seed, skips) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const session = P.create({ lessons: lessons, grade: startGrade, rand: rand });
  let questions = 0, item;
  while ((item = session.next())) {
    questions += 1;
    ok(item.problem && item.problem.prompt, "a question has a prompt");
    ok(byId.get(item.lessonId), "the question belongs to a lesson");
    if (questions > 80) { ok(false, "the test never ends"); break; }
    const knows = grade(byId.get(item.lessonId)) <= level;
    session.answer(knows, !knows && skips);
  }
  return { questions: questions, result: session.result() };
}

[[3, 6], [5, 6], [7, 6], [9, 6], [10, 6], [5, 3], [8, 9]].forEach(([level, startGrade], i) => {
  const r = simulate(level, startGrade, 12345 + i * 7);
  const res = r.result;
  // lessons far below the level are known, lessons far above are not
  const wrongKnown = res.known.filter((id) => grade(byId.get(id)) > level + 1);
  const missed = lessons.filter((l) => !l.isParentLesson && grade(l) <= level - 2 && !res.known.includes(l.id) && !res.unknown.includes(l.id) === false);
  ok(wrongKnown.length === 0, "level " + level + ": lessons above the level counted as known: " + wrongKnown.join(", "));
  ok(r.questions <= 40, "level " + level + ": " + r.questions + " questions is too many");
  ok(res.start.every((id) => !res.known.includes(id)), "level " + level + ": a start lesson is already known");
  if (level >= 5) ok(res.known.length > 0, "level " + level + ": something is known");
  // the start lessons are right at the edge: everything they build on is known
  res.start.forEach((id) => (byId.get(id).prerequisites || []).forEach((p) => {
    ok(res.known.includes(p) || !byId.get(p) || byId.get(p).isParentLesson, "level " + level + ": " + id + " starts before its prerequisite " + p);
  }));
  console.log("  level " + level + " (starts at " + startGrade + "): " + r.questions + " questions, " + res.known.length + " known, start: " + res.start.slice(0, 2).join(", "));
});

// a student who knows nothing is told to start at the bottom, quickly
const none = simulate(0, 6, 99, true);
ok(none.questions <= 20, "a student who knows nothing is not asked " + none.questions + " questions");
ok(none.result.known.length === 0, "nothing is known by a student who knows nothing");
ok(none.result.start.length > 0 && none.result.start.every((id) => !(byId.get(id).prerequisites || []).length || (byId.get(id).prerequisites || []).every((p) => byId.get(p) && byId.get(p).isParentLesson)), "the start is a lesson without prerequisites");

// "Vet inte" settles a lesson at once, with one question
{
  const session = P.create({ lessons: lessons, grade: 6, rand: Math.random });
  const q = session.next();
  session.answer(false, true);
  const state = session.state();
  ok(state.probes === 1 && state.asked === 1, "a skipped question settles the lesson with one question");
  ok(q && session.next(), "the test goes on");
}

// the saved result is read back
const student = { lessonProgress: { placement: { known: ["a", "b"] } } };
ok(P.knownSet(student).has("a") && P.knownSet({}).size === 0, "the saved result is read back");

console.log(failures ? failures + " FAILED" : "All placement checks passed");
process.exit(failures ? 1 : 0);
