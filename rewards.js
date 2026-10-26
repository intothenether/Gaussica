// Stars and badges ("märken"), kept light and friendly: no rankings and no comparison between students.
//
// Everything is computed from the student's own data (progress and answer log), so nothing extra is stored on
// the server. The only thing kept in the browser is which badges were already celebrated.
// A teacher can switch rewards off for a class (the user object then has rewards: false).
//
//   GaussicaRewards.init(deps)             deps: { getUser, getCourse, getProgress, isActive(), mailbox }
//   GaussicaRewards.enabled()              rewards are shown for this user
//   GaussicaRewards.lessonStars(lesson)    { complete, stars: 0..3 }
//   GaussicaRewards.check()                after progress changes: update the chip and celebrate new badges
//   GaussicaRewards.celebrate()            confetti
//   GaussicaRewards.openCollection()       the "Mina märken" dialog

window.GaussicaRewards = (function () {
  "use strict";

  let deps = null;

  function init(d) { deps = d; }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function L() { return window.GaussicaLesson; }
  function user() { return (deps && deps.getUser()) || null; }
  function lessons() { const c = deps.getCourse(); return (c && c.lessons) || []; }

  function enabled() {
    const u = user();
    return Boolean(deps && u && deps.isActive() && u.rewards !== false);
  }

  function starsText(n) { return "★".repeat(n) + "☆".repeat(3 - n); }

  // ----- stars per lesson -----
  // The stars of a lesson for any student (also used by the teacher view): getProgress(lessonId) is that student's progress.
  function starsFor(lesson, student, all, getProgress) {
    const sum = L().summarize(lesson, getProgress, all);
    if (!(sum.total > 0 && sum.state === "complete")) return { complete: false, stars: 0 };
    const progress = getProgress(lesson.id) || { answers: {} };
    const tasks = L().tasks(lesson).filter(function (t) { return !t.goal; });
    if (!tasks.length) return { complete: true, stars: 3 };
    let first = 0;
    tasks.forEach(function (t) {
      const stats = L().taskStats(L().history(student, lesson.id, t.id), progress.answers && progress.answers[t.id]);
      if (stats.triesToSolve === 1 || (stats.triesToSolve === null && stats.solved && stats.submissions === 0)) first++;
    });
    const ratio = first / tasks.length;
    return { complete: true, stars: ratio === 1 ? 3 : ratio >= 0.6 ? 2 : 1 };
  }

  function lessonStars(lesson) {
    return starsFor(lesson, user(), lessons(), deps.getProgress);
  }

  function overview() {
    const done = [];
    let stars = 0;
    lessons().filter(function (l) { return !l.isParentLesson; }).forEach(function (l) {
      const s = lessonStars(l);
      if (s.complete) { done.push({ lesson: l, stars: s.stars }); stars += s.stars; }
    });
    return { done: done, stars: stars };
  }

  // ----- badges -----
  function practiceCorrect() {
    const seen = new Set();
    ((user() && user().attempts) || []).forEach(function (a) {
      if (a.completed && String(a.taskId || "").indexOf("practice-") === 0 && L().isSubmission(a)) seen.add(a.lessonId + "|" + a.taskId);
    });
    return seen.size;
  }

  function struggled() {   // solved a question after at least two wrong tries
    const byTask = {};
    ((user() && user().attempts) || []).filter(L().isSubmission).forEach(function (a) {
      const k = a.lessonId + "|" + a.taskId;
      const t = byTask[k] || (byTask[k] = { wrong: 0, solved: false });
      if (a.completed) t.solved = true; else if (!t.solved) t.wrong += 1;
    });
    return Object.keys(byTask).some(function (k) { return byTask[k].solved && byTask[k].wrong >= 2; });
  }

  function badgeList() {
    const o = overview();
    const done = o.done;
    const count = done.length;
    const byArea = function (area) { return done.filter(function (d) { return d.lesson.area === area; }).length; };
    const doneKind = function (kind) { return done.some(function (d) { return d.lesson.kind === kind; }); };
    const has = function (id) { return done.some(function (d) { return d.lesson.id === id; }); };
    const practice = practiceCorrect();
    const assignmentsDone = deps.mailbox && deps.mailbox.doneCount ? deps.mailbox.doneCount() : 0;
    const list = [];
    const add = function (id, emoji, name, text, earned, progress) { list.push({ id: id, emoji: emoji, name: name, text: text, earned: earned, progress: earned ? "" : progress || "" }); };

    add("forsta", "🌱", "Första steget", "Klara din första lektion.", count >= 1, count + " av 1");
    add("fem", "⭐", "Fem klara", "Klara 5 lektioner.", count >= 5, count + " av 5");
    add("tio", "🏅", "Tio klara", "Klara 10 lektioner.", count >= 10, count + " av 10");
    add("tjugo", "🏆", "Tjugo klara", "Klara 20 lektioner.", count >= 20, count + " av 20");
    add("direkt", "🎯", "Rätt direkt", "Få tre stjärnor på en lektion, alla uppgifter rätt på första försöket.", done.some(function (d) { return d.stars === 3; }));
    add("ge-inte-upp", "💪", "Ge inte upp", "Lös en fråga efter att ha svarat fel två gånger.", struggled());
    add("pysslare", "✨", "Pysslaren", "Klara en pyssla-lektion.", doneKind("pyssel"));
    add("begrepp", "🔤", "Begreppsmästare", "Klara en begreppslektion.", doneKind("begrepp"));
    add("ovare", "🔁", "Övaren", "Svara rätt på 10 övningsfrågor med Öva mer.", practice >= 10, practice + " av 10");
    add("tabell", "✖️", "Tabellmästare", "Klara lektionen om multiplikationstabellen.", has("multiplikationstabellen"));
    add("uppdrag", "📌", "Uppdragsklar", "Klara ett uppdrag från din lärare.", assignmentsDone >= 1);
    add("tal", "🔢", "Talkoll", "Klara 5 lektioner om tal och räkning.", byArea("tal") >= 5, byArea("tal") + " av 5");
    add("form", "📐", "Formkoll", "Klara 4 lektioner om form och rum.", byArea("geometri") >= 4, byArea("geometri") + " av 4");
    add("mat", "⏰", "Måttkoll", "Klara 3 lektioner om tid och mätning.", byArea("matning") >= 3, byArea("matning") + " av 3");
    add("samband", "𝑥", "Algebrakoll", "Klara 3 lektioner om samband och algebra.", byArea("algebra") >= 3, byArea("algebra") + " av 3");
    add("data", "📊", "Datakoll", "Klara 3 lektioner om data och slump.", byArea("data") >= 3, byArea("data") + " av 3");
    return { badges: list, stars: o.stars, done: done };
  }

  // ----- celebrating new badges -----
  function seenKey() { return "gaussica.rewards." + (user() ? user().id : "x"); }

  function readSeen() {
    try {
      const raw = window.localStorage.getItem(seenKey());
      return raw === null ? null : JSON.parse(raw);
    } catch (e) { return []; }
  }

  function writeSeen(ids) {
    try { window.localStorage.setItem(seenKey(), JSON.stringify(ids)); } catch (e) { /* storage blocked */ }
  }

  function toast(badge) {
    const old = document.getElementById("reward-toast");
    if (old) old.remove();
    const t = el("button", "reward-toast");
    t.id = "reward-toast";
    t.type = "button";
    t.setAttribute("role", "status");
    t.append(el("span", "reward-toast-emoji", badge.emoji), el("span", "reward-toast-text", "Nytt märke: " + badge.name + "!"));
    t.addEventListener("click", function () { t.remove(); openCollection(); });
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 6000);
  }

  function updateChip(stars) {
    const chip = document.getElementById("rewards-chip");
    if (!chip) return;
    chip.hidden = !enabled();
    if (!chip.hidden) chip.querySelector("b").textContent = String(stars);
    if (!chip.dataset.bound) {
      chip.dataset.bound = "1";
      chip.addEventListener("click", openCollection);
    }
  }

  function check() {
    if (!deps) return;
    if (!enabled()) { updateChip(0); return; }
    const data = badgeList();
    updateChip(data.stars);
    const earned = data.badges.filter(function (b) { return b.earned; });
    const ids = earned.map(function (b) { return b.id; });
    const seen = readSeen();
    if (seen === null) { writeSeen(ids); return; }   // first visit with this feature: nothing to celebrate yet
    const fresh = earned.filter(function (b) { return seen.indexOf(b.id) < 0; });
    if (!fresh.length) return;
    writeSeen(ids);
    toast(fresh[0]);
    celebrate();
  }

  // ----- confetti -----
  function celebrate() {
    if (!enabled() || document.querySelector(".confetti-layer")) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = el("div", "confetti-layer");
    layer.setAttribute("aria-hidden", "true");
    const colors = ["#ef6f88", "#f6c453", "#76c0ec", "#2f9d88", "#8a74c9", "#e0861f"];
    for (let i = 0; i < 46; i++) {
      const p = el("i", "confetti");
      p.style.left = Math.round(Math.random() * 100) + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      p.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + "s";
      p.style.transform = "rotate(" + Math.round(Math.random() * 360) + "deg)";
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 3600);
  }

  // ----- "Mina märken" -----
  function closeCollection() {
    const o = document.getElementById("rewards-overlay");
    if (o) o.remove();
  }

  function openCollection() {
    if (!enabled() || document.getElementById("rewards-overlay")) return;
    const data = badgeList();
    const overlay = el("div", "pv-overlay");
    overlay.id = "rewards-overlay";
    const card = el("div", "pv-card rw-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "rw-title");
    const head = el("div", "rw-head");
    head.appendChild(el("span", "rw-big", "⭐"));
    const title = el("div");
    const h = el("h2", "", data.stars + (data.stars === 1 ? " stjärna" : " stjärnor"));
    h.id = "rw-title";
    title.append(h, el("p", "rw-sub", data.done.length + (data.done.length === 1 ? " lektion klar" : " lektioner klara")));
    head.appendChild(title);
    card.appendChild(head);

    card.appendChild(el("h3", "", "Märken"));
    const grid = el("div", "rw-grid");
    data.badges.forEach(function (b) {
      const c = el("div", "rw-badge" + (b.earned ? " is-earned" : ""));
      c.appendChild(el("span", "rw-emoji", b.earned ? b.emoji : "🔒"));
      c.appendChild(el("strong", "", b.name));
      c.appendChild(el("span", "rw-text", b.text));
      if (b.progress) c.appendChild(el("span", "rw-progress", b.progress));
      grid.appendChild(c);
    });
    card.appendChild(grid);

    if (data.done.length) {
      card.appendChild(el("h3", "", "Dina lektioner"));
      const list = el("ul", "rw-lessons");
      data.done.forEach(function (d) {
        const li = el("li");
        li.append(el("span", "rw-stars", starsText(d.stars)), el("span", "", d.lesson.title));
        list.appendChild(li);
      });
      card.appendChild(list);
    }
    card.appendChild(el("p", "rw-note", "Stjärnor: en stjärna för en klar lektion, två om de flesta svar blev rätt på första försöket och tre om alla blev det."));
    const done = el("button", "primary-button pv-close", "Stäng");
    done.type = "button";
    done.addEventListener("click", closeCollection);
    card.appendChild(done);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeCollection(); });
    overlay.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); closeCollection(); } });
    document.body.appendChild(overlay);
    done.focus({ preventScroll: true });
  }

  return {
    init: init, enabled: enabled, lessonStars: lessonStars, starsFor: starsFor, starsText: starsText, check: check, celebrate: celebrate,
    openCollection: openCollection, overview: overview
  };
}());
