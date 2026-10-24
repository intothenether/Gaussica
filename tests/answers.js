"use strict";
// Unit checks for how student answers are compared (symbolic-math.js).
const path = require("path");
const M = require(path.join(__dirname, "..", "symbolic-math.js"));

let failures = 0;
function eq(a, b, expected, note) {
  const got = M.areEquivalent(a, b);
  if (got !== expected) { failures++; console.log("FAIL: areEquivalent(" + JSON.stringify(a) + ", " + JSON.stringify(b) + ") was " + got + ", expected " + expected + (note ? " (" + note + ")" : "")); }
}
function is(name, got, expected) {
  if (got !== expected) { failures++; console.log("FAIL: " + name + " was " + got + ", expected " + expected); }
}

// numbers
eq("0,5", "0.5", true, "decimal comma");
eq("-5", "−5", true, "minus sign variants");
eq("24 cm", "24", true, "units are ignored");
eq("24", "25", false);
// fractions
eq("6/8", "3/4", true, "equivalent fractions");
eq("3/4", "4/3", false);
// mixed numbers: "1 3/4" means 7/4, never 13/4
eq("1 3/4", "7/4", true);
eq("13/4", "1 3/4", false);
eq("1 3/4", "1 1/4", false);
is("isMixed 1 3/4", M.isMixed("1 3/4"), true);
is("isMixed 7/4", M.isMixed("7/4"), false);
// remainders and words must match as typed
eq("17 r 2", "17 r 2", true);
eq("2 r 17", "17 r 2", false);
eq("17 R 2", "17 r 2", true);
// ratios written with a colon
eq("2:3", "2:3", true);
eq("3:2", "2:3", false);
// calculations where a plain number is wanted
is("36/6 is a calculation", M.isCalculation("36/6"), true);
is("6 is not a calculation", M.isCalculation("6"), false);
is("fractions are not a plain number", M.expectsPlainNumber(["3/4"]), false);
is("a number is a plain number", M.expectsPlainNumber(["24", "24 cm"]), true);
// roots: 3√2 is not 2√3, and a root typed for a plain number counts as a calculation
eq("3√2", "3*sqrt(2)", true);
eq("2√3", "3√2", false);
eq("9√2", "3√2", false);
eq("√49", "7", true);
eq("3√2", "4,24", false);
is("√64 is a calculation", M.isCalculation("√64"), true);
is("3√2 is not a plain number", M.expectsPlainNumber(["3√2"]), false);
// functions are functions, not variables
eq("x(x+1)", "x^2+x", true);
eq("2x(x+3)", "2x^2+6x", true);
eq("sin(0)", "0", true);
// powers of ten
eq("3*10^5", "300000", true);
eq("4,2·10^-3", "0,0042", true);
// expanding brackets: the expanded form is the same as the factored one, so the lesson asks for a form
eq("(x+3)^2", "x^2 + 6x + 9", true);
eq("x^2 + 6x + 9", "x^2 + 6x + 10", false);
eq("x^2 − 10x + 25", "x^2-10x+25", true);

console.log(failures ? failures + " FAILED" : "All answer checks passed");
process.exit(failures ? 1 : 0);
