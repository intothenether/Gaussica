"use strict";
// Which wrong answers only got the general hint, from an export of the students' answers: where a rule is missing in the lessons.
//
//   node scripts/feedback-gaps.js gaussica-elever-2026-11-03.json            the list, most common first
//   node scripts/feedback-gaps.js gaussica-elever-2026-11-03.json --top 10   only the first ten
//   node scripts/feedback-gaps.js gaussica-elever-2026-11-03.json --json     as JSON
//
// The file is the one from the teacher view (Exportera data, JSON), or the file of one student. Nothing is changed or sent anywhere, and no names are
// printed: only the questions, the answers and how many students gave them.
const fs = require("fs");
const path = require("path");
const G = require(path.join(__dirname, "..", "gaps.js"));

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--top");
if (!file) {
  console.error("Usage: node scripts/feedback-gaps.js <file.json> [--top N] [--json]");
  process.exit(2);
}
let data;
try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.error("Could not read " + file + ": " + e.message); process.exit(1); }
const students = Array.isArray(data) ? data : Array.isArray(data.students) ? data.students : Array.isArray(data.attempts) ? [{ id: "one", attempts: data.attempts }] : null;
if (!students) { console.error("The file has no students or attempts in it."); process.exit(1); }

let gaps = G.collect(students);
const topAt = args.indexOf("--top");
if (topAt >= 0 && Number(args[topAt + 1]) > 0) gaps = gaps.slice(0, Number(args[topAt + 1]));
console.log(args.includes("--json") ? JSON.stringify(gaps, null, 2) : G.report(gaps));
