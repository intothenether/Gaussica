// Interactive "pyssla" tools for lessons.
//
// Component types (used in a lesson's `components`):
//   pyssel       generic tool: sliders -> live figure(s) -> readouts -> challenges
//   ritrutnat    draw on a grid, optionally mirrored (symmetry)
//   primtalssil  Eratosthenes' sieve: strike out multiples to find the primes
//   tarning      dice / coin simulator with a live bar chart
//   robot        build a program of step commands that moves a robot to the star
//
// Everything is declarative JSON. Formulas are written as text and evaluated by the small,
// safe evaluator below (no eval). In a figure config, a string like "=l*b" becomes a number
// and "{l} cm" becomes text with the value filled in ("{x|2}" pads to 2 digits, "{x|+}" shows a sign).
//
// pyssel:
//   { type:"pyssel", title, intro,
//     params:[{ name, label, min, max, step, value, unit }],
//     vars:[{ name, expr }],                       // computed values, in order
//     view:{ ...figure config with "=expr" / "{expr}" } | views:[...],
//     readouts:[{ label, text, when:{expr,equals|min|max} }],
//     goals:[{ id, text, conditions:[{ expr, equals|min|max, tol }] }] }

window.GaussicaPyssel = (function () {
  "use strict";

  const TYPES = { pyssel: "PYSSLA", ritrutnat: "RITA", primtalssil: "PRIMTALSSIL", tarning: "SLUMP", robot: "ROBOT" };

  function supports(type) {
    return Object.prototype.hasOwnProperty.call(TYPES, String(type || "").toLowerCase());
  }

  // ===== expression evaluator =====
  const FUNCS = {
    abs: Math.abs, sqrt: Math.sqrt, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    min: Math.min, max: Math.max, pow: Math.pow,
    mod: function (a, b) { return b === 0 ? NaN : ((a % b) + b) % b; },
    divcount: function (n) {
      n = Math.round(n);
      if (n < 1) return NaN;
      let c = 0;
      for (let d = 1; d * d <= n; d++) if (n % d === 0) c += d * d === n ? 1 : 2;
      return c;
    },
    isprime: function (n) {
      n = Math.round(n);
      if (n < 2) return 0;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) return 0;
      return 1;
    },
    primecount: function (n) {   // how many primes there are up to and including n
      n = Math.round(n);
      let c = 0;
      for (let k = 2; k <= n; k++) c += FUNCS.isprime(k);
      return c;
    },
    nextprime: function (n) {    // the smallest prime larger than n
      n = Math.round(n);
      for (let k = n + 1; k < n + 1000; k++) if (FUNCS.isprime(k)) return k;
      return NaN;
    },
    sgd: function (a, b) {
      a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
      while (b) { const t = b; b = a % b; a = t; }
      return a;
    }
  };

  const compiled = new Map();

  function tokenize(src) {
    const out = [];
    const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_åäöÅÄÖ][A-Za-z0-9_åäöÅÄÖ]*)|(.))/y;
    let m;
    re.lastIndex = 0;
    while (re.lastIndex < src.length && (m = re.exec(src))) {
      if (m[1] !== undefined) out.push({ t: "num", v: parseFloat(m[1]) });
      else if (m[2] !== undefined) out.push({ t: "id", v: m[2] });
      else if (m[3] !== undefined && m[3].trim() !== "") out.push({ t: "op", v: m[3] });
    }
    return out;
  }

  // Returns a function(scope) -> number.
  function compile(src) {
    if (compiled.has(src)) return compiled.get(src);
    const tokens = tokenize(String(src));
    let pos = 0;
    const peek = function () { return tokens[pos]; };
    const isOp = function (v) { const t = tokens[pos]; return t && t.t === "op" && t.v === v; };

    function expr() {
      let left = term();
      while (isOp("+") || isOp("-")) {
        const op = tokens[pos++].v, right = term(), l = left;
        left = op === "+" ? function (s) { return l(s) + right(s); } : function (s) { return l(s) - right(s); };
      }
      return left;
    }
    function term() {
      let left = unary();
      while (isOp("*") || isOp("/") || isOp("%")) {
        const op = tokens[pos++].v, right = unary(), l = left;
        if (op === "*") left = function (s) { return l(s) * right(s); };
        else if (op === "/") left = function (s) { const d = right(s); return d === 0 ? NaN : l(s) / d; };
        else left = function (s) { return FUNCS.mod(l(s), right(s)); };
      }
      return left;
    }
    function unary() {
      if (isOp("-")) { pos++; const u = unary(); return function (s) { return -u(s); }; }
      if (isOp("+")) { pos++; return unary(); }
      return power();
    }
    function power() {
      const base = atom();
      if (isOp("^")) { pos++; const e = unary(); return function (s) { return Math.pow(base(s), e(s)); }; }
      return base;
    }
    function atom() {
      const t = peek();
      if (!t) throw new Error("Oväntat slut i uttrycket");
      pos++;
      if (t.t === "num") return function () { return t.v; };
      if (t.t === "id") {
        if (isOp("(")) {
          pos++;
          const args = [];
          if (!isOp(")")) {
            args.push(expr());
            while (isOp(",")) { pos++; args.push(expr()); }
          }
          if (!isOp(")")) throw new Error("Saknar ) i uttrycket");
          pos++;
          const fn = FUNCS[t.v.toLowerCase()];
          if (!fn) throw new Error("Okänd funktion " + t.v);
          return function (s) { return fn.apply(null, args.map(function (a) { return a(s); })); };
        }
        const name = t.v;
        if (name === "pi") return function () { return Math.PI; };
        return function (s) { return s[name] === undefined ? NaN : s[name]; };
      }
      if (t.v === "(") {
        const e = expr();
        if (!isOp(")")) throw new Error("Saknar ) i uttrycket");
        pos++;
        return e;
      }
      throw new Error("Oväntat tecken " + t.v);
    }

    let fn;
    try {
      fn = expr();
      if (pos < tokens.length) throw new Error("Överflödiga tecken i uttrycket");
    } catch (e) {
      fn = function () { return NaN; };
      fn.error = e.message;
    }
    compiled.set(src, fn);
    return fn;
  }

  function evalExpr(src, scope) {
    return compile(src)(scope || {});
  }

  function num(v) {
    if (!isFinite(v)) return "?";
    return String(Math.round(v * 100) / 100).replace(".", ",").replace("-", "−");
  }

  function formatValue(e, scope) {
    const parts = String(e).split("|");
    const v = evalExpr(parts[0], scope);
    const f = parts[1];
    if (f === "+") return (v >= 0 ? "+" : "−") + num(Math.abs(v)).replace("−", "");
    if (f && /^\d+$/.test(f)) {
      const s = String(Math.round(v));
      return s.length >= Number(f) ? s : new Array(Number(f) - s.length + 1).join("0") + s;
    }
    return num(v);
  }

  // Fills in "=expr" and "{expr}" anywhere in a config.
  function resolve(value, scope) {
    if (typeof value === "string") {
      if (value.charAt(0) === "=") return evalExpr(value.slice(1), scope);
      if (value.indexOf("{") >= 0) return value.replace(/\{([^{}]+)\}/g, function (m, e) { return formatValue(e, scope); });
      return value;
    }
    if (Array.isArray(value)) return value.map(function (v) { return resolve(v, scope); });
    if (value && typeof value === "object") {
      const o = {};
      Object.keys(value).forEach(function (k) { o[k] = resolve(value[k], scope); });
      return o;
    }
    return value;
  }

  // { expr, equals, tol, min, max } or { all:[...] }
  function holds(c, scope) {
    if (c.all) return c.all.every(function (x) { return holds(x, scope); });
    const v = evalExpr(c.expr, scope);
    if (!isFinite(v)) return false;
    const tol = c.tol !== undefined ? c.tol : 1e-6;
    if (c.equals !== undefined && Math.abs(v - c.equals) > tol) return false;
    if (c.min !== undefined && v < c.min - 1e-9) return false;
    if (c.max !== undefined && v > c.max + 1e-9) return false;
    return true;
  }

  // ===== DOM helpers =====
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) {
      if (window.GaussicaText) window.GaussicaText.set(e, text); else e.textContent = text;
    }
    return e;
  }

  function button(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function card(comp, kind) {
    const root = el("section", "py py-" + kind);
    const head = el("div", "py-head");
    head.appendChild(el("span", "py-badge", "PYSSLA"));
    if (comp.title) head.appendChild(el("h4", "py-title", comp.title));
    root.appendChild(head);
    if (comp.intro) root.appendChild(el("p", "py-intro", comp.intro));
    return root;
  }

  function renderFigure(cfg, ctx) {
    if (ctx && ctx.renderVisual) {
      const e = ctx.renderVisual(cfg);
      if (e) return e;
    }
    return window.GaussicaFigures ? window.GaussicaFigures.render(cfg) : null;
  }

  // Challenge list shared by all tools. `check` is called after every change.
  function goalList(goals, ctx) {
    const list = el("ul", "py-goals");
    const items = new Map();
    goals.forEach(function (g) {
      const li = el("li", "py-goal");
      li.appendChild(el("span", "py-goal-mark", "○"));
      li.appendChild(el("span", "py-goal-text", g.text));
      const done = Boolean(ctx && ctx.isGoalDone && ctx.isGoalDone(g.id));
      if (done) { li.classList.add("is-done"); li.firstChild.textContent = "✓"; }
      items.set(g.id, li);
      list.appendChild(li);
    });
    const status = el("p", "py-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    return {
      element: list,
      status: status,
      isDone: function (id) { return items.get(id).classList.contains("is-done"); },
      complete: function (g) {
        const li = items.get(g.id);
        if (li.classList.contains("is-done")) return;
        li.classList.add("is-done");
        li.firstChild.textContent = "✓";
        status.textContent = "✓ Klart: " + g.text;
        if (ctx && ctx.onGoal) ctx.onGoal(g.id);
      }
    };
  }

  // ===== generic tool =====
  function pyssel(comp, ctx) {
    const root = card(comp, "explore");
    const params = comp.params || [];
    const values = {};
    params.forEach(function (p) { values[p.name] = Number(p.value !== undefined ? p.value : p.min); });

    const body = el("div", "py-body");
    const controls = el("div", "py-controls");
    const view = el("div", "py-view");
    const readouts = el("ul", "py-readouts");
    body.append(controls, view);
    root.appendChild(body);
    root.appendChild(readouts);

    const goals = (comp.goals || []);
    const goalUi = goals.length ? goalList(goals, ctx) : null;
    if (goalUi) {
      root.appendChild(el("h5", "py-goals-title", "Utmaningar"));
      root.appendChild(goalUi.element);
      root.appendChild(goalUi.status);
    }

    const outputs = {};
    params.forEach(function (p, i) {
      const row = el("div", "py-param");
      const id = "py-" + Math.random().toString(36).slice(2, 8) + "-" + i;
      const label = el("label", "", p.label || p.name);
      label.setAttribute("for", id);
      const out = el("output", "py-value");
      out.setAttribute("for", id);
      outputs[p.name] = out;
      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      input.min = String(p.min !== undefined ? p.min : 0);
      input.max = String(p.max !== undefined ? p.max : 10);
      input.step = String(p.step || 1);
      input.value = String(values[p.name]);
      input.addEventListener("input", function () {
        values[p.name] = Number(input.value);
        update();
      });
      p.__input = input;
      row.append(label, out, input);
      controls.appendChild(row);
    });
    if (params.length) {
      const reset = button("Börja om", "py-btn py-btn-ghost", function () {
        params.forEach(function (p) {
          values[p.name] = Number(p.value !== undefined ? p.value : p.min);
          p.__input.value = String(values[p.name]);
        });
        update();
      });
      controls.appendChild(reset);
    }

    function scope() {
      const s = Object.assign({}, values);
      (comp.vars || []).forEach(function (v) { s[v.name] = evalExpr(v.expr, s); });
      return s;
    }

    function update() {
      const s = scope();
      params.forEach(function (p) { outputs[p.name].textContent = num(values[p.name]) + (p.unit ? " " + p.unit : ""); });
      view.replaceChildren();
      (comp.views || (comp.view ? [comp.view] : [])).forEach(function (v) {
        const fig = renderFigure(resolve(v, s), ctx);
        if (fig) view.appendChild(fig);
      });
      readouts.replaceChildren();
      (comp.readouts || []).forEach(function (r) {
        if (r.when && !holds(resolve(r.when, s), s)) return;
        const li = el("li", "py-readout");
        if (r.label) li.appendChild(el("strong", "", r.label + ": "));
        li.appendChild(el("span", "", resolve(r.text, s)));
        readouts.appendChild(li);
      });
      goals.forEach(function (g) {
        if (!goalUi.isDone(g.id) && g.conditions.every(function (c) { return holds(c, s); })) goalUi.complete(g);
      });
    }
    update();
    return root;
  }

  // ===== drawing grid with mirror line =====
  function ritrutnat(comp, ctx) {
    const root = card(comp, "grid");
    const cols = Math.max(2, Math.min(16, comp.cols || 8)), rows = Math.max(2, Math.min(16, comp.rows || 8));
    const goal = comp.goal;
    const cells = new Set((comp.preset || []).map(function (p) { return p[0] + "," + p[1]; }));
    const presetCount = cells.size;
    let auto = comp.autoMirror !== undefined ? Boolean(comp.autoMirror) : !goal;

    const board = el("div", "py-board");
    board.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    board.style.maxWidth = (cols * 40) + "px";
    const axis = el("div", "py-axis");
    axis.setAttribute("aria-hidden", "true");
    const wrapper = el("div", "py-boardwrap");
    wrapper.style.maxWidth = (cols * 40) + "px";
    wrapper.append(board, axis);
    root.appendChild(wrapper);

    const status = el("p", "py-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const controls = el("div", "py-controls-row");
    const autoLabel = el("label", "py-check");
    const autoBox = document.createElement("input");
    autoBox.type = "checkbox";
    autoBox.checked = auto;
    autoBox.addEventListener("change", function () { auto = autoBox.checked; update(); });
    autoLabel.append(autoBox, document.createTextNode(" Spegla automatiskt"));
    controls.appendChild(autoLabel);
    controls.appendChild(button("Rensa", "py-btn py-btn-ghost", function () { cells.clear(); update(); }));
    if (comp.preset && comp.preset.length) {
      controls.appendChild(button("Börja om", "py-btn py-btn-ghost", function () {
        cells.clear();
        comp.preset.forEach(function (p) { cells.add(p[0] + "," + p[1]); });
        update();
      }));
    }
    root.appendChild(controls);
    root.appendChild(status);
    const goalUi = goal ? goalList([goal], ctx) : null;
    if (goalUi) { root.appendChild(el("h5", "py-goals-title", "Uppdrag")); root.appendChild(goalUi.element); root.appendChild(goalUi.status); }

    const mirrorKey = function (x, y) { return (cols - 1 - x) + "," + y; };
    const buttons = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const b = el("button", "py-cell");
        b.type = "button";
        b.setAttribute("aria-label", "Ruta " + (x + 1) + "," + (y + 1));
        b.addEventListener("click", function () {
          const key = x + "," + y;
          const on = !cells.has(key);
          [key].concat(auto ? [mirrorKey(x, y)] : []).forEach(function (k) { if (on) cells.add(k); else cells.delete(k); });
          update();
        });
        buttons.push([b, x, y]);
        board.appendChild(b);
      }
    }

    function update() {
      let missing = 0;
      buttons.forEach(function (it) {
        const on = cells.has(it[1] + "," + it[2]);
        it[0].classList.toggle("is-on", on);
        it[0].setAttribute("aria-pressed", String(on));
        if (on && !cells.has(mirrorKey(it[1], it[2]))) missing++;
      });
      const symmetric = missing === 0;
      status.textContent = !cells.size ? "Klicka på rutorna för att färglägga."
        : symmetric ? "✓ Figuren är symmetrisk." : missing + (missing === 1 ? " ruta saknar" : " rutor saknar") + " spegelbild.";
      status.classList.toggle("is-ok", symmetric && cells.size > 0);
      if (goal) {
        const need = goal.minCells || 4;
        if (!auto && symmetric && cells.size >= need && cells.size > presetCount && !goalUi.isDone(goal.id)) goalUi.complete(goal);
      }
    }
    update();
    return root;
  }

  // ===== prime sieve =====
  function sil(comp, ctx) {
    const root = card(comp, "sieve");
    const from = Math.max(2, comp.from || 2), to = Math.min(120, comp.to || 50), cols = comp.columns || 10;
    const struck = new Set(), primes = new Set();
    const board = el("div", "py-numgrid");
    board.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    root.appendChild(board);
    const status = el("p", "py-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Klicka på det minsta talet som inte är överstruket.";
    root.appendChild(status);
    root.appendChild(button("Börja om", "py-btn py-btn-ghost", function () { struck.clear(); primes.clear(); status.textContent = "Klicka på det minsta talet som inte är överstruket."; update(); }));
    const goal = comp.goal;
    const goalUi = goal ? goalList([goal], ctx) : null;
    if (goalUi) { root.appendChild(el("h5", "py-goals-title", "Uppdrag")); root.appendChild(goalUi.element); root.appendChild(goalUi.status); }

    const cellFor = {};
    for (let n = from; n <= to; n++) {
      const b = el("button", "py-num", String(n));
      b.type = "button";
      b.addEventListener("click", function () {
        if (struck.has(n) || primes.has(n)) return;
        const smallest = (function () { for (let k = from; k <= to; k++) if (!struck.has(k) && !primes.has(k)) return k; return null; }());
        if (!FUNCS.isprime(n)) {
          let d = 2; while (n % d !== 0) d++;
          status.textContent = n + " är inget primtal: " + n + " = " + d + " · " + (n / d) + ". Stryk först multiplarna av " + d + ".";
          return;
        }
        if (n !== smallest) { status.textContent = n + " är ett primtal, men börja med det minsta talet som inte är överstruket: " + smallest + "."; return; }
        primes.add(n);
        for (let m = n * 2; m <= to; m += n) struck.add(m);
        status.textContent = n + " är ett primtal. Alla multiplar av " + n + " är överstrukna.";
        update();
      });
      cellFor[n] = b;
      board.appendChild(b);
    }

    function update() {
      let open = 0;
      Object.keys(cellFor).forEach(function (k) {
        const n = Number(k), b = cellFor[k];
        b.classList.toggle("is-struck", struck.has(n));
        b.classList.toggle("is-prime", primes.has(n));
        b.setAttribute("aria-label", n + (struck.has(n) ? ", överstruket" : primes.has(n) ? ", primtal" : ""));
        if (!struck.has(n) && !primes.has(n)) open++;
      });
      if (!open) {
        status.textContent = "✓ Klart! Talen som är markerade är primtalen mellan " + from + " och " + to + ": " + Array.from(primes).join(", ") + ".";
        if (goal && !goalUi.isDone(goal.id)) goalUi.complete(goal);
      }
    }
    update();
    return root;
  }

  // ===== dice / coin simulator =====
  function tarning(comp, ctx) {
    const root = card(comp, "dice");
    const coin = comp.kind === "mynt";
    const sides = coin ? 2 : Math.max(2, Math.min(12, comp.sides || 6));
    const names = coin ? ["Krona", "Klave"] : Array.from({ length: sides }, function (_, i) { return String(i + 1); });
    let counts = names.map(function () { return 0; });
    let total = 0;
    const goal = comp.goal;

    const last = el("div", "py-die", "–");
    last.setAttribute("aria-live", "polite");
    const chart = el("div", "py-chart");
    const info = el("p", "py-status");
    const row = el("div", "py-controls-row");
    root.append(last, row, chart, info);
    const goalUi = goal ? goalList([goal], ctx) : null;
    if (goalUi) { root.appendChild(el("h5", "py-goals-title", "Uppdrag")); root.appendChild(goalUi.element); root.appendChild(goalUi.status); }

    function roll(n) {
      let lastIndex = 0;
      for (let i = 0; i < n; i++) { lastIndex = Math.floor(Math.random() * sides); counts[lastIndex] += 1; total += 1; }
      last.textContent = names[lastIndex];
      last.classList.add("is-rolled");
      update();
    }
    [1, 10, 100].forEach(function (n) { row.appendChild(button("Kasta " + n + (n === 1 ? " gång" : " gånger"), "py-btn", function () { roll(n); })); });
    row.appendChild(button("Börja om", "py-btn py-btn-ghost", function () { counts = names.map(function () { return 0; }); total = 0; last.textContent = "–"; update(); }));

    function update() {
      chart.replaceChildren();
      const data = names.map(function (n, i) { return { label: n, value: counts[i] }; });
      const cfg = { type: "staplar", data: data, alt: "Antal av varje utfall", line: total ? { value: total / sides, label: "väntat" } : undefined };
      const fig = renderFigure(cfg, ctx);
      if (fig) chart.appendChild(fig);
      if (!total) info.textContent = "Kasta för att se hur utfallen fördelar sig.";
      else {
        const most = counts.indexOf(Math.max.apply(null, counts));
        info.textContent = "Efter " + total + " kast: " + names[most] + " kom oftast (" + counts[most] + " gånger, " + num(counts[most] / total * 100) + " %). " +
          "Väntat vid exakt jämn fördelning: " + num(100 / sides) + " % för varje utfall.";
      }
      if (goal && total >= (goal.minRolls || 100) && !goalUi.isDone(goal.id)) goalUi.complete(goal);
    }
    update();
    return root;
  }

  // ===== robot: build a program from a few commands and run it =====
  // { type: "robot", title, intro, cols, rows, start: { x, y, dir }, target: { x, y }, walls: [{ x, y }], goal: { id, text, maxCommands } }
  // dir: 0 up, 1 right, 2 down, 3 left. A command can be repeated (click it in the program to change how many times).
  function robot(comp, ctx) {
    const root = card(comp, "robot");
    const cols = Math.max(3, Math.min(10, comp.cols || 6)), rows = Math.max(3, Math.min(8, comp.rows || 5));
    const start = comp.start || { x: 0, y: rows - 1, dir: 1 };
    const target = comp.target || { x: cols - 1, y: 0 };
    const walls = new Set((comp.walls || []).map(function (w) { return w.x + "," + w.y; }));
    const goal = comp.goal;
    const maxCommands = goal && goal.maxCommands ? goal.maxCommands : null;
    const CMD = {
      fram: { label: "Gå framåt", icon: "↑" },
      hoger: { label: "Sväng höger", icon: "↱" },
      vanster: { label: "Sväng vänster", icon: "↰" }
    };
    const NS = "http://www.w3.org/2000/svg";
    const CELLPX = 52;

    let program = [];
    let pos = { x: start.x, y: start.y, dir: start.dir || 0 };
    let running = false;
    let timer = null;

    const board = document.createElementNS(NS, "svg");
    board.setAttribute("viewBox", "0 0 " + cols * CELLPX + " " + rows * CELLPX);
    board.setAttribute("class", "py-robot-board");
    board.setAttribute("role", "img");
    board.setAttribute("aria-label", "Rutnät med roboten och en stjärna");
    const palette = el("div", "py-robot-palette");
    const list = el("ol", "py-robot-program");
    list.setAttribute("aria-label", "Ditt program");
    const status = el("p", "py-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const actions = el("div", "py-controls-row");
    root.append(board, palette, el("h5", "py-goals-title", "Ditt program"), list, actions, status);
    const goalUi = goal ? goalList([goal], ctx) : null;
    if (goalUi) { root.appendChild(el("h5", "py-goals-title", "Uppdrag")); root.appendChild(goalUi.element); root.appendChild(goalUi.status); }

    function svgEl(tag, attrs, parent) {
      const e = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (parent) parent.appendChild(e);
      return e;
    }

    function draw() {
      board.replaceChildren();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          svgEl("rect", { x: x * CELLPX + 1, y: y * CELLPX + 1, width: CELLPX - 2, height: CELLPX - 2, rx: 6, "class": walls.has(x + "," + y) ? "py-robot-wall" : "py-robot-cell" }, board);
        }
      }
      const star = svgEl("text", { x: target.x * CELLPX + CELLPX / 2, y: target.y * CELLPX + CELLPX / 2 + 10, "text-anchor": "middle", "class": "py-robot-star" }, board);
      star.textContent = "⭐";
      const g = svgEl("g", { transform: "translate(" + (pos.x * CELLPX + CELLPX / 2) + " " + (pos.y * CELLPX + CELLPX / 2) + ") rotate(" + pos.dir * 90 + ")" }, board);
      svgEl("rect", { x: -15, y: -15, width: 30, height: 30, rx: 8, "class": "py-robot-body" }, g);
      svgEl("polygon", { points: "0,-22 9,-12 -9,-12", "class": "py-robot-nose" }, g);
      svgEl("circle", { cx: -6, cy: -3, r: 3.2, "class": "py-robot-eye" }, g);
      svgEl("circle", { cx: 6, cy: -3, r: 3.2, "class": "py-robot-eye" }, g);
    }

    function listProgram() {
      list.replaceChildren();
      if (!program.length) {
        list.appendChild(el("li", "py-robot-empty", "Tryck på knapparna ovan för att bygga ett program."));
        return;
      }
      program.forEach(function (step, i) {
        const li = el("li", "py-robot-step");
        const main = el("button", "py-robot-chip", CMD[step.c].icon + " " + CMD[step.c].label + (step.n > 1 ? " (" + step.n + " gånger)" : ""));
        main.type = "button";
        main.title = "Klicka för att upprepa kommandot fler gånger";
        main.disabled = running;
        main.addEventListener("click", function () { step.n = step.n >= 5 ? 1 : step.n + 1; changed("Kommandot upprepas " + step.n + (step.n === 1 ? " gång." : " gånger.")); });
        const del = el("button", "py-robot-del", "✕");
        del.type = "button";
        del.disabled = running;
        del.setAttribute("aria-label", "Ta bort kommandot");
        del.addEventListener("click", function () { program.splice(i, 1); changed(""); });
        li.append(main, del);
        list.appendChild(li);
      });
    }

    function reset() {
      clearTimeout(timer);
      running = false;
      pos = { x: start.x, y: start.y, dir: start.dir || 0 };
    }

    function changed(message) {
      reset();
      draw();
      listProgram();
      runBtn.disabled = !program.length;
      status.textContent = message || "";
    }

    function steps() {
      const out = [];
      program.forEach(function (step, i) { for (let k = 0; k < step.n; k++) out.push({ c: step.c, i: i }); });
      return out;
    }

    function finish() {
      running = false;
      listProgram();
      runBtn.disabled = !program.length;
      if (pos.x === target.x && pos.y === target.y) {
        if (maxCommands && program.length > maxCommands) {
          status.textContent = "Roboten kom fram, men du använde " + program.length + " kommandon. Försök med högst " + maxCommands + ". Tips: ett kommando kan upprepas.";
        } else {
          status.textContent = "✓ Roboten kom fram till stjärnan med " + program.length + (program.length === 1 ? " kommando!" : " kommandon!");
          status.classList.add("is-ok");
          if (goal && !goalUi.isDone(goal.id)) goalUi.complete(goal);
        }
      } else {
        status.textContent = "Roboten stannade här. Stjärnan är kvar. Ändra programmet och kör igen.";
      }
    }

    function run() {
      if (running || !program.length) return;
      reset();
      draw();
      status.classList.remove("is-ok");
      status.textContent = "Roboten kör…";
      running = true;
      listProgram();
      runBtn.disabled = true;
      const todo = steps();
      let at = 0;
      (function tick() {
        if (at >= todo.length) { finish(); return; }
        const cmd = todo[at++].c;
        if (cmd === "hoger") pos.dir = (pos.dir + 1) % 4;
        else if (cmd === "vanster") pos.dir = (pos.dir + 3) % 4;
        else {
          const dx = [0, 1, 0, -1][pos.dir], dy = [-1, 0, 1, 0][pos.dir];
          const nx = pos.x + dx, ny = pos.y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || walls.has(nx + "," + ny)) {
            draw();
            running = false;
            listProgram();
            runBtn.disabled = !program.length;
            status.textContent = "Roboten körde in i " + (walls.has(nx + "," + ny) ? "en vägg" : "kanten") + ". Ändra programmet och kör igen.";
            return;
          }
          pos.x = nx; pos.y = ny;
        }
        draw();
        timer = setTimeout(tick, 380);
      }());
    }

    Object.keys(CMD).forEach(function (c) {
      const b = button(CMD[c].icon + " " + CMD[c].label, "py-btn py-robot-btn", function () {
        if (running) return;
        if (program.length && program[program.length - 1].c === c && c === "fram") { program[program.length - 1].n = Math.min(5, program[program.length - 1].n + 1); }
        else program.push({ c: c, n: 1 });
        changed("");
      });
      palette.appendChild(b);
    });
    const runBtn = button("▶ Kör", "py-btn", run);
    runBtn.disabled = true;
    actions.append(runBtn,
      button("Börja om", "py-btn py-btn-ghost", function () { changed(""); }),
      button("Rensa programmet", "py-btn py-btn-ghost", function () { program = []; changed(""); }));
    if (maxCommands) status.textContent = "Du får använda högst " + maxCommands + " kommandon.";
    draw();
    listProgram();
    return root;
  }

  function render(comp, ctx) {
    const type = String(comp.type).toLowerCase();
    if (type === "pyssel") return pyssel(comp, ctx);
    if (type === "ritrutnat") return ritrutnat(comp, ctx);
    if (type === "primtalssil") return sil(comp, ctx);
    if (type === "tarning") return tarning(comp, ctx);
    if (type === "robot") return robot(comp, ctx);
    return null;
  }

  // Goals declared by a component (used for progress tracking).
  function goalsOf(comp) {
    if (!comp) return [];
    if (Array.isArray(comp.goals)) return comp.goals;
    return comp.goal ? [comp.goal] : [];
  }

  return { supports: supports, render: render, goalsOf: goalsOf, evalExpr: evalExpr, resolve: resolve, holds: holds, compile: compile };
}());
