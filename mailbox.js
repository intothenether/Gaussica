// The student's inbox from the teacher: assignments ("Uppdrag") and feedback ("Meddelanden").
// Everything here is drawn large and colourful on purpose, so that young students find it at once:
// a box right under the top bar, a badge in the top bar, a pin on the assigned lesson in the graph,
// and the teacher's comments right where they belong (above the question they are about).
//
//   GaussicaMailbox.init(deps)
//   GaussicaMailbox.render(container)     the big box at the top of the page (hidden when there is nothing to show)
//   GaussicaMailbox.inline(lessonId, taskId)  teacher comments for one question (taskId) or a lesson (taskId === null)
//   GaussicaMailbox.banner(lessonId)      "Uppdrag från din lärare" strip for a lesson, or null
//   GaussicaMailbox.STICKERS              stickers a teacher can attach (also used by the teacher view)
//
// deps: { getUser, getCourse, getProgress, openLesson(lessonId, stepIndex), markRead(ids) }

window.GaussicaMailbox = (function () {
  "use strict";

  const STICKERS = {
    star: { emoji: "⭐", label: "Bra jobbat!" },
    thumbs: { emoji: "👍", label: "Det här var bra" },
    muscle: { emoji: "💪", label: "Prova igen!" },
    rocket: { emoji: "🚀", label: "Fortsätt så!" },
    bulb: { emoji: "💡", label: "Tänk på det här" },
    party: { emoji: "🎉", label: "Grattis!" },
    heart: { emoji: "❤️", label: "Snyggt jobbat" }
  };

  const WEEKDAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
  const MONTHS = ["jan", "feb", "mars", "april", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"];

  let deps = null;

  function init(d) { deps = d; }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function user() { return (deps && deps.getUser()) || {}; }
  function lessons() { const c = deps.getCourse(); return (c && c.lessons) || []; }
  function lessonById(id) { return lessons().find(function (l) { return l.id === id; }); }

  // ----- dates -----
  function parseDay(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function dayLabel(d) { return WEEKDAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()]; }

  function shortDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()];
  }

  // { text, tone: "late" | "soon" | "calm" | "none" }
  function dueInfo(dueDate) {
    const due = parseDay(dueDate);
    if (!due) return { text: "Ingen deadline", tone: "none" };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return { text: "Försenat · skulle vara klart " + dayLabel(due), tone: "late" };
    if (days === 0) return { text: "Klart senast idag!", tone: "soon" };
    if (days === 1) return { text: "Klart senast i morgon", tone: "soon" };
    if (days < 7) return { text: "Klart senast " + dayLabel(due), tone: "calm" };
    return { text: "Klart senast " + due.getDate() + " " + MONTHS[due.getMonth()], tone: "calm" };
  }

  // ----- data -----
  function assignments() {
    const L = window.GaussicaLesson;
    return (user().assignments || []).map(function (a) {
      const lesson = lessonById(a.lessonId);
      if (!lesson) return null;
      const sum = L.summarize(lesson, deps.getProgress, lessons());
      return { a: a, lesson: lesson, sum: sum, done: sum.total > 0 && sum.state === "complete", due: dueInfo(a.dueDate) };
    }).filter(Boolean);
  }

  function openAssignments() {
    return assignments().filter(function (x) { return !x.done; }).sort(function (x, y) {
      const rank = { late: 0, soon: 1, calm: 2, none: 3 };
      return rank[x.due.tone] - rank[y.due.tone] || (x.a.dueDate || "9").localeCompare(y.a.dueDate || "9") || x.a.id - y.a.id;
    });
  }

  function feedback() { return user().feedback || []; }
  function unread() { return feedback().filter(function (f) { return !f.read; }); }

  function counts() {
    return { assignments: openAssignments().length, unread: unread().length };
  }

  function stepIndexOf(lesson, taskId) {
    if (!taskId) return undefined;
    const i = window.GaussicaLesson.steps(lesson).findIndex(function (s) { return s.type === "question" && s.task.id === taskId; });
    return i >= 0 ? i : undefined;
  }

  function taskLabel(lesson, taskId) {
    if (!taskId) return "";
    const t = window.GaussicaLesson.tasks(lesson).find(function (x) { return x.id === taskId; });
    return t ? t.name : "";
  }

  // ----- pieces -----
  function avatar(name) {
    const a = el("span", "mb-avatar", (name || "L").charAt(0).toUpperCase());
    a.setAttribute("aria-hidden", "true");
    return a;
  }

  function progressBar(sum) {
    const bar = el("div", "mb-bar");
    sum.statuses.forEach(function (s) { bar.appendChild(el("span", "mb-seg is-" + s)); });
    return bar;
  }

  function assignmentCard(x) {
    const lesson = x.lesson;
    const card = el("article", "mb-assign is-" + x.due.tone);
    const top = el("div", "mb-assign-top");
    top.append(el("span", "mb-pin", "📌 UPPDRAG"), el("span", "mb-due is-" + x.due.tone, x.due.text));
    card.appendChild(top);
    card.appendChild(el("h4", "mb-assign-title", lesson.title));
    if (x.a.note) {
      const note = el("div", "mb-speech");
      note.append(avatar(x.a.teacher), el("p", "", x.a.note));
      card.appendChild(note);
    }
    const started = x.sum.done > 0 || x.sum.fix > 0;
    card.append(progressBar(x.sum), el("p", "mb-assign-count", x.sum.done + " av " + x.sum.total + " uppgifter klara"));
    const go = el("button", "primary-button mb-go", started ? "Fortsätt uppdraget →" : "Börja uppdraget →");
    go.type = "button";
    go.addEventListener("click", function () { deps.openLesson(lesson.id); });
    card.appendChild(go);
    return card;
  }

  function doneCard(x) {
    const row = el("div", "mb-done");
    row.append(el("span", "mb-done-check", "✓"), el("strong", "", x.lesson.title), el("span", "mb-muted", "Klart! Bra jobbat 🎉"));
    return row;
  }

  function sticker(f) {
    const s = f.sticker && STICKERS[f.sticker];
    if (!s) return null;
    const box = el("div", "mb-sticker");
    box.append(el("span", "mb-sticker-emoji", s.emoji), el("span", "mb-sticker-label", s.label));
    box.setAttribute("aria-label", s.label);
    return box;
  }

  // One comment from the teacher. `where` adds a "Visa" button when the comment is about a lesson.
  function noteBubble(f, opts) {
    opts = opts || {};
    const wrap = el("article", "mb-note" + (f.read ? " is-read" : " is-new"));
    wrap.appendChild(avatar(f.teacher));
    const bubble = el("div", "mb-bubble");
    if (!f.read) bubble.appendChild(el("span", "mb-new", "NYTT"));
    const st = sticker(f);
    if (st) bubble.appendChild(st);
    if (f.text) bubble.appendChild(el("p", "mb-text", f.text));
    const meta = el("div", "mb-meta");
    meta.appendChild(el("span", "mb-from", (f.teacher || "Din lärare") + " · " + shortDate(f.createdAt)));
    const lesson = f.lessonId ? lessonById(f.lessonId) : null;
    if (lesson && opts.where) {
      const label = taskLabel(lesson, f.taskId);
      const open = el("button", "mb-link", "Gäller: " + lesson.title + (label ? " · " + label : "") + " →");
      open.type = "button";
      open.addEventListener("click", function () { deps.openLesson(lesson.id, stepIndexOf(lesson, f.taskId)); });
      meta.appendChild(open);
    }
    if (!f.read) {
      const ok = el("button", "mb-ok", "Okej 👍");
      ok.type = "button";
      ok.addEventListener("click", function () { deps.markRead([f.id]); });
      meta.appendChild(ok);
    }
    bubble.appendChild(meta);
    wrap.appendChild(bubble);
    return wrap;
  }

  // ----- the big box -----
  function render(container) {
    if (!container) return;
    const items = assignments();
    const open = openAssignments();
    const done = items.filter(function (x) { return x.done; });
    const notes = feedback();
    const fresh = notes.filter(function (f) { return !f.read; });
    const shownNotes = fresh.concat(notes.filter(function (f) { return f.read; }).slice(0, 3));

    // keep the box open/closed state of the "klara uppdrag" list while it redraws
    const wasOpen = container.querySelector(".mb-done-list") && container.querySelector(".mb-done-list").open;

    container.replaceChildren();
    if (!open.length && !fresh.length) {   // nothing to do: stay out of the way (done items live in the lesson panels)
      container.hidden = true;
      return;
    }
    container.hidden = false;

    const head = el("header", "mb-head");
    head.appendChild(el("span", "mb-emoji", "📬"));
    const title = el("div");
    title.append(el("h2", "mb-title", "Från din lärare"));
    const bits = [];
    if (open.length) bits.push(open.length === 1 ? "1 uppdrag" : open.length + " uppdrag");
    if (fresh.length) bits.push(fresh.length === 1 ? "1 nytt meddelande" : fresh.length + " nya meddelanden");
    title.appendChild(el("p", "mb-sub", "Du har " + bits.join(" och ") + "."));
    head.appendChild(title);
    container.appendChild(head);

    const grid = el("div", "mb-grid" + (open.length && shownNotes.length ? " is-two" : ""));
    if (open.length) {
      const col = el("div", "mb-col");
      col.appendChild(el("h3", "mb-col-title", "📌 Uppdrag"));
      open.forEach(function (x) { col.appendChild(assignmentCard(x)); });
      grid.appendChild(col);
    }
    if (shownNotes.length) {
      const col = el("div", "mb-col");
      col.appendChild(el("h3", "mb-col-title", "💬 Meddelanden"));
      shownNotes.forEach(function (f) { col.appendChild(noteBubble(f, { where: true })); });
      grid.appendChild(col);
    }
    container.appendChild(grid);

    if (done.length) {
      const list = el("details", "mb-done-list");
      list.open = Boolean(wasOpen);
      list.appendChild(el("summary", "", "✓ Klara uppdrag (" + done.length + ")"));
      done.forEach(function (x) { list.appendChild(doneCard(x)); });
      container.appendChild(list);
    }
  }

  // ----- small pieces used elsewhere -----
  function inline(lessonId, taskId) {
    const list = feedback().filter(function (f) {
      return f.lessonId === lessonId && (taskId ? f.taskId === taskId : !f.taskId);
    });
    if (!list.length) return null;
    const box = el("section", "mb-inline");
    box.appendChild(el("h4", "mb-inline-title", taskId ? "💬 Din lärare har skrivit om den här frågan" : "💬 Din lärare har skrivit om den här lektionen"));
    list.slice().reverse().forEach(function (f) { box.appendChild(noteBubble(f, { where: false })); });
    // comments you can see here count as read
    const ids = list.filter(function (f) { return !f.read; }).map(function (f) { return f.id; });
    if (ids.length) setTimeout(function () { deps.markRead(ids, true); }, 2500);
    return box;
  }

  function banner(lessonId) {
    const x = openAssignments().find(function (y) { return y.a.lessonId === lessonId; });
    if (!x) return null;
    const box = el("section", "mb-banner is-" + x.due.tone);
    box.appendChild(el("span", "mb-banner-emoji", "📌"));
    const copy = el("div", "mb-banner-copy");
    copy.append(el("strong", "", "Uppdrag från " + (x.a.teacher || "din lärare") + ": gör den här lektionen"), el("span", "mb-due is-" + x.due.tone, x.due.text));
    if (x.a.note) copy.appendChild(el("p", "mb-banner-note", "“" + x.a.note + "”"));
    box.appendChild(copy);
    return box;
  }

  function assignedLessonIds() {
    const out = {};
    openAssignments().forEach(function (x) { out[x.a.lessonId] = x.due.tone; });
    return out;
  }

  return {
    init: init, render: render, inline: inline, banner: banner, counts: counts, openAssignments: openAssignments,
    assignedLessonIds: assignedLessonIds, noteBubble: noteBubble, dueInfo: dueInfo, STICKERS: STICKERS
  };
}());
