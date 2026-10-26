"use strict";
// The pet: how coins are earned (and not), what the shop sells, and that every combination of animal, colour and
// clothes can be drawn.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "lesson-model.js");
const Art = require(ROOT + "pet-art.js");
const Pet = require(ROOT + "pet.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));

// ----- the shop -----
const ids = Art.ITEMS.map((i) => i.id);
ok(new Set(ids).size === ids.length, "every item has its own id");
ok(Art.ITEMS.every((i) => ["hat", "face", "neck", "bg"].includes(i.slot) && i.price >= 10 && i.price <= 100 && i.name), "every item has a slot, a name and a sensible price");
ok(Art.ITEMS.filter((i) => i.price <= 20).length >= 4, "there is something cheap to buy first");
["hat", "face", "neck", "bg"].forEach((s) => ok(Art.ITEMS.filter((i) => i.slot === s).length >= 4, "enough things to choose from in " + s));

// every animal, colour and item can be drawn, and the markup is clean
let drawn = 0;
Object.keys(Art.KINDS).forEach((kind) => {
  ok(Art.KINDS[kind].colors.length === 4 && Art.KINDS[kind].names.length >= 3, kind + ": colours and names");
  Art.KINDS[kind].colors.forEach((c) => {
    Art.ITEMS.forEach((it) => {
      const worn = {}; if (it.slot !== "bg") worn[it.slot] = it.id;
      ["", "happy"].forEach((mood) => {
        const s = Art.svg({ kind: kind, color: c.id, name: "Test <b>", worn: worn, bg: it.slot === "bg" ? it.id : null }, { mood: mood });
        drawn += 1;
        ok(/^<svg[\s\S]*<\/svg>$/.test(s) && !/NaN|undefined|null/.test(s) && !/<b>/.test(s), kind + "/" + c.id + "/" + it.id + ": clean markup");
      });
    });
  });
  const f = Art.face({ kind: kind, color: "x", worn: { hat: "hatt-keps" } }, "happy");
  ok(/viewBox="40 14 120 110"/.test(f), kind + ": the small face is cut out of the whole");
});
Art.ITEMS.forEach((it) => ok(/viewBox="[\d. -]+"/.test(Art.thumb(it.id)) && !/NaN/.test(Art.thumb(it.id)), it.id + ": a thumbnail"));
ok(Art.svg({ kind: "ghost", color: "?", worn: { hat: "finns-inte" } }).indexOf("pet-dog") > 0, "an unknown animal becomes a dog");

// ----- the pet record -----
const pet = Pet.makePet("cat", "gra", "  Luna!! <i> ");
ok(pet.kind === "cat" && pet.color === "gra" && pet.name === "Luna i", "the name is cleaned: " + JSON.stringify(pet.name));
ok(Pet.makePet("dog", "?", "").name === "Mopsen" && Pet.makePet("ghost", "x", "a").kind === "dog", "defaults");
ok(Pet.makePet("penguin", "rosa", "x".repeat(40)).name.length === 16, "names are at most 16 letters");

const keps = "hatt-keps", krona = "hatt-krona";
let r = Pet.buyItem(pet, keps, 10);
ok(r.error && /5 mynt/.test(r.error), "too few coins: " + r.error);
r = Pet.buyItem(pet, keps, 30);
ok(!r.error && r.pet.owned[keps] === 15 && r.pet.worn.hat === keps, "buying puts it on and records the price paid");
ok(Pet.spentOf(r.pet) === 15 && Pet.balanceOf(50, r.pet) === 35 && Pet.balanceOf(5, r.pet) === 0, "the balance is what was earned minus what was spent, never below zero");
ok(Pet.buyItem(r.pet, keps, 99).error, "the same thing cannot be bought twice");
ok(Pet.buyItem(pet, "finns-inte", 99).error, "an item that does not exist cannot be bought");
let w = Pet.wearItem(r.pet, "hat", null).pet;
ok(!w.worn.hat && w.owned[keps] === 15, "taking it off keeps it");
ok(Pet.wearItem(w, "hat", keps).pet.worn.hat === keps, "and it can be put on again");
ok(!Pet.wearItem(w, "hat", krona).pet.worn.hat, "something that is not owned cannot be put on");
ok(!Pet.wearItem(r.pet, "neck", keps).pet.worn.neck, "an item only goes in its own place");
const bgBuy = Pet.buyItem(pet, "bg-gras", 99);
ok(bgBuy.pet.bg === "bg-gras" && Pet.wearItem(bgBuy.pet, "bg", null).pet.bg === null, "a background is bought, put on and taken off");
ok(pet.owned && Object.keys(pet.owned).length === 0, "the old record is not changed");

// ----- earning coins -----
const lesson = lessons.find((l) => l.id === "addition");
const tasks = L.tasks(lesson);
const now = new Date("2026-03-10T12:00:00Z").getTime();
const iso = (ms) => new Date(ms).toISOString();
const allDone = {};
tasks.forEach((t) => { allDone[t.id] = { answer: "x", feedbackType: "correct", completed: true }; });
function ledger(student, stars) {
  const get = (id) => (student.lessonProgress || {})[id];
  return Pet.earned({ lessons: lessons, student: student, getProgress: get, lessonStars: () => ({ stars: stars || 1 }) });
}
const withPet = (extra) => Object.assign({ lessonProgress: { pet: pet }, attempts: [], feedback: [] }, extra || {});

ok(ledger({ lessonProgress: {}, attempts: [] }).total === 0, "no pet, no coins");
ok(ledger(withPet()).total === 20, "a new pet gets the welcome present: " + ledger(withPet()).total);

let s = withPet({ lessonProgress: { pet: pet, addition: { started: true, answers: allDone } } });
ok(ledger(s, 1).total === 20 + 10 && ledger(s, 2).total === 20 + 12 && ledger(s, 3).total === 20 + 14, "a finished lesson gives 10, and 2 or 4 more for two or three stars");
s = withPet({ lessonProgress: { pet: pet, addition: { started: true, answers: Object.assign({}, allDone, { [tasks[0].id]: { answer: "x" } }) } } });
ok(ledger(s).total === 20, "an unfinished lesson gives nothing");

// stuck with a question after a mistake: one coin, three at most per lesson
const att = (taskId, completed, ms, lessonId) => ({ lessonId: lessonId || "addition", taskId: taskId, completed: completed, feedbackType: completed ? "correct" : "hint", attemptNo: 1, timestamp: iso(ms) });
const trouble = [];
tasks.slice(0, 5).forEach((t, i) => { trouble.push(att(t.id, false, now + i * 10)); trouble.push(att(t.id, true, now + i * 10 + 5)); });
const stuckCoins = ledger(withPet({ attempts: trouble })).parts.find((p) => p.id === "stuck");
ok(stuckCoins && stuckCoins.amount === Math.min(3, Math.min(5, tasks.length)), "sticking with questions after a mistake gives at most 3 per lesson: " + (stuckCoins && stuckCoins.amount));
ok(!ledger(withPet({ attempts: tasks.map((t, i) => att(t.id, true, now + i)) })).parts.find((p) => p.id === "stuck"), "right the first time gives no 'stuck' coin");
ok(!ledger(withPet({ attempts: [att(tasks[0].id, false, now)] })).parts.find((p) => p.id === "stuck"), "a mistake that is never fixed gives nothing");

// practice: one coin per new question, ten a day
const practice = [];
for (let i = 0; i < 14; i++) practice.push(att("practice-sum-" + i, true, now + i * 1000));
for (let i = 0; i < 3; i++) practice.push(att("practice-sum-" + (20 + i), true, now + 3 * 86400000 + i * 1000));
practice.push(att("practice-sum-0", true, now + 5000));             // the same question again
const pc = ledger(withPet({ attempts: practice })).parts.find((p) => p.id === "practice");
ok(pc && pc.amount === 10 + 3, "practice gives 1 coin per new question and at most 10 a day: " + (pc && pc.amount));
ok(!ledger(withPet({ attempts: [att("practice-sum-1", false, now)] })).parts.find((p) => p.id === "practice"), "a wrong practice answer gives nothing");

// the placement test and gifts from the teacher
ok(ledger(withPet({ lessonProgress: { pet: pet, placement: { known: ["addition"] } } })).total === 25, "the placement test gives 5");
const gifted = ledger(withPet({ feedback: [{ sticker: "mynt10" }, { sticker: "mynt25" }, { sticker: "star" }, { sticker: null }] }));
ok(gifted.total === 20 + 35, "coins from the teacher count: " + gifted.total);
// the teacher can send the gift stickers: every backend and the message sticker list know them
["server/api.js", "cloudflare/worker.js", "local-backend.js", "mailbox.js"].forEach((f) => {
  const text = fs.readFileSync(ROOT + f, "utf8");
  ok(Object.keys(Pet.GIFTS).every((k) => text.includes('"' + k + '"') || text.includes(k + ":")), f + " knows the coin stickers");
});

// every item can be afforded by someone who has worked for a while
const stars3 = lessons.filter((l) => !l.isParentLesson).length;
ok(stars3 * 10 > Art.ITEMS.reduce((n, i) => n + i.price, 0), "the whole shop is within reach of the course");

console.log(failures ? failures + " FAILED" : "All pet checks passed (" + drawn + " drawings)");
process.exit(failures ? 1 : 0);
