"use strict";
// The fonts are served from the site itself: every @font-face file exists and is a real woff2, and nothing in the page,
// the style sheet, the server or the service worker points at Google's font servers.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let failures = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failures++; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const css = read("styles.css");
const files = (css.match(/url\("\.\/fonts\/[\w-]+\.woff2"\)/g) || []).map((u) => /fonts\/([\w-]+\.woff2)/.exec(u)[1]);
ok(files.length >= 4, "the style sheet loads " + files.length + " font files from ./fonts");
files.forEach((f) => {
  const p = path.join(ROOT, "fonts", f);
  ok(fs.existsSync(p) && fs.readFileSync(p).slice(0, 4).toString() === "wOF2", f + " exists and is a woff2 file");
});
ok(/font-family: "Nunito"/.test(css) && /font-family: "Lexend"/.test(css), "both Nunito and Lexend are declared");
ok(fs.existsSync(path.join(ROOT, "fonts", "README.md")) && /Open Font License/.test(read("fonts/README.md")), "the font licence is included");

["styles.css", "index.html", "server.js", "sw.js", "app.js", "privacy.js"].forEach((f) => {
  ok(!/fonts\.googleapis|fonts\.gstatic/.test(read(f)), f + " has no reference to Google's font servers");
});
ok(!/@import/.test(css), "the style sheet imports nothing from other servers");
ok(/cp -r lessons fonts _site/.test(read(".github/workflows/deploy-pages.yml")), "the deploy copies the fonts folder");

console.log(failures ? failures + " FAILED" : "ALL PASSED");
process.exit(failures ? 1 : 0);
