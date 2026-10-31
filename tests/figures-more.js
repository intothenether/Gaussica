"use strict";
// The figures for the lower years (figures-more.js) and the movement in figures.js: every figure is drawn without NaN or undefined in it, has the
// parts it should have, and says what it shows for a screen reader.
const ROOT = require("path").join(__dirname, "..") + "/";

function node(tag) {
  const e = { tag: tag, attrs: {}, children: [], style: {}, textContent: "",
    setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k]; },
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(x)); }, addEventListener() {} };
  Object.defineProperty(e, "className", { get() { return e.attrs["class"] || ""; }, set(v) { e.attrs["class"] = v; } });
  return e;
}
global.window = {};
global.document = { createElementNS: (ns, tag) => node(tag), createElement: node, createTextNode: (t) => ({ textContent: t }) };
require(ROOT + "figures.js");
require(ROOT + "figures-more.js");
const Fig = window.GaussicaFigures;

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const all = (n) => [n].concat(...(n.children || []).map(all));
const withClass = (root, cls) => all(root).filter((n) => ((n.attrs && n.attrs["class"]) || "").split(" ").indexOf(cls) >= 0);
const textsOf = (root) => all(root).map((n) => n.textContent || "").filter(Boolean);
const clean = (root) => all(root).every((n) => Object.keys(n.attrs || {}).every((k) => !/NaN|undefined|Infinity/.test(n.attrs[k])) && !/NaN|undefined|Infinity/.test(n.textContent || ""));

const CASES = [
  ["grupper", { type: "grupper", groups: 3, per: 4, item: "apple" }],
  ["grupper", { type: "grupper", groups: 4, per: 3, item: "stjarna", mode: "dela", show: "uttryck" }],
  ["grupper", { type: "grupper", groups: 3, per: 4, remainder: 2, item: "kaka", mode: "dela" }],
  ["tiobas", { type: "tiobas", value: 347, total: true }],
  ["tiobas", { type: "tiobas", value: 5208 }],
  ["pengar", { type: "pengar", items: [{ value: 20, n: 1 }, { value: 10, n: 2 }, { value: 5, n: 1 }, { value: 1, n: 3 }], total: true }],
  ["brak", { type: "brak", shape: "cirkel", parts: 4, shaded: 3 }],
  ["brak", { type: "brak", shape: "rektangel", compare: [{ parts: 2, shaded: 1 }, { parts: 4, shaded: 2 }] }],
  ["termometer", { type: "termometer", value: -7 }],
  ["termometer", { type: "termometer", values: [{ value: 12 }, { value: -3 }] }],
  ["linjal", { type: "linjal", length: 7.5, object: "penna" }],
  ["kalender", { type: "kalender", year: 2026, month: 10, days: [8, 15], range: { from: 5, to: 9 } }],
  ["tidslinje", { type: "tidslinje", from: "09:20", to: "10:10" }],
  ["tarning", { type: "tarning", values: [1, 3, 6] }],
  ["snurra", { type: "snurra", sectors: [{ label: "1" }, { label: "2" }, { label: "3", n: 2 }], land: 2 }],
  ["pase", { type: "pase", items: [{ color: "rod", n: 3 }, { color: "bla", n: 1 }] }],
  ["matglas", { type: "matglas", capacity: 1, level: 0.6 }],
  ["volym", { type: "volym", w: 4, h: 3, d: 2 }]
];
CASES.forEach(([type, cfg]) => {
  ok(Fig.supports(type) && Fig.badge(type) !== "FIGUR", type + " is a figure with a name");
  const fig = Fig.render(cfg);
  ok(fig && fig.children.length > 0 && clean(fig), type + " " + JSON.stringify(cfg).slice(0, 60) + " is drawn without NaN or undefined");
  const svg = all(fig).find((n) => n.tag === "svg");
  ok(svg && /\S/.test(svg.attrs["aria-label"] || ""), type + " says what it shows");
});

