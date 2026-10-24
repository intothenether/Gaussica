"use strict";
// Checks every lesson file: the index, required fields, prerequisites, answers and hints, and text hygiene.
// Run with: npm test (or node tests/lessons.js)
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..") + "/";
const S = require(ROOT + "symbolic-math.js");

const problems = [];
const warnings = [];
const bad = (id, msg) => problems.push(id + ": " + msg);
const warn = (id, msg) => warnings.push(id + ": " + msg);

// ---- the index and the files ----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
const listed = new Set();
idx.lessons.forEach((f) => {
  if (listed.has(f)) bad("index", "listed twice: " + f);
  listed.add(f);
  if (!fs.existsSync(ROOT + "lessons/" + f)) bad("index", "file is listed but missing: " + f);
});
fs.readdirSync(ROOT + "lessons").filter((f) => f.endsWith(".json") && f !== "index.json").forEach((f) => {
  if (!listed.has(f)) bad("index", f + " exists but is not listed in lessons/index.json");
});

const lessons = [];
idx.lessons.forEach((f) => {
  try { lessons.push(JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"))); } catch (e) { bad(f, "invalid JSON: " + e.message); }
});
const byId = new Map(lessons.map((l) => [l.id, l]));
const areas = new Set(idx.areas.map((a) => a.id));

// ---- structure (mirrors validateCourse in app.js) ----
const seen = new Set();
lessons.forEach((l) => {
  if (seen.has(l.id)) bad(l.id, "duplicate id");
  seen.add(l.id);
  if (!l.id || !l.title || !l.area || !Array.isArray(l.prerequisites) || !l.exercise || !Array.isArray(l.exercise.answer) || !Array.isArray(l.exercise.feedback)) bad(l.id, "missing required field");
  if (!areas.has(l.area)) bad(l.id, "unknown area " + l.area);
  if (!Number.isFinite(Number(l.grade))) bad(l.id, "grade is not a number");
  (l.prerequisites || []).forEach((p) => { if (!byId.has(p)) bad(l.id, "unknown prerequisite " + p); });
  (l.wordProblems || []).forEach((p, i) => { if (!p.prompt || !Array.isArray(p.answer) || !p.answer.length || !Array.isArray(p.feedback)) bad(l.id, "word problem " + (i + 1) + " invalid"); });
  (l.layout || []).forEach((key) => {
    const m = /^(comp|word):(\d+)$/.exec(key);
    if (m && !((m[1] === "comp" ? l.components : l.wordProblems) || [])[Number(m[2])]) bad(l.id, "layout points at a block that does not exist: " + key);
  });
  (l.components || []).forEach((c, i) => {
    if (c.type === "koppla" && !(Array.isArray(c.pairs) && c.pairs.length >= 2)) bad(l.id, "koppla block " + i + " needs at least two pairs");
    if (c.type === "begreppskort" && !(Array.isArray(c.cards) && c.cards.length)) bad(l.id, "begreppskort block " + i + " has no cards");
  });
  if (l.parentId) {
    const parent = byId.get(l.parentId);
    if (!parent) bad(l.id, "parent " + l.parentId + " not found");
    else if (!(parent.subLessons || []).some((s) => s.id === l.id)) bad(l.id, "parent " + l.parentId + " does not list it");
  }
  (l.subLessons || []).forEach((sub) => {
    const c = byId.get(sub.id);
    if (!c) bad(l.id, "sub-lesson " + sub.id + " missing");
    else if (c.parentId !== l.id) bad(l.id, "sub-lesson " + sub.id + " has parentId " + c.parentId);
  });
});

// ---- no cycles in the prerequisites ----
const state = new Map();
function visit(id, trail) {
  if (state.get(id) === 2) return;
  if (state.get(id) === 1) { bad(id, "cycle via " + trail.join(">")); return; }
  state.set(id, 1);
  ((byId.get(id) || {}).prerequisites || []).forEach((p) => byId.has(p) && visit(p, trail.concat(p)));
  state.set(id, 2);
}
lessons.forEach((l) => visit(l.id, [l.id]));

// ---- text hygiene: the multiplication dot, no em dashes ----
function strings(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.keys(value).forEach((k) => strings(value[k], out));
  return out;
}
lessons.forEach((l) => {
  strings(l, []).forEach((s) => {
    if (s.indexOf("×") >= 0) bad(l.id, "uses the times sign, write the multiplication dot instead: " + s.slice(0, 60));
    if (s.indexOf("—") >= 0) bad(l.id, "uses an em dash: " + s.slice(0, 60));
  });
});

// ---- answers and hints ----
let tasks = 0, hints = 0;
function checkTask(l, name, t) {
  tasks++;
  if (!t.answer.length) return bad(l.id, name + ": no accepted answer");
  const numeric = (s) => /^-?\d+([.,]\d+)?$/.test(String(s).trim());
  t.answer.forEach((a) => {
    if (!S.areEquivalent(a, a)) bad(l.id, name + ": answer '" + a + "' not accepted as typed");
    if (numeric(a) && numeric(t.answer[0]) && !S.areEquivalent(a, t.answer[0])) bad(l.id, name + ": '" + a + "' differs from '" + t.answer[0] + "'");
  });
  t.feedback.forEach((f) => {
    hints++;
    if (!f.message || !f.answers || !f.answers.length) bad(l.id, name + ": empty hint");
    (f.answers || []).forEach((w) => {
      t.answer.forEach((a) => { if (S.areEquivalent(w, a)) bad(l.id, name + ": hint answer '" + w + "' equals accepted answer '" + a + "'"); });
    });
  });
  if (!t.prompt || t.prompt.length < 10) bad(l.id, name + ": prompt too short");
  if (!t.correct) bad(l.id, name + ": no 'correct' message");
}
lessons.forEach((l) => {
  checkTask(l, "exercise", l.exercise);
  (l.wordProblems || []).forEach((p, i) => checkTask(l, "word " + (i + 1), p));
  const play = l.kind === "pyssel" || l.kind === "begrepp";
  if (!l.isParentLesson && (l.wordProblems || []).length < (play ? 2 : 3)) warn(l.id, "has " + (l.wordProblems || []).length + " word problems, 3 are expected");
  if (!l.summary || !l.explanation || (!play && (!l.rule || !l.example))) bad(l.id, "missing text field");
});

console.log(lessons.length + " lessons, " + tasks + " tasks, " + hints + " hints checked");
if (warnings.length) console.log("Warnings (" + warnings.length + "):\n  " + warnings.join("\n  "));
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "NO PROBLEMS FOUND");
process.exit(problems.length ? 1 : 0);
