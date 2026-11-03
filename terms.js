// How well a student knows each term of a begrepp lesson, worked out from the answers the site already holds (nothing extra is stored).
//
// A term is not known because the student once matched it with its explanation. The questions of Öva mer are tagged with which terms they are about and
// what they ask of the student (`level`):
//   1  recognise   matching a round of terms with explanations
//   2  recall      writing the term for an explanation or an example
//   3  use         the term on numbers or a situation the student has not seen before ("54 + 24 = 78. Vad kallas talet 78?")
// and a term goes through four states:
//   ny       nothing right yet
//   övar     something right, but not on its own yet
//   kan      written for its explanation twice, or used once on new numbers
//   säker    used on new numbers twice, written for its explanation once, and not forgotten again (not two of the last three answers wrong)
// A wrong answer lately makes a term "svag", and Öva mer asks about the weak and the unsafe terms more often, and asks to use the ones that are only recalled.
//
//   GaussicaTerms.stats(lesson, student)   { terms: [{ term, state, weak, levels }], safe, total } or null when the lesson has no terms
//   GaussicaTerms.bias(lesson, student)    function (problem) -> how much a question is needed (for GaussicaPractice.fresh), or null
//   GaussicaTerms.panel(lesson, student)   the "Dina begrepp" box for the page of the lesson, or null

(function (root) {
  "use strict";

  const STATES = { "new": "ny", practice: "övar", know: "kan", safe: "säker" };

  function PR() { return root.GaussicaPractice; }
  function time(a) { const t = Date.parse(a && a.timestamp); return isFinite(t) ? t : 0; }

  function termsOf(lesson) {
    const t = ((lesson && lesson.practice) || []).find(function (x) { return x.mode === "fraga" && Array.isArray(x.pool); });
    return t ? t.pool.filter(function (p) { return p && p.term; }).map(function (p) { return p.term; }) : [];
  }

  function stats(lesson, student) {
    const list = termsOf(lesson);
    if (!list.length || !PR()) return null;
    const by = {};
    list.forEach(function (t) { by[t] = { term: t, events: [], right: { 1: {}, 2: {}, 3: {} } }; });
    const subs = ((student && student.attempts) || []).filter(function (a) {
      return a && a.lessonId === lesson.id && (a.feedbackType === "correct" || a.feedbackType === "hint") && PR().isPracticeId(a.taskId);
    }).sort(function (a, b) { return time(a) - time(b); });
    const cache = {};
    subs.forEach(function (a) {
      const parsed = PR().parseId(a.taskId);
      if (!parsed) return;
      const key = parsed.template + "-" + parsed.seed;
      if (!(key in cache)) { const q = PR().generate(lesson, parsed.template, parsed.seed); cache[key] = q && q.templateId === parsed.template ? q.problem : null; }
      const p = cache[key];
      if (!p || !Array.isArray(p.terms)) return;
      const level = p.level >= 1 && p.level <= 3 ? p.level : 3;
      p.terms.forEach(function (t) {
        if (!by[t]) return;
        by[t].events.push(Boolean(a.completed));
        if (a.completed) by[t].right[level][key] = true;
      });
    });
    const terms = list.map(function (t) {
      const e = by[t], n = function (lv) { return Object.keys(e.right[lv]).length; };
      const last = e.events.slice(-3);
      const weak = last.length > 0 && (last[last.length - 1] === false || last.filter(function (x) { return !x; }).length >= 2);
      const safe = n(3) >= 2 && (n(2) >= 1 || n(1) >= 1) && !weak;
      const know = n(3) >= 1 || n(2) >= 2;
      const any = n(1) + n(2) + n(3) > 0;
      return { term: t, state: safe ? "safe" : know ? "know" : any ? "practice" : "new", weak: weak, levels: { 1: n(1), 2: n(2), 3: n(3) } };
    });
    return { terms: terms, safe: terms.filter(function (x) { return x.state === "safe"; }).length, total: terms.length };
  }

  // How much a question is needed: the terms that are weak or not safe, asked in the way that the student has not shown yet.
  function bias(lesson, student) {
    const s = stats(lesson, student);
    if (!s) return null;
    const byTerm = {};
    s.terms.forEach(function (t) { byTerm[t.term] = t; });
    const base = { "new": 1.4, practice: 1.6, know: 1.0, safe: 0.2 };
    const wanted = { "new": 2, practice: 2, know: 3, safe: 3 };
    return function (problem) {
      if (!problem || !Array.isArray(problem.terms) || !problem.terms.length) return 0.7;
      let total = 0;
      problem.terms.forEach(function (t) {
        const st = byTerm[t];
        if (!st) { total += 1; return; }
        let need = base[st.state] * (st.weak ? 1.8 : 1);
        const level = problem.level || 3;
        if (level === wanted[st.state]) need *= 1.4;
        else if (st.state === "know" && level < 3) need *= 0.6;
        total += need;
      });
      return total / problem.terms.length;
    };
  }

  function panel(lesson, student) {
    const s = stats(lesson, student);
    if (!s || typeof document === "undefined") return null;
    const box = document.createElement("section");
    box.className = "terms-box";
    const head = document.createElement("h3");
    head.className = "terms-title";
    head.textContent = "Dina begrepp: " + s.safe + " av " + s.total + " säkra";
    box.appendChild(head);
    const list = document.createElement("ul");
    list.className = "terms-list";
    s.terms.forEach(function (t) {
      const li = document.createElement("li");
      li.className = "terms-chip is-" + t.state + (t.weak ? " is-weak" : "");
      li.appendChild(document.createTextNode(t.term));
      const state = document.createElement("span");
      state.className = "terms-state";
      state.textContent = " " + STATES[t.state] + (t.weak ? ", behöver övas" : "");
      li.appendChild(state);
      list.appendChild(li);
    });
    box.appendChild(list);
    const note = document.createElement("p");
    note.className = "terms-note";
    note.textContent = "Ett begrepp blir säkert när du har använt det på nya tal, inte bara känt igen det. Öva mer frågar oftare om de som inte är säkra än.";
    box.appendChild(note);
    return box;
  }

  const api = { stats: stats, bias: bias, panel: panel, termsOf: termsOf, STATES: STATES };
  root.GaussicaTerms = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
