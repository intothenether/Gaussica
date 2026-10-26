"use strict";
// Maths written the way it is said (reading.js): what the read-aloud button sends to the voice.
const { toSpeech } = require("../reading.js");

let failures = 0;
function is(input, expected) {
  const got = toSpeech(input);
  if (got !== expected) { failures++; console.log("FAIL: " + JSON.stringify(input) + " -> " + JSON.stringify(got) + ", expected " + JSON.stringify(expected)); }
}

is("Vad är 3/4 + 1/4?", "Vad är tre fjärdedelar plus en fjärdedel?");
is("1/2", "en halv");
is("2/3 av 12", "två tredjedelar av 12");
is("56/7 = 8", "56 delat med 7 är lika med 8");
is("12/3", "12 delat med 3");
is("7 · 8 = 56", "7 gånger 8 är lika med 56");
is("2 + 3 · 4 − 1", "2 plus 3 gånger 4 minus 1");
is("x^2 + 6x", "x i kvadrat plus 6x");
is("10^−3 och 2^5", "10 upphöjt till minus 3 och 2 upphöjt till 5");
is("x^(-1)", "x upphöjt till minus 1");
is("5 cm²", "5 cm i kvadrat");
is("√49 = 7", "kvadratroten ur 49 är lika med 7");
is("√(a + b)", "kvadratroten ur a plus b");
is("3 482 106", "3482106");
is("50 % av 80", "50 procent av 80");
is("En vinkel på 90°", "En vinkel på 90 grader");
is("a ≠ b och 3 < 4", "a är inte lika med b och 3 är mindre än 4");
is("Temperaturen är -5 grader", "Temperaturen är minus 5 grader");
is("🧩 Problemet: hur många?", "Problemet: hur många?");
is("1, 2, 3, ...", "1, 2, 3, och så vidare");
is("", "");
is(null, "");
console.log(failures ? failures + " FAILED" : "All speech checks passed");
process.exit(failures ? 1 : 0);
