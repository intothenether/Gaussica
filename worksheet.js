// Printable worksheets ("Arbetsblad") for the teacher: new questions from the lessons' practice templates, one sheet
// for everyone, a different sheet (other numbers) for each student, or several variants. With an answer key (facit).
//
//   GaussicaWorksheet.build(options)   the questions, without any drawing: { sheets: [{ name, sections: [{ lesson, questions }] }] }
//   GaussicaWorksheet.section(ctx)     the form for the teacher view (ctx as in teacher-view.js, plus ctx.renderVisuals)
//
// options: { lessons: [lesson], perLesson: 6, names: ["", ...] }   one sheet per name (an empty name: a sheet to fill in)
// A question is { number, problem, kind: "text" | "statements" | "pairs", order } where order is the shuffled order of
// the explanations in a matching question. The numbers are chosen from the lesson's practice templates, so the same
// options always give the same sheet, and the sheets of different names have different numbers.

window.GaussicaWorksheet = (function () {
  "use strict";

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function seedFor(lessonId, variant, k, attempt) {
    return 1 + ((hash(lessonId) + variant * 7919 + k * 104729 + attempt * 15485863) % 999999937);
  }

  function signature(p) {
    return JSON.stringify([p.prompt, (p.statements || []).map(function (s) { return s.text; }), (p.pairs || []).map(function (x) { return x.term; })]);
  }

  // `count` questions for one lesson and one sheet. Lessons without templates give their own (fixed) questions.
  function questionsFor(lesson, count, variant) {
    const PR = window.GaussicaPractice;
    const out = [];
    const templates = PR ? PR.templates(lesson) : [];
    if (templates.length) {
      const seen = new Set();
      for (let k = 0; out.length < count && k < count * 6; k++) {
        const t = templates[(k + variant) % templates.length];
        for (let attempt = 0; attempt < 8; attempt++) {
          const q = PR.generate(lesson, t.id, seedFor(lesson.id, variant, k, attempt));
          if (!q) continue;
          const sig = signature(q.problem);
          if (seen.has(sig)) continue;
          seen.add(sig);
          out.push(q.problem);
          break;
        }
      }
    } else {
      [lesson.exercise].concat(lesson.wordProblems || []).filter(Boolean).slice(0, count).forEach(function (p) { out.push(window.GaussicaLesson && window.GaussicaLesson.personalize ? window.GaussicaLesson.personalize(p) : p); });
    }
    return out;
  }

  function build(options) {
    const lessons = options.lessons || [];
    const perLesson = Math.max(1, Math.min(30, options.perLesson || 6));
    const names = options.names && options.names.length ? options.names : [""];
    const sheets = names.map(function (name, variant) {
      let number = 0;
      const sections = lessons.map(function (lesson) {
        const questions = questionsFor(lesson, perLesson, variant).map(function (problem) {
          number += 1;
          const q = { number: number, problem: problem, kind: Array.isArray(problem.statements) ? "statements" : Array.isArray(problem.pairs) ? "pairs" : "text" };
          if (q.kind === "pairs") {
            // the explanations in another order than the terms, the same for the same sheet
            const order = problem.pairs.map(function (p, i) { return i; });
            order.sort(function (a, b) { return hash(lesson.id + variant + a) - hash(lesson.id + variant + b); });
            if (order.every(function (v, i) { return v === i; }) && order.length > 1) order.push(order.shift());
            q.order = order;
          }
          return q;
        });
        return { lesson: lesson, questions: questions };
      });
      return { name: name, sections: sections };
    });
    return { sheets: sheets };
  }

  // the text of the answer in the key
  const LETTERS = "ABCDEFGHIJKLMNOP";
  function answerText(q) {
    if (q.kind === "statements") return q.problem.statements.map(function (s, i) { return (i + 1) + ". " + (s.answer ? "Sant" : "Falskt"); }).join("   ");
    if (q.kind === "pairs") {
      return q.problem.pairs.map(function (p, i) { return (i + 1) + "-" + LETTERS.charAt(q.order.indexOf(i)); }).join("   ");
    }
    const a = (q.problem.answer || []).filter(Boolean);
    return a.length ? String(a[0]).replace(/(\d)\.(\d)/g, "$1,$2") : "";
  }

  // ----- drawing -----
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function rich(node, text) {
    if (window.GaussicaText) window.GaussicaText.set(node, text); else node.textContent = text;
    return node;
  }

  function workSpace(kind) {
    if (kind === "lines") {
      const box = el("div", "ws-lines");
      for (let i = 0; i < 3; i++) box.appendChild(el("div", "ws-line"));
      return box;
    }
    if (kind === "grid") {
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "ws-grid");
      svg.setAttribute("viewBox", "0 0 400 80");
      svg.setAttribute("preserveAspectRatio", "none");
      for (let x = 0; x <= 400; x += 20) { const l = document.createElementNS(NS, "line"); l.setAttribute("x1", x); l.setAttribute("x2", x); l.setAttribute("y1", 0); l.setAttribute("y2", 80); svg.appendChild(l); }
      for (let y = 0; y <= 80; y += 20) { const l = document.createElementNS(NS, "line"); l.setAttribute("x1", 0); l.setAttribute("x2", 400); l.setAttribute("y1", y); l.setAttribute("y2", y); svg.appendChild(l); }
      return svg;
    }
    return null;
  }

  function drawQuestion(q, opts) {
    const box = el("li", "ws-q");
    box.value = q.number;
    const p = q.problem;
    const prompt = rich(el("p", "ws-prompt"), p.prompt || "");
    box.appendChild(prompt);
    if (opts.renderVisuals) {
      const vis = el("div", "ws-visual");
      opts.renderVisuals(vis, p);
      if (vis.childNodes.length) box.appendChild(vis);
    }
    if (q.kind === "statements") {
      const ol = el("ol", "ws-statements");
      p.statements.forEach(function (s, i) {
        const li = el("li");
        li.appendChild(rich(el("span", "ws-st"), (i + 1) + ". " + s.text));
        li.appendChild(el("span", "ws-tf", "☐ Sant   ☐ Falskt"));
        ol.appendChild(li);
      });
      box.appendChild(ol);
    } else if (q.kind === "pairs") {
      const board = el("div", "ws-pairs");
      const left = el("ol", "ws-terms");
      p.pairs.forEach(function (x) { left.appendChild(el("li", "", x.term + "   ______")); });
      const right = el("ul", "ws-defs");
      q.order.forEach(function (i, pos) { right.appendChild(rich(el("li"), LETTERS.charAt(pos) + ". " + p.pairs[i].definition)); });
      board.append(left, right);
      box.appendChild(board);
    } else {
      box.appendChild(el("p", "ws-answer", "Svar: ____________________"));
      const space = workSpace(opts.space);
      if (space) box.appendChild(space);
    }
    return box;
  }

  function drawSheet(sheet, opts, index) {
    const page = el("article", "ws-sheet");
    const head = el("header", "ws-head");
    const titles = sheet.sections.map(function (s) { return s.lesson.title; });
    head.append(el("p", "ws-brand", "Gaussica · Arbetsblad"), el("h1", "", titles.length === 1 ? titles[0] : "Blandade uppgifter"));
    if (titles.length > 1) head.appendChild(el("p", "ws-sub", titles.join(" · ")));
    if (sheet.label) head.appendChild(el("p", "ws-sub", sheet.label));
    const who = el("p", "ws-who");
    who.appendChild(document.createTextNode("Namn: "));
    who.appendChild(el("span", "ws-fill", sheet.name || ""));
    who.appendChild(document.createTextNode("      Datum: ______________"));
    head.appendChild(who);
    page.appendChild(head);
    sheet.sections.forEach(function (section) {
      if (sheet.sections.length > 1) page.appendChild(el("h2", "ws-section", section.lesson.title));
      const list = el("ol", "ws-list");
      section.questions.forEach(function (q) { list.appendChild(drawQuestion(q, opts)); });
      if (!section.questions.length) list.appendChild(el("li", "ws-q", "Den här lektionen har inga uppgifter att skapa blad av."));
      page.appendChild(list);
    });
    return page;
  }

  function drawKey(result) {
    const page = el("article", "ws-sheet ws-key");
    const head = el("header", "ws-head");
    head.append(el("p", "ws-brand", "Gaussica · Facit"), el("h1", "", "Facit"));
    page.appendChild(head);
    result.sheets.forEach(function (sheet) {
      if (result.sheets.length > 1) page.appendChild(el("h2", "ws-section", sheet.name || sheet.label || "Blad"));
      const list = el("ol", "ws-keylist");
      sheet.sections.forEach(function (section) {
        section.questions.forEach(function (q) {
          const li = el("li");
          li.value = q.number;
          li.appendChild(rich(el("span"), answerText(q)));
          list.appendChild(li);
        });
      });
      page.appendChild(list);
    });
    return page;
  }

  function close() {
    const o = document.getElementById("ws-overlay");
    if (o) o.remove();
    document.body.classList.remove("is-printing-worksheet");
  }

  function show(result, opts) {
    close();
    const overlay = el("div", "ws-overlay");
    overlay.id = "ws-overlay";
    const bar = el("div", "ws-bar");
    const print = el("button", "tv-btn is-primary", "🖨 Skriv ut eller spara som PDF");
    print.type = "button";
    print.addEventListener("click", function () { window.print(); });
    const closeBtn = el("button", "tv-btn", "Stäng");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", close);
    const questions = result.sheets.reduce(function (n, s) { return n + s.sections.reduce(function (m, x) { return m + x.questions.length; }, 0); }, 0);
    bar.append(print, closeBtn, el("span", "tv-muted", result.sheets.length + " blad, " + questions + " frågor" + (opts.key ? ", facit sist" : "") + ". Välj Spara som PDF i utskriftsrutan om du vill ha en fil."));
    overlay.appendChild(bar);
    result.sheets.forEach(function (sheet, i) { overlay.appendChild(drawSheet(sheet, opts, i)); });
    if (opts.key) overlay.appendChild(drawKey(result));
    document.body.appendChild(overlay);
    document.body.classList.add("is-printing-worksheet");
    overlay.scrollTop = 0;
  }

  // ----- the form in the teacher view -----
  function section(ctx) {
    const box = el("details", "admin-card-section tv-section tv-ws");
    const summary = el("summary", "tv-ws-sum");
    summary.appendChild(el("h3", "", "🖨 Arbetsblad"));
    box.appendChild(summary);
    box.appendChild(el("p", "admin-card-description", "Skapa ett blad med nya uppgifter att skriva ut, med facit. Uppgifterna skapas av lektionernas övningsmallar, så varje blad kan få andra tal. Ett blad per elev i klassen går bra: alla får olika tal, och facit har alla svar."));

    const form = el("form", "tv-ws-form");
    const L = window.GaussicaLesson;
    const all = ctx.course.lessons.filter(function (l) { return !l.isParentLesson; });
    const choices = all.map(function (l, i) { return { l: l, grade: L ? L.effectiveGrade(l, ctx.course.lessons) : l.grade, i: i }; })
      .sort(function (a, b) { return a.grade - b.grade || a.i - b.i; });

    // the lessons: a search box and a list with a check box for each
    const search = el("input", "tv-ws-search");
    search.type = "search";
    search.placeholder = "Sök lektion…";
    search.setAttribute("aria-label", "Sök lektion");
    const list = el("div", "tv-ws-lessons");
    const boxes = [];
    choices.forEach(function (c) {
      const row = el("label", "tv-ws-lesson");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = c.l.id;
      const hasTemplates = window.GaussicaPractice && window.GaussicaPractice.has(c.l);
      row.append(cb, el("span", "", c.l.title), el("small", "tv-muted", " åk " + c.grade + (hasTemplates ? "" : " · fasta frågor")));
      row.dataset.text = (c.l.title + " " + c.l.id).toLowerCase();
      list.appendChild(row);
      boxes.push({ cb: cb, row: row, lesson: c.l });
      cb.addEventListener("change", updateCount);
    });
    search.addEventListener("input", function () {
      const q = search.value.trim().toLowerCase();
      boxes.forEach(function (b) { b.row.hidden = Boolean(q) && b.row.dataset.text.indexOf(q) < 0; });
    });

    const count = el("p", "tv-muted tv-ws-count");
    const perLesson = el("select");
    [3, 4, 5, 6, 8, 10, 12, 15].forEach(function (n) { const o = el("option", "", n + " uppgifter per lektion"); o.value = String(n); perLesson.appendChild(o); });
    perLesson.value = "6";
    perLesson.addEventListener("change", updateCount);

    const mode = el("select");
    [["one", "Ett blad (till alla)"], ["class", "Ett blad per elev i klassen (olika tal)"], ["variants", "Flera varianter med olika tal"]].forEach(function (m) { const o = el("option", "", m[1]); o.value = m[0]; mode.appendChild(o); });
    const classSel = el("select");
    (ctx.classes || []).forEach(function (c) { const o = el("option", "", c.name); o.value = String(c.id); classSel.appendChild(o); });
    const variants = el("select");
    [2, 3, 4, 5, 6, 10, 15, 20, 30].forEach(function (n) { const o = el("option", "", n + " varianter"); o.value = String(n); variants.appendChild(o); });
    const spaceSel = el("select");
    [["grid", "Rutor för uträkning"], ["lines", "Linjer för uträkning"], ["none", "Ingen plats för uträkning"]].forEach(function (m) { const o = el("option", "", m[1]); o.value = m[0]; spaceSel.appendChild(o); });
    const keyBox = document.createElement("input");
    keyBox.type = "checkbox";
    keyBox.checked = true;
    const keyLabel = el("label", "tv-ws-check");
    keyLabel.append(keyBox, el("span", "", "Facit på sista sidan"));

    const error = el("p", "tv-compose-error");
    error.hidden = true;
    const go = el("button", "tv-btn is-primary", "Skapa arbetsblad");
    go.type = "submit";

    const field = function (label, control) { const w = el("label", "tv-field"); w.append(el("span", "", label), control); return w; };
    const syncMode = function () { classSel.parentNode.hidden = mode.value !== "class"; variants.parentNode.hidden = mode.value !== "variants"; };
    mode.addEventListener("change", syncMode);

    function chosen() { return boxes.filter(function (b) { return b.cb.checked; }).map(function (b) { return b.lesson; }); }
    function updateCount() {
      const n = chosen().length * Number(perLesson.value);
      count.textContent = chosen().length ? chosen().length + " lektioner valda, ungefär " + n + " uppgifter på varje blad." : "Välj en eller flera lektioner.";
    }
    updateCount();

    form.append(
      field("Lektioner", el("div", "tv-ws-pick")),
      field("Antal", perLesson), field("Blad", mode), field("Klass", classSel), field("Antal varianter", variants), field("Plats för uträkning", spaceSel), keyLabel, error, go);
    form.querySelector(".tv-ws-pick").append(search, list, count);
    syncMode();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const lessons = chosen();
      if (!lessons.length) { error.textContent = "Välj minst en lektion."; error.hidden = false; return; }
      let names = [""];
      if (mode.value === "class") {
        names = (ctx.students || []).filter(function (s) { return String(s.classId) === classSel.value; }).map(function (s) { return s.name; }).sort(function (a, b) { return a.localeCompare(b, "sv"); });
        if (!names.length) { error.textContent = "Klassen har inga elever än. Välj ett blad till alla i stället."; error.hidden = false; return; }
      } else if (mode.value === "variants") {
        names = []; for (let i = 0; i < Number(variants.value); i++) names.push("");
      }
      error.hidden = true;
      const result = build({ lessons: lessons, perLesson: Number(perLesson.value), names: names });
      if (names.length > 1 && mode.value === "variants") result.sheets.forEach(function (s, i) { s.name = ""; s.label = "Variant " + (i + 1); });
      show(result, { key: keyBox.checked, space: spaceSel.value === "none" ? null : spaceSel.value, renderVisuals: ctx.renderVisuals });
    });
    box.appendChild(form);
    return box;
  }

  return { build: build, section: section, answerText: answerText, close: close };
}());
