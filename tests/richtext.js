"use strict";
// Powers written with a caret (richtext.js): what becomes a raised exponent, and what stays as it is.
global.window = {};
require("../richtext.js");
const P = window.GaussicaText.powers;
let failures = 0;
const show = (parts) => parts && parts.map((p) => p.base === undefined ? JSON.stringify(p.text) : p.base + "^[" + p.exp + "]").join(" ");
const is = (text, want, m) => { const got = show(P(text)); const good = got === want; console.log((good ? "ok   " : "FAIL ") + (m || text) + (good ? "" : "\n       got:  " + got + "\n       want: " + want)); if (!good) failures++; };

is("2^5", "2^[5]", "a number");
is("x^2 + 1", 'x^[2] " + 1"', "a letter and some text after");
is("(a+b)^2", "(a+b)^[2]", "a bracket");
is("10^-3", "10^[−3]", "a negative exponent gets a minus sign");
is("2^(5+3) = 256", '2^[5+3] " = 256"', "an expression in brackets");
is("a^(m−n)", "a^[m−n]", "a^(m−n)");
is("a^(m·n)", "a^[m·n]", "a^(m·n)");
is("2^(3 · 4)", "2^[3 · 4]", "spaces inside the brackets");
is("a^(−n) = 1/a^n", 'a^[−n] " = 1/" a^[n]', "a negative letter in brackets, and a second power");
is("(a^m)^n", "(a^m)^[n]", "a power inside the base (it is drawn as one in turn)");
is("(2^5)^3", "(2^5)^[3]", "(2^5)^3");
is("2^3 · 2^4", '2^[3] " · " 2^[4]', "two powers");
is("(p/2)^2", "(p/2)^[2]", "a fraction in the base");
is("x^2y", 'x^[2] "y"', "a number as exponent, and a letter after it");
is("3,5 · 10^4", '"3,5 · " 10^[4]', "a power of ten");
is("y = 0,5^x", '"y = " 0,5^[x]', "a decimal base and a letter as the exponent");
is("y = 2^x", '"y = " 2^[x]', "y = 2^x");
// what is not a power
is("hello", null, "no caret");
is("upphöjt med ^, till exempel", null, "a caret on its own, in a sentence");
is("^2", null, "no base");
is("x^", null, "no exponent");
is("ax^2", null, "the end of a word is not a base");
is("x^(", null, "an open bracket");
console.log(failures ? "\n" + failures + " FAILED" : "\nAll power checks passed");
process.exit(failures ? 1 : 0);
