// "Din väg": a short, friendly path instead of the big graph. It shows what to do now, what comes after
// and one play lesson, as large cards with one clear button each.
//
//   GaussicaPathView.render(container, data, hooks)
//     data  = GaussicaCoach.path(...)  { now, later[], play, doneCount, total, allDone }
//     hooks = { start(lessonId), more(lessonId), review(), assignment (open assignment or null), reviewLessons: [] }

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
    copy.appendChild(el("h4", "pv-title", item.lesson.title));
    const meta = [window.GaussicaLesson.gradeLabel(item.grade)];
    if (item.sum.total) meta.push(item.sum.done + " av " + item.sum.total + " klara");
    if (item.sum.fix) meta.push(item.sum.fix + " att rätta");
    copy.appendChild(el("p", "pv-meta", meta.join(" · ")));
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

    if (data.allDone) {
      const done = el("div", "pv-alldone");
      done.append(el("span", "pv-emoji", "🎉"), el("p", "", "Pyssla eller repetera igen när du vill. Du kan också öppna hela kartan och välja själv."));
      root.appendChild(done);
    }

    const steps = [data.now].concat(data.later).filter(Boolean);
    const list = el("ol", "pv-list");
    steps.forEach(function (item, i) { list.appendChild(card(item, i + 1, hooks)); });
    if (data.play) list.appendChild(card(data.play, steps.length + 1, hooks));
    if (list.children.length) root.appendChild(list);

    if (hooks.reviewLessons && hooks.reviewLessons.length) {
      const row = el("div", "next-review");
      const text = el("p", "next-review-text");
      text.append(el("strong", "", "Repetera: "),
        document.createTextNode("du kan behöva öva mer på " + hooks.reviewLessons.slice(0, 3).map(function (r) { return r.lesson.title; }).join(", ") + "."));
      const btn = el("button", "next-review-btn", "Repetera nu");
      btn.type = "button";
      btn.addEventListener("click", hooks.review);
      row.append(text, btn);
      root.appendChild(row);
    }
    container.appendChild(root);
  }

  return { render: render };
}());
