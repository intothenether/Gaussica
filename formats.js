// New formats for the questions of a lesson, besides typing an answer, matching and true/false:
//
//   sortera      Sortera: put each item in the group it belongs to (jämna eller udda, primtal eller inte).
//                { type: "sortera", prompt, categories: ["Jämna", "Udda"], items: [{ text, category: 0 | "Jämna", explain? }], shuffle? }
//   ordna        Ordna: put things in the right order with the arrows (smallest first, the steps of a method).
//                { type: "ordna", prompt, items: ["0,05", "0,5", ...] in the right order, top?: "Minst", bottom?: "Störst" }
//   hittafelet   Hitta felet: a worked solution with one step that is wrong. The student marks it.
//                { type: "hittafelet", prompt, steps: ["...", ...], wrong: 1 (the number of the step, from 0), explain, fix?, hint? }
//   lucktext     Fyll i luckorna: a text with gaps, written or chosen.
//                { type: "lucktext", prompt, text: "En triangel har {1} hörn.", blanks: [{ answer: ["3", "tre"], options?: [...], hint? }] }
//
// Each one is a task like the others: it is checked with "Kolla svaret", counts when it is solved, tells how many are right (and,
// after a second try, which ones are wrong), and nothing is lost by trying again. The lesson model (lesson-model.js) turns the
// components into tasks with the ids so-<n>, or-<n>, hf-<n> and lt-<n>; this file draws them and holds the checking, which is
// plain functions that are tested in tests/formats.js.
//
//   GaussicaFormats.render(parent, problem, ctx)   draws a task. ctx = { labelText, headingId, saved, text(node, string), store(...), finish(ok), listen(fn) }
//   GaussicaFormats.check*(...)                    the checking
//   GaussicaFormats.problems(component)            what is wrong with a component (for the tests and the editor), as a list of texts

