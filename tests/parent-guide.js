"use strict";
// "Hjälp för vuxna": every lesson gets a guide, the guides that are written by hand belong to lessons that exist, and none has loose ends.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = {};
require(ROOT + "parent-guides.js");
const PG = require(ROOT + "parent-guide.js");
const guides = window.GaussicaParentGuides;
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

const index = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8")).lessons;
const lessons = index.map((f) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8")));
const ids = new Set(lessons.map((l) => l.id));

const odd = (t) => /undefined|NaN|\[object|\{[a-z]|×|—/.test(t);
let bad = 0, longest = 0;
lessons.forEach((l) => {
  const g = PG.build(l, guides);
  const texts = g.explain.concat(g.mistakes, g.talk);
  longest = Math.max(longest, ...texts.map((t) => t.length));
  if (!g.explain.length || !g.mistakes.length || !g.talk.length || texts.some((t) => !/\S/.test(t) || odd(t) || t.length > 900)) { bad++; console.log("   " + l.id + ": " + JSON.stringify(texts).slice(0, 200)); }
});
ok(bad === 0, "every one of the " + lessons.length + " lessons gets a guide with something to say, ask and watch for (longest text " + longest + " characters)");

const own = Object.keys(guides);
ok(own.length >= 12 && own.every((id) => ids.has(id)), own.length + " guides are written by hand, and every one is for a lesson that exists");
ok(own.every((id) => ["explain", "mistakes", "talk"].every((k) => Array.isArray(guides[id][k]) && guides[id][k].length >= 2 && guides[id][k].every((t) => !odd(t) && t.length > 20))), "and each has at least two things to say, to watch for and to ask");
ok(own.every((id) => PG.build(lessons.find((l) => l.id === id), guides).written === true) && PG.build(lessons.find((l) => !guides[l.id]), guides).written === false, "a written guide is used, and a lesson without one gets one made from its text");

// the guide made from the text of a lesson uses what the lesson says
const div = lessons.find((l) => l.id === "division-med-rest");
const made = PG.build(div, {});
ok(/^Börja med frågan barnet möter: /.test(made.explain[0]) && /Regeln: Resten är alltid mindre/.test(made.explain.join(" ")) && /^Exempel: 23 delat med 4/.test(made.explain[made.explain.length - 1]), "it starts with the problem, and has the rule and the example");
ok(made.mistakes.some((t) => /Svarar barnet ”3” får barnet tipset/.test(t)), "and the hints for wrong answers become what to watch for");

console.log(failures ? "\n" + failures + " FAILED" : "\nAll guide checks passed");
process.exit(failures ? 1 : 0);
