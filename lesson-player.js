// Lesson player: a full-screen view (route #play/<lesson>) that takes the student through
// a lesson one screen at a time – reading steps, then one question per screen – and ends
// with a summary. Answers go through the same code as before (renderProblem in app.js),
// so progress and the teacher's attempt log keep working.

window.GaussicaPlayer = (function () {
  "use strict";

  let deps = null;
  let state = null;       // { mode:"lesson"|"session", lessonId, steps, index, visited:Set, tries:{}, session }
                          // a session is a set of generated questions ("Öva mer", "Repetera") from one or several lessons
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
  function isSession() { return state && state.mode === "session"; }

  function entryOf(step, lessonId) {
    if (isSession()) return state.session.results[step.task.id];
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
      mode: "lesson",
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

  // session: { kind:"practice"|"review", title, items:[{lessonId, taskId, templateId, problem}], onExit(), again() }
  function openSession(session) {
    if (!deps) return;
    const steps = session.items.map(function (it, i) {
      return { type: "question", key: it.taskId, lessonId: it.lessonId,
        task: { id: it.taskId, key: it.taskId, name: session.kind === "review" ? "Repetera" : "Öva mer", problem: it.problem },
        number: i + 1, total: session.items.length };
    });
    session.results = {};
    state = { mode: "session", lessonId: null, steps: steps, index: 0, visited: new Set(), tries: {}, session: session };
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
    rulesOverlay = null;
    deps.container.hidden = true;
    deps.container.replaceChildren();
    document.body.classList.remove("player-open");
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
    state = null;
  }

  function exit() {
    if (!state) return;
    if (isSession()) state.session.onExit();
    else deps.goToLesson(state.lessonId);
  }

  // ===== RENDER =====
  function go(index) {
    state.index = Math.max(0, Math.min(index, state.steps.length));
    render();
  }

  function render() {
    const l = isSession() ? null : lesson();
    const c = deps.container;
    rulesOverlay = null;
    c.replaceChildren();
    const shell = el("div", "pl-shell");
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", isSession() ? state.session.title : l.title);

    shell.appendChild(topBar(l));
    const main = el("main", "pl-main");
    main.tabIndex = -1;
    const card = el("div", "pl-card");
    main.appendChild(card);
    const foot = el("footer", "pl-foot");
    shell.append(main, foot);
    c.appendChild(shell);

    state.hosts = null;
    if (state.index >= state.steps.length) { if (isSession()) sessionSummary(card, foot); else summary(card, foot, l); }
    else step(card, foot, l, state.steps[state.index]);
    main.scrollTop = 0;
    main.focus({ preventScroll: true });
    const answerInput = foot.querySelector("input[name=answer]");
    if (answerInput && !foot.classList.contains("is-correct")) answerInput.focus({ preventScroll: true });
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
    const title = el("span", "pl-title", isSession() ? state.session.title : l.title);
    top.append(close, bar, title);

    // buttons on the right: the rules (without leaving the lesson), a question to the teacher, and feedback
    const actions = el("div", "pl-top-actions");
    const labelled = function (icon, text, className, onClick, tip) {
      const b = button("", className, onClick);
      b.append(el("span", "pl-btn-icon", icon), el("span", "pl-btn-label", " " + text));
      b.title = tip;
      b.setAttribute("aria-label", text + ". " + tip);
      return b;
    };
    if (rulesLesson()) actions.appendChild(labelled("💡", "Regler", "pl-rules", openRules, "Se regeln och förklaringen igen utan att lämna lektionen."));
    if (deps.canChat && deps.canChat()) {
      const ask = labelled("💬", "Fråga läraren", "pl-ask", function () { deps.openChat(chatContext()); }, "Skriv till din lärare. Läraren ser vilken uppgift du tittar på.");
      if (deps.chatUnread && deps.chatUnread()) ask.classList.add("has-news");
      actions.appendChild(ask);
    }
    if (deps.openFeedback) actions.appendChild(labelled("📣", "Feedback", "pl-fb", function () { deps.openFeedback(chatContext()); }, "Hittade du ett fel eller har du en idé? Skicka feedback."));
    top.appendChild(actions);
    return top;
  }

  // ----- the rules and the explanation, to look at again without leaving the lesson -----
  // The lesson whose rules apply to what is on screen (in a practice round every question has its own lesson).
  function rulesLesson() {
    if (!state) return null;
    const st = state.steps[state.index];
    const l = isSession() ? (st && st.lessonId ? deps.getLesson(st.lessonId) : null) : lesson();
    return l && (l.rule || l.explanation) ? l : null;
  }

  let rulesOverlay = null;

  function closeRules() {
    if (!rulesOverlay) return;
    rulesOverlay.remove();
    rulesOverlay = null;
    const back = deps.container.querySelector(".pl-rules");
    if (back) back.focus();
  }

  function openRules() {
    const l = rulesLesson();
    if (!l) return;
    closeRules();
    rulesOverlay = el("div", "chat-overlay rules-overlay");
    const panel = el("div", "chat-panel rules-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Regler och förklaring");
    const head = el("header", "chat-head");
    head.appendChild(el("h2", "chat-title", "💡 Regler och tips"));
    const x = el("button", "chat-close", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Stäng");
    x.addEventListener("click", closeRules);
    head.appendChild(x);
    const body = el("div", "rules-body");
    body.appendChild(el("p", "rules-lesson", l.title));
    if (l.rule) deps.renderBlock(body, l, "rule");
    if (l.visual) deps.renderBlock(body, l, "visual");
    if (l.explanation) {
      const more = el("details", "rules-more");
      more.open = !l.rule;   // a lesson without a rule card shows the explanation straight away
      more.appendChild(el("summary", "", "Läs förklaringen igen"));
      const text = el("div", "pl-learn rules-explanation");
      deps.renderBlock(text, l, "explanation");
      more.appendChild(text);
      body.appendChild(more);
    }
    const done = el("button", "chat-send rules-done", "Tillbaka till uppgiften");
    done.type = "button";
    done.addEventListener("click", closeRules);
    panel.append(head, body, done);
    rulesOverlay.appendChild(panel);
    rulesOverlay.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); closeRules(); } });
    rulesOverlay.addEventListener("mousedown", function (e) { if (e.target === rulesOverlay) closeRules(); });
    deps.container.appendChild(rulesOverlay);
    done.focus({ preventScroll: true });
  }

  // What the student is looking at right now, sent along with a message to the teacher.
  function chatContext() {
    const st = state.steps[state.index];
    const lessonId = isSession() ? (st && st.lessonId) : state.lessonId;
    const l = lessonId ? deps.getLesson(lessonId) : null;
    const ctx = { lessonId: l ? l.id : null, lessonTitle: l ? l.title : "" };
    if (st && st.type === "question") {
      const e = entryOf(st, lessonId);
      const typed = document.querySelector(".pl-foot input[name=answer]");
      ctx.taskId = st.task.id;
      ctx.taskName = isSession() ? "Fråga " + st.number : (st.task.name || "Fråga " + st.number);
      ctx.prompt = st.task.problem && st.task.problem.prompt ? String(st.task.problem.prompt) : "";
      ctx.answer = (typed && typed.value.trim()) || (e && e.answer ? String(e.answer) : "");
      ctx.status = statusOf(st, lessonId);
    } else if (st && st.type === "learn") {
      ctx.taskName = "Förklaringen";
    }
    return ctx;
  }

  // The bottom bar is always visible. On a question screen it also holds the hint (feedback) and the answer
  // field, so the student never has to scroll to answer. state.hosts are created once per question.
  function footer(foot, tone, message, actions) {
    foot.className = "pl-foot is-" + tone;
    foot.replaceChildren();
    const msg = el("div", "pl-foot-msg");
    if (message) msg.textContent = message;
    const acts = el("div", "pl-foot-actions");
    actions.forEach(function (a) { acts.appendChild(a); });
    const row = el("div", "pl-foot-row");
    if (state.hosts) {
      foot.appendChild(state.hosts.question);
      foot.appendChild(state.hosts.feedback);
      row.append(msg, state.hosts.answer, acts);
    } else {
      row.append(msg, acts);
    }
    foot.appendChild(row);
  }

  function backButton() {
    if (state.index === 0) return null;
    return button("← Tillbaka", "pl-btn pl-btn-ghost", function () { go(state.index - 1); });
  }

  function step(card, foot, l, st) {
    if (st.type === "learn") {
      state.visited.add(state.index);
      card.appendChild(el("p", "eyebrow pl-eyebrow", l.kind === "pyssel" ? "PYSSLA" : l.kind === "begrepp" ? "BEGREPP" : "LÄR DIG"));
      const body = el("div", "pl-learn");
      st.keys.forEach(function (key) { deps.renderBlock(body, l, key, st); });
      card.appendChild(body);
      const nextStep = state.steps[state.index + 1];
      const next = button(nextStep && nextStep.type === "question" ? "Börja med frågorna →" : "Fortsätt →",
        "pl-btn pl-btn-primary", function () { go(state.index + 1); });
      footer(foot, "neutral", "", [backButton(), next].filter(Boolean));
      return;
    }

    // question
    const sessionLesson = isSession() ? deps.getLesson(st.lessonId) : null;
    if (sessionLesson) l = sessionLesson;
    const label = isSession()
      ? (state.session.kind === "review" ? "REPETERA · " + l.title.toUpperCase() : "ÖVA MER · FRÅGA " + st.number + " AV " + st.total)
      : "FRÅGA " + st.number + " AV " + st.total;
    const holder = el("div", "pl-question");
    card.appendChild(holder);
    state.hosts = { answer: el("div", "pl-foot-answer"), feedback: el("div", "pl-foot-feedback"), question: el("div", "pl-foot-q") };
    // the question is repeated above the answer field. It is only shown while the on-screen keyboard is open,
    // when the question itself has scrolled out of the small visible area.
    const promptText = st.task.problem && st.task.problem.prompt ? String(st.task.problem.prompt) : "";
    if (window.GaussicaText) window.GaussicaText.set(state.hosts.question, promptText); else state.hosts.question.textContent = promptText;
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
      answerHost: state.hosts.answer,
      feedbackHost: state.hosts.feedback,
      onResult: function (ok) {
        if (isSession()) {
          const r = state.session.results[st.task.id] || (state.session.results[st.task.id] = { completed: false, answered: true, tries: 0 });
          r.answered = true;
          if (ok && !r.completed) { r.completed = true; r.firstTry = r.tries === 0; }
          if (!ok) r.tries += 1;
        }
        if (ok) showSolved(true); else showWrong();
      }
    });

    const e = entryOf(st);
    if (e && e.completed) showSolved(false);
    else footer(foot, "neutral", "", [backButton(), skip].filter(Boolean));
    const input = foot.querySelector("input[name=answer]");
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
    const R = window.GaussicaRewards;
    if (!open.length && R && R.enabled()) {
      const s = R.lessonStars(l).stars;
      const box = el("div", "pl-stars");
      box.setAttribute("aria-label", s + " av 3 stjärnor");
      for (let i = 0; i < 3; i++) box.appendChild(el("span", "pl-star" + (i < s ? " is-on" : ""), "★"));
      card.appendChild(box);
      R.celebrate();
    }
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
    if (!open.length && deps.hasPractice && deps.hasPractice(l.id)) {
      actions.push(button("Öva mer", "pl-btn pl-btn-ghost", function () { deps.startPractice(l.id); }));
    }
    actions.unshift(button("Till lärstigen", open.length ? "pl-btn pl-btn-ghost" : (actions.length ? "pl-btn pl-btn-ghost" : "pl-btn pl-btn-primary"), exit));
    const back = backButton();
    footer(foot, open.length ? "neutral" : "correct", open.length ? "" : "🎉 Lektionen är klar", (back ? [back] : []).concat(actions));
  }

  function sessionSummary(card, foot) {
    const s = state.session;
    const total = state.steps.length;
    const results = state.steps.map(function (st) { return s.results[st.task.id] || {}; });
    const solved = results.filter(function (r) { return r.completed; }).length;
    const first = results.filter(function (r) { return r.firstTry; }).length;
    const missed = state.steps.filter(function (st) { return !(s.results[st.task.id] || {}).completed; });
    card.appendChild(el("p", "eyebrow pl-eyebrow", s.kind === "review" ? "REPETITION KLAR" : "ÖVNING KLAR"));
    card.appendChild(el("h2", "pl-summary-title", first === total ? "Strålande!" : "Bra jobbat!"));
    card.appendChild(el("p", "pl-summary-sub",
      solved + " av " + total + " frågor klara" + (first ? " · " + first + " rätt på första försöket" : "") +
      (missed.length ? " · " + missed.length + " kvar att lösa" : "")));
    const list = el("ul", "pl-summary-list");
    state.steps.forEach(function (st, i) {
      const r = results[i];
      const status = r.completed ? "done" : r.answered ? "fix" : "todo";
      const li = el("li", "pl-summary-row is-" + status);
      const b = el("button", "pl-summary-btn");
      b.type = "button";
      const lessonTitle = deps.getLesson(st.lessonId).title;
      b.append(
        el("span", "pl-summary-dot", status === "done" ? "✓" : status === "fix" ? "!" : String(st.number)),
        el("span", "pl-summary-name", s.kind === "review" ? lessonTitle : "Fråga " + st.number),
        el("span", "pl-summary-text", r.completed ? (r.firstTry ? "Rätt på första försöket" : "Rätt efter " + (r.tries + 1) + " försök") : r.answered ? "Inte löst än" : "Inte gjord")
      );
      b.addEventListener("click", function () { go(i); });
      li.appendChild(b);
      list.appendChild(li);
    });
    card.appendChild(list);

    const actions = [];
    if (missed.length) actions.push(button("Gå till första som återstår →", "pl-btn pl-btn-primary", function () { go(state.steps.indexOf(missed[0])); }));
    else if (s.again) actions.push(button(s.kind === "review" ? "Repetera mer →" : "Öva en runda till →", "pl-btn pl-btn-primary", function () { s.again(); }));
    actions.unshift(button(s.backLabel || "Tillbaka", missed.length || actions.length ? "pl-btn pl-btn-ghost" : "pl-btn pl-btn-primary", exit));
    const back = backButton();
    footer(foot, missed.length ? "neutral" : "correct", missed.length ? "" : "🎉 Bra kämpat", (back ? [back] : []).concat(actions));
  }

  return { init: init, open: open, openSession: openSession, close: close };
}());
