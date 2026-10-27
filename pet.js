// Your own pet: one of nine animals that you earn coins ("mynt") for by learning, and spend them on clothes, accessories,
// backgrounds and furniture, and on treats and toys. It is meant to go with the learning, not to replace it:
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
// Pure parts, also used by the tests: earned(ctx), areaCounts(ctx), lockOf(item, counts), balanceOf(total, pet), makePet, buyItem, wearItem.
//   record = { v: 1, kind, color, name, owned: { itemId: pricePaid }, worn: { hat, face, neck }, bg, room: { wall, rug, bed, ... }, scene: "room" | "bg", at,
//              use: { day, food, play, fed, played, love, spent } }
//
// Food and play ("Mat och lek"): treats and toys are used up, not kept. Each costs a few coins and sets off a short animation. The pet
// is never hungry or bored when left alone: this is only something nice to spend coins on. To keep it small there is a limit per
// day (the pet is "full" or "tired" for the rest of the day, and nothing is charged). Every treat or toy gives a heart, and the
// favourite of the animal gives two. The hearts make the friendship grow: Nya vänner, Kompisar, Bästisar, Superbästisar.
// `use` counts the day's treats and plays (reset when the day changes), the totals, the hearts and the coins spent.
//   useThing(pet, id, balance, now) -> { pet, thing, favorite, levelUp } or { error }   levelOf(pet), usedToday(pet, now)

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
  const FOOD_PER_DAY = 3;          // treats a day, then the pet is full
  const PLAY_PER_DAY = 5;          // plays a day, then the pet is tired
  const LEVELS = [[0, "Nya vänner"], [6, "Kompisar"], [20, "Bästisar"], [50, "Superbästisar"]];   // hearts needed for each step of the friendship

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
    s += Math.max(0, Number(pet && pet.use && pet.use.spent) || 0);   // treats and toys
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

  // ----- food and play (pure) -----
  // The treats and toys of today: { food, play }. A new day starts from zero.
  function usedToday(pet, now) {
    const u = (pet && pet.use) || {};
    const same = u.day === dayKey(now === undefined ? Date.now() : now);
    return { food: same ? Math.max(0, Number(u.food) || 0) : 0, play: same ? Math.max(0, Number(u.play) || 0) : 0 };
  }

  // The friendship: { index, name, love, next: { at, name } | null }
  function levelOf(pet) {
    const love = Math.max(0, Number(pet && pet.use && pet.use.love) || 0);
    let index = 0;
    LEVELS.forEach(function (l, n) { if (love >= l[0]) index = n; });
    const next = LEVELS[index + 1];
    return { index: index, name: LEVELS[index][1], love: love, next: next ? { at: next[0], name: next[1] } : null };
  }

  // Give a treat or play with a toy. Returns { pet, thing, favorite, levelUp } (levelUp: the new name of the friendship, or null),
  // or { error } when it is not possible (nothing is changed or charged then).
  function useThing(pet, id, balance, now) {
    const t = Art().thing(id);
    if (!t) return { error: "Den saken finns inte." };
    const when = now === undefined ? Date.now() : now;
    const used = usedToday(pet, when);
    if (t.type === "food" && used.food >= FOOD_PER_DAY) return { error: pet.name + " är mätt för idag. Imorgon finns det mer att äta!" };
    if (t.type === "toy" && used.play >= PLAY_PER_DAY) return { error: pet.name + " är trött efter all lek. Ni kan leka mer imorgon!" };
    if (balance < t.price) return { error: "Du behöver " + (t.price - balance) + " mynt till." };
    const before = levelOf(pet);
    const next = copy(pet);
    const u = next.use = Object.assign({ fed: 0, played: 0, love: 0, spent: 0 }, next.use || {});
    u.day = dayKey(when);
    u.food = used.food;
    u.play = used.play;
    if (t.type === "food") { u.food += 1; u.fed += 1; } else { u.play += 1; u.played += 1; }
    const likes = (Art().KINDS[pet.kind] || {}).likes || {};
    const favorite = likes[t.type] === id;
    u.love += favorite ? 2 : 1;
    u.spent += t.price;
    const after = levelOf(next);
    return { pet: next, thing: t, favorite: favorite, levelUp: after.index > before.index ? after.name : null };
  }

  function careMessage(pet, r) {
    const t = r.thing;
    let m = t.type === "food"
      ? (r.favorite ? pet.name + " älskar " + t.pl + "! Det var favoriten. 💛" : "Mums! " + pet.name + " åt " + t.a + ".")
      : (r.favorite ? pet.name + " älskar " + t.pl + "! Så roligt! 💛" : pet.name + " lekte med " + t.a + "!");
    if (r.levelUp) m += " 🎉 Nu är ni " + r.levelUp.toLowerCase() + "!";
    return m;
  }

  // Finished lessons per area ({ tal: 3, geometri: 1 }): what unlocks the pieces of the themed sets.
  function areaCounts(ctx) {
    const counts = {};
    ctx.lessons.forEach(function (lesson) {
      if (lesson.isParentLesson) return;
      const sum = L().summarize(lesson, ctx.getProgress, ctx.lessons);
      if (sum.total > 0 && sum.state === "complete") counts[lesson.area] = (counts[lesson.area] || 0) + 1;
    });
    return counts;
  }

  // null when the piece can be bought, otherwise { need, have, area, areaName, set }. Without counts nothing is locked.
  function lockOf(it, counts) {
    if (!it || !it.set || !counts) return null;
    const set = Art().SETS.find(function (s) { return s.id === it.set; });
    if (!set) return null;
    const have = counts[set.area] || 0;
    return have >= it.need ? null : { need: it.need, have: have, area: set.area, areaName: set.areaName, set: set };
  }

  // Buy an item (and put it on). Returns { pet, error }. counts = areaCounts(...), for the themed sets.
  function buyItem(pet, itemId, balance, counts) {
    const it = Art().item(itemId);
    if (!it) return { error: "Den saken finns inte." };
    if (pet.owned && pet.owned[itemId] !== undefined) return { error: "Du har redan den." };
    const lock = lockOf(it, counts);
    if (lock) return { error: "Klara " + lock.need + " lektioner i " + lock.areaName + " först (du har klarat " + lock.have + ")." };
    if (balance < it.price) return { error: "Du behöver " + (it.price - balance) + " mynt till." };
    const next = copy(pet);
    next.owned = next.owned || {};
    next.owned[itemId] = it.price;
    return { pet: wearItem(next, it.slot, itemId).pet };
  }

  // Is the item in use? (worn, in the room, or the background)
  function isOn(pet, it) {
    if (it.slot === "bg") return pet.bg === it.id;
    if (Art().isRoomSlot(it.slot)) return (pet.room || {})[it.slot] === it.id;
    return (pet.worn || {})[it.slot] === it.id;
  }

  // Put an owned item on (itemId) or take the slot's item off (itemId = null).
  function wearItem(pet, slot, itemId) {
    const next = copy(pet);
    if (slot === "bg") { next.bg = itemId && next.owned[itemId] !== undefined ? itemId : null; return { pet: next }; }
    if (Art().isRoomSlot(slot)) {
      next.room = next.room || {};
      const it = itemId && Art().item(itemId);
      if (!it) delete next.room[slot];
      else if (next.owned[itemId] !== undefined && it.slot === slot) {
        next.room[slot] = itemId;
        if (!next.scene) next.scene = "room";   // the first thing in the room: from now on the pet is shown in it
      }
      return { pet: next };
    }
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

  // the pet jumps for a moment (and is happy); fx is an extra thing in the picture (a treat, a toy) that moves by itself
  function cheer(host, pet, fx) {
    if (!host || host.dataset.cheering) return;
    host.dataset.cheering = "1";
    host.innerHTML = Art().svg(pet, { mood: "happy" });
    if (fx) host.appendChild(fx);
    setTimeout(function () {
      host.innerHTML = Art().svg(pet);
      delete host.dataset.cheering;
    }, reduced() ? 900 : fx ? 2400 : 1500);
  }

  // the treat or toy as it moves in the picture: food goes to the mouth, toys bounce, fly, roll or float
  function careFx(t) {
    const fx = el("span", "pet-fx pet-fx-" + (t.type === "food" ? "eat" : t.motion));
    fx.innerHTML = Art().snack(t.id);
    return fx;
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

  const TABS = [["hat", "Hattar"], ["face", "Ansikte"], ["neck", "Halsband"], ["bg", "Bakgrund"], ["sets", "Teman"], ["room", "Rum"], ["care", "Mat och lek"], ["me", "Mitt djur"]];

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
        if (sel) {
          if (sel.slot === "bg") view.bg = sel.id;
          else if (Art().isRoomSlot(sel.slot)) { view.room = view.room || {}; view.room[sel.slot] = sel.id; }
          else { view.worn = view.worn || {}; view.worn[sel.slot] = sel.id; }
        }
        // the room tab shows the room, the background tab the background, the others what the pet shows at home
        if (state.tab === "room") view.scene = "room"; else if (state.tab === "bg") view.scene = "bg";
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
        const wholeSet = Art().SETS.find(function (s) {
          return ["hat", "face", "neck"].every(function (slot) { const it = Art().item((view.worn || {})[slot]); return it && it.set === s.id; });
        });
        if (wholeSet) {
          stage.classList.add("is-set");
          left.appendChild(el("p", "pet-setbonus", "✨ Hela " + wholeSet.name + "-setet!"));
        }
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
        else if (state.tab === "care") right.appendChild(care(pet, bal, state, draw, function (fx) { cheer(stage, copy(petOf()), fx); }));
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
          ["🎁", "Din lärare kan ge dig mynt, och nivåtestet ger fem."],
          ["🧩", "Teman öppnas när du klarar lektioner i ett område, och köps sedan med mynt."],
          ["🍎", "Mynt kan också bli godsaker och leksaker åt " + pet.name + " (Mat och lek)."]].forEach(function (r) {
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

  function itemButton(pet, it, state, redraw, counts) {
    const owned = pet.owned && pet.owned[it.id] !== undefined;
    const on = isOn(pet, it);
    const lock = owned ? null : lockOf(it, counts);
    const b = button("", "pet-item" + (state.selected === it.id ? " is-selected" : "") + (owned ? " is-owned" : "") + (lock ? " is-locked" : ""), function () {
      state.selected = state.selected === it.id ? null : it.id;
      state.message = "";
      redraw();
    });
    b.setAttribute("aria-pressed", String(state.selected === it.id));
    const thumb = el("span", "pet-item-thumb");
    thumb.innerHTML = Art().thumb(it.id);
    b.append(thumb, el("span", "pet-item-name", it.name),
      el("span", "pet-item-price", on ? "På" : owned ? "✓ Ägs" : lock ? "🔒 " + lock.need + " lektioner" : it.price + " mynt"));
    return b;
  }

  function shop(pet, bal, state, redraw, hop) {
    const counts = areaCounts({ lessons: deps.getCourse().lessons, getProgress: deps.getProgress });
    const wrap = el("div", "pet-shop");
    if (state.tab === "sets") {
      wrap.appendChild(el("p", "pet-hint", "Varje område har ett eget tema. Delarna öppnas när du klarar lektioner i området, och köps sedan med mynt."));
      Art().SETS.forEach(function (set) {
        const items = Art().ITEMS.filter(function (i) { return i.set === set.id; });
        const have = counts[set.area] || 0;
        const all = items.every(function (i) { return pet.owned && pet.owned[i.id] !== undefined; });
        const nextLocked = items.find(function (i) { return i.need > have; });
        const section = el("section", "pet-set");
        section.appendChild(el("h4", "pet-set-title", set.name + (all ? " ⭐" : "")));
        section.appendChild(el("p", "pet-set-sub", set.areaName + ": " + have + (have === 1 ? " klar lektion" : " klara lektioner") + ". " +
          (all ? "Du har hela temat!" : nextLocked ? "Nästa del öppnas när du klarat " + nextLocked.need + "." : "Alla delar är öppna.")));
        const grid = el("div", "pet-grid");
        items.forEach(function (it) { grid.appendChild(itemButton(pet, it, state, redraw, counts)); });
        section.appendChild(grid);
        wrap.appendChild(section);
      });
    } else if (state.tab === "room") {
      const where = el("div", "pet-scene");
      where.appendChild(el("span", "pet-scene-label", "Visa på startsidan:"));
      [["room", "Rummet"], ["bg", "Bakgrunden"]].forEach(function (s) {
        const b = button(s[1], "tv-chip pet-scene-btn" + ((pet.scene || "bg") === s[0] ? " is-on" : ""), function () {
          const next = copy(petOf());
          next.scene = s[0];
          deps.save(next);
          redraw();
        });
        where.appendChild(b);
      });
      wrap.appendChild(where);
      wrap.appendChild(el("p", "pet-hint", "Köp möbler och saker till " + pet.name + "s rum. Det du har på plats syns i rummet."));
      Art().ROOM_SLOTS.forEach(function (slot) {
        const items = Art().ITEMS.filter(function (i) { return i.slot === slot[0]; });
        const section = el("section", "pet-set");
        section.appendChild(el("h4", "pet-set-title", slot[1]));
        const grid = el("div", "pet-grid");
        items.forEach(function (it) { grid.appendChild(itemButton(pet, it, state, redraw, counts)); });
        section.appendChild(grid);
        wrap.appendChild(section);
      });
    } else {
      const grid = el("div", "pet-grid");
      Art().ITEMS.filter(function (i) { return i.slot === state.tab && !i.set; }).forEach(function (it) { grid.appendChild(itemButton(pet, it, state, redraw, counts)); });
      wrap.appendChild(grid);
    }

    const bar = el("div", "pet-action");
    const it = state.selected && Art().item(state.selected);
    if (!it) {
      bar.appendChild(el("p", "pet-hint", "Tryck på något för att prova det på " + pet.name + "."));
    } else {
      const owned = pet.owned && pet.owned[it.id] !== undefined;
      const on = isOn(pet, it);
      const lock = owned ? null : lockOf(it, counts);
      bar.appendChild(el("strong", "", it.name));
      const save = function (next, message) { deps.save(next.pet || next); state.message = message; state.selected = null; check(); redraw(); hop(); };
      if (owned && on) {
        bar.appendChild(button("Ta av", "pet-btn", function () { save(wearItem(pet, it.slot, null), it.name + " är avtagen."); }));
      } else if (owned) {
        bar.appendChild(button("Ta på", "primary-button pet-btn", function () { save(wearItem(pet, it.slot, it.id), it.name + " är på."); }));
      } else if (lock) {
        bar.appendChild(el("span", "pet-short", "Klara " + lock.need + " lektioner i " + lock.areaName + " för att låsa upp den. Du har klarat " + lock.have + "."));
      } else if (bal >= it.price) {
        bar.appendChild(button("Köp för " + it.price + " mynt", "primary-button pet-btn", function () {
          const r = buyItem(pet, it.id, bal, counts);
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

  function countOf(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function careButton(pet, t, state, redraw) {
    const favorite = ((Art().KINDS[pet.kind] || {}).likes || {})[t.type] === t.id;
    const b = button("", "pet-item pet-care-item" + (state.selected === t.id ? " is-selected" : "") + (favorite ? " is-fav" : ""), function () {
      state.selected = state.selected === t.id ? null : t.id;
      state.message = "";
      redraw();
    });
    b.setAttribute("aria-pressed", String(state.selected === t.id));
    const thumb = el("span", "pet-item-thumb");
    thumb.innerHTML = Art().snack(t.id);
    b.append(thumb, el("span", "pet-item-name", t.name), el("span", "pet-item-price", (favorite ? "💛 Favorit · " : "") + t.price + (t.price === 1 ? " mynt" : " mynt")));
    return b;
  }

  // "Mat och lek": treats and toys for the pet, and how the friendship is going
  function care(pet, bal, state, redraw, hop) {
    const wrap = el("div", "pet-shop pet-care");
    const lvl = levelOf(pet);
    const used = usedToday(pet, Date.now());
    const use = pet.use || {};
    const status = el("div", "pet-friend");
    const hearts = el("span", "pet-hearts");
    hearts.setAttribute("aria-hidden", "true");
    for (let i = 0; i < LEVELS.length - 1; i++) hearts.appendChild(el("span", i < lvl.index ? "is-full" : "", i < lvl.index ? "♥" : "♡"));
    const line = el("p", "pet-friend-line");
    line.append(el("strong", "", "Du och " + pet.name + " är " + lvl.name.toLowerCase()));
    status.append(hearts, line);
    if (lvl.next) {
      const bar = document.createElement("progress");
      bar.max = lvl.next.at - LEVELS[lvl.index][0];
      bar.value = lvl.love - LEVELS[lvl.index][0];
      bar.setAttribute("aria-label", "Vänskapen mot " + lvl.next.name.toLowerCase());
      status.appendChild(bar);
      status.appendChild(el("p", "pet-friend-sub", lvl.love + (lvl.love === 1 ? " hjärta" : " hjärtan") + ". Vid " + lvl.next.at + " är ni " + lvl.next.name.toLowerCase() + "."));
    } else {
      status.appendChild(el("p", "pet-friend-sub", lvl.love + " hjärtan. Bättre vänner än så går inte att bli! 💛"));
    }
    wrap.appendChild(status);
    wrap.appendChild(el("p", "pet-hint", "Godsaker och leksaker tar slut direkt, men " + pet.name + " blir glad och ni blir bättre vänner. Favoriten ger dubbelt så många hjärtan. " +
      pet.name + " mår lika bra om du inte gör något av det här."));
    const today = el("p", "pet-today", "Idag: " + used.food + " av " + FOOD_PER_DAY + " godsaker · " + used.play + " av " + PLAY_PER_DAY + " lekar" +
      (use.fed || use.played ? " · Hittills " + countOf(use.fed || 0, "godsak", "godsaker") + " och " + countOf(use.played || 0, "lek", "lekar") : ""));
    wrap.appendChild(today);

    [["Mat", Art().FOODS], ["Lek", Art().TOYS]].forEach(function (g) {
      const section = el("section", "pet-set");
      section.appendChild(el("h4", "pet-set-title", g[0]));
      const grid = el("div", "pet-grid");
      g[1].forEach(function (t) { grid.appendChild(careButton(pet, t, state, redraw)); });
      section.appendChild(grid);
      wrap.appendChild(section);
    });

    const bar = el("div", "pet-action");
    const t = state.selected && Art().thing(state.selected);
    if (!t) {
      bar.appendChild(el("p", "pet-hint", "Välj en godsak eller en leksak."));
    } else {
      bar.appendChild(el("strong", "", t.name));
      const full = t.type === "food" ? used.food >= FOOD_PER_DAY : used.play >= PLAY_PER_DAY;
      if (full) {
        bar.appendChild(el("span", "pet-short", t.type === "food" ? pet.name + " är mätt för idag. Imorgon finns det mer!" : pet.name + " är trött efter all lek. Ni kan leka mer imorgon!"));
      } else if (bal >= t.price) {
        bar.appendChild(button((t.type === "food" ? "Ge " + pet.name + " " : "Lek med ") + t.name.toLowerCase() + " (" + t.price + " mynt)", "primary-button pet-btn", function () {
          const r = useThing(petOf(), t.id, bal);
          if (r.error) { state.message = r.error; redraw(); return; }
          deps.save(r.pet);
          state.message = careMessage(r.pet, r);
          state.selected = null;
          check();
          redraw();
          hop(careFx(t));
        }));
      } else {
        bar.appendChild(el("span", "pet-short", "Du behöver " + (t.price - bal) + " mynt till (" + t.price + " mynt)."));
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
      ["dog", "cat", "fox", "hedgehog", "dragon"].forEach(function (k) {
        const f = el("span", "pet-invite-face");
        f.innerHTML = Art().svg({ kind: k, color: Art().KINDS[k].colors[0].id, worn: {} }, { bare: true, size: 64 });
        faces.appendChild(f);
      });
      const copy = el("div", "pet-card-copy");
      copy.appendChild(el("h3", "", "Skaffa ett eget djur! 🐾"));
      copy.appendChild(el("p", "", "Välj ett av nio djur, till exempel en mops, en räv eller en drake. Du tjänar mynt när du lär dig, och kan köpa kläder, godsaker och annat till ditt djur."));
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

  // ----- the pet's voice in the lessons: a speech bubble, short and kind -----
  // kind: start (first question), right, rightAgain (after a mistake), wrong, wrongAgain, open (questions left), done
  const SAYINGS = {
    start: ["Nu är det din tur. Ta det lugnt, ett steg i taget!", "Du klarar det här. Ta all tid du behöver!"],
    right: ["Snyggt!", "Där satt den!", "Bra jobbat!", "Just så!"],
    rightAgain: ["Rätt! Bra att du fortsatte!", "Du gav inte upp, och nu satt den!"],
    wrong: ["Nästan! Läs tipset och prova igen.", "Inte riktigt än. Läs tipset och försök en gång till.", "Det är okej att göra fel. Läs tipset och prova igen."],
    wrongAgain: ["Du kämpar på, bra! Läs tipset en gång till.", "Fortsätt försöka, du är på väg!"],
    wrongAgainExample: ["Svårt? Titta på ett löst exempel, eller läs tipset en gång till.", "Ta ett löst exempel om du vill, och prova sedan igen."],
    open: ["Några frågor kvar. Du klarar dem!"],
    done: ["Hela lektionen klar! Det här var duktigt.", "Så bra! Nu har du lärt dig något nytt."],
    fluency: ["Bra träning! Du blir snabbare för varje runda.", "Så där, lite i taget. Det är så tabellerna sätter sig.", "Bra kämpat! De vingliga kommer tillbaka snart."]
  };
  const lastSaid = {};

  function saying(kind, options) {
    const key = kind === "wrongAgain" && options && options.example ? "wrongAgainExample" : kind;
    const list = SAYINGS[key] || SAYINGS.right;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === lastSaid[key]) i = (i + 1) % list.length;   // not the same line twice in a row
    lastSaid[key] = i;
    return list[i];
  }

  // The pet's head and what it says, for the footer of a lesson (or null when the student has no pet).
  function say(kind, options) {
    if (!deps || !enabled() || !petOf()) return null;
    const pet = petOf();
    const wrap = el("span", "pet-say");
    const face = el("span", "pet-face");
    face.innerHTML = Art().face(pet, kind === "right" || kind === "rightAgain" || kind === "done" || kind === "fluency" ? "happy" : "");
    wrap.append(face, el("span", "pet-say-bubble", saying(kind, options)));
    return wrap;
  }

  // The pet's head alone. `mood` is "happy" when the answer was right.
  function face(mood) {
    if (!deps || !enabled() || !petOf()) return null;
    const pet = petOf();
    const f = el("span", "pet-face");
    f.innerHTML = Art().face(pet, mood);
    return f;
  }

  return {
    init: init, current: function () { return deps && enabled() ? petOf() : null; }, render: render, check: check, ribbon: ribbon, face: face, say: say, open: open, enabled: enabled, balance: balance,
    earned: earned, useThing: useThing, levelOf: levelOf, usedToday: usedToday, careMessage: careMessage, areaCounts: areaCounts, lockOf: lockOf, isOn: isOn, balanceOf: balanceOf, spentOf: spentOf, makePet: makePet, buyItem: buyItem, wearItem: wearItem, cleanName: cleanName,
    KEY: KEY, GIFTS: GIFTS, LIMITS: { FOOD_PER_DAY: FOOD_PER_DAY, PLAY_PER_DAY: PLAY_PER_DAY, LEVELS: LEVELS, WELCOME: WELCOME, LESSON: LESSON, FIXED_PER_LESSON: FIXED_PER_LESSON, PRACTICE_PER_DAY: PRACTICE_PER_DAY, PLACEMENT: PLACEMENT }
  };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaPet;
