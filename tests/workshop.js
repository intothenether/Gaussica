"use strict";
// The calculations behind the workshop tools.
global.window = {};
global.document = { createElement: () => ({}) };
const W = require("../workshop.js").logic;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

// ----- place value blocks -----
ok(W.baseTen.value({ h: 3, t: 4, e: 7 }) === 347 && W.baseTen.value({ h: 0, t: 12, e: 3 }) === 123, "the value of the blocks, also when they are not exchanged");
const ten = W.baseTen.exchange({ h: 0, t: 2, e: 13 }, "up", "e");
ok(ten.t === 3 && ten.e === 3 && W.baseTen.value(ten) === W.baseTen.value({ h: 0, t: 2, e: 13 }), "ten ones become one ten, and the value stays");
ok(W.baseTen.exchange({ h: 0, t: 0, e: 9 }, "up", "e") === null, "nine ones cannot be exchanged");
const hun = W.baseTen.exchange({ h: 1, t: 11, e: 0 }, "up", "t");
ok(hun.h === 2 && hun.t === 1, "ten tens become one hundred");
const down = W.baseTen.exchange({ h: 2, t: 0, e: 0 }, "down", "t");
ok(down.h === 1 && down.t === 10, "one hundred becomes ten tens");
ok(W.baseTen.exchange({ h: 0, t: 0, e: 0 }, "down", "e") === null, "nothing to take apart");
ok(W.baseTen.normalized({ h: 3, t: 9, e: 9 }) && !W.baseTen.normalized({ h: 3, t: 10, e: 0 }), "no more than nine of anything");
const words = [[0, "noll"], [7, "sju"], [13, "tretton"], [20, "tjugo"], [47, "fyrtiosju"], [100, "ett hundra"], [305, "tre hundra fem"], [999, "nio hundra nittionio"], [111, "ett hundra elva"]];
words.forEach((w) => ok(W.baseTen.words(w[0]) === w[1], "the number " + w[0] + " in words: " + W.baseTen.words(w[0])));

// ----- fractions -----
ok(W.fractions.text(W.fractions.sum([2, 4])) === "3/4", "1/2 + 1/4 = 3/4");
ok(W.fractions.text(W.fractions.sum([2, 2])) === "1/1" && W.fractions.text(W.fractions.sum([3, 3, 3])) === "1/1", "wholes");
ok(W.fractions.text(W.fractions.sum([6, 6, 6])) === "1/2" && W.fractions.text(W.fractions.sum([4, 6])) === "5/12", "reduced, and with different sizes: 1/4 + 1/6 = 5/12");
ok(W.fractions.equals({ num: 2, den: 4 }, { num: 1, den: 2 }) && !W.fractions.equals({ num: 2, den: 3 }, { num: 3, den: 4 }), "equal fractions");
ok(W.fractions.mixed(W.fractions.sum([4, 4, 4, 4, 4])) === "1 1/4" && W.fractions.mixed({ num: 1, den: 2 }) === null, "a mixed number");
ok(W.fractions.equals(W.fractions.sum([3, 6, 6]), { num: 2, den: 3 }), "1/3 + 1/6 + 1/6 is 2/3");

// ----- number line -----
ok(W.numberLine.jump(18, 5, 0, 20) === 20 && W.numberLine.jump(2, -5, 0, 20) === 0 && W.numberLine.jump(5, 2, 0, 20) === 7, "the dot stays on the line");
ok(W.numberLine.minHops(0, 17, [1, 5, 10], 0, 100) === 4, "17 in four hops: 10 + 5 + 1 + 1");
ok(W.numberLine.minHops(0, 9, [1, 5, 10], 0, 100) === 2, "9 is 10 − 1: two hops, forwards and back");
ok(W.numberLine.minHops(3, 3, [1], 0, 10) === 0, "already there");
ok(W.numberLine.minHops(0, 7, [2], 0, 10) === null, "cannot be reached with steps of 2 only");

// ----- balance scale -----
ok(W.scale.tilt(5, 5) === 0 && W.scale.tilt(2, 8) > 0 && W.scale.tilt(8, 2) < 0, "the beam tilts to the heavier side");
ok(Math.abs(W.scale.tilt(0, 1000)) <= 1 && W.scale.balanced(7, 7) && !W.scale.balanced(7, 8), "limits and balance");

// ----- grid -----
const rect = {}; for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) rect[x + "," + y] = true;
ok(W.grid.area(rect) === 12 && W.grid.perimeter(rect) === 14 && JSON.stringify(W.grid.rectangle(rect)) === '{"w":4,"h":3}', "a 4 by 3 rectangle: area 12, perimeter 14");
const ell = { "0,0": true, "1,0": true, "0,1": true };
ok(W.grid.area(ell) === 3 && W.grid.perimeter(ell) === 8 && W.grid.rectangle(ell) === null, "an L shape is not a rectangle");
ok(W.grid.perimeter({ "5,5": true }) === 4 && W.grid.area({}) === 0 && W.grid.rectangle({}) === null, "one square, and an empty grid");
ok(W.grid.fits(rect, 12, 14) && !W.grid.fits(rect, 12, 16), "a shape with the area and perimeter that was asked for");
// the same area can have different perimeters
const line = {}; for (let x = 0; x < 12; x++) line[x + ",0"] = true;
ok(W.grid.area(line) === 12 && W.grid.perimeter(line) === 26, "12 squares in a row: perimeter 26");
ok(W.gcd(12, 18) === 6 && W.gcd(0, 5) === 5, "greatest common divisor");

console.log(failures ? failures + " FAILED" : "All workshop checks passed");
process.exit(failures ? 1 : 0);
