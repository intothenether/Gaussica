// "Din väg": a short, friendly path instead of the big graph. It shows what to do now, what comes after
// and one play lesson, as large cards with one clear button each.
//
//   GaussicaPathView.heroStep(container, data, hooks)   the step of the day as a card in the hero of the start page
//   GaussicaPathView.render(container, data, hooks)
//     data  = GaussicaCoach.path(...)  { now, later[], play, doneCount, total, allDone }
//     hooks = { start(lessonId), more(lessonId), review(), assignment (open assignment or null), reviewLessons: [],
//               placementTest() (opens "Hitta din nivå"; leave out to hide the offer) }

window.GaussicaPathView = (function () {
  "use strict";

  const ICONS = {
    tal: { glyph: "123", color: "#425b9a" },
    algebra: { glyph: "x", color: "#8a74c9" },
    geometri: { glyph: "△", color: "#e0506d" },
    matning: { glyph: "cm", color: "#d98a1f" },
    data: { glyph: "▥", color: "#2f9d88" }
  };

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function icon(item) {
    const lesson = item.lesson;
    const i = el("span", "pv-icon" + (lesson.kind === "pyssel" ? " is-play" : ""));
    i.setAttribute("aria-hidden", "true");
    if (lesson.kind === "pyssel") {
      i.textContent = "✨";
    } else if (lesson.kind === "begrepp") {
      i.textContent = "Aa";
      i.style.color = "#7a56c7";
    } else {
      const ic = ICONS[lesson.area] || ICONS.tal;
      i.textContent = ic.glyph;
      i.style.color = ic.color;
    }
    return i;
  }

  function kicker(item, hooks) {
    if (item.role === "play") return item.kind === "going" ? "✨ PYSSLA · DU HAR PÅBÖRJAT" : "✨ PYSSLA";
    if (item.role === "later") return item.kind === "going" ? "SEN · DU HAR PÅBÖRJAT" : "SEN";
    if (item.kind === "assignment") {
      const t = hooks.assignment && hooks.assignment.a.teacher;
      return "NU · 📌 UPPDRAG" + (t ? " FRÅN " + t.toUpperCase() : "");
    }
    return item.kind === "continue" ? "NU · FORTSÄTT DÄR DU SLUTADE" : "NU · BÖRJA HÄR";
  }

  // The year of a lesson, shown clearly: "ÅK 7", with how it compares to the student's own year when that is known.
  function gradeChip(item) {
    const chip = el("span", "pv-grade" + (item.gap >= 2 ? " is-high" : item.gap === 1 ? " is-up" : ""), window.GaussicaLesson.gradeLabel(item.grade));
    return chip;
  }

  function levelNote(item) {
    if (item.gap === null || item.gap === undefined || item.role === "play" || item.kind === "assignment") return null;
    const own = window.GaussicaLesson.gradeLabel(item.level).toLowerCase();
    if (item.gap >= 2) return "Det här ligger " + (item.gap === 2 ? "två" : item.gap === 3 ? "tre" : "flera") + " år över din nivå (du verkar vara på " + own + "). Det är bra att pröva något svårare, men det kan kännas tufft. Du kan alltid välja något lättare i kartan.";
    if (item.gap === 1) return "Ett steg över din nivå (du verkar vara på " + own + ").";
    return null;
  }

  function buttonLabel(item) {
    if (item.role === "play") return item.kind === "going" ? "Fortsätt pyssla →" : "Pyssla →";
    const begun = item.sum.done > 0 || item.sum.fix > 0;
    if (item.role === "later") return begun ? "Fortsätt →" : "Börja →";
    if (item.kind === "assignment") return begun ? "Fortsätt uppdraget →" : "Gör uppdraget →";
    return item.kind === "continue" ? "Fortsätt här →" : "Börja här →";
  }

  function card(item, number, hooks) {
    const li = el("li", "pv-step is-" + item.role);
    li.appendChild(el("span", "pv-dot", item.role === "play" ? "✦" : String(number)));
    const c = el("article", "pv-item");
    const row = el("div", "pv-row");
    row.appendChild(icon(item));
    const copy = el("div", "pv-copy");
    copy.appendChild(el("p", "pv-kicker", kicker(item, hooks)));
    const heading = el("h4", "pv-title", item.lesson.title);
    const metaRow = el("p", "pv-meta");
    metaRow.appendChild(gradeChip(item));
    const meta = [];
    if (item.sum.total) meta.push(item.sum.done + " av " + item.sum.total + " klara");
    if (item.sum.fix) meta.push(item.sum.fix + " att rätta");
    if (meta.length) metaRow.appendChild(document.createTextNode(" " + meta.join(" · ")));
    copy.append(heading, metaRow);
    const note = levelNote(item);
    if (note) copy.appendChild(el("p", "pv-level" + (item.gap >= 2 ? " is-high" : ""), note));
    if (item.role === "now" && item.lesson.summary) {
      const s = item.lesson.summary;
      copy.appendChild(el("p", "pv-summary", s.length > 130 ? s.slice(0, 127).replace(/\s+\S*$/, "") + "…" : s));
    }
    if (item.kind === "assignment" && hooks.assignment) {
      const due = window.GaussicaMailbox.dueInfo(hooks.assignment.a.dueDate);
      copy.appendChild(el("span", "mb-due is-" + due.tone, due.text));
    }
    row.appendChild(copy);
    c.appendChild(row);

    if (item.sum.total) {
      const bar = el("div", "mb-bar");
      item.sum.statuses.forEach(function (s) { bar.appendChild(el("span", "mb-seg is-" + s)); });
      c.appendChild(bar);
    }

    const actions = el("div", "pv-actions");
    const go = el("button", "primary-button pv-go", buttonLabel(item));
    go.type = "button";
    go.addEventListener("click", function () { hooks.start(item.lesson.id); });
    const more = el("button", "pv-more", "Mer om lektionen");
    more.type = "button";
    more.addEventListener("click", function () { hooks.more(item.lesson.id); });
    actions.append(go, more);
    c.appendChild(actions);
    li.appendChild(c);
    return li;
  }

  // "Hitta din nivå": a big offer to a student who has just begun, a small line otherwise
  function placementOffer(data, hooks) {
    const p = data.placement;
    const go = function (label, cls) {
      const b = el("button", cls, label);
      b.type = "button";
      b.addEventListener("click", hooks.placementTest);
      return b;
    };
    if (!p && data.doneCount < 3) {
      const box = el("div", "pv-placement");
      box.appendChild(el("span", "pv-emoji", "🎯"));
      const copy = el("div", "pv-placement-copy");
      copy.appendChild(el("h4", "pv-title", "Hitta din nivå"));
      copy.appendChild(el("p", "pv-sub", "Svara på några frågor, så hittar vi var du ska börja. Då slipper du börja med sådant du redan kan. Det tar ungefär 10 minuter."));
      box.append(copy, go("Starta nivåtestet →", "primary-button pv-go"));
      return box;
    }
    const row = el("p", "pv-placement-line");
    row.appendChild(document.createTextNode(p
      ? "🎯 Nivåtestet visade att du verkar kunna " + p.known + (p.known === 1 ? " lektion" : " lektioner") + " redan. "
      : "🎯 Vill du hitta din nivå? "));
    row.appendChild(go(p ? "Gör om testet" : "Gör nivåtestet", "pv-link"));
    return row;
  }

  function render(container, data, hooks) {
    container.replaceChildren();
    const root = el("div", "pv");

    const head = el("header", "pv-head");
    head.appendChild(el("span", "pv-emoji", "🧭"));
    const title = el("div");
    title.appendChild(el("h3", "pv-heading", "Din väg"));
    title.appendChild(el("p", "pv-sub", data.allDone
      ? "Du har klarat alla lektioner!"
      : "⭐ " + data.doneCount + " av " + data.total + " lektioner klara. Ta ett steg i taget."));
    head.appendChild(title);
    root.appendChild(head);
    if (hooks.placementTest) root.appendChild(placementOffer(data, hooks));

    if (data.allDone) {
      const done = el("div", "pv-alldone");
      done.append(el("span", "pv-emoji", "🎉"), el("p", "", "Pyssla eller repetera igen när du vill. Du kan också öppna hela kartan och välja själv."));
      root.appendChild(done);
    }

    // hooks.hideNow: the step of the day is shown in the hero (heroStep), so the path continues from step 2
    const skip = Boolean(hooks.hideNow && data.now);
    const steps = (skip ? [] : [data.now]).concat(data.later).filter(Boolean);
    const offset = skip ? 1 : 0;
    const list = el("ol", "pv-list");
    steps.forEach(function (item, i) { list.appendChild(card(item, i + 1 + offset, hooks)); });
    if (data.play) list.appendChild(card(data.play, steps.length + 1 + offset, hooks));
    if (list.children.length) root.appendChild(list);

    const weak = hooks.reviewLessons || [];
    const due = hooks.dueLessons || [];
    if (weak.length || due.length) {
      const row = el("div", "next-review");
      const text = el("p", "next-review-text");
      if (weak.length) {
        text.append(el("strong", "", "Repetera: "),
          document.createTextNode("du kan behöva öva mer på " + weak.slice(0, 3).map(function (r) { return r.lesson.title; }).join(", ") + "."));
      } else {
        text.append(el("strong", "", "Dags att fräscha upp: "),
          document.createTextNode(due.slice(0, 3).map(function (r) { return r.lesson.title; }).join(", ") + (due.length > 3 ? " och " + (due.length - 3) + " till" : "") + ". Några frågor så sitter det kvar. Det finns ingen brådska."));
      }
      const btn = el("button", "next-review-btn", "Repetera nu");
      btn.type = "button";
      btn.addEventListener("click", hooks.review);
      row.append(text, btn);
      root.appendChild(row);
    }
    container.appendChild(root);
  }

  // The step of the day as a card in the hero: what it is, how far the student has come, and one button.
  //   hooks = { start(lessonId), assignment }. Without a step (everything done) there is a short note and a link to the path.
  function heroStep(container, data, hooks) {
    container.replaceChildren();
    const item = data && data.now;
    const box = el("div", "hs");
    if (!item) {
      box.appendChild(el("p", "hs-kicker", "NU"));
      box.appendChild(el("h2", "hs-title", "Du har klarat allt just nu"));
      box.appendChild(el("p", "hs-meta", "Pyssla, repetera eller öppna hela kartan och välj själv."));
      const link = el("a", "primary-button hs-go", "Se lärstigen ↓");
      link.href = "#larstig";
      box.appendChild(link);
      container.appendChild(box);
      return;
    }
    box.appendChild(el("p", "hs-kicker", kicker(item, hooks)));
    box.appendChild(el("h2", "hs-title", item.lesson.title));
    const meta = [];
    if (item.sum.total) meta.push(item.sum.done + " av " + item.sum.total + " klara");
    if (item.sum.fix) meta.push(item.sum.fix + " att rätta");
    const m = el("p", "hs-meta");
    m.appendChild(gradeChip(item));
    if (meta.length) m.appendChild(document.createTextNode(" " + meta.join(" · ")));
    if (item.kind === "assignment" && hooks.assignment && window.GaussicaMailbox) {
      const due = window.GaussicaMailbox.dueInfo(hooks.assignment.a.dueDate);
      m.appendChild(document.createTextNode(" "));
      m.appendChild(el("span", "mb-due is-" + due.tone, due.text));
    }
    box.appendChild(m);
    const note = levelNote(item);
    if (note) box.appendChild(el("p", "hs-level" + (item.gap >= 2 ? " is-high" : ""), note));
    if (item.sum.total) {
      const bar = el("div", "mb-bar");
      item.sum.statuses.forEach(function (s) { bar.appendChild(el("span", "mb-seg is-" + s)); });
      box.appendChild(bar);
    }
    const go = el("a", "primary-button hs-go", buttonLabel(item));
    go.href = "#play/" + item.lesson.id;
    go.addEventListener("click", function (e) { e.preventDefault(); hooks.start(item.lesson.id); });
    box.appendChild(go);
    container.appendChild(box);
  }

  return { render: render, heroStep: heroStep };
}());
