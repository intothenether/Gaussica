"use strict";
// The teacher's line about a student's pet: coins worked out from the student's data, and the gifts with their reasons.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pet-art.js");
const Pet = require(ROOT + "pet.js");
require(ROOT + "rewards.js");
require(ROOT + "pet-teacher.js");
const T = window.GaussicaPetTeacher;
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const ctx = { course: { lessons: lessons }, classes: [] };

const lesson = lessons.find((l) => l.id === "addition");
const done = { started: true, answers: Object.fromEntries(L.tasks(lesson).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) };
const pet = Pet.makePet("cat", "gra", "Luna");
pet.owned = { "hatt-keps": 15 };
const student = {
  lessonProgress: { pet: pet, addition: done }, attempts: [],
  feedback: [
    { sticker: "mynt10", text: "Fin insats", createdAt: "2026-02-01T10:00:00Z" },
    { sticker: "mynt25", text: "Du gav inte upp", createdAt: "2026-03-01T10:00:00Z" },
    { sticker: "star", text: "Bra", createdAt: "2026-03-02T10:00:00Z" }
  ]
};
const i = T.info(student, ctx);
// welcome 20 + one finished lesson (10 + 4 for three stars) + gifts 35
ok(i && i.total === 20 + 14 + 35 && i.spent === 15 && i.balance === 20 + 14 + 35 - 15 && i.items === 1, "the teacher sees the same coins as the student: " + JSON.stringify(i && { t: i.total, b: i.balance }));
ok(i.gifts.length === 2 && i.gifts[0].amount === 25 && i.gifts[0].text === "Du gav inte upp" && i.gifts[1].amount === 10, "gifts are listed with their reasons, newest first");
ok(T.info({ lessonProgress: {}, attempts: [], feedback: [] }, ctx) === null, "a student without a pet has no line");
ok(T.REASONS.length >= 4, "there are ready-made reasons");

// the same total from the student's own side
const own = Pet.earned({ lessons: lessons, student: student, getProgress: (id) => student.lessonProgress[id], lessonStars: (l) => window.GaussicaRewards.starsFor(l, student, lessons, (id) => student.lessonProgress[id]) });
ok(own.total === i.total, "pet.js and the teacher view agree");

// the box on the student's page is really drawn (a tiny stand-in for the page), with the line about treats and plays
function fakeEl() {
  const e = { children: [], style: {}, className: "", textContent: "", innerHTML: "", classList: { add() {}, remove() {} },
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(x)); }, setAttribute() {}, addEventListener() {}, replaceChildren() { e.children = []; } };
  return e;
}
global.document = { createElement: fakeEl, createTextNode: (text) => ({ textContent: text, children: [] }) };
const textOf = (n) => (n.textContent || "") + (n.children || []).map(textOf).join(" ");
const box = (u) => T.detail(Object.assign({ name: "Kim Test", lessonProgress: {} }, u), Object.assign({ course: { lessons: lessons }, classes: [], inboxUnavailable: true, formatTimestamp: (x) => x }, {}));
const cared = Object.assign({}, pet, { use: { fed: 3, played: 1, love: 6, spent: 8, day: "2026-10-27", food: 3, play: 1 } });
let shown = textOf(box({ lessonProgress: { pet: cared, addition: done }, attempts: [], feedback: [] }));
ok(/Har gett 3 godsaker och lekt 1 gång./.test(shown) && /Vänskap: kompisar/.test(shown), "the page shows the treats, the plays and the friendship: " + shown.slice(0, 200));
shown = textOf(box({ lessonProgress: { pet: Object.assign({}, pet, { use: { fed: 1, played: 2, love: 3 } }) }, attempts: [], feedback: [] }));
ok(/Har gett 1 godsak och lekt 2 gånger./.test(shown) && /nya vänner/.test(shown), "the singular and the plural read right");
shown = textOf(box({ lessonProgress: { pet: pet }, attempts: [], feedback: [] }));
ok(!/godsak/.test(shown), "no line when nothing has been given");
ok(/mynt att spendera/.test(textOf(box({ lessonProgress: { pet: cared, addition: done }, attempts: [], feedback: [] }))), "the rest of the box is drawn too");

console.log(failures ? failures + " FAILED" : "All pet teacher checks passed");
process.exit(failures ? 1 : 0);
