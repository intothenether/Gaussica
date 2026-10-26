// Your own pet: a dog, a cat or a penguin that you earn coins ("mynt") for by learning, and spend them on clothes,
// accessories and backgrounds. It is meant to go with the learning, not to replace it:
//
//  * Coins are paid for finishing lessons and for sticking with a question after a mistake, not for every right answer,
//    and the repeatable sources have a ceiling. Nothing is lost by staying away: the pet is never sad or hungry.
//  * The coins are worked out from the student's own data (progress and answer log, plus coin gifts from the teacher),
//    minus what was spent. Only the pet itself is stored (in the student's progress under the key "pet"), so nothing in
//    the database changes and the same coins show on every device.
//  * Coins are shown when a lesson or a round is finished, never in the middle of a question.
//  * A teacher can switch it off for a class, with the same switch as stars and badges.
//
//   GaussicaPet.init(deps)         deps: { getUser, getCourse, getProgress, enabled(), lessonStars(lesson), save(record), refresh() }
//   GaussicaPet.render(container)  the pet (or the invitation to choose one) on the start page
//   GaussicaPet.check()            after progress changes: update the coin chip
//   GaussicaPet.ribbon()           for a finished lesson: the pet cheering and the new coins, or null
//   GaussicaPet.face()             the pet's head, small, for the lesson footer (or null)
//   GaussicaPet.open()             the room with the shop (the chooser first if there is no pet)
//
// Pure parts, also used by the tests: earned(ctx), balanceOf(total, pet), makePet, buyItem, wearItem, setBackground.
//   record = { v: 1, kind, color, name, owned: { itemId: pricePaid }, worn: { hat, face, neck }, bg, at }

