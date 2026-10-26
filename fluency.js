// Snabbträning: short, calm rounds that make the multiplication tables and the basic number facts quick.
//
// A round is ten questions (5 or 20 if you like). There is no clock ticking on the screen, no coins and no streak to
// lose. What is measured is how right and how quick each fact is, over time, and the facts that are still shaky come back
// more often, the quick ones more seldom (a simple spaced repetition: box 0 to 4). The student sees progress ("faster than
// last time"), not a score to beat.
//
//   GaussicaFluency.SETS                      the kinds of facts
//   GaussicaFluency.facts(setId, options)     every fact of a set { id, set, a, b, prompt, answer }
//   GaussicaFluency.plan(record, setId, options)  the facts for a round, shaky ones first
//   GaussicaFluency.update(stat, correct, ms, now, setId)   what is remembered about one fact
//   GaussicaFluency.mastery(stat)             "new" | "shaky" | "learning" | "secure" | "fast"
//   GaussicaFluency.summary(record, setId, options)   counts and average time for a set
//   GaussicaFluency.open(deps)                the full-screen training
//   GaussicaFluency.renderCard(container, record, hooks)   the card on the start page
//   GaussicaFluency.teacherLine(record)       one line for the teacher view
//
// The record is kept in the student's progress under the key "fluency":
//   { v: 1, facts: { "m-7-8": { n, ok, ms, box, due, last, streak } }, sessions: [{ at, set, n, ok, ms }] }

