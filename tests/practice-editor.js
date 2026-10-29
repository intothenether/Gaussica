"use strict";
// The ready-made templates in the lesson editor's gallery must all pass the editor's own check,
// and the check must catch the usual mistakes.
const ROOT = require("path").join(__dirname, "..") + "/";
global.window = global;
global.document = { createElement: () => ({}) };
require(ROOT + "pyssel.js");
window.MATTE_SYMBOLIC = require(ROOT + "symbolic-math.js");
require(ROOT + "practice.js");
require(ROOT + "lesson-model.js");
require(ROOT + "formats.js");
require(ROOT + "practice-editor.js");
const PE = window.GaussicaPracticeEditor;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

PE.STARTERS.forEach((s) => {
  const r = PE.check(Object.assign({ id: s.id }, s.template));
  ok(!r.errors.length && !r.warnings.length, "starter " + s.id + ": " + r.errors.concat(r.warnings).join(" | "));
});
ok(PE.STARTERS.some((s) => Array.isArray(s.template.statements)) && PE.STARTERS.some((s) => s.template.mode === "santfalskt"), "the gallery has both kinds of true/false starters");
PE.FIGURES.forEach((f) => ok(window.GaussicaFigures === undefined || f.json.type, "figure preset has a type"));

ok(["sortera", "ordna", "hittafelet", "lucktext"].every((m) => PE.STARTERS.some((s) => s.template.mode === m)), "the gallery has a starting point for each of the new formats");
const fmt = (t) => PE.check(Object.assign({ id: "f" }, t));
const sortS = PE.STARTERS.find((s) => s.template.mode === "sortera").template;
ok(!fmt(Object.assign({}, sortS, { pool: [{ text: "a", category: 0 }] })).errors.length === false, "a list of one is an error");
ok(fmt(Object.assign({}, sortS, { pool: sortS.pool.map((p) => Object.assign({}, p, { category: 0 })) })).errors.some((e) => /samma grupp/.test(e)), "sortera: everything in one group is an error");
ok(fmt(Object.assign({}, sortS, { pool: sortS.pool.map((p, i) => Object.assign({}, p, { category: i === 0 ? 5 : p.category })) })).errors.some((e) => /grupp som inte finns/.test(e)), "sortera: a group that does not exist is an error");
const ordS = PE.STARTERS.find((s) => s.template.mode === "ordna").template;
ok(fmt(Object.assign({}, ordS, { pool: ordS.pool.map((p) => ({ text: p.text, value: 1 })) })).errors.length > 0, "ordna: nothing to put in order (the same value for all) is an error");
const hfS = PE.STARTERS.find((s) => s.template.mode === "hittafelet").template;
ok(fmt(Object.assign({}, hfS, { pool: hfS.pool.map((p) => Object.assign({}, p, { wrong: 9 })) })).errors.length > 0, "hitta felet: a wrong step that does not exist is an error");
ok(fmt(Object.assign({}, hfS, { pool: hfS.pool.slice(0, 2) })).warnings.some((w) => /för lika/.test(w)), "hitta felet: two solutions are too few (a warning)");
const ltS = PE.STARTERS.find((s) => s.template.mode === "lucktext").template;
ok(fmt(Object.assign({}, ltS, { text: "{w} veckor är [[1]] dagar." })).errors.some((e) => /lika många|Det går inte att skapa/.test(e)), "lucktext: a gap too few is an error");
ok(fmt(Object.assign({}, ltS, { blanks: [{ answer: ["=zzz*7"] }, { answer: ["=d*24"] }] })).errors.length > 0, "lucktext: an answer that cannot be worked out is an error");
ok(fmt(Object.assign({}, ltS, { text: "" })).errors.length > 0, "lucktext: no text is an error");

const has = (t, kind) => PE.check(Object.assign({ id: "t", vars: { a: [1, 9] }, prompt: "Vad är {a}?", answer: ["=a"] }, t))[kind];
ok(has({ prompt: "" }, "errors").length, "an empty question is an error");
ok(has({ answer: [] }, "errors").length, "no answer is an error");
ok(has({ id: "två ord" }, "errors").length, "a bad template name is an error");
ok(has({ prompt: "Vad är {zzz}?" }, "errors").length, "an unknown variable in the question is an error");
ok(has({ vars: { a: [1, 9] }, where: [{ expr: "a", min: 100 }] }, "errors").length, "conditions that never hold are an error");
ok(has({ feedback: [{ answers: ["=a"], message: "Fel" }] }, "errors").length === 0, "a hint equal to the answer is dropped when questions are built");
ok(has({ vars: {} , prompt: "Vad är 2+2?", answer: ["4"] }, "warnings").length, "a question that never changes gets a warning");
ok(has({ prompt: "Räkna 2 × {a}." }, "warnings").length, "the times sign gets a warning");
const cleaned = PE.clean([{ id: "t", vars: {}, pick: {}, derive: [{ name: "", expr: "" }], where: [], feedback: [{ answers: [], message: "x" }], prompt: "p", answer: [" 1 ", ""], form: "", visual: null }]);
ok(JSON.stringify(cleaned) === JSON.stringify([{ id: "t", prompt: "p", answer: ["1"] }]), "clean removes empty parts: " + JSON.stringify(cleaned));
ok(PE.problems({ practice: [{ id: "a", prompt: "x", answer: ["1"] }, { id: "a", prompt: "y", answer: ["1"] }] }).some((m) => /heter/.test(m)), "two templates with the same name are reported");

console.log(failures ? failures + " FAILED" : "All practice-editor checks passed");
process.exit(failures ? 1 : 0);
