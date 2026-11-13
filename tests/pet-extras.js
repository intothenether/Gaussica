"use strict";
// What the pet does beyond the shop: the Swedish year (things that are for sale only in their season), what the pet remembers and says on special days,
// its tricks, and "Hjälp djuret" (the pet makes a mistake that the student finds).
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
global.document = { createElement: () => ({}) };
require(ROOT + "pyssel.js");
require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
const Art = require(ROOT + "pet-art.js");
const Pet = require(ROOT + "pet.js");
const Memory = require(ROOT + "pet-memory.js");
const Tricks = require(ROOT + "pet-tricks.js");
const Help = require(ROOT + "pet-help.js");
const PR = window.GaussicaPractice;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };
const D = (y, m, d) => new Date(y, m - 1, d, 12);

// ----- the Swedish year -----
ok(Art.activeSeasons(D(2026, 12, 13)).includes("lucia") && Art.activeSeasons(D(2026, 12, 13)).includes("jul"), "Lucia is in the window of Lucia and Jul");
ok(Art.activeSeasons(D(2026, 12, 20)).join() === "jul" && Art.activeSeasons(D(2027, 1, 3)).join() === "jul", "Jul goes past New Year");
ok(Art.activeSeasons(D(2026, 11, 13)).length === 0 && Art.activeSeasons(D(2026, 5, 10)).length === 0, "most of the year has no season");
ok(Art.activeSeasons(D(2026, 10, 31)).join() === "halloween" && Art.activeSeasons(D(2026, 6, 19)).join() === "midsommar", "Halloween and Midsommar");
Art.SEASONS.forEach((s) => {
  const items = Art.ITEMS.filter((i) => i.season === s.id).concat(Art.FOODS.filter((f) => f.season === s.id));
  ok(items.length >= 1, s.id + " has something to buy");
  ok(Art.seasonEnds(s.id) === s.to[1] + " " + ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"][s.to[0] - 1], s.id + " says when it ends");
});
ok(Art.ITEMS.filter((i) => i.season).every((i) => Art.season(i.season) && i.price <= 30), "the things of the year belong to a season and are cheap");
ok(Art.FOODS.filter((f) => f.season).every((f) => Art.season(f.season)), "the treats of the year belong to a season");
// the things of the year are bought only in their season, and kept for good
const pet = Pet.makePet("dog", Art.KINDS.dog.colors[0].id, "Pixel");
const out = Pet.buyItem(pet, "hatt-lucia", 100, null, null, D(2026, 8, 20).getTime());
ok(out.error && /Lucia/.test(out.error), "the Lucia crown cannot be bought in August: " + out.error);
const inn = Pet.buyItem(pet, "hatt-lucia", 100, null, null, D(2026, 12, 10).getTime());
ok(!inn.error && inn.pet.owned["hatt-lucia"] === 25 && inn.pet.worn.hat === "hatt-lucia", "it can be bought and put on in December");
ok(!Pet.buyItem(pet, "hatt-lucia", 100, null, null).error, "without a time the season is not checked (the pure tests)");
ok(Pet.wearItem(inn.pet, "hat", "hatt-lucia").pet.worn.hat === "hatt-lucia" && !Pet.lockOf(Art.item("hatt-lucia"), null, null, D(2026, 8, 20).getTime()) === false, "an item out of season is locked, an item that is worn stays on");
const fed = Pet.useThing(pet, "lussekatt", 50, D(2026, 8, 20).getTime());
ok(fed.error && /Lucia/.test(fed.error), "a treat of Lucia is not for sale in August");
ok(!Pet.useThing(pet, "lussekatt", 50, D(2026, 12, 10).getTime()).error, "but it is in December");
ok(!Pet.useThing(pet, "applet", 50, D(2026, 8, 20).getTime()).error, "the usual treats are always there");
// every thing of the year can be drawn on every animal (a hat that sits wrong is found by looking, but not a broken drawing)
Object.keys(Art.KINDS).forEach((k) => Art.ITEMS.filter((i) => i.season).forEach((it) => {
  const worn = {}, room = {};
  if (Art.isRoomSlot(it.slot)) room[it.slot] = it.id; else worn[it.slot] = it.id;
  const s = Art.svg({ kind: k, color: Art.KINDS[k].colors[0].id, name: "x", worn: worn, room: room, scene: Art.isRoomSlot(it.slot) ? "room" : "" });
  ok(/^<svg[\s\S]*<\/svg>$/.test(s) && !/NaN|undefined/.test(s), k + "/" + it.id + " is drawn");
}));
Art.FOODS.filter((f) => f.season).forEach((f) => ok(/<svg/.test(Art.snack(f.id)) && !/NaN|undefined/.test(Art.snack(f.id)), f.id + " can be drawn on a plate"));

// ----- the special days -----
ok(Memory.easter(2026).getMonth() === 3 && Memory.easter(2026).getDate() === 5, "Easter 2026 is on 5 April");
ok(Memory.easter(2027).getMonth() === 2 && Memory.easter(2027).getDate() === 28 && Memory.easter(2025).getDate() === 20, "Easter 2027 and 2025");
ok(/Lucia/.test(Memory.greeting(D(2026, 12, 13))) && /jul/.test(Memory.greeting(D(2026, 12, 24))) && /nytt år/.test(Memory.greeting(D(2027, 1, 1))), "Lucia, Christmas Eve and New Year");
ok(/påsk/.test(Memory.greeting(D(2026, 4, 5))) && /fettisdag/.test(Memory.greeting(D(2026, 2, 17))), "Easter Sunday and Fettisdagen move with Easter (17 February 2026)");
ok(/midsommar/.test(Memory.greeting(D(2026, 6, 19))) && /midsommar/.test(Memory.greeting(D(2027, 6, 25))) && Memory.greeting(D(2026, 6, 20)) === null, "Midsommarafton is the Friday between 19 and 25 June");
ok(Memory.greeting(D(2026, 11, 13)) === null, "an ordinary day has no greeting");

// ----- what the pet remembers -----
const DAY = 86400000, NOW = D(2026, 11, 13).getTime();
const ctx = { now: NOW, seed: 3, areas: { tal: "Tal & räkning", algebra: "Samband & algebra", geometri: "Form & rum" }, counts: { tal: 5, algebra: 0, geometri: 1 },
  done: [{ title: "Upp och ner: följ stegen", area: "tal", at: NOW - DAY * 0.9 }, { title: "Division", area: "tal", at: NOW - 5 * DAY }, { title: "Bråk", area: "tal", at: NOW - 6 * DAY }, { title: "Mer", area: "tal", at: NOW - 7 * DAY }, { title: "Mer 2", area: "tal", at: NOW - 8 * DAY }, { title: "Mer 3", area: "geometri", at: NOW - 9 * DAY }],
  fixed: [{ title: "Hur mycket väger den tomma hinken?", at: NOW - DAY }], gapDays: 0, friendship: 2 };
const list = Memory.lines(ctx);
ok(list.some((l) => l.id === "done-yesterday" && /I går klarade du ”Upp och ner: följ stegen”/.test(l.text)), "it remembers what was finished yesterday");
ok(list.some((l) => l.id === "fixed" && /inte gav upp/.test(l.text)), "and the question that was not given up on");
ok(list.some((l) => l.id === "favourite" && /Tal & räkning/.test(l.text)) && list.some((l) => l.id === "curious" && /Samband & algebra/.test(l.text)), "a favourite area, and a gentle word about one that was not tried");
ok(!list.some((l) => l.id === "back"), "no word about being away when the student was here today");
ok(Memory.lines(Object.assign({}, ctx, { gapDays: 9 })).some((l) => l.id === "back" && /tillbaka/.test(l.text)), "after nine days away: how nice that you are back");
ok(list.every((l) => !/(—|NaN|undefined|null)/.test(l.text) && l.text.length < 140), "every line is clean and short");
ok(list.every((l, i) => i === 0 || list[i - 1].weight >= l.weight), "the most special come first");
ok(Memory.say(Object.assign({}, ctx, { now: D(2026, 12, 13).getTime() })).id === "greeting", "a special day always wins");
const seen = new Set();
for (let s = 0; s < 40; s++) seen.add(Memory.say(Object.assign({}, ctx, { seed: s })).id);
ok(seen.size >= 3, "another visit gives another line (" + Array.from(seen).join(",") + ")");
ok(Memory.say({ now: NOW, seed: 1, done: [], counts: {}, areas: {} }) === null, "a student with nothing done gets the general lines of the pet");
ok(Memory.short("x".repeat(80)).length <= 44 && Memory.lines({ now: NOW, done: [{ title: "y".repeat(90), at: NOW - 0.5 * DAY }] }).every((l) => l.text.length < 120), "a long title is cut");

// ----- the tricks -----
ok(Tricks.TRICKS.length === 15 && new Set(Tricks.TRICKS.map((t) => t.id)).size === 15, "fifteen tricks, three for each area");
const areas = Art.SETS.map((s) => s.area);
ok(areas.every((a) => Tricks.TRICKS.filter((t) => t.area === a).length === 3), "three tricks in every area that has a theme");
ok(Tricks.TRICKS.every((t) => t.name && t.say && /^[A-ZÅÄÖ]/.test(t.name) && !/—/.test(t.say) && Tricks.NEED.includes(t.need)), "every trick has a name, something to say and a need");
const lessonCounts = {};
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
lessons.forEach((l) => { if (!l.isParentLesson && l.kind !== "pyssel") lessonCounts[l.area] = (lessonCounts[l.area] || 0) + 1; });
ok(areas.every((a) => (lessonCounts[a] || 0) >= Math.max.apply(null, Tricks.NEED)), "every area has enough lessons to learn all its tricks");
const st = Tricks.status({ tal: 5, algebra: 1 }, { tal: NOW - 3 * DAY, algebra: NOW - 40 * DAY }, NOW);
const byId = (id) => st.find((s) => s.trick.id === id);
ok(byId("tal-rakna").unlocked && byId("tal-jonglera").unlocked && !byId("tal-volt").unlocked, "the first two tricks of Tal at 5 lessons, not the third");
ok(byId("tal-rakna").shiny && !Tricks.status({ tal: 5 }, { tal: NOW - 40 * DAY }, NOW)[0].shiny, "a trick is shiny for two weeks after the last time in the area");
ok(!byId("algebra-x").unlocked && Tricks.fresh({ tal: 2 }, []).map((t) => t.id).join() === "tal-rakna" && Tricks.fresh({ tal: 2 }, ["tal-rakna"]).length === 0, "what is new is what has not been seen");
ok(Tricks.status({}, null, NOW).every((s) => !s.unlocked && !s.shiny), "nothing is learned without lessons");

// ----- the help -----
ok(Help.isRight({ answers: ["170", "170 g"] }, "170") && Help.isRight({ answers: ["170", "170 g"] }, "170 g") && Help.isRight({ answers: ["12"] }, "12,0") && Help.isRight({ answers: ["3,5"] }, "3.5"), "numbers are compared as numbers, with or without a unit");
ok(!Help.isRight({ answers: ["170"] }, "") && !Help.isRight({ answers: ["170"] }, "17") && !Help.isRight(null, "1"), "wrong or empty answers are not right");
ok(Help.available([], PR) === 0 && Help.makeRound([], PR) === null, "nothing to ask without lessons");
const withPractice = lessons.filter((l) => !l.isParentLesson && PR.has(l));
ok(withPractice.length > 100 && Help.available(lessons, PR) === withPractice.length, "lots of lessons can give a round (" + withPractice.length + ")");
let wrong = 0, right = 0, rounds = 0, noWhy = 0;
for (let i = 0; i < 600; i++) {
  const r = Help.makeRound(withPractice, PR, Math.random);
  if (!r) continue;
  rounds += 1;
  if (r.petRight) { right += 1; ok(Help.isRight(r, r.shown), "when the pet is right its answer is right: " + r.prompt + " -> " + r.shown); }
  else {
    wrong += 1;
    ok(!Help.isRight(r, r.shown), "when the pet is wrong its answer is wrong: " + r.lessonId + ": " + r.prompt + " -> " + r.shown);
    if (!r.why) noWhy += 1;
  }
  ok(r.prompt && r.shown && r.answers.length && !/\{|\}|NaN|undefined/.test(r.prompt + r.shown + (r.how || "")), "a round is clean: " + r.lessonId);

}
ok(rounds >= 550, "rounds are made (" + rounds + " of 600)");
ok(wrong > rounds * 0.4 && right > rounds * 0.15, "most of the rounds are mistakes and a good part are right (" + wrong + " wrong, " + right + " right)");
ok(noWhy === 0, "a mistake always has its explanation");


// the hearts for helping: three a day
let p = Pet.makePet("cat", Art.KINDS.cat.colors[0].id, "Tuss");
let got = 0;
for (let i = 0; i < 5; i++) { const r = Pet.helpPet(p, D(2026, 11, 13).getTime()); if (r.gained) { got += 1; p = r.pet; } }
ok(got === Pet.HELP_PER_DAY && Pet.levelOf(p).love === 3, "three hearts a day for helping, no more");
ok(Pet.helpPet(p, D(2026, 11, 14).getTime()).gained === 1, "and three more the next day");
const both = Pet.petPet(p, D(2026, 11, 13).getTime());
ok(both.gained === 1 && Pet.usedToday(both.pet, D(2026, 11, 13).getTime()).helped === 3, "petting still works on the same day, and the helped hearts are kept");

console.log(failures ? failures + " FAILED" : "All pet extras checks passed");
process.exit(failures ? 1 : 0);