window.GaussicaFluency = (function () {
  "use strict";

  const KEY = "fluency";
  const DAY = 86400000;
  const INTERVALS = [0, DAY, 3 * DAY, 7 * DAY, 21 * DAY];   // how long until a fact is due again, by box
  const MAX_SESSIONS = 40;

  // "fast" for a fact: an answer at least this quick (typing time included) counts towards box 3 and 4
  const SETS = [
    { id: "mul", name: "Multiplikationstabellerna", short: "Tabeller", fast: 5000, tables: true, text: "7 · 8" },
    { id: "div", name: "Division med tabellerna", short: "Division", fast: 6000, tables: true, text: "56/7" },
    { id: "tio", name: "Tiokompisar", short: "Tiokompisar", fast: 3500, tables: false, text: "3 + ? = 10" },
    { id: "tjugo", name: "Kompisar till 20", short: "Till 20", fast: 4000, tables: false, text: "13 + ? = 20" },
    { id: "plus", name: "Plus till 20", short: "Plus", fast: 4000, tables: false, text: "7 + 8" },
    { id: "minus", name: "Minus till 20", short: "Minus", fast: 4500, tables: false, text: "15 − 7" }
  ];

  function setOf(id) { return SETS.find(function (s) { return s.id === id; }) || SETS[0]; }

  // ===== the facts (pure) =====
  // a fact is the same whichever way round it is asked (7 · 8 and 8 · 7), so a and b are sorted
  function facts(setId, options) {
    options = options || {};
    const tables = options.tables && options.tables.length ? options.tables : null;
    const out = [];
    const keep = function (a, b) { return !tables || tables.indexOf(a) >= 0 || tables.indexOf(b) >= 0; };
    if (setId === "mul" || setId === "div") {
      for (let a = 2; a <= 10; a++) for (let b = a; b <= 10; b++) {
        if (!keep(a, b)) continue;
        out.push(setId === "mul"
          ? { id: "m-" + a + "-" + b, set: "mul", a: a, b: b, prompt: a + " · " + b, answer: a * b }
          : { id: "d-" + a + "-" + b, set: "div", a: a, b: b, prompt: (a * b) + "/" + a, answer: b });
      }
    } else if (setId === "tio") {
      for (let a = 1; a <= 9; a++) out.push({ id: "t-" + a, set: "tio", a: a, b: 10 - a, prompt: a + " + ? = 10", answer: 10 - a });
    } else if (setId === "tjugo") {
      for (let a = 11; a <= 19; a++) out.push({ id: "tj-" + a, set: "tjugo", a: a, b: 20 - a, prompt: a + " + ? = 20", answer: 20 - a });
    } else if (setId === "plus") {
      for (let a = 2; a <= 10; a++) for (let b = a; b <= 10; b++) out.push({ id: "p-" + a + "-" + b, set: "plus", a: a, b: b, prompt: a + " + " + b, answer: a + b });
    } else if (setId === "minus") {
      for (let a = 2; a <= 10; a++) for (let b = a; b <= 10; b++) out.push({ id: "s-" + a + "-" + b, set: "minus", a: a, b: b, prompt: (a + b) + " − " + a, answer: b });
    }
    return out;
  }

  // the question the student sees, with the numbers the other way round now and then
  function asked(fact, rand) {
    if ((fact.set === "mul" || fact.set === "plus") && fact.a !== fact.b && (rand || Math.random)() < 0.5) {
      return Object.assign({}, fact, { prompt: fact.b + (fact.set === "mul" ? " · " : " + ") + fact.a });
    }
    if (fact.set === "div" && fact.a !== fact.b && (rand || Math.random)() < 0.5) {
      return Object.assign({}, fact, { prompt: (fact.a * fact.b) + "/" + fact.b, answer: fact.a });
    }
    if (fact.set === "minus" && fact.a !== fact.b && (rand || Math.random)() < 0.5) {
      return Object.assign({}, fact, { prompt: (fact.a + fact.b) + " − " + fact.b, answer: fact.a });
    }
    return fact;
  }

  // "7 · 8 = 56", "3 + ? = 10" becomes "3 + 7 = 10"
  function solved(fact) {
    return fact.prompt.indexOf("?") >= 0 ? fact.prompt.replace("?", fact.answer) : fact.prompt + " = " + fact.answer;
  }

  // ===== what is remembered about a fact (pure) =====
  function update(stat, correct, ms, now, setId) {
    const s = Object.assign({ n: 0, ok: 0, ms: null, box: 0, due: 0, last: 0, streak: 0 }, stat || {});
    s.n += 1;
    if (correct) {
      s.ok += 1;
      s.streak += 1;
      s.ms = s.ms === null ? Math.round(ms) : Math.round(s.ms * 0.6 + ms * 0.4);
      if (ms <= setOf(setId).fast) s.box = Math.min(4, s.box + 1);
      else s.box = Math.max(s.box, 1);                 // right but slow: not shaky any more, not quick yet
    } else {
      s.streak = 0;
      s.box = 0;
    }
    s.last = now;
    s.due = now + INTERVALS[s.box];
    return s;
  }

  function mastery(stat) {
    if (!stat || !stat.n) return "new";
    if (stat.box >= 4) return "fast";
    if (stat.box === 3) return "secure";
    if (stat.box >= 1) return "learning";
    return "shaky";
  }

  // ===== choosing the facts of a round (pure) =====
  const BOX_WEIGHT = [6, 3, 1.5, 0.6, 0.25];

  function plan(record, setId, options) {
    options = options || {};
    const rand = options.rand || Math.random;
    const now = options.now || Date.now();
    const n = options.n || 10;
    const stats = (record && record.facts) || {};
    let pool = [];
    if (setId === "mix") ["mul", "div", "tio", "tjugo", "plus", "minus"].forEach(function (s) { pool = pool.concat(facts(s, options)); });
    else pool = facts(setId, options);
    const maxNew = Math.max(1, Math.round(n * 0.4));
    const chosen = [];
    let fresh = 0;
    const candidates = pool.slice();
    while (chosen.length < n && candidates.length) {
      let total = 0;
      const weights = candidates.map(function (f) {
        const st = stats[f.id];
        let w = st ? BOX_WEIGHT[st.box] || 1 : 1.2;
        if (st && st.due > now) w *= 0.2;
        if (!st && fresh >= maxNew) w = 0;
        total += w;
        return w;
      });
      if (total <= 0) { candidates.forEach(function (f, i) { weights[i] = 1; total += 1; }); }
      let r = rand() * total, pick = candidates.length - 1;
      for (let i = 0; i < candidates.length; i++) { r -= weights[i]; if (r <= 0) { pick = i; break; } }
      const f = candidates.splice(pick, 1)[0];
      if (!stats[f.id]) fresh += 1;
      chosen.push(f);
    }
    return chosen;
  }

  // ===== progress (pure) =====
  function summary(record, setId, options) {
    const stats = (record && record.facts) || {};
    const list = setId === "mix" ? ["mul", "div", "tio", "tjugo", "plus", "minus"].reduce(function (a, s) { return a.concat(facts(s, options)); }, []) : facts(setId, options);
    const counts = { new: 0, shaky: 0, learning: 0, secure: 0, fast: 0 };
    let sum = 0, k = 0;
    list.forEach(function (f) {
      const st = stats[f.id];
      counts[mastery(st)] += 1;
      if (st && st.ms !== null && st.ms !== undefined) { sum += st.ms; k += 1; }
    });
    return { total: list.length, counts: counts, avgMs: k ? Math.round(sum / k) : null, practised: list.length - counts.new };
  }

  function median(list) {
    if (!list.length) return null;
    const a = list.slice().sort(function (x, y) { return x - y; });
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
  }

  // After a round: the stats of every fact asked and a line in the list of sessions.
  // answers = [{ fact, correct, ms, retry }] (an answer given the second time a fact is asked, retry, is not counted).
  function applyRound(record, setId, answers, now) {
    const rec = { v: 1, facts: Object.assign({}, (record && record.facts) || {}), sessions: ((record && record.sessions) || []).slice() };
    // the second try of a question that was wrong right after seeing the answer says nothing about what is remembered
    const firsts = answers.filter(function (a) { return !a.retry; });
    firsts.forEach(function (a) { rec.facts[a.fact.id] = update(rec.facts[a.fact.id], a.correct, a.ms, now, a.fact.set); });
    rec.sessions.push({ at: now, set: setId, n: firsts.length, ok: firsts.filter(function (a) { return a.correct; }).length, ms: median(firsts.filter(function (a) { return a.correct; }).map(function (a) { return a.ms; })) });
    if (rec.sessions.length > MAX_SESSIONS) rec.sessions = rec.sessions.slice(-MAX_SESSIONS);
    return rec;
  }

  function previousSession(record, setId) {
    const list = ((record && record.sessions) || []).filter(function (s) { return s.set === setId && s.ms; });
    return list.length ? list[list.length - 1] : null;
  }

  // ===== screens =====
  const LABELS = { new: "Inte tränad", shaky: "Vinglig", learning: "Tränas", secure: "Säker", fast: "Snabb" };

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

  function rich(node, text) {
    if (window.GaussicaText) window.GaussicaText.set(node, text); else node.textContent = text;
    return node;
  }

  function seconds(ms) { return (ms / 1000).toFixed(1).replace(".", ",") + " s"; }

  function dayLabel(ts) {
    const d = new Date(ts);
    return isNaN(d) ? "" : d.getDate() + "/" + (d.getMonth() + 1);
  }

  let active = null;

  // closes the training if it is still open when the page changes under it
  function closeActive() { if (active) active.close(); }

  // deps = { container, getRecord(), save(record), onExit(), petSay(kind) }
  function open(deps) {
    if (active) active.close();
    const c = deps.container;
    const choice = { set: "mix", tables: [], n: 10 };
    let round = null;
    let onKey = null;

    function close() {
      if (onKey) document.removeEventListener("keydown", onKey);
      onKey = null;
      c.hidden = true;
      c.replaceChildren();
      document.body.classList.remove("player-open");
      if (active === handle) active = null;
      deps.onExit();
    }

    function shell(title, onClose) {
      c.hidden = false;
      document.body.classList.add("player-open");
      c.replaceChildren();
      const root = el("div", "pl-shell");
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", title);
      const top = el("header", "pl-top");
      const x = button("✕", "pl-close", onClose || close);
      x.setAttribute("aria-label", "Stäng");
      const bar = el("div", "pl-bar");
      top.append(x, bar, el("span", "pl-title", title));
      const main = el("main", "pl-main");
      main.tabIndex = -1;
      const card = el("div", "pl-card fl-card");
      main.appendChild(card);
      const foot = el("footer", "pl-foot is-neutral");
      root.append(top, main, foot);
      c.appendChild(root);
      return { card: card, foot: foot, bar: bar, main: main };
    }

    // ----- the first screen -----
    function start() {
      round = null;
      const s = shell("Snabbträning");
      const rec = deps.getRecord();
      s.card.appendChild(el("p", "eyebrow pl-eyebrow", "SNABBTRÄNING ⚡"));
      s.card.appendChild(el("h2", "pl-summary-title", "Gör räknefakta snabba"));
      s.card.appendChild(el("p", "pt-text", "Problemet: Tabellerna och kompisarna till 10 och 20 går mycket fortare när du kan dem utantill. Då blir svårare räkning lättare, för du behöver inte stanna och räkna ut varje liten bit. Korta rundor är det som fungerar bäst. Det finns ingen klocka som tickar och inga mynt att jaga. Svara så bra du kan, så följer jag vilka tal som sitter och vilka som behöver komma tillbaka oftare."));

      const kinds = el("div", "fl-chips");
      kinds.setAttribute("role", "group");
      kinds.setAttribute("aria-label", "Vad vill du träna?");
      [{ id: "mix", short: "Blandat" }].concat(SETS).forEach(function (set) {
        const b = button(set.short, "tv-chip fl-chip" + (choice.set === set.id ? " is-on" : ""), function () { choice.set = set.id; choice.tables = []; start(); });
        b.setAttribute("aria-pressed", String(choice.set === set.id));
        kinds.appendChild(b);
      });
      s.card.appendChild(el("h3", "pt-sub", "Vad vill du träna?"));
      s.card.appendChild(kinds);

      if (setOf(choice.set).tables && choice.set !== "mix") {
        s.card.appendChild(el("p", "pt-text pt-muted", "Vill du träna vissa tabeller? Välj dem här, annars tränar du alla."));
        const tabs = el("div", "fl-chips");
        for (let t = 2; t <= 10; t++) {
          const on = choice.tables.indexOf(t) >= 0;
          const b = button(String(t), "tv-chip fl-chip" + (on ? " is-on" : ""), function () {
            const i = choice.tables.indexOf(t);
            if (i >= 0) choice.tables.splice(i, 1); else choice.tables.push(t);
            start();
          });
          b.setAttribute("aria-pressed", String(on));
          b.setAttribute("aria-label", "Tabell " + t);
          tabs.appendChild(b);
        }
        s.card.appendChild(tabs);
      }

      const sum = summary(rec, choice.set, { tables: choice.tables });
      const prog = el("p", "pt-text");
      prog.textContent = sum.practised
        ? "Du har tränat " + sum.practised + " av " + sum.total + " fakta här. " + sum.counts.fast + " är snabba och säkra" + (sum.counts.shaky ? ", " + sum.counts.shaky + " vinglar" : "") + (sum.avgMs ? ". Snittid " + seconds(sum.avgMs) + "." : ".")
        : "Du har inte tränat det här än. Börja med en kort runda.";
      s.card.appendChild(prog);

      const lengths = el("div", "fl-chips");
      lengths.setAttribute("role", "group");
      lengths.setAttribute("aria-label", "Antal frågor");
      [5, 10, 20].forEach(function (n) {
        const b = button(n + " frågor", "tv-chip fl-chip" + (choice.n === n ? " is-on" : ""), function () { choice.n = n; start(); });
        b.setAttribute("aria-pressed", String(choice.n === n));
        lengths.appendChild(b);
      });
      s.card.appendChild(lengths);

      const row = el("div", "pl-foot-row");
      const acts = el("div", "pl-foot-actions");
      acts.append(button("Min karta", "pl-btn pl-btn-ghost", function () { showMap(); }), button("Börja →", "pl-btn pl-btn-primary", function () { begin(); }));
      row.append(el("div", "pl-foot-msg"), acts);
      s.foot.appendChild(row);
      acts.lastChild.focus({ preventScroll: true });
    }

    // ----- a round -----
    function begin() {
      const rec = deps.getRecord();
      const list = plan(rec, choice.set, { tables: choice.tables, n: choice.n });
      if (!list.length) { start(); return; }
      round = { set: choice.set, queue: list.map(function (f) { return asked(f); }), done: [], answers: [], again: [], total: list.length, at: Date.now() };
      question();
    }

    function question() {
      if (!round.queue.length) { finish(); return; }
      const f = round.queue[0];
      const s = shell(setOf(f.set).name, function () { quit(); });
      for (let i = 0; i < round.total; i++) s.bar.appendChild(el("span", "pl-seg " + (i < round.done.length ? "is-done" : "") + (i === round.done.length ? " is-current" : "")));
      s.card.appendChild(el("p", "eyebrow pl-eyebrow", "FRÅGA " + Math.min(round.done.length + 1, round.total) + " AV " + round.total));
      const q = el("div", "fl-question");
      rich(q, f.prompt + (f.prompt.indexOf("?") >= 0 ? "" : " = ?"));
      s.card.appendChild(q);

      const form = el("form", "answer-form fl-form");
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.setAttribute("pattern", "[0-9]*");
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Svar");
      input.className = "fl-input";
      const submit = el("button", "primary-button answer-button", "Svara");
      submit.type = "submit";
      form.append(input, submit);
      s.card.appendChild(form);
      const note = el("p", "pt-text pt-muted fl-note", "");
      s.card.appendChild(note);

      const shown = Date.now();
      let waiting = false;
      const isRetry = Boolean(f.retry);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (waiting) return;
        const text = input.value.trim();
        if (!text) return;
        const ms = Date.now() - shown;
        const correct = /^\d+$/.test(text) && Number(text) === f.answer;
        round.answers.push({ fact: f, correct: correct, ms: ms, retry: isRetry });
        round.queue.shift();
        waiting = true;
        const foot = s.foot;
        foot.replaceChildren();
        foot.className = "pl-foot is-" + (correct ? "correct" : "wrong");
        const row = el("div", "pl-foot-row");
        const acts = el("div", "pl-foot-actions");
        // a wrong answer comes back once, later in the round
        const next = function () {
          if (!correct && !isRetry) round.queue.push(Object.assign({}, f, { retry: true }));
          else round.done.push(f);
          question();
        };
        input.disabled = true;
        if (correct) {
          row.append(el("div", "pl-foot-msg", ms <= setOf(f.set).fast ? "✓ Rätt, och snabbt!" : "✓ Rätt!"), acts);
          foot.appendChild(row);
          setTimeout(next, 650);
        } else {
          const msg = el("div", "pl-foot-msg");
          rich(msg, "Rätt svar: " + (f.prompt.indexOf("?") >= 0 ? String(f.answer) : solved(f)) + ".");
          if (!isRetry) msg.appendChild(document.createTextNode(" Du får den här igen om en stund."));
          const go = button("Nästa →", "pl-btn pl-btn-primary", next);
          acts.appendChild(go);
          row.append(msg, acts);
          foot.appendChild(row);
          go.focus({ preventScroll: true });
        }
      });
      s.foot.appendChild(el("div", "pl-foot-row"));
      input.focus({ preventScroll: true });
    }

    function quit() {
      if (round && round.answers.length) deps.save(applyRound(deps.getRecord(), round.set, round.answers, Date.now()));
      round = null;
      start();
    }

    function finish() {
      const before = previousSession(deps.getRecord(), round.set);
      const rec = applyRound(deps.getRecord(), round.set, round.answers, Date.now());
      deps.save(rec);
      const last = rec.sessions[rec.sessions.length - 1];
      const s = shell("Snabbträning");
      s.card.appendChild(el("p", "eyebrow pl-eyebrow", "RUNDAN KLAR"));
      s.card.appendChild(el("h2", "pl-summary-title", last.ok === last.n ? "Alla rätt!" : "Bra träning!"));
      s.card.appendChild(el("p", "pt-big fl-big", last.ok + " av " + last.n));
      s.card.appendChild(el("p", "pt-text", "rätt på första försöket" + (last.ms ? ", snittid " + seconds(last.ms) + " på de rätta." : ".")));
      if (before && last.ms) {
        const diff = before.ms - last.ms;
        s.card.appendChild(el("p", "pt-text fl-trend", Math.abs(diff) < 200 ? "Ungefär lika snabbt som förra gången (" + seconds(before.ms) + ")." : diff > 0 ? "⚡ Snabbare än förra gången: " + seconds(before.ms) + " → " + seconds(last.ms) + "." : "Lite långsammare än förra gången (" + seconds(before.ms) + "). Det är helt okej, farten kommer med träning."));
      }
      const wrong = {};
      round.answers.forEach(function (a) { if (!a.retry && !a.correct) wrong[a.fact.id] = a.fact; });
      const fast = {};
      round.answers.forEach(function (a) { if (!a.retry && a.correct && a.ms <= setOf(a.fact.set).fast) fast[a.fact.id] = a.fact; });
      if (Object.keys(wrong).length) {
        s.card.appendChild(el("h3", "pt-sub", "De här kommer tillbaka snart"));
        const ul = el("ul", "fl-list");
        Object.keys(wrong).forEach(function (k) { const li = el("li"); rich(li, solved(wrong[k])); ul.appendChild(li); });
        s.card.appendChild(ul);
      }
      if (Object.keys(fast).length) s.card.appendChild(el("p", "pt-text pt-muted", "Snabba och säkra den här gången: " + Object.keys(fast).length + " st."));
      const say = deps.petSay ? deps.petSay("fluency") : null;
      if (say) s.card.appendChild(say);
      const row = el("div", "pl-foot-row");
      const acts = el("div", "pl-foot-actions");
      acts.append(button("Min karta", "pl-btn pl-btn-ghost", showMap), button("Klar", "pl-btn pl-btn-ghost", close), button("En runda till →", "pl-btn pl-btn-primary", begin));
      row.append(el("div", "pl-foot-msg"), acts);
      s.foot.appendChild(row);
      acts.lastChild.focus({ preventScroll: true });
      round = null;
    }

    // ----- the map: every fact, coloured by how well it sits -----
    function showMap() {
      const s = shell("Min karta", start);
      const rec = deps.getRecord();
      const stats = rec.facts || {};
      s.card.appendChild(el("p", "eyebrow pl-eyebrow", "MIN KARTA"));
      s.card.appendChild(el("h2", "pl-summary-title", "Det här sitter"));
      const legend = el("div", "fl-legend");
      ["fast", "secure", "learning", "shaky", "new"].forEach(function (k) {
        const item = el("span", "fl-legend-item");
        item.append(el("span", "fl-dot fl-" + k), document.createTextNode(LABELS[k]));
        legend.appendChild(item);
      });
      s.card.appendChild(legend);
      const detail = el("p", "pt-text fl-detail", "Tryck på en ruta för att se hur det går.");
      const show = function (f) {
        const st = stats[f.id];
        rich(detail, solved(f) + ": " +
          (st ? st.n + " försök, " + st.ok + " rätt" + (st.ms ? ", snittid " + seconds(st.ms) : "") + ". " + LABELS[mastery(st)] + "." : "inte tränad än."));
      };
      const grid = function (setId, title) {
        const box = el("div", "fl-mapbox");
        box.appendChild(el("h3", "pt-sub", title));
        const sum = summary(rec, setId);
        box.appendChild(el("p", "pt-muted", sum.counts.fast + " snabba, " + sum.counts.secure + " säkra, " + sum.counts.learning + " tränas, " + sum.counts.shaky + " vinglar, " + sum.counts.new + " inte tränade"));
        if (setId === "mul" || setId === "div" || setId === "plus" || setId === "minus") {
          const table = el("div", "fl-grid");
          table.style.gridTemplateColumns = "repeat(10, 1fr)";
          table.appendChild(el("span", "fl-head", ""));
          for (let b = 2; b <= 10; b++) table.appendChild(el("span", "fl-head", String(b)));
          for (let a = 2; a <= 10; a++) {
            table.appendChild(el("span", "fl-head", String(a)));
            for (let b = 2; b <= 10; b++) {
              const lo = Math.min(a, b), hi = Math.max(a, b);
              const f = facts(setId).find(function (x) { return x.a === lo && x.b === hi; });
              const cell = button("", "fl-cell fl-" + mastery(stats[f.id]), function () { show(f); });
              cell.setAttribute("aria-label", f.prompt + ": " + LABELS[mastery(stats[f.id])]);
              table.appendChild(cell);
            }
          }
          box.appendChild(table);
        } else {
          const row = el("div", "fl-row");
          facts(setId).forEach(function (f) {
            const b = button(String(f.a), "fl-cell fl-wide fl-" + mastery(stats[f.id]), function () { show(f); });
            b.setAttribute("aria-label", f.prompt + ": " + LABELS[mastery(stats[f.id])]);
            row.appendChild(b);
          });
          box.appendChild(row);
        }
        s.card.appendChild(box);
      };
      grid("mul", "Multiplikationstabellerna");
      grid("tio", "Tiokompisar (talet du tar bort från 10)");
      grid("tjugo", "Kompisar till 20");
      s.card.appendChild(detail);
      const row = el("div", "pl-foot-row");
      const acts = el("div", "pl-foot-actions");
      acts.appendChild(button("Tillbaka", "pl-btn pl-btn-primary", start));
      row.append(el("div", "pl-foot-msg"), acts);
      s.foot.appendChild(row);
    }

    onKey = function (e) { if (e.key === "Escape") { e.preventDefault(); if (round) quit(); else close(); } };
    document.addEventListener("keydown", onKey);
    const handle = { close: function () { if (onKey) document.removeEventListener("keydown", onKey); onKey = null; if (active === handle) active = null; c.hidden = true; c.replaceChildren(); document.body.classList.remove("player-open"); } };
    active = handle;
    start();
    return { close: close };
  }

  // ===== the card on the start page =====
  function renderCard(container, record, hooks) {
    if (!container) return;
    container.replaceChildren();
    container.hidden = false;
    container.className = "train-card";
    const s = summary(record, "mix");
    const icon = el("span", "train-icon", "⚡");
    icon.setAttribute("aria-hidden", "true");
    const copy = el("div", "train-copy");
    copy.appendChild(el("h3", "", "Snabbträning"));
    copy.appendChild(el("p", "", s.practised
      ? s.counts.fast + " av " + s.total + " fakta är snabba och säkra" + (s.counts.shaky ? ", " + s.counts.shaky + " vinglar och kommer tillbaka" : "") + ". En kort runda tar någon minut."
      : "Korta rundor som gör tabellerna och kompisarna till 10 och 20 snabba. Inga mynt, ingen klocka som tickar."));
    container.append(icon, copy, button(s.practised ? "Träna en runda" : "Prova", "primary-button train-go", hooks.open));
  }

  function teacherLine(record) {
    const s = summary(record, "mix");
    if (!s.practised) return "Inte tränat snabbträning än.";
    const last = ((record && record.sessions) || []).slice(-1)[0];
    return s.practised + " av " + s.total + " fakta tränade: " + s.counts.fast + " snabba, " + s.counts.secure + " säkra, " + s.counts.shaky + " vinglar" + (s.avgMs ? ". Snittid " + seconds(s.avgMs) : "") + (last ? ". Senast " + dayLabel(last.at) : "") + ".";
  }

  function recordOf(student) {
    const p = student && student.lessonProgress && student.lessonProgress[KEY];
    return p && p.facts ? p : { v: 1, facts: {}, sessions: [] };
  }

  return {
    KEY: KEY, SETS: SETS, facts: facts, asked: asked, solved: solved, plan: plan, update: update, mastery: mastery, summary: summary, applyRound: applyRound,
    previousSession: previousSession, open: open, closeActive: closeActive, renderCard: renderCard, teacherLine: teacherLine, recordOf: recordOf, INTERVALS: INTERVALS
  };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaFluency;
