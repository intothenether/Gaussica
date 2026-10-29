"use strict";
// The new formats: sortera, ordna, hittafelet and lucktext. The checking, the tasks they become, the examples in the lessons, and
// the whole round on a small page: choose, check, try again, solve.
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";

// ----- a small page with classes, buttons that can be pressed, and text -----
function fake(tag) {
  const e = {
    tag: tag, children: [], className: "", textContent: "", attrs: {}, listeners: {}, disabled: false, hidden: false, value: "", id: "", type: "",
    appendChild(c) { e.children.push(c); c.parent = e; return c; },
    append(...c) { c.forEach((x) => e.appendChild(typeof x === "string" ? textNode(x) : x)); },
    replaceChildren() { e.children = []; },
    setAttribute(k, v) { e.attrs[k] = String(v); },
    addEventListener(t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    click() { if (!e.disabled && !e.hidden) (e.listeners.click || []).forEach((fn) => fn({ preventDefault() {} })); },
    focus() { e.focused = true; },
    get firstChild() { return e.children[0] || null; },
    get classList() {
      const names = () => e.className.split(/\s+/).filter(Boolean);
      return {
        add: (c) => { if (!names().includes(c)) e.className = names().concat(c).join(" "); },
        remove: (c) => { e.className = names().filter((x) => x !== c).join(" "); },
        toggle: (c, on) => { const has = names().includes(c); if (on === undefined ? !has : on) { if (!has) e.className = names().concat(c).join(" "); } else e.className = names().filter((x) => x !== c).join(" "); },
        contains: (c) => names().includes(c)
      };
    },
    querySelector(sel) { const found = all(e).filter((x) => x !== e && matches(x, sel)); return found[0] || null; }
  };
  return e;
}
function textNode(t) { return { tag: "#text", textContent: t, children: [] }; }
function all(n) { return [n].concat(...(n.children || []).map(all)); }
function matches(n, sel) { return sel[0] === "." && n.className && n.className.split(/\s+/).includes(sel.slice(1)); }
global.window = {};
global.document = { createElement: fake, createTextNode: textNode };
require(ROOT + "lesson-model.js");
const F = require(ROOT + "formats.js");
const L = window.GaussicaLesson;

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

// ----- sortera -----
const sort = { format: "sortera", categories: ["Jämna", "Udda"], items: [{ text: "12", category: 0 }, { text: "7", category: "Udda" }, { text: "30", category: 0 }] };
ok(F.checkSort(sort, [0, 1, 0]).length === 0, "everything in the right group, also when the group is written as a name");
ok(F.checkSort(sort, [1, 1, 0]).join() === "0" && F.checkSort(sort, [1, 0, 1]).join() === "0,1,2", "the items in the wrong group");
ok(F.checkSort(sort, [0, null, 0]).join() === "1", "an item that is not placed is wrong");

// ----- ordna -----
for (let n = 2; n <= 8; n++) for (const seed of ["a", "Sätt talen i ordning", "x" + n]) {
  const o = F.startOrder(n, seed);
  ok(o.slice().sort((a, b) => a - b).join() === Array.from({ length: n }, (x, i) => i).join() && o.some((v, i) => v !== i), "a start order with " + n + " things is a mix and not the right order");
  ok(F.startOrder(n, seed).join() === o.join(), "and it is the same every time for the same task");
}
ok(F.startOrder(1, "a").join() === "0" && F.startOrder(0, "a").length === 0, "one thing, or none");
ok(F.move([0, 1, 2], 1, -1).join() === "1,0,2" && F.move([0, 1, 2], 1, 1).join() === "0,2,1", "moving one step");
const same = [0, 1, 2];
ok(F.move(same, 0, -1) === same && F.move(same, 2, 1) === same, "the ends cannot be moved further");
ok(!same.includes(undefined) && F.move(same, 1, 1) !== same && same.join() === "0,1,2", "moving gives a new list and leaves the old one");
const ord = { items: ["a", "b", "c", "d"] };
ok(F.checkOrder(ord, [0, 1, 2, 3]).length === 0 && F.checkOrder(ord, [1, 0, 2, 3]).join() === "0,1" && F.checkOrder(ord, [3, 2, 1, 0]).length === 4, "the places that are wrong");

// ----- hitta felet -----
ok(F.checkFind({ wrong: 1 }, 1) && !F.checkFind({ wrong: 1 }, 0) && !F.checkFind({ wrong: 1 }, null), "the right step");

// ----- lucktext -----
ok(F.norm("  Sju ") === "sju" && F.norm("3,5") === "3.5" && F.norm("3.5.") === "3.5" && F.norm(null) === "" && F.norm(7) === "7", "how a written answer is compared");
const fill = { blanks: [{ answer: ["7", "sju"] }, { answer: ["3,5"] }] };
ok(F.checkFill(fill, ["Sju", "3.5"]).length === 0 && F.checkFill(fill, ["7", "3,5"]).length === 0, "a word or a number, capital letters and comma or point do not matter");
ok(F.checkFill(fill, ["8", ""]).join() === "0,1" && F.checkFill(fill, ["", "3,5"]).join() === "0", "wrong and empty gaps");
ok(JSON.stringify(F.segments("En vecka har {1} dagar och {2} timmar.")) === '[{"text":"En vecka har "},{"blank":0},{"text":" dagar och "},{"blank":1},{"text":" timmar."}]', "the text is cut at the gaps");
ok(F.segments("{1}").length === 1 && F.segments("ingen lucka").length === 1 && F.segments("").length === 0, "a text that is only a gap, or has none");

// ----- what is wrong with a component -----
const good = {
  sortera: sort.items && { type: "sortera", categories: ["Jämna", "Udda"], items: sort.items },
  ordna: { type: "ordna", items: ["1", "2", "3"] },
  hittafelet: { type: "hittafelet", steps: ["a", "b", "c"], wrong: 1, explain: "Därför." },
  lucktext: { type: "lucktext", text: "Ett {1} och ett {2}.", blanks: [{ answer: ["a"] }, { answer: ["b"], options: ["a", "b"] }] }
};
Object.keys(good).forEach((k) => ok(F.problems(good[k]).length === 0, k + ": a good one is fine: " + F.problems(good[k]).join("; ")));
const has = (c, re) => F.problems(c).some((p) => re.test(p));
ok(has(Object.assign({}, good.sortera, { categories: ["Ett"] }), /grupper/) && has(Object.assign({}, good.sortera, { items: [{ text: "a", category: 0 }, { text: "b", category: 0 }] }), /samma grupp/), "sortera: too few groups, and all in one");
ok(has(Object.assign({}, good.sortera, { items: [{ text: "a", category: 0 }, { text: "b", category: 5 }] }), /grupp som inte finns/), "sortera: a group that does not exist");
ok(has(Object.assign({}, good.ordna, { items: ["1", "2"] }), /tre till åtta/) && has(Object.assign({}, good.ordna, { items: ["1", "1", "2"] }), /lika/), "ordna: too few, and two that are the same");
ok(has(Object.assign({}, good.hittafelet, { wrong: 5 }), /wrong/) && has(Object.assign({}, good.hittafelet, { explain: "" }), /förklaring/) && has(Object.assign({}, good.hittafelet, { steps: ["a", "b"] }), /tre till åtta/), "hitta felet: the wrong step must exist, an explanation, and three steps");
ok(has(Object.assign({}, good.lucktext, { text: "Ett {1}." }), /lika många/) && has(Object.assign({}, good.lucktext, { blanks: [{ answer: [] }, { answer: ["b"] }] }), /inget rätt svar/), "lucktext: the gaps must match the list, and each has an answer");
ok(has(Object.assign({}, good.lucktext, { blanks: [{ answer: ["a"] }, { answer: ["c"], options: ["a", "b"] }] }), /bland valen/), "lucktext: the right answer must be among the choices");
ok(F.problems({ type: "finns-inte" }).length === 1 && F.problems(null).length === 1, "an unknown format");

// ----- they are tasks -----
ok(L.isFormatComponent(good.sortera) && L.isFormatComponent(good.hittafelet) && !L.isFormatComponent({ type: "koppla" }) && !L.isFormatComponent(Object.assign({}, good.hittafelet, { wrong: 9 })), "the lesson model knows what a format component is");
const lesson = { id: "x", title: "X", area: "tal", prerequisites: [], grade: 3, exercise: { prompt: "?", answer: ["1"], feedback: [] }, wordProblems: [], components: [good.sortera, good.ordna, good.hittafelet, good.lucktext] };
const tasks = L.tasks(lesson);
ok(tasks.map((t) => t.id).sort().join() === "exercise,hf-2,lt-3,or-1,so-0", "the tasks have the ids so-, or-, hf- and lt-: " + tasks.map((t) => t.id).join());
const t0 = tasks.find((t) => t.id === "so-0").problem;
ok(t0.format === "sortera" && t0.answer.length === 1 && t0.correct && Array.isArray(t0.feedback) && t0.prompt, "a task has a format, a prompt and what every task has");
ok(!("type" in t0) && lesson.components[0].type === "sortera", "the component itself is not changed");
ok(["so-0", "or-1", "hf-2", "lt-3"].map((id) => tasks.find((t) => t.id === id).name).join() === "Sortera,Ordna,Hitta felet,Fyll i luckorna", "and their names");
ok(L.blockKeys(lesson).join() === "explanation,comp:0,comp:1,comp:2,comp:3,rule,exercise" || L.blockKeys(lesson).includes("comp:3"), "and they have a place in the lesson");

// ----- the examples in the lessons -----
const idx = JSON.parse(fs.readFileSync(ROOT + "lessons/index.json", "utf8"));
let inLessons = 0;
const byFormat = {};
idx.lessons.forEach((f) => {
  const l = JSON.parse(fs.readFileSync(ROOT + "lessons/" + f, "utf8"));
  (l.components || []).forEach((c, i) => {
    if (!L.FORMATS[c.type]) return;
    inLessons++;
    byFormat[c.type] = (byFormat[c.type] || 0) + 1;
    ok(F.problems(c).length === 0, l.id + " / " + c.type + ": " + F.problems(c).join("; "));
    ok(L.tasks(l).some((t) => t.key === "comp:" + i && t.problem.format === c.type), l.id + " / " + c.type + ": it is a task");
    ok(L.blockKeys(l).includes("comp:" + i), l.id + ": the task is in the layout");
    if (c.type === "sortera") ok(c.items.length >= 4, l.id + ": enough things to sort");
  });
});
ok(inLessons >= 14 && Object.keys(byFormat).length === 4, "all four formats are used in the lessons (" + inLessons + ": " + JSON.stringify(byFormat) + ")");

// ===== a whole round on a small page =====
function round(problem, saved) {
  const parent = fake("div");
  const log = [];
  F.render(parent, problem, {
    labelText: "TEST", headingId: "h", saved: saved || null,
    text: (node, t) => { node.textContent = t; },
    store: (answer, feedback, type, done, miss, prompt) => log.push({ answer: answer, feedback: feedback, type: type, done: done, miss: miss, prompt: prompt }),
    finish: (r) => log.push({ finish: r }),
    listen: null
  });
  const find = (cls) => all(parent).filter((n) => n.className && n.className.split(/\s+/).includes(cls));
  return { parent: parent, log: log, find: find, check: find("fm-check")[0], message: find("feedback-message")[0] };
}
const prob = (c) => L.formatProblem(c);

// sortera: the items are shown mixed, one button per group
let r = round(prob(Object.assign({}, good.sortera, { items: [{ text: "12", category: 0 }, { text: "7", category: 1 }, { text: "30", category: 0 }, { text: "9", category: 1 }] })));
ok(r.find("fm-row").length === 4 && r.find("fm-choice").length === 8, "sortera: a row for each thing and a button for each group");
ok(r.check.disabled === true, "sortera: nothing can be checked before everything is placed");
const rowsOf = () => r.find("fm-row").map((row) => ({ text: all(row).find((n) => n.className === "tf-body").textContent, buttons: all(row).filter((n) => n.className && n.className.split(/\s+/).includes("fm-choice")) }));
const place = (wrongOnes) => rowsOf().forEach((row) => { const right = ["12", "30"].includes(row.text) ? 0 : 1; row.buttons[wrongOnes.includes(row.text) ? 1 - right : right].click(); });
place(["12"]);
ok(r.check.disabled === false, "sortera: when everything is placed it can be checked");
r.check.click();
ok(r.log.some((x) => x.finish === false) && r.log.find((x) => x.type === "hint").miss.includes("12") && /3 av 4/.test(r.message.textContent), "sortera: a wrong group tells how many are right and is logged: " + r.message.textContent);
ok(r.find("fm-row").filter((row) => /is-wrong/.test(row.className)).length === 0, "sortera: after the first try nothing is marked");
r.check.click();
ok(r.find("fm-row").filter((row) => /is-wrong/.test(row.className)).length === 1 && /De markerade/.test(r.message.textContent), "sortera: after the second try the wrong one is marked");
rowsOf().find((row) => row.text === "12").buttons[0].click();
ok(r.find("fm-row").every((row) => !/is-wrong/.test(row.className)), "sortera: changing one takes the mark away");
r.check.click();
ok(r.log.some((x) => x.finish === true) && r.log.some((x) => x.type === "correct" && x.done) && r.check.hidden === true, "sortera: all right, so it is solved and the button goes away");
ok(r.find("fm-choice").every((b) => b.disabled), "sortera: and nothing can be changed");
r = round(prob(good.sortera), { completed: true });
ok(r.check.hidden === true && r.find("fm-choice").every((b) => b.disabled) && /Rätt/.test(r.message.textContent), "sortera: an earlier solved task is shown solved");

// ordna: arrows
r = round(prob({ type: "ordna", prompt: "Ordna", items: ["a", "b", "c", "d"], top: "Minst", bottom: "Störst" }));
const orderNow = () => r.find("fm-orow").map((row) => all(row).find((n) => n.className === "tf-body").textContent);
ok(orderNow().join() !== "a,b,c,d" && orderNow().slice().sort().join() === "a,b,c,d", "ordna: shown mixed, and never in the right order");
ok(r.find("fm-arrow").length === 8 && r.find("fm-arrow")[0].disabled === true && r.find("fm-arrow")[7].disabled === true, "ordna: the first cannot go up and the last cannot go down");
const solveOrder = () => { for (let guard = 0; guard < 40 && orderNow().join() !== "a,b,c,d"; guard++) { const o = orderNow(); const i = o.findIndex((x, k) => x !== "abcd"[k]); const from = o.indexOf("abcd"[i]); const downs = r.find("fm-arrow").filter((b, k) => k % 2 === 1); const ups = r.find("fm-arrow").filter((b, k) => k % 2 === 0); ups[from].click(); } };
r.check.click();
ok(r.log.some((x) => x.finish === false) && /på rätt plats/.test(r.message.textContent), "ordna: a wrong order says how many are in place");
r.check.click();
ok(r.find("fm-orow").some((row) => /is-wrong/.test(row.className)), "ordna: after the second try the ones in the wrong place are marked");
solveOrder();
ok(orderNow().join() === "a,b,c,d", "ordna: the arrows can put it right: " + orderNow().join());
r.check.click();
ok(r.log.some((x) => x.finish === true) && r.log.find((x) => x.done).answer === "a → b → c → d" && r.check.hidden === true, "ordna: right, logged as the order the student made");
ok(r.find("fm-arrow").every((b) => b.disabled), "ordna: and it is locked");

// hitta felet
const find = prob(good.hittafelet);
r = round(Object.assign({}, find, { hint: "Titta på b." }));
const stepBtns = () => r.find("fm-stepbtn");
ok(stepBtns().length === 3 && r.check.disabled === true, "hitta felet: a button for each step, and nothing to check yet");
stepBtns()[0].click();
ok(r.check.disabled === false && stepBtns()[0].attrs["aria-pressed"] === "true", "hitta felet: a step is picked");
stepBtns()[0].click();
ok(r.check.disabled === true, "hitta felet: a second tap takes the pick back");
stepBtns()[0].click();
r.check.click();
ok(r.log.some((x) => x.finish === false) && /Steg 1 stämmer/.test(r.message.textContent) && !/Tips/.test(r.message.textContent), "hitta felet: a right step is not the mistake, and the first time there is no hint");
r.check.click();
ok(/Tips: Titta på b\./.test(r.message.textContent), "hitta felet: the second time there is a hint");
stepBtns()[1].click();
r.check.click();
ok(r.log.some((x) => x.finish === true) && r.log.find((x) => x.done).answer === "Steg 2" && r.find("fm-explain").length === 1 && /Därför/.test(r.find("fm-explain")[0].children[0].textContent), "hitta felet: the right step solves it, and the explanation is shown");
ok(r.find("fm-step").some((s) => /is-error/.test(s.className)) && stepBtns().every((b) => b.disabled), "hitta felet: the mistake is marked and it is locked");

// lucktext
r = round(prob(good.lucktext));
const gaps = () => r.find("fm-gap");
ok(gaps().length === 2 && gaps()[0].tag === "input" && gaps()[1].tag === "select" && gaps()[1].children.length === 3, "lucktext: a field for a written gap and a list for a gap with choices (with a first line that is not a choice)");
ok(r.check.disabled === true, "lucktext: nothing to check while a gap is empty");
gaps()[0].value = "x";
gaps()[1].value = "b";
gaps().forEach((g) => (g.listeners.input || []).forEach((fn) => fn()));
ok(r.check.disabled === false, "lucktext: all gaps filled");
r.check.click();
ok(r.log.some((x) => x.finish === false) && /1 av 2/.test(r.message.textContent) && /is-wrong/.test(gaps()[0].className) && !/is-wrong/.test(gaps()[1].className), "lucktext: the wrong gap is marked, the right one is not");
gaps()[0].value = " A ";
(gaps()[0].listeners.input || []).forEach((fn) => fn());
ok(!/is-wrong/.test(gaps()[0].className), "lucktext: changing a gap takes the mark away");
r.check.click();
ok(r.log.some((x) => x.finish === true) && r.log.find((x) => x.done).answer === " A  · b" && gaps().every((g) => g.disabled), "lucktext: capital letters and spaces do not matter, and it is locked");
const enter = round(prob(good.lucktext));
ok(enter.find("fm-gap")[0].listeners.keydown.length === 1, "lucktext: Enter checks");

// an unknown format draws nothing
ok(F.render(fake("div"), { format: "finns-inte" }, {}) === null, "an unknown format is not drawn");

console.log(failures ? failures + " FAILED" : "All format checks passed");
process.exit(failures ? 1 : 0);
