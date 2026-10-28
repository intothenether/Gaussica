"use strict";
// The suggested lesson tells which year it is placed at, and how that compares to the student's own year, so that a big step up
// never comes as a surprise.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";

// a small page to draw on
function fake(tag) {
  const e = {
    tag: tag, children: [], style: {}, className: "", textContent: "", attrs: {}, listeners: {},
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(typeof x === "string" ? { text: x, children: [] } : x)); },
    replaceChildren() { e.children = []; }, setAttribute(k, v) { e.attrs[k] = v; }, addEventListener(t, fn) { e.listeners[t] = fn; }
  };
  return e;
}
global.window = {};
global.document = { createElement: fake, createTextNode: (t) => ({ text: t, children: [] }) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "placement.js");
require(ROOT + "coach.js");
require(ROOT + "path-view.js");
const C = window.GaussicaCoach;
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const done = (l) => ({ started: true, answers: Object.fromEntries(L.tasks(l).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) });
const ctxOf = (student) => ({ lessons: lessons, student: student, getProgress: (id) => (student.lessonProgress || {})[id] });
const text = (n) => (n.text || n.textContent || "") + (n.children || []).map(text).join("");
const find = (n, cls) => (String(n.className || "").split(/\s+/).includes(cls) ? [n] : []).concat(...(n.children || []).map((c) => find(c, cls)));

// a student with nothing done: no level, so no comparison
const none = C.path(ctxOf({ lessonProgress: {}, attempts: [] }));
ok(none.now && none.now.gap === null && none.now.level === null, "a new student has no level to compare with");

// a student who has finished lessons from åk 3 and 4
const easy = lessons.filter((l) => !l.isParentLesson && l.kind !== "pyssel" && L.effectiveGrade(l, lessons) <= 4 && (l.prerequisites || []).length === 0).slice(0, 4);
ok(easy.length === 4, "there are four easy lessons to finish");
const student = { lessonProgress: Object.fromEntries(easy.map((l) => [l.id, done(l)])), attempts: [] };
const level = C.levelOf(ctxOf(student));
ok(level >= 3 && level <= 4, "the level comes from the finished lessons: " + level);
const p = C.path(ctxOf(student));
ok(p.now && p.now.level === level && p.now.gap === p.now.grade - level, "every step has the level and the gap to it");

// too little to go on
ok(C.levelOf(ctxOf({ lessonProgress: { [easy[0].id]: done(easy[0]) }, attempts: [] })) === null, "one finished lesson is too little to tell a level");

// the placement test counts: a student who knows up to åk 7 is at åk 7
const placed = { lessonProgress: { placement: { v: 1, grade: 7, level: 7, known: easy.map((l) => l.id), unknown: [], start: [], at: "2026-03-01T10:00:00Z" } }, attempts: [] };
ok(C.levelOf(ctxOf(placed)) >= 7, "what the placement test found is the level");

// drawing it
const view = window.GaussicaPathView;
const item = (gap, level, grade) => ({ role: "now", kind: "start", lesson: lessons[0], sum: { total: 4, done: 0, fix: 0, statuses: ["todo", "todo", "todo", "todo"] }, grade: grade, level: level, gap: gap });
const draw = (it) => { const box = fake("div"); view.heroStep(box, { now: it, later: [] }, { start() {}, assignment: null }); return box; };

const high = draw(item(3, 5, 8));
ok(text(high).includes("ÅK 8") && find(high, "pv-grade").length === 1 && find(high, "pv-grade")[0].className.includes("is-high"), "the year is a clear chip, marked when it is far up");
ok(/tre år över din nivå/.test(text(high)) && /åk 5/.test(text(high)), "and says how far above, and the student's own year");
const up = draw(item(1, 5, 6));
ok(/Ett steg över din nivå/.test(text(up)) && find(up, "pv-grade")[0].className.includes("is-up"), "one year up is mentioned calmly");
const same = draw(item(0, 5, 5));
ok(find(same, "hs-level").length === 0 && find(same, "pv-grade").length === 1, "at the student's own level there is only the chip");
const unknown = draw(item(null, null, 5));
ok(find(unknown, "hs-level").length === 0 && /ÅK 5/.test(text(unknown)), "without a level there is only the chip");
const gym = draw(item(4, 6, 10));
ok(/GYMNASIET/.test(text(gym)) && /flera år/.test(text(gym)), "gymnasium is shown as such");

// the cards of the path
const list = fake("div");
view.render(list, { now: item(2, 5, 7), later: [item(0, 5, 5)], play: null, doneCount: 3, total: 10, allDone: false }, { start() {}, more() {}, assignment: null });
ok(find(list, "pv-grade").length === 2 && /två år över din nivå/.test(text(list)), "the cards of the path show the year too");

console.log(failures ? failures + " FAILED" : "All path-level checks passed");
process.exit(failures ? 1 : 0);
