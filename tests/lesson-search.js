"use strict";
// The search for a lesson (lesson-search.js): by name, by a word of the summary, without the Swedish letters, and with every word of the query.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
const S = require(ROOT + "lesson-search.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const lessons = idx.lessons.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const ids = (q, o) => S.find(lessons, q, o).map((r) => r.lesson.id);

ok(S.normalize("  Bråk, Ärter & Öl! ") === "brak arter ol", "the Swedish letters count as a, a and o, and signs and spaces are dropped");
ok(S.find(lessons, "").length === 0 && S.find(lessons, "   ").length === 0 && S.find(lessons, "!!").length === 0, "an empty query finds nothing (the caller shows everything)");
ok(ids("zzzqq").length === 0, "something that is not there finds nothing");
ok(ids("tomma hinken")[0] === "tom-behallare", "by a part of the name, in any order of words: " + ids("tomma hinken").slice(0, 3));
ok(ids("hinken tomma")[0] === "tom-behallare", "the order of the words does not matter");
ok(ids("brak").length >= 5 && ids("brak").join() === ids("bråk").join(), "'brak' finds what 'bråk' finds");
ok(ids("bråk").slice(0, 4).every((id) => /brak/.test(id) || /bråk/i.test(lessons.find((l) => l.id === id).title)), "the best hits for bråk are about fractions: " + ids("bråk").slice(0, 4));
ok(ids("klocka").some((id) => /klock/.test(id)), "clock lessons for klocka");
ok(ids("ekvation").length >= 3, "equations");
ok(ids("upp och ner")[0] === "upp-och-ner", "a name of three words: " + ids("upp och ner").slice(0, 2));
ok(S.find(lessons, "pyssla", { extra: (l) => (l.kind === "pyssel" ? "pyssla" : "") }).every((r) => r.lesson.kind === "pyssel" || /pyssla/i.test(r.lesson.title + r.lesson.summary + r.lesson.level)), "the extra text makes the kind searchable");
ok(S.find(lessons, "kapitel", { extra: (l) => (l.isParentLesson ? "kapitel" : "") }).some((r) => r.lesson.isParentLesson), "and the chapters");
// the name counts more than the summary: a lesson with the word in its title comes before one that only mentions it
const first = S.find(lessons, "division")[0];
ok(first && /division/i.test(first.lesson.title), "a word of the title comes before a word of the summary: " + (first && first.lesson.title));
ok(S.find(lessons, "bråk", { limit: 3 }).length === 3, "a limit");
ok(S.matches({ id: "a", title: "Bråk", summary: "", level: "" }, "brak") && !S.matches({ id: "a", title: "Bråk", summary: "", level: "" }, "klocka"), "matches() for one lesson");
ok(S.find([{ id: "x", title: "Division", summary: "", level: "" }, { id: "y", title: "Mer", summary: "handlar om division", level: "" }], "division").map((r) => r.lesson.id).join() === "x,y", "the start of the title counts most");
// every lesson can be found by its own title
let lost = 0;
lessons.forEach((l) => { if (!S.find(lessons, l.title).some((r) => r.lesson.id === l.id)) { lost += 1; if (lost < 4) console.log("   not found by its own title: " + l.title); } });
ok(lost === 0, "every lesson is found by its own title (" + lost + " are not)");

console.log(failures ? failures + " FAILED" : "All lesson search checks passed (" + lessons.length + " lessons)");
process.exit(failures ? 1 : 0);
