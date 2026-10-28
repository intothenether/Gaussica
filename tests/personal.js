"use strict";
// Some problems are about the student's pet: its name and what it likes to eat.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";

global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
const Art = require(ROOT + "pet-art.js");
const L = window.GaussicaLesson;
const PR = window.GaussicaPractice;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const byId = (id) => lessons.find((l) => l.id === id);

// ----- the words -----
ok(L.personalText("@djur har 3 @mat.") === "Mio har 3 äpplen.", "without a pet: Mio and äpplen");
L.setPersonal(() => ({ name: "Pixel", food: "morötter" }));
ok(L.personalText("@djur har 3 @mat.") === "Pixel har 3 morötter.", "the name and the food of the pet");
ok(L.personalText("@djurs boll") === "Pixels boll", "the name with an s");
L.setPersonal(() => ({ name: "Max", food: "fiskar" }));
ok(L.personalText("@djurs boll") === "Max boll", "a name that ends in s stays as it is");
ok(L.personalText("@matte och @mat") === "@matte och fiskar", "only the whole word @mat is replaced");
ok(L.personalText("Ingen här") === "Ingen här" && L.personalText(5) === 5, "text without the tokens is left alone");
L.setPersonal(() => { throw new Error("broken"); });
ok(L.personalText("@djur") === "Mio", "a failing source gives the default");
L.setPersonal(null);

// ----- every animal has something to count -----
Object.keys(Art.KINDS).forEach((k) => ok(/^[a-zåäö]+$/.test(Art.countable(k)), k + ": a word to count with (" + Art.countable(k) + ")"));
ok(Art.countable("finns-inte") === "äpplen", "an unknown animal gets äpplen");

// ----- the problems -----
const brak = byId("brak-del");
const before = JSON.stringify(brak);
L.setPersonal(() => ({ name: "Pixel", food: Art.countable("rabbit") }));
const task = L.tasks(brak).find((t) => t.id === "word-1");
ok(/^Ett fat har 12 morötter\. Pixel äter 5 morötter\./.test(task.problem.prompt), "the problem is about the pet: " + task.problem.prompt);
ok(/Pixel har ätit 5 av 12 morötter/.test(task.problem.correct) && task.problem.feedback.some((f) => /Pixel/.test(f.message)), "and so are the answer and the hints");
ok(JSON.stringify(brak) === before, "the lesson itself is not changed");
ok(L.tasks(byId("addition")).every((t, i) => t.problem === (i === 0 ? byId("addition").exercise : t.problem)), "a problem without the pet is the same object as before");
L.setPersonal(null);
ok(/^Ett fat har 12 äpplen\. Mio äter/.test(L.tasks(brak).find((t) => t.id === "word-1").problem.prompt), "without a pet it is Mio");

// ----- nothing is left over, and not every problem is about the pet -----
const TOKEN = /@\w+/g;
let withTokens = 0, problems = 0;
lessons.forEach((l) => {
  const texts = JSON.stringify([l.exercise, l.wordProblems, l.practice]);
  const found = texts.match(TOKEN) || [];
  problems += 1 + (l.wordProblems || []).length + (l.practice || []).length;
  if (found.length) withTokens += 1;
  ok(found.every((t) => /^@(djur|djurs|mat)$/.test(t)), l.id + ": only known tokens (" + found.filter((t) => !/^@(djur|djurs|mat)$/.test(t)).join(" ") + ")");
  // no pronoun for the pet: it is not known which one fits
  [l.exercise].concat(l.wordProblems || [], l.practice || []).forEach((p) => {
    if (JSON.stringify(p).indexOf("@") >= 0) ok(!/\b(hon|han|hen|hennes|hans|hens|sin|sitt|sina)\b/i.test(JSON.stringify(p)), l.id + ": no pronoun in a problem about the pet");
  });
});
ok(withTokens >= 8 && withTokens <= 25, "a handful of lessons are about the pet, not all of them (" + withTokens + " of " + lessons.length + ")");
lessons.forEach((l) => L.tasks(l).forEach((t) => ok(!/@(djur|mat)/.test(JSON.stringify(t.problem)), l.id + "/" + t.id + ": nothing left to put in")));

// generated practice questions are about the pet too
const tmplLesson = byId("kassakvitto");
L.setPersonal(() => ({ name: "Kuna", food: "kanelbullar" }));
let seen = false;
for (let i = 0; i < 40 && !seen; i++) {
  const q = PR.generate(tmplLesson, "vaxel", i + 1);
  if (q && /Kuna köper \d+ kanelbullar/.test(q.problem.prompt)) seen = true;
}
ok(seen, "a generated question puts the pet in");
L.setPersonal(null);

console.log(failures ? failures + " FAILED" : "All pet problem checks passed");
process.exit(failures ? 1 : 0);
