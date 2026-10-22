// Teacher view (#admin): class overview, hardest questions, common mistakes, and a
// detailed per-student log showing every try, wrong answer, diagnosis and scratchpad.
//
// Data comes from student.attempts (one entry per submitted answer) and
// student.lessonProgress (current state per task). See lesson-model.js.

window.GaussicaTeacher = (function () {
  "use strict";

  const ui = { studentId: null, lessonId: "alla", sort: "attention", classId: "alla", notice: null };

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
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function normAnswer(a) { return String(a == null ? "" : a).trim().toLowerCase().replace(/\s+/g, " "); }

  // ===== ANALYTICS =====
  function analyzeStudent(student, course) {
    const L = window.GaussicaLesson;
    const progress = student.lessonProgress || {};
    const lessons = [];
    const totals = { attempted: 0, solved: 0, firstTry: 0, fix: 0, submissions: 0, triesSum: 0, triesCount: 0, lastAt: null };

    const lessonIds = new Set(Object.keys(progress));
    (student.attempts || []).forEach(function (a) { if (L.isSubmission(a)) lessonIds.add(a.lessonId); });

    course.lessons.forEach(function (lesson) {
      if (!lessonIds.has(lesson.id)) return;
      const entries = (progress[lesson.id] && progress[lesson.id].answers) || {};
      const known = {};
      const taskRows = [];

      const addRow = function (taskId, name, problem, fallback) {
        const subs = L.history(student, lesson.id, taskId);
        const entry = entries[taskId];
        const hasDraft = Boolean(entry && (entry.answer || entry.scratchpad));
        if (!subs.length && !hasDraft && !(entry && entry.completed)) return;
        const stats = L.taskStats(subs, entry);
        let status = "todo";
        if (stats.solvedNow || (!entry && stats.solved)) status = "done";
        else if (subs.length) status = "fix";
        else if (hasDraft) status = "draft";
        taskRows.push({
          taskId: taskId, name: name, subs: subs, entry: entry, stats: stats, status: status,
          prompt: problem ? problem.prompt : (fallback && fallback.prompt) || "",
          correct: problem ? problem.answer.join(" / ") : (fallback && fallback.correctAnswer) || "",
          orphan: !problem
        });
        known[taskId] = true;
        totals.attempted += 1;
        totals.submissions += subs.length;
        if (status === "done") totals.solved += 1;
        if (status === "done" && stats.triesToSolve === 1) totals.firstTry += 1;
        if (status === "fix") totals.fix += 1;
        if (stats.triesToSolve) { totals.triesSum += stats.triesToSolve; totals.triesCount += 1; }
        if (stats.lastAt && (!totals.lastAt || stats.lastAt > totals.lastAt)) totals.lastAt = stats.lastAt;
      };

      L.tasks(lesson).forEach(function (t) { addRow(t.id, t.name, t.problem); });
      // answers logged for tasks that no longer exist in the lesson (edited since)
      const orphanIds = {};
      (student.attempts || []).forEach(function (a) {
        if (a.lessonId === lesson.id && L.isSubmission(a) && !known[a.taskId] && !orphanIds[a.taskId]) orphanIds[a.taskId] = a;
      });
      Object.keys(orphanIds).forEach(function (id) {
        const a = orphanIds[id];
        if (!L.tasks(lesson).some(function (t) { return t.id === id; })) addRow(id, a.taskName || id, null, a);
      });

      if (taskRows.length) lessons.push({ lesson: lesson, tasks: taskRows });
    });

    return {
      student: student, lessons: lessons, totals: totals,
      avgTries: totals.triesCount ? totals.triesSum / totals.triesCount : null,
      needsAttention: totals.fix
    };
  }

  function analyzeClass(students, course) {
    const L = window.GaussicaLesson;
    const per = students.map(function (s) { return analyzeStudent(s, course); });
    const tasks = new Map();
    const mistakes = new Map();

    per.forEach(function (a) {
      a.lessons.forEach(function (lr) {
        lr.tasks.forEach(function (tr) {
          const key = lr.lesson.id + "|" + tr.taskId;
          if (!tasks.has(key)) {
            tasks.set(key, { key: key, lesson: lr.lesson, taskId: tr.taskId, name: tr.name, prompt: tr.prompt, correct: tr.correct,
              tried: 0, solved: 0, triesSum: 0, triesCount: 0, wrong: new Map(), students: [] });
          }
          const t = tasks.get(key);
          t.tried += 1;
          if (tr.status === "done") t.solved += 1;
          if (tr.stats.triesToSolve) { t.triesSum += tr.stats.triesToSolve; t.triesCount += 1; }
          t.students.push({ student: a.student, row: tr });
          tr.stats.wrongAnswers.forEach(function (w) {
            const k = normAnswer(w.answer);
            if (!k) return;
            t.wrong.set(k, (t.wrong.get(k) || 0) + 1);
          });
        });
      });
      a.student.attempts && a.student.attempts.filter(L.isSubmission).forEach(function (att) {
        if (att.misconception) mistakes.set(att.misconception, (mistakes.get(att.misconception) || 0) + 1);
      });
    });
    return { per: per, tasks: Array.from(tasks.values()), mistakes: mistakes };
  }

  // ===== RENDER =====
  function render(container, ctx) {
    if (ui.classId !== "alla" && !ctx.classes.some(function (c) { return String(c.id) === ui.classId; })) ui.classId = "alla";
    const students = ui.classId === "alla" ? ctx.students
      : ctx.students.filter(function (s) { return String(s.classId) === ui.classId; });
    const data = analyzeClass(students, ctx.course);
    if (!ui.studentId || !students.some(function (s) { return s.id === ui.studentId; })) {
      ui.studentId = students[0] && students[0].id;
    }
    container.replaceChildren();
    const root = el("div", "tv");
    root.appendChild(header(ctx));
    if (ui.notice) root.appendChild(noticeBox());
    root.appendChild(classesSection(ctx));
    if (!ctx.students.length) {
      const empty = el("section", "admin-card-section tv-section");
      empty.append(el("h3", "", "Inga elever än"),
        el("p", "admin-card-description", ctx.classes.length
          ? "Ge klasskoden ovan till eleverna. När de har skapat konto och börjat räkna dyker de upp här."
          : "Skapa en klass ovan och dela klasskoden med eleverna så att de kan skapa konto."));
      root.appendChild(empty);
      container.appendChild(root);
      return;
    }
    root.append(kpis(data), studentTable(data, ctx));
    const hard = hardestTasks(data);
    const miscs = mistakeList(data);
    const grid = el("div", "tv-two");
    grid.append(hard, miscs);
    root.appendChild(grid);
    const detail = studentDetail(data, ctx);
    if (detail) root.appendChild(detail);
    container.appendChild(root);
  }

  function header(ctx) {
    const bar = el("div", "admin-header-bar");
    const left = el("div", "admin-header-left");
    left.appendChild(button("← Tillbaka till lärstigen", "admin-back-btn", ctx.actions.back));
    const row = el("div", "admin-title-row");
    const h2 = el("h2", "", "Läraröversikt");
    h2.id = "admin-title";
    row.append(h2, el("span", "admin-badge", "LÄRARE"));
    left.append(row, el("p", "admin-subtitle",
      "Se hur varje elev klarar uppgifterna: vilka svar som blev fel, vad eleven tänkte och hur många försök det tog."));
    const actions = el("div", "admin-header-actions");
    const csv = button("Exportera CSV 📥", "admin-action-btn", ctx.actions.exportCSV);
    csv.title = "Ett rad per inskickat svar, med försöksnummer och rätt svar";
    actions.append(csv,
      button("Exportera JSON 💾", "admin-action-btn", ctx.actions.exportJSON),
      button("Uppdatera ↻", "admin-action-btn", ctx.refresh));
    bar.append(left, actions);
    return bar;
  }

  function kpis(data) {
    const sum = data.per.reduce(function (acc, a) {
      acc.attempted += a.totals.attempted; acc.solved += a.totals.solved; acc.firstTry += a.totals.firstTry;
      acc.fix += a.totals.fix; acc.submissions += a.totals.submissions;
      acc.triesSum += a.totals.triesSum; acc.triesCount += a.totals.triesCount;
      return acc;
    }, { attempted: 0, solved: 0, firstTry: 0, fix: 0, submissions: 0, triesSum: 0, triesCount: 0 });
    const grid = el("div", "admin-kpi-grid");
    const card = function (label, value, note, tone) {
      const c = el("div", "admin-kpi-card" + (tone ? " tv-kpi-" + tone : ""));
      c.append(el("span", "admin-kpi-label", label), el("div", "admin-kpi-value", value), el("p", "admin-kpi-note", note));
      return c;
    };
    grid.append(
      card("UPPGIFTER KLARA", sum.solved + " / " + sum.attempted, "av de uppgifter eleverna påbörjat"),
      card("RÄTT PÅ FÖRSTA FÖRSÖKET", pct(sum.firstTry, sum.solved) + "%", sum.firstTry + " av " + sum.solved + " lösta uppgifter"),
      card("SNITT FÖRSÖK TILL RÄTT", sum.triesCount ? (sum.triesSum / sum.triesCount).toFixed(1) : "–", "per löst uppgift"),
      card("BEHÖVER RÄTTAS", String(sum.fix), "uppgifter med fel svar som inte lösts än", sum.fix ? "warn" : "")
    );
    return grid;
  }

  function noticeBox() {
    const box = el("p", "tv-notice" + (ui.notice.error ? " is-error" : ""));
    box.append(document.createTextNode(ui.notice.text));
    if (ui.notice.code) { box.append(" ", el("code", "", ui.notice.code)); }
    const close = button("✕", "tv-btn", function () { ui.notice = null; box.remove(); });
    close.style.marginLeft = "10px";
    close.setAttribute("aria-label", "Stäng meddelandet");
    box.appendChild(close);
    return box;
  }

  function classesSection(ctx) {
    const section = el("section", "admin-card-section tv-section");
    section.append(el("h3", "", "Klasser"),
      el("p", "admin-card-description", "Eleverna skapar sitt eget konto med klasskoden. Du ser bara elever i dina egna klasser."));
    if (ctx.classes.length) {
      const list = el("div", "tv-classes");
      ctx.classes.forEach(function (c) {
        const row = el("div", "tv-class");
        row.append(el("strong", "", c.name), el("span", "tv-code", c.code),
          el("span", "tv-muted", plural(c.students, "elev", "elever")));
        list.appendChild(row);
      });
      section.appendChild(list);
    }
    const form = el("form", "tv-class-form");
    const input = el("input");
    input.type = "text"; input.maxLength = 60; input.required = true; input.placeholder = "Namn på ny klass, t.ex. 5A";
    input.setAttribute("aria-label", "Namn på ny klass");
    const submit = button("+ Skapa klass", "tv-btn", function () {});
    submit.type = "submit";
    form.append(input, submit);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit.disabled = true;
      ctx.actions.createClass(input.value.trim()).then(function (c) {
        ui.notice = { text: "Klassen skapades. Klasskod för eleverna:", code: c.code };
        ctx.refresh();
      }).catch(function (err) {
        ui.notice = { text: err.message, error: true };
        ctx.rerender();
      });
    });
    section.appendChild(form);
    return section;
  }

  function lastSeen(iso, ctx) {
    return iso ? ctx.formatTimestamp(iso) : "–";
  }

  function studentTable(data, ctx) {
    const section = el("section", "admin-card-section tv-section");
    section.append(el("h3", "", "Elever"),
      el("p", "admin-card-description", "Klicka på en elev för att se alla försök och felsvar längre ned."));

    const rows = data.per.slice();
    const sorters = {
      attention: function (a, b) { return b.needsAttention - a.needsAttention || (b.avgTries || 0) - (a.avgTries || 0); },
      name: function (a, b) { return a.student.name.localeCompare(b.student.name, "sv"); },
      tries: function (a, b) { return (b.avgTries || 0) - (a.avgTries || 0); },
      active: function (a, b) { return String(b.totals.lastAt || "").localeCompare(String(a.totals.lastAt || "")); }
    };
    rows.sort(sorters[ui.sort]);

    if (ctx.classes.length > 1) {
      const classRow = el("div", "tv-sort");
      classRow.appendChild(el("span", "tv-sort-label", "Klass:"));
      [{ id: "alla", name: "Alla" }].concat(ctx.classes.map(function (c) { return { id: String(c.id), name: c.name }; })).forEach(function (c) {
        classRow.appendChild(button(c.name, "tv-chip" + (ui.classId === c.id ? " is-on" : ""), function () { ui.classId = c.id; ctx.rerender(); }));
      });
      section.appendChild(classRow);
    }
    const sortRow = el("div", "tv-sort");
    sortRow.appendChild(el("span", "tv-sort-label", "Sortera:"));
    [["attention", "Behöver hjälp"], ["tries", "Flest försök"], ["active", "Senast aktiv"], ["name", "Namn"]].forEach(function (o) {
      const b = button(o[1], "tv-chip" + (ui.sort === o[0] ? " is-on" : ""), function () { ui.sort = o[0]; ctx.rerender(); });
      sortRow.appendChild(b);
    });
    section.appendChild(sortRow);

    const wrap = el("div", "tv-table-wrap");
    const table = el("table", "tv-table");
    const head = el("tr");
    ["Elev", "Klara uppgifter", "Rätt på 1:a försöket", "Snitt försök", "Att rätta", "Senast aktiv"].forEach(function (h) {
      head.appendChild(el("th", "", h));
    });
    table.appendChild(el("thead")).appendChild(head);
    const body = el("tbody");
    rows.forEach(function (a) {
      const tr = el("tr", "tv-row" + (a.student.id === ui.studentId ? " is-selected" : ""));
      tr.tabIndex = 0;
      const select = function () { ui.studentId = a.student.id; ctx.rerender(); const d = document.querySelector(".tv-detail"); if (d) d.scrollIntoView({ behavior: "smooth", block: "start" }); };
      tr.addEventListener("click", select);
      tr.addEventListener("keydown", function (e) { if (e.key === "Enter") select(); });

      const nameCell = el("td");
      const nameBox = el("div", "tv-name");
      const avatar = el("span", "admin-student-avatar", a.student.name.charAt(0).toUpperCase());
      if (a.student.color) avatar.style.background = a.student.color;
      const who = el("span", "tv-who");
      who.append(el("strong", "", a.student.name), el("small", "", a.student.class));
      nameBox.append(avatar, who);
      nameCell.appendChild(nameBox);

      const t = a.totals;
      const prog = el("td");
      prog.append(el("div", "tv-numrow", t.solved + " / " + t.attempted), miniBar(a));
      const first = el("td", "", t.solved ? pct(t.firstTry, t.solved) + " %" : "–");
      const avg = el("td", "", a.avgTries ? a.avgTries.toFixed(1) : "–");
      if (a.avgTries && a.avgTries >= 2.5) avg.classList.add("is-warn");
      const fix = el("td");
      fix.appendChild(t.fix ? el("span", "tv-pill is-fix", plural(t.fix, "uppgift", "uppgifter")) : el("span", "tv-muted", "–"));
      const seen = el("td", "tv-muted", lastSeen(t.lastAt, ctx));
      tr.append(nameCell, prog, first, avg, fix, seen);
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  }

  function miniBar(a) {
    const bar = el("div", "tv-mini");
    a.lessons.forEach(function (lr) {
      lr.tasks.forEach(function (tr) {
        bar.appendChild(el("span", "tv-mini-seg is-" + (tr.status === "draft" ? "todo" : tr.status)));
      });
    });
    return bar;
  }

  function hardestTasks(data) {
    const section = el("section", "admin-card-section tv-section");
    section.append(el("h3", "", "Svåraste uppgifterna"),
      el("p", "admin-card-description", "Uppgifter där eleverna behövt flest försök eller inte kommit i mål."));
    const ranked = data.tasks.filter(function (t) { return t.tried > 0; }).map(function (t) {
      const unsolved = t.tried - t.solved;
      const avg = t.triesCount ? t.triesSum / t.triesCount : 0;
      return { t: t, score: unsolved * 3 + Math.max(0, avg - 1) * 2 + Array.from(t.wrong.values()).reduce(function (s, n) { return s + n; }, 0) * 0.5 };
    }).filter(function (r) { return r.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 6);

    if (!ranked.length) {
      section.appendChild(el("p", "tv-empty", "Inga svåra uppgifter ännu – alla har klarat sina uppgifter på första försöket."));
      return section;
    }
    const list = el("ol", "tv-hard");
    ranked.forEach(function (r) {
      const t = r.t;
      const li = el("li", "tv-hard-item");
      const top = el("div", "tv-hard-top");
      top.append(el("strong", "", t.lesson.title + " – " + t.name),
        el("span", "tv-muted", t.solved + " av " + t.tried + " klara" + (t.triesCount ? " · snitt " + (t.triesSum / t.triesCount).toFixed(1) + " försök" : "")));
      li.append(top, el("p", "tv-prompt", t.prompt));
      const wrong = Array.from(t.wrong.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4);
      if (wrong.length) {
        const chips = el("div", "tv-chips");
        chips.appendChild(el("span", "tv-muted", "Vanliga felsvar:"));
        wrong.forEach(function (w) { chips.appendChild(el("span", "tv-pill is-wrong", w[0] + " ×" + w[1])); });
        li.appendChild(chips);
      }
      const who = t.students.filter(function (s) { return s.row.status !== "done"; }).map(function (s) { return s.student.name; });
      if (who.length) li.appendChild(el("p", "tv-muted tv-who-line", "Behöver hjälp: " + who.join(", ")));
      list.appendChild(li);
    });
    section.appendChild(list);
    return section;
  }

  function mistakeList(data) {
    const section = el("section", "admin-card-section tv-section");
    section.append(el("h3", "", "Vanliga missuppfattningar"),
      el("p", "admin-card-description", "Tankefel som upptäckts i elevernas felsvar."));
    const keys = Array.from(data.mistakes.keys()).sort(function (a, b) { return data.mistakes.get(b) - data.mistakes.get(a); });
    if (!keys.length) {
      section.appendChild(el("p", "tv-empty", "Inga missuppfattningar har registrerats ännu."));
      return section;
    }
    const max = data.mistakes.get(keys[0]);
    const list = el("div", "misconception-list");
    keys.slice(0, 8).forEach(function (k) {
      const item = el("div", "misconception-item");
      const bg = el("div", "misconception-bar-bg");
      const fill = el("div", "misconception-bar-fill");
      fill.style.width = pct(data.mistakes.get(k), max) + "%";
      bg.appendChild(fill);
      item.append(el("span", "misconception-name", k), bg, el("span", "misconception-count", data.mistakes.get(k) + " st"));
      list.appendChild(item);
    });
    section.appendChild(list);
    return section;
  }

  // ===== PER-STUDENT DETAIL =====
  function studentDetail(data, ctx) {
    const a = data.per.find(function (x) { return x.student.id === ui.studentId; });
    if (!a) return null;
    const s = a.student;
    const section = el("section", "admin-card-section tv-section tv-detail");

    const head = el("div", "tv-detail-head");
    const avatar = el("span", "admin-student-avatar tv-avatar-lg", s.name.charAt(0).toUpperCase());
    if (s.color) avatar.style.background = s.color;
    const title = el("div");
    title.append(el("h3", "", s.name), el("p", "admin-card-description", s.class));
    title.appendChild(el("p", "tv-userline", "Användarnamn: " + s.username));
    head.append(avatar, title);
    section.appendChild(head);

    const actions = el("div", "tv-actions");
    actions.append(
      button("Återställ lösenord", "tv-btn", function () {
        if (!window.confirm("Skapa ett nytt tillfälligt lösenord åt " + s.name + "? Det gamla slutar fungera.")) return;
        ctx.actions.resetPassword(s.id).then(function (pw) {
          ui.notice = { text: "Nytt tillfälligt lösenord för " + s.name + " (visas bara nu):", code: pw };
          ctx.rerender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
      }),
      button("Ta bort elev", "tv-btn is-danger", function () {
        if (!window.confirm("Ta bort " + s.name + " och alla elevens svar? Det går inte att ångra.")) return;
        ctx.actions.deleteStudent(s.id).then(function () {
          ui.notice = { text: s.name + " och elevens data har tagits bort." };
          ui.studentId = null;
          ctx.refresh();
        }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
      }));
    section.appendChild(actions);

    const t = a.totals;
    const stats = el("div", "tv-stats");
    [
      [t.solved + " / " + t.attempted, "uppgifter klara"],
      [t.solved ? pct(t.firstTry, t.solved) + " %" : "–", "rätt på första försöket"],
      [a.avgTries ? a.avgTries.toFixed(1) : "–", "snitt försök till rätt"],
      [String(t.submissions), "inskickade svar"],
      [String(t.fix), "behöver rättas"]
    ].forEach(function (x) {
      const c = el("div", "tv-stat" + (x[1] === "behöver rättas" && t.fix ? " is-warn" : ""));
      c.append(el("strong", "", x[0]), el("span", "", x[1]));
      stats.appendChild(c);
    });
    section.appendChild(stats);

    if (!a.lessons.length) {
      section.appendChild(el("p", "tv-empty", "Den här eleven har inte påbörjat några uppgifter ännu."));
      return section;
    }

    // lesson filter
    const filter = el("div", "tv-filter");
    const filterLabel = el("label", "", "Visa lektion: ");
    filterLabel.setAttribute("for", "tv-lesson-filter");
    filter.appendChild(filterLabel);
    const select = el("select");
    const all = el("option", "", "Alla lektioner"); all.value = "alla"; select.appendChild(all);
    a.lessons.forEach(function (lr) {
      const o = el("option", "", lr.lesson.title + (lr.tasks.some(function (x) { return x.status === "fix"; }) ? "  ⚠" : ""));
      o.value = lr.lesson.id; select.appendChild(o);
    });
    if (!a.lessons.some(function (lr) { return lr.lesson.id === ui.lessonId; })) ui.lessonId = "alla";
    select.value = ui.lessonId;
    select.addEventListener("change", function () { ui.lessonId = select.value; ctx.rerender(); });
    select.id = "tv-lesson-filter";
    filter.appendChild(select);
    section.appendChild(filter);

    a.lessons.filter(function (lr) { return ui.lessonId === "alla" || lr.lesson.id === ui.lessonId; })
      .sort(function (x, y) {
        const fx = x.tasks.some(function (r) { return r.status === "fix"; }) ? 0 : 1;
        const fy = y.tasks.some(function (r) { return r.status === "fix"; }) ? 0 : 1;
        return fx - fy;
      })
      .forEach(function (lr) { section.appendChild(lessonBlock(lr, ctx)); });
    return section;
  }

  function lessonBlock(lr, ctx) {
    const hasFix = lr.tasks.some(function (r) { return r.status === "fix"; });
    const det = el("details", "tv-lesson");
    det.open = hasFix || ui.lessonId !== "alla";
    const sum = el("summary", "tv-lesson-sum");
    const solved = lr.tasks.filter(function (r) { return r.status === "done"; }).length;
    const bar = el("span", "tv-mini");
    lr.tasks.forEach(function (r) { bar.appendChild(el("span", "tv-mini-seg is-" + (r.status === "draft" ? "todo" : r.status))); });
    const tries = lr.tasks.reduce(function (n, r) { return n + r.subs.length; }, 0);
    sum.append(el("strong", "", lr.lesson.title), bar,
      el("span", "tv-muted", solved + " av " + lr.tasks.length + " klara · " + plural(tries, "försök", "försök")));
    if (hasFix) sum.appendChild(el("span", "tv-pill is-fix", "behöver rättas"));
    det.appendChild(sum);
    lr.tasks.forEach(function (row) { det.appendChild(taskBlock(row, ctx)); });
    return det;
  }

  function taskBlock(row, ctx) {
    const block = el("article", "tv-task is-" + row.status);
    const top = el("div", "tv-task-top");
    top.appendChild(el("strong", "", row.name));
    let label, tone;
    const st = row.stats;
    if (row.status === "done") {
      tone = "done";
      label = row.taskId.indexOf("goal-") === 0 ? "✓ Utmaning uppnådd"
        : st.triesToSolve === 1 ? "✓ Rätt på första försöket"
        : st.triesToSolve ? "✓ Rätt efter " + st.triesToSolve + " försök" : "✓ Klar (försök ej loggade)";
    } else if (row.status === "fix") {
      tone = "fix";
      label = "! Inte löst – " + plural(st.submissions, "försök", "försök") + " hittills";
    } else {
      tone = "todo";
      label = "Påbörjad – inget svar inskickat";
    }
    top.appendChild(el("span", "tv-pill is-" + tone, label));
    if (row.orphan) top.appendChild(el("span", "tv-muted", "(uppgiften finns inte längre i lektionen)"));
    block.appendChild(top);

    if (row.prompt) block.appendChild(el("p", "tv-prompt", row.prompt));
    if (row.correct) {
      const c = el("p", "tv-correct");
      c.append(el("span", "tv-muted", "Rätt svar: "), el("strong", "", row.correct));
      block.appendChild(c);
    }

    if (row.subs.length) {
      const timeline = el("ol", "tv-timeline");
      row.subs.forEach(function (a, i) {
        const li = el("li", "tv-try is-" + (a.completed ? "ok" : "bad"));
        const line = el("div", "tv-try-line");
        line.append(
          el("span", "tv-try-no", "Försök " + (a.attemptNo || (i + 1))),
          el("span", "tv-try-mark", a.completed ? "✓ Rätt" : "✗ Fel"),
          el("span", "tv-try-answer", "“" + (a.answer || "inget svar") + "”")
        );
        const meta = [];
        if (a.seconds != null) meta.push(a.seconds + " s");
        if (a.timestamp) meta.push(ctx.formatTimestamp(a.timestamp));
        line.appendChild(el("span", "tv-muted tv-try-meta", meta.join(" · ")));
        li.appendChild(line);
        if (!a.completed && a.misconception) {
          const d = el("p", "tv-diagnosis");
          d.append(el("strong", "", "Diagnos: "), document.createTextNode(a.misconception));
          li.appendChild(d);
        }
        if (a.feedback && !a.completed) li.appendChild(el("p", "tv-feedback", "Eleven fick: " + a.feedback));
        if (a.scratchpad) {
          const sp = el("details", "tv-scratch");
          sp.appendChild(el("summary", "", "Kladdpapper"));
          sp.appendChild(el("pre", "", a.scratchpad));
          li.appendChild(sp);
        }
        timeline.appendChild(li);
      });
      block.appendChild(timeline);
    } else if (row.entry && (row.entry.answer || row.entry.scratchpad)) {
      const draft = el("div", "tv-draft");
      if (row.entry.answer) draft.appendChild(el("p", "", "Påbörjat svar: “" + row.entry.answer + "”"));
      if (row.entry.scratchpad) {
        const sp = el("details", "tv-scratch");
        sp.appendChild(el("summary", "", "Kladdpapper"));
        sp.appendChild(el("pre", "", row.entry.scratchpad));
        draft.appendChild(sp);
      }
      block.appendChild(draft);
    }
    return block;
  }

  return { render: render, analyzeStudent: analyzeStudent, analyzeClass: analyzeClass };
}());
