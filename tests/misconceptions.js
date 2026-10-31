"use strict";
// Common mistakes in numbers (misconceptions.js): a wrong answer that is exactly what a known mistake gives is recognised, and anything else is not.
const M = require("../misconceptions.js");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

// [prompt, what the student wrote, the right answer, the title that is expected (null = nothing is said)]
const CASES = [
  // adding and subtracting
  ["Räkna ut 358 + 176.", "424", "534", "Glömde att växla"],
  ["Räkna ut 358 + 176.", "534", "534", null],
  ["Räkna ut 358 + 176.", "999", "534", null],
  ["Räkna ut 502 − 278.", "376", "224", "Minskade det mindre talet från det större"],
  ["Räkna ut 502 − 278.", "224", "224", null],
  ["Vad är 12 − 30?", "18", "-18", "Vände på subtraktionen"],
  // multiplying and dividing
  ["Räkna ut 23 · 14.", "115", "322", "Glömde flytta ett steg"],
  ["Räkna ut 23 · 14.", "322", "322", null],
  ["Hur mycket är 7 · 8?", "15", "56", "Lade ihop i stället för att multiplicera"],
  ["Vad är 7 : 21?", "3", "1/3", "Delade tvärtom"],
  ["Räkna ut 12 · 3 + 4.", "15", "40", null],
  // fractions
  ["Vad är 1/2 + 1/3? Skriv svaret som ett bråk.", "2/5", "5/6", "Lade ihop täljarna och nämnarna"],
  ["Vad är 1/2 + 1/3? Skriv svaret som ett bråk.", "5/6", "5/6", null],
  ["Vad är 3/4 − 1/2? Skriv svaret som ett bråk.", "2/2", "1/4", "Tog bort täljare och nämnare var för sig"],
  ["Vad är 1/2 + 1/4? Skriv svaret som ett bråk.", "2/4", "3/4", "Räknade med olika stora delar"],
  ["Vad är 1/2 + 1/4? Skriv svaret som ett bråk.", "3/4", "3/4", null],
  ["Vad är 1/2 + 1/4? Skriv svaret som ett bråk.", "7/8", "3/4", null],
  // decimals
  ["Vilket tal är störst: 0,5 eller 0,25?", "0,25", "0,5", "Trodde att fler decimaler betyder större"],
  ["Vilket tal är störst: 0,5 eller 0,25?", "0,5", "0,5", null],
  ["Vilket tal är minst: 0,7 eller 0,65?", "0,7", "0,65", "Trodde att fler decimaler betyder större"],
  // negative numbers
  ["Vad är −3 + 5?", "-8", "2", "Lade ihop talen och behöll minus"],
  ["Vad är −3 + 5?", "8", "2", "Räknade utan minustecknen"],
  ["Vad är 4 − (−2)?", "2", "6", "Minus och minus blev bara minus"],
  // percent
  ["Vad är 20 % av 50?", "1000", "10", "Glömde dela med 100"],
  ["Vad är 20 % av 50?", "2,5", "10", "Delade med procenttalet"],
  ["Vad är 20 % av 50?", "20", "10", "Svarade med procenttalet"],
  ["Vad är 20 % av 50?", "10", "10", null],
  // units
  ["Hur många centimeter är 3 meter?", "30", "300", "Fel växlingstal mellan enheterna"],
  ["Hur många centimeter är 3 meter?", "3000", "300", "Fel växlingstal mellan enheterna"],
  ["Hur många deciliter är 3 liter?", "300", "30", "Fel växlingstal mellan enheterna"],
  ["Hur många gram är 2 kilogram?", "20", "2000", "Fel växlingstal mellan enheterna"],
  ["Hur många centimeter är 3 meter?", "300", "300", null],
  // place value
  ["Vad är 6:ans värde i talet 2 643?", "6", "600", "Svarade med siffran i stället för dess värde"],
  ["Vad är 6:ans värde i talet 2 643?", "60", "600", "Räknade med fel plats"],
  ["Vad är 6:ans värde i talet 2 643?", "600", "600", null],
  // time
  ["Klockan är 14:35. Vad är klockan 40 minuter senare? Svara HH:MM.", "14:75", "15:15", "Räknade som om en timme har 100 minuter"],
  ["Klockan är 14:35. Vad är klockan 40 minuter senare? Svara HH:MM.", "15:75", "15:15", "Räknade som om en timme har 100 minuter"],
  ["Klockan är 14:35. Vad är klockan 40 minuter senare? Svara HH:MM.", "15:15", "15:15", null],
  // things that are not mistakes of this kind
  ["Mira har 5 äpplen och får 3 till. Hur många har hon?", "53", "8", null],
  ["Skriv 4 500 000 i grundpotensform.", "45", "4,5*10^6", null],
  ["", "5", "5", null]
];

CASES.forEach(([prompt, raw, expected, title]) => {
  const d = M.diagnose(raw, prompt, [expected]);
  const got = d ? d.title : null;
  ok(got === title, (title ? "'" + title + "'" : "nothing") + " for " + JSON.stringify(raw) + " in " + JSON.stringify(prompt.slice(0, 46)) + (got === title ? "" : " (got " + JSON.stringify(got) + ")"));
});

// what is said is a sentence the student can use, and has no loose ends
const all = CASES.map(([p, r, e]) => M.diagnose(r, p, [e])).filter(Boolean);
ok(all.length >= 24 && all.every((d) => d.explanation.length > 40 && !/undefined|NaN/.test(d.title + d.explanation)), "every explanation is a full sentence without NaN or undefined (" + all.length + " of them)");
ok(all.every((d) => !/×| x /.test(d.explanation)), "and uses the dot for multiplication");

console.log(failures ? "\n" + failures + " FAILED" : "\nAll misconception checks passed");
process.exit(failures ? 1 : 0);
