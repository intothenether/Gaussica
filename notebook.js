// "Mina knepiga": a notebook of the questions that have been tricky, so that a student can come back to them calmly.
// Nothing is stored for the list itself: it is worked out from the log of submitted answers. Only what the student has
// put away ("Jag kan det här") is kept, in the progress under the key "notebook".
//
// A question counts as tricky when an answer was wrong before it was solved (or it was never solved). Questions are
// grouped by the kind of question when there is a practice template behind it (a generated question and the lesson
// question it mirrors belong together), otherwise by the question itself. A tricky question leaves the list when the
// student has solved two in a row at the first try after that (generated variants, so it is the skill that counts and
// not the memory of one set of numbers). Those are kept in a short list of things that are now known.
//
//   GaussicaNotebook.entries(ctx, now)        -> { open: [entry], mastered: [entry], hidden: n }
//   GaussicaNotebook.retryRound(ctx, count)   -> [{ lessonId, taskId, templateId, problem }]  new questions of the same kinds
//   GaussicaNotebook.recordOf(student), hide(record, key, now)
//   GaussicaNotebook.renderCard(container, ctx, hooks)   the card on the start page (hidden when there is nothing to show)
//   GaussicaNotebook.open(deps) / closeActive()           the notebook itself
//
// ctx = { lessons, student: { attempts, lessonProgress } }
// entry = { key, lessonId, lessonTitle, template, taskId, prompt, answers, correct, lastAt, dirty, clean, need, canRetry }