window.GaussicaFormats = (function () {
  "use strict";

  const NAMES = { sortera: "Sortera", ordna: "Ordna", hittafelet: "Hitta felet", lucktext: "Fyll i luckorna" };

  // ===== the checking (pure) =====

  // the category of an item as a number, whether it was written as a number or as the name of the category
  function categoryIndex(problem, item) {
    const cats = problem.categories || [];
    if (typeof item.category === "number") return item.category;
    const i = cats.map(String).indexOf(String(item.category));
    return i;
  }

  // choices: the chosen category (a number) of each item, or null. Returns the numbers of the items that are in the wrong group.
  function checkSort(problem, choices) {
    const wrong = [];
    (problem.items || []).forEach(function (it, i) { if (choices[i] !== categoryIndex(problem, it)) wrong.push(i); });
    return wrong;
  }

  // The order to start from: the items mixed up, but never already in the right order. `seed` makes it the same every time for the same
  // task, so that a page that is drawn again does not mix them up again.
  function startOrder(n, seed) {
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    if (n < 2) return order;
    let s = 0;
    String(seed || "").split("").forEach(function (ch) { s = (s * 31 + ch.charCodeAt(0)) >>> 0; });
    s = s || 1;
    const rnd = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let tries = 0; tries < 20; tries++) {
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
      if (order.some(function (v, i) { return v !== i; })) return order;
    }
    return order.slice(1).concat(order.slice(0, 1));   // a turn, never the right order
  }

  // order: the item (its number in the right order) that stands at each place. Returns the places that are wrong.
  function checkOrder(problem, order) {
    const wrong = [];
    (problem.items || []).forEach(function (it, pos) { if (order[pos] !== pos) wrong.push(pos); });
    return wrong;
  }

  // Moving an item one step up (-1) or down (1) in the list: a new list, or the same one when it cannot be moved.
  function move(order, pos, dir) {
    const to = pos + dir;
    if (to < 0 || to >= order.length) return order;
    const next = order.slice();
    next[pos] = order[to];
    next[to] = order[pos];
    return next;
  }

  // the picked step of "hitta felet" is right when it is the one
  function checkFind(problem, picked) { return picked === problem.wrong; }

  // how a written answer is compared: capital letters, spaces at the ends and a comma or a point for decimals do not matter
  function norm(s) {
    return String(s === undefined || s === null ? "" : s).trim().toLowerCase().replace(/\s+/g, " ").replace(/,/g, ".").replace(/\.$/, "");
  }

  function fillRight(blank, value) {
    const v = norm(value);
    return v !== "" && (blank.answer || []).some(function (a) { return norm(a) === v; });
  }

  // values: what is in each gap. Returns the numbers of the gaps that are wrong (an empty gap is wrong).
  function checkFill(problem, values) {
    const wrong = [];
    (problem.blanks || []).forEach(function (b, i) { if (!fillRight(b, values[i])) wrong.push(i); });
    return wrong;
  }

  // The text of "lucktext" cut into pieces: { text } and { blank: n } (from 0). {1} is the first gap.
  function segments(text) {
    const out = [];
    let last = 0;
    String(text || "").replace(/\{(\d+)\}/g, function (m, n, at) {
      if (at > last) out.push({ text: text.slice(last, at) });
      out.push({ blank: Number(n) - 1 });
      last = at + m.length;
      return m;
    });
    if (last < String(text || "").length) out.push({ text: text.slice(last) });
    return out;
  }

  // The task in words, for the chat and the hints of the teacher (what the question was about).
  function summary(problem) {
    if (problem.format === "sortera") return "Grupper: " + (problem.categories || []).join(", ") + ". " + (problem.items || []).map(function (it, i) { return (i + 1) + ". " + it.text; }).join("  ");
    if (problem.format === "ordna") return "Ordna: " + (problem.items || []).join(", ");
    if (problem.format === "hittafelet") return (problem.steps || []).map(function (s, i) { return "Steg " + (i + 1) + ": " + s; }).join("  ");
    if (problem.format === "lucktext") return String(problem.text || "").replace(/\{(\d+)\}/g, "___");
    return "";
  }

  // What is wrong with a component, as a list of texts (empty when it is fine).
  function problems(c) {
    const out = [];
    const text = function (x) { return typeof x === "string" ? x.trim() : (x && typeof x.text === "string" ? x.text.trim() : ""); };
    if (!c || !NAMES[c.type]) return ["okänt format"];
    if (c.type === "sortera") {
      if (!Array.isArray(c.categories) || c.categories.length < 2 || c.categories.length > 4) out.push("sortera behöver två till fyra grupper");
      else if (c.categories.some(function (x) { return !String(x).trim(); })) out.push("en grupp har inget namn");
      if (!Array.isArray(c.items) || c.items.length < 2) out.push("sortera behöver minst två saker");
      else {
        c.items.forEach(function (it, i) {
          if (!text(it)) out.push("sak " + (i + 1) + " har ingen text");
          const k = categoryIndex(c, it || {});
          if (!(k >= 0 && k < (c.categories || []).length)) out.push("sak " + (i + 1) + " hör till en grupp som inte finns");
        });
        if (Array.isArray(c.categories) && c.categories.length >= 2) {
          const used = new Set(c.items.map(function (it) { return categoryIndex(c, it || {}); }));
          if (used.size < 2) out.push("alla saker hör till samma grupp, så det går att gissa");
        }
      }
    }
    if (c.type === "ordna") {
      if (!Array.isArray(c.items) || c.items.length < 3 || c.items.length > 8) out.push("ordna behöver tre till åtta saker");
      else {
        c.items.forEach(function (it, i) { if (!text(it)) out.push("sak " + (i + 1) + " har ingen text"); });
        if (new Set(c.items.map(function (it) { return norm(text(it)); })).size !== c.items.length) out.push("två saker är lika, så det finns två rätta ordningar");
      }
    }
    if (c.type === "hittafelet") {
      if (!Array.isArray(c.steps) || c.steps.length < 3 || c.steps.length > 8) out.push("hitta felet behöver tre till åtta steg");
      else {
        c.steps.forEach(function (s, i) { if (!text(s)) out.push("steg " + (i + 1) + " har ingen text"); });
        if (!(Number.isInteger(c.wrong) && c.wrong >= 0 && c.wrong < c.steps.length)) out.push("wrong måste vara numret på det felaktiga steget (från 0)");
      }
      if (!text(c.explain)) out.push("förklaringen av felet saknas (explain)");
    }
    if (c.type === "lucktext") {
      if (!text(c.text)) out.push("texten saknas");
      const nums = (String(c.text || "").match(/\{(\d+)\}/g) || []).map(function (m) { return Number(m.slice(1, -1)); });
      if (!Array.isArray(c.blanks) || !c.blanks.length) out.push("lucktext behöver minst en lucka");
      else {
        const sorted = nums.slice().sort(function (a, b) { return a - b; });
        if (sorted.join() !== c.blanks.map(function (b, i) { return i + 1; }).join()) out.push("luckorna i texten ({1}, {2} ...) och i blanks är inte lika många eller är fel numrerade");
        c.blanks.forEach(function (b, i) {
          if (!b || !Array.isArray(b.answer) || !b.answer.length || b.answer.some(function (a) { return !String(a).trim(); })) out.push("lucka " + (i + 1) + " har inget rätt svar");
          else if (b.options !== undefined) {
            if (!Array.isArray(b.options) || b.options.length < 2) out.push("lucka " + (i + 1) + ": options behöver minst två val");
            else if (!b.answer.some(function (a) { return b.options.map(norm).indexOf(norm(a)) >= 0; })) out.push("lucka " + (i + 1) + ": det rätta svaret finns inte bland valen");
          }
        });
      }
    }
    return out;
  }

  // ===== drawing =====
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  // the frame that all the formats share: the label, the question, the help text, the check button and the message
  function frame(parent, problem, ctx, kind, help) {
    const section = el("section", "exercise word-problem fm-exercise fm-" + kind);
    if (ctx.headingId) section.setAttribute("aria-labelledby", ctx.headingId);
    const heading = el("h3", "");
    if (window.GaussicaText) window.GaussicaText.set(heading, problem.prompt); else heading.textContent = problem.prompt;   // powers and fractions as on paper
    if (ctx.headingId) heading.id = ctx.headingId;
    section.append(el("p", "eyebrow", ctx.labelText || NAMES[kind].toUpperCase()), heading);
    const listen = ctx.listen ? ctx.listen(function () { return problem.prompt + " " + summary(problem); }) : null;
    if (listen) section.appendChild(listen);
    section.appendChild(el("p", "match-help", help));
    const check = button("Kolla svaret", "primary-button answer-button fm-check");
    const message = el("p", "feedback-message", "");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    const say = function (type, text) {
      message.className = "feedback-message" + (type ? " feedback-" + type : "");
      if (text && ctx.text) ctx.text(message, text); else message.textContent = text || "";
    };
    return { section: section, check: check, message: message, say: say, mount: function (body) { section.append(body, check, message); parent.appendChild(section); } };
  }

  function promptText(problem) { return problem.prompt + " " + summary(problem); }

  // ----- sortera -----
  function renderSort(parent, problem, ctx) {
    const cats = problem.categories;
    const items = problem.items;
    const f = frame(parent, problem, ctx, "sortera", "Välj en grupp för varje sak och tryck på Kolla svaret.");
    const choices = items.map(function () { return null; });
    const list = el("ol", "fm-list");
    const rows = [];
    let fails = 0, solved = false;
    const order = problem.shuffle === false ? items.map(function (x, i) { return i; }) : startOrder(items.length, problem.prompt);
    const paint = function (i) {
      rows[i].buttons.forEach(function (b, k) { b.setAttribute("aria-pressed", String(choices[i] === k)); b.classList.toggle("is-chosen", choices[i] === k); });
    };
    const update = function () { f.check.disabled = solved || choices.some(function (c) { return c === null; }); };
    const lock = function () {
      solved = true;
      rows.forEach(function (r, i) {
        choices[i] = categoryIndex(problem, items[i]);
        r.buttons.forEach(function (b) { b.disabled = true; });
        r.li.classList.remove("is-wrong");
        r.li.classList.add("is-right");
        paint(i);
        if (items[i].explain && !r.li.querySelector(".tf-explain")) { const ex = el("p", "tf-explain"); if (ctx.text) ctx.text(ex, items[i].explain); else ex.textContent = items[i].explain; r.li.appendChild(ex); }
      });
      f.check.hidden = true;
      f.say("correct", problem.correct);
    };
    order.forEach(function (i, pos) {
      const li = el("li", "fm-row");
      const text = el("p", "fm-item");
      text.appendChild(el("span", "tf-no", String(pos + 1)));
      const body = el("span", "tf-body");
      if (ctx.text) ctx.text(body, items[i].text); else body.textContent = items[i].text;
      text.appendChild(body);
      const group = el("div", "fm-choices");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Grupp för sak " + (pos + 1));
      const bs = cats.map(function (c, k) {
        const b = button(String(c), "fm-choice", function () {
          if (solved) return;
          choices[i] = choices[i] === k ? null : k;
          li.classList.remove("is-wrong");
          f.say("", "");
          paint(i);
          update();
        });
        b.setAttribute("aria-pressed", "false");
        group.appendChild(b);
        return b;
      });
      li.append(text, group);
      list.appendChild(li);
      rows[i] = { li: li, buttons: bs };
    });
    f.check.addEventListener("click", function () {
      if (solved || choices.some(function (c) { return c === null; })) return;
      const wrong = checkSort(problem, choices);
      const answerText = choices.map(function (c, i) { return (i + 1) + ": " + cats[c]; }).join(" · ");
      if (!wrong.length) { lock(); ctx.store(answerText, problem.correct, "correct", true, null, promptText(problem)); ctx.finish(true); return; }
      fails += 1;
      const note = (items.length - wrong.length) + " av " + items.length + " ligger rätt. Titta en gång till på dem du är osäker på och flytta dem som hamnat fel.";
      rows.forEach(function (r, i) { r.li.classList.toggle("is-wrong", fails >= 2 && wrong.indexOf(i) >= 0); });
      f.say("hint", fails >= 2 ? note + " De markerade ligger fel." : note);
      const shown = wrong.slice(0, 2).map(function (i) { return "”" + items[i].text + "”"; }).join(" och ");
      ctx.store(answerText, note, "hint", false, "Fel grupp för " + shown, promptText(problem));
      ctx.finish(false);
    });
    f.mount(list);
    items.forEach(function (x, i) { paint(i); });
    update();
    if (ctx.saved && ctx.saved.completed) lock();
  }

  // ----- ordna -----
  function renderOrder(parent, problem, ctx) {
    const items = problem.items;
    const f = frame(parent, problem, ctx, "ordna", "Flytta med pilarna tills allt står i rätt ordning, och tryck på Kolla svaret." + (problem.top && problem.bottom ? " Överst: " + problem.top.toLowerCase() + ". Underst: " + problem.bottom.toLowerCase() + "." : ""));
    let order = startOrder(items.length, problem.prompt);
    let fails = 0, solved = false, wrong = [];
    const list = el("ol", "fm-list fm-order");
    const draw = function (focusPos, which) {
      list.replaceChildren();
      order.forEach(function (item, pos) {
        const li = el("li", "fm-row fm-orow" + (solved ? " is-right" : wrong.indexOf(pos) >= 0 ? " is-wrong" : ""));
        const text = el("p", "fm-item");
        text.appendChild(el("span", "tf-no", String(pos + 1)));
        const body = el("span", "tf-body");
        if (ctx.text) ctx.text(body, items[item]); else body.textContent = items[item];
        text.appendChild(body);
        const arrows = el("div", "fm-arrows");
        // the arrow that was pressed keeps the focus on the item as it moves, so that it can be pressed again
        const up = button("▲", "fm-arrow", function () { order = move(order, pos, -1); wrong = []; f.say("", ""); draw(pos - 1, "up"); });
        const down = button("▼", "fm-arrow", function () { order = move(order, pos, 1); wrong = []; f.say("", ""); draw(pos + 1, "down"); });
        up.setAttribute("aria-label", "Flytta upp: " + items[item]);
        down.setAttribute("aria-label", "Flytta ned: " + items[item]);
        up.disabled = solved || pos === 0;
        down.disabled = solved || pos === order.length - 1;
        arrows.append(up, down);
        li.append(text, arrows);
        list.appendChild(li);
        if (focusPos === pos) { const target = which === "up" ? (up.disabled ? down : up) : (down.disabled ? up : down); if (!target.disabled) target.focus(); }
      });
    };
    f.check.addEventListener("click", function () {
      if (solved) return;
      const bad = checkOrder(problem, order);
      const answerText = order.map(function (i) { return items[i]; }).join(" → ");
      if (!bad.length) {
        solved = true; wrong = []; f.check.hidden = true; draw();
        f.say("correct", problem.correct);
        ctx.store(answerText, problem.correct, "correct", true, null, promptText(problem));
        ctx.finish(true);
        return;
      }
      fails += 1;
      const note = (items.length - bad.length) + " av " + items.length + " står på rätt plats. Flytta de som du tror är fel och prova igen.";
      wrong = fails >= 2 ? bad : [];
      draw();
      f.say("hint", fails >= 2 ? note + " De markerade står fel." : note);
      ctx.store(answerText, note, "hint", false, "Fel ordning", promptText(problem));
      ctx.finish(false);
    });
    f.mount(list);
    if (ctx.saved && ctx.saved.completed) { order = items.map(function (x, i) { return i; }); solved = true; f.check.hidden = true; f.say("correct", problem.correct); }
    draw();
  }

  // ----- hitta felet -----
  function renderFind(parent, problem, ctx) {
    const steps = problem.steps;
    const f = frame(parent, problem, ctx, "hittafelet", "Läs stegen och tryck på det steg där felet finns. Tryck sedan på Kolla svaret.");
    let picked = null, fails = 0, solved = false;
    const list = el("ol", "fm-list fm-steps");
    const rows = steps.map(function (s, i) {
      const li = el("li", "fm-step");
      const b = button("", "fm-stepbtn", function () {
        if (solved) return;
        picked = picked === i ? null : i;
        rows.forEach(function (r, k) { r.b.setAttribute("aria-pressed", String(picked === k)); r.li.classList.toggle("is-picked", picked === k); r.li.classList.remove("is-wrong"); });
        f.say("", "");
        f.check.disabled = picked === null;
      });
      b.setAttribute("aria-pressed", "false");
      b.appendChild(el("span", "tf-no", String(i + 1)));
      const body = el("span", "tf-body");
      if (ctx.text) ctx.text(body, s); else body.textContent = s;
      b.appendChild(body);
      li.appendChild(b);
      list.appendChild(li);
      return { li: li, b: b };
    });
    const lock = function () {
      solved = true;
      rows.forEach(function (r, i) {
        r.b.disabled = true;
        r.li.classList.remove("is-picked");
        r.li.classList.toggle("is-error", i === problem.wrong);
      });
      if (!list.querySelector(".fm-explain")) {
        const ex = el("div", "fm-explain");
        const why = el("p", "");
        if (ctx.text) ctx.text(why, "Här är felet: " + problem.explain); else why.textContent = "Här är felet: " + problem.explain;
        ex.appendChild(why);
        if (problem.fix) { const fx = el("p", "fm-fix"); if (ctx.text) ctx.text(fx, "Rätt blir: " + problem.fix); else fx.textContent = "Rätt blir: " + problem.fix; ex.appendChild(fx); }
        list.appendChild(ex);
      }
      f.check.hidden = true;
      f.say("correct", problem.correct);
    };
    f.check.addEventListener("click", function () {
      if (solved || picked === null) return;
      const answerText = "Steg " + (picked + 1);
      if (checkFind(problem, picked)) { lock(); ctx.store(answerText, problem.correct, "correct", true, null, promptText(problem)); ctx.finish(true); return; }
      fails += 1;
      const note = "Steg " + (picked + 1) + " stämmer. Räkna det steget själv och se om du får samma sak. Vilket steg blir fel?";
      const hint = fails >= 2 && problem.hint ? " Tips: " + problem.hint : "";
      rows[picked].li.classList.add("is-wrong");
      f.say("hint", note + hint);
      ctx.store(answerText, note + hint, "hint", false, "Pekade på ett steg som var rätt", promptText(problem));
      ctx.finish(false);
    });
    f.mount(list);
    f.check.disabled = true;
    if (ctx.saved && ctx.saved.completed) lock();
  }

  // ----- lucktext -----
  function renderFill(parent, problem, ctx) {
    const blanks = problem.blanks;
    const f = frame(parent, problem, ctx, "lucktext", "Fyll i varje lucka och tryck på Kolla svaret.");
    const fields = [];
    let fails = 0, solved = false;
    const para = el("p", "fm-text");
    segments(problem.text).forEach(function (seg) {
      if (seg.blank === undefined) { para.appendChild(document.createTextNode(seg.text)); return; }
      const b = blanks[seg.blank];
      if (!b) return;
      let input;
      if (Array.isArray(b.options) && b.options.length) {
        input = document.createElement("select");
        input.appendChild(el("option", "", "välj…"));
        input.firstChild.value = "";
        b.options.forEach(function (o) { const op = el("option", "", String(o)); op.value = String(o); input.appendChild(op); });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.autocomplete = "off";
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("spellcheck", "false");
        const len = Math.max.apply(null, (b.answer || [""]).map(function (a) { return String(a).length; }));
        input.size = Math.max(3, Math.min(14, len + 2));
      }
      input.className = "fm-gap";
      input.setAttribute("aria-label", "Lucka " + (seg.blank + 1));
      input.addEventListener("input", function () { input.classList.remove("is-wrong"); f.say("", ""); update(); });
      input.addEventListener("change", function () { input.classList.remove("is-wrong"); update(); });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); f.check.click(); } });
      fields[seg.blank] = input;
      para.appendChild(input);
    });
    const values = function () { return blanks.map(function (b, i) { return fields[i] ? fields[i].value : ""; }); };
    const update = function () { f.check.disabled = solved || values().some(function (v) { return norm(v) === ""; }); };
    const lock = function () {
      solved = true;
      blanks.forEach(function (b, i) { if (fields[i]) { fields[i].value = String(b.answer[0]); fields[i].disabled = true; fields[i].classList.remove("is-wrong"); fields[i].classList.add("is-right"); } });
      f.check.hidden = true;
      f.say("correct", problem.correct);
    };
    f.check.addEventListener("click", function () {
      if (solved) return;
      const vals = values();
      if (vals.some(function (v) { return norm(v) === ""; })) return;
      const wrong = checkFill(problem, vals);
      const answerText = vals.join(" · ");
      if (!wrong.length) { lock(); ctx.store(answerText, problem.correct, "correct", true, null, promptText(problem)); ctx.finish(true); return; }
      fails += 1;
      wrong.forEach(function (i) { if (fields[i]) fields[i].classList.add("is-wrong"); });
      const hints = fails >= 2 ? wrong.map(function (i) { return blanks[i].hint; }).filter(Boolean) : [];
      const note = (blanks.length - wrong.length) + " av " + blanks.length + " luckor är rätt. De röda är fel, ändra dem och prova igen." + (hints.length ? " Tips: " + hints.join(" ") : "");
      f.say("hint", note);
      ctx.store(answerText, note, "hint", false, "Fel i " + (wrong.length === 1 ? "en lucka" : wrong.length + " luckor"), promptText(problem));
      ctx.finish(false);
    });
    f.mount(para);
    update();
    if (ctx.saved && ctx.saved.completed) lock();
  }

  // Draws the task of the format that the problem has (problem.format).
  function render(parent, problem, ctx) {
    if (problem.format === "sortera") return renderSort(parent, problem, ctx);
    if (problem.format === "ordna") return renderOrder(parent, problem, ctx);
    if (problem.format === "hittafelet") return renderFind(parent, problem, ctx);
    if (problem.format === "lucktext") return renderFill(parent, problem, ctx);
    return null;
  }

  return {
    NAMES: NAMES, render: render, problems: problems, summary: summary, segments: segments, norm: norm, categoryIndex: categoryIndex,
    checkSort: checkSort, checkOrder: checkOrder, checkFind: checkFind, checkFill: checkFill, startOrder: startOrder, move: move
  };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaFormats;
