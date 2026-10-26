// Prov: a test the teacher builds from lessons. Every student gets a different variant (other numbers, made from the
// lessons' practice templates), the answers are marked at once, and the results appear in the teacher view.
//
// A prov is an assignment of kind "prov". Its settings are in assignment.config:
//   { title, lessons: [ids], perLesson, minutes (0 = no time limit), showResult }
// What a student has done is kept in the student's progress under the key "prov-<assignment id>" (so it needs no
// table of its own):
//   { v: 1, assignmentId, title, startedAt, minutes, total, answers: [record], finishedAt, score }
// A record is { key, lessonId, prompt, answer, correctAnswer, correct, skipped, seconds, kind }.
//
//   GaussicaProv.items(config, lessons, seedText)    the questions of one student, the same every time for the same seed
//   GaussicaProv.recordOf(student, assignment)       what the student has done so far, or null
//   GaussicaProv.status(rec)                         "new" | "started" | "done"
//   GaussicaProv.open(deps, assignment)              the full-screen test for a student
//   GaussicaProv.section(ctx)                        the teacher's part: make a prov, follow the results

window.GaussicaProv = (function () {
  "use strict";

  const PREFIX = "prov-";

  function PR() { return window.GaussicaPractice; }

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function key(assignmentId) { return PREFIX + assignmentId; }

  // ===== the questions =====
  function signature(p) {
    return JSON.stringify([p.prompt, (p.statements || []).map(function (s) { return s.text; }), (p.pairs || []).map(function (x) { return x.term; })]);
  }

  // The questions of one student. Lessons with practice templates give new numbers for every student; a lesson
  // without templates gives its own fixed questions to everyone.
  function items(config, lessons, seedText) {
    const out = [];
    (config.lessons || []).forEach(function (lessonId) {
      const lesson = lessons.find(function (l) { return l.id === lessonId; });
      if (!lesson) return;
      const perLesson = Math.max(1, config.perLesson || 4);
      const templates = PR().templates(lesson);
      if (!templates.length) {
        [lesson.exercise].concat(lesson.wordProblems || []).filter(Boolean).slice(0, perLesson).forEach(function (p, i) {
          out.push({ key: "q" + (out.length + 1), lessonId: lessonId, problem: p, templateId: "fixed-" + i });
        });
        return;
      }
      const seen = new Set();
      const offset = hash(seedText + "|" + lessonId) % templates.length;
      for (let i = 0; i < perLesson; i++) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const t = templates[(offset + i) % templates.length];
          const seed = 1 + (hash(seedText + "|" + lessonId + "|" + i + "|" + attempt) % 999999937);
          const q = PR().generate(lesson, t.id, seed);
          if (!q) continue;
          const sig = signature(q.problem);
          if (seen.has(sig)) continue;
          seen.add(sig);
          out.push({ key: "q" + (out.length + 1), lessonId: lessonId, problem: q.problem, templateId: q.templateId });
          break;
        }
      }
    });
    return out;
  }

  function recordOf(student, assignment) {
    const p = student && student.lessonProgress && student.lessonProgress[key(assignment.id)];
    return p && Array.isArray(p.answers) ? p : null;
  }

  function status(rec) {
    if (!rec) return "new";
    return rec.finishedAt ? "done" : "started";
  }

  function scoreOf(rec) {
    return rec ? rec.answers.filter(function (a) { return a.correct; }).length : 0;
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  // ===== small DOM helpers =====
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function rich(node, text) {
    if (window.GaussicaText) window.GaussicaText.set(node, text); else node.textContent = text;
    return node;
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // ===== the student =====
  function shell(deps, title, onClose) {
    const c = deps.container;
    c.hidden = false;
    document.body.classList.add("player-open");
    c.replaceChildren();
    const root = el("div", "pl-shell");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", title);
    const top = el("header", "pl-top");
    const x = button("✕", "pl-close", onClose);
    x.setAttribute("aria-label", "Stäng");
    top.append(x, el("div", "pl-bar"), el("span", "pl-title", title));
    const main = el("main", "pl-main");
    const card = el("div", "pl-card pt-card");
    main.appendChild(card);
    const foot = el("footer", "pl-foot is-neutral");
    const row = el("div", "pl-foot-row");
    const acts = el("div", "pl-foot-actions");
    row.append(el("div", "pl-foot-msg"), acts);
    foot.appendChild(row);
    root.append(top, main, foot);
    c.appendChild(root);
    return { card: card, acts: acts };
  }

  function leave(deps) {
    deps.container.hidden = true;
    deps.container.replaceChildren();
    document.body.classList.remove("player-open");
    deps.onExit();
  }

  function resultCard(card, rec, config, lessons) {
    const total = rec.total || rec.answers.length;
    const right = scoreOf(rec);
    card.appendChild(el("p", "pt-big", right + " av " + total));
    card.appendChild(el("p", "pt-text", "rätt (" + pct(right, total) + " %)."));
    const list = el("ol", "prov-answers");
    rec.answers.forEach(function (a) {
      const li = el("li", "prov-answer " + (a.correct ? "is-right" : "is-wrong"));
      rich(li.appendChild(el("p", "prov-q")), a.prompt || "");
      const line = el("p", "prov-a");
      line.appendChild(el("strong", "", a.correct ? "✓ Rätt: " : a.skipped ? "Hoppade över. " : "✗ Ditt svar: "));
      if (!a.correct) {
        line.appendChild(document.createTextNode((a.skipped ? "" : (a.answer || "inget svar") + ". ") + "Rätt svar: " + a.correctAnswer));
      } else line.appendChild(document.createTextNode(a.answer));
      li.appendChild(line);
      list.appendChild(li);
    });
    if (rec.answers.length < total) list.appendChild(el("li", "prov-answer is-wrong", "Tiden tog slut. " + plural(total - rec.answers.length, "fråga", "frågor") + " hann du inte svara på."));
    card.appendChild(list);
  }

  function showDone(deps, assignment, rec) {
    const config = assignment.config;
    const s = shell(deps, config.title, function () { leave(deps); });
    s.card.appendChild(el("p", "eyebrow pl-eyebrow", "PROV INLÄMNAT"));
    s.card.appendChild(el("h2", "pl-summary-title", config.title));
    if (config.showResult !== false) resultCard(s.card, rec, config, deps.lessons());
    else s.card.appendChild(el("p", "pt-text", "Du har lämnat in provet. Din lärare rättar det och berättar hur det gick."));
    s.acts.appendChild(button("Tillbaka", "pl-btn pl-btn-primary", function () { leave(deps); }));
  }

  // deps = { container, lessons(), getLesson(id), renderVisuals, student, allowsExpression, formNote,
  //          save(key, record), onExit() }
  function open(deps, assignment) {
    const config = assignment.config;
    if (!config || !Array.isArray(config.lessons)) { deps.onExit(); return; }
    const student = deps.student;
    const list = items(config, deps.lessons(), assignment.id + ":" + student.id);
    if (!list.length) { deps.onExit(); return; }
    let rec = recordOf(student, assignment);
    if (rec && rec.finishedAt) { showDone(deps, assignment, rec); return; }

    const begin = function () {
      if (!rec) {
        rec = { v: 1, assignmentId: assignment.id, title: config.title, startedAt: Date.now(), minutes: config.minutes || 0, total: list.length, answers: [] };
        deps.save(key(assignment.id), rec);
      }
      run(deps, assignment, list, rec);
    };

    const s = shell(deps, config.title, function () { leave(deps); });
    s.card.appendChild(el("p", "eyebrow pl-eyebrow", "PROV"));
    s.card.appendChild(el("h2", "pl-summary-title", config.title));
    s.card.appendChild(el("p", "pt-text", plural(list.length, "fråga", "frågor") + (config.minutes ? " och " + config.minutes + " minuter" : ", ingen tidsgräns") + "."));
    const rules = el("ul", "prov-rules");
    ["Du svarar en gång på varje fråga och kan inte gå tillbaka.", "Du får inga tips under provet, och ser inte om svaret blev rätt förrän du är klar.",
      "Skriv svaret som ett tal om inget annat sägs. Ta papper och penna om du vill räkna.", "Kan du inte en fråga trycker du på Hoppa över."].forEach(function (t) { rules.appendChild(el("li", "", t)); });
    s.card.appendChild(rules);
    if (rec) s.card.appendChild(el("p", "pt-text pt-muted", "Du har redan svarat på " + plural(rec.answers.length, "fråga", "frågor") + ". Provet fortsätter där du slutade" + (config.minutes ? ", och tiden har gått hela tiden sedan du startade." : ".")));
    s.acts.append(button("Inte nu", "pl-btn pl-btn-ghost", function () { leave(deps); }), button(rec ? "Fortsätt provet →" : "Starta provet →", "pl-btn pl-btn-primary", begin));
  }

  function run(deps, assignment, list, rec) {
    const config = assignment.config;
    const endsAt = rec.minutes ? rec.startedAt + rec.minutes * 60000 : null;
    let finalised = false;
    const finalise = function (history) {
      if (finalised) return;
      finalised = true;
      rec.answers = history.slice();
      rec.finishedAt = new Date().toISOString();
      rec.score = scoreOf(rec);
      deps.save(key(assignment.id), rec);
    };
    window.GaussicaTest.run({
      container: deps.container, title: config.title, label: "FRÅGA", total: list.length, history: rec.answers.slice(),
      canSkip: true, skipLabel: "Hoppa över", strict: true, endsAt: endsAt,
      getLesson: deps.getLesson, renderVisuals: deps.renderVisuals, allowsExpression: deps.allowsExpression, formNote: deps.formNote,
      confirmExit: "Lämna provet? Du kan fortsätta senare, men tiden går.",
      next: function (history) { return history.length < list.length ? list[history.length] : null; },
      onAnswer: function (item, record, history) { rec.answers = history.slice(); deps.save(key(assignment.id), rec); },
      onDone: function (history, reason) { if (reason !== "quit") finalise(history); },
      onExit: deps.onExit,
      finish: function (f) {
        f.card.appendChild(el("p", "eyebrow pl-eyebrow", f.reason === "time" ? "TIDEN ÄR SLUT" : "PROV KLART"));
        f.card.appendChild(el("h2", "pl-summary-title", f.reason === "time" ? "Tiden tog slut" : "Du är klar!"));
        if (config.showResult !== false) resultCard(f.card, rec, config, deps.lessons());
        else f.card.appendChild(el("p", "pt-text", "Du har lämnat in provet. Din lärare rättar det och berättar hur det gick."));
        const row = el("div", "pl-foot-row");
        const acts = el("div", "pl-foot-actions");
        acts.appendChild(button("Tillbaka", "pl-btn pl-btn-primary", f.exit));
        row.append(el("div", "pl-foot-msg", "🎉 Bra kämpat"), acts);
        f.foot.className = "pl-foot is-correct";
        f.foot.appendChild(row);
      }
    });
  }

  // ===== the teacher =====
  const ui = { open: false, expanded: {} };

  function lessonChoices(ctx) {
    const L = window.GaussicaLesson;
    return ctx.course.lessons.filter(function (l) { return !l.isParentLesson; }).map(function (l, i) {
      return { l: l, grade: L.effectiveGrade(l, ctx.course.lessons), i: i };
    }).sort(function (a, b) { return a.grade - b.grade || a.i - b.i; });
  }

  function targetsOf(a, ctx) {
    return ctx.students.filter(function (s) { return s.classId === a.classId && (!a.studentId || String(a.studentId) === s.id); });
  }

  function form(ctx) {
    const f = el("form", "tv-ws-form prov-form");
    const field = function (label, control) { const w = el("label", "tv-field"); w.append(el("span", "tv-field-label", label), control); return w; };
    const title = el("input");
    title.type = "text"; title.maxLength = 80; title.value = "Prov"; title.setAttribute("aria-label", "Namn på provet");
    const classSel = el("select");
    ctx.classes.forEach(function (c) { const o = el("option", "", c.name); o.value = String(c.id); classSel.appendChild(o); });
    const studentSel = el("select");
    const fillStudents = function () {
      studentSel.replaceChildren();
      const all = el("option", "", "Hela klassen"); all.value = ""; studentSel.appendChild(all);
      ctx.students.filter(function (s) { return String(s.classId) === classSel.value; }).forEach(function (s) { const o = el("option", "", s.name); o.value = s.id; studentSel.appendChild(o); });
    };
    fillStudents();
    classSel.addEventListener("change", fillStudents);

    const search = el("input", "tv-ws-search");
    search.type = "search"; search.placeholder = "Sök lektion…"; search.setAttribute("aria-label", "Sök lektion");
    const lessonList = el("div", "tv-ws-lessons");
    const boxes = [];
    lessonChoices(ctx).forEach(function (c) {
      const row = el("label", "tv-ws-lesson");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = c.l.id;
      const generated = window.GaussicaPractice.has(c.l);
      row.append(cb, el("span", "", c.l.title), el("small", "tv-muted", " åk " + c.grade + (generated ? "" : " · fasta frågor, samma för alla")));
      row.dataset.text = (c.l.title + " " + c.l.id).toLowerCase();
      lessonList.appendChild(row);
      boxes.push({ cb: cb, row: row });
      cb.addEventListener("change", count);
    });
    search.addEventListener("input", function () {
      const q = search.value.trim().toLowerCase();
      boxes.forEach(function (b) { b.row.hidden = Boolean(q) && b.row.dataset.text.indexOf(q) < 0; });
    });

    const per = el("select");
    [1, 2, 3, 4, 5, 6, 8, 10].forEach(function (n) { const o = el("option", "", n + " per lektion"); o.value = String(n); per.appendChild(o); });
    per.value = "4";
    per.addEventListener("change", count);
    const minutes = el("select");
    [[0, "Ingen tidsgräns"], [10, "10 minuter"], [15, "15 minuter"], [20, "20 minuter"], [30, "30 minuter"], [40, "40 minuter"], [60, "60 minuter"]].forEach(function (m) { const o = el("option", "", m[1]); o.value = String(m[0]); minutes.appendChild(o); });
    minutes.value = "20";
    const date = el("input"); date.type = "date";
    const showBox = document.createElement("input"); showBox.type = "checkbox"; showBox.checked = true;
    const showLabel = el("label", "tv-ws-check"); showLabel.append(showBox, el("span", "", "Eleven ser resultatet direkt efter provet"));
    const note = el("textarea"); note.maxLength = 400; note.rows = 2; note.placeholder = "Skriv något till eleverna (valfritt)";
    const counter = el("p", "tv-muted tv-ws-count");
    function chosen() { return boxes.filter(function (b) { return b.cb.checked; }).map(function (b) { return b.cb.value; }); }
    function count() { counter.textContent = chosen().length ? chosen().length + " lektioner, ungefär " + chosen().length * Number(per.value) + " frågor per elev." : "Välj en eller flera lektioner."; }
    count();
    const error = el("p", "tv-compose-error"); error.hidden = true;
    const go = el("button", "tv-btn is-primary", "Skapa prov 📝"); go.type = "submit";

    const pick = el("div", "tv-ws-pick"); pick.append(search, lessonList, counter);
    const lessonsField = el("div", "tv-field"); lessonsField.append(el("span", "tv-field-label", "Lektioner som provet ska täcka"), pick);
    f.append(field("Namn på provet", title), field("Klass", classSel), field("Vem?", studentSel), lessonsField, field("Antal frågor", per),
      field("Tid", minutes), field("Klart senast (valfritt)", date), showLabel, field("Meddelande till eleverna", note), error, go);

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      const ids = chosen();
      if (!ids.length) { error.textContent = "Välj minst en lektion."; error.hidden = false; return; }
      error.hidden = true;
      go.disabled = true;
      ctx.actions.createAssignment({
        classId: Number(classSel.value), studentId: studentSel.value || null, lessonId: ids[0], kind: "prov",
        config: { title: title.value.trim() || "Prov", lessons: ids, perLesson: Number(per.value), minutes: Number(minutes.value), showResult: showBox.checked },
        note: note.value.trim(), dueDate: date.value || ""
      }).then(function () {
        ctx.setNotice({ text: "Provet har skickats. Varje elev får egna tal, och svaren rättas direkt." });
        ctx.refresh();
      }).catch(function (err) { go.disabled = false; error.textContent = err.message; error.hidden = false; });
    });
    return f;
  }

  function statusChip(rec) {
    const s = status(rec);
    return el("span", "tv-pill " + (s === "done" ? "is-done" : s === "started" ? "is-practice" : ""), s === "done" ? "✓ Inlämnat" : s === "started" ? "◔ Pågår" : "○ Ej startat");
  }

  function studentDetail(student, rec, ctx) {
    const box = el("div", "prov-detail");
    if (!rec || !rec.answers.length) { box.appendChild(el("p", "tv-muted", "Inga svar än.")); return box; }
    const list = el("ol", "prov-answers");
    rec.answers.forEach(function (a) {
      const lesson = ctx.course.lessons.find(function (l) { return l.id === a.lessonId; });
      const li = el("li", "prov-answer " + (a.correct ? "is-right" : "is-wrong"));
      li.appendChild(el("small", "tv-muted", lesson ? lesson.title : a.lessonId));
      rich(li.appendChild(el("p", "prov-q")), a.prompt || "");
      li.appendChild(el("p", "prov-a", (a.correct ? "✓ " : a.skipped ? "Hoppade över. " : "✗ ") + (a.skipped ? "" : (a.answer || "inget svar")) + (a.correct ? "" : "   Rätt svar: " + a.correctAnswer) + (a.note === "calc" ? "   (skrev en uträkning i stället för ett tal)" : a.note === "form" ? "   (rätt värde, fel skrivsätt)" : "") + (a.seconds ? "   · " + a.seconds + " s" : "")));
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
  }

  function card(a, ctx) {
    const config = a.config;
    const box = el("article", "tv-assign-card prov-card");
    const top = el("div", "tv-assign-top");
    const due = window.GaussicaMailbox.dueInfo(a.dueDate);
    top.append(el("strong", "", config.title), el("span", "tv-pill is-practice", "📝 Prov"),
      el("span", "tv-pill", a.className + " · " + (a.studentName || "hela klassen")),
      el("span", "tv-due is-" + due.tone, due.text));
    box.appendChild(top);
    const titles = config.lessons.map(function (id) { const l = ctx.course.lessons.find(function (x) { return x.id === id; }); return l ? l.title : id; });
    box.appendChild(el("p", "tv-muted", titles.join(" · ") + " · " + config.perLesson + " per lektion" + (config.minutes ? " · " + config.minutes + " min" : " · ingen tidsgräns")));
    if (a.note) box.appendChild(el("p", "tv-assign-note", "“" + a.note + "”"));

    const targets = targetsOf(a, ctx);
    if (!targets.length) { box.appendChild(el("p", "tv-muted", "Inga elever i den här klassen än.")); }
    else {
      const recs = targets.map(function (s) { return { s: s, rec: recordOf(s, a) }; });
      const done = recs.filter(function (x) { return status(x.rec) === "done"; });
      const total = recs.reduce(function (n, x) { return Math.max(n, x.rec ? x.rec.total || 0 : 0); }, 0);
      const avg = done.length && total ? Math.round(done.reduce(function (n, x) { return n + pct(scoreOf(x.rec), x.rec.total || total); }, 0) / done.length) : null;
      box.appendChild(el("p", "tv-assign-count", done.length + " av " + plural(targets.length, "elev", "elever") + " har lämnat in" + (avg !== null ? ". Snitt: " + avg + " % rätt." : ".")));

      // how each lesson went, over all students who have answered
      const per = {};
      recs.forEach(function (x) { if (!x.rec) return; x.rec.answers.forEach(function (ans) { const p = per[ans.lessonId] || (per[ans.lessonId] = { n: 0, right: 0 }); p.n += 1; if (ans.correct) p.right += 1; }); });
      if (Object.keys(per).length > 1) {
        const bars = el("div", "prov-lessons");
        config.lessons.forEach(function (id, i) {
          const p = per[id];
          if (!p) return;
          const row = el("div", "prov-lesson");
          row.appendChild(el("span", "prov-lesson-name", titles[i]));
          const bar = el("span", "prov-lesson-bar");
          const fill = el("span", "prov-lesson-fill");
          fill.style.width = pct(p.right, p.n) + "%";
          bar.appendChild(fill);
          row.append(bar, el("span", "prov-lesson-pct", pct(p.right, p.n) + " %"));
          bars.appendChild(row);
        });
        box.appendChild(bars);
      }

      const table = el("table", "tv-report-table prov-table");
      const head = el("tr");
      ["Elev", "Status", "Resultat", "Tid"].forEach(function (h) { head.appendChild(el("th", "", h)); });
      table.appendChild(head);
      recs.slice().sort(function (x, y) { return x.s.name.localeCompare(y.s.name, "sv"); }).forEach(function (x) {
        const tr = el("tr", "prov-row");
        const s = status(x.rec);
        tr.appendChild(el("td", "", x.s.name));
        const st = el("td"); st.appendChild(statusChip(x.rec)); tr.appendChild(st);
        const t = x.rec ? (x.rec.total || total) : total;
        tr.appendChild(el("td", "", x.rec ? scoreOf(x.rec) + " / " + t + (s === "done" ? " (" + pct(scoreOf(x.rec), t) + " %)" : " hittills") : "–"));
        let secs = 0;
        if (x.rec) x.rec.answers.forEach(function (ans) { secs += ans.seconds || 0; });
        tr.appendChild(el("td", "", x.rec && secs ? Math.max(1, Math.round(secs / 60)) + " min" : "–"));
        const k = a.id + ":" + x.s.id;
        tr.addEventListener("click", function () {
          ui.expanded[k] = !ui.expanded[k];
          const next = tr.nextSibling;
          if (next && next.classList && next.classList.contains("prov-detail-row")) next.remove();
          if (ui.expanded[k]) {
            const dr = el("tr", "prov-detail-row");
            const td = el("td"); td.colSpan = 4;
            td.appendChild(studentDetail(x.s, x.rec, ctx));
            dr.appendChild(td);
            tr.after(dr);
          }
        });
        tr.title = "Visa svaren";
        table.appendChild(tr);
        if (ui.expanded[k]) {
          const dr = el("tr", "prov-detail-row");
          const td = el("td"); td.colSpan = 4;
          td.appendChild(studentDetail(x.s, x.rec, ctx));
          dr.appendChild(td);
          table.appendChild(dr);
        }
      });
      box.appendChild(table);
    }
    box.appendChild(button("Ta bort provet", "tv-btn is-danger tv-small", function () {
      if (!window.confirm("Ta bort provet? Eleverna ser det inte längre, och resultaten försvinner härifrån (elevernas svar finns kvar i deras egna data).")) return;
      ctx.actions.archiveAssignment(a.id).then(function () { ctx.refresh(); }).catch(function (err) { ctx.setNotice({ text: err.message, error: true }); ctx.rerender(); });
    }));
    return box;
  }

  function section(ctx) {
    const box = el("details", "admin-card-section tv-section tv-ws tv-prov");
    box.id = "tv-prov";
    box.open = ui.open;
    box.addEventListener("toggle", function () { ui.open = box.open; });
    const summary = el("summary", "tv-ws-sum");
    summary.appendChild(el("h3", "", "📝 Prov"));
    box.appendChild(summary);
    box.appendChild(el("p", "admin-card-description", "Skapa ett prov av lektionernas övningsmallar. Varje elev får egna tal, svaren rättas direkt och resultatet kommer hit. Provet kan ha en tidsgräns, och eleverna får inga tips medan de skriver."));
    if (!ctx.classes.length) { box.appendChild(el("p", "tv-empty", "Skapa en klass ovan först.")); return box; }
    if (ctx.inboxUnavailable) { box.appendChild(el("p", "tv-notice is-error", "Uppdrag och prov fungerar inte än, för servern är inte uppdaterad.")); return box; }
    box.appendChild(form(ctx));
    const provs = (ctx.assignments || []).filter(function (a) { return a.kind === "prov" && a.config; });
    if (provs.length) {
      box.appendChild(el("h4", "prov-heading", "Dina prov"));
      provs.forEach(function (a) { box.appendChild(card(a, ctx)); });
    }
    return box;
  }

  return { items: items, recordOf: recordOf, status: status, scoreOf: scoreOf, key: key, open: open, section: section, KEY_PREFIX: PREFIX };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaProv;
