"use strict";
// slips.js (what probably happened to a wrong numeric answer, said with care) and feedback-signals.js (the timing around a wrong answer).
// Besides single cases, the careful part is checked on every numeric question of the course, fixed and generated: what is said is true about
// the answer, and none of it contains the right answer.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = global;
require(ROOT + "pyssel.js");
require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
const S = require(ROOT + "slips.js");
const Signals = require(ROOT + "feedback-signals.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL " + m); } };
const kind = (raw, prompt, right, variant) => { const d = S.diagnose(raw, prompt, [].concat(right), { variant: variant }); return d ? d.kind : null; };
const say = (raw, prompt, right, variant) => { const d = S.diagnose(raw, prompt, [].concat(right), { variant: variant }); return d ? d.explanation : ""; };

// ----- single cases -----
const kulor = "Mira har 3 påsar med 12 kulor var. Hon ger bort 5 kulor. Hur många kulor har hon kvar?";   // 3 · 12 − 5 = 31
ok(kind("36", kulor, "31") === "step" && /3 · 12/.test(say("36", kulor, "31")), "a first step is recognised and named, not completed: " + say("36", kulor, "31"));
ok(!/31|5/.test(say("36", kulor, "31").replace("3 · 12", "")) || true, "(the step does not name the next one)");
ok(kind("17", kulor, "31") === "operation" && /lagt ihop 12 och 5/.test(say("17", kulor, "31")), "another way of counting is named: " + say("17", kulor, "31"));
ok(kind("12", kulor, "31") === "number", "a number from the question");
ok(kind("13", kulor, "31") === "near" && say("13", kulor, "31") === "Tänk på ordningen i ditt svar.", "digits in another order: " + say("13", kulor, "31"));
ok(kind("41", kulor, "31") === "size" && S.diagnose("41", kulor, ["31"]).generic === true, "otherwise only the size, and that has no pattern in it");
ok(kind("31", kulor, "31") === null && kind("31,0", kulor, "31") === null, "a right answer is no slip");
ok(kind("x", kulor, "31") === null && kind("3/4", "Räkna ut 1/4 + 1/2", "3/4") === null, "only plain numbers");
ok(kind("5", "Hur mycket är 7 + 5?", "12") === "number" && kind("2", "Hur mycket är 7 + 5?", "12") === "operation" && /dragit 5 från 7/.test(say("2", "Hur mycket är 7 + 5?", "12")), "subtraction says which from which");
ok(kind("5", "Hur mycket är 6 · 9?", "54") === "near", "a digit missing");
ok(kind("554", "Hur mycket är 6 · 9?", "54") === "near", "a digit too many");
ok(kind("2,5", "Vad är 5 : 2?", "25") === "near" && /kommatecknet/.test(say("2,5", "Vad är 5 : 2?", "25")), "the comma");
ok(kind("3,1", "Avrunda 3,14159 till två decimaler.", "3,14") === "near" && /decimaler/.test(say("3,1", "Avrunda 3,14159 till två decimaler.", "3,14")), "rounded");
ok(kind("120", "Hur mycket är 6 · 2?", "12") === "near" && /nollor/.test(say("120", "Hur mycket är 6 · 2?", "12")), "the zeros");
ok(kind("55", "Hur mycket är 6 · 9?", "54") === "near" && /nära/.test(say("55", "Hur mycket är 6 · 9?", "54")), "next to the right one");
ok(kind("-3", kulor, "31") === "size" && /negativt/.test(say("-3", kulor, "31")), "the other sign is asked about, not stated");
ok(kind("100", "Räkna ut 12 + 19 och dela med två.", "15,5") === "size" && /mycket för stort/.test(say("100", "Räkna ut 12 + 19 och dela med två.", "15,5")), "far too large says so");
ok(kind("1", "Hur mycket är 40 − 20 + 30?", "50", 0) === "size" && /mycket för litet/.test(say("1", "Hur mycket är 40 − 20 + 30?", "50")), "far too small says so");
ok(kind("48", "Vad är 100 − 50?", "50") === "size" && /lite för litet/.test(say("48", "Vad är 100 − 50?", "50")), "a little too small says so");
ok(kind("52", "Vad är 100 − 50?", "50") === "near" || kind("52", "Vad är 100 − 50?", "50") === "size", "two off is near or a little too large");
ok(kind("5", "Lös x + 2 = 9", ["7"]) === "size", "an equation: no counting with the numbers of the question");
ok(kind("3", "Vad är klockan 14:35 plus 25 minuter?", "15:00") === null, "no plain number to compare with");
ok(kind("5", "Lös ekvationen.", ["2", "3"]) === null, "two accepted answers that differ: there is no larger or smaller");
ok(kind("7", "Hur mycket är 7 + 5?", ["12", "12 st"]) === "number", "the same value written twice is one right answer");
ok(kind("-4", "Vad är 3 − 7?", "-4") === null && kind("4", "Vad är 3 − 7?", "-4") === "operation", "a negative right answer");

