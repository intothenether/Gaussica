// Drawing canvas for solutions: pen, text, and bits that can be placed and moved
// (number tiles, operators, counters, base-ten blocks, shapes, number lines, arrows).
//
// GaussicaCanvas.create({ value, onChange }) -> element   editable canvas for students
// GaussicaCanvas.view(value)                 -> element   read-only drawing (teacher view)
// GaussicaCanvas.isEmpty(value)              -> boolean
//
// The paper is squared (CELL pixels per square) and endless: drag empty paper to move it, pinch or use the
// zoom buttons to zoom. The "Skriv" tool writes one character per square (items of type r). Text, tiles,
// shapes and lines snap to the squares, and shapes and lines can be resized with the round handles.
// The drawing is stored as a small JSON string: { v: 1, g: 1, sn: 0|1, vw: { x, y, z }, items: [...] }. Every item has a type `t` and a position x/y; strokes keep their
// points relative to that position.

window.GaussicaCanvas = (function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const W = 800, H = 440;
  const CELL = 20;
  const ROWH = CELL * 2;          // a row of typed characters is two squares high
  const LIM = 20000;              // the paper is endless, but not quite
  const ZMIN = 0.4, ZMAX = 2.5;
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
    const empty = { g: 1, sn: 1, view: { x: 0, y: 0, z: 1 }, hasView: false, items: [] };
    if (!value) return empty;
    try {
      const d = typeof value === "string" ? JSON.parse(value) : value;
      if (d && Array.isArray(d.items)) {
        const vw = d.vw || {};
        const num = function (v, dflt) { return Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : dflt; };
        return {
          g: 1, sn: d.sn === 0 ? 0 : 1, hasView: Boolean(d.vw),
          view: { x: Math.max(-LIM, Math.min(LIM, num(vw.x, 0))), y: Math.max(-LIM, Math.min(LIM, num(vw.y, 0))), z: Math.max(ZMIN, Math.min(ZMAX, num(vw.z, 1))) },
          items: d.items.filter(function (i) { return i && typeof i.t === "string"; })
        };
      }
    } catch (e) { /* corrupt data: treat as empty */ }
    return empty;
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
      case "r": {
        const str = String(it.s || "");
        s("rect", { x: 0, y: 0, width: Math.max(1, str.length) * CELL, height: ROWH, fill: "transparent" }, g);
        const t = s("text", { fill: col.v, "font-size": 30, "font-weight": 800, "font-family": FONT, "text-anchor": "middle" }, g);
        for (let i = 0; i < str.length; i++) {
          if (str.charAt(i) === " ") continue;
          const sp = s("tspan", { x: i * CELL + CELL / 2, y: ROWH - 9 }, t);
          sp.textContent = str.charAt(i);
        }
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
        const sign = it.s === "×" ? "·" : (it.s || "+");   // always the multiplication dot
        const dot = sign === "·";
        const t = s("text", { x: 20, y: dot ? 32 : 29, "text-anchor": "middle", fill: "#fff", "font-size": dot ? 44 : 26, "font-weight": 800, "font-family": FONT }, g);
        t.textContent = sign;
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
    s("rect", { x: -LIM, y: -LIM, width: 2 * LIM, height: 2 * LIM, fill: "#fffdf7" }, svg);
    const defs = s("defs", {}, svg);
    const minor = s("pattern", { id: "cv-grid-" + id, width: CELL, height: CELL, patternUnits: "userSpaceOnUse" }, defs);
    s("path", { d: "M" + CELL + " 0 H0 V" + CELL, fill: "none", stroke: "#dbe9f5", "stroke-width": 1 }, minor);
    const major = s("pattern", { id: "cv-major-" + id, width: CELL * 5, height: CELL * 5, patternUnits: "userSpaceOnUse" }, defs);
    s("path", { d: "M" + CELL * 5 + " 0 H0 V" + CELL * 5, fill: "none", stroke: "#bcd5ea", "stroke-width": 1.4 }, major);
    s("rect", { x: -LIM, y: -LIM, width: 2 * LIM, height: 2 * LIM, fill: "url(#cv-grid-" + id + ")" }, svg);
    s("rect", { x: -LIM, y: -LIM, width: 2 * LIM, height: 2 * LIM, fill: "url(#cv-major-" + id + ")" }, svg);
  }

  const BOX_SIZES = { chip: [60, 40], op: [40, 40], dot: [20, 20], ones: [CELL, CELL], tens: [10 * CELL, CELL], hund: [10 * CELL, 10 * CELL], nl: [440, 80] };

  // A slash through a typed character, as when you cross out a digit while borrowing in uppställning.
  // slashColumn: the column of the character to cross out: the one in the cursor's square, or the one before it when that square is
  // empty (the cursor stands after what was just typed). -1 when there is none.
  function slashColumn(items, col, row) {
    const y = row * ROWH;
    const has = function (c) {
      return items.some(function (it) {
        const i = (c * CELL - it.x) / CELL;
        return it.t === "r" && it.y === y && i >= 0 && i < String(it.s).length && String(it.s).charAt(i) !== " ";
      });
    };
    if (has(col)) return col;
    if (has(col - 1)) return col - 1;
    return -1;
  }

  // the slash itself: a line from the lower left to the upper right of the square
  function slashItem(col, row, color) {
    return { t: "line", c: color, x: col * CELL + 1, y: row * ROWH + ROWH - 8, dx: CELL - 2, dy: -(ROWH - 14), h: 0 };
  }

  function sizeOf(it) {
    if (it.t === "chip") return [chipWidth(it), 40];
    if (it.t === "shape") return shapeSize(it);
    if (it.t === "r") return [Math.max(1, String(it.s || "").length) * CELL, ROWH];
    return BOX_SIZES[it.t] || [40, 40];
  }

  // [x0, y0, x1, y1] of one item
  function bbox(it) {
    const x = it.x || 0, y = it.y || 0;
    if (it.t === "s") {
      const p = it.p || [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i + 1 < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
      return x0 === Infinity ? [x, y, x, y] : [x + x0, y + y0, x + x1, y + y1];
    }
    if (it.t === "line") return [Math.min(x, x + (it.dx || 0)), Math.min(y, y + (it.dy || 0)), Math.max(x, x + (it.dx || 0)), Math.max(y, y + (it.dy || 0))];
    if (it.t === "t") {
      const size = it.z || 24, lines = String(it.s || "").split("\n");
      const widest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 1);
      return [x, y - size, x + widest * size * 0.58, y + (lines.length - 1) * (it.lh || size * 1.25) + size * 0.3];
    }
    const sz = sizeOf(it);
    return [x, y, x + sz[0], y + sz[1]];
  }

  function itemsBox(list) {
    let box = null;
    (list || []).forEach(function (it) {
      const b = bbox(it);
      box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
    });
    return box;
  }

  // ----- read-only view -----
  function view(value) {
    const data = parse(value);
    if (!data.items.length) return null;
    const wrap = el("div", "cv-view");
    // normally the first screen of paper; when the work reaches further, show all of it
    let vb = [0, 0, W, H];
    const b = itemsBox(data.items);
    if (b && (b[0] < 0 || b[1] < 0 || b[2] > W || b[3] > H)) {
      const pad = 30, bw = b[2] - b[0] + 2 * pad, bh = b[3] - b[1] + 2 * pad;
      const w = Math.max(W, bw, bh * W / H), h = w * H / W;
      vb = [(b[0] + b[2]) / 2 - w / 2, (b[1] + b[3]) / 2 - h / 2, w, h];
    }
    const svg = s("svg", { viewBox: vb.join(" "), "class": "cv-svg", role: "img", "aria-label": "Elevens rityta" });
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
    { id: "times", label: "·", make: function () { return { t: "op", s: "·" }; } },
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
    { id: "select", label: "Flytta", hint: "Dra på tomt papper för att flytta pappret, så får du plats hur långt du vill. Klicka på något för att markera och flytta det. Figurer och linjer får runda punkter som du drar i för att ändra storleken." },
    { id: "pen", label: "Rita", hint: "Rita fritt med pekaren eller fingret. Dra med två fingrar för att flytta pappret." },
    { id: "write", label: "Skriv", hint: "Klicka på en ruta och skriv. En siffra eller bokstav per ruta. Enter går till nästa rad och piltangenterna flyttar markören. Tryck på Sträck för att dra ett streck under talen. Dra på tomt papper för att flytta pappret." },
    { id: "text", label: "Textruta", hint: "Klicka där du vill ha en textruta och skriv. Tryck Enter när du är klar. Dra i en ruta som redan finns för att flytta den, klicka på den för att ändra." },
    { id: "erase", label: "Sudd", hint: "Dra över det du vill ta bort." },
    { id: "line", label: "Linje", hint: "Dra för att rita en rak linje. Den fastnar på rutnätets hörn." },
    { id: "arrow", label: "Pil", hint: "Dra för att rita en pil. Den fastnar på rutnätets hörn." }
  ];

  function cells(n) {
    const v = Math.round(n / CELL * 10) / 10;
    return String(v).replace(".", ",");
  }

  function coarsePointer() {
    return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  }

  // On a narrow screen the whole 800-unit-wide paper is squeezed into a few hundred pixels, and the squares become
  // too small to tap where you want. A new drawing therefore starts zoomed in, so that a square is about 20 pixels.
  function homeZoom() {
    const width = Math.min(window.innerWidth - 56, 700);   // roughly the width of the drawing area
    if (!(width > 0) || width >= 560) return 1;
    return Math.round(Math.max(1, Math.min(2.5, 20 / (CELL * width / W))) * 100) / 100;
  }

  function create(options) {
    // on a phone the paper is taller (4:3 instead of the wide 800 x 440), so that there is room for the rows of an uppställning
    const H = window.matchMedia && window.matchMedia("(max-width: 560px)").matches ? 640 : 440;
    options = options || {};
    const initial = parse(options.value);
    const home = homeZoom();
    let items = initial.items;
    let snapOn = Boolean(initial.sn);
    let vx = initial.view.x, vy = initial.view.y, zoom = initial.hasView ? initial.view.z : home;   // which part of the endless paper is shown
    let tool = "select";
    let color = 0;
    let width = 3;
    let selected = -1;
    let editing = null;
    let cur = null;               // the writing cursor of the "Skriv" tool: { col, row }
    let lineStart = 0;            // Enter goes back to this column
    let keypadOn = coarsePointer();
    let lastTypeAt = 0;
    let spaceDown = false;
    let viewTimer = null;
    const history = [];
    let hIdx = -1;

    const root = el("div", "cv");
    // A slim rail with the everyday tools; everything else lives in the "Mer" panel.
    const toolbar = el("div", "cv-rail");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Verktyg för ritytan");
    const panel = el("div", "cv-more");
    panel.hidden = true;
    const colorPanel = el("div", "cv-more cv-colors");
    colorPanel.hidden = true;
    const bits = el("div", "cv-bits");
    bits.setAttribute("role", "toolbar");
    bits.setAttribute("aria-label", "Saker att lägga på ritytan");
    const main = el("div", "cv-main");
    const stage = el("div", "cv-stage");
    stage.tabIndex = 0;
    const svg = s("svg", { viewBox: vx + " " + vy + " " + W / zoom + " " + H / zoom, "class": "cv-svg", role: "img", "aria-label": "Rityta för din lösning" });
    svg.style.aspectRatio = W + " / " + H;
    const bgHolder = s("g", {}, svg);
    const layer = s("g", {}, svg);
    const overlay = s("g", { "pointer-events": "none" }, svg);
    stage.appendChild(svg);
    background(bgHolder);

    // typing happens in a hidden field, so phones and tablets can bring up their own keyboard when asked
    const typer = el("input", "cv-typer");
    typer.type = "text";
    typer.setAttribute("autocomplete", "off");
    typer.setAttribute("autocapitalize", "off");
    typer.setAttribute("autocorrect", "off");
    typer.setAttribute("spellcheck", "false");
    typer.setAttribute("aria-label", "Skriv på rutorna");
    stage.appendChild(typer);

    const zoomBar = el("div", "cv-zoom");
    const awayChip = el("button", "cv-away", "↩ Visa mitt arbete");
    awayChip.type = "button";
    awayChip.hidden = true;
    stage.append(zoomBar, awayChip);

    const keypad = el("div", "cv-keypad");
    keypad.hidden = true;
    const foot = el("div", "cv-foot");
    const hint = el("p", "cv-hint");
    hint.setAttribute("aria-live", "polite");
    const selbar = el("div", "cv-selbar");
    selbar.hidden = true;
    const writebar = el("div", "cv-selbar cv-writebar");   // buttons that belong to the "Skriv" tool
    writebar.hidden = true;
    foot.append(hint, selbar);
    main.append(stage, writebar, keypad, foot);   // the buttons of the Skriv tool (Sträck, Stryk) right under the paper, above the number pad
    root.append(toolbar, main, panel, colorPanel);

    function button(label, className, onClick) {
      const b = el("button", "cv-btn" + (className ? " " + className : ""), label);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    // --- model ---
    function serialize() {
      return JSON.stringify({ v: 1, g: 1, sn: snapOn ? 1 : 0, vw: { x: Math.round(vx), y: Math.round(vy), z: Math.round(zoom * 100) / 100 }, items: items });
    }

    function emit(json) {
      if (options.onChange) options.onChange(items.length ? json : "");
    }

    // The view is saved too, but panning does not count as a step to undo.
    function emitSoon() {
      clearTimeout(viewTimer);
      viewTimer = setTimeout(function () { if (items.length) emit(serialize()); }, 500);
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

    // opts.merge: keystrokes in a row count as one step to undo
    function commit(opts) {
      const json = serialize();
      if (json.length > MAX_JSON) {
        restore(history[hIdx]);
        say("Ritytan är full. Ta bort något innan du lägger till mer.");
        return false;
      }
      const now = Date.now();
      if (opts && opts.merge && hIdx > 0 && hIdx === history.length - 1 && now - lastTypeAt < 1500) {
        history[hIdx] = json;
      } else {
        history.splice(hIdx + 1);
        history.push(json);
        if (history.length > 60) history.shift();
        hIdx = history.length - 1;
      }
      lastTypeAt = opts && opts.merge ? now : 0;
      emit(json);
      syncUi();
      return true;
    }

    // --- the view: pan and zoom over an endless paper ---
    function applyView(rescale) {
      svg.setAttribute("viewBox", vx + " " + vy + " " + W / zoom + " " + H / zoom);
      zoomLabel.textContent = Math.round(zoom * 100) + " %";
      updateCursor();
      updateAway();
      if (rescale) render();
    }

    function updateAway() {
      const x0 = vx, y0 = vy, x1 = vx + W / zoom, y1 = vy + H / zoom;
      const seen = items.some(function (it) {
        const b = bbox(it);
        return b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1;
      });
      awayChip.hidden = !items.length || seen;
    }

    function zoomBy(factor, cx, cy) {
      const r = svg.getBoundingClientRect();
      const px = cx === undefined ? r.left + r.width / 2 : cx, py = cy === undefined ? r.top + r.height / 2 : cy;
      const wx = vx + (px - r.left) * (W / zoom) / r.width, wy = vy + (py - r.top) * (H / zoom) / r.height;
      zoom = Math.max(ZMIN, Math.min(ZMAX, zoom * factor));
      vx = wx - (px - r.left) * (W / zoom) / r.width;
      vy = wy - (py - r.top) * (H / zoom) / r.height;
      applyView(true);
      emitSoon();
    }

    function goHome() {
      vx = 0; vy = 0; zoom = home;
      applyView(true);
      emitSoon();
    }

    function fitAll() {
      const b = itemsBox(items);
      if (!b) { goHome(); return; }
      const pad = 40;
      const bw = b[2] - b[0] + 2 * pad, bh = b[3] - b[1] + 2 * pad;
      zoom = Math.max(ZMIN, Math.min(1.5, Math.min(W / bw, H / bh)));
      vx = (b[0] + b[2]) / 2 - W / zoom / 2;
      vy = (b[1] + b[3]) / 2 - H / zoom / 2;
      applyView(true);
      emitSoon();
    }

    // --- rendering ---
    function itemSize(it) { return sizeOf(it); }

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
      const k = 1 / zoom;   // handles keep the same size on screen
      handleSpecs(items[i]).forEach(function (h) {
        const hg = s("g", { "class": "cv-handle", "data-mode": h.mode, transform: "translate(" + h.x + " " + h.y + ")" }, g);
        s("circle", { r: 20 * k, fill: "transparent" }, hg);
        s("circle", { r: 8 * k, "class": "cv-handle-dot" }, hg);
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
      layer.replaceChildren();
      items.forEach(function (it, i) {
        const g = buildNode(i);
        if (!g) return;
        layer.appendChild(g);
        decorate(g, i);
      });
      syncSelection();
      updateAway();
    }

    function syncSelection() {
      const it = selected >= 0 ? items[selected] : null;
      selbar.hidden = !it || tool !== "select";
      if (!it) return;
      const isText = it.t === "t";
      Array.prototype.forEach.call(selbar.querySelectorAll("[data-text]"), function (b) { b.hidden = !isText; });
    }

    function syncUi() {
      Array.prototype.forEach.call(root.querySelectorAll("[data-tool]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tool === tool)); });
      const dot = root.querySelector(".cv-dot");
      if (dot) dot.style.background = COLORS[color].v;
      // the "Mer" button names the extra tool in use (a text box, a line, an arrow or something to place)
      const extra = tool === "text" || tool === "line" || tool === "arrow" || tool.indexOf("place:") === 0;
      const moreBtn = root.querySelector("[data-act=more]");
      if (moreBtn) {
        const spec = tool.indexOf("place:") === 0 ? PLACE.find(function (x) { return "place:" + x.id === tool; }) : null;
        const name = tool === "text" ? "Textruta" : tool === "line" ? "Linje" : tool === "arrow" ? "Pil" : spec ? spec.label : "Mer";
        moreBtn.setAttribute("aria-pressed", String(extra || !panel.hidden));
        moreBtn.querySelector(".cv-tool-label").textContent = name;
      }
      Array.prototype.forEach.call(bits.querySelectorAll("[data-place]"), function (b) { b.setAttribute("aria-pressed", String(tool === "place:" + b.dataset.place)); });
      Array.prototype.forEach.call(root.querySelectorAll("[data-color]"), function (b) { b.setAttribute("aria-pressed", String(Number(b.dataset.color) === color)); });
      const thick = root.querySelector("[data-act=width]");
      if (thick) { thick.textContent = width > 3 ? "Tjock penna" : "Tunn penna"; }
      const snapBtn = root.querySelector("[data-act=snap]");
      if (snapBtn) snapBtn.setAttribute("aria-pressed", String(snapOn));
      const keysBtn = root.querySelector("[data-act=keys]");
      if (keysBtn) keysBtn.setAttribute("aria-pressed", String(keypadOn));
      root.querySelector("[data-act=undo]").disabled = hIdx <= 0;
      root.querySelector("[data-act=redo]").disabled = hIdx >= history.length - 1;
      root.querySelector("[data-act=clear]").disabled = !items.length;
      stage.dataset.tool = tool.indexOf("place:") === 0 ? "place" : tool;
      keypad.hidden = !(tool === "write" && keypadOn);
      writebar.hidden = tool !== "write";
      syncSelection();
    }

    function setTool(id) {
      finishEdit(true);
      tool = id;
      if (id !== "write") { cur = null; typer.blur(); updateCursor(); }
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
    function clampW(v) { return Math.max(-LIM, Math.min(LIM, v)); }

    function point(e) {
      const r = svg.getBoundingClientRect();
      return { x: clampW(vx + (e.clientX - r.left) * (W / zoom) / r.width), y: clampW(vy + (e.clientY - r.top) * (H / zoom) / r.height) };
    }

    function itemAt(e) {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const g = hit && hit.closest ? hit.closest("[data-i]") : null;
      return g && layer.contains(g) ? Number(g.getAttribute("data-i")) : -1;
    }

    function clampPos(it, x, y) { return [clampW(x), clampW(y)]; }

    // --- writing on the squares: one character per square, like squared paper ---
    function updateCursor() {
      overlay.replaceChildren();
      if (!cur || tool !== "write") return;
      s("rect", { x: cur.col * CELL, y: cur.row * ROWH, width: CELL, height: ROWH, rx: 3, "class": "cv-cursor" }, overlay);
      s("line", { x1: cur.col * CELL + 2, y1: cur.row * ROWH + ROWH - 4, x2: cur.col * CELL + CELL - 2, y2: cur.row * ROWH + ROWH - 4, "class": "cv-cursor-line" }, overlay);
    }

    // keep the cursor on screen: the paper follows when you write past the edge
    function revealCursor() {
      if (!cur) return;
      const x0 = cur.col * CELL, y0 = cur.row * ROWH;
      const w = W / zoom, h = H / zoom, m = CELL * 2;
      let moved = false;
      if (x0 < vx + m) { vx = x0 - m; moved = true; } else if (x0 + CELL > vx + w - m) { vx = x0 + CELL - w + m; moved = true; }
      if (y0 < vy + m) { vy = y0 - m; moved = true; } else if (y0 + ROWH > vy + h - m) { vy = y0 + ROWH - h + m; moved = true; }
      if (moved) { applyView(false); emitSoon(); }
    }

    function setCursor(col, row, keepStart) {
      cur = { col: col, row: row };
      if (!keepStart) lineStart = col;
      updateCursor();
      revealCursor();
      if (!keypadOn || !coarsePointer()) typer.focus({ preventScroll: true });
    }

    function ensureCursor() {
      if (cur) return;
      const col = Math.ceil((vx + CELL * 3) / CELL), row = Math.ceil((vy + ROWH) / ROWH);
      setCursor(col, row);
    }

    function rowItemIndex(x, y) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.t === "r" && it.y === y && x >= it.x - CELL && x <= it.x + String(it.s).length * CELL) return i;
      }
      return -1;
    }

    // remove spaces at the ends of a row and drop it when nothing is left
    function tidyRow(it) {
      while (it.s.length && it.s.charAt(0) === " ") { it.s = it.s.slice(1); it.x += CELL; }
      it.s = it.s.replace(/\s+$/, "");
      if (!it.s.length) { items.splice(items.indexOf(it), 1); selected = -1; }
    }

    function placeChar(ch) {
      if (!cur || !ch || ch === "\n") return;
      const x = cur.col * CELL, y = cur.row * ROWH;
      const idx = rowItemIndex(x, y);
      if (idx >= 0) {
        const it = items[idx];
        if (x < it.x) { it.s = ch + it.s; it.x = x; }
        else if (x >= it.x + it.s.length * CELL) it.s += ch;
        else { const pos = (x - it.x) / CELL; it.s = it.s.slice(0, pos) + ch + it.s.slice(pos + 1); }
        tidyRow(it);
      } else if (ch !== " ") {
        items.push({ t: "r", s: ch, x: x, y: y, c: color });
      }
      cur.col += 1;
      selected = -1;
      render();
      commit({ merge: true });
      updateCursor();
      revealCursor();
    }

    function deleteAt(col, row) {
      const x = col * CELL, y = row * ROWH;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.t === "r" && it.y === y && x >= it.x && x < it.x + it.s.length * CELL) {
          const pos = (x - it.x) / CELL;
          it.s = it.s.slice(0, pos) + " " + it.s.slice(pos + 1);
          tidyRow(it);
          render();
          commit({ merge: true });
          return;
        }
      }
    }

    function backspace() {
      if (!cur) return;
      cur.col -= 1;
      deleteAt(cur.col, cur.row);
      updateCursor();
      revealCursor();
    }

    function rowHasContent(row) {
      return items.some(function (it) { return it.t === "r" && it.y === row * ROWH; });
    }

    // The line under the numbers (like in uppställning): as wide as the rows above it, then the cursor
    // moves to the row below the line, ready for the result.
    function drawUnderline() {
      if (!cur) {   // no cursor yet: work from the row that was written last
        let last = null;
        items.forEach(function (it) { if (it.t === "r") last = it; });
        if (last) setCursor(Math.round(last.x / CELL), Math.round(last.y / ROWH)); else ensureCursor();
      }
      let row = cur.row;
      if (!rowHasContent(row)) row -= 1;   // the cursor is on the empty row under the numbers
      let x0 = Infinity, x1 = -Infinity;
      for (let r = row; rowHasContent(r); r--) {
        items.forEach(function (it) {
          if (it.t === "r" && it.y === r * ROWH) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x + String(it.s).length * CELL); }
        });
      }
      if (x0 === Infinity) { say("Skriv talen först, tryck sedan på Sträck."); return; }
      const y = (row + 1) * ROWH;
      const exists = items.some(function (it) { return it.t === "line" && it.y === y && it.x === x0 && it.dx === x1 - x0 && it.dy === 0; });
      if (!exists) {
        items.push({ t: "line", c: color, x: x0, y: y, dx: x1 - x0, dy: 0, h: 0 });
        selected = -1;
        render();
        commit();
      }
      setCursor(Math.round(x0 / CELL), row + 1);
      say("Strecket är draget. Skriv svaret på raden under.");
    }

    // Cross out the character at the cursor, or the one before it. Pressing again takes the slash away.
    function slash() {
      if (!cur) {   // no cursor yet: stand after what was written last
        let last = null;
        items.forEach(function (it) { if (it.t === "r") last = it; });
        if (!last) { say("Skriv ett tal först, tryck sedan på Stryk."); return; }
        setCursor(Math.round(last.x / CELL) + String(last.s).length, Math.round(last.y / ROWH));
      }
      const col = slashColumn(items, cur.col, cur.row);
      if (col < 0) { say("Det finns inget tecken att stryka här. Ställ markören på en siffra, eller direkt efter den."); return; }
      const mark = slashItem(col, cur.row, color);
      const at = items.findIndex(function (it) { return it.t === "line" && it.x === mark.x && it.y === mark.y && it.dx === mark.dx && it.dy === mark.dy; });
      if (at >= 0) { items.splice(at, 1); say("Strecket är borta."); } else { items.push(mark); say("Tecknet är överstruket."); }
      selected = -1;
      render();
      commit();
    }

    function newLine() {
      if (!cur) return;
      cur.row += 1;
      cur.col = lineStart;
      updateCursor();
      revealCursor();
    }

    function moveCursor(dc, dr) {
      if (!cur) return;
      cur.col += dc;
      cur.row += dr;
      if (dc) lineStart = cur.col;
      updateCursor();
      revealCursor();
    }

    typer.addEventListener("input", function () {
      const text = typer.value;
      typer.value = "";
      Array.from(text).forEach(placeChar);
    });
    typer.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case "Enter": e.preventDefault(); newLine(); break;
        case "Backspace": e.preventDefault(); backspace(); break;
        case "Delete": e.preventDefault(); if (cur) { deleteAt(cur.col, cur.row); } break;
        case "ArrowLeft": e.preventDefault(); moveCursor(-1, 0); break;
        case "ArrowRight": e.preventDefault(); moveCursor(1, 0); break;
        case "ArrowUp": e.preventDefault(); moveCursor(0, -1); break;
        case "ArrowDown": e.preventDefault(); moveCursor(0, 1); break;
        case "Home": e.preventDefault(); if (cur) { cur.col = lineStart; updateCursor(); revealCursor(); } break;
        case "Escape": e.preventDefault(); cur = null; updateCursor(); typer.blur(); stage.focus({ preventScroll: true }); break;
        default: break;
      }
    });

    // --- on-screen number pad (always shown on touch screens while writing) ---
    ["7", "8", "9", "+", "−", "·", "⌫", "4", "5", "6", "/", "=", "(", ")", "1", "2", "3", "0", ",", "Abc", "↵"].forEach(function (k) {
      const b = el("button", "cv-key" + (/^(⌫|↵|Abc)$/.test(k) ? " is-special" : ""), k);
      b.type = "button";
      if (k === "⌫") b.setAttribute("aria-label", "Sudda tecknet");
      if (k === "↵") b.setAttribute("aria-label", "Ny rad");
      if (k === "Abc") b.title = "Visa tangentbordet för bokstäver";
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // keep focus and the cursor where they are
      b.addEventListener("click", function () {
        ensureCursor();
        if (k === "⌫") backspace();
        else if (k === "↵") newLine();
        else if (k === "Abc") typer.focus({ preventScroll: true });
        else placeChar(k);
      });
      keypad.appendChild(b);
    });

    // --- inline editing (text boxes, number tiles, number-line range) ---
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
      const k = r.width / (W / zoom);
      const input = el("input", "cv-edit");
      input.type = "text";
      input.maxLength = it.t === "chip" ? 12 : 300;
      input.setAttribute("autocapitalize", "none");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocomplete", "off");
      input.spellcheck = false;
      input.setAttribute("aria-label", it.t === "nl" ? "Tallinjens start och slut" : "Text");
      let left = (it.x || 0), top = (it.y || 0), w = 220, size = 22;
      if (it.t === "t") { size = it.z || 24; top = (it.y || 0) - size; input.value = it.s || ""; w = Math.max(180, (String(it.s || "").length + 4) * size * 0.58); }
      else if (it.t === "chip") { input.value = it.s || ""; w = Math.max(chipWidth(it), 70); size = 22; input.className += " is-center"; }
      else if (it.t === "nl") { input.value = it.min + "–" + it.max; w = 150; top = (it.y || 0) + 10; left = (it.x || 0) + 140; }
      const sx = (left - vx) * k, sy = (top - vy) * k;
      input.style.left = sx + "px";
      input.style.top = sy + "px";
      input.style.width = Math.max(60, Math.min(w * k, r.width - sx - 4)) + "px";
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
    const pointers = new Map();
    let gesture = null;

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
      it.x = bx < ax ? ax - w : ax;
      it.y = by < ay ? ay - h : ay;
      it.w = w; it.h = h;
    }

    // the whole drag was interrupted (a second finger came down): put things back
    function cancelDrag() {
      if (!drag) return;
      const d = drag;
      drag = null;
      if ((d.kind === "pen" || d.kind === "line") && items.indexOf(d.item) >= 0) items.splice(items.indexOf(d.item), 1);
      else if (d.kind === "shape" && d.added && items.indexOf(d.item) >= 0) items.splice(items.indexOf(d.item), 1);
      else if (d.kind === "move") { d.item.x = d.ox; d.item.y = d.oy; }
      render();
    }

    function startGesture() {
      cancelDrag();
      const pts = Array.from(pointers.values());
      const r = svg.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      gesture = {
        d0: Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)), z0: zoom,
        wx: vx + (cx - r.left) * (W / zoom) / r.width, wy: vy + (cy - r.top) * (H / zoom) / r.height
      };
    }

    function moveGesture() {
      const pts = Array.from(pointers.values());
      const r = svg.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const before = zoom;
      zoom = Math.max(ZMIN, Math.min(ZMAX, gesture.z0 * dist / gesture.d0));
      vx = gesture.wx - (cx - r.left) * (W / zoom) / r.width;
      vy = gesture.wy - (cy - r.top) * (H / zoom) / r.height;
      applyView(Math.abs(zoom - before) > 0.04);
      emitSoon();
    }

    function startPan(e, click) {
      drag = { kind: "pan", sx: e.clientX, sy: e.clientY, ovx: vx, ovy: vy, moved: !click, click: click || null };
      if (!click) stage.dataset.panning = "1";
      svg.setPointerCapture(e.pointerId);
    }

    svg.addEventListener("pointerdown", function (e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { startGesture(); return; }
      if (pointers.size > 2) return;
      if (e.button === 1 || (spaceDown && e.button === 0)) { e.preventDefault(); startPan(e); return; }
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
      } else if (tool === "text" || tool === "write") {
        const hit = itemAt(e);
        const cell = { col: Math.floor(p.x / CELL), row: Math.floor(p.y / ROWH) };
        if (hit >= 0) {
          // pressing on something that is already there moves it (and a plain click edits it), so no switching of tools is needed
          selected = hit;
          render();
          const it = items[hit];
          drag = { kind: "move", item: it, g: layer.querySelector('[data-i="' + hit + '"]'), sx: p.x, sy: p.y, ox: it.x || 0, oy: it.y || 0, moved: false,
            editOnClick: tool === "text" && it.t === "t", cursorOnClick: tool === "write" ? cell : null };
          svg.setPointerCapture(e.pointerId);
        } else if (tool === "write") {
          startPan(e, cell);   // a plain click puts the cursor here, dragging moves the paper
        } else {
          // a new text box sits on the grid line below the click, like writing on squared paper
          const y = snapOn ? Math.ceil((p.y - 2) / CELL) * CELL : Math.round(p.y + 6);
          startEdit({ t: "t", c: color, z: 28, lh: 40, x: snapV(p.x), y: y, s: "" }, true);
        }
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
        it.x = pos[0];
        it.y = pos[1];
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
        } else {
          startPan(e);   // empty paper: dragging moves the paper
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
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gesture && pointers.size >= 2) { moveGesture(); return; }
      if (!drag) return;
      if (drag.kind === "pan") {
        if (!drag.moved) {
          if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 7) return;
          drag.moved = true;
          stage.dataset.panning = "1";
        }
        const r = svg.getBoundingClientRect();
        vx = drag.ovx - (e.clientX - drag.sx) * (W / zoom) / r.width;
        vy = drag.ovy - (e.clientY - drag.sy) * (H / zoom) / r.height;
        applyView(false);
        return;
      }
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
          it.w = Math.max(CELL, w); it.h = Math.max(CELL, square ? w : h);
          if (square) it.h = it.w;
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

    function endDrag(e) {
      if (e && pointers.has(e.pointerId)) pointers.delete(e.pointerId);
      if (pointers.size < 2) gesture = null;
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.kind === "pan") {
        delete stage.dataset.panning;
        if (d.moved) { emitSoon(); updateAway(); }
        else if (d.click) setCursor(d.click.col, d.click.row);
      } else if (d.kind === "pen") {
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
          d.item.x = snapV(d.cx - size[0] / 2);
          d.item.y = snapV(d.cy - size[1] / 2);
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
        else if (d.editOnClick) startEdit(d.item, false);
        else if (d.cursorOnClick) { selected = -1; render(); setCursor(d.cursorOnClick.col, d.cursorOnClick.row); }
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

    // the wheel moves the paper once you have clicked on it; Ctrl + wheel zooms
    stage.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); return; }
      const active = document.activeElement;
      if (active !== stage && active !== typer) return;   // let the page scroll when the paper is not in use
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const k = (W / zoom) / r.width;
      vx += e.deltaX * k; vy += e.deltaY * k;
      applyView(false);
      emitSoon();
    }, { passive: false });

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
      const pos = clampPos(copy, (copy.x || 0) + CELL * 2, (copy.y || 0) + (it.t === "r" ? ROWH : CELL * 2));
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
      if (e.key === " " && tool !== "write" && document.activeElement === stage) {   // hold Space and drag to move the paper
        e.preventDefault();
        spaceDown = true;
        stage.dataset.pan = "1";
        return;
      }
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
    stage.addEventListener("keyup", function (e) {
      if (e.key === " ") { spaceDown = false; delete stage.dataset.pan; }
    });

    function undo() {
      finishEdit(true);
      if (hIdx <= 0) return;
      hIdx--;
      lastTypeAt = 0;
      restore(history[hIdx]);
      emit(history[hIdx]);
    }

    function redo() {
      finishEdit(true);
      if (hIdx >= history.length - 1) return;
      hIdx++;
      lastTypeAt = 0;
      restore(history[hIdx]);
      emit(history[hIdx]);
    }

    // --- zoom controls on the paper ---
    const zoomOut = button("−", "cv-zoom-btn", function () { zoomBy(1 / 1.25); });
    zoomOut.title = "Zooma ut";
    zoomOut.setAttribute("aria-label", "Zooma ut");
    const zoomLabel = el("button", "cv-zoom-label", "100 %");
    zoomLabel.type = "button";
    zoomLabel.title = "Tillbaka till vanlig storlek";
    zoomLabel.addEventListener("click", goHome);
    const zoomIn = button("+", "cv-zoom-btn", function () { zoomBy(1.25); });
    zoomIn.title = "Zooma in";
    zoomIn.setAttribute("aria-label", "Zooma in");
    const zoomAll = button("⤢", "cv-zoom-btn", fitAll);
    zoomAll.title = "Visa allt jag har ritat";
    zoomAll.setAttribute("aria-label", "Visa allt");
    zoomBar.append(zoomOut, zoomLabel, zoomIn, zoomAll);
    awayChip.addEventListener("click", fitAll);

    // --- tool rail ---
    const TOOL_ICONS = { select: "✋", pen: "✏️", write: "Aa", erase: "🧽" };
    ["select", "pen", "write", "erase"].forEach(function (id) {
      const t = TOOLS.find(function (x) { return x.id === id; });
      const b = el("button", "cv-tool");
      b.type = "button";
      b.dataset.tool = id;
      b.title = t.hint;
      b.append(el("span", "cv-tool-icon", TOOL_ICONS[id]), el("span", "cv-tool-label", t.label));
      b.addEventListener("click", function () { panel.hidden = true; setTool(id); });
      toolbar.appendChild(b);
    });
    const colorBtn = el("button", "cv-tool");
    colorBtn.type = "button";
    colorBtn.dataset.act = "color";
    colorBtn.title = "Välj färg";
    colorBtn.append(el("span", "cv-dot"), el("span", "cv-tool-label", "Färg"));
    colorBtn.addEventListener("click", function () {
      panel.hidden = true;
      colorPanel.hidden = !colorPanel.hidden;
      colorPanel.style.top = colorBtn.offsetTop + "px";
      syncUi();
    });
    toolbar.appendChild(colorBtn);
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
        colorPanel.hidden = true;
        syncUi();
      });
      swatches.appendChild(b);
    });
    colorPanel.appendChild(swatches);
    const undoBtn = button("↶", "cv-hist", undo);
    undoBtn.dataset.act = "undo";
    undoBtn.title = "Ångra";
    undoBtn.setAttribute("aria-label", "Ångra");
    const redoBtn = button("↷", "cv-hist", redo);
    redoBtn.dataset.act = "redo";
    redoBtn.title = "Gör om";
    redoBtn.setAttribute("aria-label", "Gör om");
    const histRow = el("div", "cv-hist-row");
    histRow.append(undoBtn, redoBtn);
    toolbar.appendChild(histRow);
    const moreBtn = el("button", "cv-tool");
    moreBtn.type = "button";
    moreBtn.dataset.act = "more";
    moreBtn.title = "Textruta, linjer, pilar, former, siffror och mer";
    moreBtn.append(el("span", "cv-tool-icon", "⋯"), el("span", "cv-tool-label", "Mer"));
    moreBtn.addEventListener("click", function () { colorPanel.hidden = true; panel.hidden = !panel.hidden; syncUi(); });
    toolbar.appendChild(moreBtn);

    // --- the "Mer" panel: extra tools, things to place and paper settings ---
    const sect = function (title) {
      const sec = el("div", "cv-more-sec");
      sec.appendChild(el("span", "cv-bits-label", title));
      panel.appendChild(sec);
      return sec;
    };
    const closeBtn = button("✕", "cv-more-close", function () { panel.hidden = true; syncUi(); });
    closeBtn.setAttribute("aria-label", "Stäng");
    panel.appendChild(closeBtn);

    const shapesSec = sect("Fler verktyg");
    [["text", "Textruta"], ["line", "Linje"], ["arrow", "Pil"]].forEach(function (x) {
      const t = TOOLS.find(function (y) { return y.id === x[0]; });
      const b = button(x[1], "cv-bit", function () { panel.hidden = true; setTool(x[0]); });
      b.dataset.tool = x[0];
      b.title = t.hint;
      shapesSec.appendChild(b);
    });
    const widthBtn = button("Tunn penna", "cv-bit", function () { width = width > 3 ? 3 : 7; syncUi(); });
    widthBtn.dataset.act = "width";
    shapesSec.appendChild(widthBtn);

    sect("Lägg till");
    panel.appendChild(bits);
    PLACE.forEach(function (p) {
      const b = button(p.label, "cv-bit", function () { panel.hidden = true; setTool(tool === "place:" + p.id ? "select" : "place:" + p.id); });
      b.dataset.place = p.id;
      bits.appendChild(b);
    });

    const paperSec = sect("Papper");
    const snapBtn = button("Fäst i rutor", "cv-bit", function () {
      snapOn = !snapOn;
      say(snapOn ? "Text, tal och figurer fastnar på rutnätet." : "Du kan nu placera saker precis var du vill.");
      commit();
    });
    snapBtn.title = "När det är på fastnar text, tal, figurer och linjer på rutnätet";
    snapBtn.dataset.act = "snap";
    const keysBtn = button("Sifferknappar", "cv-bit", function () { keypadOn = !keypadOn; syncUi(); });
    keysBtn.title = "Visa knappar med siffror och räknetecken när du skriver";
    keysBtn.dataset.act = "keys";
    const homeBtn = button("Till början", "cv-bit", function () { panel.hidden = true; goHome(); syncUi(); });
    const allBtn = button("Visa allt", "cv-bit", function () { panel.hidden = true; fitAll(); syncUi(); });
    const clearBtn = button("Rensa allt", "cv-bit cv-btn-quiet", function () {
      if (!items.length) return;
      if (items.length > 3 && !window.confirm("Ta bort allt på ritytan?")) return;
      items = [];
      selected = -1;
      render();
      commit();
    });
    clearBtn.dataset.act = "clear";
    paperSec.append(snapBtn, keysBtn, homeBtn, allBtn, clearBtn);

    // the panel closes when you click anywhere else (and the listener goes away with the canvas)
    function onDocPointer(e) {
      if (!root.isConnected) { document.removeEventListener("pointerdown", onDocPointer, true); return; }
      if (!panel.hidden && !panel.contains(e.target) && !moreBtn.contains(e.target)) { panel.hidden = true; syncUi(); }
      if (!colorPanel.hidden && !colorPanel.contains(e.target) && !colorBtn.contains(e.target)) { colorPanel.hidden = true; syncUi(); }
    }
    document.addEventListener("pointerdown", onDocPointer, true);
    root.addEventListener("keydown", function (e) { if (e.key === "Escape" && (!panel.hidden || !colorPanel.hidden)) { panel.hidden = true; colorPanel.hidden = true; syncUi(); e.stopPropagation(); } });

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
    const lineBtn = button("▬ Sträck", "cv-btn-small cv-btn-main", function () { drawUnderline(); });
    lineBtn.title = "Dra ett streck under talen du har skrivit";
    lineBtn.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // the cursor stays where it is
    writebar.appendChild(lineBtn);
    const slashBtn = button("╱ Stryk", "cv-btn-small cv-btn-main", function () { slash(); });
    slashBtn.title = "Stryk över tecknet vid markören, eller det före, till exempel när du växlar i uppställning. Tryck igen för att ta bort strecket.";
    slashBtn.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // the cursor stays where it is
    writebar.appendChild(slashBtn);

    history.push(serialize());
    hIdx = 0;
    render();
    applyView(false);
    syncUi();
    say(TOOLS[0].hint);

    root.getValue = function () { return items.length ? serialize() : ""; };
    return root;
  }

  return { create: create, view: view, isEmpty: isEmpty, parse: parse, slashColumn: slashColumn, slashItem: slashItem };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaCanvas;
