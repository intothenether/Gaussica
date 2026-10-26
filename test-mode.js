// Test mode: one question at a time, one answer per question and no hints on the way. Used by the placement test
// ("Hitta din nivå", placement.js) and by the prov (prov.js).
//
//   GaussicaTest.judge(lesson, problem, answer, opts) -> { correct, text, note }
//   GaussicaTest.correctText(problem)                 -> the right answer as text
//   GaussicaTest.promptText(problem)                  -> the question as text (with its statements)
//   GaussicaTest.run(config) -> { close() }           full-screen test, drawn in config.container
//
// An answer is a string for a normal question, an array of true/false for a true/false question (one per statement)
// and an array of indexes of the chosen explanation for a matching question (one per term).
//
// config = {
//   container, title, label,           the element to draw in (the same full-screen element as the lesson player)
//   getLesson(id), renderVisuals(parent, problem),
//   strict, allowsExpression(lesson, problem), formNote(form, raw),   how answers are judged (see judge)
//   total,                             number of questions when it is known (otherwise an estimate is used)
//   estimate,                          expected number of questions of a test that adapts
//   history: [record],                 answers given earlier (a test that is resumed)
//   next(history) -> { key, lessonId, problem } | null     the next question; null ends the test
//   onAnswer(item, record, history),   called after each answer
//   onDone(history, reason),           called once when the test is over ("done" | "time" | "quit")
//   finish({ card, foot, history, reason, exit, el, button }),   draws the result
//   endsAt,                            time limit as a timestamp (ms), with a clock in the top bar
//   canSkip, skipLabel,                the button for "I don't know"
//   confirmExit,                       text asked before quitting in the middle
//   onExit()
// }
// A record is { key, lessonId, prompt, answer, correctAnswer, correct, skipped, seconds, kind }.