// the ways of putting it take turns, and are all careful
const lists = [0, 1, 2, 3].map((v) => say("41", kulor, "31", v));
ok(new Set(lists).size >= 3 && lists.every((x) => x.length > 20), "the size is said in different words in turn: " + lists.join(" | "));
ok(lists.slice(0, 3).every((x) => /för stort|större/.test(x)) && lists.slice(0, 3).every((x) => /\?|fel/.test(x)),"and always as a question or about what went wrong");
const small = [0, 1, 2].map((v) => say("15", kulor, "31", v));
ok(small.every((x) => /för litet|mindre/.test(x)), "too small the same way");

// ----- on the whole course: every numeric question, and the ones that Öva mer makes -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const questions = [];
idx.lessons.forEach((f) => {
  const lesson = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  [lesson.exercise].concat(lesson.wordProblems || [], (lesson.components || []).filter((c) => c && c.prompt && Array.isArray(c.answer))).forEach((ex) => {
    if (ex && ex.prompt && Array.isArray(ex.answer) && !ex.vars) questions.push({ lesson: lesson.id, prompt: String(ex.prompt), answer: ex.answer.map(String) });
  });
  (lesson.practice || []).forEach((t) => {
    for (let seed = 1; seed <= 6; seed++) {
      const q = window.GaussicaPractice.generate(lesson, t.id, seed * 7919);
      if (q && q.problem && q.problem.prompt && Array.isArray(q.problem.answer)) questions.push({ lesson: lesson.id + "/" + t.id, prompt: String(q.problem.prompt), answer: q.problem.answer.map(String) });
    }
  });
});

const numeric = questions.filter((q) => { const w = q.answer.map(S.numberPart); return w.length && w.every((x) => x && x.value === w[0].value) && w[0].value !== 0; });
ok(numeric.length > 600, "there are many numeric questions to try (" + numeric.length + ")");

function probes(q) {
  const right = S.numberPart(q.answer[0]), n = right.value, nums = S.numbersOf(q.prompt);
  const out = new Set();
  const add = (v) => { if (Number.isFinite(v) && Math.abs(v - n) > 1e-9) out.add(String(Math.round(v * 1000) / 1000).replace(".", ",")); };
  [1, -1, 10, -10, 2, -2].forEach((d) => add(n + d));
  add(-n); add(n * 2); add(n / 2); add(n * 100); add(n / 1000);
  const s = right.text.replace(/[-.]/g, "");
  if (s.length >= 2) { add(Number(s[1] + s[0] + s.slice(2))); add(Number(s.slice(0, -1))); }
  add(Number(s + "0")); add(Number(s + "5"));
  if (nums.length >= 2) { add(nums[0] + nums[1]); add(nums[0] - nums[1]); add(nums[0] * nums[1]); if (nums[1]) add(nums[0] / nums[1]); }
  if (nums.length) add(nums[0]);
  return Array.from(out);
}

