"use strict";
// The number line to play on (hopplek.js): the sums are written as on paper, and the page is built the way the lessons ask for.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..") + "/";

function node(tag) {
  const e = { tag: tag, attrs: {}, children: [], style: {}, textContent: "", hidden: false, classList: { add() {}, remove() {} },
    setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k]; },
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(x)); }, addEventListener() {}, removeChild() {} };
  Object.defineProperty(e, "className", { get() { return e.attrs["class"] || ""; }, set(v) { e.attrs["class"] = v; } });
  return e;
}
global.document = { createElementNS: (ns, tag) => node(tag), createElement: node };
global.window = {};
const H = require(ROOT + "hopplek.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const all = (n) => [n].concat(...(n.children || []).map(all));

ok(H.sum(-3, 5) === "−3 + 5 = 2" && H.sum(2, -6) === "2 − 6 = −4" && H.sum(0, -3) === "0 − 3 = −3", "a hop is written as a sum, with the minus sign of maths");

const box = H.render({ type: "hoppa-pa-linjen", title: "Hoppa", min: -10, max: 10, start: 0, hops: [1, 3, 5] });
const texts = all(box).filter((n) => n.tag === "text").map((n) => n.textContent);
ok(["−10", "−5", "0", "5", "10"].every((t) => texts.includes(t)), "the line has its numbers, the negative ones with a minus sign");
ok(all(box).filter((n) => /hl-hop/.test(n.className)).length === 6, "three hops to the left and three to the right");
ok(all(box).some((n) => /hl-mission-text/.test(n.className) && /Uppdrag 1 av 5: Hoppa till −3/.test(n.textContent)), "the first mission is there");
ok(all(box).some((n) => /hl-thermo/.test(n.className)), "and the thermometer");
ok(!all(box).some((n) => /NaN|undefined/.test(JSON.stringify(n.attrs) + n.textContent)), "nothing is drawn with NaN or undefined");
const plain = H.render({ type: "hoppa-pa-linjen", min: 0, max: 20, thermometer: false, missions: [] });
ok(!all(plain).some((n) => /hl-thermo/.test(n.className)) && !all(plain).some((n) => /hl-mission/.test(n.className) && n.tag !== "ol"), "without a thermometer and without missions, there are none");

const lesson = JSON.parse(fs.readFileSync(ROOT + "lessons/negativa-tal.json", "utf8"));
const comp = (lesson.components || []).find((c) => c.type === "hoppa-pa-linjen");
ok(comp && comp.min <= -10 && comp.max >= 10, "the lesson about negative numbers has the playground");
ok((lesson.visuals || []).filter((v) => v.type === "tallinje" && v.pet && v.animate).length >= 2, "and number lines where the pet hops along the arrows");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All checks on the number line to play on passed");
