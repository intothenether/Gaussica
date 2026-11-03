"use strict";
// The automatic diagnoses of algebra and arithmetic in symbolic-math.js: each one fires on the numbers of its own question, and not on another question
// that happens to have the same right answer (they used to look for fixed numbers such as 16 and 260, and for fractions in the text of the lesson).
const S = require("../symbolic-math.js");
let failures = 0;
const code = (answer, expected, prompt, explanation) => { const d = S.diagnoseMisconception(answer, expected, { prompt: prompt, explanation: explanation || "" }); return d ? d.code : null; };
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL " + m); } };

// equations: ax + b = c, with the numbers of the question
ok(code("16", "4", "Lös ekvationen 3x + 2 = 14.") === "EQUATION_SIGN_INVERSION", "a sign not changed in 3x + 2 = 14");
ok(code("12", "4", "Lös ekvationen 3x + 2 = 14.") === "EQUATION_HALFWAY", "stopped at 3x = 12");
ok(code("36", "4", "Lös ekvationen 3x + 2 = 14.") === "EQUATION_MULT_INSTEAD_OF_DIV", "multiplied by 3 instead of dividing");
ok(code("2", "8", "Lös ekvationen 2x − 6 = 10.") === "EQUATION_SIGN_INVERSION" && /drogs ifrån i stället för att läggas till/.test(S.diagnoseMisconception("2", "8", { prompt: "Lös ekvationen 2x − 6 = 10." }).explanation), "the same with a minus, and it says what it is about this question");
ok(code("11", "11", "Lös ekvationen 3x + 2 = 14.") === null, "a right answer is no mistake");
ok(code("16", "4", "Det finns 16 bussar med 25 personer i varje. Hur många personer är det?") === null, "16 in a question about buses is not an equation mistake");
ok(code("36", "4", "Räkna ut 2 · 18 = ?") === null, "36 in another question is nothing either");
ok(!/12 \+|14 −/.test((S.diagnoseMisconception("16", "4", { prompt: "Lös ekvationen 3x + 2 = 14." }) || { explanation: "" }).explanation), "the hint does not work out the answer");

// the order of operations
ok(code("260", "100", "Vad är 40 + 12 · 5?") === "ORDER_OF_OPERATIONS", "(40 + 12) · 5 for 40 + 12 · 5");
ok(code("260", "100", "Hur mycket är 4 · 25?") === null, "260 for 100 in another question is nothing");
ok(code("10", "9", "Hur många dagar är en vecka plus två dagar?") === null, "and 10 for 9 neither");

// more than, fewer than
ok(code("17", "7", "Lag A fick 12 poäng och lag B fick 5. Hur många fler poäng fick A?") === "SUM_INSTEAD_OF_DIFFERENCE", "the sum for the difference");
ok(code("17", "7", "Hur mycket är 10 + 7?", "I diagram jämför du staplar. Hur många fler är skillnaden.") === null, "words in the text of the lesson do not count");

// brackets with a minus in front
ok(code("18", "12", "Vad är 20 − (5 + 3)?") === "ASSOCIATIVE_SIGN_ERROR", "a − (b + c) counted as a − b + c");
ok(code("15", "12", "Vad är 20 − (5 + 3)?") === null, "another wrong answer is not that");
ok(code("2", "4", "Vad är 2 − 2?", "Exempel: a − (b + c).") === null, "the text of the lesson does not count");

// fractions
ok(code("2/5", "7/6", "Vad är 1/2 + 1/3?") === null || code("2/5", "5/6", "Vad är 1/2 + 1/3?") === "FRACTION_ADDITION_ACROSS", "numerators and denominators added");
ok(code("2/5", "7/6", "Vad är 2/3 + 1/6?", "Exempel: 1/2 + 1/3 = 5/6.") === null, "fractions in the text of the lesson are not the question's");
ok(code("1/8", "2", "Vad är 1/2 : 1/4?") === "FRACTION_DIVISION_INVERT", "not inverted");
ok(code("3", "2", "Dela bråk: Vad är 1/2 : 1/4?") === null, "another wrong answer to a division of fractions is not that");
ok(code("5", "2", "Hur många delar är det om du delar 10 bråkdelar?", "dela bråk") === null, "the words dela and bråk are not enough");

console.log(failures ? "\n" + failures + " FAILED" : "All diagnosis checks passed");
process.exit(failures ? 1 : 0);
