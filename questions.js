// The questions of a lesson as the student meets them: the term cards, matching, true or false, the formats (formats.js) and the question with
// an answer to type. Cut out of app.js; it gets the page state and the functions that keep the answers from app.js through init().

window.GaussicaQuestions = (function () {
  "use strict";

  const makeElement = window.GaussicaDom.makeElement;
  // what app.js gives to init: the page state and the functions that keep the progress
  let questionShownAt, drawings, practiceProblems, isPractice, savedEntry, storeCanvas, storeAnswerProgress, isStudent, renderVisualsFor, keepFocus, answerFormNote, getCourse;

  function init(d) {
    questionShownAt = d.questionShownAt;
    drawings = d.drawings;
    practiceProblems = d.practiceProblems;
    isPractice = d.isPractice;
    savedEntry = d.savedEntry;
    storeCanvas = d.storeCanvas;
    storeAnswerProgress = d.storeAnswerProgress;
    isStudent = d.isStudent;
    renderVisualsFor = d.renderVisualsFor;
    keepFocus = d.keepFocus;
    answerFormNote = d.answerFormNote;
    getCourse = d.getCourse;
  }

  // ===== BEGREPP: term cards and the matching test =====
  // { type: "begreppskort", title, intro, cards: [{ term, definition, example }] }
  function renderConceptCards(comp) {
    const box = makeElement("section", "concepts");
    box.appendChild(makeElement("p", "eyebrow", "BEGREPP"));
    box.appendChild(makeElement("h3", "concepts-title", comp.title || "Begreppen i den här lektionen"));
    if (comp.intro) box.appendChild(makeElement("p", "body-copy", comp.intro));
    const grid = makeElement("div", "concept-grid");
    (comp.cards || []).forEach(function (card, i) {
      const c = makeElement("article", "concept-card c" + (i % 6));
      c.appendChild(makeElement("h4", "concept-term", card.term));
      c.appendChild(makeElement("p", "concept-def", card.definition));
      if (card.example) {
        const ex = makeElement("p", "concept-example");
        window.GaussicaText.set(ex, "Exempel: " + card.example);
        c.appendChild(ex);
      }
      grid.appendChild(c);
    });
    box.appendChild(grid);
    return box;
  }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Connect each term with its explanation: pick one on each side. A right pair locks in with a colour and number;
  // a wrong pair is logged (so the teacher sees which terms get mixed up) and the student tries again.
  function renderMatching(parent, lesson, exercise, taskId, labelText, opts) {
    const finish = function (isCorrect) { if (opts && opts.onResult) opts.onResult(isCorrect); };
    questionShownAt[lesson.id + "|" + taskId] = Date.now();
    if (isPractice(taskId)) practiceProblems[lesson.id + "|" + taskId] = exercise;
    const saved = savedEntry(lesson.id, taskId);
    const pairs = exercise.pairs;

    const section = makeElement("section", "exercise word-problem match-exercise");
    const headingId = "problem-title-" + lesson.id + "-" + taskId;
    section.setAttribute("aria-labelledby", headingId);
    const heading = makeElement("h3", "", exercise.prompt);
    heading.id = headingId;
    section.append(makeElement("p", "eyebrow", labelText), heading);
    section.appendChild(makeElement("p", "match-help", "Välj ett begrepp och sedan förklaringen som passar. Rätt par får samma färg."));

    const status = makeElement("p", "match-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const board = makeElement("div", "match-board");
    const left = makeElement("div", "match-col");
    const right = makeElement("div", "match-col");
    board.append(left, right);
    const feedback = makeElement("p", "feedback-message", "");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    const termBtns = [], defBtns = [];
    const matched = new Set();
    let pickedTerm = -1, pickedDef = -1, order = 0;

    function markPair(t, d) {
      order += 1;
      matched.add(t);
      [termBtns[t], defBtns[d]].forEach(function (b) {
        b.disabled = true;
        b.classList.remove("is-picked");
        b.classList.add("is-done", "pair" + ((order - 1) % 6));
        b.appendChild(makeElement("span", "match-no", String(order)));
      });
    }

    function updateStatus() {
      status.textContent = matched.size + " av " + pairs.length + " rätt";
    }

    function clearPicks() {
      pickedTerm = pickedDef = -1;
      termBtns.concat(defBtns).forEach(function (b) { b.classList.remove("is-picked"); b.setAttribute("aria-pressed", "false"); });
    }

    function tryPair() {
      if (pickedTerm < 0 || pickedDef < 0) return;
      const t = pickedTerm, d = pickedDef;
      if (t === d) {
        clearPicks();
        markPair(t, d);
        updateStatus();
        if (matched.size === pairs.length) {
          window.GaussicaText.set(feedback, exercise.correct);
          feedback.className = "feedback-message feedback-correct";
          storeAnswerProgress(lesson.id, taskId, "Alla " + pairs.length + " par rätt", "", exercise.correct, "correct", true, null, exercise.prompt, labelText);
          finish(true);
        } else {
          feedback.className = "feedback-message";
          feedback.textContent = "";
        }
        return;
      }
      // wrong: remember which term the chosen explanation belongs to
      const wrongBtns = [termBtns[t], defBtns[d]];
      wrongBtns.forEach(function (b) { b.classList.add("is-wrong"); });
      setTimeout(function () { wrongBtns.forEach(function (b) { b.classList.remove("is-wrong"); }); }, 650);
      clearPicks();
      const note = "Inte riktigt. De passar inte ihop. Läs begreppskorten igen och försök på nytt.";
      feedback.className = "feedback-message feedback-hint";
      feedback.textContent = note;
      const shown = pairs[d].definition.length > 80 ? pairs[d].definition.slice(0, 77) + "…" : pairs[d].definition;
      storeAnswerProgress(lesson.id, taskId, pairs[t].term + " = " + shown, "", note, "hint", false,
        "Blandade ihop ”" + pairs[t].term + "” med ”" + pairs[d].term + "”", exercise.prompt, labelText);
      finish(false);
    }

    pairs.forEach(function (p, i) {
      const tb = makeElement("button", "match-item match-term", p.term);
      tb.type = "button";
      tb.setAttribute("aria-pressed", "false");
      tb.addEventListener("click", function () {
        if (matched.has(i)) return;
        const was = pickedTerm === i;
        termBtns.forEach(function (b) { b.classList.remove("is-picked"); b.setAttribute("aria-pressed", "false"); });
        pickedTerm = was ? -1 : i;
        if (!was) { tb.classList.add("is-picked"); tb.setAttribute("aria-pressed", "true"); }
        tryPair();
      });
      termBtns[i] = tb;
      left.appendChild(tb);
    });

    shuffled(pairs.map(function (p, i) { return i; })).forEach(function (i) {
      const db = makeElement("button", "match-item match-def", pairs[i].definition);
      db.type = "button";
      db.setAttribute("aria-pressed", "false");
      db.addEventListener("click", function () {
        if (matched.has(i)) return;
        const was = pickedDef === i;
        defBtns.forEach(function (b) { b.classList.remove("is-picked"); b.setAttribute("aria-pressed", "false"); });
        pickedDef = was ? -1 : i;
        if (!was) { db.classList.add("is-picked"); db.setAttribute("aria-pressed", "true"); }
        tryPair();
      });
      defBtns[i] = db;
      right.appendChild(db);
    });

    section.append(board, status, feedback);
    parent.appendChild(section);
    updateStatus();

    // an already solved test is shown as solved
    if (saved.completed) {
      pairs.forEach(function (p, i) { markPair(i, i); });
      updateStatus();
      window.GaussicaText.set(feedback, exercise.correct);
      feedback.className = "feedback-message feedback-correct";
    }
  }

  // A similar question with other numbers, from a practice template of the same lesson, to show how it is solved.
  // The templates tied to the task (their "for") are used, or the template the question came from. Returns the question
  // (with its solution steps if the template has them) or null when there is nothing to show.
  function workedExampleFor(lessonId, taskId, current) {
    const lesson = getCourse().lessons.find(function (l) { return l.id === lessonId; });
    const PR = window.GaussicaPractice;
    if (!lesson || !PR) return null;
    const list = PR.templates(lesson);
    let ids;
    if (PR.isPracticeId(taskId)) { const p = PR.parseId(taskId); ids = p ? [p.template] : []; }
    else ids = list.filter(function (t) { return (t.for || []).indexOf(taskId) >= 0; }).map(function (t) { return t.id; });
    if (!ids.length) return null;
    const sig = function (p) { return JSON.stringify([p.prompt, p.answer, p.statements, p.pairs]); };
    const cur = current || {};
    for (let i = 0; i < 30; i++) {
      const q = PR.generate(lesson, ids[i % ids.length]);
      if (!q) continue;
      const p = q.problem;
      if (sig(p) === sig(cur)) continue;
      // a numeric question must have another answer than the student's own, so that the example never gives it away
      if (!p.statements && !p.pairs && JSON.stringify(p.answer) === JSON.stringify(cur.answer)) continue;
      return p;
    }
    return null;
  }

  function isTrue(x) { return x === true || /^(sant|true|ja)$/i.test(String(x)); }

  // True or false: a list of statements, each marked "Sant" or "Falskt", then checked together.
  //   exercise.statements = [{ text, answer: true | false, explain }]
  // The student sees how many are right, not which ones, until a second try has failed. When all are right the
  // explanations are shown. Only the checks are logged (like the matching task), so the teacher sees the tries.
  function renderTrueFalse(parent, lesson, exercise, taskId, labelText, opts) {
    const finish = function (isCorrect) { if (opts && opts.onResult) opts.onResult(isCorrect); };
    questionShownAt[lesson.id + "|" + taskId] = Date.now();
    if (isPractice(taskId)) practiceProblems[lesson.id + "|" + taskId] = exercise;
    const saved = savedEntry(lesson.id, taskId);
    const statements = exercise.statements;
    const promptText = exercise.prompt + " " + statements.map(function (s, i) { return (i + 1) + ". " + s.text; }).join("  ");

    const section = makeElement("section", "exercise word-problem tf-exercise");
    const headingId = "problem-title-" + lesson.id + "-" + taskId;
    section.setAttribute("aria-labelledby", headingId);
    const heading = makeElement("h3", "", exercise.prompt);
    heading.id = headingId;
    section.append(makeElement("p", "eyebrow", labelText), heading);
    const listenTf = window.GaussicaSpeech && window.GaussicaSpeech.button(function () {
      return exercise.prompt + " " + statements.map(function (s, i) { return "Påstående " + (i + 1) + ": " + s.text + "."; }).join(" ");
    });
    if (listenTf) section.appendChild(listenTf);
    section.appendChild(makeElement("p", "match-help", statements.length === 1
      ? "Välj Sant eller Falskt och tryck på Kolla svaret."
      : "Välj Sant eller Falskt för varje påstående och tryck på Kolla svaret."));

    const choices = statements.map(function () { return null; });   // true, false or null (not answered)
    // an earlier try is shown again ("1: Sant · 2: Falskt")
    String(saved.answer || "").replace(/(\d+):\s*(Sant|Falskt)/g, function (m, n, v) {
      const i = Number(n) - 1;
      if (i >= 0 && i < choices.length) choices[i] = v === "Sant";
      return m;
    });

    const order = statements.map(function (s, i) { return i; });
    const list = makeElement("ol", "tf-list");
    const rows = [];
    const rowOrder = exercise.shuffle ? shuffled(order) : order;
    const check = makeElement("button", "primary-button answer-button tf-check", "Kolla svaret");
    check.type = "button";
    const feedback = makeElement("p", "feedback-message", "");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    let fails = 0;
    let solved = false;

    function paint(i) {
      const r = rows[i];
      r.yes.setAttribute("aria-pressed", String(choices[i] === true));
      r.no.setAttribute("aria-pressed", String(choices[i] === false));
      r.yes.classList.toggle("is-chosen", choices[i] === true);
      r.no.classList.toggle("is-chosen", choices[i] === false);
    }

    function updateCheck() {
      check.disabled = solved || choices.some(function (c) { return c === null; });
    }

    function lockSolved() {
      solved = true;
      rows.forEach(function (r, i) {
        r.yes.disabled = r.no.disabled = true;
        r.li.classList.remove("is-wrong");
        r.li.classList.add("is-right");
        paint(i);
        if (statements[i].explain && !r.li.querySelector(".tf-explain")) {
          const ex = makeElement("p", "tf-explain");
          window.GaussicaText.set(ex, statements[i].explain);
          r.li.appendChild(ex);
        }
      });
      check.hidden = true;
      window.GaussicaText.set(feedback, exercise.correct);
      feedback.className = "feedback-message feedback-correct";
    }

    rowOrder.forEach(function (i, pos) {
      const li = makeElement("li", "tf-row");
      const text = makeElement("p", "tf-text");
      text.appendChild(makeElement("span", "tf-no", String(pos + 1)));
      const body = makeElement("span", "tf-body");
      window.GaussicaText.set(body, statements[i].text);
      text.appendChild(body);
      const buttons = makeElement("div", "tf-buttons");
      buttons.setAttribute("role", "group");
      buttons.setAttribute("aria-label", "Svar på påstående " + (pos + 1));
      const yes = makeElement("button", "tf-btn tf-yes", "Sant");
      const no = makeElement("button", "tf-btn tf-no-btn", "Falskt");
      [yes, no].forEach(function (b) { b.type = "button"; b.setAttribute("aria-pressed", "false"); });
      yes.addEventListener("click", function () { choose(i, true); });
      no.addEventListener("click", function () { choose(i, false); });
      buttons.append(yes, no);
      li.append(text, buttons);
      list.appendChild(li);
      rows[i] = { li: li, yes: yes, no: no };
    });

    function choose(i, value) {
      if (solved) return;
      choices[i] = choices[i] === value ? null : value;   // a second tap on the same button takes it back
      rows[i].li.classList.remove("is-wrong");
      feedback.className = "feedback-message";
      feedback.textContent = "";
      paint(i);
      updateCheck();
    }

    check.addEventListener("click", function () {
      if (solved || choices.some(function (c) { return c === null; })) return;
      const wrong = [];
      statements.forEach(function (s, i) { if (choices[i] !== isTrue(s.answer)) wrong.push(i); });
      const answerText = choices.map(function (c, i) { return (i + 1) + ": " + (c ? "Sant" : "Falskt"); }).join(" · ");
      if (!wrong.length) {
        lockSolved();
        storeAnswerProgress(lesson.id, taskId, answerText, "", exercise.correct, "correct", true, null, promptText, labelText);
        finish(true);
        return;
      }
      fails += 1;
      const right = statements.length - wrong.length;
      const note = statements.length === 1
        ? "Inte riktigt. Läs påståendet en gång till och tänk efter."
        : right + " av " + statements.length + " rätt. Läs de du är osäker på igen och ändra dem du tror är fel.";
      // after a second failed try the wrong ones are marked, so that nobody gets stuck
      rows.forEach(function (r, i) { r.li.classList.toggle("is-wrong", fails >= 2 && wrong.indexOf(i) >= 0); });
      feedback.className = "feedback-message feedback-hint";
      feedback.textContent = fails >= 2 ? note + " De markerade är fel." : note;
      const shown = wrong.slice(0, 2).map(function (i) { return "”" + (statements[i].text.length > 60 ? statements[i].text.slice(0, 57) + "…" : statements[i].text) + "”"; }).join(" och ");
      storeAnswerProgress(lesson.id, taskId, answerText, "", note, "hint", false, "Fel på " + shown, promptText, labelText);
      finish(false);
    });

    section.append(list, check, feedback);
    parent.appendChild(section);
    rows.forEach(function (r, i) { paint(i); });
    updateCheck();

    // an already solved test is shown as solved, with the right answers
    if (saved.completed) {
      statements.forEach(function (s, i) { choices[i] = isTrue(s.answer); });
      lockSolved();
    }
  }

  // The new formats (sortera, ordna, hittafelet, lucktext): drawn and checked by formats.js, saved like the other tasks.
  function renderFormat(parent, lesson, exercise, taskId, labelText, opts) {
    questionShownAt[lesson.id + "|" + taskId] = Date.now();
    if (isPractice(taskId)) practiceProblems[lesson.id + "|" + taskId] = exercise;
    window.GaussicaFormats.render(parent, exercise, {
      labelText: labelText,
      headingId: "problem-title-" + lesson.id + "-" + taskId,
      saved: savedEntry(lesson.id, taskId),
      text: function (node, text) { window.GaussicaText.set(node, text); },
      store: function (answer, feedback, type, ok, misconception, prompt) { storeAnswerProgress(lesson.id, taskId, answer, "", feedback, type, ok, misconception, prompt, labelText); },
      finish: function (ok) { if (opts && opts.onResult) opts.onResult(ok); },
      listen: function (read) { return window.GaussicaSpeech ? window.GaussicaSpeech.button(read) : null; }
    });
  }

  // opts.onResult(isCorrect) is called after each submitted answer (used by the lesson player).
  function renderProblem(parent, lesson, exercise, taskId, labelText, opts) {
    exercise = window.GaussicaLesson.personalize(exercise);
    if (exercise.format && window.GaussicaFormats) return renderFormat(parent, lesson, exercise, taskId, labelText, opts);
    if (Array.isArray(exercise.pairs)) return renderMatching(parent, lesson, exercise, taskId, labelText, opts);
    if (Array.isArray(exercise.statements)) return renderTrueFalse(parent, lesson, exercise, taskId, labelText, opts);
    const finish = function (isCorrect) { if (opts && opts.onResult) opts.onResult(isCorrect); };
    questionShownAt[lesson.id + "|" + taskId] = Date.now();
    const saved = savedEntry(lesson.id, taskId);
    if (isPractice(taskId)) practiceProblems[lesson.id + "|" + taskId] = exercise;
    const section = makeElement("section", taskId === "exercise" ? "exercise" : "exercise word-problem");
    const headingId = "problem-title-" + lesson.id + "-" + taskId;
    section.setAttribute("aria-labelledby", headingId);
    const heading = makeElement("h3", "", exercise.prompt);
    heading.id = headingId;
    section.append(
      makeElement("p", "eyebrow", labelText),
      heading
    );
    const listenQ = window.GaussicaSpeech && window.GaussicaSpeech.button(function () { return exercise.prompt; });
    if (listenQ) section.appendChild(listenQ);
    const teacherNotes = isStudent() && !isPractice(taskId) ? window.GaussicaMailbox.inline(lesson.id, taskId) : null;
    if (teacherNotes) section.appendChild(teacherNotes);
    renderVisualsFor(section, exercise);

    // --- RITYTA: pen, text and bits to place; saved with the answer so the teacher can see it ---
    const drawKey = lesson.id + "|" + taskId;
    drawings[drawKey] = saved.canvas || "";
    const scratchBox = makeElement("div", "scratchpad-box canvas-box");
    const scratchHeader = makeElement("div", "scratchpad-header");
    const scratchTitle = makeElement("div", "scratchpad-title");
    scratchTitle.append(
      makeElement("span", "scratchpad-icon", "✏️"),
      makeElement("span", "scratchpad-heading", "Rityta")
    );
    const scratchSubtitle = makeElement("span", "scratchpad-hint", "Rita, skriv och lägg ut saker. Din lärare kan se hur du tänkte.");
    // On a phone the drawing area is folded away until it is needed (unless something is already drawn), so that
    // the question and the answer field fit on the screen together. Wider screens always show it.
    const scratchToggle = makeElement("button", "scratchpad-toggle");
    scratchToggle.type = "button";
    const setScratchOpen = function (open) {
      scratchBox.classList.toggle("is-collapsed", !open);
      scratchToggle.textContent = open ? "Dölj ▴" : "Rita ▾";
      scratchToggle.setAttribute("aria-expanded", String(open));
    };
    setScratchOpen(!(window.matchMedia("(max-width: 640px)").matches && window.GaussicaCanvas.isEmpty(saved.canvas || "")));
    scratchToggle.addEventListener("click", function () { setScratchOpen(scratchBox.classList.contains("is-collapsed")); });
    scratchHeader.append(scratchTitle, scratchSubtitle, scratchToggle);
    const pad = window.GaussicaCanvas.create({
      value: saved.canvas || "",
      onChange: function (json) { storeCanvas(lesson.id, taskId, json); }
    });
    scratchBox.append(scratchHeader, pad);
    section.appendChild(scratchBox);

    // --- SLUTGILTIGT SVARSFÄLT ---
    const form = document.createElement("form");
    form.className = "answer-form";
    const answerField = makeElement("div", "final-answer-field");
    const label = makeElement("label", "final-answer-label", "Svar:");
    label.setAttribute("for", "answer-" + lesson.id + "-" + taskId);

    const answer = document.createElement("input");
    answer.type = "text";
    answer.id = "answer-" + lesson.id + "-" + taskId;
    answer.name = "answer";
    answer.autocomplete = "off";
    // A phone must not turn x = 4 into X = 4 or "romb" into another word. (Answers are also compared without regard
    // to upper and lower case, see symbolic-math.js, in case a keyboard does it anyway.)
    answer.setAttribute("autocapitalize", "none");
    answer.setAttribute("autocorrect", "off");
    answer.spellcheck = false;
    answer.placeholder = "Skriv ditt svar här";
    answer.required = true;
    answer.value = saved.answer || "";
    answer.setAttribute("aria-describedby", "feedback-" + lesson.id + "-" + taskId);
    answerField.append(label, answer);

    const submit = makeElement("button", "primary-button answer-button", "Kolla svaret");
    submit.type = "submit";
    keepFocus(submit);   // the keyboard of a phone stays open, so that a wrong answer can be changed at once
    form.append(answerField, submit);

    const feedback = makeElement("p", "feedback-message", saved.feedback || "");
    feedback.id = "feedback-" + lesson.id + "-" + taskId;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.classList.toggle("feedback-correct", saved.feedbackType === "correct");
    feedback.classList.toggle("feedback-hint", saved.feedbackType === "hint");

    answer.addEventListener("input", function () {
      feedback.className = "feedback-message";
      feedback.textContent = "";
      storeAnswerProgress(lesson.id, taskId, answer.value, "", "", "", false, null, exercise.prompt, labelText);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const rawValue = answer.value.trim();
      const value = rawValue.toLowerCase().replace(/\s+/g, "");

      // 1. Symbolisk CAS-kontroll
      let isCorrect = false;
      if (window.MATTE_SYMBOLIC) {
        isCorrect = exercise.answer.some(function (accepted) {
          return window.MATTE_SYMBOLIC.areEquivalent(rawValue, accepted);
        });
      } else {
        isCorrect = exercise.answer.some(function (accepted) {
          return value === accepted.toLowerCase().replace(/\s+/g, "");
        });
      }

      // The right value written as a calculation ("36/6" for 6): where the point is to calculate, ask for the number.
      const MS = window.MATTE_SYMBOLIC;
      if (isCorrect && MS && MS.isCalculation(rawValue) && MS.expectsPlainNumber(exercise.answer) &&
          !window.GaussicaLesson.allowsExpression(lesson, exercise, getCourse().lessons)) {
        const note = "Det stämmer, men du ska räkna ut svaret och skriva det som ett tal. Skriv talet i stället för uträkningen.";
        feedback.className = "feedback-message feedback-hint";
        window.GaussicaText.set(feedback, note);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", note, "hint", false, "Skrev en uträkning i stället för ett svar", exercise.prompt, labelText);
        finish(false);
        return;
      }

      // Some questions ask for a particular way of writing the right value (form: "blandad", "brak" or "forenklat").
      const formNote = isCorrect && exercise.form ? answerFormNote(exercise.form, rawValue) : "";
      if (formNote) {
        feedback.className = "feedback-message feedback-hint";
        window.GaussicaText.set(feedback, formNote);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", formNote, "hint", false, "Skrev rätt värde på fel sätt", exercise.prompt, labelText);
        finish(false);
        return;
      }

      if (isCorrect) {
        feedback.className = "feedback-message feedback-correct";
        window.GaussicaText.set(feedback, exercise.correct);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", exercise.correct, "correct", true, null, exercise.prompt, labelText);
        finish(true);
        return;
      }

      // 2. Fördefinierad återkoppling i lektionens JSON
      const misconception = exercise.feedback.find(function (item) {
        return item.answers.some(function (incorrect) {
          if (window.MATTE_SYMBOLIC && window.MATTE_SYMBOLIC.areEquivalent(rawValue, incorrect)) return true;
          return value === incorrect.toLowerCase().replace(/\s+/g, "");
        });
      });

      if (misconception) {
        feedback.className = "feedback-message feedback-hint";
        window.GaussicaText.set(feedback, misconception.message);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", misconception.message, "hint", false, misconception.message, exercise.prompt, labelText);
        finish(false);
        return;
      }

      // 3. Automatisk generering och diagnos av missuppfattningar (kedjeregel, associativa, distributiva, räkneordning osv.)
      // the mistakes of numbers (carrying, fractions, decimals, percent, units ...) first, then those of algebra
      let autoDiagnosis = window.GaussicaMisconceptions ? window.GaussicaMisconceptions.diagnose(rawValue, exercise.prompt, exercise.answer) : null;
      if (!autoDiagnosis && window.MATTE_SYMBOLIC) {
        autoDiagnosis = window.MATTE_SYMBOLIC.diagnoseMisconception(
          rawValue,
          exercise.answer[0],
          { prompt: exercise.prompt, explanation: lesson.explanation }
        );
      }

      if (autoDiagnosis) {
        feedback.className = "feedback-message feedback-hint feedback-diagnosed";
        feedback.replaceChildren();
        const badge = makeElement("span", "feedback-diagnosed-badge", "💡 Upptäckt mönster: " + autoDiagnosis.title);
        const explanationP = makeElement("p", "", autoDiagnosis.explanation);
        feedback.append(badge, explanationP);
        storeAnswerProgress(lesson.id, taskId, answer.value, "", autoDiagnosis.title + ": " + autoDiagnosis.explanation, "hint", false, autoDiagnosis.title, exercise.prompt, labelText);
        finish(false);
        return;
      }

      // 4. Standardledtråd
      feedback.className = "feedback-message feedback-hint";
      feedback.textContent = "Det svaret stämmer inte riktigt ännu. Titta på förklaringen ovan och prova att ta ett steg i taget.";
      storeAnswerProgress(lesson.id, taskId, answer.value, "", feedback.textContent, "hint", false, "Generellt beräkningsfel", exercise.prompt, labelText);
      finish(false);
    });

    // Keys for signs that are hard to find on a keyboard (< > ≠, brackets): "keys": ["<", "=", ">"] on a question
    let keysRow = null;
    if (Array.isArray(exercise.keys) && exercise.keys.length) {
      keysRow = makeElement("div", "answer-keys");
      keysRow.setAttribute("role", "group");
      keysRow.setAttribute("aria-label", "Tecken att skriva in");
      exercise.keys.forEach(function (key) {
        const b = makeElement("button", "answer-key", key);
        b.type = "button";
        keepFocus(b);
        b.addEventListener("click", function () {
          const start = answer.selectionStart === null ? answer.value.length : answer.selectionStart;
          const end = answer.selectionEnd === null ? start : answer.selectionEnd;
          answer.value = answer.value.slice(0, start) + key + answer.value.slice(end);
          answer.focus({ preventScroll: true });
          answer.setSelectionRange(start + key.length, start + key.length);
          answer.dispatchEvent(new Event("input", { bubbles: true }));
        });
        keysRow.appendChild(b);
      });
    }

    if (opts && opts.answerHost) {   // the player keeps these in its bottom bar
      if (keysRow) opts.answerHost.appendChild(keysRow);
      opts.answerHost.appendChild(form);
      (opts.feedbackHost || section).appendChild(feedback);
    } else {
      section.append(form);
      if (keysRow) section.appendChild(keysRow);
      section.append(feedback);
    }
    parent.appendChild(section);
  }

  return { init: init, renderConceptCards: renderConceptCards, workedExampleFor: workedExampleFor, isTrue: isTrue, renderMatching: renderMatching, renderTrueFalse: renderTrueFalse, renderFormat: renderFormat, renderProblem: renderProblem, shuffled: shuffled };
}());
