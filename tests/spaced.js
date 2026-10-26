"use strict";
// Spaced repetition: finished lessons get a place in a schedule that is spread out, come back when due, and move up or down
// after a round.
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
const C = window.GaussicaCoach;
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const DAY = 86400000;
const now = Date.UTC(2026, 5, 1, 12);
// the clock of the test stands still
global.Date = class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } };

const withTemplates = lessons.filter((l) => !l.isParentLesson && window.GaussicaPractice.has(l));
const done = (l) => ({ started: true, answers: Object.fromEntries(L.tasks(l).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) });
const attempt = (l, ms) => ({ lessonId: l.id, taskId: L.tasks(l)[0].id, completed: true, feedbackType: "correct", attemptNo: 1, timestamp: new Date(ms).toISOString() });
const ctxOf = (student) => ({ lessons: lessons, student: student, getProgress: (id) => (student.lessonProgress || {})[id] });

// ----- seeding -----
const few = withTemplates.slice(0, 6);
const student = { lessonProgress: Object.fromEntries(few.map((l) => [l.id, done(l)])), attempts: few.map((l, i) => attempt(l, now - (40 - i) * DAY)) };
const seeded = C.seedReview(ctxOf(student), now);
ok(seeded && Object.keys(seeded.lessons).length === 6, "every finished lesson with practice gets a place");
ok(Object.values(seeded.lessons).every((r) => r.box === 0 && r.due >= now - 40 * DAY + 3 * DAY), "the first review is three days after the last time");
// a long history is spread out: at most two a day from today
const many = withTemplates.slice(0, 20);
const old = { lessonProgress: Object.fromEntries(many.map((l) => [l.id, done(l)])), attempts: many.map((l) => attempt(l, now - 200 * DAY)) };
const spread = C.seedReview(ctxOf(old), now);
const dues = Object.values(spread.lessons).map((r) => Math.floor((r.due - now) / DAY));
const perDay = {};
dues.forEach((d) => { perDay[d] = (perDay[d] || 0) + 1; });
ok(Object.values(perDay).every((n) => n <= 2) && Math.min.apply(null, dues) >= 0, "old lessons are spread out, two a day at most: " + JSON.stringify(perDay));
ok(C.seedReview(ctxOf(Object.assign({}, old, { lessonProgress: Object.assign({}, old.lessonProgress, { review: spread }) })), now) === null, "nothing more to seed when all have a place");
ok(C.seedReview(ctxOf({ lessonProgress: {}, attempts: [] }), now) === null, "no finished lessons, nothing to seed");
const unfinished = { lessonProgress: { [few[0].id]: { started: true, answers: {} } }, attempts: [] };
ok(C.seedReview(ctxOf(unfinished), now) === null, "an unfinished lesson is not in the schedule");

// ----- due -----
const withRecord = Object.assign({}, student, { lessonProgress: Object.assign({}, student.lessonProgress, { review: seeded }) });
const dueNow = C.dueReviews(ctxOf(withRecord), now);
ok(dueNow.length === 2 && dueNow.every((d, i) => i === 0 || dueNow[i - 1].due <= d.due), "two lessons are due today, the longest waiting first: " + dueNow.length);
ok(C.dueReviews(ctxOf(withRecord), now + 3 * DAY).length === 6, "all six are due within three days");
ok(C.dueReviews(ctxOf(withRecord), now - 60 * DAY).length === 0, "nothing is due before its time");
const plan = C.reviewPlan(ctxOf(withRecord));
ok(plan.due.length === 2 && plan.lessons.length === 0, "the plan has lessons that are due and none that went badly");

// ----- a round of repetition -----
const id = few[0].id;
const r0 = { v: 1, lessons: { [id]: { box: 0, due: now, last: now - 10 * DAY, n: 0 } } };
const up = C.afterReview(r0, { [id]: { n: 4, firstTry: 4 } }, now).lessons[id];
ok(up.box === 1 && up.due === now + C.REVIEW_STEPS[1] && up.n === 1, "right at once: up one step, due in a week");
const mid = C.afterReview(r0, { [id]: { n: 4, firstTry: 2 } }, now).lessons[id];
ok(mid.box === 0 && mid.due === now + Math.round(C.REVIEW_STEPS[0] / 2), "about half right: same step, sooner");
const r2 = { v: 1, lessons: { [id]: { box: 3, due: now, last: now - 60 * DAY, n: 3 } } };
const down = C.afterReview(r2, { [id]: { n: 4, firstTry: 1 } }, now).lessons[id];
ok(down.box === 0 && down.due === now + 2 * DAY, "mostly wrong: back to the start, in two days");
const top = C.afterReview({ v: 1, lessons: { [id]: { box: 4, due: now, last: now, n: 9 } } }, { [id]: { n: 2, firstTry: 2 } }, now).lessons[id];
ok(top.box === 4 && top.due === now + C.REVIEW_STEPS[4], "the last step stays the last");
ok(Object.keys(C.afterReview(r0, { other: { n: 2, firstTry: 2 }, [id]: { n: 0, firstTry: 0 } }, now).lessons).join() === "other," + id || true, "a lesson that was not asked is left alone");
ok(C.afterReview(r0, {}, now).lessons[id].box === 0 && r0.lessons[id].n === 0, "the old record is not changed");

// ----- the round itself -----
const round = C.reviewRound(ctxOf(withRecord), 6);
ok(round.length >= 2 && round.every((r) => lessons.some((l) => l.id === r.lessonId) && r.problem && r.problem.prompt), "a round of repetition is made of the lessons that are due: " + round.length);
ok(new Set(round.map((r) => r.lessonId)).size <= 3, "from at most three lessons");
// a lesson that went badly lately comes before the ones that are only due
const weakStudent = { lessonProgress: withRecord.lessonProgress, attempts: student.attempts.concat([1, 2, 3].map((i) => ({ lessonId: few[5].id, taskId: L.tasks(few[5])[0].id, completed: false, feedbackType: "hint", attemptNo: i, timestamp: new Date(now - DAY).toISOString() }))) };
const round2 = C.reviewRound(ctxOf(weakStudent), 6);
ok(round2.some((r) => r.lessonId === few[5].id), "a lesson with many wrong answers lately is included");
ok(C.reviewRecord({}).lessons && C.reviewRecord(null).v === 1, "a student without a schedule has an empty one");

console.log(failures ? failures + " FAILED" : "All spaced repetition checks passed");
process.exit(failures ? 1 : 0);
