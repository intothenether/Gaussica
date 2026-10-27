// "Planera efter mål" in the teacher view: pick a goal from the syllabus (central content, Lgr22), see how far the class has
// come, get the lessons that give practice in it, and hand them out as assignments (and, if wanted, a prov to end with) in
// one go. The proposal is only a start: every lesson can be left out, and nothing is sent before the teacher presses the button.
//
//   GaussicaPlanner.proposal(goalId, students, lessons, assignments, classId)   the plan for a goal
//   GaussicaPlanner.goals(students, lessons, options)                           the goals with the coverage of the class
//   GaussicaPlanner.requests(plan, options)                                     the assignments to create (payloads for the API)
//   GaussicaPlanner.section(ctx)                                                the section of the teacher view
//
// The text of the goals is a short summary in our own words (see lgr22.js), not the wording of the syllabus.

window.GaussicaPlanner = (function () {
  "use strict";

  const MAX_LESSONS = 12;
  const NOTE_MAX = 400;

  function G() { return window.GaussicaLgr22; }
  function L() { return window.GaussicaLesson; }
  function PR() { return window.GaussicaPractice; }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // ===== the plan (pure) =====
  function stateOf(student, lesson, lessons) {
    const p = (student && student.lessonProgress) || {};
    return L().summarize(lesson, function (id) { return p[id] || { answers: {} }; }, lessons).state;
  }

  // The goals that have lessons, with how many students have finished, begun or not begun the lessons of each.
  // options = { stage: "alla" | "1-3" | ..., sort: "kurs" | "behov" }
  function goals(students, lessons, options) {
    options = options || {};
    const cover = G().classCoverage(students, lessons);
    // play lessons ("pyssel") are not proposed, so a goal that only has those is left out
    let list = cover.map(function (c) {
      return Object.assign({}, c, { lessons: G().lessonsOf(c.item.id, lessons).filter(function (l) { return l.kind !== "pyssel"; }).length });
    }).filter(function (c) { return c.lessons > 0 && c.item.area !== "problem" && (!options.stage || options.stage === "alla" || c.item.stage === options.stage); });
    if (options.sort === "behov") {
      // the goals where the fewest have finished come first (among the goals that have not been completed by everyone)
      const need = function (c) { return c.n ? (c.counts.ingen * 2 + c.counts.delvis) / c.n : 0; };
      list = list.slice().sort(function (a, b) { return need(b) - need(a); });
    }
    return list;
  }

  // The lessons that give practice in a goal, in the order of the course, with how the class is doing in each.
  // assignments: the active assignments (a lesson that already has one for the whole class is left out of the proposal).
  function proposal(goalId, students, lessons, assignments, classId) {
    const goal = G().item(goalId);
    if (!goal) return null;
    const index = new Map();
    lessons.forEach(function (l, i) { index.set(l.id, i); });
    const given = new Set((assignments || []).filter(function (a) {
      return !a.archived && a.kind !== "prov" && (a.studentId === null || a.studentId === undefined || a.studentId === "") && String(a.classId) === String(classId);
    }).map(function (a) { return a.lessonId; }));
    const list = G().lessonsOf(goalId, lessons).filter(function (l) { return l.kind !== "pyssel"; })
      .map(function (l) { return { lesson: l, grade: L().effectiveGrade(l, lessons) }; })
      .sort(function (a, b) { return a.grade - b.grade || index.get(a.lesson.id) - index.get(b.lesson.id); })
      .map(function (x) {
        const counts = { done: 0, going: 0, none: 0 };
        students.forEach(function (s) {
          const st = stateOf(s, x.lesson, lessons);
          if (st === "complete") counts.done += 1; else if (st === "started" || st === "fix") counts.going += 1; else counts.none += 1;
        });
        const everyone = students.length > 0 && counts.done === students.length;
        const already = given.has(x.lesson.id);
        return { lesson: x.lesson, grade: x.grade, counts: counts, n: students.length, everyone: everyone, already: already, hasPractice: PR() ? PR().has(x.lesson) : false,
          pick: !everyone && !already };
      });
    return { goal: goal, lessons: list, picked: list.filter(function (x) { return x.pick; }).length };
  }

  // What to create: one assignment for each chosen lesson, and a prov over the lessons that have practice questions.
  // options = { classId, ids: [lessonId], prov: { perLesson, minutes } | null, note, dueDate }
  function requests(plan, options) {
    const ids = (options.ids || []).filter(function (id, i, a) { return a.indexOf(id) === i; }).slice(0, MAX_LESSONS);
    const note = String(options.note || "").slice(0, NOTE_MAX);
    const base = { classId: Number(options.classId), studentId: null, note: note, dueDate: options.dueDate || "" };
    const out = ids.map(function (id) { return Object.assign({}, base, { lessonId: id, kind: "lesson" }); });
    if (options.prov) {
      const withPractice = ids.filter(function (id) { const x = plan.lessons.find(function (y) { return y.lesson.id === id; }); return x && x.hasPractice; });
      if (withPractice.length) {
        out.push(Object.assign({}, base, {
          lessonId: withPractice[0], kind: "prov",
          config: { title: "Prov: " + String(plan.goal.text).slice(0, 60), lessons: withPractice, perLesson: Number(options.prov.perLesson) || 3, minutes: options.prov.minutes === undefined ? 20 : Number(options.prov.minutes), showResult: true }
        }));
      }
    }
    return out;
  }

  // ===== the section (teacher view) =====
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  const ui = { open: false, classId: "", stage: "alla", sort: "kurs", goal: "", checked: null, prov: false, perLesson: "3", note: null, date: "" };

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

  function section(ctx) {
    const box = el("details", "admin-card-section tv-section tv-plan");
    box.id = "tv-plan";
    box.open = ui.open;
    box.addEventListener("toggle", function () { ui.open = box.open; });
    const summary = el("summary", "tv-ws-sum");
    summary.appendChild(el("h3", "", "🎯 Planera efter mål"));
    box.appendChild(summary);
    box.appendChild(el("p", "admin-card-description", "Välj ett mål ur kursplanen (centralt innehåll i Lgr22). Du ser hur klassen ligger till och får lektionerna som övar målet som förslag. Du kan ta bort lektioner innan du skickar, och lägga till ett prov som avslutning. Målens text är en kort sammanfattning med egna ord, kontrollera mot Skolverkets kursplan."));
    if (ctx.inboxUnavailable) { box.appendChild(el("p", "tv-muted", "Uppdrag fungerar inte än, för servern är inte uppdaterad.")); return box; }
    if (!ctx.classes.length) { box.appendChild(el("p", "tv-empty", "Skapa en klass först.")); return box; }

    if (!ui.classId || !ctx.classes.some(function (c) { return String(c.id) === String(ui.classId); })) ui.classId = String(ctx.classes[0].id);
    const lessons = ctx.course.lessons;
    const students = ctx.students.filter(function (s) { return String(s.classId) === String(ui.classId); });
    const cls = ctx.classes.find(function (c) { return String(c.id) === String(ui.classId); });

    const controls = el("div", "tv-sort pl-controls");
    if (ctx.classes.length > 1) {
      const sel = el("select");
      sel.setAttribute("aria-label", "Klass");
      ctx.classes.forEach(function (c) { const o = el("option", "", c.name); o.value = String(c.id); sel.appendChild(o); });
      sel.value = ui.classId;
      sel.addEventListener("change", function () { ui.classId = sel.value; ui.goal = ""; ui.checked = null; ctx.rerender(); });
      controls.appendChild(sel);
    }
    controls.appendChild(el("span", "tv-sort-label", "Visa:"));
    [{ id: "alla", name: "Alla" }].concat(G().STAGES).forEach(function (s) {
      const b = el("button", "tv-chip" + (ui.stage === s.id ? " is-on" : ""), s.name);
      b.type = "button";
      b.addEventListener("click", function () { ui.stage = s.id; ctx.rerender(); });
      controls.appendChild(b);
    });
    controls.appendChild(el("span", "tv-sort-label", "Sortera:"));
    [["kurs", "Kursplanens ordning"], ["behov", "Störst behov"]].forEach(function (s) {
      const b = el("button", "tv-chip" + (ui.sort === s[0] ? " is-on" : ""), s[1]);
      b.type = "button";
      b.addEventListener("click", function () { ui.sort = s[0]; ctx.rerender(); });
      controls.appendChild(b);
    });
    box.appendChild(controls);
    if (!students.length) box.appendChild(el("p", "tv-muted", "Klassen " + cls.name + " har inga elever än, så det finns inget att jämföra med. Du kan ändå planera."));

    const list = goals(students, lessons, { stage: ui.stage, sort: ui.sort });
    const ul = el("div", "pl-goals");
    ul.setAttribute("role", "radiogroup");
    ul.setAttribute("aria-label", "Mål");
    list.forEach(function (c) {
      const row = el("label", "pl-goal" + (ui.goal === c.item.id ? " is-on" : ""));
      const radio = el("input");
      radio.type = "radio"; radio.name = "pl-goal"; radio.value = c.item.id; radio.checked = ui.goal === c.item.id;
      radio.addEventListener("change", function () { ui.goal = c.item.id; ui.checked = null; ui.note = null; ctx.rerender(); setTimeout(function () { const p = document.getElementById("pl-plan"); if (p) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 30); });
      const text = el("span", "pl-goal-text");
      text.append(el("span", "pl-stage", c.item.stage.replace("-", "–")), document.createTextNode(" " + c.item.text));
      const area = G().AREAS.find(function (a) { return a.id === c.item.area; });
      const meta = el("span", "pl-goal-meta");
      if (c.n) {
        meta.appendChild(bar(c.counts, c.n));
        const t = [];
        if (c.counts.klar) t.push(c.counts.klar + " klara");
        if (c.counts.delvis) t.push(c.counts.delvis + " delvis");
        meta.appendChild(el("span", "ul-count", (area ? area.name + " · " : "") + (t.join(", ") || "ingen än") + " · " + plural(c.lessons, "lektion", "lektioner")));
      } else meta.appendChild(el("span", "ul-count", (area ? area.name + " · " : "") + plural(c.lessons, "lektion", "lektioner")));
      row.append(radio, text, meta);
      ul.appendChild(row);
    });
    if (!list.length) ul.appendChild(el("p", "tv-empty", "Inga mål att visa för det här urvalet."));
    box.appendChild(ul);

    if (ui.goal) {
      const plan = proposal(ui.goal, students, lessons, ctx.assignments, ui.classId);
      if (plan) box.appendChild(planPanel(ctx, plan, cls, students));
    }
    return box;
  }

  function planPanel(ctx, plan, cls, students) {
    const panel = el("div", "pl-plan");
    panel.id = "pl-plan";
    panel.appendChild(el("h4", "", "Förslag för " + cls.name));
    panel.appendChild(el("p", "pl-goal-title", "”" + plan.goal.text + "”"));
    if (!plan.lessons.length) { panel.appendChild(el("p", "tv-empty", "Det finns inga lektioner för det här målet än.")); return panel; }
    if (!ui.checked) { ui.checked = {}; plan.lessons.forEach(function (x) { ui.checked[x.lesson.id] = x.pick; }); }
    panel.appendChild(el("p", "tv-muted", students.length
      ? "Lektionerna som redan alla har klarat, eller som redan är ett uppdrag till hela klassen, är avmarkerade."
      : "Alla lektioner är markerade eftersom klassen inte har några elever än."));

    const table = el("table", "ul-table pl-lessons");
    const count = function () {
      const ids = chosen();
      counter.textContent = ids.length
        ? plural(ids.length, "uppdrag", "uppdrag") + " till hela klassen" + (provBox.checked ? " och ett prov" : "") + "."
        : "Välj minst en lektion.";
      go.disabled = !ids.length;
    };
    const chosen = function () { return plan.lessons.filter(function (x) { return ui.checked[x.lesson.id]; }).map(function (x) { return x.lesson.id; }).slice(0, MAX_LESSONS); };
    plan.lessons.forEach(function (x) {
      const tr = el("tr");
      const cb = el("input");
      cb.type = "checkbox"; cb.checked = Boolean(ui.checked[x.lesson.id]);
      cb.setAttribute("aria-label", x.lesson.title);
      cb.addEventListener("change", function () { ui.checked[x.lesson.id] = cb.checked; count(); });
      const td0 = el("td", "pl-check"); td0.appendChild(cb);
      const td1 = el("td", "ul-text");
      td1.appendChild(el("strong", "", x.lesson.title));
      td1.appendChild(el("span", "ul-count", L().gradeLabel(x.grade) + (x.hasPractice ? "" : " · saknar övningsfrågor, kommer inte med i provet")));
      const td2 = el("td", "ul-cov");
      if (x.n) {
        td2.appendChild(bar({ klar: x.counts.done, delvis: x.counts.going, nivatest: 0 }, x.n));
        td2.appendChild(el("span", "ul-count", x.counts.done + " av " + x.n + " klara" + (x.counts.going ? ", " + x.counts.going + " påbörjade" : "")));
      }
      const td3 = el("td", "ul-les", x.already ? "redan ett uppdrag" : x.everyone ? "alla klara" : "");
      tr.append(td0, td1, td2, td3);
      table.appendChild(tr);
    });
    panel.appendChild(table);

    const provBox = el("input");
    provBox.type = "checkbox"; provBox.checked = ui.prov;
    const provLabel = el("label", "tv-ws-check");
    const per = el("select");
    [2, 3, 4, 5, 6].forEach(function (n) { const o = el("option", "", n + " frågor per lektion"); o.value = String(n); per.appendChild(o); });
    per.value = ui.perLesson;
    per.addEventListener("change", function () { ui.perLesson = per.value; });
    provLabel.append(provBox, el("span", "", "Avsluta med ett prov på lektionerna (20 minuter, eleverna får egna tal)"));
    provBox.addEventListener("change", function () { ui.prov = provBox.checked; per.hidden = !provBox.checked; count(); });
    per.hidden = !ui.prov;
    const provRow = el("div", "pl-prov"); provRow.append(provLabel, per);
    panel.appendChild(provRow);

    const date = el("input"); date.type = "date"; date.value = ui.date;
    date.addEventListener("change", function () { ui.date = date.value; });
    const dateLabel = el("label", "tv-field"); dateLabel.append(el("span", "tv-field-label", "Klart senast (valfritt)"), date);
    const note = el("textarea"); note.maxLength = NOTE_MAX; note.rows = 2;
    note.value = ui.note === null ? ("Vi övar: " + plan.goal.text).slice(0, NOTE_MAX) : ui.note;
    note.addEventListener("input", function () { ui.note = note.value; });
    const noteLabel = el("label", "tv-field"); noteLabel.append(el("span", "tv-field-label", "Meddelande till eleverna"), note);
    panel.append(dateLabel, noteLabel);

    const counter = el("p", "tv-muted pl-count");
    const error = el("p", "tv-compose-error"); error.hidden = true;
    const go = el("button", "tv-btn is-primary", "Ge klassen planen 📌");
    go.type = "button";
    go.addEventListener("click", function () {
      const reqs = requests(plan, { classId: cls.id, ids: chosen(), prov: provBox.checked ? { perLesson: per.value, minutes: 20 } : null, note: note.value.trim(), dueDate: date.value });
      if (!reqs.length) { error.textContent = "Välj minst en lektion."; error.hidden = false; return; }
      error.hidden = true;
      go.disabled = true;
      reqs.reduce(function (p, r) { return p.then(function () { return ctx.actions.createAssignment(r); }); }, Promise.resolve()).then(function () {
        ui.goal = ""; ui.checked = null; ui.note = null; ui.prov = false; ui.date = "";
        ctx.setNotice({ text: plural(reqs.length, "uppdrag", "uppdrag") + " har skickats till " + cls.name + ". Eleverna ser dem nästa gång de öppnar sidan." });
        ctx.refresh();
      }).catch(function (err) { go.disabled = false; error.textContent = err.message; error.hidden = false; });
    });
    count();
    panel.append(counter, error, go);
    return panel;
  }

  return { MAX_LESSONS: MAX_LESSONS, goals: goals, proposal: proposal, requests: requests, section: section };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaPlanner;
