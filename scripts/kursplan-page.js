"use strict";
// The body of kursplan.html, "Så täcker Gaussica kursplanen": for every stage and area of the syllabus for mathematics (Lgr22), which lessons give practice in the
// central content, and where there is none yet. Made from lgr22.js (the list of central content and which lesson gives practice in what) and the lesson files, so
// it is never out of date: node scripts/build-legal.js builds it with the other pages, and tests/legal.js checks that the page on disk is the one that is made.
const fs = require("fs");
const path = require("path");

global.window = global.window || global;   // lgr22.js is a browser file that also exports itself
const G = require("../lgr22.js");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function lessons() {
  const dir = path.join(__dirname, "..", "lessons");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  return idx.lessons.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

function html() {
  const all = lessons();
  const real = all.filter((l) => !l.isParentLesson);
  const out = [];
  let covered = 0;
  const rows = G.CONTENT.map((c) => {
    const ls = G.lessonsOf(c.id, all);
    if (ls.length) covered += 1;
    return { c, ls };
  });
  out.push("<h1>Så täcker Gaussica kursplanen</h1>");
  out.push("<p>Kursplanen i matematik för grundskolan (Lgr22) har ett centralt innehåll för årskurs 1–3, 4–6 och 7–9. Här ser du, för varje del av det, vilka lektioner i Gaussica som ger övning i det, och var det inte finns några lektioner än. Vi visar luckorna för att du ska kunna bedöma själv om Gaussica passar.</p>");
  out.push("<p><strong>" + covered + " av " + rows.length + " delar</strong> av det centrala innehållet har minst en lektion, med totalt " + real.length + " lektioner från åk 3 till gymnasiet.</p>");
  out.push('<p class="note">Listan över det centrala innehållet är vår egen sammanfattning, grupperad som kursplanen, och inte kursplanens ordalydelse. Läs den i original hos <a href="https://www.skolverket.se">Skolverket</a>. Gaussica börjar i åk 3, så åk 1–2 finns inte med, och gymnasiets matematik (från åk 10) har vi inte kartlagt mot kursplanen.</p>');
  G.STAGES.forEach((stage) => {
    const inStage = rows.filter((r) => r.c.stage === stage.id);
    const have = inStage.filter((r) => r.ls.length).length;
    out.push("<h2>" + esc(stage.name) + ' <span class="count">' + have + " av " + inStage.length + "</span></h2>");
    G.AREAS.forEach((area) => {
      const items = inStage.filter((r) => r.c.area === area.id);
      if (!items.length) return;
      out.push("<h3>" + esc(area.name) + "</h3>");
      out.push("<ul>");
      items.forEach((r) => {
        const titles = r.ls.map((l) => l.title);
        const shown = titles.slice(0, 5).map(esc).join("; ") + (titles.length > 5 ? "; och " + (titles.length - 5) + " till" : "");
        out.push("<li>" + esc(r.c.text) + "<br>" + (titles.length
          ? '<span class="lessons">' + titles.length + (titles.length === 1 ? " lektion: " : " lektioner: ") + shown + "</span>"
          : '<span class="gap">Inga lektioner än.</span>') + "</li>");
      });
      out.push("</ul>");
    });
  });
  out.push('<p><a href="./index.html#prova">Prova Gaussica utan konto</a></p>');
  return { body: out.join("\n"), covered: covered, total: rows.length, lessons: real.length };
}

module.exports = { html };
