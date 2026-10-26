// Class overview as a heatmap, with the next steps: students down the side, lessons across, every square coloured by
// how well that student has mastered the lesson. Above the map: who needs the teacher today. Below it: what to do
// next, with a button for each (practice for those who are stuck, the next lesson for those who are ready).
//
//   GaussicaHeatmap.cells(course, students)  -> the data (without any drawing), for tests
//   GaussicaHeatmap.section(ctx, students, hooks)
//     ctx    = the teacher view's context (course, classes, assignments, actions, rerender, refresh, setNotice)
//     hooks  = { selectStudent(id), classChips() -> element | null }
//
// A square is one of:
//   strong     all questions done, and no trouble lately
//   shaky      all done, but wrong answers lately (worth a repetition)
//   going      begun, nothing wrong
//   stuck      wrong answers that are not solved, or many wrong lately
//   known      the placement test found it known, not opened yet
//   none       nothing yet

window.GaussicaHeatmap = (function () {
  "use strict";

  const DAY = 86400000;
  const STUCK_SCORE = 2;          // net wrong answers lately that make a lesson "stuck"
  const MAX_COLUMNS = 60;

  const ui = { mode: "active", area: "alla", focus: null };

  const LABELS = {
    strong: "Klar", shaky: "Klar, men osäker", going: "Pågår", stuck: "Kört fast", known: "Verkar kunna (nivåtest)", none: "Inte påbörjad"
  };

  function L() { return window.GaussicaLesson; }

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
  function first(name) { return String(name || "").split(" ")[0]; }
  function time(iso) { const t = Date.parse(iso); return isFinite(t) ? t : 0; }

  // ===== the data =====
  function progressGetter(student) {
    const p = student.lessonProgress || {};
    return function (id) { return p[id]; };
  }

  function lastActivity(student) {
    let t = 0;
    (student.attempts || []).forEach(function (a) { t = Math.max(t, time(a.timestamp)); });
    Object.keys(student.lessonProgress || {}).forEach(function (id) { t = Math.max(t, Number((student.lessonProgress[id] || {}).updatedAt) || 0); });
    return t;
  }

  // One entry per lesson that is not a chapter heading, with the state of every student.
  function cells(course, students) {
    const lessons = course.lessons;
    const Coach = window.GaussicaCoach;
    const Place = window.GaussicaPlacement;
    const index = new Map();
    lessons.forEach(function (l, i) { index.set(l.id, i); });
    const memo = new Map();
    const perStudent = students.map(function (s) {
      return { student: s, get: progressGetter(s), weak: Coach.weaknesses({ lessons: lessons, student: s }), known: Place ? Place.knownSet(s) : new Set() };
    });
    return lessons.filter(function (l) { return !l.isParentLesson; }).map(function (lesson) {
      const states = perStudent.map(function (p) {
        const sum = L().summarize(lesson, p.get, lessons);
        const w = p.weak[lesson.id];
        const score = w ? w.score : 0;
        let kind;
        if (sum.state === "complete") kind = score >= STUCK_SCORE ? "shaky" : "strong";
        else if (sum.fix > 0 || score >= STUCK_SCORE) kind = "stuck";
        else if (sum.state === "started" || sum.done > 0) kind = "going";
        else if (p.known.has(lesson.id)) kind = "known";
        else kind = "none";
        return { student: p.student, kind: kind, sum: sum, score: score };
      });
      return { lesson: lesson, grade: L().effectiveGrade(lesson, lessons, memo), index: index.get(lesson.id), states: states };
    }).sort(function (a, b) { return a.grade - b.grade || a.index - b.index; });
  }

  function isActive(cell) {
    return cell.states.some(function (s) { return s.kind !== "none" && s.kind !== "known"; });
  }

  // ===== who needs the teacher =====
  function assignmentDone(a, s, ctx) {
    const M = window.GaussicaMailbox;
    const lesson = ctx.course.lessons.find(function (l) { return l.id === a.lessonId; });
    if (!lesson) return true;
    if (a.kind === "practice") return M.practiceSummary(M.practiceCount(s.attempts, a.lessonId, a.createdAt)).state === "complete";
    const sum = L().summarize(lesson, progressGetter(s), ctx.course.lessons);
    return sum.total > 0 && sum.state === "complete";
  }

  function attention(ctx, students, data) {
    const Coach = window.GaussicaCoach;
    const now = Date.now();
    const out = [];
    students.forEach(function (s) {
      const reasons = [];
      const w = Coach.weaknesses({ lessons: ctx.course.lessons, student: s });
      let best = null;
      Object.keys(w).forEach(function (id) {
        if (w[id].score >= 3 && w[id].last >= now - 7 * DAY && (!best || w[id].score > w[best].score)) best = id;
      });
      if (best) {
        const lesson = ctx.course.lessons.find(function (l) { return l.id === best; });
        if (lesson) reasons.push({ kind: "stuck", lesson: lesson, text: "Har kört fast på " + lesson.title + " (" + w[best].score + " fel den senaste veckan)" });
      }
      const unread = (s.chat || []).filter(function (m) { return !m.fromTeacher && !m.read; }).length;
      if (unread) reasons.push({ kind: "chat", text: unread === 1 ? "Har ställt en fråga till dig" : "Har ställt " + unread + " frågor till dig" });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      (ctx.assignments || []).forEach(function (a) {
        if (a.kind === "prov" || a.classId !== s.classId || (a.studentId && String(a.studentId) !== s.id) || !a.dueDate) return;
        const due = new Date(a.dueDate + "T00:00:00");
        if (!(due < today) || assignmentDone(a, s, ctx)) return;
        const lesson = ctx.course.lessons.find(function (l) { return l.id === a.lessonId; });
        reasons.push({ kind: "late", text: "Försenat uppdrag: " + (lesson ? lesson.title : a.lessonId) });
      });
      const last = lastActivity(s);
      if (last && now - last > 14 * DAY) reasons.push({ kind: "idle", text: "Inte aktiv på " + Math.floor((now - last) / DAY) + " dagar" });
      if (reasons.length) out.push({ student: s, reasons: reasons });
    });
    const rank = { stuck: 0, chat: 1, late: 2, idle: 3 };
    return out.sort(function (a, b) { return rank[a.reasons[0].kind] - rank[b.reasons[0].kind] || b.reasons.length - a.reasons.length; });
  }

  // ===== next steps =====
  function stuckGroups(data) {
    const PR = window.GaussicaPractice;
    return data.filter(function (c) { return PR.has(c.lesson); }).map(function (c) {
      return { lesson: c.lesson, students: c.states.filter(function (s) { return s.kind === "stuck"; }).map(function (s) { return s.student; }) };
    }).filter(function (g) { return g.students.length; })
      .sort(function (a, b) { return b.students.length - a.students.length; }).slice(0, 5);
  }

  function readyGroups(ctx, students) {
    const Coach = window.GaussicaCoach;
    const by = new Map();
    students.forEach(function (s) {
      if (!lastActivity(s) && !(window.GaussicaPlacement && window.GaussicaPlacement.saved(s))) return;   // not started at all: listed apart
      const step = Coach.nextStep({ lessons: ctx.course.lessons, student: s, getProgress: progressGetter(s) });
      if (step.kind !== "start" || !step.ready) return;
      const g = by.get(step.lesson.id) || { lesson: step.lesson, students: [] };
      g.students.push(s);
      by.set(step.lesson.id, g);
    });
    return Array.from(by.values()).sort(function (a, b) { return b.students.length - a.students.length; }).slice(0, 5);
  }

  // ===== drawing =====
  function assignAll(ctx, students, lessonId, kind, note, doneText) {
    return students.reduce(function (p, s) {
      return p.then(function () { return ctx.actions.createAssignment({ classId: s.classId, studentId: s.id, lessonId: lessonId, kind: kind, note: note, dueDate: "" }); });
    }, Promise.resolve()).then(function () {
      ctx.setNotice({ text: doneText });
      ctx.refresh();
    }).catch(function (err) { ctx.setNotice({ text: err.message, error: true }); ctx.rerender(); });
  }

  function legend() {
    const row = el("div", "hm-legend");
    ["strong", "shaky", "going", "stuck", "known", "none"].forEach(function (k) {
      const item = el("span", "hm-legend-item");
      item.append(el("span", "hm-dot hm-" + k), document.createTextNode(LABELS[k]));
      row.appendChild(item);
    });
    return row;
  }

  function attentionBox(ctx, list, hooks) {
    const box = el("div", "hm-today");
    box.appendChild(el("h4", "", "👋 Vem behöver dig idag?"));
    if (!list.length) { box.appendChild(el("p", "tv-muted", "Ingen sticker ut just nu. Ingen har kört fast den senaste veckan, ställt en fråga eller halkat efter.")); return box; }
    const ul = el("ul", "hm-today-list");
    list.slice(0, 8).forEach(function (x) {
      const li = el("li", "hm-today-item");
      li.appendChild(el("strong", "", x.student.name));
      const reasons = el("span", "hm-reasons");
      x.reasons.forEach(function (r) { reasons.appendChild(el("span", "hm-reason is-" + r.kind, r.text)); });
      li.appendChild(reasons);
      const actions = el("span", "hm-today-actions");
      actions.appendChild(button("Visa", "tv-btn tv-small", function () { hooks.selectStudent(x.student.id); }));
      const stuck = x.reasons.find(function (r) { return r.kind === "stuck" && window.GaussicaPractice.has(r.lesson); });
      if (stuck) {
        actions.appendChild(button("Ge Öva mer", "tv-btn tv-small", function () {
          if (!window.confirm("Skicka ett Öva mer-uppdrag om “" + stuck.lesson.title + "” till " + x.student.name + "?")) return;
          assignAll(ctx, [x.student], stuck.lesson.id, "practice", "Lite extra övning, så blir det säkrare.", "Skickade Öva mer till " + first(x.student.name) + ".");
        }));
      }
      li.appendChild(actions);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    if (list.length > 8) box.appendChild(el("p", "tv-muted", "…och " + (list.length - 8) + " till."));
    return box;
  }

  function nextSteps(ctx, data, students) {
    const box = el("div", "hm-next");
    box.appendChild(el("h4", "", "➡️ Nästa steg"));
    const stuck = stuckGroups(data);
    const ready = readyGroups(ctx, students);
    const idle = students.filter(function (s) { return !lastActivity(s); });
    if (!stuck.length && !ready.length && !idle.length) {
      box.appendChild(el("p", "tv-muted", "Inga tydliga nästa steg just nu. De dyker upp när eleverna har arbetat en stund."));
      return box;
    }
    const group = function (title, hint) {
      const g = el("div", "hm-group");
      g.appendChild(el("h5", "", title));
      if (hint) g.appendChild(el("p", "tv-muted", hint));
      box.appendChild(g);
      return g;
    };
    if (stuck.length) {
      const g = group("Behöver mer övning", "Elever som svarat fel på samma lektion. Öva mer ger dem nya tal varje gång.");
      stuck.forEach(function (x) {
        const row = el("div", "hm-row");
        row.appendChild(el("span", "hm-row-text", plural(x.students.length, "elev", "elever") + " har problem med “" + x.lesson.title + "”: " +
          x.students.slice(0, 5).map(function (s) { return first(s.name); }).join(", ") + (x.students.length > 5 ? " med flera" : "")));
        row.appendChild(button("Ge dessa Öva mer", "tv-btn tv-small", function () {
          if (!window.confirm("Skicka ett Öva mer-uppdrag om “" + x.lesson.title + "” till " + plural(x.students.length, "elev", "elever") + "?")) return;
          assignAll(ctx, x.students, x.lesson.id, "practice", "Lite extra övning, så blir det säkrare.", "Skickade Öva mer till " + plural(x.students.length, "elev", "elever") + ".");
        }));
        g.appendChild(row);
      });
    }
    if (ready.length) {
      const g = group("Redo för nästa lektion", "Elever som är klara med det de höll på med, och vars förkunskaper för nästa lektion sitter.");
      ready.forEach(function (x) {
        const row = el("div", "hm-row");
        row.appendChild(el("span", "hm-row-text", plural(x.students.length, "elev", "elever") + " är redo för “" + x.lesson.title + "”: " +
          x.students.slice(0, 5).map(function (s) { return first(s.name); }).join(", ") + (x.students.length > 5 ? " med flera" : "")));
        row.appendChild(button("Ge lektionen", "tv-btn tv-small", function () {
          if (!window.confirm("Ge “" + x.lesson.title + "” som uppdrag till " + plural(x.students.length, "elev", "elever") + "?")) return;
          assignAll(ctx, x.students, x.lesson.id, "lesson", "", "Skickade uppdraget till " + plural(x.students.length, "elev", "elever") + ".");
        }));
        g.appendChild(row);
      });
    }
    if (idle.length) {
      const g = group("Har inte kommit igång", null);
      g.appendChild(el("p", "hm-row-text", idle.map(function (s) { return s.name; }).join(", ") + ". Ett nivåtest (Hitta din nivå) är ett lätt första steg: eleven får själv se var hen ska börja."));
    }
    return box;
  }

  function focusPanel(ctx, cell, hooks) {
    const PR = window.GaussicaPractice;
    const box = el("div", "hm-focus");
    box.appendChild(el("h4", "", cell.lesson.title + " · " + L().gradeLabel(cell.grade).toLowerCase()));
    const groups = {};
    cell.states.forEach(function (s) { (groups[s.kind] = groups[s.kind] || []).push(s.student); });
    ["stuck", "shaky", "going", "strong", "known", "none"].forEach(function (k) {
      if (!groups[k]) return;
      const row = el("p", "hm-focus-row");
      row.appendChild(el("span", "hm-dot hm-" + k));
      row.appendChild(el("strong", "", LABELS[k] + " (" + groups[k].length + "): "));
      row.appendChild(document.createTextNode(groups[k].map(function (s) { return s.name; }).join(", ")));
      box.appendChild(row);
    });
    const actions = el("div", "hm-focus-actions");
    const stuck = (groups.stuck || []).concat(groups.shaky || []);
    if (stuck.length && PR.has(cell.lesson)) {
      actions.appendChild(button("Ge Öva mer till dem som kört fast (" + stuck.length + ")", "tv-btn tv-small", function () {
        if (!window.confirm("Skicka ett Öva mer-uppdrag om “" + cell.lesson.title + "” till " + plural(stuck.length, "elev", "elever") + "?")) return;
        assignAll(ctx, stuck, cell.lesson.id, "practice", "Lite extra övning, så blir det säkrare.", "Skickade Öva mer till " + plural(stuck.length, "elev", "elever") + ".");
      }));
    }
    const notStarted = groups.none || [];
    if (notStarted.length) {
      actions.appendChild(button("Ge lektionen till dem som inte börjat (" + notStarted.length + ")", "tv-btn tv-small", function () {
        if (!window.confirm("Ge “" + cell.lesson.title + "” som uppdrag till " + plural(notStarted.length, "elev", "elever") + "?")) return;
        assignAll(ctx, notStarted, cell.lesson.id, "lesson", "", "Skickade uppdraget till " + plural(notStarted.length, "elev", "elever") + ".");
      }));
    }
    actions.appendChild(button("Stäng", "tv-btn tv-small", function () { ui.focus = null; hooks.redraw(); }));
    box.appendChild(actions);
    return box;
  }

  function grid(ctx, data, students, hooks) {
    const wrap = el("div", "hm-wrap");
    const table = el("table", "hm-table");
    table.setAttribute("aria-label", "Elever och lektioner, färgade efter hur väl eleven klarar lektionen");
    const head = el("tr");
    head.appendChild(el("th", "hm-corner", ""));
    data.forEach(function (c) {
      const th = el("th", "hm-col" + (ui.focus === c.lesson.id ? " is-focus" : ""));
      const label = el("button", "hm-col-label", c.lesson.title);
      label.type = "button";
      label.title = c.lesson.title + " (" + L().gradeLabel(c.grade).toLowerCase() + "). Klicka för att se vilka som behöver vad.";
      label.addEventListener("click", function () { ui.focus = ui.focus === c.lesson.id ? null : c.lesson.id; hooks.redraw(); });
      th.appendChild(label);
      head.appendChild(th);
    });
    table.appendChild(el("thead")).appendChild(head);
    const body = el("tbody");
    students.forEach(function (s, si) {
      const tr = el("tr");
      const name = el("th", "hm-row-head");
      const nameBtn = el("button", "hm-name", s.name);
      nameBtn.type = "button";
      nameBtn.addEventListener("click", function () { hooks.selectStudent(s.id); });
      name.appendChild(nameBtn);
      tr.appendChild(name);
      data.forEach(function (c) {
        const st = c.states[si];
        const td = el("td", "hm-cell hm-" + st.kind + (ui.focus === c.lesson.id ? " is-focus" : ""));
        const text = s.name + ", " + c.lesson.title + ": " + LABELS[st.kind] +
          (st.sum.total && st.kind !== "none" && st.kind !== "known" ? " (" + st.sum.done + " av " + st.sum.total + " klara" + (st.score ? ", " + st.score + " fel nyligen" : "") + ")" : "");
        td.title = text;
        td.setAttribute("aria-label", text);
        td.tabIndex = -1;
        td.addEventListener("click", function () { hooks.selectStudent(s.id); });
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }

  function section(ctx, students, hooks) {
    const box = el("section", "admin-card-section tv-section tv-heatmap");
    box.id = "tv-heatmap";
    box.appendChild(el("h3", "", "🗺 Klassöversikt"));
    box.appendChild(el("p", "admin-card-description", "Eleverna längs sidan och lektionerna på tvären. Färgen visar hur väl eleven klarar lektionen. Klicka på en ruta för att se eleven, eller på en lektion för att se vilka som behöver vad."));
    if (!students.length) { box.appendChild(el("p", "tv-empty", "Inga elever att visa än.")); return box; }

    const redraw = function () { ctx.rerender(); };
    const h = { selectStudent: hooks.selectStudent, redraw: redraw };
    const chips = hooks.classChips && hooks.classChips();
    if (chips) box.appendChild(chips);

    const all = cells(ctx.course, students);
    box.appendChild(attentionBox(ctx, attention(ctx, students, all), hooks));

    // which lessons are columns
    const areas = {};
    all.forEach(function (c) { areas[c.lesson.area] = true; });
    const controls = el("div", "hm-controls");
    const mode = document.createElement("select");
    [["active", "Lektioner klassen arbetat med"], ["all", "Alla lektioner"]].forEach(function (m) { const o = el("option", "", m[1]); o.value = m[0]; mode.appendChild(o); });
    mode.value = ui.mode;
    mode.setAttribute("aria-label", "Vilka lektioner som visas");
    mode.addEventListener("change", function () { ui.mode = mode.value; redraw(); });
    const area = document.createElement("select");
    const allAreas = el("option", "", "Alla områden"); allAreas.value = "alla"; area.appendChild(allAreas);
    (ctx.course.areas || []).filter(function (a) { return areas[a.id]; }).forEach(function (a) { const o = el("option", "", a.name); o.value = a.id; area.appendChild(o); });
    area.value = ui.area;
    area.setAttribute("aria-label", "Matematikområde");
    area.addEventListener("change", function () { ui.area = area.value; redraw(); });
    controls.append(mode, area);
    box.appendChild(controls);

    let data = all.filter(function (c) { return (ui.area === "alla" || c.lesson.area === ui.area) && (ui.mode === "all" || isActive(c)); });
    const total = data.length;
    if (total > MAX_COLUMNS) data = data.slice(0, MAX_COLUMNS);
    if (!data.length) {
      box.appendChild(el("p", "tv-empty", "Klassen har inte arbetat med några lektioner" + (ui.area !== "alla" ? " i det området" : "") + " än. Välj “Alla lektioner” för att se hela kartan."));
    } else {
      box.appendChild(legend());
      box.appendChild(grid(ctx, data, students, h));
      if (total > MAX_COLUMNS) box.appendChild(el("p", "tv-muted", "Visar de " + MAX_COLUMNS + " första av " + total + " lektioner. Välj ett område för att se fler."));
    }
    const focus = ui.focus && all.find(function (c) { return c.lesson.id === ui.focus; });
    if (focus) box.appendChild(focusPanel(ctx, focus, h));
    box.appendChild(nextSteps(ctx, all, students));
    return box;
  }

  return { cells: cells, attention: attention, section: section, LABELS: LABELS };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaHeatmap;
