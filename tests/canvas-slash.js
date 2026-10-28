"use strict";
// The slash button on the drawing pad: it goes over the character at the cursor, or the one before it.
global.window = {};
const C = require(require("path").join(__dirname, "..", "canvas-pad.js"));

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const items = [{ t: "r", s: "52", x: 100, y: 120, c: 0 }, { t: "r", s: "4 7", x: 100, y: 160, c: 0 }];   // columns 5 and 6 on row 3, columns 5 to 7 on row 4
ok(C.slashColumn(items, 5, 3) === 5 && C.slashColumn(items, 6, 3) === 6, "the character in the cursor's square");
ok(C.slashColumn(items, 7, 3) === 6, "the cursor after the last character: the character before it");
ok(C.slashColumn(items, 8, 3) === -1 && C.slashColumn(items, 4, 3) === -1, "nothing there and nothing before it");
ok(C.slashColumn(items, 6, 4) === 5, "a space is not a character: the one before it is crossed out");
ok(C.slashColumn(items, 7, 4) === 7, "the character after a space");
ok(C.slashColumn(items, 5, 2) === -1, "another row");
const m = C.slashItem(5, 3, 2);
ok(m.t === "line" && m.x === 101 && m.dx === 18 && m.dy < 0 && m.c === 2 && !m.h, "the slash runs from the lower left to the upper right of the square");
ok(m.y > 120 && m.y + m.dy > 120 && m.y < 160 && m.x >= 100 && m.x + m.dx <= 120, "and stays inside it");

console.log(failures ? failures + " FAILED" : "All canvas slash checks passed");
process.exit(failures ? 1 : 0);