window.GaussicaPet = (function () {
  "use strict";

  const KEY = "pet";
  const WELCOME = 20;              // a present when the pet is chosen
  const LESSON = 10;               // a finished lesson, once
  const STARS = { 2: 2, 3: 4 };    // extra for two and three stars
  const FIXED_PER_LESSON = 3;      // "Ge inte upp": a question solved after wrong answers, one coin, up to 3 per lesson
  const PRACTICE_PER_DAY = 10;     // "Öva mer" and "Repetera": one coin per new question, up to 10 a day
  const PLACEMENT = 5;             // the placement test, once
  const GIFTS = { mynt5: 5, mynt10: 10, mynt25: 25 };   // coins from the teacher (a sticker on a message)

  function Art() { return window.GaussicaPetArt; }
  function L() { return window.GaussicaLesson; }

  // ===== the economy (pure) =====
  function dayKey(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  // ctx = { lessons, student: { lessonProgress, attempts, feedback }, getProgress, lessonStars(lesson) }
  function earned(ctx) {
    const parts = [];
    let total = 0;
    const add = function (id, label, amount) {
      if (amount > 0) { parts.push({ id: id, label: label, amount: amount }); total += amount; }
    };
    const student = ctx.student || {};
    const pet = student.lessonProgress && student.lessonProgress[KEY];
    if (!pet || !pet.kind) return { total: 0, parts: [] };
    add("welcome", "Välkomstpresent", WELCOME);

    // finished lessons
    let lessonCoins = 0, finished = 0;
    ctx.lessons.forEach(function (lesson) {
      if (lesson.isParentLesson) return;
      const sum = L().summarize(lesson, ctx.getProgress, ctx.lessons);
      if (!(sum.total > 0 && sum.state === "complete")) return;
      finished += 1;
      const stars = ctx.lessonStars ? ctx.lessonStars(lesson).stars : 0;
      lessonCoins += LESSON + (STARS[stars] || 0);
    });
    add("lessons", finished + (finished === 1 ? " klar lektion" : " klara lektioner"), lessonCoins);

    // the answer log, oldest first
    const subs = (student.attempts || []).filter(L().isSubmission).slice().sort(function (a, b) {
      return String(a.timestamp || "").localeCompare(String(b.timestamp || ""));
    });
    const lessonIds = new Set(ctx.lessons.map(function (l) { return l.id; }));
    const isPractice = function (taskId) { return String(taskId || "").indexOf("practice-") === 0; };

    // stuck with a question after a mistake (lesson questions only)
    const byTask = {};
    subs.forEach(function (a) {
      if (isPractice(a.taskId) || !lessonIds.has(a.lessonId)) return;
      const k = a.lessonId + "|" + a.taskId;
      const t = byTask[k] || (byTask[k] = { lesson: a.lessonId, wrong: 0, solved: false });
      if (a.completed) t.solved = true; else if (!t.solved) t.wrong += 1;
    });
    const perLesson = {};
    Object.keys(byTask).forEach(function (k) {
      const t = byTask[k];
      if (t.solved && t.wrong >= 1) perLesson[t.lesson] = Math.min(FIXED_PER_LESSON, (perLesson[t.lesson] || 0) + 1);
    });
    let stuck = 0;
    Object.keys(perLesson).forEach(function (id) { stuck += perLesson[id]; });
    add("stuck", "Gav inte upp efter ett fel", stuck);

    // generated practice, a ceiling per day
    const seen = new Set();
    const perDay = {};
    subs.forEach(function (a) {
      if (!a.completed || !isPractice(a.taskId) || !lessonIds.has(a.lessonId)) return;
      const k = a.lessonId + "|" + a.taskId;
      if (seen.has(k)) return;
      seen.add(k);
      const day = dayKey(a.timestamp);
      perDay[day] = (perDay[day] || 0) + 1;
    });
    let practice = 0;
    Object.keys(perDay).forEach(function (d) { practice += Math.min(PRACTICE_PER_DAY, perDay[d]); });
    add("practice", "Övningsfrågor", practice);

    const placed = student.lessonProgress && student.lessonProgress.placement;
    if (placed && Array.isArray(placed.known)) add("placement", "Nivåtest", PLACEMENT);

    let gifts = 0, giftCount = 0;
    (student.feedback || []).forEach(function (f) { if (f.sticker && GIFTS[f.sticker]) { gifts += GIFTS[f.sticker]; giftCount += 1; } });
    add("gifts", giftCount === 1 ? "Present från din lärare" : "Presenter från din lärare", gifts);
    return { total: total, parts: parts };
  }

  function spentOf(pet) {
    let s = 0;
    Object.keys((pet && pet.owned) || {}).forEach(function (id) { s += Number(pet.owned[id]) || 0; });
    return s;
  }

  function balanceOf(total, pet) { return Math.max(0, total - spentOf(pet)); }

  // ===== the pet record (pure) =====
  const NAME_OK = /[^\p{L}\p{N} -]/gu;

  function cleanName(name, kind) {
    const n = String(name || "").replace(NAME_OK, "").replace(/\s+/g, " ").trim().slice(0, 16);
    return n || (Art().KINDS[kind] ? Art().KINDS[kind].names[0] : "Vän");
  }

  function makePet(kind, color, name) {
    const k = Art().KINDS[kind] ? kind : "dog";
    return { v: 1, kind: k, color: Art().colorOf(k, color).id, name: cleanName(name, k), owned: {}, worn: {}, bg: null, at: new Date().toISOString() };
  }

  function copy(pet) { return JSON.parse(JSON.stringify(pet)); }

  // Buy an item (and put it on). Returns { pet, error }.
  function buyItem(pet, itemId, balance) {
    const it = Art().item(itemId);
    if (!it) return { error: "Den saken finns inte." };
    if (pet.owned && pet.owned[itemId] !== undefined) return { error: "Du har redan den." };
    if (balance < it.price) return { error: "Du behöver " + (it.price - balance) + " mynt till." };
    const next = copy(pet);
    next.owned = next.owned || {};
    next.owned[itemId] = it.price;
    return { pet: wearItem(next, it.slot, itemId).pet };
  }

  // Put an owned item on (itemId) or take the slot's item off (itemId = null).
  function wearItem(pet, slot, itemId) {
    const next = copy(pet);
    if (slot === "bg") { next.bg = itemId && next.owned[itemId] !== undefined ? itemId : null; return { pet: next }; }
    next.worn = next.worn || {};
    if (!itemId) delete next.worn[slot];
    else if (next.owned[itemId] !== undefined && Art().item(itemId) && Art().item(itemId).slot === slot) next.worn[slot] = itemId;
    return { pet: next };
  }

  // ===== the screens =====
  let deps = null;

  function init(d) { deps = d; }

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

  function user() { return (deps && deps.getUser()) || null; }
  function enabled() { return Boolean(deps && user() && deps.enabled()); }

  function petOf() {
    const u = user();
    const p = u && u.lessonProgress && u.lessonProgress[KEY];
    return p && p.kind ? p : null;
  }

  function ledger() {
    return earned({ lessons: deps.getCourse().lessons, student: user(), getProgress: deps.getProgress, lessonStars: deps.lessonStars });
  }

  function balance() {
    const p = petOf();
    return p ? balanceOf(ledger().total, p) : 0;
  }

  // which total was last shown to the student (to tell what is new)
  function seenKey() { return "gaussica.pet.seen." + (user() ? user().id : "x"); }
  function readSeen() { try { const v = window.localStorage.getItem(seenKey()); return v === null ? null : Number(v); } catch (e) { return null; } }
  function writeSeen(n) { try { window.localStorage.setItem(seenKey(), String(n)); } catch (e) { /* storage blocked */ } }

  function newCoins() {
    const total = ledger().total;
    const seen = readSeen();
    if (seen === null) { writeSeen(total); return 0; }
    return Math.max(0, total - seen);
  }

  function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function art(pet, options) {
    const wrap = el("div", "pet-art");
    wrap.innerHTML = Art().svg(pet, options);   // the markup comes from pet-art.js only; the name goes in as an attribute-safe label
    return wrap;
  }

  // the pet jumps for a moment (and is happy)
  function cheer(host, pet) {
    if (!host || host.dataset.cheering) return;
    host.dataset.cheering = "1";
    host.innerHTML = Art().svg(pet, { mood: "happy" });
    setTimeout(function () {
      host.innerHTML = Art().svg(pet);
      delete host.dataset.cheering;
    }, reduced() ? 900 : 1500);
  }

  function updateChip() {
    const chip = document.getElementById("pet-chip");
    if (!chip) return;
    const p = enabled() ? petOf() : null;
    chip.hidden = !p;
    if (!p) return;
    chip.querySelector("b").textContent = String(balance());
    if (!chip.dataset.bound) {
      chip.dataset.bound = "1";
      chip.addEventListener("click", open);
    }
  }

  function check() {
    if (!deps) return;
    updateChip();
  }

  // ----- dialogs -----
  function closeOverlay() {
    const o = document.getElementById("pet-overlay");
    if (o) o.remove();
  }

  function overlay(label, build) {
    closeOverlay();
    const o = el("div", "pv-overlay pet-overlay");
    o.id = "pet-overlay";
    const panel = el("div", "pv-card pet-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", label);
    o.appendChild(panel);
    build(panel);
    o.addEventListener("click", function (e) { if (e.target === o) closeOverlay(); });
    o.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); closeOverlay(); } });
    document.body.appendChild(o);
    return o;
  }

  function head(panel, title) {
    const h = el("header", "pet-head");
    h.appendChild(el("h2", "", title));
    const x = button("✕", "pet-close", closeOverlay);
    x.setAttribute("aria-label", "Stäng");
    h.appendChild(x);
    panel.appendChild(h);
  }

  // The first time: choose an animal, a colour and a name.
  function chooser(onDone) {
    let kind = "dog", color = Art().KINDS.dog.colors[0].id, name = "";
    overlay("Välj ditt djur", function (panel) {
      const draw = function () {
        panel.replaceChildren();
        head(panel, "Välj ditt djur 🐾");
        const body = el("div", "pet-body pet-choose");
        body.appendChild(el("p", "pet-lead", "Du får 20 mynt i present! Du tjänar fler mynt när du lär dig saker, och kan köpa kläder och annat till ditt djur."));
        const stage = el("div", "pet-stage");
        stage.appendChild(art({ kind: kind, color: color, name: name, worn: {}, bg: null }));
        body.appendChild(stage);
        const kinds = el("div", "pet-kinds");
        Object.keys(Art().KINDS).forEach(function (k) {
          const b = button("", "pet-kind" + (k === kind ? " is-on" : ""), function () { kind = k; color = Art().KINDS[k].colors[0].id; if (!name) name = ""; draw(); });
          b.setAttribute("aria-pressed", String(k === kind));
          b.innerHTML = Art().svg({ kind: k, color: Art().KINDS[k].colors[0].id, worn: {} }, { bare: true, size: 64 });
          b.appendChild(el("span", "", Art().KINDS[k].name));
          kinds.appendChild(b);
        });
        body.appendChild(kinds);
        const colors = el("div", "pet-colors");
        colors.setAttribute("role", "group");
        colors.setAttribute("aria-label", "Färg");
        Art().KINDS[kind].colors.forEach(function (c) {
          const b = button("", "pet-color" + (c.id === color ? " is-on" : ""), function () { color = c.id; draw(); });
          b.style.background = c.body;
          b.title = c.name;
          b.setAttribute("aria-label", c.name);
          b.setAttribute("aria-pressed", String(c.id === color));
          colors.appendChild(b);
        });
        body.appendChild(colors);
        const label = el("label", "pet-field");
        label.appendChild(el("span", "", "Vad heter ditt djur?"));
        const input = document.createElement("input");
        input.type = "text"; input.maxLength = 16; input.value = name; input.placeholder = Art().KINDS[kind].names[0];
        input.addEventListener("input", function () { name = input.value; });
        label.appendChild(input);
        body.appendChild(label);
        const go = button("Välj mig! →", "primary-button pet-go", function () {
          const pet = makePet(kind, color, input.value || Art().KINDS[kind].names[0]);
          deps.save(pet);
          writeSeen(ledger().total);
          closeOverlay();
          check();
          if (deps.refresh) deps.refresh();
          if (onDone) onDone(pet);
        });
        body.appendChild(go);
        panel.appendChild(body);
        input.focus({ preventScroll: true });
      };
      draw();
    });
  }

  const TABS = [["hat", "Hattar"], ["face", "Ansikte"], ["neck", "Halsband"], ["bg", "Bakgrund"], ["me", "Mitt djur"]];

  // The room: the pet, the shop and the settings of the pet.
  function room() {
    const state = { tab: "hat", selected: null, message: "" };
    overlay("Mitt djur", function (panel) {
      let stage = null;
      const draw = function () {
        const pet = petOf();
        const led = ledger();
        const bal = balanceOf(led.total, pet);
        const view = copy(pet);
        // trying an item on does not change anything until it is bought or put on
        const sel = state.selected && Art().item(state.selected);
        if (sel) { if (sel.slot === "bg") view.bg = sel.id; else { view.worn = view.worn || {}; view.worn[sel.slot] = sel.id; } }
        panel.replaceChildren();
        head(panel, pet.name);
        const body = el("div", "pet-body pet-room");

        const left = el("div", "pet-left");
        stage = el("button", "pet-stage pet-stage-tap");
        stage.type = "button";
        stage.setAttribute("aria-label", "Klappa " + pet.name);
        stage.innerHTML = Art().svg(view);
        stage.addEventListener("click", function () { cheer(stage, view); });
        left.appendChild(stage);
        const coins = el("p", "pet-coins");
        coins.append(el("span", "coin-icon"), el("b", "", String(bal)), document.createTextNode(" mynt"));
        left.appendChild(coins);
        body.appendChild(left);

        const right = el("div", "pet-right");
        const tabs = el("div", "pet-tabs");
        tabs.setAttribute("role", "tablist");
        TABS.forEach(function (t) {
          const b = button(t[1], "pet-tab" + (state.tab === t[0] ? " is-on" : ""), function () { state.tab = t[0]; state.selected = null; state.message = ""; draw(); });
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", String(state.tab === t[0]));
          tabs.appendChild(b);
        });
        right.appendChild(tabs);

        if (state.tab === "me") right.appendChild(settings(pet, function () { draw(); }));
        else right.appendChild(shop(pet, bal, state, draw, function () { cheer(stage, copy(petOf())); }));

        const msg = el("p", "pet-msg", state.message);
        msg.setAttribute("role", "status");
        msg.setAttribute("aria-live", "polite");
        right.appendChild(msg);

        const more = el("details", "pet-earn");
        more.appendChild(el("summary", "", "Så tjänar du mynt"));
        const ul = el("ul", "pet-earn-list");
        [["🏁", "En klar lektion ger 10 mynt, och några till om du fick två eller tre stjärnor."],
          ["💪", "Löser du en fråga efter att ha svarat fel får du ett mynt, upp till tre per lektion."],
          ["🔁", "Öva mer och Repetera ger ett mynt per ny fråga, upp till tio om dagen."],
          ["🎁", "Din lärare kan ge dig mynt, och nivåtestet ger fem."]].forEach(function (r) {
          const li = el("li");
          li.append(el("span", "", r[0]), document.createTextNode(" " + r[1]));
          ul.appendChild(li);
        });
        more.appendChild(ul);
        if (led.parts.length) {
          more.appendChild(el("p", "pet-earn-head", "Hittills har du fått:"));
          const sum = el("ul", "pet-earn-list");
          led.parts.forEach(function (p) { sum.appendChild(el("li", "", p.amount + " mynt · " + p.label)); });
          more.appendChild(sum);
        }
        right.appendChild(more);
        body.appendChild(right);
        panel.appendChild(body);
      };
      draw();
    });
  }

  function shop(pet, bal, state, redraw, hop) {
    const wrap = el("div", "pet-shop");
    const grid = el("div", "pet-grid");
    Art().ITEMS.filter(function (i) { return i.slot === state.tab; }).forEach(function (it) {
      const owned = pet.owned && pet.owned[it.id] !== undefined;
      const on = it.slot === "bg" ? pet.bg === it.id : (pet.worn || {})[it.slot] === it.id;
      const b = button("", "pet-item" + (state.selected === it.id ? " is-selected" : "") + (owned ? " is-owned" : ""), function () {
        state.selected = state.selected === it.id ? null : it.id;
        state.message = "";
        redraw();
      });
      b.setAttribute("aria-pressed", String(state.selected === it.id));
      const thumb = el("span", "pet-item-thumb");
      thumb.innerHTML = Art().thumb(it.id);
      b.append(thumb, el("span", "pet-item-name", it.name),
        el("span", "pet-item-price", on ? "På" : owned ? "✓ Ägs" : it.price + " mynt"));
      grid.appendChild(b);
    });
    wrap.appendChild(grid);

    const bar = el("div", "pet-action");
    const it = state.selected && Art().item(state.selected);
    if (!it) {
      bar.appendChild(el("p", "pet-hint", "Tryck på något för att prova det på " + pet.name + "."));
    } else {
      const owned = pet.owned && pet.owned[it.id] !== undefined;
      const on = it.slot === "bg" ? pet.bg === it.id : (pet.worn || {})[it.slot] === it.id;
      bar.appendChild(el("strong", "", it.name));
      const save = function (next, message) { deps.save(next.pet || next); state.message = message; state.selected = null; check(); redraw(); hop(); };
      if (owned && on) {
        bar.appendChild(button("Ta av", "pet-btn", function () { save(wearItem(pet, it.slot, null), it.name + " är avtagen."); }));
      } else if (owned) {
        bar.appendChild(button("Ta på", "primary-button pet-btn", function () { save(wearItem(pet, it.slot, it.id), it.name + " är på."); }));
      } else if (bal >= it.price) {
        bar.appendChild(button("Köp för " + it.price + " mynt", "primary-button pet-btn", function () {
          const r = buyItem(pet, it.id, bal);
          if (r.error) { state.message = r.error; redraw(); return; }
          save(r, it.name + " är köpt och på! 🎉");
        }));
      } else {
        bar.appendChild(el("span", "pet-short", "Du behöver " + (it.price - bal) + " mynt till (" + it.price + " mynt)."));
      }
    }
    wrap.appendChild(bar);
    return wrap;
  }

  function settings(pet, redraw) {
    const box = el("div", "pet-settings");
    const label = el("label", "pet-field");
    label.appendChild(el("span", "", "Namn"));
    const input = document.createElement("input");
    input.type = "text"; input.maxLength = 16; input.value = pet.name;
    label.appendChild(input);
    box.appendChild(label);
    box.appendChild(button("Spara namnet", "pet-btn", function () {
      const next = copy(petOf());
      next.name = cleanName(input.value, next.kind);
      deps.save(next);
      redraw();
    }));
    box.appendChild(el("p", "pet-sub", "Färg"));
    const colors = el("div", "pet-colors");
    Art().KINDS[pet.kind].colors.forEach(function (c) {
      const b = button("", "pet-color" + (c.id === pet.color ? " is-on" : ""), function () {
        const next = copy(petOf()); next.color = c.id; deps.save(next); redraw();
      });
      b.style.background = c.body; b.title = c.name; b.setAttribute("aria-label", c.name);
      colors.appendChild(b);
    });
    box.appendChild(colors);
    box.appendChild(el("p", "pet-sub", "Byt djur (dina saker följer med)"));
    const kinds = el("div", "pet-kinds");
    Object.keys(Art().KINDS).forEach(function (k) {
      const b = button("", "pet-kind" + (k === pet.kind ? " is-on" : ""), function () {
        const next = copy(petOf());
        next.kind = k;
        if (!Art().KINDS[k].colors.some(function (c) { return c.id === next.color; })) next.color = Art().KINDS[k].colors[0].id;
        if (next.name === Art().KINDS[pet.kind].names[0]) next.name = Art().KINDS[k].names[0];
        deps.save(next);
        redraw();
      });
      b.innerHTML = Art().svg({ kind: k, color: Art().KINDS[k].colors[0].id, worn: {} }, { bare: true, size: 56 });
      b.appendChild(el("span", "", Art().KINDS[k].name));
      kinds.appendChild(b);
    });
    box.appendChild(kinds);
    return box;
  }

  function open() {
    if (!enabled()) return;
    if (!petOf()) { chooser(function () { room(); }); return; }
    room();
  }

  // ----- the start page -----
  const LINES = ["Vi räknar tillsammans!", "Ett fel är bara ett steg på vägen.", "Jag tror på dig!", "Ska vi lära oss något nytt?", "Du blir bättre för varje tal.", "Det är okej att ta det i din egen takt."];

  function speech(pet, fresh, bal) {
    if (fresh > 0) return "Du fick " + fresh + (fresh === 1 ? " nytt mynt" : " nya mynt") + "!";
    const cheapest = Art().ITEMS.filter(function (i) { return !(pet.owned && pet.owned[i.id] !== undefined); }).sort(function (a, b) { return a.price - b.price; })[0];
    if (cheapest && bal >= cheapest.price) return "Du har nog med mynt för något nytt i butiken!";
    const day = Math.floor(Date.now() / 86400000);
    return LINES[(day + String(pet.name).length) % LINES.length];
  }

  function render(container) {
    if (!container) return;
    if (!deps || !enabled()) { container.hidden = true; container.replaceChildren(); updateChip(); return; }
    const pet = petOf();
    container.hidden = false;
    container.replaceChildren();
    if (!pet) {
      container.className = "pet-card is-invite";
      const faces = el("div", "pet-invite-faces");
      ["dog", "cat", "penguin"].forEach(function (k) {
        const f = el("span", "pet-invite-face");
        f.innerHTML = Art().svg({ kind: k, color: Art().KINDS[k].colors[0].id, worn: {} }, { bare: true, size: 64 });
        faces.appendChild(f);
      });
      const copy = el("div", "pet-card-copy");
      copy.appendChild(el("h3", "", "Skaffa ett eget djur! 🐾"));
      copy.appendChild(el("p", "", "Välj en mops, en katt eller en pingvin. Du tjänar mynt när du lär dig, och kan köpa kläder och annat till ditt djur."));
      container.append(faces, copy, button("Välj ditt djur", "primary-button", open));
      updateChip();
      return;
    }
    container.className = "pet-card";
    const bal = balance();
    // new coins are announced where the student sees them: on the summary of a lesson (ribbon) or here, but not while a
    // lesson is open (the page behind it is redrawn after every answer)
    const visible = !document.body.classList.contains("player-open");
    const fresh = visible ? newCoins() : 0;
    const stage = el("button", "pet-stage pet-stage-card");
    stage.type = "button";
    stage.setAttribute("aria-label", "Klappa " + pet.name);
    stage.innerHTML = Art().svg(pet);
    stage.addEventListener("click", function () { cheer(stage, pet); });
    const copy = el("div", "pet-card-copy");
    const bubble = el("p", "pet-bubble", speech(pet, fresh, bal));
    copy.appendChild(el("h3", "", pet.name));
    copy.appendChild(bubble);
    const row = el("div", "pet-card-row");
    const coins = el("span", "pet-coins-chip");
    coins.append(el("span", "coin-icon"), el("b", "", String(bal)));
    row.append(coins, button("Mitt djur och butiken", "pet-btn", open));
    copy.appendChild(row);
    container.append(stage, copy);
    if (fresh > 0) {
      writeSeen(ledger().total);
      if (!reduced()) setTimeout(function () { cheer(stage, pet); }, 400);
    }
    updateChip();
  }

  // ----- reward moments -----
  // On the summary of a lesson or a round: the pet cheers, with the coins that were earned since it was last shown.
  function ribbon() {
    if (!deps || !enabled() || !petOf()) return null;
    const pet = petOf();
    const fresh = newCoins();
    if (fresh <= 0) return null;
    writeSeen(ledger().total);
    check();
    const box = el("div", "pet-ribbon");
    const host = el("div", "pet-ribbon-art");
    host.innerHTML = Art().svg(pet, { mood: "happy", bare: true });
    const copy = el("div", "pet-ribbon-copy");
    copy.appendChild(el("strong", "", pet.name + ": Bra jobbat!"));
    copy.appendChild(el("span", "", "Du fick " + fresh + (fresh === 1 ? " nytt mynt" : " nya mynt") + "."));
    box.append(host, copy, button("Till " + pet.name, "pet-btn", open));
    return box;
  }

  // The pet's head for the lesson footer. `mood` is "happy" when the answer was right.
  function face(mood) {
    if (!deps || !enabled() || !petOf()) return null;
    const pet = petOf();
    const f = el("span", "pet-face");
    f.innerHTML = Art().face(pet, mood);
    return f;
  }

  return {
    init: init, render: render, check: check, ribbon: ribbon, face: face, open: open, enabled: enabled, balance: balance,
    earned: earned, balanceOf: balanceOf, spentOf: spentOf, makePet: makePet, buyItem: buyItem, wearItem: wearItem, cleanName: cleanName,
    KEY: KEY, GIFTS: GIFTS, LIMITS: { WELCOME: WELCOME, LESSON: LESSON, FIXED_PER_LESSON: FIXED_PER_LESSON, PRACTICE_PER_DAY: PRACTICE_PER_DAY, PLACEMENT: PLACEMENT }
  };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaPet;
