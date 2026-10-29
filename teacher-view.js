// Teacher view (#admin): class overview, hardest questions, common mistakes, and a
// detailed per-student log showing every try, wrong answer, diagnosis and scratchpad.
//
// Data comes from student.attempts (one entry per submitted answer) and
// student.lessonProgress (current state per task). See lesson-model.js.

window.GaussicaTeacher = (function () {
  "use strict";

  const ui = { studentId: null, lessonId: "alla", sort: "attention", classId: "alla", notice: null, assignLesson: "", assignKind: "lesson", assignClass: "", assignScroll: false, threadOpen: {}, chatDraft: {} };

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

  // Generated practice questions ("Öva mer" / "Repetera") have ids like practice-<template>-<seed>.
  function isPractice(taskId) { return String(taskId || "").indexOf("practice-") === 0; }

  // One entry per generated question the student answered: what was asked and how it went.
  function practiceOf(student, lessonId) {
    const L = window.GaussicaLesson;
    const byTask = new Map();
    (student.attempts || []).forEach(function (a) {
      if (a.lessonId !== lessonId || !isPractice(a.taskId) || !L.isSubmission(a)) return;
      if (!byTask.has(a.taskId)) byTask.set(a.taskId, { taskId: a.taskId, kind: a.taskName, prompt: a.prompt, correct: a.correctAnswer, subs: [], at: a.timestamp });
      byTask.get(a.taskId).subs.push(a);
    });
    return Array.from(byTask.values()).map(function (q) {
      const first = q.subs.findIndex(function (a) { return a.completed; });
      q.solved = first >= 0;
      q.tries = first >= 0 ? first + 1 : q.subs.length;
      q.at = q.subs[q.subs.length - 1].timestamp;
      return q;
    }).sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); });
  }

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
        const hasDraft = Boolean(entry && (entry.answer || entry.scratchpad || entry.canvas));
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
        if (a.lessonId === lesson.id && L.isSubmission(a) && !isPractice(a.taskId) && !known[a.taskId] && !orphanIds[a.taskId]) orphanIds[a.taskId] = a;
      });
      Object.keys(orphanIds).forEach(function (id) {
        const a = orphanIds[id];
        if (!L.tasks(lesson).some(function (t) { return t.id === id; })) addRow(id, a.taskName || id, null, a);
      });

      const practice = practiceOf(student, lesson.id);
      if (taskRows.length || practice.length) lessons.push({ lesson: lesson, tasks: taskRows, practice: practice });
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
    ctx.setNotice = function (n) { ui.notice = n; };
    const y = window.scrollY;
    draw(container, ctx);
    if (!ui.assignScroll) window.scrollTo(0, y);
  }

  function draw(container, ctx) {
    if (ui.classId !== "alla" && !ctx.classes.some(function (c) { return String(c.id) === ui.classId; })) ui.classId = "alla";
    const students = ui.classId === "alla" ? ctx.students
      : ctx.students.filter(function (s) { return String(s.classId) === ui.classId; });
    const data = analyzeClass(students, ctx.course);
    if (!ui.studentId || !students.some(function (s) { return s.id === ui.studentId; })) {
      ui.studentId = students[0] && students[0].id;
    }
    container.replaceChildren();
    if (ctx.caregiver) { drawFamily(container, ctx, students, data); return; }
    const root = el("div", "tv");
    root.appendChild(header(ctx));
    if (ui.notice) root.appendChild(noticeBox());
    const chat = chatSection(ctx);
    if (chat) root.appendChild(chat);
    root.appendChild(classesSection(ctx));
    root.appendChild(assignmentsSection(ctx));
    if (window.GaussicaPlanner) root.appendChild(window.GaussicaPlanner.section(ctx));
    if (window.GaussicaProv) root.appendChild(window.GaussicaProv.section(ctx));
    if (window.GaussicaWorksheet) root.appendChild(window.GaussicaWorksheet.section(ctx));
    if (ui.assignScroll) {
      ui.assignScroll = false;
      setTimeout(function () { const s = document.getElementById("tv-assignments"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
    }
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
    root.appendChild(kpis(data));
    if (window.GaussicaHeatmap) {
      root.appendChild(window.GaussicaHeatmap.section(ctx, students, {
        classChips: function () { return classChips(ctx); },
        selectStudent: function (id) {
          ui.studentId = id;
          ctx.rerender();
          const d = document.querySelector(".tv-detail");
          if (d) d.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }));
    }
    if (window.GaussicaUnderlag) root.appendChild(window.GaussicaUnderlag.section(ctx, students));
    root.appendChild(studentTable(data, ctx));
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
    const family = Boolean(ctx.caregiver);
    const h2 = el("h2", "", family ? "Mina barn" : "Läraröversikt");
    h2.id = "admin-title";
    row.append(h2, el("span", "admin-badge", family ? "VÅRDNADSHAVARE" : "LÄRARE"));
    left.append(row, el("p", "admin-subtitle", family
      ? "Se hur det går för barnen den här veckan, vad de behöver hjälp med, och heja på. Det är barnens egen takt som gäller."
      : "Se hur varje elev klarar uppgifterna: vilka svar som blev fel, vad eleven tänkte och hur många försök det tog."));
    const actions = el("div", "admin-header-actions");
    const csv = button("Exportera CSV 📥", "admin-action-btn", ctx.actions.exportCSV);
    csv.title = "Ett rad per inskickat svar, med försöksnummer och rätt svar";
    actions.append(csv,
      button("Exportera JSON 💾", "admin-action-btn", ctx.actions.exportJSON),
      button("Uppdatera ↻", "admin-action-btn", ctx.refresh));
    bar.append(left, actions);
    return bar;
  }

  // ===== FOR A CAREGIVER (vårdnadshavare): the family instead of classes, and what the week was like =====
  const DAY = 86400000;
  const WEEK_CAP = 300;   // seconds counted for one answer at the most, so that a tab left open does not count as time spent

  function dayKey(iso) { return new Date(iso).toLocaleDateString("sv-SE"); }

  function ago(iso) {
    if (!iso) return "ingen aktivitet än";
    const d = Math.round((new Date(dayKey(new Date().toISOString())) - new Date(dayKey(iso))) / DAY);
    if (d <= 0) return "idag";
    if (d === 1) return "i går";
    if (d < 30) return "för " + d + " dagar sedan";
    return "för över en månad sedan";
  }

  // The last seven days of one child: answers, right answers, days with something done, minutes (about) and the lessons worked on.
  function weekOf(student, now) {
    const L = window.GaussicaLesson;
    const since = now - 7 * DAY;
    const subs = (student.attempts || []).filter(L.isSubmission).filter(function (a) { return a.timestamp && Date.parse(a.timestamp) >= since; });
    const days = new Set(subs.map(function (a) { return dayKey(a.timestamp); }));
    const seconds = subs.reduce(function (n, a) { return n + Math.min(WEEK_CAP, Number(a.seconds) || 0); }, 0);
    const lessons = [];
    subs.slice().reverse().forEach(function (a) { const t = a.lessonTitle || a.lessonId; if (t && lessons.indexOf(t) < 0) lessons.push(t); });
    return { answers: subs.length, right: subs.filter(function (a) { return a.completed; }).length, days: days.size, minutes: Math.round(seconds / 60), lessons: lessons };
  }

  // What the child has not got right yet, with the answer the child gave and the right one (for the adult).
  function needsHelp(a) {
    const out = [];
    a.lessons.forEach(function (lr) {
      lr.tasks.forEach(function (tr) {
        if (tr.status !== "fix") return;
        const last = tr.subs[tr.subs.length - 1];
        out.push({ lesson: lr.lesson.title, prompt: tr.prompt, given: last ? last.answer : "", correct: String(tr.correct || "").split(" / ")[0], at: last ? last.timestamp : "" });
      });
    });
    return out.sort(function (x, y) { return String(y.at || "").localeCompare(String(x.at || "")); });
  }

  function weekCard(a, ctx) {
    const s = a.student;
    const w = weekOf(s, Date.now());
    const card = el("article", "tv-child");
    const head = el("div", "tv-child-head");
    const avatar = el("span", "admin-student-avatar", s.name.charAt(0).toUpperCase());
    if (s.color) avatar.style.background = s.color;
    const who = el("span", "tv-who");
    who.append(el("strong", "", s.name), el("small", "", "Senast aktiv: " + ago(a.totals.lastAt)));
    head.append(avatar, who);
    card.appendChild(head);

    const stats = el("div", "tv-stats");
    [
      [String(w.days), w.days === 1 ? "dag med övning" : "dagar med övning"],
      [String(w.right), w.right === 1 ? "rätt svar" : "rätta svar"],
      [w.minutes ? "ca " + w.minutes : "–", "minuter"],
      [String(w.answers), "inskickade svar"]
    ].forEach(function (x) {
      const c = el("div", "tv-stat");
      c.append(el("strong", "", x[0]), el("span", "", x[1]));
      stats.appendChild(c);
    });
    card.appendChild(stats);
    if (w.lessons.length) card.appendChild(el("p", "tv-userline", "Har jobbat med: " + w.lessons.slice(0, 4).join(", ") + (w.lessons.length > 4 ? " med flera" : "") + "."));
    else card.appendChild(el("p", "tv-userline", "Inget har gjorts de senaste sju dagarna."));

    const help = needsHelp(a);
    if (help.length) {
      const box = el("div", "tv-help");
      box.appendChild(el("h4", "", "Att prata om"));
      box.appendChild(el("p", "tv-muted", "Fråga hur " + s.name.split(" ")[0] + " tänkte, innan du visar rätt svar. Då märker ni var det fastnar."));
      const list = el("ul", "tv-help-list");
      help.slice(0, 3).forEach(function (h) {
        const li = el("li");
        li.appendChild(el("strong", "", h.lesson));
        if (h.prompt) li.appendChild(el("span", "tv-help-prompt", h.prompt));
        li.appendChild(el("span", "tv-help-answers", (h.given ? "Svarade: " + h.given + ". " : "") + "Rätt svar (för vuxna): " + (h.correct || "–")));
        list.appendChild(li);
      });
      box.appendChild(list);
      if (help.length > 3) box.appendChild(el("p", "tv-muted", "Och " + (help.length - 3) + " till längre ned, under barnets uppgifter."));
      card.appendChild(box);
    } else if (a.totals.attempted) {
      card.appendChild(el("p", "tv-good", "✓ Allt som är påbörjat är rätt just nu."));
    }

    const row = el("div", "tv-actions");
    row.append(
      button("⭐ Heja på", "tv-btn", function () {
        ctx.actions.sendFeedback({ studentId: s.id, text: "Bra jobbat med mattan!", sticker: "star" }).then(function () {
          ui.notice = { text: "Hejaropet skickades till " + s.name + "." };
          ctx.rerender();
        }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
      }),
      button("Visa alla uppgifter ↓", "tv-btn", function () {
        ui.studentId = s.id;
        ctx.rerender();
        const d = document.querySelector(".tv-detail");
        if (d) d.scrollIntoView({ behavior: "smooth", block: "start" });
      }));
    card.appendChild(row);
    return card;
  }

  function weekSection(data, ctx) {
    const section = el("section", "admin-card-section tv-section tv-week");
    section.append(el("h3", "", "Den här veckan"),
      el("p", "admin-card-description", "De senaste sju dagarna. Tiden är ungefärlig och räknas bara medan barnet svarar på uppgifter."));
    const grid = el("div", "tv-children");
    data.per.forEach(function (a) { grid.appendChild(weekCard(a, ctx)); });
    section.appendChild(grid);
    return section;
  }

  // The family: its code, the children (an account can be made here for a child who cannot do it alone), and the setting for stars and animals.
  function familySection(ctx) {
    const section = el("section", "admin-card-section tv-section tv-family");
    section.appendChild(el("h3", "", "Familjen"));
    const family = ctx.classes[0];
    if (!family) {
      section.appendChild(el("p", "admin-card-description", "Du har ingen familj just nu. Skapa en så får du en kod som barnen kan skapa konto med."));
      const form = el("form", "tv-class-form");
      const input = el("input");
      input.type = "text"; input.maxLength = 60; input.required = true; input.value = ""; input.placeholder = "T.ex. Familjen Andersson";
      input.setAttribute("aria-label", "Familjens namn");
      const submit = button("+ Skapa familj", "tv-btn", function () {});
      submit.type = "submit";
      form.append(input, submit);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit.disabled = true;
        ctx.actions.createClass(input.value.trim()).then(function (c) {
          ui.notice = { text: "Familjen skapades. Kod för barnen:", code: c.code };
          ctx.refresh();
        }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
      });
      section.appendChild(form);
      return section;
    }
    section.appendChild(el("p", "admin-card-description", "Barnen skapar konto med familjekoden, eller så lägger du till dem här. Du ser bara barn i din egen familj."));
    const info = el("div", "tv-class");
    info.append(el("strong", "", family.name), el("span", "tv-code", family.code), el("span", "tv-muted", plural(family.students, "barn", "barn") + " av 10"));
    section.appendChild(info);

    const add = el("form", "tv-add-child");
    add.appendChild(el("h4", "", "Lägg till ett barn"));
    const fields = el("div", "tv-add-fields");
    const make = function (label, type, name, autocomplete, hint) {
      const wrap = el("label", "tv-field");
      wrap.appendChild(el("span", "", label));
      const input = el("input");
      input.type = type; input.name = name; input.required = true; input.maxLength = 80; input.autocomplete = autocomplete;
      wrap.appendChild(input);
      if (hint) wrap.appendChild(el("small", "tv-muted", hint));
      fields.appendChild(wrap);
      return input;
    };
    const name = make("Barnets namn", "text", "childName", "off", "Förnamn eller smeknamn räcker.");
    const user = make("Användarnamn", "text", "childUser", "off", "3–30 tecken: bokstäver, siffror, punkt, understreck eller bindestreck.");
    const pass = make("Lösenord", "text", "childPass", "off", "Minst 8 tecken. Skriv upp det, barnet använder det för att logga in.");
    add.appendChild(fields);
    const submit = button("+ Skapa barnets konto", "tv-btn", function () {});
    submit.type = "submit";
    add.appendChild(submit);
    add.addEventListener("submit", function (e) {
      e.preventDefault();
      submit.disabled = true;
      ctx.actions.addChild({ classId: family.id, displayName: name.value.trim(), username: user.value.trim(), password: pass.value }).then(function (c) {
        ui.notice = { text: "Kontot för " + c.name + " skapades. Användarnamn: " + c.username + ". Lösenordet är det du skrev." };
        ui.studentId = c.id;
        ctx.refresh();
      }).catch(function (err) { ui.notice = { text: err.message, error: true }; submit.disabled = false; ctx.rerender(); });
    });
    section.appendChild(add);

    const label = el("label", "tv-toggle");
    const box = el("input");
    box.type = "checkbox";
    box.checked = family.rewards !== false;
    box.addEventListener("change", function () {
      box.disabled = true;
      ctx.actions.setClassRewards(family.id, box.checked).then(function () { ctx.rerender(); })
        .catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
    });
    label.append(box, document.createTextNode(" Stjärnor, märken och djur"));
    label.title = "När det är på ser barnen stjärnor för klara lektioner och märken de kan samla. Ingen jämförelse mellan barn.";
    const wipe = button("Radera familjen", "tv-btn is-danger tv-small", function () {
      const typed = window.prompt("Det här raderar familjen " + family.name + ", " + plural(family.students, "barn", "barn") + " och allt barnen gjort. Det går inte att ångra.\n\nSkriv familjens namn (" + family.name + ") för att bekräfta:");
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== family.name.trim().toLowerCase()) { ui.notice = { text: "Namnet stämde inte, så ingenting raderades.", error: true }; ctx.rerender(); return; }
      ctx.actions.deleteClass(family.id).then(function () {
        ui.notice = { text: "Familjen och barnens uppgifter har raderats." };
        ui.studentId = null;
        ctx.refresh();
      }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
    });
    const row = el("div", "tv-class");
    row.append(label, wipe);
    section.appendChild(row);
    return section;
  }

  function childChips(students, ctx) {
    if (students.length < 2) return null;
    const row = el("div", "tv-sort tv-children-chips");
    row.appendChild(el("span", "tv-sort-label", "Visa uppgifter för:"));
    students.forEach(function (s) {
      row.appendChild(button(s.name, "tv-chip" + (ui.studentId === s.id ? " is-on" : ""), function () { ui.studentId = s.id; ctx.rerender(); }));
    });
    return row;
  }

  function drawFamily(container, ctx, students, data) {
    const root = el("div", "tv tv-family-page");
    root.appendChild(header(ctx));
    if (ui.notice) root.appendChild(noticeBox());
    const chat = chatSection(ctx);
    if (chat) root.appendChild(chat);
    if (!students.length) root.appendChild(familySection(ctx));
    if (students.length) root.appendChild(weekSection(data, ctx));
    root.appendChild(assignmentsSection(ctx));
    if (students.length) root.appendChild(familySection(ctx));
    if (window.GaussicaPlanner) root.appendChild(window.GaussicaPlanner.section(ctx));
    if (window.GaussicaWorksheet) root.appendChild(window.GaussicaWorksheet.section(ctx));
    if (students.length) {
      const chips = childChips(students, ctx);
      if (chips) { const w = el("section", "admin-card-section tv-section"); w.appendChild(chips); root.appendChild(w); }
      const detail = studentDetail(data, ctx);
      if (detail) root.appendChild(detail);
    } else {
      const empty = el("section", "admin-card-section tv-section");
      empty.append(el("h3", "", "Inga barn än"),
        el("p", "admin-card-description", ctx.classes.length
          ? "Lägg till barnens konton ovan, eller ge dem familjekoden så skapar de konto själva. När de har börjat räkna syns det här."
          : "Skapa en familj ovan, så får du en kod som barnen kan skapa konto med."));
      root.appendChild(empty);
    }
    container.appendChild(root);
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

  // ----- questions from students (chat) -----
  function chatUnread(student) {
    return (student.chat || []).filter(function (m) { return !m.fromTeacher && !m.read; }).length;
  }

  function chatTime(iso, ctx) { return iso ? ctx.formatTimestamp(iso) : ""; }

  // The problem the student was working on when they wrote.
  function chatContextCard(m, student, ctx) {
    const c = m.context;
    if (!c && !m.lessonId) return null;
    const lesson = m.lessonId && ctx.course.lessons.find(function (l) { return l.id === m.lessonId; });
    const card = el("div", "tv-chatctx");
    const where = [];
    if (c && c.taskName) where.push(c.taskName);
    const lessonTitle = (c && c.lessonTitle) || (lesson && lesson.title);
    if (lessonTitle) where.push((where.length ? "i " : "") + lessonTitle);
    card.appendChild(el("strong", "tv-chatctx-where", "📍 " + (where.join(" ") || "Uppgiften")));
    if (c && c.prompt) card.appendChild(el("p", "tv-chatctx-prompt", c.prompt));
    const bits = el("div", "tv-chatctx-bits");
    if (c && c.answer) bits.appendChild(el("span", "", "Elevens svar: " + c.answer));
    if (c && c.status) {
      const label = { done: "✓ Löst", fix: "Fel svar", todo: "Inte försökt än", read: "" }[c.status];
      if (label) bits.appendChild(el("span", "tv-pill " + (c.status === "done" ? "is-done" : c.status === "fix" ? "is-fix" : "is-todo"), label));
    }
    if (m.taskId) {
      const tries = (student.attempts || []).filter(function (a) {
        return a.lessonId === m.lessonId && a.taskId === m.taskId && window.GaussicaLesson.isSubmission(a) && String(a.timestamp || "") <= String(m.createdAt || "~");
      }).length;
      if (tries) bits.appendChild(el("span", "tv-muted", plural(tries, "försök", "försök") + " innan"));
    }
    if (bits.children.length) card.appendChild(bits);
    return card;
  }

  function chatThread(student, ctx) {
    const box = el("section", "tv-thread-card");
    const unread = chatUnread(student);
    const msgs = student.chat || [];
    const last = msgs[msgs.length - 1];
    const details = el("details", "tv-thread" + (unread ? " has-unread" : ""));
    details.open = ui.threadOpen[student.id] !== undefined ? ui.threadOpen[student.id] : unread > 0;
    details.addEventListener("toggle", function () { ui.threadOpen[student.id] = details.open; });

    const sum = el("summary", "tv-thread-sum");
    const avatar = el("span", "admin-student-avatar", student.name.charAt(0).toUpperCase());
    if (student.color) avatar.style.background = student.color;
    const who = el("span", "tv-who");
    who.append(el("strong", "", student.name), el("small", "", (last.fromTeacher ? "Du: " : "") + last.text.slice(0, 80) + (last.text.length > 80 ? "…" : "")));
    sum.append(avatar, who);
    if (unread) sum.appendChild(el("span", "tv-pill is-fix", unread === 1 ? "1 ny fråga" : unread + " nya frågor"));
    else if (last.fromTeacher) sum.appendChild(el("span", "tv-pill is-done", "✓ Besvarad"));
    sum.appendChild(el("span", "tv-muted tv-thread-when", chatTime(last.createdAt, ctx)));
    details.appendChild(sum);

    const body = el("div", "tv-thread-body");
    const list = el("ol", "tv-chat-list");
    msgs.slice(-30).forEach(function (m) {
      const li = el("li", "tv-chat-msg " + (m.fromTeacher ? "is-teacher" : "is-student") + (!m.fromTeacher && !m.read ? " is-new" : ""));
      li.appendChild(el("span", "tv-chat-who", m.fromTeacher ? "Du" : student.name.split(" ")[0]));
      li.appendChild(el("span", "tv-chat-text", m.text));
      li.appendChild(el("time", "tv-muted tv-chat-time", chatTime(m.createdAt, ctx)));
      if (!m.fromTeacher) { const card = chatContextCard(m, student, ctx); if (card) li.appendChild(card); }
      list.appendChild(li);
    });
    body.appendChild(list);

    const form = el("form", "tv-chat-reply");
    const area = el("textarea");
    area.maxLength = 600; area.rows = 2;
    area.placeholder = "Svara " + student.name.split(" ")[0] + "…";
    area.setAttribute("aria-label", "Svar till " + student.name);
    area.value = ui.chatDraft[student.id] || "";
    area.addEventListener("input", function () { ui.chatDraft[student.id] = area.value; });
    area.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
    const error = el("p", "tv-compose-error");
    error.hidden = true;
    const send = button("Svara 💬", "tv-btn is-primary", function () {});
    send.type = "submit";
    const row = el("div", "tv-compose-actions");
    row.appendChild(send);
    if (unread) row.appendChild(button("✓ Markera som läst", "tv-btn", function () {
      ctx.actions.markChatRead(student.id).then(function () { ctx.rerender(); }).catch(function (err) { error.textContent = err.message; error.hidden = false; });
    }));
    row.appendChild(button("Visa elevens svar", "tv-btn", function () {
      ui.studentId = student.id;
      ctx.rerender();
      const d = document.querySelector(".tv-detail");
      if (d) d.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    form.append(area, error, row);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = area.value.trim();
      if (!text) { error.textContent = "Skriv något först."; error.hidden = false; return; }
      send.disabled = true;
      ctx.actions.sendChat({ studentId: student.id, text: text }).then(function () {
        ui.chatDraft[student.id] = "";
        ui.threadOpen[student.id] = true;
        ctx.rerender();
      }).catch(function (err) { error.textContent = err.message; error.hidden = false; send.disabled = false; });
    });
    body.appendChild(form);
    details.appendChild(body);
    box.appendChild(details);
    return box;
  }

  function chatSection(ctx) {
    const threads = ctx.students.filter(function (s) { return (s.chat || []).length; });
    if (!threads.length) return null;
    threads.sort(function (a, b) {
      return (chatUnread(b) > 0) - (chatUnread(a) > 0) ||
        String(b.chat[b.chat.length - 1].createdAt).localeCompare(String(a.chat[a.chat.length - 1].createdAt));
    });
    const unread = threads.reduce(function (n, s) { return n + chatUnread(s); }, 0);
    const section = el("section", "admin-card-section tv-section tv-chat");
    section.id = "tv-chat";
    const h = el("h3", "", "💬 Frågor från elever");
    if (unread) h.appendChild(el("span", "tv-pill is-fix tv-chat-count", unread === 1 ? "1 ny" : unread + " nya"));
    section.append(h, el("p", "admin-card-description",
      "Här ser du vad eleverna har skrivit, och vilken uppgift de tittade på när de skrev. Svaret syns hos eleven på sidan."));
    threads.forEach(function (s) { section.appendChild(chatThread(s, ctx)); });
    return section;
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
        const wipe = button("Radera klassen", "tv-btn is-danger tv-small", function () {
          const typed = window.prompt("Det här raderar klassen " + c.name + ", " + plural(c.students, "elev", "elever") + " och allt eleverna gjort. Det går inte att ångra.\n\nSkriv klassens namn (" + c.name + ") för att bekräfta:");
          if (typed === null) return;
          if (typed.trim().toLowerCase() !== c.name.trim().toLowerCase()) { ui.notice = { text: "Namnet stämde inte, så ingenting raderades.", error: true }; ctx.rerender(); return; }
          ctx.actions.deleteClass(c.id).then(function () {
            ui.notice = { text: "Klassen " + c.name + " och elevernas uppgifter har raderats." };
            ui.studentId = null;
            ctx.refresh();
          }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
        });
        wipe.title = "Tar bort klassen, alla elevkonton och allt eleverna gjort. Bra att göra när läsåret är slut.";
        const label = el("label", "tv-toggle");
        const box = el("input");
        box.type = "checkbox";
        box.checked = c.rewards !== false;
        box.addEventListener("change", function () {
          box.disabled = true;
          ctx.actions.setClassRewards(c.id, box.checked).then(function () { ctx.rerender(); })
            .catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
        });
        label.append(box, document.createTextNode(" Stjärnor, märken och djur"));
        label.title = "När det är på ser eleverna stjärnor för klara lektioner och märken de kan samla. Ingen jämförelse mellan elever.";
        row.append(label, wipe);
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

  // ===== ASSIGNMENTS =====
  function lessonChoices(ctx) {
    const L = window.GaussicaLesson;
    const all = ctx.course.lessons;
    return all.filter(function (l) { return !l.isParentLesson; }).map(function (l, i) {
      return { l: l, grade: L.effectiveGrade(l, all), i: i };
    }).sort(function (a, b) { return a.grade - b.grade || a.i - b.i; });
  }

  function statusOfStudent(student, lesson, ctx) {
    const L = window.GaussicaLesson;
    return L.summarize(lesson, function (id) { return (student.lessonProgress && student.lessonProgress[id]) || { answers: {} }; }, ctx.course.lessons);
  }

  function assignmentsSection(ctx) {
    const section = el("section", "admin-card-section tv-section tv-assign");
    section.id = "tv-assignments";
    section.append(el("h3", "", "📌 Uppdrag"),
      el("p", "admin-card-description", "Ge en klass eller en enskild elev en lektion att göra. Eleverna ser uppdraget i en stor ruta överst på sidan, med din hälsning och datum."));
    if (ctx.inboxUnavailable) {
      section.appendChild(el("p", "tv-notice is-error", "Uppdrag och meddelanden fungerar inte än, för servern är inte uppdaterad. Uppdatera databasen och API:t (kommandona finns i cloudflare/README.md, avsnittet om att uppdatera en driftsatt databas) och ladda sedan om sidan."));
      return section;
    }
    if (!ctx.classes.length) {
      section.appendChild(el("p", "tv-empty", "Skapa en klass ovan först."));
      return section;
    }

    const form = el("form", "tv-assign-form");
    const field = function (label, control) {
      const wrap = el("label", "tv-field");
      wrap.append(el("span", "tv-field-label", label), control);
      return wrap;
    };
    const classSel = el("select");
    ctx.classes.forEach(function (c) { const o = el("option", "", c.name); o.value = String(c.id); classSel.appendChild(o); });
    if (ui.assignClass && ctx.classes.some(function (c) { return String(c.id) === String(ui.assignClass); })) classSel.value = String(ui.assignClass);
    const studentSel = el("select");
    const fillStudents = function () {
      studentSel.replaceChildren();
      const all = el("option", "", "Hela klassen"); all.value = ""; studentSel.appendChild(all);
      ctx.students.filter(function (s) { return String(s.classId) === classSel.value; }).forEach(function (s) {
        const o = el("option", "", s.name); o.value = s.id; studentSel.appendChild(o);
      });
    };
    fillStudents();

    // What to give: the lesson itself or generated practice ("Öva mer"), for one or several lessons at once.
    const goal = window.GaussicaMailbox.PRACTICE_GOAL;
    const kindSel = el("select");
    [["lesson", "Göra lektionen"], ["practice", "Öva mer (" + goal + " nya frågor)"]].forEach(function (k) {
      const o = el("option", "", k[1]); o.value = k[0]; kindSel.appendChild(o);
    });
    kindSel.value = ui.assignKind;
    const picks = el("div", "tv-picks");
    const lessonSels = [];
    const fillOptions = function (sel) {
      const keep = sel.value;
      sel.replaceChildren();
      const placeholder = el("option", "", "Välj lektion…"); placeholder.value = ""; sel.appendChild(placeholder);
      lessonChoices(ctx).filter(function (x) { return kindSel.value !== "practice" || window.GaussicaPractice.has(x.l); }).forEach(function (x) {
        const o = el("option", "", window.GaussicaLesson.gradeLabel(x.grade) + " · " + x.l.title + (x.l.kind === "pyssel" ? " (pyssla)" : ""));
        o.value = x.l.id; sel.appendChild(o);
      });
      sel.value = keep;
    };
    const addPick = function (value) {
      const wrap = el("div", "tv-pick");
      const sel = el("select");
      sel.setAttribute("aria-label", "Lektion " + (lessonSels.length + 1));
      lessonSels.push(sel);
      fillOptions(sel);
      if (value) sel.value = value;
      wrap.appendChild(sel);
      if (lessonSels.length > 1) {
        const del = button("✕", "tv-btn tv-small", function () {
          lessonSels.splice(lessonSels.indexOf(sel), 1);
          wrap.remove();
        });
        del.setAttribute("aria-label", "Ta bort den här lektionen");
        wrap.appendChild(del);
      }
      picks.appendChild(wrap);
    };
    addPick(ui.assignLesson);
    const more = button("+ Lägg till fler lektioner", "tv-btn tv-small", function () { addPick(""); });
    kindSel.addEventListener("change", function () { ui.assignKind = kindSel.value; lessonSels.forEach(fillOptions); });

    const date = el("input");
    date.type = "date";
    const note = el("textarea");
    note.maxLength = 400; note.rows = 2;
    note.placeholder = "Skriv något till eleverna (valfritt), t.ex. “Ta det i din egen takt, du klarar det här!”";
    const error = el("p", "tv-compose-error");
    error.hidden = true;
    const submit = button("Ge uppdrag 📌", "tv-btn is-primary", function () {});
    submit.type = "submit";
    const row = el("div", "tv-assign-row");
    row.append(field("Klass", classSel), field("Vem?", studentSel), field("Vad ska eleverna göra?", kindSel), field("Klart senast (valfritt)", date));
    const lessonsField = el("div", "tv-field");
    lessonsField.append(el("span", "tv-field-label", "Lektioner (du kan välja flera)"), picks, more);
    form.append(row, lessonsField, field("Meddelande till eleverna", note), error, submit);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const ids = [];
      lessonSels.forEach(function (s) { if (s.value && ids.indexOf(s.value) < 0) ids.push(s.value); });
      if (!ids.length) { error.textContent = "Välj minst en lektion."; error.hidden = false; return; }
      error.hidden = true;
      submit.disabled = true;
      const base = { classId: Number(classSel.value), studentId: studentSel.value || null, note: note.value.trim(), dueDate: date.value || "", kind: kindSel.value };
      ids.reduce(function (p, id) {
        return p.then(function () { return ctx.actions.createAssignment(Object.assign({}, base, { lessonId: id })); });
      }, Promise.resolve()).then(function () {
        ui.assignLesson = ""; ui.assignKind = "lesson"; ui.assignClass = "";
        ui.notice = { text: (ids.length === 1 ? "Uppdraget har skickats." : ids.length + " uppdrag har skickats.") + " Eleverna ser det nästa gång de öppnar sidan." };
        ctx.refresh();
      }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.refresh(); });
    });
    section.appendChild(form);

    const sugg = el("div", "tv-suggest");
    const drawSuggestions = function () { sugg.replaceChildren(suggestions(ctx, classSel.value)); };
    classSel.addEventListener("change", function () { fillStudents(); drawSuggestions(); });
    drawSuggestions();
    section.appendChild(sugg);

    const list = el("div", "tv-assign-list");
    const items = (ctx.assignments || []).filter(function (a) { return a.kind !== "prov"; });   // prov have their own section
    if (!items.length) list.appendChild(el("p", "tv-empty", "Inga aktiva uppdrag just nu."));
    items.forEach(function (a) { list.appendChild(assignmentCard(a, ctx)); });
    section.appendChild(list);
    return section;
  }

  // Lessons where several students in the class have had many wrong answers lately, and that have generated
  // practice questions: ideas for what to hand out as "Öva mer".
  function classWeaknesses(ctx, classId) {
    const Coach = window.GaussicaCoach;
    const students = ctx.students.filter(function (s) { return String(s.classId) === String(classId); });
    const byLesson = new Map();
    students.forEach(function (s) {
      const w = Coach.weaknesses({ lessons: ctx.course.lessons, student: s });
      Object.keys(w).forEach(function (id) {
        if (!(w[id].score > 0)) return;
        const lesson = ctx.course.lessons.find(function (l) { return l.id === id; });
        if (!lesson || lesson.isParentLesson || !window.GaussicaPractice.has(lesson)) return;
        const e = byLesson.get(id) || { lesson: lesson, students: [], score: 0 };
        e.students.push(s);
        e.score += w[id].score;
        byLesson.set(id, e);
      });
    });
    return { students: students, items: Array.from(byLesson.values()).sort(function (a, b) {
      return b.students.length - a.students.length || b.score - a.score;
    }).slice(0, 4) };
  }

  function suggestions(ctx, classId) {
    const box = el("div", "tv-suggest-box");
    box.appendChild(el("h4", "", "💡 Förslag utifrån klassen"));
    const data = classWeaknesses(ctx, classId);
    if (!data.students.length) {
      box.appendChild(el("p", "tv-muted", "Inga elever i klassen än."));
      return box;
    }
    if (!data.items.length) {
      box.appendChild(el("p", "tv-muted", "Inga tydliga förslag just nu. Förslag dyker upp när flera elever svarat fel på samma lektion."));
      return box;
    }
    box.appendChild(el("p", "admin-card-description", "Lektioner där elever haft många fel de senaste veckorna. Du kan ge dem Öva mer, med nya tal varje gång."));
    const list = el("div", "tv-suggest-list");
    data.items.forEach(function (it) {
      const card = el("article", "tv-suggest-card");
      card.appendChild(el("strong", "", it.lesson.title));
      const names = it.students.map(function (s) { return s.name.split(" ")[0]; });
      card.appendChild(el("p", "tv-muted", plural(it.students.length, "elev", "elever") + " av " + data.students.length + " har haft många fel: " +
        names.slice(0, 5).join(", ") + (names.length > 5 ? " med flera" : "")));
      const actions = el("div", "tv-suggest-actions");
      actions.appendChild(button("Ge klassen Öva mer", "tv-btn tv-small", function () {
        ui.assignClass = classId; ui.assignKind = "practice"; ui.assignLesson = it.lesson.id; ui.assignScroll = true;
        ctx.rerender();
      }));
      if (it.students.length < data.students.length) {
        actions.appendChild(button("Ge bara dessa " + it.students.length + " Öva mer", "tv-btn tv-small", function () {
          if (!window.confirm("Skicka ett Öva mer-uppdrag om “" + it.lesson.title + "” till " + names.join(", ") + "?")) return;
          it.students.reduce(function (p, s) {
            return p.then(function () {
              return ctx.actions.createAssignment({ classId: Number(classId), studentId: s.id, lessonId: it.lesson.id, kind: "practice", note: "Lite extra övning, så blir det säkrare.", dueDate: "" });
            });
          }, Promise.resolve()).then(function () {
            ui.notice = { text: "Skickade Öva mer till " + plural(it.students.length, "elev", "elever") + "." };
            ctx.refresh();
          }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.refresh(); });
        }));
      }
      card.appendChild(actions);
      list.appendChild(card);
    });
    box.appendChild(list);
    return box;
  }

  function assignmentCard(a, ctx) {
    const M = window.GaussicaMailbox;
    const practice = a.kind === "practice";
    const lesson = ctx.course.lessons.find(function (l) { return l.id === a.lessonId; });
    const card = el("article", "tv-assign-card");
    const top = el("div", "tv-assign-top");
    const due = M.dueInfo(a.dueDate);
    top.append(el("strong", "", lesson ? lesson.title : a.lessonId + " (lektionen finns inte längre)"),
      el("span", "tv-pill " + (practice ? "is-practice" : ""), practice ? "🔁 Öva mer" : "📌 Lektion"),
      el("span", "tv-pill", a.className + " · " + (a.studentName || "hela klassen")),
      el("span", "tv-due is-" + due.tone, due.text));
    card.appendChild(top);
    if (a.note) card.appendChild(el("p", "tv-assign-note", "“" + a.note + "”"));

    const targets = ctx.students.filter(function (s) {
      return s.classId === a.classId && (!a.studentId || String(a.studentId) === s.id);
    });
    if (lesson && targets.length) {
      const states = targets.map(function (s) {
        if (practice) {
          const sum = M.practiceSummary(M.practiceCount(s.attempts, a.lessonId, a.createdAt));
          return { s: s, sum: sum };
        }
        return { s: s, sum: statusOfStudent(s, lesson, ctx) };
      });
      const done = states.filter(function (x) { return x.sum.total > 0 && x.sum.state === "complete"; }).length;
      card.appendChild(el("p", "tv-assign-count", done + " av " + plural(targets.length, "elev", "elever") + " klara" +
        (practice ? " (klart efter " + M.PRACTICE_GOAL + " rätta övningsfrågor)" : "")));
      const chips = el("div", "tv-assign-chips");
      states.forEach(function (x) {
        const isDone = x.sum.total > 0 && x.sum.state === "complete";
        const started = x.sum.done > 0 || x.sum.fix > 0;
        const chip = button((isDone ? "✓ " : started ? "◔ " : "○ ") + x.s.name + (started && !isDone ? " (" + x.sum.done + "/" + x.sum.total + ")" : ""),
          "tv-chip tv-student-chip is-" + (isDone ? "done" : started ? "part" : "todo"), function () { ui.studentId = x.s.id; ctx.rerender(); });
        chips.appendChild(chip);
      });
      card.appendChild(chips);
    } else if (!targets.length) {
      card.appendChild(el("p", "tv-muted", "Inga elever i den här klassen än."));
    }
    card.appendChild(button("Ta bort uppdraget", "tv-btn is-danger tv-small", function () {
      if (!window.confirm("Ta bort uppdraget? Eleverna ser det inte längre.")) return;
      ctx.actions.archiveAssignment(a.id).then(function () { ctx.refresh(); })
        .catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
    }));
    return card;
  }

  // ===== FEEDBACK TO A STUDENT =====
  function stickerLabel(key) {
    const s = window.GaussicaMailbox.STICKERS[key];
    return s ? s.emoji + " " + s.label : "";
  }

  // ===== COMMENT TEMPLATES =====
  // Ready-made short replies the teacher can click to fill the box. Own ones are kept in this browser.
  const DEFAULT_TEMPLATES = [
    "Bra jobbat, det här gick riktigt bra!",
    "Läs frågan en gång till, långsamt. Vad är det som frågas efter?",
    "Du är nära! Kontrollera uträkningen steg för steg.",
    "Rita en bild eller använd en tallinje, det brukar hjälpa.",
    "Prova Öva mer på den här lektionen, så blir det säkrare.",
    "Kom gärna fram och fråga mig om du kör fast."
  ];
  const TEMPLATE_KEY = "gaussica.commentTemplates";

  function customTemplates() {
    try {
      const list = JSON.parse(window.localStorage.getItem(TEMPLATE_KEY) || "[]");
      return Array.isArray(list) ? list.filter(function (t) { return typeof t === "string" && t.trim(); }).slice(0, 20) : [];
    } catch (e) { return []; }
  }

  function saveTemplates(list) {
    try { window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) { /* storage blocked */ }
  }

  function templatePicker(area) {
    const wrap = el("div", "tv-templates");
    const draw = function () {
      wrap.replaceChildren();
      wrap.appendChild(el("span", "tv-muted", "Snabbsvar:"));
      const insert = function (text) {
        area.value = (area.value.trim() ? area.value.trim() + " " : "") + text;
        area.focus();
      };
      DEFAULT_TEMPLATES.forEach(function (t) {
        const b = button(t, "tv-chip tv-template", function () { insert(t); });
        b.title = t;
        wrap.appendChild(b);
      });
      customTemplates().forEach(function (t, i) {
        const holder = el("span", "tv-template-own");
        const b = button(t, "tv-chip tv-template", function () { insert(t); });
        b.title = t;
        const del = button("✕", "tv-template-del", function () {
          const list = customTemplates();
          list.splice(i, 1);
          saveTemplates(list);
          draw();
        });
        del.setAttribute("aria-label", "Ta bort snabbsvaret");
        holder.append(b, del);
        wrap.appendChild(holder);
      });
      wrap.appendChild(button("+ Spara texten som snabbsvar", "tv-chip tv-template-save", function () {
        const text = area.value.trim().slice(0, 200);
        if (!text) { area.focus(); return; }
        const list = customTemplates();
        if (DEFAULT_TEMPLATES.indexOf(text) < 0 && list.indexOf(text) < 0) { list.push(text); saveTemplates(list); }
        draw();
      }));
    };
    draw();
    return wrap;
  }

  // scope: { lessonId, taskId, label }  (all optional: no scope = a general message)
  function composer(ctx, student, scope) {
    const form = el("form", "tv-compose");
    const area = el("textarea");
    area.maxLength = 600; area.rows = 3;
    area.placeholder = "Skriv en hälsning till " + student.name.split(" ")[0] + (scope && scope.label ? " om " + scope.label : "") + "…";
    area.setAttribute("aria-label", "Meddelande till " + student.name);
    let chosen = null;
    const stickers = el("div", "tv-stickers");
    Object.keys(window.GaussicaMailbox.STICKERS).forEach(function (key) {
      const b = button(stickerLabel(key), "tv-sticker", function () {
        chosen = chosen === key ? null : key;
        Array.prototype.forEach.call(stickers.children, function (c) { c.setAttribute("aria-pressed", String(c.dataset.key === chosen)); });
      });
      b.dataset.key = key;
      b.setAttribute("aria-pressed", "false");
      stickers.appendChild(b);
    });
    const error = el("p", "tv-compose-error");
    error.hidden = true;
    const send = button("Skicka 💬", "tv-btn is-primary", function () {});
    send.type = "submit";
    const actions = el("div", "tv-compose-actions");
    actions.append(send, el("span", "tv-muted", "Eleven ser det direkt på sidan" + (scope && scope.label ? ", vid " + scope.label : "") + "."));
    form.append(area, templatePicker(area), stickers, error, actions);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = area.value.trim();
      if (!text && !chosen) { error.textContent = "Skriv något eller välj en dekal."; error.hidden = false; return; }
      send.disabled = true;
      ctx.actions.sendFeedback({ studentId: student.id, lessonId: scope && scope.lessonId, taskId: scope && scope.taskId, text: text, sticker: chosen })
        .then(function () { ctx.rerender(); })
        .catch(function (err) { error.textContent = err.message; error.hidden = false; send.disabled = false; });
    });
    return form;
  }

  function sentItem(f, ctx, student, course) {
    const li = el("li", "tv-sent" + (f.read ? " is-read" : ""));
    const body = el("div", "tv-sent-body");
    if (f.sticker) body.appendChild(el("span", "tv-sent-sticker", stickerLabel(f.sticker)));
    if (f.text) body.appendChild(el("span", "tv-sent-text", f.text));
    li.appendChild(body);
    const meta = el("div", "tv-sent-meta");
    const lesson = f.lessonId && course.lessons.find(function (l) { return l.id === f.lessonId; });
    const where = lesson ? lesson.title + (f.taskId ? " · " + ((window.GaussicaLesson.tasks(lesson).find(function (t) { return t.id === f.taskId; }) || {}).name || "fråga") : "") : "Allmänt";
    meta.append(el("span", "tv-muted", where + " · " + ctx.formatTimestamp(f.createdAt)),
      el("span", "tv-pill " + (f.read ? "is-done" : "is-todo"), f.read ? "✓ Läst" : "Inte läst än"));
    const del = button("✕", "tv-btn tv-small", function () {
      if (!window.confirm("Ta bort meddelandet? Eleven ser det inte längre.")) return;
      ctx.actions.deleteFeedback(f.id).then(function () { ctx.rerender(); })
        .catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
    });
    del.setAttribute("aria-label", "Ta bort meddelandet");
    meta.appendChild(del);
    li.appendChild(meta);
    return li;
  }

  function feedbackSection(student, ctx) {
    const box = el("section", "tv-feedback-box");
    if (ctx.inboxUnavailable) return el("span");   // the server cannot store messages yet, see the assignments box
    box.appendChild(el("h4", "", "💬 Skriv till " + student.name.split(" ")[0]));
    box.appendChild(el("p", "admin-card-description", "Ett allmänt meddelande. Vill du skriva om en viss fråga, använd knappen under frågan längre ned."));
    box.appendChild(composer(ctx, student, null));
    const sent = (student.feedback || []).slice().reverse();
    if (sent.length) {
      const list = el("ul", "tv-sent-list");
      sent.slice(0, 12).forEach(function (f) { list.appendChild(sentItem(f, ctx, student, ctx.course)); });
      box.append(el("h5", "tv-sent-title", "Skickat till " + student.name.split(" ")[0]), list);
    }
    return box;
  }

  function lastSeen(iso, ctx) {
    return iso ? ctx.formatTimestamp(iso) : "–";
  }

  // "Klass: Alla | 4A | 4B", when the teacher has more than one class
  function classChips(ctx) {
    if (ctx.classes.length < 2) return null;
    const classRow = el("div", "tv-sort");
    classRow.appendChild(el("span", "tv-sort-label", "Klass:"));
    [{ id: "alla", name: "Alla" }].concat(ctx.classes.map(function (c) { return { id: String(c.id), name: c.name }; })).forEach(function (c) {
      classRow.appendChild(button(c.name, "tv-chip" + (ui.classId === c.id ? " is-on" : ""), function () { ui.classId = c.id; ctx.rerender(); }));
    });
    return classRow;
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
    ["Elev", "Klara uppgifter", "Rätt på 1:a försöket", "Snitt försök", "Att rätta", "Senast aktiv"].concat(window.GaussicaPetTeacher ? ["Djur"] : []).forEach(function (h) {
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
      if (window.GaussicaPetTeacher) tr.appendChild(window.GaussicaPetTeacher.cell(a.student, ctx));
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
      section.appendChild(el("p", "tv-empty", "Inga svåra uppgifter ännu. Alla har klarat sina uppgifter på första försöket."));
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
        wrong.forEach(function (w) { chips.appendChild(el("span", "tv-pill is-wrong", w[0] + " (" + w[1] + " gånger)")); });
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
    const placed = window.GaussicaPlacement && window.GaussicaPlacement.saved(s);
    if (placed) {
      title.appendChild(el("p", "tv-userline", "🎯 Nivåtest " + (placed.at ? ctx.formatTimestamp(placed.at) : "") + ": verkar kunna " + plural(placed.known.length, "lektion", "lektioner") +
        (placed.level ? ", ungefär upp till " + window.GaussicaLesson.gradeLabel(placed.level).toLowerCase() : "") + "."));
    }
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
      button("🖨 Rapport för utskrift", "tv-btn", function () { openReport(a, ctx); }),
      button("⬇ Ladda ner elevens uppgifter", "tv-btn", function () { ctx.actions.exportStudent(s); }),
      window.GaussicaUnderlag && !ctx.caregiver ? button("📋 Bedömningsunderlag", "tv-btn", function () { window.GaussicaUnderlag.openStudent(s, ctx); }) : el("span"),
      button("Ta bort elev", "tv-btn is-danger", function () {
        if (!window.confirm("Ta bort " + s.name + " och alla elevens svar? Det går inte att ångra.")) return;
        ctx.actions.deleteStudent(s.id).then(function () {
          ui.notice = { text: s.name + " och elevens data har tagits bort." };
          ui.studentId = null;
          ctx.refresh();
        }).catch(function (err) { ui.notice = { text: err.message, error: true }; ctx.rerender(); });
      }));
    section.appendChild(actions);
    if (window.GaussicaPetTeacher) section.appendChild(window.GaussicaPetTeacher.detail(s, ctx));
    if (window.GaussicaCoach) {
      const rv = window.GaussicaCoach.reviewRecord(s);
      const count = Object.keys(rv.lessons).length;
      if (count) {
        const dueNow = window.GaussicaCoach.dueReviews({ lessons: ctx.course.lessons, student: s, getProgress: function (id) { return (s.lessonProgress || {})[id]; } }).length;
        section.appendChild(el("p", "tv-userline", "🔁 Repetition: " + count + (count === 1 ? " lektion" : " lektioner") + " i schemat, " + dueNow + " att fräscha upp nu."));
      }
    }
    if (window.GaussicaFluency) section.appendChild(el("p", "tv-userline", "⚡ Snabbträning: " + window.GaussicaFluency.teacherLine(window.GaussicaFluency.recordOf(s))));
    section.appendChild(feedbackSection(s, ctx));

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
      .forEach(function (lr) { section.appendChild(lessonBlock(lr, ctx, a.student)); });
    return section;
  }

  function lessonBlock(lr, ctx, student) {
    const hasFix = lr.tasks.some(function (r) { return r.status === "fix"; });
    const det = el("details", "tv-lesson");
    det.open = hasFix || ui.lessonId !== "alla";
    const sum = el("summary", "tv-lesson-sum");
    const solved = lr.tasks.filter(function (r) { return r.status === "done"; }).length;
    const bar = el("span", "tv-mini");
    lr.tasks.forEach(function (r) { bar.appendChild(el("span", "tv-mini-seg is-" + (r.status === "draft" ? "todo" : r.status))); });
    const tries = lr.tasks.reduce(function (n, r) { return n + r.subs.length; }, 0);
    sum.append(el("strong", "", lr.lesson.title), bar,
      el("span", "tv-muted", lr.tasks.length
        ? solved + " av " + lr.tasks.length + " klara · " + plural(tries, "försök", "försök")
        : "bara övningsfrågor"));
    if (hasFix) sum.appendChild(el("span", "tv-pill is-fix", "behöver rättas"));
    det.appendChild(sum);
    lr.tasks.forEach(function (row) { det.appendChild(taskBlock(row, ctx, student, lr.lesson)); });
    if (lr.practice && lr.practice.length) det.appendChild(practiceBlock(lr.practice, ctx));
    return det;
  }

  // "Öva mer" and "Repetera": a short summary and the most recent generated questions.
  function practiceBlock(items, ctx) {
    const solved = items.filter(function (q) { return q.solved; }).length;
    const firstTry = items.filter(function (q) { return q.solved && q.tries === 1; }).length;
    const wrong = items.reduce(function (n, q) { return n + q.subs.filter(function (a) { return !a.completed; }).length; }, 0);
    const det = el("details", "tv-task tv-practice");
    det.appendChild(el("summary", "tv-practice-sum",
      "Övning och repetition: " + plural(items.length, "fråga", "frågor") + " · " + firstTry + " rätt på första försöket · " + plural(wrong, "fel svar", "fel svar")));
    const list = el("ol", "tv-timeline");
    items.slice(0, 15).forEach(function (q) {
      const li = el("li", "tv-try is-" + (q.solved ? "ok" : "bad"));
      const line = el("div", "tv-try-line");
      line.append(
        el("span", "tv-try-no", q.kind || "Öva mer"),
        el("span", "tv-try-mark", q.solved ? (q.tries === 1 ? "✓ Rätt direkt" : "✓ Rätt efter " + q.tries + " försök") : "✗ Inte löst"),
        el("span", "tv-try-answer", q.prompt || "")
      );
      if (q.at) line.appendChild(el("span", "tv-muted tv-try-meta", ctx.formatTimestamp(q.at)));
      li.appendChild(line);
      const wrongs = q.subs.filter(function (a) { return !a.completed; });
      if (wrongs.length) {
        li.appendChild(el("p", "tv-feedback", "Fel svar: " + wrongs.map(function (a) { return "“" + (a.answer || "inget") + "”"; }).join(", ") +
          (q.correct ? " · rätt svar: " + q.correct.split(" / ")[0] : "")));
      }
      list.appendChild(li);
    });
    det.appendChild(list);
    if (items.length > 15) det.appendChild(el("p", "tv-muted", "Visar de 15 senaste av " + items.length + " frågor."));
    return det;
  }

  // The student's drawing, drawn only when the teacher opens it.
  function canvasDetails(title, canvas) {
    const d = el("details", "tv-scratch tv-canvas");
    d.appendChild(el("summary", "", title));
    d.addEventListener("toggle", function () {
      if (!d.open || d.querySelector(".cv-view")) return;
      const v = window.GaussicaCanvas && window.GaussicaCanvas.view(canvas);
      d.appendChild(v || el("p", "tv-muted", "Ritytan kunde inte visas."));
    });
    return d;
  }

  function taskBlock(row, ctx, student, lesson) {
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
      label = "Påbörjad, inget svar inskickat";
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
      let shownCanvas = "";
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
        if (a.canvas) {
          li.appendChild(canvasDetails("Rityta vid detta försök", a.canvas));
          shownCanvas = a.canvas;
        }
        timeline.appendChild(li);
      });
      block.appendChild(timeline);
      if (row.entry && row.entry.canvas && row.entry.canvas !== shownCanvas) {
        block.appendChild(canvasDetails(shownCanvas ? "Senaste rityta (ändrad efter sista försöket)" : "Elevens rityta", row.entry.canvas));
      }
    } else if (row.entry && (row.entry.answer || row.entry.scratchpad || row.entry.canvas)) {
      const draft = el("div", "tv-draft");
      if (row.entry.answer) draft.appendChild(el("p", "", "Påbörjat svar: “" + row.entry.answer + "”"));
      if (row.entry.scratchpad) {
        const sp = el("details", "tv-scratch");
        sp.appendChild(el("summary", "", "Kladdpapper"));
        sp.appendChild(el("pre", "", row.entry.scratchpad));
        draft.appendChild(sp);
      }
      if (row.entry.canvas) draft.appendChild(canvasDetails("Elevens rityta", row.entry.canvas));
      block.appendChild(draft);
    }
    if (student && lesson && !ctx.inboxUnavailable) block.appendChild(taskComments(row, ctx, student, lesson));
    return block;
  }

  // Earlier comments on this task and a button that opens a box for a new one.
  function taskComments(row, ctx, student, lesson) {
    const wrap = el("div", "tv-task-comments");
    const mine = (student.feedback || []).filter(function (f) { return f.lessonId === lesson.id && f.taskId === row.taskId; });
    if (mine.length) {
      const list = el("ul", "tv-sent-list");
      mine.slice().reverse().forEach(function (f) { list.appendChild(sentItem(f, ctx, student, ctx.course)); });
      wrap.appendChild(list);
    }
    const slot = el("div", "tv-compose-slot");
    const open = button("💬 Skriv till eleven om den här frågan", "tv-btn tv-small", function () {
      if (slot.firstChild) { slot.replaceChildren(); return; }
      slot.appendChild(composer(ctx, student, { lessonId: lesson.id, taskId: row.taskId, label: row.name.toLowerCase() }));
      slot.querySelector("textarea").focus();
    });
    wrap.append(open, slot);
    return wrap;
  }

  // ===== PRINTABLE REPORT =====
  // A one-student summary for parent meetings. It opens over the page; the print style hides everything else,
  // so "Skriv ut" (or "Spara som PDF" in the print dialog) gives a clean page.
  function closeReport() {
    const o = document.getElementById("tv-report");
    if (o) o.remove();
    document.body.classList.remove("is-printing-report");
  }

  function lessonStatusText(sum, hasFix) {
    if (sum.total > 0 && sum.state === "complete") return "Klar";
    if (hasFix) return "Behöver stöd";
    return sum.done > 0 ? "Pågår" : "Påbörjad";
  }

  function openReport(a, ctx) {
    closeReport();
    const L = window.GaussicaLesson;
    const M = window.GaussicaMailbox;
    const s = a.student;
    const overlay = el("div", "tv-report-overlay");
    overlay.id = "tv-report";
    const bar = el("div", "tv-report-bar");
    bar.append(button("🖨 Skriv ut eller spara som PDF", "tv-btn is-primary", function () { window.print(); }),
      button("Stäng", "tv-btn", closeReport),
      el("span", "tv-muted", "Skriv gärna en egen kommentar i rutan längst ned innan du skriver ut."));
    const page = el("article", "tv-report");

    const head = el("header", "tv-report-head");
    const title = el("div");
    title.append(el("p", "tv-report-brand", "Gaussica · Elevrapport"), el("h1", "", s.name),
      el("p", "tv-muted", (s.class ? s.class + " · " : "") + "Rapport skapad " + new Date().toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })));
    head.appendChild(title);
    page.appendChild(head);

    const t = a.totals;
    const stats = el("div", "tv-stats");
    [
      [t.solved + " av " + t.attempted, "uppgifter klara"],
      [t.solved ? pct(t.firstTry, t.solved) + " %" : "–", "rätt på första försöket"],
      [a.avgTries ? a.avgTries.toFixed(1) : "–", "snitt försök till rätt"],
      [String(a.lessons.length), "lektioner påbörjade"]
    ].forEach(function (x) {
      const c = el("div", "tv-stat");
      c.append(el("strong", "", x[0]), el("span", "", x[1]));
      stats.appendChild(c);
    });
    page.appendChild(stats);

    // lessons
    page.appendChild(el("h2", "", "Lektioner"));
    const lessonRows = a.lessons.filter(function (lr) { return lr.tasks.length; });
    if (!lessonRows.length) {
      page.appendChild(el("p", "tv-muted", "Eleven har inte påbörjat några lektioner än."));
    } else {
      const table = el("table", "tv-report-table");
      const hr = el("tr");
      ["Lektion", "Klara uppgifter", "Försök", "Läge"].forEach(function (h) { hr.appendChild(el("th", "", h)); });
      table.appendChild(el("thead")).appendChild(hr);
      const body = el("tbody");
      lessonRows.forEach(function (lr) {
        const sum = statusOfStudent(s, lr.lesson, ctx);
        const hasFix = lr.tasks.some(function (r) { return r.status === "fix"; });
        const tries = lr.tasks.reduce(function (n, r) { return n + r.subs.length; }, 0);
        const tr = el("tr", hasFix ? "is-fix" : "");
        tr.append(el("td", "", lr.lesson.title), el("td", "", sum.done + " av " + sum.total), el("td", "", String(tries)), el("td", "", lessonStatusText(sum, hasFix)));
        body.appendChild(tr);
      });
      table.appendChild(body);
      page.appendChild(table);
    }

    // where to practice more
    const focus = [];
    a.lessons.forEach(function (lr) {
      const wrongCount = lr.tasks.reduce(function (n, r) { return n + r.subs.filter(function (x) { return !x.completed; }).length; }, 0);
      if (wrongCount >= 2 || lr.tasks.some(function (r) { return r.status === "fix"; })) focus.push({ lr: lr, wrongCount: wrongCount });
    });
    focus.sort(function (x, y) { return y.wrongCount - x.wrongCount; });
    page.appendChild(el("h2", "", "Bra att öva mer på"));
    if (!focus.length) {
      page.appendChild(el("p", "tv-muted", "Inget som sticker ut just nu."));
    } else {
      const ul = el("ul", "tv-report-list");
      focus.slice(0, 5).forEach(function (f) {
        ul.appendChild(el("li", "", f.lr.lesson.title + ": " + plural(f.wrongCount, "felaktigt svar", "felaktiga svar") +
          (f.lr.tasks.some(function (r) { return r.status === "fix"; }) ? ", någon uppgift är inte löst än" : "")));
      });
      page.appendChild(ul);
    }
    const mis = new Map();
    (s.attempts || []).filter(L.isSubmission).forEach(function (att) {
      if (att.misconception) mis.set(att.misconception, (mis.get(att.misconception) || 0) + 1);
    });
    if (mis.size) {
      page.appendChild(el("p", "tv-report-sub", "Tankemönster som upptäckts i felsvar:"));
      const ul = el("ul", "tv-report-list");
      Array.from(mis.entries()).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4).forEach(function (e) {
        ul.appendChild(el("li", "", e[0] + " (" + plural(e[1], "gång", "gånger") + ")"));
      });
      page.appendChild(ul);
    }

    // generated practice
    const practiceAll = a.lessons.reduce(function (n, lr) { return n.concat(lr.practice || []); }, []);
    if (practiceAll.length) {
      const solved = practiceAll.filter(function (q) { return q.solved; }).length;
      page.appendChild(el("h2", "", "Övning och repetition"));
      page.appendChild(el("p", "", "Eleven har svarat på " + plural(practiceAll.length, "övningsfråga", "övningsfrågor") + " med nya tal, varav " + solved + " blev rätt."));
    }

    // assignments for this student
    const mine = (ctx.assignments || []).filter(function (x) {
      return x.classId === s.classId && (!x.studentId || String(x.studentId) === s.id);
    });
    if (mine.length) {
      page.appendChild(el("h2", "", "Uppdrag"));
      const ul = el("ul", "tv-report-list");
      mine.forEach(function (x) {
        const lesson = ctx.course.lessons.find(function (l) { return l.id === x.lessonId; });
        if (!lesson) return;
        let done;
        let detail;
        if (x.kind === "practice") {
          const n = M.practiceCount(s.attempts, x.lessonId, x.createdAt);
          done = n >= M.PRACTICE_GOAL;
          detail = "Öva mer, " + Math.min(n, M.PRACTICE_GOAL) + " av " + M.PRACTICE_GOAL + " frågor rätt";
        } else {
          const sum = statusOfStudent(s, lesson, ctx);
          done = sum.total > 0 && sum.state === "complete";
          detail = "Lektion, " + sum.done + " av " + sum.total + " uppgifter klara";
        }
        ul.appendChild(el("li", "", (done ? "Klart: " : "Pågår: ") + lesson.title + " (" + detail + ")" + (x.dueDate ? ", klart senast " + x.dueDate : "")));
      });
      page.appendChild(ul);
    }

    // messages already sent
    const sent = (s.feedback || []).filter(function (f) { return f.text; }).slice(-5);
    if (sent.length) {
      page.appendChild(el("h2", "", "Senaste kommentarer till eleven"));
      const ul = el("ul", "tv-report-list");
      sent.forEach(function (f) { ul.appendChild(el("li", "", "“" + f.text + "”")); });
      page.appendChild(ul);
    }

    page.appendChild(el("h2", "", "Anteckningar"));
    const notes = el("div", "tv-report-notes");
    notes.contentEditable = "true";
    notes.setAttribute("role", "textbox");
    notes.setAttribute("aria-label", "Egna anteckningar till rapporten");
    notes.dataset.placeholder = "Klicka här och skriv egna anteckningar till samtalet…";
    page.appendChild(notes);
    page.appendChild(el("p", "tv-muted tv-report-foot", "Rapporten bygger på elevens svar i Gaussica. Siffrorna visar hur eleven arbetat, inte ett betyg."));

    overlay.append(bar, page);
    overlay.addEventListener("keydown", function (e) { if (e.key === "Escape") closeReport(); });
    document.body.appendChild(overlay);
    document.body.classList.add("is-printing-report");
    overlay.scrollTop = 0;
  }

  function prefillAssignment(lessonId) {
    ui.assignLesson = lessonId;
    ui.assignKind = "lesson";
    ui.assignClass = "";
    ui.assignScroll = true;
  }

  return { render: render, prefillAssignment: prefillAssignment, analyzeStudent: analyzeStudent, analyzeClass: analyzeClass };
}());