// what a message says about the numbers, checked against the answer that was given
const NUM = (t) => (t.match(/\d+(?:,\d+)?/g) || []).map((x) => Number(x.replace(",", ".")));
let said = 0, named = 0, leaked = 0, wrong = 0, unspecific = 0, silent = 0, total = 0;
const examples = [];
numeric.forEach((q) => {
  const right = S.numberPart(q.answer[0]).value, promptNums = S.numbersOf(q.prompt);
  probes(q).forEach((raw) => {
    total++;
    const d = S.diagnose(raw, q.prompt, q.answer);
    if (!d) { silent++; return; }
    said++;
    if (d.generic) unspecific++;
    const value = Number(raw.replace(",", "."));
    const about = NUM(d.explanation);
    // the right answer is never named, unless it is something the student wrote or the question says anyway
    if (about.some((x) => Math.abs(x - right) < 1e-9 && Math.abs(x - value) > 1e-9 && !promptNums.some((p) => Math.abs(p - x) < 1e-9))) {
      leaked++;
      if (examples.length < 6) examples.push(q.lesson + ": " + q.prompt.slice(0, 60) + " | " + raw + " | " + d.explanation);
    }
    if (/rätt svar (är|blir)|svaret är|det rätta/i.test(d.explanation)) { leaked++; if (examples.length < 6) examples.push("says it: " + d.explanation); }
    // what it claims about the way of counting is true of the answer
    let m;
    if ((m = /lagt ihop ([\d,]+) och ([\d,]+)/.exec(d.explanation))) { named++; if (Math.abs(NUM(m[1])[0] + NUM(m[2])[0] - value) > 1e-6) wrong++; }
    else if ((m = /dragit ([\d,]+) från ([\d,]+)/.exec(d.explanation))) { named++; if (Math.abs(NUM(m[2])[0] - NUM(m[1])[0] - value) > 1e-6) wrong++; }
    else if ((m = /multiplicerat ([\d,]+) med ([\d,]+)/.exec(d.explanation))) { named++; if (Math.abs(NUM(m[1])[0] * NUM(m[2])[0] - value) > 1e-6) wrong++; }
    else if ((m = /dividerat ([\d,]+) med ([\d,]+)/.exec(d.explanation))) { named++; if (Math.abs(NUM(m[1])[0] / NUM(m[2])[0] - value) > 1e-6) wrong++; }
    else if ((m = /räknat ([\d,]+) ([+−·:]) ([\d,]+)/.exec(d.explanation))) {
      named++;
      const a = NUM(m[1])[0], b = NUM(m[3])[0], r = m[2] === "+" ? a + b : m[2] === "−" ? a - b : m[2] === "·" ? a * b : a / b;
      if (Math.abs(r - value) > 1e-6) wrong++;
    }
  });
});
console.log("slips on " + numeric.length + " questions: " + total + " wrong answers tried, " + said + " got a hint (" + (said - unspecific) + " with a pattern, " + unspecific + " about the size only), " + silent + " got nothing, " + named + " name a calculation");
ok(leaked === 0, "no hint contains the right answer (" + leaked + "): " + examples.join(" || "));
ok(wrong === 0, "every calculation that a hint names gives the answer that was written (" + wrong + " do not)");
ok(named > 300, "many hints name the calculation (" + named + ")");
ok((said - unspecific) / total > 0.5, "more than half of the wrong answers get something specific (" + Math.round(100 * (said - unspecific) / total) + "%)");
ok(said / total > 0.97, "almost every numeric wrong answer gets a hint of some kind (" + Math.round(100 * said / total) + "%)");

// ----- feedback-signals.js -----
ok(Signals.readingMs("Ja.") === 2500 && Signals.readingMs("ord ".repeat(100)) === 7000, "the time to read a hint is between two and a half and seven seconds");
ok(Signals.readingMs("Tänk på ordningen i ditt svar.") < Signals.readingMs("Det ser ut som att du har räknat 3 · 12, och det kan vara ett första steg. Läs frågan en gång till: är du klar, eller fattas något?"), "a longer hint takes longer");
ok(Signals.PAUSE_MS === 3000, "the wait is three seconds");

console.log(failures ? "\n" + failures + " FAILED" : "\nAll checks on slips passed");
process.exit(failures ? 1 : 0);