window.GaussicaTest = (function () {
  "use strict";

  const LETTERS = "ABCDEFGHIJKLMNOP";

  function isTrue(x) { return x === true || /^(sant|true|ja)$/i.test(String(x)); }

  function kindOf(problem) {
    return Array.isArray(problem.statements) ? "statements" : Array.isArray(problem.pairs) ? "pairs" : "text";
  }

  function shorten(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function correctText(problem) {
    const kind = kindOf(problem);
    if (kind === "statements") return problem.statements.map(function (s, i) { return (i + 1) + ": " + (isTrue(s.answer) ? "Sant" : "Falskt"); }).join(" · ");
    if (kind === "pairs") return problem.pairs.map(function (p) { return p.term + " = " + shorten(p.definition, 60); }).join("; ");
    return String((problem.answer || []).filter(Boolean)[0] || "");
  }

  function promptText(problem) {
    const kind = kindOf(problem);
    let text = String(problem.prompt || "");
    if (kind === "statements") text += " " + problem.statements.map(function (s, i) { return (i + 1) + ". " + s.text; }).join("  ");
    if (kind === "pairs") text += " " + problem.pairs.map(function (p) { return p.term; }).join(", ");
    return text;
  }

  function normal(s) { return String(s).toLowerCase().replace(/\s+/g, ""); }

  function judge(lesson, problem, answer, opts) {
    opts = opts || {};
    const kind = kindOf(problem);
    if (kind === "statements") {
      const picks = Array.isArray(answer) ? answer : [];
      return {
        correct: problem.statements.every(function (s, i) { return picks[i] === isTrue(s.answer); }),
        text: problem.statements.map(function (s, i) { return (i + 1) + ": " + (picks[i] === true ? "Sant" : picks[i] === false ? "Falskt" : "–"); }).join(" · ")
      };
    }
    if (kind === "pairs") {
      const picks = Array.isArray(answer) ? answer : [];
      return {
        correct: problem.pairs.every(function (p, i) { return picks[i] === i; }),
        text: problem.pairs.map(function (p, i) { return p.term + " = " + (problem.pairs[picks[i]] ? shorten(problem.pairs[picks[i]].definition, 60) : "–"); }).join("; ")
      };
    }
    const raw = String(answer === undefined || answer === null ? "" : answer).trim();
    if (!raw) return { correct: false, text: "", note: "blank" };
    const MS = window.MATTE_SYMBOLIC;
    let ok = (problem.answer || []).some(function (accepted) {
      return MS ? MS.areEquivalent(raw, accepted) : normal(raw) === normal(accepted);
    });
    let note = "";
    // strict (the prov): the same rules as in the lessons. The right value written as a calculation, or in another
    // form than the question asks for, does not count.
    if (ok && opts.strict) {
      if (MS && MS.isCalculation(raw) && MS.expectsPlainNumber(problem.answer) && !(opts.allowsExpression && opts.allowsExpression(lesson, problem))) { ok = false; note = "calc"; }
      else if (problem.form && opts.formNote && opts.formNote(problem.form, raw)) { ok = false; note = "form"; }
    }
    return { correct: ok, text: raw, note: note };
  }

  // ----- drawing -----
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

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  let active = null;

  function run(cfg) {
    if (active) active.close();
    const container = cfg.container;
    const history = (cfg.history || []).slice();
    let current = null;
    let finished = false;
    let shownAt = 0;
    let tick = null;
    let onKey = null;
    let barHost = null;
    let clockHost = null;

    function open() {
      container.hidden = false;
      document.body.classList.add("player-open");
      onKey = function (e) { if (e.key === "Escape") { e.preventDefault(); quit(); } };
      document.addEventListener("keydown", onKey);
      if (cfg.endsAt) {
        tick = setInterval(function () {
          if (clockHost) {
            const left = cfg.endsAt - Date.now();
            clockHost.textContent = "⏱ " + clock(left);
            clockHost.classList.toggle("is-low", left < 60000);
          }
          if (Date.now() >= cfg.endsAt && !finished) over("time");
        }, 500);
      }
      advance();
    }

    function close() {
      if (tick) clearInterval(tick);
      tick = null;
      if (onKey) document.removeEventListener("keydown", onKey);
      onKey = null;
      if (window.GaussicaSpeech) window.GaussicaSpeech.stop();
      container.hidden = true;
      container.replaceChildren();
      document.body.classList.remove("player-open");
    }

    function exit() {
      close();
      if (cfg.onExit) cfg.onExit();
    }

    function quit() {
      if (!finished && cfg.confirmExit && !window.confirm(cfg.confirmExit)) return;
      if (!finished && cfg.onDone) cfg.onDone(history, "quit");
      finished = true;
      exit();
    }

    function advance() {
      if (finished) return;
      if (cfg.endsAt && Date.now() >= cfg.endsAt) { over("time"); return; }
      current = cfg.next(history);
      if (!current) { over("done"); return; }
      shownAt = Date.now();
      drawQuestion();
    }

    function over(reason) {
      if (finished) return;
      finished = true;
      if (tick) clearInterval(tick);
      tick = null;
      if (cfg.onDone) cfg.onDone(history, reason);
      drawEnd(reason);
    }

    function shell(withFoot) {
      container.replaceChildren();
      const root = el("div", "pl-shell");
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", cfg.title);
      const top = el("header", "pl-top");
      const x = button("✕", "pl-close", quit);
      x.setAttribute("aria-label", "Avsluta");
      x.title = "Avsluta (Esc)";
      barHost = el("div", "pl-bar");
      barHost.setAttribute("role", "progressbar");
      top.append(x, barHost, el("span", "pl-title", cfg.title));
      const actions = el("div", "pl-top-actions");
      if (cfg.endsAt && !finished) {
        clockHost = el("span", "pl-clock", "⏱ " + clock(cfg.endsAt - Date.now()));
        actions.appendChild(clockHost);
      } else clockHost = null;
      if (window.GaussicaReading) {
        const read = button("", "pl-read", function () { window.GaussicaReading.open(); });
        read.append(el("span", "pl-btn-icon", "Aa"), el("span", "pl-btn-label", " Läsning"));
        read.title = "Textstorlek, typsnitt och uppläsning.";
        actions.appendChild(read);
      }
      top.appendChild(actions);
      const main = el("main", "pl-main");
      main.tabIndex = -1;
      const card = el("div", "pl-card");
      main.appendChild(card);
      const foot = el("footer", "pl-foot is-neutral");
      root.append(top, main);
      if (withFoot !== false) root.appendChild(foot);
      container.appendChild(root);
      return { top: top, main: main, card: card, foot: foot };
    }

    function drawBar() {
      const total = cfg.total || Math.max(cfg.estimate || 0, history.length + 1);
      barHost.setAttribute("aria-valuemin", "0");
      barHost.setAttribute("aria-valuemax", String(total));
      barHost.setAttribute("aria-valuenow", String(history.length));
      for (let i = 0; i < total; i++) {
        barHost.appendChild(el("span", "pl-seg " + (i < history.length ? "is-done" : "") + (i === history.length ? " is-current" : "")));
      }
    }

    function drawQuestion() {
      const lesson = cfg.getLesson(current.lessonId);
      const problem = current.problem;
      const kind = kindOf(problem);
      const parts = shell();
      drawBar();
      const n = history.length + 1;
      const label = (cfg.label || "FRÅGA") + " " + n + (cfg.total ? " AV " + cfg.total : "");
      parts.card.appendChild(el("p", "eyebrow pl-eyebrow", label));
      const section = el("section", "exercise word-problem" + (kind === "statements" ? " tf-exercise" : ""));
      rich(section.appendChild(el("h3")), problem.prompt || "");
      if (window.GaussicaSpeech) {
        const listen = window.GaussicaSpeech.button(function () { return promptText(problem); });
        if (listen) section.appendChild(listen);
      }
      if (cfg.renderVisuals) cfg.renderVisuals(section, problem);
      parts.card.appendChild(section);

      const foot = parts.foot;
      const msg = el("div", "pl-foot-msg", cfg.total ? "" : "");
      const acts = el("div", "pl-foot-actions");
      const row = el("div", "pl-foot-row");
      let getAnswer = function () { return ""; };
      let ready = function () { return true; };
      let submitBtn = null;
      let focusEl = null;

      const submit = function (skipped) {
        if (finished) return;
        const answer = skipped ? "" : getAnswer();
        const j = skipped ? { correct: false, text: "" } : judge(lesson, problem, answer, cfg);
        const rec = {
          key: current.key, lessonId: current.lessonId, prompt: promptText(problem), answer: skipped ? "" : j.text,
          correctAnswer: correctText(problem), correct: Boolean(j.correct) && !skipped, skipped: Boolean(skipped),
          seconds: Math.round((Date.now() - shownAt) / 1000), kind: kind
        };
        if (j.note) rec.note = j.note;
        history.push(rec);
        if (cfg.onAnswer) cfg.onAnswer(current, rec, history);
        advance();
      };

      if (kind === "text") {
        const form = el("form", "answer-form");
        const field = el("div", "final-answer-field");
        const label2 = el("label", "final-answer-label", "Svar:");
        const input = document.createElement("input");
        input.type = "text";
        input.name = "answer";
        input.id = "test-answer";
        input.autocomplete = "off";
        input.setAttribute("autocapitalize", "none");
        input.setAttribute("autocorrect", "off");
        input.spellcheck = false;
        input.placeholder = "Skriv ditt svar här";
        label2.setAttribute("for", "test-answer");
        field.append(label2, input);
        submitBtn = el("button", "primary-button answer-button", "Svara →");
        submitBtn.type = "submit";
        form.append(field, submitBtn);
        form.addEventListener("submit", function (e) { e.preventDefault(); if (input.value.trim()) submit(false); });
        const hostAnswer = el("div", "pl-foot-answer");
        if (Array.isArray(problem.keys) && problem.keys.length) {
          const keys = el("div", "answer-keys");
          keys.setAttribute("role", "group");
          keys.setAttribute("aria-label", "Tecken att skriva in");
          problem.keys.forEach(function (key) {
            keys.appendChild(button(key, "answer-key", function () {
              const start = input.selectionStart === null ? input.value.length : input.selectionStart;
              const end = input.selectionEnd === null ? start : input.selectionEnd;
              input.value = input.value.slice(0, start) + key + input.value.slice(end);
              input.focus();
              input.setSelectionRange(start + key.length, start + key.length);
            }));
          });
          hostAnswer.appendChild(keys);
        }
        hostAnswer.appendChild(form);
        const q = el("div", "pl-foot-q");
        rich(q, String(problem.prompt || ""));
        foot.appendChild(q);
        row.append(msg, hostAnswer, acts);
        getAnswer = function () { return input.value; };
        focusEl = input;
      } else if (kind === "statements") {
        const picks = problem.statements.map(function () { return null; });
        const order = problem.statements.map(function (s, i) { return i; });
        const list = el("ol", "tf-list");
        const rows = [];
        const paint = function (i) {
          rows[i].yes.setAttribute("aria-pressed", String(picks[i] === true));
          rows[i].no.setAttribute("aria-pressed", String(picks[i] === false));
          rows[i].yes.classList.toggle("is-chosen", picks[i] === true);
          rows[i].no.classList.toggle("is-chosen", picks[i] === false);
        };
        (problem.shuffle ? shuffle(order) : order).forEach(function (i, pos) {
          const li = el("li", "tf-row");
          const text = el("p", "tf-text");
          text.appendChild(el("span", "tf-no", String(pos + 1)));
          text.appendChild(rich(el("span", "tf-body"), problem.statements[i].text));
          const group = el("div", "tf-buttons");
          group.setAttribute("role", "group");
          group.setAttribute("aria-label", "Svar på påstående " + (pos + 1));
          const yes = button("Sant", "tf-btn tf-yes", function () { picks[i] = picks[i] === true ? null : true; paint(i); update(); });
          const no = button("Falskt", "tf-btn tf-no-btn", function () { picks[i] = picks[i] === false ? null : false; paint(i); update(); });
          group.append(yes, no);
          li.append(text, group);
          list.appendChild(li);
          rows[i] = { yes: yes, no: no };
        });
        section.appendChild(el("p", "match-help", "Välj Sant eller Falskt för varje påstående."));
        section.appendChild(list);
        submitBtn = button("Svara →", "pl-btn pl-btn-primary", function () { if (ready()) submit(false); });
        const update = function () { submitBtn.disabled = !ready(); };
        ready = function () { return picks.every(function (p) { return p !== null; }); };
        getAnswer = function () { return picks.slice(); };
        submitBtn.disabled = true;
        acts.appendChild(submitBtn);
        row.append(msg, acts);
      } else {
        const picks = problem.pairs.map(function () { return -1; });
        const defs = shuffle(problem.pairs.map(function (p, i) { return i; }));
        section.appendChild(el("p", "match-help", "Läs förklaringarna A, B, C … och välj bokstaven som hör till varje begrepp."));
        const list = el("ul", "tt-pairs");
        problem.pairs.forEach(function (p, i) {
          const li = el("li", "tt-pair");
          li.appendChild(rich(el("span", "tt-term"), p.term));
          const select = document.createElement("select");
          select.setAttribute("aria-label", "Förklaring till " + p.term);
          const none = el("option", "", "Välj bokstav…");
          none.value = "-1";
          select.appendChild(none);
          defs.forEach(function (d, pos) {
            const o = el("option", "", LETTERS.charAt(pos));
            o.value = String(d);
            select.appendChild(o);
          });
          select.addEventListener("change", function () { picks[i] = Number(select.value); update(); });
          li.appendChild(select);
          list.appendChild(li);
        });
        const legend = el("ol", "tt-defs");
        legend.setAttribute("type", "A");
        defs.forEach(function (d) { legend.appendChild(rich(el("li"), problem.pairs[d].definition)); });
        section.append(el("h4", "tt-defs-title", "Förklaringarna"), legend, el("h4", "tt-defs-title", "Begreppen"), list);
        submitBtn = button("Svara →", "pl-btn pl-btn-primary", function () { if (ready()) submit(false); });
        const update = function () { submitBtn.disabled = !ready(); };
        ready = function () { return picks.every(function (p) { return p >= 0; }); };
        getAnswer = function () { return picks.slice(); };
        submitBtn.disabled = true;
        acts.appendChild(submitBtn);
        row.append(msg, acts);
      }

      if (cfg.canSkip) {
        const skip = button(cfg.skipLabel || "Vet inte", "pl-btn pl-btn-ghost", function () { submit(true); });
        if (kind === "text") acts.appendChild(skip); else acts.insertBefore(skip, acts.firstChild);
      }
      foot.appendChild(row);
      parts.main.scrollTop = 0;
      if (focusEl) focusEl.focus({ preventScroll: true }); else parts.main.focus({ preventScroll: true });
    }

    function drawEnd(reason) {
      const parts = shell();
      barHost.replaceChildren();
      const total = history.length;
      for (let i = 0; i < total; i++) barHost.appendChild(el("span", "pl-seg is-done"));
      cfg.finish({ card: parts.card, foot: parts.foot, history: history, reason: reason, exit: exit, el: el, button: button });
      parts.main.focus({ preventScroll: true });
    }

    open();
    const handle = { close: function () { close(); if (active === handle) active = null; } };
    active = handle;
    return handle;
  }

  // closes a test that is still open (when the page changes under it)
  function closeActive() { if (active) active.close(); }

  return { closeActive: closeActive, judge: judge, correctText: correctText, promptText: promptText, run: run, kindOf: kindOf, isTrue: isTrue };
}());
