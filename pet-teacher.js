// The teacher's view of the pets: one small line for each student (their animal and coins) and a way to give coins with a
// reason. A gift is a message with a coin sticker (mynt5, mynt10 or mynt25) and the reason as its text, so the student
// sees why, and the coins are counted by pet.js like all other coins.
//
//   GaussicaPetTeacher.info(student, ctx)     { pet, total, balance, spent, items, gifts: [{ amount, text, at }] } or null
//   GaussicaPetTeacher.cell(student, ctx)     the small line for the student table
//   GaussicaPetTeacher.detail(student, ctx)   the line and the gift form for the student's own page
//
// ctx is the teacher view's context (course, classes, actions.sendFeedback, formatTimestamp, rerender, setNotice).

window.GaussicaPetTeacher = (function () {
  "use strict";

  const REASONS = ["Bra arbetsinsats", "Du gav inte upp", "Hjälpte en kompis", "Bra provresultat", "Fint resonemang", "Tog ansvar"];

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function classOf(student, ctx) {
    return ctx.classes.find(function (c) { return c.id === student.classId; });
  }

  // null when the student has no pet
  function info(student, ctx) {
    const pet = student.lessonProgress && student.lessonProgress.pet;
    if (!pet || !pet.kind) return null;
    const P = window.GaussicaPet;
    const get = function (id) { return (student.lessonProgress || {})[id]; };
    const led = P.earned({
      lessons: ctx.course.lessons, student: student, getProgress: get,
      lessonStars: function (lesson) { return window.GaussicaRewards.starsFor(lesson, student, ctx.course.lessons, get); }
    });
    const gifts = (student.feedback || []).filter(function (f) { return f.sticker && P.GIFTS[f.sticker]; })
      .map(function (f) { return { amount: P.GIFTS[f.sticker], text: f.text || "", at: f.createdAt }; })
      .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return { pet: pet, total: led.total, spent: P.spentOf(pet), balance: P.balanceOf(led.total, pet), items: Object.keys(pet.owned || {}).length, gifts: gifts };
  }

  function face(pet) {
    const f = el("span", "tv-pet-face");
    f.innerHTML = window.GaussicaPetArt.face(pet, "");
    return f;
  }

  function kindName(pet) {
    const k = window.GaussicaPetArt.KINDS[pet.kind];
    return k ? k.name.toLowerCase() : "djur";
  }

  function coins(n) {
    const c = el("span", "tv-pet-coins");
    c.append(el("span", "coin-icon"), el("b", "", String(n)));
    return c;
  }

  // ===== the student table =====
  function cell(student, ctx) {
    const td = el("td", "tv-pet-cell");
    const cls = classOf(student, ctx);
    if (cls && cls.rewards === false) { td.appendChild(el("span", "tv-muted", "avstängt")); return td; }
    const i = info(student, ctx);
    if (!i) { td.appendChild(el("span", "tv-muted", "inget än")); return td; }
    td.title = i.pet.name + " (" + kindName(i.pet) + "), " + i.balance + " mynt, " + i.items + " saker";
    td.append(face(i.pet), el("span", "tv-pet-name", i.pet.name), coins(i.balance));
    return td;
  }

  // ===== the student's own page =====
  function detail(student, ctx) {
    const box = el("section", "tv-pet-box");
    box.appendChild(el("h4", "", "🐾 Djur och mynt"));
    const cls = classOf(student, ctx);
    if (cls && cls.rewards === false) {
      box.appendChild(el("p", "tv-muted", "Djur, stjärnor och märken är avstängda för klassen (rutan i klasslistan)."));
      return box;
    }
    const i = info(student, ctx);
    if (!i) {
      box.appendChild(el("p", "tv-muted", student.name.split(" ")[0] + " har inget djur än. Eleven väljer ett på startsidan, och kan få mynt av dig efteråt."));
      return box;
    }
    const line = el("p", "tv-pet-line");
    line.append(face(i.pet));
    line.appendChild(el("strong", "", i.pet.name));
    line.appendChild(document.createTextNode(" (" + kindName(i.pet) + ") · "));
    line.appendChild(coins(i.balance));
    line.appendChild(document.createTextNode(" mynt att spendera · " + i.items + (i.items === 1 ? " sak" : " saker") + " köpta · " + i.total + " mynt intjänade totalt"));
    box.appendChild(line);

    if (i.gifts.length) {
      const list = el("ul", "tv-pet-gifts");
      i.gifts.slice(0, 3).forEach(function (g) {
        list.appendChild(el("li", "", "💰 " + g.amount + " mynt" + (g.text ? ": ”" + g.text + "”" : "") + " · " + ctx.formatTimestamp(g.at)));
      });
      box.appendChild(list);
    }

    if (ctx.inboxUnavailable) return box;
    box.appendChild(el("p", "tv-muted", "Ge mynt med en anledning. Eleven ser dem som ett meddelande och kan använda dem till djuret."));
    const form = el("form", "tv-pet-gift");
    let amount = 10;
    const amounts = el("div", "tv-pet-amounts");
    [5, 10, 25].forEach(function (n) {
      const b = button(n + " mynt", "tv-chip" + (n === amount ? " is-on" : ""), function () {
        amount = n;
        Array.prototype.forEach.call(amounts.children, function (c) { c.classList.toggle("is-on", c === b); });
      });
      amounts.appendChild(b);
    });
    const reason = el("input", "tv-pet-reason");
    reason.type = "text"; reason.maxLength = 120; reason.placeholder = "Varför? till exempel Bra arbetsinsats";
    reason.setAttribute("aria-label", "Anledning till presenten");
    const reasons = el("div", "tv-pet-reasons");
    REASONS.forEach(function (r) { reasons.appendChild(button(r, "tv-chip", function () { reason.value = r; reason.focus(); })); });
    const error = el("p", "tv-compose-error");
    error.hidden = true;
    const send = button("Ge mynt 💰", "tv-btn is-primary", function () {});
    send.type = "submit";
    form.append(amounts, reason, reasons, error, send);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = reason.value.trim();
      if (!text) { error.textContent = "Skriv en anledning, så förstår eleven varför."; error.hidden = false; return; }
      error.hidden = true;
      send.disabled = true;
      ctx.actions.sendFeedback({ studentId: student.id, text: text, sticker: "mynt" + amount })
        .then(function () {
          ctx.setNotice({ text: amount + " mynt har skickats till " + student.name.split(" ")[0] + "." });
          ctx.rerender();
        })
        .catch(function (err) { error.textContent = err.message; error.hidden = false; send.disabled = false; });
    });
    box.appendChild(form);
    return box;
  }

  return { info: info, cell: cell, detail: detail, REASONS: REASONS };
}());