const count = (cfg, cls) => withClass(Fig.render(cfg), cls).length;
ok(count({ type: "grupper", groups: 3, per: 4, item: "apple" }, "fx-pop") === 12, "3 groups of 4: twelve things");
ok(count({ type: "grupper", groups: 3, per: 4, remainder: 2 }, "fx-pop") === 14, "and the rest: fourteen");
ok(textsOf(Fig.render({ type: "grupper", groups: 3, per: 4 })).indexOf("3 · 4 = 12") >= 0, "multiplication is written with a dot: 3 · 4 = 12");
ok(textsOf(Fig.render({ type: "grupper", groups: 3, per: 4, mode: "dela", remainder: 2 })).some((t) => t === "14 : 3 = 4, rest 2"), "division is written 14 : 3 = 4, rest 2");
ok(textsOf(Fig.render({ type: "grupper", groups: 3, per: 4, hide: true })).indexOf("3 · 4 = ?") >= 0, "the answer can be hidden");
ok(count({ type: "tiobas", value: 347 }, "fx-pop") === 14, "347: 3 + 4 + 7 blocks");
ok(textsOf(Fig.render({ type: "tiobas", value: 347, total: true })).indexOf("3 hundratal + 4 tiotal + 7 ental = 347") >= 0, "the blocks add up to the number");
ok(count({ type: "pengar", items: [{ value: 20, n: 1 }, { value: 5, n: 2 }] }, "fx-pop") === 3, "one note and two coins");
ok(textsOf(Fig.render({ type: "pengar", items: [{ value: 20, n: 1 }, { value: 10, n: 2 }], total: true })).indexOf("Tillsammans: 40 kr") >= 0, "the total of the money");
ok(count({ type: "brak", shape: "cirkel", parts: 8, shaded: 3 }, "is-on") === 3 && count({ type: "brak", parts: 8, shaded: 3 }, "fx-slice") === 8, "3 of 8 slices are coloured");
ok(count({ type: "termometer", value: -7 }, "is-cold") === 2, "below zero the mercury is cold");
ok(count({ type: "termometer", value: 18 }, "is-cold") === 0, "above zero it is warm");
ok(textsOf(Fig.render({ type: "linjal", length: 7 })).indexOf("7 cm") >= 0 && textsOf(Fig.render({ type: "linjal", length: 7, hide: true })).indexOf("? cm") >= 0, "the length of what is measured, or a question mark");
ok(count({ type: "kalender", year: 2026, month: 10, days: [8] }, "fx-day") === 1, "a marked day");
ok(textsOf(Fig.render({ type: "kalender", year: 2026, month: 10 })).indexOf("Oktober 2026") >= 0, "the month in Swedish");
// 1 October 2026 is a Thursday: the first day stands in the fourth column
const cal = Fig.render({ type: "kalender", year: 2026, month: 10 });
const one = all(cal).find((n) => n.textContent === "1" && n.tag === "text");
const mon = all(cal).find((n) => n.textContent === "Mån");
ok(one && mon && Math.round(Number(one.attrs.x) - Number(mon.attrs.x)) === 3 * 54, "the week begins on Monday (1 October 2026 is a Thursday)");
ok(Fig.render({ type: "tidslinje", from: "10:00", to: "09:00" }) === null, "a time line needs the second time to be later");
ok(textsOf(Fig.render({ type: "tidslinje", from: "09:20", to: "10:10" })).indexOf("50 minuter") >= 0, "50 minutes from 09:20 to 10:10");
ok(count({ type: "tarning", values: [2, 5] }, "fx-pip") === 7, "dice with 2 and 5 dots");
const spin = withClass(Fig.render({ type: "snurra", sectors: [{ label: "A" }, { label: "B" }, { label: "C" }, { label: "D" }], land: 0 }), "fx-spin")[0];
ok(spin && /--turn:1[01]\d\d/.test(spin.attrs.style), "the spinner turns three times and a little");
ok(count({ type: "pase", items: [{ color: "rod", n: 3 }, { color: "bla", n: 2 }] }, "fx-pop") === 5, "five marbles in the bag");

ok(textsOf(Fig.render({ type: "matglas", capacity: 1, level: 0.6 })).indexOf("6 dl") >= 0 && textsOf(Fig.render({ type: "matglas", capacity: 3, level: 3 })).indexOf("30 dl") >= 0, "the jug says the decilitres: 6 dl, and 3 litres are 30 dl");
ok(count({ type: "matglas", capacity: 1, level: 0.6 }, "fx-rise") === 1 && count({ type: "matglas", capacity: 1, level: 0 }, "fx-rise") === 0, "the water rises, and an empty jug has none");
ok(count({ type: "volym", w: 4, h: 3, d: 2 }, "fx-pop") === 24 && textsOf(Fig.render({ type: "volym", w: 4, h: 3, d: 2 })).indexOf("4 · 3 · 2 = 24 kuber") >= 0, "a block of 4 · 3 · 2 is 24 cubes, and says so");
ok(count({ type: "hundrarutor", filled: 25, animate: true }, "fx-pop") === 25 && count({ type: "hundrarutor", filled: 25 }, "fx-pop") === 0, "the hundred grid: 25 squares come in, and stand still when not asked to move");

// the movement of the old figures
ok(count({ type: "tallinje", min: 0, max: 20, jumps: [{ from: 8, to: 13, label: "+5" }], animate: true }, "fx-pop") === 1, "a number line: the jump moves");
ok(count({ type: "tallinje", min: 0, max: 20, jumps: [{ from: 8, to: 13, label: "+5" }] }, "fx-pop") === 0, "and stands still when it is not asked to move");
ok(count({ type: "klocka", h: 3, m: 30, animate: true }, "fx-sweep") === 2, "a clock: both hands turn");
ok(count({ type: "klocka", h: 3, m: 30 }, "fx-sweep") === 0, "and not when it is not asked to");
ok(count({ type: "rektangel", w: 4, h: 3, grid: true, fill: true }, "fx-pop") === 12, "a rectangle: 12 squares fill");
ok(count({ type: "rektangel", w: 4, h: 3, outline: true, trace: true }, "fx-draw") === 1, "and the outline can be drawn");

console.log(failures ? "\n" + failures + " FAILED" : "\nAll figure checks passed");
process.exit(failures ? 1 : 0);
