"use strict";
// Curves in the coordinate system ("graf" with curves: [{ fn: "x^2", ... }]) and the functions of the formulas that the gymnasium lessons use.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";

// a small page: elements that know their attributes and children
function node(tag) {
  const e = { tag: tag, attrs: {}, children: [], style: {}, textContent: "",
    setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k]; },
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(x)); }, addEventListener() {} };
  Object.defineProperty(e, "className", { get() { return e.attrs["class"] || ""; }, set(v) { e.attrs["class"] = v; } });
  return e;
}
global.window = {};
global.document = { createElementNS: (ns, tag) => node(tag), createElement: node, createTextNode: (t) => ({ textContent: t }) };
require(ROOT + "pyssel.js");
const P = window.GaussicaPyssel;
require(ROOT + "figures.js");
const Fig = window.GaussicaFigures;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };
const all = (n) => [n].concat(...(n.children || []).map(all));

// ----- the formulas -----
const ev = (e, x) => P.evalExpr(e, { x: x });
ok(ev("lg(1000)") === 3 && ev("lg(0.01)") === -2 && Math.abs(ev("ln(exp(2))") - 2) < 1e-12 && Math.abs(ev("log(2, 8)") - 3) < 1e-12 && ev("exp(0)") === 1, "lg, ln, exp and log");
ok(ev("2^x", 5) === 32 && ev("0.5^x", 3) === 0.125 && ev("x^2 - 4*x + 3", 2) === -1, "powers and polynomials in x");
ok(Number.isNaN(ev("lg(x)", -1)) && !isFinite(ev("1/x", 0)), "no value where the formula has none");

// ----- the picture -----
const graph = (c) => Fig.render(Object.assign({ type: "graf", xmin: -5, xmax: 5, ymin: -5, ymax: 5 }, c));
const curves = (fig) => all(fig).filter((n) => /fig-curve/.test(n.className));
const parabola = graph({ curves: [{ fn: "x^2 - 4*x + 3", label: "y = x² − 4x + 3" }], xmin: -1, xmax: 5, ymin: -2, ymax: 6 });
ok(curves(parabola).length === 1, "a curve is drawn");
const d = curves(parabola)[0].attrs.d;
ok(/^M/.test(d) && !/NaN|undefined|Infinity/.test(d) && (d.match(/[ML]/g) || []).length === 241, "from the first point to the last, with no holes: " + (d.match(/[ML]/g) || []).length + " points");
ok(curves(parabola)[0].attrs.fill === "none", "a curve is a line and not a filled shape");
ok(all(parabola).some((n) => n.tag === "text" && /x² − 4x \+ 3/.test(n.textContent)), "and has its label");
const tops = (d.match(/\d+\.\d+ (\d+\.\d+)/g) || []).map((p) => Number(p.split(" ")[1]));
ok(Math.min(...tops) > 0 && tops.length > 200, "the points are inside of the picture, because the parabola is");

const lg = graph({ curves: [{ fn: "lg(x)" }], xmin: -1, xmax: 12, ymin: -2, ymax: 2 });
const dl = curves(lg)[0].attrs.d;
ok(!/NaN|Infinity/.test(dl) && (dl.match(/M/g) || []).length === 1, "lg(x) starts where x is more than 0, with one line and nothing from the left of 0");
const first = Number(dl.slice(1).split(" ")[0]);
const axis = all(lg).find((n) => n.tag === "line" && /fig-axis/.test(n.className) && n.attrs.y1 !== n.attrs.y2);
ok(first >= Number(axis.attrs.x1) - 0.5, "it does not start left of the y-axis");

const inverse = graph({ curves: [{ fn: "1/x" }], xmin: -4, xmax: 4, ymin: -4, ymax: 4 });
ok((curves(inverse)[0].attrs.d.match(/M/g) || []).length >= 2, "1/x is two lines: there is nothing across x = 0");

const expo = graph({ curves: [{ fn: "2^x", label: "y = 2^x" }, { fn: "0.5^x", tone: "brand" }], xmin: -3, xmax: 5, ymin: -1, ymax: 12 });
ok(curves(expo).length === 2 && /is-brand/.test(curves(expo)[1].className), "two curves, one with a tone of its own");
ok(!/NaN|Infinity/.test(curves(expo)[0].attrs.d), "an exponential function goes far outside of the picture without trouble");

ok(curves(graph({ curves: [{ fn: "wrong((" }] })).length === 0 && curves(graph({ curves: [{ fn: "x +" }] })).length === 0, "a formula that does not work draws nothing and breaks nothing");
ok(curves(graph({ curves: [{ fn: "x", from: 0, to: 2 }], xmin: -5, xmax: 5 }))[0].attrs.d.split(" ").length > 3 && curves(graph({ curves: [{ fn: "x", from: 0, to: 2 }] }))[0].attrs.d.match(/M/g).length === 1, "a curve can have its own range");
ok(all(graph({ lines: [{ k: 1, m: 0 }], points: [{ x: 0, y: 0 }] })).some((n) => /fig-graphline/.test(n.className)) && curves(graph({ lines: [{ k: 1, m: 0 }] })).length === 0, "straight lines and points work as before");

// ----- the lessons -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
let inLessons = 0;
idx.lessons.forEach((f) => {
  const l = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  [].concat(l.visual || [], l.visuals || []).forEach((v) => {
    if (v.type !== "graf" || !v.curves) return;
    inLessons++;
    v.curves.forEach((cv) => {
      const fig = Fig.render(v);
      ok(curves(fig).length === v.curves.length && !/NaN|Infinity/.test(curves(fig).map((c) => c.attrs.d).join("")), l.id + ": every curve is drawn: " + cv.fn);
    });
  });
});
ok(inLessons >= 3, "the gymnasium lessons have curves (" + inLessons + ")");

// the points the lessons mark lie on the curves they belong to
const lesson = (id) => JSON.parse(fs.readFileSync(ROOT + "lessons/" + id + ".json", "utf8"));
const graphOf = (id) => (lesson(id).visuals || []).find((v) => v.type === "graf");
const onCurve = (id, fn) => graphOf(id).points.filter((p) => !p.tone || true).every((p) => Math.abs(ev(fn, p.x) - p.y) < 1e-9);
ok(onCurve("andragradsfunktioner", "x^2 - 4*x + 3"), "andragradsfunktioner: the marked points are on the parabola");
ok(onCurve("logaritmer", "lg(x)"), "logaritmer: the marked points are on lg(x)");
ok(graphOf("exponentialfunktioner").points.every((p) => ev("2^x", p.x) === p.y && ev("0.5^x", p.x) === p.y), "exponentialfunktioner: both curves go through (0, 1)");

console.log(failures ? failures + " FAILED" : "All curve checks passed");
process.exit(failures ? 1 : 0);
