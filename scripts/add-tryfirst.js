"use strict";
// Adds "Prova först" (lesson.tryFirst: the problem of the lesson to try before the explanation, nothing counted) to the lessons that have it: node scripts/add-tryfirst.js
// A pilot: a handful of lessons whose explanation starts with a problem that a student can have a go at. A lesson that has one is left as it is.
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "lessons");

const TRY = {
  "uttryck-med-x": { prompt: "Jag tänker på ett tal. Lägger jag till 3 blir det 10. Vilket tal tänker jag på?", answer: ["7", "x=7", "x = 7"] },
  "negativa-tal": { prompt: "Det är 3 grader ute på morgonen och temperaturen sjunker med 5 grader. Vilken temperatur är det då? Skriv med minustecken om det behövs.", answer: ["-2", "−2"] },
  "pengar-vaxel": { prompt: "Du köper en bok för 37 kronor och betalar med en 50-lapp. Hur många kronor ska du få tillbaka?", answer: ["13"] },
  "avrundning-overslag": { prompt: "Du har 100 kr och vill köpa en tröja för 39 kr och en mössa för 52 kr. Räcker pengarna? Svara ja eller nej.", answer: ["ja"] },
  "division-med-rest": { prompt: "17 kakor delas lika på 5 barn. Hur många kakor får varje barn?", answer: ["3", "tre"] }
};

let added = 0, skipped = 0;
Object.keys(TRY).forEach((id) => {
  const file = path.join(DIR, id + ".json");
  const text = fs.readFileSync(file, "utf8");
  if (/"tryFirst"\s*:/.test(text)) { skipped++; return; }
  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const lf = text.replace(/\r\n/g, "\n");
  const m = /^  "check":/m.exec(lf) || /^  "exercise":/m.exec(lf);
  if (!m) throw new Error("no place for tryFirst in " + id);
  const block = '  "tryFirst": ' + JSON.stringify(TRY[id], null, 2).replace(/\n/g, "\n  ") + ",\n";
  const out = lf.slice(0, m.index) + block + lf.slice(m.index);
  fs.writeFileSync(file, eol === "\r\n" ? out.replace(/\n/g, "\r\n") : out);
  added++;
});
console.log(added + " lessons got tryFirst, " + skipped + " had it already");
