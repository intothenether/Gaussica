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

console.log(failures ? failures + " FAILED" : "All pet teacher checks passed");
process.exit(failures ? 1 : 0);