window.GaussicaNotebook = (function () {
  "use strict";

  const KEY = "notebook";
  const NEED_CLEAN = 2;       // first-try solves in a row that put a question away
  const MAX_SHOWN = 40;

  function L() { return window.GaussicaLesson; }
  function PR() { return window.GaussicaPractice; }

  function time(a) { const t = Date.parse(a && a.timestamp); return isFinite(t) ? t : 0; }

  function keyOf(lesson, taskId) {
    const p = PR();
    if (p.isPracticeId(taskId)) {
      const parsed = p.parseId(taskId);
      if (parsed) return { key: lesson.id + "|t:" + parsed.template, template: parsed.template };
    }
    const t = p.templates(lesson).filter(function (x) { return (x.for || []).indexOf(taskId) >= 0; })[0];
    if (t) return { key: lesson.id + "|t:" + t.id, template: t.id };
    return { key: lesson.id + "|q:" + taskId, template: null };
  }

  function recordOf(student) {
    const r = student && student.lessonProgress && student.lessonProgress[KEY];
    return r && typeof r === "object" && r.hidden ? r : { v: 1, hidden: {} };
  }

  function hide(record, key, now) {
    const next = { v: 1, hidden: Object.assign({}, (record && record.hidden) || {}) };
    next.hidden[key] = now === undefined ? Date.now() : now;
    return next;
  }

  // ===== what is tricky (pure) =====
  function entries(ctx, now) {
    const lessonById = {};
    ctx.lessons.forEach(function (l) { lessonById[l.id] = l; });
    const subs = ((ctx.student && ctx.student.attempts) || []).filter(L().isSubmission).slice().sort(function (a, b) { return time(a) - time(b); });
    const pending = {};                // per question: the wrong answers since it was last solved
    const episodes = {};               // per kind of question: what happened, one entry for each time a question was solved or given up
    const info = {};
    const push = function (key, ep) { (episodes[key] || (episodes[key] = [])).push(ep); };

    subs.forEach(function (a) {
      const lesson = lessonById[a.lessonId];
      if (!lesson) return;
      const k = keyOf(lesson, a.taskId);
      info[k.key] = { lesson: lesson, template: k.template };
      const tk = a.lessonId + "|" + a.taskId;
      const st = pending[tk] || (pending[tk] = { key: k.key, taskId: a.taskId, wrong: 0, answers: [], prompt: "", correct: "", at: 0 });
      if (a.prompt) st.prompt = a.prompt;
      if (a.correctAnswer) st.correct = a.correctAnswer;
      if (!a.completed) {
        st.wrong += 1;
        st.at = time(a);
        if (a.answer && st.answers.indexOf(a.answer) < 0) st.answers.push(a.answer);
      } else {
        push(st.key, { at: time(a), wrong: st.wrong, taskId: st.taskId, prompt: st.prompt, answers: st.answers, correct: st.correct, solved: true });
        delete pending[tk];
      }
    });
    Object.keys(pending).forEach(function (tk) {
      const st = pending[tk];
      if (st.wrong > 0) push(st.key, { at: st.at, wrong: st.wrong, taskId: st.taskId, prompt: st.prompt, answers: st.answers, correct: st.correct, solved: false });
    });

    const hidden = recordOf(ctx.student).hidden;
    const open = [], mastered = [];
    let hiddenCount = 0;
    Object.keys(episodes).forEach(function (key) {
      const eps = episodes[key].slice().sort(function (a, b) { return a.at - b.at; });
      let lastDirty = -1;
      eps.forEach(function (e, i) { if (e.wrong > 0 || !e.solved) lastDirty = i; });
      if (lastDirty < 0) return;
      const dirtyEps = eps.filter(function (e) { return e.wrong > 0 || !e.solved; });
      const d = eps[lastDirty];
      const clean = eps.length - 1 - lastDirty;
      const i = info[key];
      const entry = {
        key: key, lessonId: i.lesson.id, lessonTitle: i.lesson.title, template: i.template, taskId: d.taskId, prompt: d.prompt,
        answers: d.answers.slice(-2), correct: d.correct, lastAt: d.at, dirty: dirtyEps.length, clean: Math.min(clean, NEED_CLEAN), need: NEED_CLEAN,
        canRetry: Boolean(i.template) && PR().has(i.lesson), mastered: clean >= NEED_CLEAN
      };
      if (hidden[key] && hidden[key] >= d.at && !entry.mastered) { hiddenCount += 1; return; }
      if (entry.mastered) { entry.lastAt = eps[eps.length - 1].at; mastered.push(entry); } else open.push(entry);
    });
    open.sort(function (a, b) { return b.lastAt - a.lastAt; });
    mastered.sort(function (a, b) { return b.lastAt - a.lastAt; });
    return { open: open.slice(0, MAX_SHOWN), mastered: mastered.slice(0, MAX_SHOWN), hidden: hiddenCount, total: open.length };
  }

  // A round of new questions of the kinds that have been tricky, the most recent first. A variant is never the question
  // that went wrong, and a round does not repeat a question.
  function retryRound(ctx, count) {
    const list = entries(ctx).open.filter(function (e) { return e.canRetry; });
    if (!list.length) return [];
    const lessonById = {};
    ctx.lessons.forEach(function (l) { lessonById[l.id] = l; });
    count = Math.min(count || 5, list.length * 2);
    const seen = new Set(list.map(function (e) { return e.prompt; }));
    const out = [];
    for (let i = 0; i < count * 4 && out.length < count; i++) {
      const e = list[i % list.length];
      const q = PR().generate(lessonById[e.lessonId], e.template);
      if (!q || seen.has(q.problem.prompt)) continue;
      seen.add(q.problem.prompt);
      out.push({ lessonId: e.lessonId, taskId: q.taskId, templateId: q.templateId, problem: q.problem });
    }
    return out;
  }

  // ===== the screens =====
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

  function setText(node, text) {
    if (window.GaussicaText && window.GaussicaText.set) window.GaussicaText.set(node, String(text));
    else node.textContent = String(text);
  }

  function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  // the card on the start page
  function renderCard(container, ctx, hooks) {
    if (!container) return;
    const e = entries(ctx);
    container.replaceChildren();
    if (!e.open.length && !e.mastered.length) { container.hidden = true; return; }
    container.hidden = false;
    const icon = el("span", "train-icon", "📒");
    const copy = el("div", "train-copy");
    copy.appendChild(el("h3", "", "Mina knepiga"));
    copy.appendChild(el("p", "", e.open.length
      ? plural(e.open.length, "fråga", "frågor") + " har varit knepiga. Träna lite på dem, så sitter de snart."
      : "Alla knepiga frågor sitter nu. Bra jobbat! 🎉"));
    container.append(icon, copy, button(e.open.length ? "Öppna boken" : "Se vad du lärt dig", "primary-button train-go", hooks.open));
  }

  let active = null;
  function closeActive() { if (active) active.close(); }

  // deps = { getContext(), getRecord(), save(record), workedExample(lessonId, taskId, problem), openLesson(id), startRetry(), onExit() }
  function open(deps) {
    closeActive();
    const overlay = el("div", "pv-overlay nb-overlay");
    overlay.id = "nb-overlay";
    const panel = el("div", "pv-card nb-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Mina knepiga");
    overlay.appendChild(panel);
    let closed = false;
    const close = function () {
      if (closed) return;
      closed = true;
      overlay.remove();
      if (active === handle) active = null;
    };
    const leave = function () { close(); deps.onExit(); };
    const handle = { close: close };

    const draw = function () {
      const data = entries(deps.getContext());
      const retry = data.open.filter(function (e) { return e.canRetry; }).length;
      panel.replaceChildren();
      const head = el("header", "nb-head");
      head.appendChild(el("h2", "", "📒 Mina knepiga"));
      const x = button("✕", "pet-close", leave);
      x.setAttribute("aria-label", "Stäng");
      head.appendChild(x);
      panel.appendChild(head);
      panel.appendChild(el("p", "nb-lead", "Här samlas frågor som varit knepiga. Det är ingenting fel med det, det är så man lär sig. Träna lite på dem så sitter de snart, och då försvinner de härifrån."));

      if (!data.open.length) {
        const empty = el("div", "nb-empty");
        empty.append(el("span", "nb-empty-emoji", data.mastered.length ? "🎉" : "🌱"),
          el("p", "", data.mastered.length
            ? "Inget är knepigt just nu. Du har tränat bort " + plural(data.mastered.length, "sak", "saker") + "!"
            : "Här är det tomt just nu. Svarar du fel på något hamnar det här, så att du kan träna på det senare."));
        panel.appendChild(empty);
      } else {
        const bar = el("div", "nb-bar");
        bar.appendChild(el("strong", "", plural(data.open.length, "knepig fråga", "knepiga frågor")));
        if (retry) {
          const go = button("Träna på dem →", "primary-button nb-go", function () { close(); deps.startRetry(); });
          go.title = "Några nya frågor av samma sort som blev knepiga";
          bar.appendChild(go);
        }
        panel.appendChild(bar);
        if (retry) panel.appendChild(el("p", "nb-hint", "Du får nya frågor av samma sort, inte samma tal igen. Svarar du rätt på första försöket två gånger i rad försvinner frågan härifrån."));
        const list = el("ul", "nb-list");
        data.open.forEach(function (e) { list.appendChild(card(e)); });
        panel.appendChild(list);
      }

      if (data.mastered.length) {
        const done = el("details", "nb-done");
        done.appendChild(el("summary", "", "🎉 Det här kan du nu (" + data.mastered.length + ")"));
        const ul = el("ul", "nb-done-list");
        data.mastered.forEach(function (e) {
          const li = el("li");
          li.append(el("strong", "", e.lessonTitle), document.createTextNode(" · " + clip(e.prompt, 90)));
          ul.appendChild(li);
        });
        done.appendChild(ul);
        panel.appendChild(done);
      }
      if (data.hidden) panel.appendChild(el("p", "nb-hint", plural(data.hidden, "fråga", "frågor") + " har du lagt undan. De kommer tillbaka om de blir knepiga igen."));
    };

    const card = function (e) {
      const li = el("li", "nb-item");
      const top = el("div", "nb-item-top");
      top.append(el("span", "nb-chip", e.lessonTitle), el("span", "nb-count", e.dirty === 1 ? "Gick fel en gång" : "Gick fel " + e.dirty + " gånger"));
      li.appendChild(top);
      const q = el("p", "nb-q");
      setText(q, e.prompt || "(frågan finns inte kvar)");
      li.appendChild(q);
      const facts = el("p", "nb-facts");
      if (e.answers.length) facts.appendChild(el("span", "", "Du svarade: " + e.answers.map(function (a) { return clip(a, 60); }).join(" och ")));
      if (e.correct) facts.appendChild(el("span", "", "Rätt svar: " + clip(e.correct, 60)));
      if (facts.children.length) li.appendChild(facts);
      if (e.canRetry) {
        const dots = el("p", "nb-dots");
        dots.setAttribute("aria-label", e.clean + " av " + e.need + " rätt på första försöket i rad");
        for (let i = 0; i < e.need; i++) dots.appendChild(el("span", i < e.clean ? "is-on" : "", i < e.clean ? "●" : "○"));
        dots.appendChild(document.createTextNode(" rätt på första försöket i rad"));
        li.appendChild(dots);
      }
      const actions = el("div", "nb-actions");
      const example = el("div", "nb-example");
      example.hidden = true;
      const showEx = button("💡 Visa ett löst exempel", "pet-btn", function () {
        if (!example.hidden) { example.hidden = true; return; }
        const p = deps.workedExample ? deps.workedExample(e.lessonId, e.taskId, {}) : null;
        example.replaceChildren();
        if (!p) {
          example.appendChild(el("p", "nb-hint", "Det finns inget löst exempel till den här frågan. Öppna lektionen för att läsa förklaringen."));
        } else {
          example.appendChild(el("strong", "", "Ett liknande tal:"));
          const pq = el("p", "nb-q");
          setText(pq, p.prompt || "");
          example.appendChild(pq);
          if (Array.isArray(p.solution) && p.solution.length) {
            const ol = el("ol", "nb-steps");
            p.solution.forEach(function (s) { const item = el("li"); setText(item, s); ol.appendChild(item); });
            example.appendChild(ol);
          }
          if (Array.isArray(p.answer) && p.answer.length && !p.statements && !p.pairs) example.appendChild(el("p", "nb-facts", "Svar: " + p.answer[0]));
        }
        example.hidden = false;
      });
      actions.append(showEx,
        button("Öppna lektionen", "pet-btn", function () { close(); deps.openLesson(e.lessonId); }),
        button("Jag kan det här", "pet-btn nb-know", function () {
          deps.save(hide(recordOf(deps.getContext().student), e.key, Date.now()));
          draw();
        }));
      li.append(actions, example);
      return li;
    };

    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) leave(); });
    overlay.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); leave(); } });
    draw();
    document.body.appendChild(overlay);
    active = handle;
    const first = panel.querySelector(".nb-go") || panel.querySelector("button");
    if (first) first.focus({ preventScroll: true });
    return handle;
  }

  return { KEY: KEY, NEED_CLEAN: NEED_CLEAN, entries: entries, retryRound: retryRound, recordOf: recordOf, hide: hide, renderCard: renderCard, open: open, closeActive: closeActive };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaNotebook;
