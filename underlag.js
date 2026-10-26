// Teacher: the course against the syllabus (Lgr22), and a documentation page for each student that can be printed or
// saved as a PDF, for betyg and utvecklingssamtal. It shows what the student has done on Gaussica. It does not grade:
// the judgement is the teacher's.
//
//   GaussicaUnderlag.section(ctx, students)       the class: what has been covered of the central content, and CSV downloads
//   GaussicaUnderlag.openStudent(student, ctx)    the page for one student
//
// The mapping and the numbers come from lgr22.js.

window.GaussicaUnderlag = (function () {
  "use strict";

  const ui = { stage: "alla", open: false };

  function G() { return window.GaussicaLgr22; }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function day(iso) { const d = new Date(iso); return isNaN(d) ? "–" : d.toLocaleDateString("sv-SE"); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }

  function download(name, text) {
    const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function stageItems(stage) {
    return G().CONTENT.filter(function (c) { return stage === "alla" || c.stage === stage; });
  }

  // ===== the proofs of a prov for one student =====
  function provsOf(student, ctx) {
    if (!window.GaussicaProv) return [];
    return (ctx.assignments || []).filter(function (a) {
      return a.kind === "prov" && a.config && a.classId === student.classId && (!a.studentId || String(a.studentId) === student.id);
    }).map(function (a) {
      const rec = window.GaussicaProv.recordOf(student, a);
      return rec && rec.finishedAt ? { title: a.config.title, score: window.GaussicaProv.scoreOf(rec), total: rec.total || rec.answers.length, at: rec.finishedAt } : null;
    }).filter(Boolean);
  }

  // ===== CSV =====
  function itemRows(students, lessons, stage) {
    const rows = [["Elev", "Klass", "Stadium", "Område", "Centralt innehåll", "Status", "Klara lektioner", "Lektioner i kursen", "Lösta uppgifter", "Rätt på första försöket (%)"]];
    const areaName = function (id) { return G().AREAS.find(function (a) { return a.id === id; }).name; };
    const stageName = function (id) { return G().STAGES.find(function (s) { return s.id === id; }).name; };
    students.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "sv"); }).forEach(function (s) {
      G().coverage(s, lessons).forEach(function (c) {
        if (stage !== "alla" && c.item.stage !== stage) return;
        const done = c.lessons.filter(function (e) { return e.state === "complete"; }).length;
        rows.push([s.name, s.class || "", stageName(c.item.stage), areaName(c.item.area), c.item.text, G().STATUS_TEXT[c.status],
          c.item.area === "problem" ? "" : done, c.item.area === "problem" ? "" : c.lessons.length, c.solved, pct(c.first || 0, c.solved) === null || c.item.area === "problem" ? "" : pct(c.first, c.solved)]);
      });
    });
    return rows;
  }

  function summaryRows(students, lessons, ctx) {
    const rows = [["Elev", "Klass", "Klara lektioner", "Påbörjade lektioner", "Lösta uppgifter", "Rätt på första försöket (%)", "Antal inskickade svar", "Aktiva dagar", "Första aktivitet", "Senaste aktivitet",
      "Begrepp, rätt direkt (%)", "Metod, rätt direkt (%)", "Problemlösning, rätt direkt (%)", "Prov (snitt, %)"]];
    students.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "sv"); }).forEach(function (s) {
      const sum = G().summary(s, lessons);
      const ab = G().abilities(s, lessons);
      const provs = provsOf(s, ctx);
      const avg = provs.length ? Math.round(provs.reduce(function (n, p) { return n + pct(p.score, p.total); }, 0) / provs.length) : "";
      rows.push([s.name, s.class || "", sum.lessonsFinished, sum.lessonsBegun, sum.tasksSolved, sum.firstTryRate === null ? "" : sum.firstTryRate, sum.submissions, sum.activeDays,
        sum.firstAt ? day(sum.firstAt) : "", sum.lastAt ? day(sum.lastAt) : "",
        ab.begrepp.firstRate === null ? "" : ab.begrepp.firstRate, ab.metod.firstRate === null ? "" : ab.metod.firstRate, ab.problemlosning.firstRate === null ? "" : ab.problemlosning.firstRate, avg]);
    });
    return rows;
  }

  // ===== the class =====
  function bar(counts, n) {
    const b = el("span", "ul-bar");
    [["klar", "ul-klar"], ["delvis", "ul-delvis"], ["nivatest", "ul-niva"]].forEach(function (k) {
      if (!counts[k[0]]) return;
      const seg = el("span", "ul-seg " + k[1]);
      seg.style.width = (counts[k[0]] / n * 100) + "%";
      seg.title = counts[k[0]] + " " + G().STATUS_TEXT[k[0]].toLowerCase();
      b.appendChild(seg);
    });
    return b;
  }

  function section(ctx, students) {
    const box = el("details", "admin-card-section tv-section tv-ws tv-underlag");
    box.id = "tv-underlag";
    box.open = ui.open;
    box.addEventListener("toggle", function () { ui.open = box.open; });
    const summary = el("summary", "tv-ws-sum");
    summary.appendChild(el("h3", "", "📋 Kursplanen och bedömningsunderlag"));
    box.appendChild(summary);
    box.appendChild(el("p", "admin-card-description", "Varje lektion är kopplad till centralt innehåll i kursplanen för matematik (Lgr22). Här ser du vad klassen har arbetat med, och du kan ladda ner underlag att använda vid betyg och utvecklingssamtal. Underlaget visar vad eleverna har gjort på Gaussica, det sätter inget betyg. Beskrivningarna av innehållet är en kort sammanfattning med egna ord: kontrollera mot Skolverkets kursplan innan du använder dem som dokumentation."));
    if (!students.length) { box.appendChild(el("p", "tv-empty", "Inga elever att visa än.")); return box; }

    const lessons = ctx.course.lessons;
    const chips = el("div", "tv-sort");
    chips.appendChild(el("span", "tv-sort-label", "Visa:"));
    [{ id: "alla", name: "Alla" }].concat(G().STAGES).forEach(function (s) {
      chips.appendChild(button(s.name, "tv-chip" + (ui.stage === s.id ? " is-on" : ""), function () { ui.stage = s.id; ctx.rerender(); }));
    });
    box.appendChild(chips);

    const data = G().classCoverage(students, lessons).filter(function (c) { return ui.stage === "alla" || c.item.stage === ui.stage; });
    G().AREAS.forEach(function (area) {
      const rows = data.filter(function (c) { return c.item.area === area.id; });
      if (!rows.length) return;
      box.appendChild(el("h4", "ul-area", area.name));
      const table = el("table", "ul-table");
      rows.forEach(function (c) {
        const tr = el("tr");
        const stage = el("td", "ul-stage", c.item.stage.replace("-", "–"));
        const text = el("td", "ul-text", c.item.text);
        const cov = el("td", "ul-cov");
        if (c.item.area !== "problem" && !c.lessons) {
          cov.appendChild(el("span", "ul-none", "Ingen lektion än"));
        } else {
          cov.appendChild(bar(c.counts, c.n));
          const t = [];
          if (c.counts.klar) t.push(c.counts.klar + " klara");
          if (c.counts.delvis) t.push(c.counts.delvis + " delvis");
          if (c.counts.nivatest) t.push(c.counts.nivatest + " nivåtest");
          cov.appendChild(el("span", "ul-count", t.join(", ") || "ingen än"));
        }
        const les = el("td", "ul-les", c.item.area === "problem" ? "textuppgifter" : plural(c.lessons, "lektion", "lektioner"));
        tr.append(stage, text, cov, les);
        table.appendChild(tr);
      });
      box.appendChild(table);
    });

    const unmapped = lessons.filter(function (l) { return !l.isParentLesson && !G().MAP[l.id]; });
    if (unmapped.length) box.appendChild(el("p", "tv-muted", plural(unmapped.length, "lektion", "lektioner") + " saknar koppling till kursplanen (till exempel egna lektioner): " + unmapped.slice(0, 5).map(function (l) { return l.title; }).join(", ") + (unmapped.length > 5 ? " med flera" : "") + "."));

    const actions = el("div", "ul-actions");
    actions.appendChild(button("Ladda ner innehåll per elev (CSV)", "tv-btn", function () {
      download("gaussica-centralt-innehall.csv", G().csv(itemRows(students, lessons, ui.stage)));
    }));
    actions.appendChild(button("Ladda ner sammanfattning per elev (CSV)", "tv-btn", function () {
      download("gaussica-sammanfattning-elever.csv", G().csv(summaryRows(students, lessons, ctx)));
    }));
    box.appendChild(actions);
    box.appendChild(el("p", "tv-muted", "CSV-filerna öppnas i Excel eller Google Kalkylark (semikolon som skiljetecken). För en enskild elev finns knappen Bedömningsunderlag i elevens vy."));
    return box;
  }

  // ===== one student =====
  function close() {
    const o = document.getElementById("ws-overlay");
    if (o) o.remove();
    document.body.classList.remove("is-printing-worksheet");
  }

  function sheet(student, ctx, stage) {
    const lessons = ctx.course.lessons;
    const page = el("article", "ws-sheet ul-sheet");
    const head = el("header", "ws-head");
    head.append(el("p", "ws-brand", "Gaussica · Underlag för bedömning"), el("h1", "", student.name));
    head.appendChild(el("p", "ws-sub", (student.class || "") + (student.class ? " · " : "") + "Utskrivet " + day(new Date().toISOString())));
    page.appendChild(head);
    page.appendChild(el("p", "ul-note", "Underlaget visar vad eleven har gjort på Gaussica och hur det gick. Det är ett stöd för lärarens bedömning, inte en bedömning i sig. Centralt innehåll är kopplat till lektionerna enligt en egen sammanfattning av kursplanen (Lgr22, matematik)."));

    const sum = G().summary(student, lessons);
    page.appendChild(el("h2", "ws-section", "Översikt"));
    const facts = el("ul", "ul-facts");
    [
      plural(sum.lessonsFinished, "lektion", "lektioner") + " klara, " + sum.lessonsBegun + " påbörjade",
      plural(sum.tasksSolved, "uppgift", "uppgifter") + " lösta" + (sum.firstTryRate === null ? "" : ", " + sum.firstTryRate + " % rätt på första försöket"),
      plural(sum.submissions, "inskickat svar", "inskickade svar") + " varav " + sum.wrong + " blev fel (att svara fel och försöka igen är en del av lärandet)",
      sum.activeDays ? "Aktiv " + plural(sum.activeDays, "dag", "olika dagar") + ", från " + day(sum.firstAt) + " till " + day(sum.lastAt) : "Ingen aktivitet än"
    ].forEach(function (t) { facts.appendChild(el("li", "", t)); });
    const placed = window.GaussicaPlacement && window.GaussicaPlacement.saved(student);
    if (placed) facts.appendChild(el("li", "", "Nivåtest " + (placed.at ? day(placed.at) : "") + ": verkar kunna " + plural(placed.known.length, "lektion", "lektioner") + (placed.level ? ", ungefär upp till " + window.GaussicaLesson.gradeLabel(placed.level).toLowerCase() : "")));
    page.appendChild(facts);

    // central content, by area
    page.appendChild(el("h2", "ws-section", "Centralt innehåll"));
    const cov = G().coverage(student, lessons).filter(function (c) { return stage === "alla" || c.item.stage === stage; });
    G().AREAS.forEach(function (area) {
      const rows = cov.filter(function (c) { return c.item.area === area.id; });
      if (!rows.length) return;
      page.appendChild(el("h3", "ul-area", area.name));
      const table = el("table", "ul-table ul-print");
      rows.forEach(function (c) {
        const tr = el("tr", "ul-row is-" + c.status);
        tr.appendChild(el("td", "ul-stage", c.item.stage.replace("-", "–")));
        tr.appendChild(el("td", "ul-text", c.item.text));
        const st = el("td", "ul-status");
        st.appendChild(el("span", "ul-chip is-" + c.status, G().STATUS_TEXT[c.status]));
        tr.appendChild(st);
        let ev;
        if (c.item.area === "problem") ev = c.words.solved + " av " + c.words.total + " textuppgifter lösta";
        else if (!c.lessons.length) ev = "ingen lektion i kursen";
        else {
          const done = c.lessons.filter(function (e) { return e.state === "complete"; });
          ev = done.length + " av " + c.lessons.length + " klara" + (c.solved ? ", " + pct(c.first, c.solved) + " % rätt direkt" : "");
        }
        tr.appendChild(el("td", "ul-ev", ev));
        table.appendChild(tr);
      });
      page.appendChild(table);
    });

    // abilities
    const ab = G().abilities(student, lessons);
    page.appendChild(el("h2", "ws-section", "Förmågor: det loggen kan visa"));
    const fact = function (name, a, what) {
      return name + ": " + a.solved + " av " + a.total + " " + what + " lösta" + (a.firstRate === null ? "" : ", " + a.firstRate + " % rätt på första försöket");
    };
    const abList = el("ul", "ul-facts");
    abList.appendChild(el("li", "", fact("Begrepp", ab.begrepp, "uppgifter i begreppslektionerna")));
    abList.appendChild(el("li", "", fact("Metod", ab.metod, "räkneuppgifter")));
    abList.appendChild(el("li", "", fact("Problemlösning", ab.problemlosning, "textuppgifter")));
    abList.appendChild(el("li", "", "Kommunikation: har ritat eller skrivit på ritytan i " + plural(ab.kommunikation.drawn, "uppgift", "uppgifter") + " av " + ab.kommunikation.tasks + " besvarade"));
    abList.appendChild(el("li", "ul-teacher", "Resonemang: kan inte avläsas i loggen, bedöms av läraren."));
    page.appendChild(abList);

    const provs = provsOf(student, ctx);
    if (provs.length) {
      page.appendChild(el("h2", "ws-section", "Prov"));
      const pl = el("ul", "ul-facts");
      provs.forEach(function (p) { pl.appendChild(el("li", "", p.title + ": " + p.score + " av " + p.total + " rätt (" + pct(p.score, p.total) + " %), " + day(p.at))); });
      page.appendChild(pl);
    }

    page.appendChild(el("h2", "ws-section", "Lärarens bedömning"));
    const lines = el("div", "ws-lines ul-lines");
    for (let i = 0; i < 6; i++) lines.appendChild(el("div", "ws-line"));
    page.appendChild(lines);
    page.appendChild(el("p", "ul-sign", "Datum: ______________     Signatur: ______________________"));
    return page;
  }

  function openStudent(student, ctx) {
    close();
    const lessons = ctx.course.lessons;
    // the stage where most of the student's finished lessons are
    const counts = { "1-3": 0, "4-6": 0, "7-9": 0 };
    const memo = new Map();
    lessons.forEach(function (l) {
      if (l.isParentLesson) return;
      const p = (student.lessonProgress || {})[l.id];
      if (!p) return;
      const sum = window.GaussicaLesson.summarize(l, function (id) { return (student.lessonProgress || {})[id]; }, lessons);
      if (sum.state !== "new") counts[G().stageOfGrade(window.GaussicaLesson.effectiveGrade(l, lessons, memo))] += 1;
    });
    let stage = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    if (!counts[stage]) stage = "4-6";

    const overlay = el("div", "ws-overlay");
    overlay.id = "ws-overlay";
    const bar = el("div", "ws-bar");
    const print = button("🖨 Skriv ut eller spara som PDF", "tv-btn is-primary", function () { window.print(); });
    const closeBtn = button("Stäng", "tv-btn", close);
    const select = document.createElement("select");
    [["alla", "Alla stadier"]].concat(G().STAGES.map(function (s) { return [s.id, s.name]; })).forEach(function (s) { const o = el("option", "", s[1]); o.value = s[0]; select.appendChild(o); });
    select.value = stage;
    select.setAttribute("aria-label", "Vilket stadium som visas");
    bar.append(print, closeBtn, select, el("span", "tv-muted", "Välj stadium. Välj Spara som PDF i utskriftsrutan om du vill ha en fil."));
    overlay.appendChild(bar);
    let page = sheet(student, ctx, select.value);
    overlay.appendChild(page);
    select.addEventListener("change", function () { const next = sheet(student, ctx, select.value); page.replaceWith(next); page = next; });
    document.body.appendChild(overlay);
    document.body.classList.add("is-printing-worksheet");
    overlay.scrollTop = 0;
  }

  return { section: section, openStudent: openStudent, itemRows: itemRows, summaryRows: summaryRows, close: close };
}());
