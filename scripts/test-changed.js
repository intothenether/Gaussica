"use strict";
// Runs the unit tests and the browser specs that belong to what has changed, so a mistake shows up in a minute instead of after the whole
// browser suite (about 8 minutes). It is a help while working: run the whole suite (npm run test:all) before pushing.
//
//   npm run test:changed                  the files changed since the last commit (and a clean tree: the last commit)
//   npm run test:changed -- --base main   the files changed since main (or any other commit)
//   npm run test:changed -- --dry         only say which specs would run
//   npm run test:changed -- --all         everything, as test:all does
//
// Which specs belong to a file is in RULES (a pattern for the file, the specs). A lesson file belongs to the specs that name the lesson, and
// a file that nothing mentions gets the short set in FALLBACK. specsFor() is pure, tests/test-changed.js checks it.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const FALLBACK = ["smoke", "a11y"];
const RULES = [
  [/^(pet|pet-art|pet-teacher|pet-memory|pet-tricks|pet-help).js$|^tests/(pet|peek)/, ["pet", "pet-extras", "keyboard", "a11y"]],
  [/^(figures|figures-more|visuals)\.js$|^styles-figures-more\.css$/, ["figures-lower", "curves", "a11y", "pet-figures", "hopplek", "stege"]],
  [/^hopplek\.js$/, ["hopplek", "pet-figures"]],
  [/^(algebra|figures-algebra|steps|substitution|mathinput|worked-steps|symbolic-math|slips)\.js$|^styles-algebra\.css$/, ["algebra", "powers", "mobile-keyboard"]],
  [/^(formats|practice|practice-editor|editor)\.js$|^interactive-lesson-editor/, ["practice-formats", "formats", "editor"]],
  [/^(spelling|wordbank|reading|terms|words)\.js$/, ["spelling", "terms"]],
  [/^(feedback|feedback-signals|misconceptions)\.js$/, ["feedback", "misconceptions"]],
  [/^reading\.js$/, ["intro", "feedback", "spelling"]],
  [/^(questions|lesson-player|lesson-model|richtext|canvas-pad|tip-dialog)\.js$/, ["smoke", "a11y", "keyboard", "feedback", "drawpad", "tip", "intro"]],
  [/^(app|index)\.(js|html)$|^styles\.css$|^viewport\.js$/, ["smoke", "a11y", "popup", "phone", "demo", "landing"]],
  [/^(caregiver|parent-guide|parent-guides|teacher-view|mailbox|chat)\.js$/, ["caregiver", "multi", "week"]],
  [/^(subscription|auth-view|account|privacy|local-backend)\.js$|^styles-account\.css$|^(villkor|integritet|angerratt)\.html$/, ["account", "caregiver", "multi", "a11y", "landing", "demo"]],
  [/^(workshop|pyssel|worksheet)\.js$/, ["workshop", "pyssla", "stepboxes"]],
  [/^step-boxes\.js$/, ["stepboxes", "a11y"]],
  [/^(demo|provtraining)\.js$/, ["demo", "provtraining", "smoke"]],
  [/^tests\/browser\/(helpers|global-setup)\.js$|^playwright\.config\.js$/, ["smoke", "keyboard", "tip", "intro"]],
  [/^(graph-view|path-view|journey|planner|coach)\.js$/, ["popup", "smoke"]]
];

// changed: repository paths with forward slashes; specs: the names of the files in tests/browser without .spec.js; lessonText(id): the text of the specs
function specsFor(changed, specs, mentions) {
  const picked = new Set();
  let known = false;
  changed.forEach((file) => {
    let matched = false;
    RULES.forEach((rule) => {
      if (rule[0].test(file)) { rule[1].forEach((s) => { if (specs.includes(s)) picked.add(s); }); matched = true; }
    });
    let m = /^lessons\/(.+)\.json$/.exec(file);
    if (m) {
      const named = specs.filter((s) => mentions(s, m[1]));
      named.forEach((s) => picked.add(s));
      matched = true;          // a lesson that no spec names is covered by the unit tests and the lesson checks
    }
    m = /^tests\/browser\/(.+)\.spec\.js$/.exec(file);
    if (m && specs.includes(m[1])) { picked.add(m[1]); matched = true; }
    if (matched) known = true;
    else if (/\.(js|css|html)$/.test(file) && !/^(tests|scripts|server|cloudflare|dev|docs)\//.test(file)) FALLBACK.forEach((s) => { if (specs.includes(s)) picked.add(s); });
  });
  return { specs: Array.from(picked).sort(), known: known };
}

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : [];
}

function changedFiles(base) {
  if (base) return git(["diff", "--name-only", base]);
  const dirty = git(["status", "--porcelain"]).map((l) => l.slice(3).replace(/^"|"$/g, "").replace(/.* -> /, ""));
  return dirty.length ? dirty : git(["diff", "--name-only", "HEAD~1", "HEAD"]);
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "";
  const run = (cmd, a, env) => spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32", env: Object.assign({}, process.env, env || {}) }).status;
  if (args.includes("--all")) process.exit(dry ? 0 : (run("npm", ["run", "test:all"]) || 0));

  const specNames = fs.readdirSync(path.join(ROOT, "tests", "browser")).filter((f) => /\.spec\.js$/.test(f)).map((f) => f.replace(/\.spec\.js$/, ""));
  const text = {};
  const mentions = (spec, id) => {
    if (!(spec in text)) text[spec] = fs.readFileSync(path.join(ROOT, "tests", "browser", spec + ".spec.js"), "utf8");
    return new RegExp("[\"'/ ]" + id.replace(/[-]/g, "\\-") + "[\"'/ ]").test(text[spec]);
  };
  const changed = changedFiles(base).map((f) => f.replace(/\\/g, "/"));
  const picked = specsFor(changed, specNames, mentions);
  console.log(changed.length + " changed file(s). Browser specs: " + (picked.specs.join(", ") || "none") + (picked.known ? "" : " (nothing known about these files: the short set)"));
  if (dry) return;
  let status = run("npm", ["test"]);
  if (status === 0 && picked.specs.length) status = run("npx", ["playwright", "test", "--workers=3"].concat(picked.specs.map((s) => "tests/browser/" + s + ".spec.js")));
  process.exit(status || 0);
}

if (require.main === module) main();
module.exports = { specsFor, RULES, FALLBACK };
