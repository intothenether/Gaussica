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
const SLOTS = ["hat", "face", "neck", "bg"].concat(Art.ROOM_SLOTS.map((s) => s[0]));
ok(Art.ITEMS.every((i) => SLOTS.includes(i.slot) && i.price >= 10 && i.price <= 100 && i.name), "every item has a slot, a name and a sensible price");
ok(Art.ITEMS.filter((i) => i.price <= 20).length >= 4, "there is something cheap to buy first");
["hat", "face", "neck", "bg"].forEach((s) => ok(Art.ITEMS.filter((i) => i.slot === s).length >= 4, "enough things to choose from in " + s));

// every animal, colour and item can be drawn, and the markup is clean
let drawn = 0;
Object.keys(Art.KINDS).forEach((kind) => {
  ok(Art.KINDS[kind].colors.length === 4 && Art.KINDS[kind].names.length >= 3, kind + ": colours and names");
  Art.KINDS[kind].colors.forEach((c) => {
    Art.ITEMS.forEach((it) => {
      const worn = {}, room = {};
      if (Art.isRoomSlot(it.slot)) room[it.slot] = it.id; else if (it.slot !== "bg") worn[it.slot] = it.id;
      ["", "happy"].forEach((mood) => {
        const s = Art.svg({ kind: kind, color: c.id, name: "Test <b>", worn: worn, room: room, scene: Art.isRoomSlot(it.slot) ? "room" : "bg", bg: it.slot === "bg" ? it.id : null }, { mood: mood });
        drawn += 1;
        ok(/^<svg[\s\S]*<\/svg>$/.test(s) && !/NaN|undefined|null/.test(s) && !/<b>/.test(s), kind + "/" + c.id + "/" + it.id + ": clean markup");
      });
    });
  });
  const f = Art.face({ kind: kind, color: "x", worn: { hat: "hatt-keps" } }, "happy");
  ok(/viewBox="-?\d+ \d+ \d+ \d+"/.test(f) && !/viewBox="0 0 200 200"/.test(f), kind + ": the small face is cut out of the whole");
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
ok(stars3 * 15 > Art.ITEMS.reduce((n, i) => n + i.price, 0), "the whole shop is within reach of the course (15 coins a lesson, with stars and practice)");

// ----- the room -----
ok(Art.ROOM_SLOTS.length === 8 && Art.ROOM_SLOTS.every((s) => Art.ITEMS.filter((i) => i.slot === s[0]).length >= 2), "every place in the room has at least two things to choose from");
ok(Art.ITEMS.filter((i) => Art.isRoomSlot(i.slot)).every((i) => i.room && /viewBox/.test(Art.thumb(i.id)) && !/NaN/.test(Art.thumb(i.id))), "room things have thumbnails");
const emptyRoom = Art.svg({ kind: "cat", color: "gra", scene: "room" });
ok(/pet-room-svg/.test(emptyRoom) && emptyRoom.includes("translate(25 38) scale"), "an empty room is drawn with the pet in the middle");
ok(!/pet-room-svg/.test(Art.svg({ kind: "cat", color: "gra", scene: "room" }, { bare: true })), "the bare pet has no room (small faces)");
let rp = Pet.makePet("penguin", "rosa", "Pingo");
ok(!rp.scene, "a new pet has no room view yet");
let rb = Pet.buyItem(rp, "rum-matta-bla", 99);
ok(!rb.error && rb.pet.room.rug === "rum-matta-bla" && rb.pet.scene === "room" && Pet.isOn(rb.pet, Art.item("rum-matta-bla")), "the first room thing is placed and switches the view to the room");
const bgPet = Pet.buyItem(Pet.makePet("dog", "fawn", "x"), "bg-gras", 99).pet;
ok(!bgPet.scene && Pet.buyItem(bgPet, "rum-kudde", 99).pet.scene === "room", "a background alone does not switch to the room");
const keepScene = Object.assign({}, rb.pet, { scene: "bg" });
ok(Pet.buyItem(keepScene, "rum-kudde", 99).pet.scene === "bg", "the choice of view is kept when more is bought");
ok(!Pet.wearItem(rb.pet, "rug", null).pet.room.rug && !Pet.wearItem(rb.pet, "bed", "rum-korg").pet.room.bed, "a room thing is taken away, and one that is not owned is not placed");
ok(!Pet.wearItem(rb.pet, "bed", "rum-matta-bla").pet.room.bed, "a thing only goes in its own place in the room");

// ----- the themed sets -----
const known = new Set(lessons.map((l) => l.area));
ok(Art.SETS.length === 5 && Art.SETS.every((s) => known.has(s.area) && s.name && s.areaName), "one set for each of the five areas");
Art.SETS.forEach((set) => {
  const items = Art.ITEMS.filter((i) => i.set === set.id);
  ok(items.length === 3 && items.map((i) => i.slot).sort().join() === "face,hat,neck", set.id + ": a hat, glasses and a necklace");
  ok(items.every((i, n) => i.area === undefined && i.need === [2, 4, 6][n]) && items.every((i, n) => n === 0 || i.price >= items[n - 1].price), set.id + ": later pieces need more lessons and cost more");
  ok(lessons.filter((l) => !l.isParentLesson && l.area === set.area).length >= 6, set.id + ": the area has enough lessons to unlock the whole set");
});
const tal = Art.item("tal-hatt"), talHals = Art.item("tal-hals");
ok(Pet.lockOf(tal, { tal: 1 }) && Pet.lockOf(tal, { tal: 1 }).need === 2 && !Pet.lockOf(tal, { tal: 2 }) && !Pet.lockOf(Art.item("hatt-keps"), {}), "a themed piece is locked until enough lessons are finished, other pieces never");
ok(!Pet.lockOf(tal, undefined), "without counts nothing is locked");
let b = Pet.buyItem(pet, "tal-hatt", 99, { tal: 1 });
ok(b.error && /2 lektioner i Tal & räkning/.test(b.error) && /klarat 1/.test(b.error), "buying a locked piece is refused: " + b.error);
b = Pet.buyItem(pet, "tal-hatt", 99, { tal: 2 });
ok(!b.error && b.pet.worn.hat === "tal-hatt" && b.pet.owned["tal-hatt"] === 30, "an unlocked piece is bought and put on");
ok(Pet.buyItem(pet, "tal-hals", 99, { tal: 5 }).error, "the third piece needs six lessons");
// finished lessons per area are counted from the progress
const doneLesson = lessons.find((l) => l.area === "tal" && !l.isParentLesson && L.tasks(l).length);
const prog = { [doneLesson.id]: { started: true, answers: Object.fromEntries(L.tasks(doneLesson).map((t) => [t.id, { answer: "x", feedbackType: "correct", completed: true }])) } };
const counts = Pet.areaCounts({ lessons: lessons, getProgress: (id) => prog[id] });
ok(counts.tal === 1 && !counts.geometri, "finished lessons are counted per area: " + JSON.stringify(counts));


// ----- more animals -----
const NINE = ["dog", "tax", "cat", "penguin", "rabbit", "hedgehog", "fox", "hamster", "dragon"];
ok(NINE.every((k) => Art.KINDS[k]) && Object.keys(Art.KINDS).length === 9, "nine animals");
NINE.forEach((k) => {
  const likes = Art.KINDS[k].likes;
  ok(likes && Art.thing(likes.food) && Art.thing(likes.food).type === "food" && Art.thing(likes.toy) && Art.thing(likes.toy).type === "toy", k + ": a favourite food and a favourite toy that exist");
  ok(Pet.makePet(k, "?", "").kind === k && Pet.makePet(k, "?", "").name === Art.KINDS[k].names[0], k + ": can be chosen, with a default name");
});
ok(new Set(NINE.map((k) => Art.KINDS[k].name)).size === 9, "every animal has its own name");

// ----- food and play -----
ok(Art.FOODS.length >= 6 && Art.TOYS.length >= 5, "there are treats and toys to choose from");
[].concat(Art.FOODS, Art.TOYS).forEach((x) => {
  ok(x.price >= 1 && x.price <= 5 && x.name && x.a && x.pl, x.id + ": a name, a price and the words for it");
  ok(/viewBox="0 0 60 60"/.test(Art.snack(x.id)) && !/NaN|undefined/.test(Art.snack(x.id)), x.id + ": can be drawn");
  ok(x.type === "food" || (x.type === "toy" && ["bounce", "fly", "roll", "float"].includes(x.motion)), x.id + ": a type, and a motion for toys");
});
ok(new Set([].concat(Art.FOODS, Art.TOYS).map((x) => x.id)).size === Art.FOODS.length + Art.TOYS.length, "treats and toys have their own ids");
ok(!Art.ITEMS.some((i) => Art.thing(i.id)), "treats and toys do not share ids with the shop");

const NOON = new Date(2026, 9, 27, 12).getTime(), NEXT_DAY = new Date(2026, 9, 28, 9).getTime();
const buddy = Pet.makePet("rabbit", "vit", "Nusse");
let c = Pet.useThing(buddy, "morot", 1, NOON);
ok(c.error && /1 mynt till/.test(c.error), "too few coins: " + c.error);
ok(Pet.useThing(buddy, "finns-inte", 99, NOON).error, "an unknown thing is refused");
c = Pet.useThing(buddy, "morot", 10, NOON);
ok(!c.error && c.favorite && c.pet.use.spent === 2 && c.pet.use.love === 2 && c.pet.use.fed === 1 && c.pet.use.food === 1 && c.pet.use.play === 0, "the favourite food: costs 2, gives two hearts");
ok(Pet.spentOf(c.pet) === 2 && Pet.balanceOf(10, c.pet) === 8, "what was spent on treats is taken from the balance");
ok(buddy.use === undefined && Pet.spentOf(buddy) === 0, "the old pet is not changed");
c = Pet.useThing(c.pet, "fisk", 10, NOON);
ok(!c.error && !c.favorite && c.pet.use.love === 3 && c.pet.use.spent === 5, "another food: one heart");
c = Pet.useThing(c.pet, "applet", 10, NOON);
ok(!c.error && Pet.usedToday(c.pet, NOON).food === 3, "three treats today");
const full = Pet.useThing(c.pet, "applet", 99, NOON);
ok(full.error && /mätt/.test(full.error) && !full.pet, "a fourth treat the same day: full, and nothing is charged");
ok(!Pet.useThing(c.pet, "boll", 99, NOON).error, "toys are separate from treats");
ok(!Pet.useThing(c.pet, "applet", 99, NEXT_DAY).error && Pet.usedToday(c.pet, NEXT_DAY).food === 0, "a new day starts from zero");
let played = c.pet;
for (let i = 0; i < Pet.LIMITS.PLAY_PER_DAY; i++) played = Pet.useThing(played, "boll", 99, NOON).pet;
const tired = Pet.useThing(played, "boll", 99, NOON);
ok(tired.error && /trött/.test(tired.error) && played.use.played === Pet.LIMITS.PLAY_PER_DAY, "after five plays the pet is tired");
ok(played.use.fed === 3 && played.use.food === 3 && played.use.play === 5, "the day and the totals are counted separately");
const after = Pet.useThing(played, "boll", 99, NEXT_DAY);
ok(!after.error && after.pet.use.played === Pet.LIMITS.PLAY_PER_DAY + 1 && after.pet.use.play === 1 && after.pet.use.food === 0, "the totals keep growing across days");

// the friendship
ok(Pet.levelOf(buddy).index === 0 && Pet.levelOf(buddy).name === "Nya vänner" && Pet.levelOf(buddy).next.at === 6, "a new pet: Nya vänner, the next step at 6 hearts");
let p6 = Object.assign({}, buddy, { use: { love: 5 } });
const up = Pet.useThing(p6, "boll", 99, NOON);
ok(up.levelUp === "Kompisar" && Pet.levelOf(up.pet).index === 1, "the sixth heart: Kompisar, and the move is reported");
ok(Pet.useThing(up.pet, "boll", 99, NOON).levelUp === null, "no news while the level stays");
ok(Pet.levelOf({ use: { love: 20 } }).name === "Bästisar" && Pet.levelOf({ use: { love: 50 } }).next === null && Pet.levelOf({ use: { love: 500 } }).index === 3, "the steps go on to Superbästisar, which is the last");
ok(Pet.levelOf({ use: { love: -4 } }).index === 0 && Pet.levelOf({}).index === 0 && Pet.levelOf(null).index === 0, "odd records are handled");
ok(Pet.useThing(Object.assign({}, buddy, { use: { love: 19, day: "x" } }), "frisbee", 99, NOON).levelUp === "Bästisar", "a favourite toy of another animal is not special, but the steps are counted right");

// favourites are per animal
["dog", "cat", "fox", "dragon"].forEach((k) => {
  const pp = Pet.makePet(k, "?", "x");
  const r1 = Pet.useThing(pp, Art.KINDS[k].likes.food, 99, NOON), r2 = Pet.useThing(pp, Art.KINDS[k].likes.toy, 99, NOON);
  ok(r1.favorite && r2.favorite && r1.pet.use.love === 2 && r2.pet.use.love === 2, k + ": loves its favourites");
});
ok(!Pet.useThing(Pet.makePet("cat", "?", "x"), "morot", 99, NOON).favorite, "the cat does not love carrots");
ok(/älskar morötter/.test(Pet.careMessage(buddy, { thing: Art.thing("morot"), favorite: true, levelUp: null })) && /Mums! Nusse åt en morot/.test(Pet.careMessage(buddy, { thing: Art.thing("morot"), favorite: false })) &&
  /lekte med en boll/.test(Pet.careMessage(buddy, { thing: Art.thing("boll"), favorite: false })) && /Nu är ni kompisar/.test(Pet.careMessage(buddy, { thing: Art.thing("boll"), favorite: false, levelUp: "Kompisar" })), "the messages read well in Swedish");
ok(!/[×—]/.test(JSON.stringify([Art.FOODS.map((x) => [x.name, x.a, x.pl]), Art.TOYS.map((x) => [x.name, x.a, x.pl])])), "no multiplication sign or em dash in the texts");


console.log(failures ? failures + " FAILED" : "All pet checks passed (" + drawn + " drawings)");
process.exit(failures ? 1 : 0);
