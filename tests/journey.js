"use strict";
// Resan: the road through an area, the state of each stop, where the pet stands, and that every landscape can be drawn.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "placement.js");
const J = require(ROOT + "journey.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const doneProgress = (lesson) => ({ started: true, answers: Object.fromEntries(L.tasks(lesson).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) });
const startedProgress = (lesson) => { const t = L.tasks(lesson)[0]; return { started: true, answers: { [t.id]: { answer: "x", feedbackType: "correct", completed: true } } }; };
const ctxWith = (prog, placement) => ({ lessons, student: { lessonProgress: placement ? { placement } : {}, attempts: [] }, getProgress: (id) => prog[id] });

ok(J.AREAS.length === 5 && J.AREAS.every((a) => a.id && a.name && a.place), "five areas, each with a name and a place");
const areaIds = new Set(lessons.map((l) => l.area));
ok(J.AREAS.every((a) => areaIds.has(a.id)), "every area has lessons");

// ----- the road -----
J.AREAS.forEach((a) => {
  const p = J.plan(ctxWith({}), a.id);
  const expected = lessons.filter((l) => !l.isParentLesson && l.kind !== "pyssel" && l.area === a.id);
  ok(p.total === expected.length && p.stops.length === expected.length, a.id + ": one stop for every lesson (not chapter headings, not play lessons): " + p.total);
  ok(p.stops.every((s, i) => s.number === i + 1 && (i === 0 || s.grade >= p.stops[i - 1].grade)), a.id + ": numbered in order of the course, easiest first");
  ok(p.stops.every((s) => s.state === "todo") && p.current === 0 && p.done === 0 && !p.allDone, a.id + ": a new student stands at the first stop");
});
ok(J.plan(ctxWith({}), "ingenting").area.id === "tal", "an unknown area becomes the first one");

// ----- states, and where the pet stands -----
const tal = J.plan(ctxWith({}), "tal").stops.map((s) => s.lesson);
let prog = { [tal[0].id]: doneProgress(tal[0]), [tal[1].id]: doneProgress(tal[1]), [tal[2].id]: startedProgress(tal[2]) };
let p = J.plan(ctxWith(prog), "tal");
ok(p.stops[0].state === "done" && p.stops[1].state === "done" && p.stops[2].state === "going" && p.stops[3].state === "todo" && p.done === 2, "done, going and todo: " + p.stops.slice(0, 4).map((s) => s.state));
ok(p.current === 2, "the pet stands at the lesson that is begun");
prog = { [tal[0].id]: doneProgress(tal[0]), [tal[1].id]: doneProgress(tal[1]) };
p = J.plan(ctxWith(prog), "tal");
ok(p.current === 2, "or at the first lesson that is not done");
p = J.plan(ctxWith(prog), "tal", tal[5].id);
ok(p.current === 5, "or where the path says to go now (an assignment, for example)");
p = J.plan(ctxWith(prog), "tal", "finns-inte");
ok(p.current === 2, "an unknown lesson is ignored");
p = J.plan(ctxWith(prog, { known: [tal[3].id, tal[4].id], at: "2026-01-01", start: [] }), "tal");
ok(p.stops[3].state === "known" && p.stops[4].state === "known" && p.stops[2].state === "todo", "what the level test found shows as known");
const all = {};
lessons.filter((l) => !l.isParentLesson).forEach((l) => { all[l.id] = doneProgress(l); });
p = J.plan(ctxWith(all), "geometri");
ok(p.allDone && p.current === null && p.done === p.total, "all done: the road is walked, and nobody is left standing at a stop");

// ----- stages of eight -----
const big = J.plan(ctxWith({}), "tal");
ok(J.stageCount(big) === Math.ceil(big.total / 8) && J.stage(big, 0).length === 8 && J.stage(big, J.stageCount(big) - 1).length === big.total - 8 * (J.stageCount(big) - 1), "the road is cut into stages of eight");
ok(J.stageOf(0) === 0 && J.stageOf(7) === 0 && J.stageOf(8) === 1 && J.stageOf(17) === 2, "which stage a stop is in");
ok(J.stageCount({ stops: [] }) === 1, "an empty road has one (empty) stage");

// ----- drawing -----
const finite = (s) => !/NaN|undefined|Infinity|null/.test(s);
J.AREAS.forEach((a) => {
  const p0 = J.plan(ctxWith({}), a.id);
  const states = ["done", "going", "known", "todo"];
  for (let n = 1; n <= 8; n++) {
    const stops = p0.stops.slice(0, n).map((s, i) => Object.assign({}, s, { state: states[i % 4] }));
    [{ current: 0, selected: 0, first: true }, { current: n - 1, last: true, allDone: true, pet: "<svg class=\"pet\"></svg>" }, { current: -1 }].forEach((o) => {
      const svg = J.sceneSvg(a, stops, o);
      ok(/^<svg[\s\S]*<\/svg>$/.test(svg) && finite(svg), a.id + " / " + n + " stops: clean markup");
      ok((svg.match(/class="jn-stop /g) || []).length === n, a.id + " / " + n + " stops: a button for every stop");
    });
  }
  const svg = J.sceneSvg(a, p0.stops.slice(0, 8), { current: 2, first: true });
  ok(/<title|aria-label="[^"]*Stopp 1:/.test(svg) && !/[<>]\s*"[^"]*<b>/.test(svg), a.id + ": every stop can be read by a screen reader");
});
ok(J.points(1)[0].x === 360 && J.points(8).length === 8 && J.points(8).every((q) => q.x >= 60 && q.x <= 660 && q.y > 130 && q.y < 230), "the stops lie on the road inside the picture");
ok(J.points(8).every((q, i, a) => i === 0 || q.x > a[i - 1].x), "from left to right");
const titled = { id: "x", title: "<b>Farlig</b> & \"citat\"", area: "tal" };
ok(!/<b>/.test(J.sceneSvg(J.AREAS[0], [{ lesson: titled, number: 1, state: "todo", grade: 3 }], { current: 0 })), "a lesson title cannot break the picture");

console.log(failures ? failures + " FAILED" : "All journey checks passed");
process.exit(failures ? 1 : 0);
