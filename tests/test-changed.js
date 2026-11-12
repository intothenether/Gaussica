"use strict";
// scripts/test-changed.js: which browser specs a changed file asks for.
const fs = require("fs");
const path = require("path");
const T = require("../scripts/test-changed.js");

let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };

const specs = fs.readdirSync(path.join(__dirname, "browser")).filter((f) => /\.spec\.js$/.test(f)).map((f) => f.replace(/\.spec\.js$/, ""));
const none = () => false;

ok(T.RULES.every((r) => r[1].every((s) => specs.includes(s))), "every spec that a rule names exists");
ok(T.FALLBACK.every((s) => specs.includes(s)), "and the short set too");

let r = T.specsFor(["pet-art.js"], specs, none);
ok(r.known && r.specs.includes("pet"), "a change in the pet drawings runs the pet spec");
r = T.specsFor(["styles-algebra.css", "worked-steps.js"], specs, none);
ok(r.specs.includes("algebra"), "the algebra files run the algebra spec");
r = T.specsFor(["lessons/decimaltal.json"], specs, (s, id) => s === "practice-formats" && id === "decimaltal");
ok(r.specs.join() === "practice-formats", "a lesson runs the specs that name it");
r = T.specsFor(["lessons/aldrig-namnd.json"], specs, none);
ok(r.known && r.specs.length === 0, "a lesson that no spec names has no browser spec of its own (the unit tests check it)");
r = T.specsFor(["README.md", "tests/pet.js", "scripts/test-changed.js"], specs, none);
ok(r.specs.join() === "pet" || r.specs.length <= 3, "documents and test files do not ask for much");
r = T.specsFor(["some-new-page.js"], specs, none);
ok(!r.known && r.specs.join() === T.FALLBACK.slice().sort().join(), "a script that nothing knows gets the short set");
r = T.specsFor(["step-boxes.js"], specs, none);
ok(r.specs.includes("stepboxes"), "the step boxes run their spec");
r = T.specsFor(["tests/browser/helpers.js"], specs, none);
ok(r.known && r.specs.includes("smoke") && r.specs.includes("keyboard"), "a change in the shared test steps runs a few specs that use them");
r = T.specsFor(["demo.js", "provtraining.js"], specs, none);
ok(r.specs.includes("demo") && r.specs.includes("provtraining"), "the trial and Provträning run their specs");
r = T.specsFor(["tests/browser/popup.spec.js"], specs, none);
ok(r.specs.join() === "popup", "a changed spec runs itself");

if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
console.log("All checks on test-changed passed");
