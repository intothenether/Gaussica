// Lesson player: a full-screen view (route #play/<lesson>) that takes the student through
// a lesson one screen at a time – reading steps, then one question per screen – and ends
// with a summary. Answers go through the same code as before (renderProblem in app.js),
// so progress and the teacher's attempt log keep working.

window.GaussicaPlayer = (function () {
  "use strict";

  let deps = null;
  let state = null;       // { lessonId, steps, index, visited:Set, tries:{} }
  let pendingOpts = null;
  let keyHandler = null;

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function lesson() { return deps.getLesson(state.lessonId); }

  function entryOf(step, lessonId) {
    const p = deps.getProgress(lessonId || state.lessonId);
    return p.answers && p.answers[step.task.id];
  }

  function statusOf(step, lessonId) {
    if (step.type !== "question") return "read";
    const e = entryOf(step, lessonId);
    if (e && e.completed) return "done";
    if (e && (e.answer || e.feedbackType)) return "fix";
    return "todo";
  }

  // First question that is not solved yet (resume point); 0 when nothing has been done.
  function resumeIndex(steps, lessonId) {
    const started = steps.some(function (st) { return st.type === "question" && statusOf(st, lessonId) !== "todo"; });
    if (!started) return 0;
    const next = steps.findIndex(function (st) { return st.type === "question" && statusOf(st, lessonId) !== "done"; });
    return next >= 0 ? next : steps.length;   // all done -> summary
  }

  // ===== PUBLIC API =====
  function init(d) { deps = d; }

  // fromRoute is true when called from the hash router; otherwise we change the hash first.
  function open(lessonId, opts, fromRoute) {
    if (!deps) return;
    if (opts) pendingOpts = opts;
    if (!fromRoute) {
      if (window.location.hash === "#play/" + lessonId) fromRoute = true;
      else { deps.goToPlayer(lessonId); return; }
    }
    const l = deps.getLesson(lessonId);
    if (!l) { deps.goToLesson(""); return; }
    const steps = window.GaussicaLesson.steps(l);
    const wanted = pendingOpts && typeof pendingOpts.step === "number" ? pendingOpts.step : null;
    pendingOpts = null;
    state = {
      lessonId: lessonId,
      steps: steps,
      index: wanted !== null ? Math.max(0, Math.min(wanted, steps.length)) : resumeIndex(steps, lessonId),
      visited: new Set(),
      tries: {}
    };
    deps.container.hidden = false;
    document.body.classList.add("player-open");
    if (!keyHandler) {
      keyHandler = function (e) { if (e.key === "Escape" && state) exit(); };
      document.addEventListener("keydown", keyHandler);
    }
    render();
  }

  function close() {
    if (!deps) return;
    deps.container.hidden = true;
    deps.container.replaceChildren();
    document.body.classList.remove("player-open");
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
    state = null;
  }

  function exit() {
    if (state) deps.goToLesson(state.lessonId);
  }

  // ===== RENDER =====
  function go(index) {
    state.index = Math.max(0, Math.min(index, state.steps.length));
    render();
  }

  function render() {
    const l = lesson();
    const c = deps.container;
    c.replaceChildren();
    const shell = el("div", "pl-shell");
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", l.title);

    shell.appendChild(topBar(l));
    const main = el("main", "pl-main");
    main.tabIndex = -1;
    const card = el("div", "pl-card");
    main.appendChild(card);
    const foot = el("footer", "pl-foot");
    shell.append(main, foot);
    c.appendChild(shell);

    if (state.index >= state.steps.length) summary(card, foot, l);
    else step(card, foot, l, state.steps[state.index]);
    main.scrollTop = 0;
    main.focus({ preventScroll: true });
  }

  function topBar(l) {
    const top = el("header", "pl-top");
    const close = button("✕", "pl-close", exit);
    close.setAttribute("aria-label", "Avsluta lektionen");
    close.title = "Avsluta (Esc)";
    const bar = el("div", "pl-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(state.steps.length));
    bar.setAttribute("aria-valuenow", String(Math.min(state.index, state.steps.length)));
    state.steps.forEach(function (st, i) {
      const seg = el("button", "pl-seg");
      seg.type = "button";
      const status = statusOf(st);
      let cls = "pl-seg";
      if (st.type === "question") cls += " is-" + status;
      else if (i < state.index || state.visited.has(i)) cls += " is-done";
      if (i === state.index) cls += " is-current";
      seg.className = cls;
      seg.setAttribute("aria-label", st.type === "learn" ? "Läs" : "Fråga " + st.number);
      seg.addEventListener("click", function () { go(i); });
      bar.appendChild(seg);
    });
    const title = el("span", "pl-title", l.title);
    top.append(close, bar, title);
    return top;
  }

  function footer(foot, tone, message, actions) {
    foot.className = "pl-foot is-" + tone;
    foot.replaceChildren();
    const msg = el("div", "pl-foot-msg");
    if (message) msg.textContent = message;
    const acts = el("div", "pl-foot-actions");
    actions.forEach(function (a) { acts.appendChild(a); });
    foot.append(msg, acts);
  }

  function backButton() {
    if (state.index === 0) return null;
    return button("← Tillbaka", "pl-btn pl-btn-ghost", function () { go(state.index - 1); });
  }

  function step(card, foot, l, st) {
    if (st.type === "learn") {
      state.visited.add(state.index);
      card.appendChild(el("p", "eyebrow pl-eyebrow", l.kind === "pyssel" ? "PYSSLA" : "LÄR DIG"));
      const body = el("div", "pl-learn");
      st.keys.forEach(function (key) { deps.renderBlock(body, l, key); });
      card.appendChild(body);
      const nextStep = state.steps[state.index + 1];
      const next = button(nextStep && nextStep.type === "question" ? "Börja med frågorna →" : "Fortsätt →",
        "pl-btn pl-btn-primary", function () { go(state.index + 1); });
      footer(foot, "neutral", "", [backButton(), next].filter(Boolean));
      return;
    }

    // question
    const label = "FRÅGA " + st.number + " AV " + st.total;
    const holder = el("div", "pl-question");
    card.appendChild(holder);
    const next = button("Fortsätt →", "pl-btn pl-btn-primary", function () { go(state.index + 1); });
    const skip = button("Hoppa över", "pl-btn pl-btn-ghost", function () { go(state.index + 1); });

    const showSolved = function (focusNext) {
      footer(foot, "correct", "✓ Rätt!", [next]);
      if (focusNext) next.focus();
    };
    const showWrong = function () {
      const n = state.tries[st.key] = (state.tries[st.key] || 0) + 1;
      footer(foot, "wrong", "Inte riktigt – läs tipset och prova igen" + (n > 1 ? " (försök " + (n + 1) + ")" : ""),
        [backButton(), skip].filter(Boolean));
    };

    deps.renderQuestion(holder, l, st.task, label, {
      onResult: function (ok) { if (ok) showSolved(true); else showWrong(); }
    });

    const e = entryOf(st);
    if (e && e.completed) showSolved(false);
    else footer(foot, "neutral", "", [backButton(), skip].filter(Boolean));
    const input = holder.querySelector("input[name=answer]");
    if (input && !(e && e.completed)) input.focus({ preventScroll: true });
  }

  function summary(card, foot, l) {
    const L = window.GaussicaLesson;
    const student = deps.getStudent();
    const qs = state.steps.filter(function (s) { return s.type === "question"; });
    const rows = qs.map(function (st) {
      const status = statusOf(st);
      const stats = L.taskStats(L.history(student, l.id, st.task.id), entryOf(st));
      let text;
      if (status === "done") {
        if (stats.triesToSolve === 1) text = "Rätt på första försöket";
        else if (stats.triesToSolve) text = "Rätt efter " + stats.triesToSolve + " försök";
        else text = "Klar";
      } else if (status === "fix") {
        text = "Behöver rättas" + (stats.submissions ? " – " + stats.submissions + " försök hittills" : "");
      } else {
        text = "Inte gjord";
      }
      return { st: st, status: status, text: text };
    });
    const open = rows.filter(function (r) { return r.status !== "done"; });
    const firstTry = rows.filter(function (r) { return r.status === "done" && /första/.test(r.text); }).length;

    card.appendChild(el("p", "eyebrow pl-eyebrow", open.length ? "NÄSTAN KLAR" : "LEKTIONEN KLAR"));
    card.appendChild(el("h2", "pl-summary-title", open.length ? "Några frågor återstår" : "Bra jobbat!"));
    card.appendChild(el("p", "pl-summary-sub",
      qs.length ? (qs.length - open.length) + " av " + qs.length + " frågor klara" +
        (firstTry ? " · " + firstTry + " rätt på första försöket" : "") : "Du har gått igenom hela lektionen."));

    if (rows.length) {
      const list = el("ul", "pl-summary-list");
      rows.forEach(function (r) {
        const li = el("li", "pl-summary-row is-" + r.status);
        const goBtn = el("button", "pl-summary-btn");
        goBtn.type = "button";
        goBtn.append(
          el("span", "pl-summary-dot", r.status === "done" ? "✓" : r.status === "fix" ? "!" : String(r.st.number)),
          el("span", "pl-summary-name", "Fråga " + r.st.number),
          el("span", "pl-summary-text", r.text)
        );
        goBtn.addEventListener("click", function () { go(state.steps.indexOf(r.st)); });
        li.appendChild(goBtn);
        list.appendChild(li);
      });
      card.appendChild(list);
    }

    const actions = [];
    if (open.length) {
      actions.push(button("Gå till första som återstår →", "pl-btn pl-btn-primary", function () { go(state.steps.indexOf(open[0].st)); }));
    } else {
      const nextLessons = deps.allLessons().filter(function (x) { return x.prerequisites.indexOf(l.id) >= 0 && !x.isParentLesson; });
      if (nextLessons[0]) {
        actions.push(button("Nästa: " + nextLessons[0].title + " →", "pl-btn pl-btn-primary", function () { deps.goToPlayer(nextLessons[0].id); }));
      }
    }
    actions.unshift(button("Till lärstigen", open.length ? "pl-btn pl-btn-ghost" : (actions.length ? "pl-btn pl-btn-ghost" : "pl-btn pl-btn-primary"), exit));
    const back = backButton();
    footer(foot, open.length ? "neutral" : "correct", open.length ? "" : "🎉 Lektionen är klar", (back ? [back] : []).concat(actions));
  }

  return { init: init, open: open, close: close };
}());
