// Drawing canvas for solutions: pen, text, and bits that can be placed and moved
// (number tiles, operators, counters, base-ten blocks, shapes, number lines, arrows).
//
// GaussicaCanvas.create({ value, onChange }) -> element   editable canvas for students
// GaussicaCanvas.view(value)                 -> element   read-only drawing (teacher view)
// GaussicaCanvas.isEmpty(value)              -> boolean
//
// The paper is squared (CELL pixels per square). Text, tiles, shapes and lines snap to the squares, and
// shapes and lines can be resized with the round handles. The drawing is stored as a small JSON string:
// { v: 1, g: 1, sn: 0|1, items: [...] }. Every item has a type `t` and a position x/y; strokes keep their
// points relative to that position.

window.GaussicaCanvas = (function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const W = 800, H = 440;
  const CELL = 20;
  const MAX_JSON = 45000;
  const MAX_POINTS = 900;
  const COLORS = [
    { v: "#25304f", name: "Svart" }, { v: "#425b9a", name: "Blå" }, { v: "#e0506d", name: "Rosa" },
    { v: "#2f9d88", name: "Grön" }, { v: "#d98a1f", name: "Orange" }
  ];
  const FONT = "Nunito, system-ui, sans-serif";
  const TEXT_SIZES = [20, 28, 40];
  let uid = 0;

  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function parse(value) {
    if (!value) return { g: 1, sn: 1, items: [] };
    try {
      const d = typeof value === "string" ? JSON.parse(value) : value;
      if (d && Array.isArray(d.items)) return { g: 1, sn: d.sn === 0 ? 0 : 1, items: d.items.filter(function (i) { return i && typeof i.t === "string"; }) };
    } catch (e) { /* corrupt data: treat as empty */ }
    return { g: 1, sn: 1, items: [] };
  }

  function isEmpty(value) { return parse(value).items.length === 0; }

  // ----- drawing items -----
  function chipWidth(it) { return Math.ceil(Math.max(60, String(it.s || "").length * 17 + 26) / CELL) * CELL; }

  // Shapes made before they could be resized have no w/h and keep their old size.
  const SHAPE_DEFAULTS = { kvadrat: [90, 90], rektangel: [150, 80], cirkel: [90, 90], triangel: [100, 86] };
  const SHAPE_NEW = { kvadrat: [100, 100], rektangel: [160, 100], cirkel: [100, 100], triangel: [120, 100] };

  function shapeSize(it) {
    const d = SHAPE_DEFAULTS[it.k] || [100, 86];
    return [Number(it.w) || d[0], Number(it.h) || d[1]];
  }

  function numberLine(it) {
    const min = Number(it.min), max = Number(it.max);
    const n = max - min;
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    let step = steps[steps.length - 1];
    for (let i = 0; i < steps.length; i++) { if (n / steps[i] <= 20) { step = steps[i]; break; } }
    return { min: min, max: max, step: step, width: 440 };
  }

  function arrowHead(x1, y1, x2, y2) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 14;
    return [x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45), x2, y2, x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)];
  }

  function drawItem(it, interactive) {
    const col = COLORS[it.c] || COLORS[0];
    const g = s("g", { transform: "translate(" + (it.x || 0) + " " + (it.y || 0) + ")", "data-t": it.t });
    switch (it.t) {
      case "s": {
        const p = it.p || [];
        let d = "M" + p[0] + " " + p[1];
        if (p.length <= 2) d += " l0 0.01";
        for (let i = 2; i < p.length; i += 2) d += " L" + p[i] + " " + p[i + 1];
        s("path", { d: d, fill: "none", stroke: col.v, "stroke-width": it.w || 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
        if (interactive) s("path", { d: d, fill: "none", stroke: "transparent", "stroke-width": Math.max(18, it.w || 3), "stroke-linecap": "round", "stroke-linejoin": "round", "pointer-events": "stroke" }, g);
        break;
      }
      case "t": {
        const size = it.z || 24;
        const step = it.lh || size * 1.25;
        const lines = String(it.s || "").split("\n");
        const widest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
        s("rect", { x: -4, y: -size, width: widest * size * 0.58 + 8, height: (lines.length - 1) * step + size * 1.25 + 4, fill: "transparent" }, g);
        const t = s("text", { x: 0, y: 0, fill: col.v, "font-size": size, "font-weight": 700, "font-family": FONT }, g);
        lines.forEach(function (l, i) {
          const sp = s("tspan", { x: 0, dy: i ? step : 0 }, t);
          sp.textContent = l;
        });
        break;
      }
      case "chip": {
        const w = chipWidth(it);
        s("rect", { x: 0, y: 0, width: w, height: 40, rx: 10, fill: "#fff", stroke: col.v, "stroke-width": 3 }, g);
        const t = s("text", { x: w / 2, y: 28, "text-anchor": "middle", fill: col.v, "font-size": 24, "font-weight": 800, "font-family": FONT }, g);
        t.textContent = it.s || "";
        break;
      }
      case "op": {
        s("circle", { cx: 20, cy: 20, r: 20, fill: col.v }, g);
        const t = s("text", { x: 20, y: 29, "text-anchor": "middle", fill: "#fff", "font-size": 26, "font-weight": 800, "font-family": FONT }, g);
        t.textContent = it.s || "+";
        break;
      }
      case "dot":
        s("circle", { cx: 10, cy: 10, r: 9, fill: col.v, "fill-opacity": 0.9, stroke: "#fff", "stroke-width": 1.5 }, g);
        break;
      case "ones":
        s("rect", { x: 0, y: 0, width: CELL, height: CELL, rx: 3, fill: "#76c0ec", stroke: "#425b9a", "stroke-width": 2 }, g);
        break;
      case "tens":
        s("rect", { x: 0, y: 0, width: 10 * CELL, height: CELL, rx: 3, fill: "#76c0ec", stroke: "#425b9a", "stroke-width": 2 }, g);
        for (let i = 1; i < 10; i++) s("line", { x1: i * CELL, y1: 0, x2: i * CELL, y2: CELL, stroke: "#425b9a", "stroke-width": 1.5 }, g);
        break;
      case "hund":
        s("rect", { x: 0, y: 0, width: 10 * CELL, height: 10 * CELL, rx: 3, fill: "#a9d6f3", stroke: "#425b9a", "stroke-width": 2 }, g);
        for (let i = 1; i < 10; i++) {
          s("line", { x1: i * CELL, y1: 0, x2: i * CELL, y2: 10 * CELL, stroke: "#425b9a", "stroke-width": 1 }, g);
          s("line", { x1: 0, y1: i * CELL, x2: 10 * CELL, y2: i * CELL, stroke: "#425b9a", "stroke-width": 1 }, g);
        }
        break;
      case "shape": {
        const size = shapeSize(it);
        const w = size[0], h = size[1];
        const attrs = { fill: col.v, "fill-opacity": 0.18, stroke: col.v, "stroke-width": 3, "stroke-linejoin": "round" };
        if (it.k === "kvadrat" || it.k === "rektangel") s("rect", Object.assign({ x: 0, y: 0, width: w, height: h }, attrs), g);
        else if (it.k === "cirkel") s("ellipse", Object.assign({ cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2 }, attrs), g);
        else s("polygon", Object.assign({ points: w / 2 + ",0 " + w + "," + h + " 0," + h }, attrs), g);
        break;
      }
      case "line": {
        const dx = it.dx || 0, dy = it.dy || 0;
        if (interactive) s("line", { x1: 0, y1: 0, x2: dx, y2: dy, stroke: "transparent", "stroke-width": 20, "stroke-linecap": "round" }, g);
        s("line", { x1: 0, y1: 0, x2: dx, y2: dy, stroke: col.v, "stroke-width": 4, "stroke-linecap": "round" }, g);
        if (it.h) s("polyline", { points: arrowHead(0, 0, dx, dy).join(" "), fill: "none", stroke: col.v, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
        break;
      }
      case "nl": {
        const nl = numberLine(it);
        s("rect", { x: -10, y: -6, width: nl.width + 20, height: 80, fill: "transparent" }, g);
        s("line", { x1: 0, y1: 20, x2: nl.width, y2: 20, stroke: col.v, "stroke-width": 3, "stroke-linecap": "round" }, g);
        const span = nl.max - nl.min || 1;
        for (let v = nl.min; v <= nl.max + 1e-9; v += 1) {
          const x = (v - nl.min) / span * nl.width;
          const major = (v - nl.min) % nl.step === 0;
          if (nl.max - nl.min > 40 && !major) continue;
          s("line", { x1: x, y1: major ? 8 : 13, x2: x, y2: major ? 32 : 27, stroke: col.v, "stroke-width": major ? 3 : 2 }, g);
          if (major) {
            const t = s("text", { x: x, y: 56, "text-anchor": "middle", fill: col.v, "font-size": 16, "font-weight": 700, "font-family": FONT }, g);
            t.textContent = String(v);
          }
        }
        break;
      }
      default:
        return null;
    }
    return g;
  }

  // Squared paper: a light line every CELL, a slightly stronger one every fifth square.
  function background(svg) {
    const id = ++uid;
    s("rect", { x: 0, y: 0, width: W, height: H, fill: "#fffdf7" }, svg);
    const defs = s("defs", {}, svg);
    const minor = s("pattern", { id: "cv-grid-" + id, width: CELL, height: CELL, patternUnits: "userSpaceOnUse" }, defs);
    s("path", { d: "M" + CELL + " 0 H0 V" + CELL, fill: "none", stroke: "#dbe9f5", "stroke-width": 1 }, minor);
    const major = s("pattern", { id: "cv-major-" + id, width: CELL * 5, height: CELL * 5, patternUnits: "userSpaceOnUse" }, defs);
    s("path", { d: "M" + CELL * 5 + " 0 H0 V" + CELL * 5, fill: "none", stroke: "#bcd5ea", "stroke-width": 1.4 }, major);
    s("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#cv-grid-" + id + ")" }, svg);
    s("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#cv-major-" + id + ")" }, svg);
  }

  // ----- read-only view -----
  function view(value) {
    const data = parse(value);
    if (!data.items.length) return null;
    const wrap = el("div", "cv-view");
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, "class": "cv-svg", role: "img", "aria-label": "Elevens rityta" });
    background(svg);
    const layer = s("g", {}, svg);
    data.items.forEach(function (it) { const g = drawItem(it, false); if (g) layer.appendChild(g); });
    wrap.appendChild(svg);
    return wrap;
  }

  // ----- editor -----
  const PLACE = [
    { id: "chip", label: "Tal", make: function () { return { t: "chip", s: "" }; }, edit: true },
    { id: "plus", label: "+", make: function () { return { t: "op", s: "+" }; } },
    { id: "minus", label: "−", make: function () { return { t: "op", s: "−" }; } },
    { id: "times", label: "×", make: function () { return { t: "op", s: "×" }; } },
    { id: "div", label: "÷", make: function () { return { t: "op", s: "÷" }; } },
    { id: "eq", label: "=", make: function () { return { t: "op", s: "=" }; } },
    { id: "dot", label: "Prick", make: function () { return { t: "dot" }; } },
    { id: "ones", label: "Ental", make: function () { return { t: "ones" }; } },
    { id: "tens", label: "Tiotal", make: function () { return { t: "tens" }; } },
    { id: "hund", label: "Hundratal", make: function () { return { t: "hund" }; } },
    { id: "kvadrat", label: "Kvadrat", make: function () { return { t: "shape", k: "kvadrat" }; } },
    { id: "rektangel", label: "Rektangel", make: function () { return { t: "shape", k: "rektangel" }; } },
    { id: "triangel", label: "Triangel", make: function () { return { t: "shape", k: "triangel" }; } },
    { id: "cirkel", label: "Cirkel", make: function () { return { t: "shape", k: "cirkel" }; } },
    { id: "nl", label: "Tallinje", make: function () { return { t: "nl", min: 0, max: 10 }; } }
  ];
  const SIZES = { chip: [60, 40], op: [40, 40], dot: [20, 20], ones: [CELL, CELL], tens: [10 * CELL, CELL], hund: [10 * CELL, 10 * CELL], nl: [440, 80] };

  const TOOLS = [
    { id: "select", label: "Flytta", hint: "Klicka på något för att markera och dra det. Figurer och linjer får runda punkter som du drar i för att ändra storleken. Dubbelklicka på text och tal för att ändra." },
    { id: "pen", label: "Rita", hint: "Rita fritt med pekaren eller fingret." },
    { id: "text", label: "Text", hint: "Klicka i rutan där du vill skriva. Texten hamnar på rutnätet. Tryck Enter när du är klar." },
    { id: "erase", label: "Sudd", hint: "Dra över det du vill ta bort." },
    { id: "line", label: "Linje", hint: "Dra för att rita en rak linje. Den fastnar på rutnätets hörn." },
    { id: "arrow", label: "Pil", hint: "Dra för att rita en pil. Den fastnar på rutnätets hörn." }
  ];

  function cells(n) {
    const v = Math.round(n / CELL * 10) / 10;
    return String(v).replace(".", ",");
  }

  function create(options) {
    options = options || {};
    const initial = parse(options.value);
    let items = initial.items;
    let snapOn = Boolean(initial.sn);
    let tool = "select";
    let color = 0;
    let width = 3;
    let selected = -1;
    let editing = null;
    const history = [];
    let hIdx = -1;

    const root = el("div", "cv");
    const toolbar = el("div", "cv-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Verktyg för ritytan");
    const bits = el("div", "cv-bits");
    bits.setAttribute("role", "toolbar");
    bits.setAttribute("aria-label", "Saker att lägga på ritytan");
    const stage = el("div", "cv-stage");
    stage.tabIndex = 0;
    const svg = s("svg", { viewBox: "0 0 " + W + " " + H, "class": "cv-svg", role: "img", "aria-label": "Rityta för din lösning" });
    const bgHolder = s("g", {}, svg);
    const layer = s("g", {}, svg);
    stage.appendChild(svg);
    const foot = el("div", "cv-foot");
    const hint = el("p", "cv-hint");
    hint.setAttribute("aria-live", "polite");
    const selbar = el("div", "cv-selbar");
    selbar.hidden = true;
    foot.append(hint, selbar);
    root.append(toolbar, bits, stage, foot);

    function button(label, className, onClick) {
      const b = el("button", "cv-btn" + (className ? " " + className : ""), label);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    // --- model ---
    function serialize() { return JSON.stringify({ v: 1, g: 1, sn: snapOn ? 1 : 0, items: items }); }

    function emit(json) {
      if (options.onChange) options.onChange(items.length ? json : "");
    }

    function say(text) { hint.textContent = text; }

    // Snap a coordinate to the squares (or just round it when snapping is off).
    function snapV(v) { return snapOn ? Math.round(v / CELL) * CELL : Math.round(v); }

    function restore(snapshot) {
      const d = parse(snapshot);
      items = d.items;
      snapOn = Boolean(d.sn);
      selected = -1;
      render();
      syncUi();
    }

    function commit() {
      const json = serialize();
      if (json.length > MAX_JSON) {
        restore(history[hIdx]);
        say("Ritytan är full. Ta bort något innan du lägger till mer.");
        return false;
      }
      history.splice(hIdx + 1);
      history.push(json);
      if (history.length > 60) history.shift();
      hIdx = history.length - 1;
      emit(json);
      syncUi();
      return true;
    }

    // --- rendering ---
    function itemSize(it) {
      if (it.t === "chip") return [chipWidth(it), 40];
      if (it.t === "shape") return shapeSize(it);
      return SIZES[it.t] || [40, 40];
    }

    // Round handles for changing the size of a shape or the end of a line.
    function handleSpecs(it) {
      if (it.t === "line") return [{ mode: "line", x: it.dx || 0, y: it.dy || 0 }];
      if (it.t !== "shape") return [];
      const size = shapeSize(it);
      const w = size[0], h = size[1];
      if (it.k === "kvadrat" || it.k === "cirkel") return [{ mode: "wh", x: w, y: h }];
      return [{ mode: "w", x: w, y: h / 2 }, { mode: "h", x: w / 2, y: h }, { mode: "wh", x: w, y: h }];
    }

    function decorate(g, i) {
      if (i !== selected) return;
      const b = g.getBBox();   // measured after insertion: a detached group has no box
      s("rect", { x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12, rx: 8, "class": "cv-sel" }, g);
      if (tool !== "select") return;
      handleSpecs(items[i]).forEach(function (h) {
        const hg = s("g", { "class": "cv-handle", "data-mode": h.mode, transform: "translate(" + h.x + " " + h.y + ")" }, g);
        s("circle", { r: 20, fill: "transparent" }, hg);
        s("circle", { r: 8, "class": "cv-handle-dot" }, hg);
      });
    }

    function buildNode(i) {
      const g = drawItem(items[i], true);
      if (g) g.setAttribute("data-i", String(i));
      return g;
    }

    // Redraws one item in place (used while dragging, so the rest of the drawing is left alone).
    function refreshNode(i) {
      const old = layer.querySelector('[data-i="' + i + '"]');
      const g = buildNode(i);
      if (!g) return;
      if (old) layer.replaceChild(g, old); else layer.appendChild(g);
      decorate(g, i);
    }

    function render() {
      bgHolder.replaceChildren();
      background(bgHolder);
      layer.replaceChildren();
      items.forEach(function (it, i) {
        const g = buildNode(i);
        if (!g) return;
        layer.appendChild(g);
        decorate(g, i);
      });
      syncSelection();
    }

    function syncSelection() {
      const it = selected >= 0 ? items[selected] : null;
      selbar.hidden = !it || tool !== "select";
      if (!it) return;
      const isText = it.t === "t";
      Array.prototype.forEach.call(selbar.querySelectorAll("[data-text]"), function (b) { b.hidden = !isText; });
    }

    function syncUi() {
      Array.prototype.forEach.call(toolbar.querySelectorAll("[data-tool]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tool === tool)); });
      Array.prototype.forEach.call(bits.querySelectorAll("[data-place]"), function (b) { b.setAttribute("aria-pressed", String(tool === "place:" + b.dataset.place)); });
      Array.prototype.forEach.call(toolbar.querySelectorAll("[data-color]"), function (b) { b.setAttribute("aria-pressed", String(Number(b.dataset.color) === color)); });
      const thick = toolbar.querySelector("[data-act=width]");
      if (thick) { thick.textContent = width > 3 ? "Tjock penna" : "Tunn penna"; }
      const snapBtn = toolbar.querySelector("[data-act=snap]");
      if (snapBtn) snapBtn.setAttribute("aria-pressed", String(snapOn));
      toolbar.querySelector("[data-act=undo]").disabled = hIdx <= 0;
      toolbar.querySelector("[data-act=redo]").disabled = hIdx >= history.length - 1;
      toolbar.querySelector("[data-act=clear]").disabled = !items.length;
      stage.dataset.tool = tool.indexOf("place:") === 0 ? "place" : tool;
      syncSelection();
    }

    function setTool(id) {
      finishEdit(true);
      tool = id;
      if (id.indexOf("place:") !== 0) {
        const t = TOOLS.find(function (x) { return x.id === id; });
        say(t ? t.hint : "");
      } else {
        const p = PLACE.find(function (x) { return "place:" + x.id === id; });
        const isShape = p && p.make().t === "shape";
        say(isShape
          ? "Dra i rutan för att rita «" + p.label.toLowerCase() + "» så stor du vill, eller klicka för en vanlig storlek. Sedan kan du ändra storleken med de runda punkterna."
          : "Klicka i rutan för att lägga ut «" + (p ? p.label : "") + "». Byt till Flytta för att flytta den.");
      }
      if (id !== "select" && selected >= 0) { selected = -1; render(); }
      syncUi();
    }

    // --- geometry ---
    function point(e) {
      const r = svg.getBoundingClientRect();
      return { x: Math.max(0, Math.min(W, (e.clientX - r.left) * W / r.width)), y: Math.max(0, Math.min(H, (e.clientY - r.top) * H / r.height)) };
    }

    function itemAt(e) {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const g = hit && hit.closest ? hit.closest("[data-i]") : null;
      return g && layer.contains(g) ? Number(g.getAttribute("data-i")) : -1;
    }

    function clampPos(it, x, y) {
      const size = itemSize(it);
      return [Math.max(-size[0] + 30, Math.min(W - 30, x)), Math.max(-size[1] + 30, Math.min(H - 30, y))];
    }

    // --- inline editing (text, number tiles, number-line range) ---
    function finishEdit(save) {
      if (!editing) return;
      const ed = editing;
      editing = null;
      const value = ed.input.value;
      ed.input.remove();
      if (!save) { if (ed.isNew) render(); return; }
      const it = ed.item;
      let changed = false;
      if (it.t === "nl") {
        const m = /(-?\d+)\D+?(-?\d+)/.exec(value.replace(/\s/g, ""));
        if (m && Number(m[2]) > Number(m[1]) && Number(m[2]) - Number(m[1]) <= 1000) {
          it.min = Number(m[1]); it.max = Number(m[2]); changed = true;
        } else say("Skriv två tal, till exempel 0–20.");
      } else if (value.trim()) {
        if (it.t === "chip") it.s = value.trim().slice(0, 12);
        else it.s = value.slice(0, 300);
        changed = true;
      } else if (!ed.isNew) {
        items.splice(items.indexOf(it), 1);
        selected = -1;
        changed = true;
      }
      if (ed.isNew && changed && items.indexOf(it) < 0) { items.push(it); selected = items.length - 1; }
      render();
      if (changed) commit();
    }

    function startEdit(it, isNew) {
      finishEdit(true);
      const r = svg.getBoundingClientRect();
      const k = r.width / W;
      const input = el("input", "cv-edit");
      input.type = "text";
      input.maxLength = it.t === "chip" ? 12 : 300;
      input.setAttribute("aria-label", it.t === "nl" ? "Tallinjens start och slut" : "Text");
      let left = (it.x || 0), top = (it.y || 0), w = 220, size = 22;
      if (it.t === "t") { size = it.z || 24; top = (it.y || 0) - size; input.value = it.s || ""; w = Math.max(180, (String(it.s || "").length + 4) * size * 0.58); }
      else if (it.t === "chip") { input.value = it.s || ""; w = Math.max(chipWidth(it), 70); size = 22; input.className += " is-center"; }
      else if (it.t === "nl") { input.value = it.min + "–" + it.max; w = 150; top = (it.y || 0) + 10; left = (it.x || 0) + 140; }
      input.style.left = (left * k) + "px";
      input.style.top = (top * k) + "px";
      input.style.width = Math.min(w * k, r.width - left * k - 4) + "px";
      input.style.fontSize = Math.max(14, size * k) + "px";
      input.style.color = (COLORS[it.c] || COLORS[0]).v;
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); finishEdit(true); stage.focus({ preventScroll: true }); }
        else if (e.key === "Escape") { e.preventDefault(); finishEdit(false); stage.focus({ preventScroll: true }); }
      });
      input.addEventListener("blur", function () { finishEdit(true); });
      stage.appendChild(input);
      editing = { input: input, item: it, isNew: Boolean(isNew) };
      input.focus();
      input.select();
    }

    // --- pointer handling ---
    let drag = null;

    function sizeText(it) {
      if (it.t === "line") return "Längd " + cells(Math.hypot(it.dx || 0, it.dy || 0)) + " rutor";
      const size = shapeSize(it);
      if (it.k === "kvadrat") return "Sida " + cells(size[0]) + " rutor";
      if (it.k === "cirkel") return "Diameter " + cells(size[0]) + " rutor";
      if (it.k === "triangel") return "Bas " + cells(size[0]) + " rutor, höjd " + cells(size[1]) + " rutor";
      return "Bredd " + cells(size[0]) + " rutor, höjd " + cells(size[1]) + " rutor";
    }

    // Sets a shape's box from two corners. Squares and circles stay square.
    function fitShape(it, ax, ay, bx, by) {
      let w = Math.max(CELL, Math.abs(bx - ax)), h = Math.max(CELL, Math.abs(by - ay));
      if (it.k === "kvadrat" || it.k === "cirkel") { w = h = Math.max(w, h); }
      let x = bx < ax ? ax - w : ax, y = by < ay ? ay - h : ay;
      x = Math.max(0, Math.min(W - w, x));
      y = Math.max(0, Math.min(H - h, y));
      if (it.k === "kvadrat" || it.k === "cirkel") { const m = Math.min(w, W - x, H - y); w = h = Math.max(CELL, m); }
      it.x = x; it.y = y; it.w = w; it.h = h;
    }

    svg.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (editing) { finishEdit(true); }
      stage.focus({ preventScroll: true });
      const p = point(e);
      e.preventDefault();

      if (tool === "pen") {
        const it = { t: "s", c: color, w: width, x: 0, y: 0, p: [Math.round(p.x), Math.round(p.y)] };
        items.push(it);
        selected = -1;
        render();
        drag = { kind: "pen", item: it, el: layer.lastChild.firstChild };
        svg.setPointerCapture(e.pointerId);
      } else if (tool === "erase") {
        drag = { kind: "erase", removed: 0 };
        svg.setPointerCapture(e.pointerId);
        eraseAt(e);
      } else if (tool === "line" || tool === "arrow") {
        const it = { t: "line", c: color, x: snapV(p.x), y: snapV(p.y), dx: 0, dy: 0, h: tool === "arrow" ? 1 : 0 };
        items.push(it);
        render();
        drag = { kind: "line", item: it, g: layer.lastChild };
        svg.setPointerCapture(e.pointerId);
      } else if (tool === "text") {
        const hit = itemAt(e);
        if (hit >= 0 && items[hit].t === "t") { selected = hit; startEdit(items[hit], false); return; }
        // the text sits on the grid line below the click, like writing on squared paper
        const y = snapOn ? Math.ceil((p.y - 2) / CELL) * CELL : Math.round(p.y + 6);
        startEdit({ t: "t", c: color, z: 28, lh: 40, x: snapV(p.x), y: Math.max(CELL, y), s: "" }, true);
      } else if (tool.indexOf("place:") === 0) {
        const spec = PLACE.find(function (x) { return "place:" + x.id === tool; });
        const it = Object.assign({ c: color }, spec.make());
        if (it.t === "shape") {
          drag = { kind: "shape", item: it, added: false, sx: snapV(p.x), sy: snapV(p.y), cx: p.x, cy: p.y };
          svg.setPointerCapture(e.pointerId);
          return;
        }
        const size = itemSize(it);
        const pos = clampPos(it, snapV(p.x - size[0] / 2), snapV(p.y - size[1] / 2));
        it.x = Math.max(0, Math.min(W - size[0], pos[0]));
        it.y = Math.max(0, Math.min(H - size[1], pos[1]));
        if (spec.edit) { startEdit(it, true); return; }
        items.push(it);
        selected = items.length - 1;
        render();
        commit();
      } else {
        const handle = e.target.closest ? e.target.closest(".cv-handle") : null;
        if (handle && selected >= 0 && items[selected]) {
          const it = items[selected];
          drag = { kind: "resize", item: it, index: selected, mode: handle.getAttribute("data-mode"), changed: false };
          svg.setPointerCapture(e.pointerId);
          return;
        }
        const hit = itemAt(e);
        selected = hit;
        render();
        if (hit >= 0) {
          const it = items[hit];
          drag = { kind: "move", item: it, g: layer.querySelector('[data-i="' + hit + '"]'), sx: p.x, sy: p.y, ox: it.x || 0, oy: it.y || 0, moved: false };
          svg.setPointerCapture(e.pointerId);
        }
      }
    });

    function eraseAt(e) {
      const hit = itemAt(e);
      if (hit < 0) return;
      items.splice(hit, 1);
      drag.removed++;
      render();
    }

    svg.addEventListener("pointermove", function (e) {
      if (!drag) return;
      const p = point(e);
      if (drag.kind === "pen") {
        const pts = drag.item.p;
        const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
        if (Math.abs(p.x - lx) + Math.abs(p.y - ly) < 2.5 || pts.length >= MAX_POINTS * 2) return;
        pts.push(Math.round(p.x), Math.round(p.y));
        let d = drag.el.getAttribute("d");
        if (pts.length === 4) d = "M" + pts[0] + " " + pts[1];
        d = d.replace(/ l0 0\.01$/, "") + " L" + Math.round(p.x) + " " + Math.round(p.y);
        drag.el.setAttribute("d", d);
        const hitEl = drag.el.nextSibling;
        if (hitEl) hitEl.setAttribute("d", d);
      } else if (drag.kind === "erase") {
        eraseAt(e);
      } else if (drag.kind === "line") {
        drag.item.dx = snapV(p.x) - drag.item.x;
        drag.item.dy = snapV(p.y) - drag.item.y;
        const g = drawItem(drag.item, true);
        g.setAttribute("data-i", String(items.indexOf(drag.item)));
        layer.replaceChild(g, drag.g);
        drag.g = g;
      } else if (drag.kind === "shape") {
        const ex = snapV(p.x), ey = snapV(p.y);
        if (!drag.added) {
          if (Math.abs(p.x - drag.cx) + Math.abs(p.y - drag.cy) < 8) return;   // a click, not a drag
          drag.added = true;
          items.push(drag.item);
          selected = -1;
          fitShape(drag.item, drag.sx, drag.sy, ex, ey);
          render();
        } else {
          fitShape(drag.item, drag.sx, drag.sy, ex, ey);
          refreshNode(items.indexOf(drag.item));
        }
        say(sizeText(drag.item));
      } else if (drag.kind === "resize") {
        const it = drag.item;
        if (it.t === "line") {
          it.dx = snapV(p.x) - it.x;
          it.dy = snapV(p.y) - it.y;
        } else {
          const square = it.k === "kvadrat" || it.k === "cirkel";
          const old = shapeSize(it);
          let w = old[0], h = old[1];
          if (drag.mode === "w" || drag.mode === "wh") w = snapV(p.x) - it.x;
          if (drag.mode === "h" || drag.mode === "wh") h = snapV(p.y) - it.y;
          if (square) w = h = Math.max(w, h);
          w = Math.max(CELL, w); h = Math.max(CELL, h);
          if (square) { w = h = Math.min(w, W - it.x, H - it.y); }
          else { w = Math.min(w, W - it.x); h = Math.min(h, H - it.y); }
          it.w = Math.max(CELL, w); it.h = Math.max(CELL, h);
        }
        drag.changed = true;
        refreshNode(drag.index);
        say(sizeText(it));
      } else if (drag.kind === "move") {
        const dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        drag.moved = true;
        const pos = clampPos(drag.item, snapV(drag.ox + dx), snapV(drag.oy + dy));
        drag.item.x = Math.round(pos[0]);
        drag.item.y = Math.round(pos[1]);
        drag.g.setAttribute("transform", "translate(" + drag.item.x + " " + drag.item.y + ")");
      }
    });

    function endDrag() {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.kind === "pen") {
        selected = -1;
        render();
        commit();
      } else if (d.kind === "erase") {
        if (d.removed) { selected = -1; commit(); }
      } else if (d.kind === "line") {
        if (Math.abs(d.item.dx) + Math.abs(d.item.dy) < 8) items.splice(items.indexOf(d.item), 1);
        render();
        if (items.indexOf(d.item) >= 0) commit();
      } else if (d.kind === "shape") {
        if (!d.added) {   // plain click: a shape of the usual size, centred on the click
          const size = SHAPE_NEW[d.item.k] || [100, 100];
          d.item.w = size[0]; d.item.h = size[1];
          d.item.x = Math.max(0, Math.min(W - size[0], snapV(d.cx - size[0] / 2)));
          d.item.y = Math.max(0, Math.min(H - size[1], snapV(d.cy - size[1] / 2)));
          items.push(d.item);
        }
        selected = items.indexOf(d.item);
        tool = "select";
        render();
        if (commit()) {
          setTool("select");
          selected = items.indexOf(d.item);
          render();
          say("Dra i de runda punkterna för att ändra storleken. " + sizeText(d.item) + ".");
        }
      } else if (d.kind === "resize") {
        if (d.changed) { commit(); say(sizeText(d.item) + "."); }
      } else if (d.kind === "move") {
        if (d.moved) commit();
      }
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    svg.addEventListener("dblclick", function (e) {
      if (tool !== "select") return;
      const hit = itemAt(e);
      if (hit < 0) return;
      const it = items[hit];
      if (it.t === "t" || it.t === "chip" || it.t === "nl") { selected = hit; render(); startEdit(it, false); }
    });

    // --- actions on the selected item ---
    function removeSelected() {
      if (selected < 0) return;
      items.splice(selected, 1);
      selected = -1;
      render();
      commit();
    }

    function copySelected() {
      const it = items[selected];
      if (!it) return;
      const copy = JSON.parse(JSON.stringify(it));
      const pos = clampPos(copy, (copy.x || 0) + CELL * 2, (copy.y || 0) + CELL * 2);
      copy.x = pos[0]; copy.y = pos[1];
      items.push(copy);
      selected = items.length - 1;
      render();
      commit();
    }

    function textSize(step) {
      const it = items[selected];
      if (!it || it.t !== "t") return;
      const at = TEXT_SIZES.indexOf(it.z);   // older text (size 24) counts as the middle size
      const next = TEXT_SIZES[Math.max(0, Math.min(TEXT_SIZES.length - 1, (at < 0 ? 1 : at) + step))];
      it.z = next;
      it.lh = next > 32 ? 60 : 40;
      render();
      commit();
    }

    function nudge(dx, dy) {
      const it = items[selected];
      if (!it) return;
      const pos = clampPos(it, (it.x || 0) + dx, (it.y || 0) + dy);
      it.x = pos[0]; it.y = pos[1];
      render();
      commit();
    }

    stage.addEventListener("keydown", function (e) {
      if (editing) return;
      const step = snapOn ? CELL : 2;
      if ((e.key === "Delete" || e.key === "Backspace") && selected >= 0) {
        e.preventDefault();
        removeSelected();
      } else if (selected >= 0 && tool === "select" && e.key.indexOf("Arrow") === 0) {
        e.preventDefault();
        nudge(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    });

    function undo() {
      finishEdit(true);
      if (hIdx <= 0) return;
      hIdx--;
      restore(history[hIdx]);
      emit(history[hIdx]);
    }

    function redo() {
      finishEdit(true);
      if (hIdx >= history.length - 1) return;
      hIdx++;
      restore(history[hIdx]);
      emit(history[hIdx]);
    }

    // --- toolbar ---
    TOOLS.forEach(function (t) {
      const b = button(t.label, "", function () { setTool(t.id); });
      b.dataset.tool = t.id;
      toolbar.appendChild(b);
    });
    const swatches = el("span", "cv-swatches");
    COLORS.forEach(function (c, i) {
      const b = el("button", "cv-swatch");
      b.type = "button";
      b.style.setProperty("--swatch", c.v);
      b.dataset.color = String(i);
      b.setAttribute("aria-label", c.name);
      b.title = c.name;
      b.addEventListener("click", function () {
        color = i;
        if (selected >= 0 && items[selected]) { items[selected].c = i; render(); commit(); }
        syncUi();
      });
      swatches.appendChild(b);
    });
    toolbar.appendChild(swatches);
    const widthBtn = button("Tunn penna", "", function () { width = width > 3 ? 3 : 7; syncUi(); });
    widthBtn.dataset.act = "width";
    const snapBtn = button("Fäst i rutor", "", function () {
      snapOn = !snapOn;
      say(snapOn ? "Text, tal och figurer fastnar på rutnätet." : "Du kan nu placera saker precis var du vill.");
      commit();
    });
    snapBtn.title = "När det är på fastnar text, tal, figurer och linjer på rutnätet";
    snapBtn.dataset.act = "snap";
    const undoBtn = button("Ångra", "", undo);
    undoBtn.dataset.act = "undo";
    const redoBtn = button("Gör om", "", redo);
    redoBtn.dataset.act = "redo";
    const clearBtn = button("Rensa", "cv-btn-quiet", function () {
      if (!items.length) return;
      if (items.length > 3 && !window.confirm("Ta bort allt på ritytan?")) return;
      items = [];
      selected = -1;
      render();
      commit();
    });
    clearBtn.dataset.act = "clear";
    toolbar.append(widthBtn, snapBtn, undoBtn, redoBtn, clearBtn);

    bits.appendChild(el("span", "cv-bits-label", "Lägg till:"));
    PLACE.forEach(function (p) {
      const b = button(p.label, "cv-bit", function () { setTool(tool === "place:" + p.id ? "select" : "place:" + p.id); });
      b.dataset.place = p.id;
      bits.appendChild(b);
    });

    // actions for the marked item (shown under the paper, so the paper does not jump around)
    const smaller = button("A−", "cv-btn-small", function () { textSize(-1); });
    smaller.dataset.text = "1";
    smaller.title = "Mindre text";
    const larger = button("A+", "cv-btn-small", function () { textSize(1); });
    larger.dataset.text = "1";
    larger.title = "Större text";
    const copyBtn = button("Kopiera", "cv-btn-small", copySelected);
    const delBtn = button("Ta bort", "cv-btn-small cv-btn-danger", removeSelected);
    selbar.append(smaller, larger, copyBtn, delBtn);

    history.push(serialize());
    hIdx = 0;
    render();
    syncUi();
    say(TOOLS[0].hint);

    root.getValue = function () { return items.length ? serialize() : ""; };
    return root;
  }

  return { create: create, view: view, isEmpty: isEmpty, parse: parse };
}());
