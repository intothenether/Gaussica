"use strict";
// Makes the pages of the terms (villkor.html, integritet.html, angerratt.html) and the page for parents (foraldrar.html) from the texts in docs/juridik/*.md and the details in
// docs/juridik/uppgifter.json. The pages are plain HTML files (no script), so that anybody, including the payment company that looks at the site before it
// opens an account, can read them. Run it after changing a text or the details:   node scripts/build-legal.js
// While "utkast" is true in uppgifter.json every page says that it is a draft; tests/legal.js refuses a page without a draft notice that still has a
// [placeholder] in it.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "docs", "juridik");
const PAGES = [["foraldrar", "Gaussica för föräldrar"], ["kursplan", "Så täcker Gaussica kursplanen"], ["villkor", "Allmänna villkor"], ["integritet", "Integritetspolicy"], ["angerratt", "Ångerrätt och återbetalning"]];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => '<a href="' + href + '">' + label + "</a>");
}

// a small subset of Markdown: # and ## headings, paragraphs, - lists and 1. lists, **bold** and [links](url)
function markdown(md) {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push("</" + list + ">"); list = null; } };
  let para = [];
  const flush = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
  md.replace(/\r\n/g, "\n").split("\n").forEach((line) => {
    let m;
    if (!line.trim()) { flush(); close(); return; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); close(); out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); return; }
    if ((m = /^-\s+(.*)$/.exec(line))) { flush(); if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); return; }
    if ((m = /^\d+\.\s+(.*)$/.exec(line))) { flush(); if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); return; }
    close();
    para.push(line.trim());
  });
  flush(); close();
  return out.join("\n");
}

const STYLE = "body{margin:0;background:#fff7fa;color:#23284a;font:17px/1.6 Nunito,system-ui,-apple-system,'Segoe UI',sans-serif}main{max-width:740px;margin:0 auto;padding:24px 18px 60px}" +
  "h1{font-size:30px;line-height:1.2;margin:.4em 0}h2{font-size:21px;margin:1.6em 0 .3em}p,li{margin:.5em 0}a{color:#3b4f93;font-weight:700}" +
  ".draft{margin:14px 0;padding:12px 16px;border:2px solid #d9831f;border-radius:12px;background:#fff3e2;font-weight:700}" +
  ".note{padding:10px 14px;border-radius:10px;background:#eef1fb;font-size:15px}.count{font-size:15px;font-weight:600;color:#5c6288}.gap{color:#a8324d;font-weight:700}.lessons{font-size:15px;color:#4a5078}li{margin:.9em 0}" +
  ".back{margin:0}footer{margin-top:40px;padding-top:14px;border-top:1px solid #ecd2dc;font-size:14px;color:#5c6288}footer a{margin-right:14px}";

// the whole page around a body
function page(p, info, body) {
  const draft = info.utkast
    ? '<p class="draft" role="note">UTKAST: den här sidan är inte klar. Uppgifter i [hakparentes] ska fyllas i och texten granskas innan tjänsten tar betalt.</p>'
    : "";
  return '<!doctype html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(p[1]) + " | Gaussica</title>\n<style>" + STYLE + "</style>\n</head>\n<body>\n<main>\n" +
    '<p class="back"><a href="./index.html">&larr; Till Gaussica</a></p>\n' + draft + "\n" + body + "\n" +
    "<footer>Version " + esc(info.version) + " · uppdaterad " + esc(info.datum) + "<br>" + PAGES.map((q) => '<a href="./' + q[0] + '.html">' + esc(q[1]) + "</a>").join("") + "</footer>\n</main>\n</body>\n</html>\n";
}

function build() {
  const info = JSON.parse(fs.readFileSync(path.join(DIR, "uppgifter.json"), "utf8"));
  const out = {};
  let kursplan = null;
  PAGES.forEach(function (p) {
    // the page about the syllabus is made from lgr22.js and the lesson files, not from a text (scripts/kursplan-page.js)
    if (p[0] === "kursplan") {
      kursplan = require("./kursplan-page").html();
      out["kursplan.html"] = page(p, info, kursplan.body);
      return;
    }
    const text = fs.readFileSync(path.join(DIR, p[0] + ".md"), "utf8").replace(/\{\{(\w+)\}\}/g, function (m, key) {
      if (!(key in info)) throw new Error("docs/juridik/" + p[0] + ".md: no detail called {{" + key + "}} in uppgifter.json");
      return String(info[key]);
    });
    out[p[0] + ".html"] = page(p, info, markdown(text));
  });
  return { pages: out, info: info, kursplan: kursplan };
}

if (require.main === module) {
  const made = build();
  Object.keys(made.pages).forEach((file) => { fs.writeFileSync(path.join(ROOT, file), made.pages[file]); console.log("wrote " + file); });
}
module.exports = { build, markdown, PAGES };
