// Placement test ("Hitta din nivå"): a short test that finds where in the course a student is, so that nobody has to
// start at the bottom of the tree.
//
// It walks the prerequisite graph like a binary search. A lesson is tried with two or three generated questions.
// If the student knows it, everything it builds on is counted as known too. If not, everything that builds on it
// is counted as not known yet. The next lesson to try is the one that settles the most lessons still undecided.
//
//   GaussicaPlacement.create({ lessons, grade, practice, gradeOf })   the logic (see below), testable without a page
//   GaussicaPlacement.open(deps)                                       the full-screen test for a student
//   GaussicaPlacement.knownSet(student)                                Set of lesson ids the test found known
//
// The result is kept in the student's progress under the key "placement" (so it needs no change in the database):
//   { v: 1, at, grade, known: [ids], unknown: [ids], start: [ids], asked, right }

window.GaussicaPlacement = (function () {
  "use strict";

  const KEY = "placement";
  const MAX_PROBES = 12;          // lessons tried at most

  function L() { return window.GaussicaLesson; }

  // ===== the logic =====
  function create(opts) {
    const lessons = opts.lessons;
    const PR = opts.practice || window.GaussicaPractice;
    const byId = new Map();
    lessons.forEach(function (l) { byId.set(l.id, l); });
    const gradeMemo = new Map();
    const gradeOf = opts.gradeOf || function (l) { return L().effectiveGrade(l, lessons, gradeMemo); };
    const rand = opts.rand || Math.random;

    // every lesson a lesson builds on (ancestors) and every lesson that builds on it (descendants)
    const anc = new Map(), desc = new Map();
    lessons.forEach(function (l) { desc.set(l.id, new Set()); });
    function ancestors(id) {
      if (anc.has(id)) return anc.get(id);
      const out = new Set();
      const stack = ((byId.get(id) || {}).prerequisites || []).slice();
      const visited = new Set([id]);
      while (stack.length) {
        const p = stack.pop();
        if (visited.has(p) || !byId.has(p)) continue;
        visited.add(p);
        out.add(p);
        ((byId.get(p).prerequisites) || []).forEach(function (q) { stack.push(q); });
      }
      anc.set(id, out);
      return out;
    }
    lessons.forEach(function (l) { ancestors(l.id).forEach(function (a) { desc.get(a).add(l.id); }); });

    const candidates = lessons.filter(function (l) { return !l.isParentLesson && PR.has(l); });
    const status = new Map();       // id -> "known" | "unknown"
    const direct = new Set();       // lessons that were tried (their result is never overruled by an inference)
    let target = opts.grade || 6;
    let probes = 0, asked = 0, right = 0;
    let probe = null;               // { lesson, templates: [ids], results: [bool], prompts: Set }
    let done = false;

    function mark(id, value, isDirect) {
      if (isDirect) { status.set(id, value); direct.add(id); return; }
      if (direct.has(id)) return;
      if (value === "unknown" && status.get(id) === "known") return;
      status.set(id, value);
    }

    function settle(known) {
      const l = probe.lesson;
      probes += 1;
      mark(l.id, known ? "known" : "unknown", true);
      if (known) {
        ancestors(l.id).forEach(function (a) { mark(a, "known"); });
        target = Math.max(target, gradeOf(l) + 1);
      } else {
        desc.get(l.id).forEach(function (d) { mark(d, "unknown"); });
        target = Math.min(target, gradeOf(l) - 1);
      }
      probe = null;
    }

    function pickProbe() {
      const open = candidates.filter(function (l) { return !status.has(l.id); });
      if (!open.length || probes >= MAX_PROBES) return null;
      const openSet = new Set(open.map(function (l) { return l.id; }));
      let best = null, bestScore = -Infinity;
      open.forEach(function (l) {
        let up = 1, down = 1;
        ancestors(l.id).forEach(function (a) { if (openSet.has(a)) up += 1; });
        desc.get(l.id).forEach(function (d) { if (openSet.has(d)) down += 1; });
        const score = Math.min(up, down) - 0.6 * Math.abs(gradeOf(l) - target) + rand() * 0.01;
        if (score > bestScore) { best = l; bestScore = score; }
      });
      return best;
    }

    function shuffled(list) {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }

    function question() {
      const ids = probe.templates;
      for (let i = 0; i < 12; i++) {
        const tid = ids[(probe.results.length + i) % ids.length];
        const q = PR.generate(probe.lesson, tid, Math.floor(rand() * 1e9) + 1);
        if (q && !probe.prompts.has(q.problem.prompt)) { probe.prompts.add(q.problem.prompt); return q; }
      }
      return null;
    }

    // The next question: { key, lessonId, problem } or null when the test is over.
    function next() {
      if (done) return null;
      for (let guard = 0; guard < 40; guard++) {
        if (!probe) {
          const l = pickProbe();
          if (!l) { done = true; return null; }
          probe = { lesson: l, templates: shuffled(PR.templates(l).map(function (t) { return t.id; })), results: [], prompts: new Set() };
        }
        const q = question();
        if (q) return { key: "pl-" + (asked + 1), lessonId: probe.lesson.id, problem: q.problem, templateId: q.templateId };
        // a lesson that cannot make a question is left out
        mark(probe.lesson.id, "unknown", true);
        probe = null;
      }
      done = true;
      return null;
    }

    // Report how the last question went. A skipped question ("Vet inte") settles the lesson at once.
    function answer(correct, skipped) {
      if (!probe) return;
      asked += 1;
      if (correct) right += 1;
      probe.results.push(Boolean(correct));
      const r = probe.results;
      if (skipped) { settle(false); return; }
      if (r.length === 2 && r[0] === r[1]) settle(r[0]);
      else if (r.length >= 3) settle(r.filter(Boolean).length >= 2);
    }

    function result() {
      const known = lessons.filter(function (l) { return !l.isParentLesson && status.get(l.id) === "known"; }).map(function (l) { return l.id; });
      const unknown = lessons.filter(function (l) { return !l.isParentLesson && status.get(l.id) === "unknown"; }).map(function (l) { return l.id; });
      const knownSet = new Set(known);
      const index = new Map();
      lessons.forEach(function (l, i) { index.set(l.id, i); });
      let level = 0;
      known.forEach(function (id) { level = Math.max(level, gradeOf(byId.get(id))); });
      // where to start: not known, and everything it builds on is known (or is a chapter heading)
      const frontier = lessons.filter(function (l) {
        if (l.isParentLesson || knownSet.has(l.id) || l.kind === "pyssel") return false;
        return (l.prerequisites || []).every(function (p) { return knownSet.has(p) || !byId.has(p) || byId.get(p).isParentLesson; });
      });
      // the ones closest to the edge of what is known come first, lessons the student could not do before untried ones
      const edge = known.length ? level : Math.min.apply(null, frontier.map(gradeOf).concat([99]));
      const start = frontier.sort(function (a, b) {
        const ta = status.get(a.id) === "unknown" && direct.has(a.id) ? 0 : 1, tb = status.get(b.id) === "unknown" && direct.has(b.id) ? 0 : 1;
        return Math.abs(gradeOf(a) - edge) - Math.abs(gradeOf(b) - edge) || ta - tb || gradeOf(a) - gradeOf(b) || index.get(a.id) - index.get(b.id);
      }).slice(0, 4).map(function (l) { return l.id; });
      return { v: 1, grade: opts.grade || null, level: level, known: known, unknown: unknown, start: start, asked: asked, right: right };
    }

    return {
      next: next, answer: answer, result: result,
      state: function () { return { probes: probes, asked: asked, done: done, open: candidates.filter(function (l) { return !status.has(l.id); }).length, candidates: candidates.length }; }
    };
  }

  function knownSet(student) {
    const p = student && student.lessonProgress && student.lessonProgress[KEY];
    return new Set(p && Array.isArray(p.known) ? p.known : []);
  }

  function saved(student) {
    const p = student && student.lessonProgress && student.lessonProgress[KEY];
    return p && Array.isArray(p.known) ? p : null;
  }

  // ===== the screen =====
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

  function gradeName(g) { return g >= 10 ? "gymnasiet" : "åk " + g; }

  function dateLabel(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.getDate() + "/" + (d.getMonth() + 1) + " " + d.getFullYear();
  }

  // The first screen, before the questions.
  function intro(deps, previous) {
    const c = deps.container;
    c.hidden = false;
    document.body.classList.add("player-open");
    c.replaceChildren();
    const shell = el("div", "pl-shell");
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "Hitta din nivå");
    const top = el("header", "pl-top");
    const x = button("✕", "pl-close", function () { leave(deps); });
    x.setAttribute("aria-label", "Avbryt");
    top.append(x, el("div", "pl-bar"), el("span", "pl-title", "Hitta din nivå"));
    const main = el("main", "pl-main");
    const card = el("div", "pl-card pt-card");
    card.appendChild(el("p", "eyebrow pl-eyebrow", "NIVÅTEST"));
    card.appendChild(el("h2", "pl-summary-title", "Hitta din nivå 🎯"));
    card.appendChild(el("p", "pt-text", "Problemet: Lärstigen har över hundra lektioner. Ingen vill börja med sådant de redan kan, och ingen vill hoppa in där det blir för svårt."));
    card.appendChild(el("p", "pt-text", "Svara på några frågor, så hittar vi var du ska börja. Frågorna blir svårare om du svarar rätt och lättare om du svarar fel. Det är inget prov och ingen ser dina fel som betyg. Ta papper och penna om du vill. Kan du inte en fråga trycker du på Vet inte, då går vi vidare."));
    card.appendChild(el("p", "pt-text pt-muted", "Det tar ungefär 10 minuter."));
    const label = el("label", "pt-field");
    label.appendChild(el("span", "", "Vilken årskurs går du i?"));
    const select = document.createElement("select");
    for (let g = 3; g <= 10; g++) {
      const o = el("option", "", g >= 10 ? "Gymnasiet" : "Åk " + g);
      o.value = String(g);
      select.appendChild(o);
    }
    select.value = String(Math.max(3, Math.min(10, (previous && previous.grade) || deps.defaultGrade || 6)));
    label.appendChild(select);
    card.appendChild(label);
    if (previous) card.appendChild(el("p", "pt-text pt-muted", "Du gjorde nivåtestet " + dateLabel(previous.at) + ". Ett nytt test ersätter det."));
    main.appendChild(card);
    const foot = el("footer", "pl-foot is-neutral");
    const row = el("div", "pl-foot-row");
    const acts = el("div", "pl-foot-actions");
    acts.append(button("Inte nu", "pl-btn pl-btn-ghost", function () { leave(deps); }),
      button("Börja →", "pl-btn pl-btn-primary", function () { start(deps, Number(select.value)); }));
    row.append(el("div", "pl-foot-msg"), acts);
    foot.appendChild(row);
    shell.append(top, main, foot);
    c.appendChild(shell);
    acts.lastChild.focus({ preventScroll: true });
  }

  function leave(deps) {
    deps.container.hidden = true;
    deps.container.replaceChildren();
    document.body.classList.remove("player-open");
    deps.onExit();
  }

  function start(deps, grade) {
    const lessons = deps.lessons();
    const session = create({ lessons: lessons, grade: grade });
    if (!session.state().candidates) { leave(deps); return; }
    let result = null;
    window.GaussicaTest.run({
      container: deps.container, title: "Hitta din nivå", label: "FRÅGA", estimate: 18, canSkip: true, skipLabel: "Vet inte",
      strict: false, getLesson: deps.getLesson, renderVisuals: deps.renderVisuals,
      confirmExit: "Avsluta nivåtestet? Det du gjort hittills sparas inte.",
      next: function () { return session.next(); },
      onAnswer: function (item, rec) { session.answer(rec.correct, rec.skipped); },
      onDone: function (history, reason) {
        if (reason !== "done" || !history.length) return;
        result = session.result();
        result.at = new Date().toISOString();
        deps.save(result);
      },
      onExit: deps.onExit,
      finish: function (f) { drawResult(deps, f, result || session.result()); }
    });
  }

  function drawResult(deps, f, res) {
    const lessons = deps.lessons();
    const byId = new Map();
    lessons.forEach(function (l) { byId.set(l.id, l); });
    f.card.appendChild(el("p", "eyebrow pl-eyebrow", "NIVÅTEST KLART"));
    f.card.appendChild(el("h2", "pl-summary-title", "Så här ser din nivå ut"));
    if (!res.known.length) {
      f.card.appendChild(el("p", "pt-text", "Du börjar i början, och det är precis rätt. Lärstigen följer med i din takt."));
    } else {
      f.card.appendChild(el("p", "pt-big", String(res.known.length)));
      f.card.appendChild(el("p", "pt-text", "lektioner verkar du kunna redan" + (res.level ? ", ungefär upp till " + gradeName(res.level) : "") + ". De får en grön markering på kartan, så du slipper börja med dem. Du kan ändå öppna dem när du vill."));
    }
    const starts = res.start.map(function (id) { return byId.get(id); }).filter(Boolean).slice(0, 3);
    if (starts.length) {
      f.card.appendChild(el("h3", "pt-sub", "Börja här"));
      const list = el("ul", "pt-start");
      starts.forEach(function (l) {
        const li = el("li", "pt-start-item");
        li.appendChild(el("strong", "", l.title));
        li.appendChild(el("span", "pt-muted", gradeName(L().effectiveGrade(l, lessons))));
        li.appendChild(button("Börja →", "pl-btn pl-btn-primary", function () { f.exit(); deps.openLesson(l.id); }));
        list.appendChild(li);
      });
      f.card.appendChild(list);
    }
    f.card.appendChild(el("p", "pt-text pt-muted", "Testet är en bra gissning, inte ett facit. Hittar du något som är för lätt eller för svårt kan du alltid välja en annan lektion på kartan."));
    const row = el("div", "pl-foot-row");
    const acts = el("div", "pl-foot-actions");
    acts.appendChild(button("Till lärstigen", "pl-btn pl-btn-primary", f.exit));
    row.append(el("div", "pl-foot-msg", "🎉 Bra jobbat"), acts);
    f.foot.className = "pl-foot is-correct";
    f.foot.appendChild(row);
  }

  // deps = { container, lessons(), getLesson(id), renderVisuals(parent, problem), student, defaultGrade,
  //          save(result), openLesson(id), onExit() }
  function open(deps) {
    intro(deps, saved(deps.student));
  }

  return { create: create, open: open, knownSet: knownSet, saved: saved, KEY: KEY };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaPlacement;
