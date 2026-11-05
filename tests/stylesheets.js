"use strict";
// The style sheets: every .css file of the site is linked from index.html (so the server hands it out) and is copied by the Pages workflow,
// and a file that was split off from styles.css holds only its own blocks (no :root, no @font-face), so the themes stay in one place.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const sheets = fs.readdirSync(ROOT).filter((f) => /\.css$/.test(f));
const html = read("index.html");
const workflow = read(".github/workflows/deploy-pages.yml");

ok(sheets.includes("styles.css"), "styles.css exists");
sheets.forEach((f) => ok(html.includes('href="./' + f + '"'), f + " is linked from index.html"));
ok(/cp [^\n]*\*\.css/.test(workflow), "the Pages workflow copies every .css file, not just styles.css");
ok(html.indexOf('href="./styles.css"') < Math.min(...sheets.filter((f) => f !== "styles.css").map((f) => html.indexOf('href="./' + f + '"')).concat([Infinity])), "styles.css comes first, the split-off files after it");
sheets.filter((f) => f !== "styles.css").forEach((f) => {
  const css = read(f);
  ok(!/:root\s*\{/.test(css) && !/@font-face/.test(css), f + " does not redefine the theme or the fonts");
  ok(css.trim().length > 200, f + " is not empty");
});

// a stray "}" (a rule that lost its selector) makes the browser drop the rule after it
sheets.forEach((f) => {
  const css = read(f).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  let depth = 0, line = 1;
  const stray = [];
  for (const c of css) {
    if (c === "\n") line++;
    else if (c === "{") depth++;
    else if (c === "}") { if (depth === 0) stray.push(line); else depth--; }
  }
  ok(!stray.length && depth === 0, f + ": every { has its } and no } stands alone" + (stray.length ? " (stray at line " + stray.join(", ") + ")" : ""));
});

if (failures) { console.log(failures + " stylesheet check(s) failed"); process.exit(1); }
console.log("All stylesheet checks passed");
