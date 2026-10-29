"use strict";
// The pet peeks around the page: over the edge of the step card on the start page (pointing at the button), and over the top edge of the
// footer in a lesson (looking at the answer field, up at the hint, and happy when the answer is right).
const fs = require("fs");
const ROOT = require("path").join(__dirname, "..") + "/";

// a small page: elements that keep their innerHTML, and a querySelector that finds the picture of the pet
function fake(tag) {
  const e = {
    tag: tag, children: [], className: "", textContent: "", attrs: {}, styleVars: {}, classes: new Set(), _html: "", dataset: {},
    appendChild(c) { e.children.push(c); return c; }, append(...c) { c.forEach((x) => e.children.push(x)); },
    replaceChildren() { e.children = []; }, setAttribute(k, v) { e.attrs[k] = v; }, addEventListener() {},
    style: { setProperty(k, v) { e.styleVars[k] = v; }, removeProperty(k) { delete e.styleVars[k]; } },
    get innerHTML() { return e._html; }, set innerHTML(v) { e._html = v; e._svg = /class="pet-svg/.test(v) ? { classList: { add(c) { e.classes.add(c); } }, style: e.style } : null; },
    querySelector(sel) { return sel === ".pet-svg" ? e._svg || null : null; }
  };
  return e;
}
global.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} } };
global.document = { createElement: fake, body: { contains: () => true, classList: { contains: () => false } }, addEventListener() {}, documentElement: { addEventListener() {} } };
require(ROOT + "lesson-model.js");
const Art = require(ROOT + "pet-art.js");
const Pet = require(ROOT + "pet.js");

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("FAIL: " + m); } };

const user = { id: 1, lessonProgress: {}, attempts: [], feedback: [] };
let on = true;
Pet.init({ getUser: () => user, getCourse: () => ({ lessons: [] }), getProgress: () => null, enabled: () => on, lessonStars: () => ({ stars: 1 }), save() {}, refresh() {} });

// no pet, no peeking
ok(Pet.peek("hero") === null && Pet.peek("footer") === null, "without a pet nothing peeks");
user.lessonProgress.pet = Pet.makePet("fox", "orange", "Rut");

// the start page
const hero = Pet.peek("hero");
ok(hero && hero.className === "hs-peek" && hero.attrs["aria-hidden"] === "true", "the pet peeks over the step card, and is only decoration for a screen reader");
ok(hero.children.length === 2 && hero.children[0].className === "hs-arm" && hero.children[1].className === "hs-peek-head", "an arm and a head");
const c = Art.colorOf("fox", user.lessonProgress.pet.color);
ok(hero.children[0].styleVars["--arm"] === c.body && hero.children[0].styleVars["--arm-dark"] === c.dark, "the arm has the colours of the animal");
ok(/viewBox="8 0 184 122"/.test(hero.children[1].innerHTML), "the head is cut off at the chin, as if it was behind the edge");
ok(hero.children[1].styleVars["--gx"] === "-3.2px" && Number(parseFloat(hero.children[1].styleVars["--gy"])) > 0, "it looks to the left, at the button");

// a lesson
const foot = Pet.peek("footer");
ok(foot && foot.element.className === "pl-peek" && typeof foot.set === "function", "the pet peeks over the footer, and can be told what happened");
ok(/viewBox="8 0 184 122"/.test(foot.element.innerHTML) && !/is-happy/.test(foot.element.innerHTML), "it starts calm");
ok(foot.element.styleVars["--gx"] === "3.2px" && foot.element.styleVars["--gy"] === "1.6px", "and looks at the answer field, to the right and down");
foot.set("wrong");
ok(foot.element.styleVars["--gx"] === "0px" && foot.element.styleVars["--gy"] === "-2.8px" && !/is-happy/.test(foot.element.innerHTML), "after a wrong answer it looks up at the hint");
foot.set("correct");
ok(/is-happy/.test(foot.element.innerHTML) && foot.element.classes.has("react-pet"), "after a right answer it is happy");
const html = foot.element.innerHTML;
foot.set("correct");
ok(foot.element.innerHTML === html, "the same thing twice does not draw it again (so it does not jump again)");
foot.set("neutral");
ok(!/is-happy/.test(foot.element.innerHTML) && foot.element.styleVars["--gx"] === "3.2px", "and it is calm again for the next question");

// the bubble without the face when the pet peeks
const withFace = Pet.say("right");
const faceless = Pet.say("right", { faceless: true });
ok(withFace.children.length === 2 && withFace.children[0].className === "pet-face", "the bubble has a face of its own");
ok(faceless.children.length === 1 && faceless.children[0].className === "pet-say-bubble", "the bubble has no face when the pet peeks over the edge (it would be there twice)");

// switched off
on = false;
ok(Pet.peek("hero") === null && Pet.peek("footer") === null, "nothing peeks when the teacher has switched the pet off");

// the pictures
["fox", "axolotl", "dragon", "cow", "cockatiel", "tax"].forEach((kind) => {
  const f = Art.face({ kind: kind, color: Art.KINDS[kind].colors[0].id, worn: { hat: "hatt-kock" } }, "", { crop: "8 0 184 122" });
  ok(/viewBox="8 0 184 122"/.test(f) && !/NaN/.test(f), kind + ": a head to peek with");
});

console.log(failures ? failures + " FAILED" : "All peek checks passed");
process.exit(failures ? 1 : 0);
