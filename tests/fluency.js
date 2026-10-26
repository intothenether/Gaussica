"use strict";
// Snabbträning: the facts are right, shaky facts come back more, quick ones less, and what is remembered is updated sensibly.
global.window = {};
global.document = { createElement: () => ({}) };
const F = require("../fluency.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

// ----- the facts -----
const evalPrompt = (f) => {
  const m = /^(\d+) ([·+−]) (\d+)$/.exec(f.prompt);
  if (m) { const a = Number(m[1]), b = Number(m[3]); return m[2] === "·" ? a * b : m[2] === "+" ? a + b : a - b; }
  const d = /^(\d+)\/(\d+)$/.exec(f.prompt);
  if (d) return Number(d[1]) / Number(d[2]);
  const q = /^(\d+) \+ \? = (\d+)$/.exec(f.prompt);
  if (q) return Number(q[2]) - Number(q[1]);
  return NaN;
};
F.SETS.forEach((s) => {
  const list = F.facts(s.id);
  ok(list.length >= 9, s.id + ": enough facts (" + list.length + ")");
  ok(new Set(list.map((f) => f.id)).size === list.length, s.id + ": every fact has its own id");
  list.forEach((f) => {
    ok(evalPrompt(f) === f.answer, s.id + ": " + f.prompt + " has the answer " + f.answer);
    // both ways round
    for (let i = 0; i < 8; i++) { const q = F.asked(f, () => i / 8); ok(evalPrompt(q) === q.answer, s.id + ": the other way round " + q.prompt + " = " + q.answer); }
    ok(!/[×—]/.test(f.prompt), "no times sign or em dash in " + f.prompt);
  });
});
ok(F.facts("mul").length === 45 && F.facts("mul", { tables: [7] }).every((f) => f.a === 7 || f.b === 7) && F.facts("mul", { tables: [7] }).length === 9, "the 7 table has nine facts");
ok(F.facts("tio").length === 9 && F.facts("tjugo").length === 9, "the friends of ten and twenty");

// ----- what is remembered -----
const now = 1000000000000;
let s = F.update(null, true, 2000, now, "mul");
ok(s.n === 1 && s.ok === 1 && s.box === 1 && s.ms === 2000 && s.due === now + F.INTERVALS[1], "a quick right answer moves up one box: " + JSON.stringify(s));
s = F.update(s, true, 2500, now, "mul"); s = F.update(s, true, 2500, now, "mul"); s = F.update(s, true, 2500, now, "mul");
ok(s.box === 4 && F.mastery(s) === "fast", "four quick answers make a fact fast");
s = F.update(s, false, 9000, now, "mul");
ok(s.box === 0 && s.streak === 0 && F.mastery(s) === "shaky", "a wrong answer sends it back to shaky");
const slow = F.update(null, true, 20000, now, "mul");
ok(slow.box === 1 && F.mastery(slow) === "learning", "right but slow is not shaky, but not quick either");
ok(F.mastery(null) === "new" && F.mastery({ n: 3, box: 3 }) === "secure", "mastery names");
ok(F.update(null, true, 3000, now, "tio").box === 1 && F.update(null, true, 3600, now, "tio").box === 1 && F.update({ n: 1, box: 2 }, true, 3600, now, "tio").box === 2, "the limit for quick is lower for the friends of ten");

// ----- choosing facts for a round -----
let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const rec = { facts: {} };
F.facts("mul").forEach((f) => { rec.facts[f.id] = { n: 5, ok: 5, ms: 2000, box: 4, due: now + 86400000 * 30, last: now, streak: 5 }; });
const shaky = ["m-6-7", "m-7-8", "m-6-8"];
shaky.forEach((id) => { rec.facts[id] = { n: 4, ok: 1, ms: 9000, box: 0, due: 0, last: now - 86400000, streak: 0 }; });
const picked = {};
for (let i = 0; i < 300; i++) F.plan(rec, "mul", { n: 10, rand, now }).forEach((f) => { picked[f.id] = (picked[f.id] || 0) + 1; });
const shakyCount = shaky.reduce((n, id) => n + (picked[id] || 0), 0) / shaky.length;
const otherIds = Object.keys(picked).filter((id) => !shaky.includes(id));
const otherCount = otherIds.reduce((n, id) => n + picked[id], 0) / 42;
ok(shakyCount >= 285 && otherCount < shakyCount / 4, "shaky facts are in nearly every round, the quick ones are not: " + shakyCount.toFixed(0) + " of 300 rounds against " + otherCount.toFixed(1));
const one = F.plan(rec, "mul", { n: 10, rand, now });
ok(one.length === 10 && new Set(one.map((f) => f.id)).size === 10, "a round has ten different facts");
ok(F.plan({ facts: {} }, "tio", { n: 20, rand }).length === 9, "a set smaller than the round gives all its facts");
const fresh = F.plan({ facts: {} }, "mix", { n: 10, rand, now });
ok(fresh.length === 10, "a mixed round for a new student");
// new facts are limited when there are many known ones
const half = { facts: {} };
F.facts("mul").slice(0, 30).forEach((f) => { half.facts[f.id] = { n: 3, ok: 3, ms: 2500, box: 2, due: now - 1000, last: now - 86400000, streak: 3 }; });
let maxNew = 0;
for (let i = 0; i < 200; i++) maxNew = Math.max(maxNew, F.plan(half, "mul", { n: 10, rand, now }).filter((f) => !half.facts[f.id]).length);
ok(maxNew <= 4, "no more than 4 of 10 are new: " + maxNew);

// ----- after a round -----
const f1 = F.facts("mul")[0], f2 = F.facts("mul")[1], f3 = F.facts("mul")[2];
const after = F.applyRound(null, "mul", [
  { fact: f1, correct: true, ms: 2000 }, { fact: f2, correct: false, ms: 6000 }, { fact: f2, correct: true, ms: 1500, retry: true }, { fact: f3, correct: true, ms: 3000 }
], now);
ok(after.facts[f1.id].box === 1 && after.facts[f2.id].box === 0 && after.facts[f2.id].n === 1, "the second try after a wrong answer is not counted");
ok(after.sessions.length === 1 && after.sessions[0].n === 3 && after.sessions[0].ok === 2 && after.sessions[0].ms === 2500, "the round is written down: " + JSON.stringify(after.sessions[0]));
ok(F.previousSession(after, "mul").ms === 2500 && F.previousSession(after, "tio") === null, "the last round of a set is found");
let many = null;
for (let i = 0; i < 60; i++) many = F.applyRound(many, "mul", [{ fact: f1, correct: true, ms: 2000 }], now + i);
ok(many.sessions.length === 40, "only the last 40 rounds are kept");

// ----- progress -----
const sm = F.summary(rec, "mul");
ok(sm.total === 45 && sm.counts.shaky === 3 && sm.counts.fast === 42 && sm.practised === 45 && sm.avgMs > 0, "summary of a set: " + JSON.stringify(sm.counts));
ok(F.summary({ facts: {} }, "mix").practised === 0, "nothing practised yet");
ok(/Inte tränat/.test(F.teacherLine({ facts: {} })) && /snabba/.test(F.teacherLine(rec)), "the line for the teacher");
ok(F.solved({ prompt: "3 + ? = 10", answer: 7 }) === "3 + 7 = 10" && F.solved({ prompt: "7 · 8", answer: 56 }) === "7 · 8 = 56", "a fact written out");

console.log(failures ? failures + " FAILED" : "All fluency checks passed");
process.exit(failures ? 1 : 0);
