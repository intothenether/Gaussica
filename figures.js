// Figures for lessons: number lines, shapes with labelled sides, triangles, symmetry,
// growing patterns and number grids. Drawn as inline SVG and styled by the .fig-* rules in
// styles.css. Used as `visual` configs, e.g. { "type": "tallinje", "min": 0, "max": 10 }.
//
//   tallinje    { min, max, step, labelEvery, points:[{value,label,tone}], jumps:[{from,to,label}], range:{from,to} }
//   rektangel   { w, h, unit, grid, outline, sides:"wh"|"all", labels:{w,h} }          (kvadrat = same w and h)
//   triangel    { base, height, apex, unit, showHeight, showRect, labels:{left,right,base,height} }
//   figurer     { items:[{shape,label}] }          shapes: triangel kvadrat rektangel cirkel femhörning sexhörning åttahörning parallellogram romb
//   symmetri    { items:[{shape,label,axes:"auto"|[angles]}] }
//   monster     { steps:[{label, rows, cols | cells:[[x,y]], accent:[[x,y]]}] }
//   talrutnat   { from, to, columns, highlight:[numbers] | "primtal" | {multiplesOf:n} | {divisorsOf:n}, muted:[numbers] }
//   staplar     { data:[{label,value,tone}], max, line:{value,label} }              bar chart with an optional reference line
//   vinkel      { deg, label }                                                       an angle between two rays
//   graf        { xmin,xmax,ymin,ymax, lines:[{k,m,label}], curves:[{fn,label,tone,from,to}], points:[{x,y,label}] }  coordinate system with straight
//               lines and curves; fn is a formula in x, as "x^2 - 4*x + 3", "2^x" or "lg(x)" (see the expressions in pyssel.js)
//   hundrarutor { filled, label }                                                    10 x 10 grid with the first n squares filled
//   klocka      { h, m, digital }                                                    analog clock
//   uppstallning { op:"+"|"-"|"*"|"/", a, b }   column arithmetic, shown step by step (b is a single digit for * and /)
//   pythagoras  { a, b, unit, hideA, hideB, hideC, areas }   right triangle with a square on each side
//   vag         { left:[{n,tone}], right:[{n,tone}], leftLabel, rightLabel }   balance scale with blocks (tone "x" = pink)
//   tradiagram  { levels:[[val, val], [val, val]], root }    tree diagram, one list of choices per step
//   parallellogram { base, height, shift, unit, showHeight, showRect }
//   trapets     { a, b, height, offset, unit, showHeight, showCopy }
//   kroppar     { items:[{shape,label}], columns }   shapes: kub ratblock cylinder klot kon pyramid
//   linjer      { items:[{kind,label}], columns }    kinds: parallella vinkelrata skarande
//   langdivision { a, b }                                      long division written out, with the product and the rest of each step
//   areamodell  { cols, rows, cells, widths, heights }          a rectangle cut in four: (x + 3)(x + 2), (a + b)^2
//   trigonometri { angle, names, labels:{hyp,opp,adj,angle} }   right triangle with the sides named from one angle
//   strecktabell { rows:[{label,n}], counts }        tally chart, groups of five (counts shows the number at the end of each row)
// tallinje also takes sequence:{start,step,count}; monster takes generator:"L"|"kvadrat"|"trappa"|"rad"|"faktorer", n, only.

window.GaussicaFigures = (function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const TYPES = {
    tallinje: "TALLINJE", numberline: "TALLINJE", rektangel: "FIGUR", kvadrat: "FIGUR", triangel: "FIGUR",
    figurer: "FIGURER", symmetri: "SYMMETRI", monster: "MÖNSTER", talrutnat: "TALRUTNÄT",
    staplar: "STAPLAR", vinkel: "VINKEL", graf: "GRAF", hundrarutor: "HUNDRARUTOR", klocka: "KLOCKA", uppstallning: "UPPSTÄLLNING", vag: "BALANSVÅG", pythagoras: "PYTHAGORAS", tradiagram: "TRÄDDIAGRAM", parallellogram: "FIGUR", trapets: "FIGUR", kroppar: "KROPPAR", linjer: "LINJER", strecktabell: "STRECKTABELL", langdivision: "LÅNGDIVISION", areamodell: "AREAMODELL", trigonometri: "TRIGONOMETRI"
  };

  function supports(type) {
    return Object.prototype.hasOwnProperty.call(TYPES, String(type || "").toLowerCase());
  }

  function badge(type) {
    return TYPES[String(type || "").toLowerCase()] || "FIGUR";
  }

  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  function text(parent, x, y, str, cls, anchor) {
    const t = s("text", { x: x, y: y, "class": "fig-text " + (cls || ""), "text-anchor": anchor || "middle" }, parent);
    t.textContent = str;
    return t;
  }

  function fmt(n) {
    return String(Math.round(n * 1e6) / 1e6).replace(".", ",");
  }

  function svgRoot(config, w, h) {
    const svg = s("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "class": "fig-svg" });
    svg.setAttribute("aria-label", config.alt || config.title || "Figur");
    return svg;
  }

  function wrap(children) {
    const div = document.createElement("div");
    div.className = "figure-wrap";
    children.forEach(function (c) { div.appendChild(c); });
    return div;
  }

  // ----- number line -----
  function numberline(c) {
    const min = Number(c.min !== undefined ? c.min : 0);
    const max = Number(c.max !== undefined ? c.max : 10);
    const step = Number(c.step || 1);
    const labelEvery = Number(c.labelEvery || step);
    let jumps = c.jumps || [];
    let points = c.points || [];
    if (c.sequence) {
      const sq = c.sequence, count = Math.max(1, Math.min(30, Math.round(Number(sq.count) || 5)));
      points = points.slice(); jumps = jumps.slice();
      for (let i = 0; i < count; i++) {
        const v = Number(sq.start) + i * Number(sq.step);
        points.push({ value: v });
        if (i > 0) jumps.push({ from: v - Number(sq.step), to: v, label: (Number(sq.step) >= 0 ? "+" : "−") + fmt(Math.abs(Number(sq.step))) });
      }
    }
    const W = 600, L = 34, R = 34;
    const top = jumps.length ? 78 : 44;
    const y0 = top + 12;
    const H = y0 + 52;
    const svg = svgRoot(c, W, H);
    const x = function (v) { return L + ((v - min) / (max - min)) * (W - L - R); };

    if (c.range) {
      s("rect", { x: x(c.range.from), y: y0 - 6, width: x(c.range.to) - x(c.range.from), height: 12, rx: 6, "class": "fig-range" }, svg);
    }
    s("line", { x1: L - 12, y1: y0, x2: W - R + 12, y2: y0, "class": "fig-axis" }, svg);
    const n = Math.round((max - min) / step);
    const everyN = Math.max(1, Math.round(labelEvery / step));
    for (let i = 0; i <= n; i++) {
      const v = min + i * step;
      const major = i % everyN === 0;
      s("line", { x1: x(v), y1: y0 - (major ? 9 : 5), x2: x(v), y2: y0 + (major ? 9 : 5), "class": "fig-tick" }, svg);
      if (major) text(svg, x(v), y0 + 28, fmt(v), "fig-ticklabel");
    }

    jumps.forEach(function (j) {
      const x1 = x(j.from), x2 = x(j.to);
      const span = Math.abs(x2 - x1);
      const h = Math.min(46, 14 + span * 0.25);
      const ya = y0 - 12;
      s("path", { d: "M" + x1 + " " + ya + " C" + x1 + " " + (ya - h) + " " + x2 + " " + (ya - h) + " " + x2 + " " + (ya - 3), "class": "fig-jump" }, svg);
      s("polygon", { points: (x2 - 5) + "," + (ya - 8) + " " + (x2 + 5) + "," + (ya - 8) + " " + x2 + "," + ya, "class": "fig-arrow" }, svg);
      if (j.label) text(svg, (x1 + x2) / 2, ya - h * 0.75 - 6, j.label, "fig-jumplabel");
    });

    points.forEach(function (p) {
      if (p.value < min - 1e-9 || p.value > max + 1e-9) return;
      const q = p.label === "?" || p.tone === "coral";
      s("circle", { cx: x(p.value), cy: y0, r: 8, "class": "fig-point" + (q ? " is-q" : "") }, svg);
      if (p.label && !jumps.length) {
        s("circle", { cx: x(p.value), cy: y0 - 28, r: 13, "class": "fig-pill" + (q ? " is-q" : "") }, svg);
        text(svg, x(p.value), y0 - 23, p.label, "fig-pilltext");
        s("line", { x1: x(p.value), y1: y0 - 15, x2: x(p.value), y2: y0 - 9, "class": "fig-tick" }, svg);
      }
    });
    return wrap([svg]);
  }

  // ----- rectangle / square -----
  function rectangle(c) {
    const w = Number(c.w), h = Number(c.h !== undefined ? c.h : c.w);
    const unit = c.unit || "";
    const sc = Math.min(44, 300 / w, 190 / h);
    const rw = w * sc, rh = h * sc;
    const W = 460, H = rh + 96;
    const x0 = (W - rw) / 2, y0 = 36;
    const svg = svgRoot(c, W, H);
    s("rect", { x: x0, y: y0, width: rw, height: rh, "class": "fig-shape" }, svg);
    if (c.grid && w <= 24 && h <= 24) {
      for (let i = 1; i < w; i++) s("line", { x1: x0 + i * sc, y1: y0, x2: x0 + i * sc, y2: y0 + rh, "class": "fig-grid" }, svg);
      for (let j = 1; j < h; j++) s("line", { x1: x0, y1: y0 + j * sc, x2: x0 + rw, y2: y0 + j * sc, "class": "fig-grid" }, svg);
      s("rect", { x: x0, y: y0, width: rw, height: rh, "class": "fig-shape-line" }, svg);
    }
    if (c.outline) s("rect", { x: x0, y: y0, width: rw, height: rh, "class": "fig-outline" }, svg);
    const q = 11;
    s("path", { d: "M" + (x0 + q) + " " + (y0 + rh) + " v-" + q + " h-" + q, "class": "fig-right" }, svg);
    const lw = (c.labels && c.labels.w) || (fmt(w) + (unit ? " " + unit : ""));
    const lh = (c.labels && c.labels.h) || (fmt(h) + (unit ? " " + unit : ""));
    const all = c.sides === "all";
    text(svg, x0 + rw / 2, y0 + rh + 26, lw, "fig-dim");
    if (all) text(svg, x0 + rw / 2, y0 - 12, lw, "fig-dim");
    text(svg, x0 + rw + 12, y0 + rh / 2 + 5, lh, "fig-dim", "start");
    if (all) text(svg, x0 - 12, y0 + rh / 2 + 5, lh, "fig-dim", "end");
    return wrap([svg]);
  }

  // ----- triangle -----
  function triangle(c) {
    const b = Number(c.base), ht = Number(c.height);
    const apex = c.apex !== undefined ? Number(c.apex) : b / 2;
    const unit = c.unit || "";
    const sc = Math.min(40, 300 / b, 170 / ht);
    const W = 460, H = ht * sc + 96;
    const x0 = (W - b * sc) / 2, yb = 30 + ht * sc;
    const A = [x0, yb], B = [x0 + b * sc, yb], C = [x0 + apex * sc, yb - ht * sc];
    const svg = svgRoot(c, W, H);
    const lab = c.labels || {};
    if (c.showRect) s("rect", { x: x0, y: C[1], width: b * sc, height: ht * sc, "class": "fig-dash" }, svg);
    s("polygon", { points: A.join(",") + " " + B.join(",") + " " + C.join(","), "class": "fig-shape" }, svg);
    if (c.outline) s("polygon", { points: A.join(",") + " " + B.join(",") + " " + C.join(","), "class": "fig-outline" }, svg);
    if (c.showHeight) {
      s("line", { x1: C[0], y1: C[1], x2: C[0], y2: yb, "class": "fig-axisline" }, svg);
      const q = 10;
      s("path", { d: "M" + (C[0] - q) + " " + yb + " v-" + q + " h" + q, "class": "fig-right" }, svg);
      text(svg, C[0] + 8, (C[1] + yb) / 2 + 5, lab.height || ("h = " + fmt(ht) + (unit ? " " + unit : "")), "fig-dim", "start");
    }
    if (lab.base !== false) text(svg, (A[0] + B[0]) / 2, yb + 26, lab.base || (c.base !== undefined && unit ? fmt(b) + " " + unit : fmt(b)), "fig-dim");
    if (lab.left) text(svg, (A[0] + C[0]) / 2 - 12, (A[1] + C[1]) / 2 - 4, lab.left, "fig-dim", "end");
    if (lab.right) text(svg, (B[0] + C[0]) / 2 + 12, (B[1] + C[1]) / 2 - 4, lab.right, "fig-dim", "start");
    return wrap([svg]);
  }

  // ----- shapes -----
  function regular(n, cx, cy, r) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (-90 + (360 / n) * i) * Math.PI / 180;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }

  function shapeEl(svg, shape, cx, cy, r, cls) {
    const name = String(shape).toLowerCase();
    const c = cls || "fig-shape";
    if (name === "cirkel") return s("circle", { cx: cx, cy: cy, r: r, "class": c }, svg);
    if (name === "kvadrat") return s("rect", { x: cx - r * 0.82, y: cy - r * 0.82, width: r * 1.64, height: r * 1.64, "class": c }, svg);
    if (name === "rektangel") return s("rect", { x: cx - r * 1.0, y: cy - r * 0.62, width: r * 2.0, height: r * 1.24, "class": c }, svg);
    if (name === "triangel") return s("polygon", { points: regular(3, cx, cy, r * 1.05), "class": c }, svg);
    if (name === "femhörning") return s("polygon", { points: regular(5, cx, cy, r), "class": c }, svg);
    if (name === "sexhörning") return s("polygon", { points: regular(6, cx, cy, r), "class": c }, svg);
    if (name === "åttahörning") return s("polygon", { points: regular(8, cx, cy, r), "class": c }, svg);
    if (name === "romb") return s("polygon", { points: [cx + "," + (cy - r), (cx + r * 0.7) + "," + cy, cx + "," + (cy + r), (cx - r * 0.7) + "," + cy].join(" "), "class": c }, svg);
    if (name === "parallellogram") {
      return s("polygon", { points: [(cx - r * 0.5) + "," + (cy - r * 0.55), (cx + r * 1.05) + "," + (cy - r * 0.55), (cx + r * 0.5) + "," + (cy + r * 0.55), (cx - r * 1.05) + "," + (cy + r * 0.55)].join(" "), "class": c }, svg);
    }
    return s("rect", { x: cx - r * 0.8, y: cy - r * 0.8, width: r * 1.6, height: r * 1.6, "class": c }, svg);
  }

  function gallery(c, withAxes) {
    const grid = document.createElement("div");
    grid.className = "fig-gallery";
    (c.items || []).forEach(function (item) {
      const figure = document.createElement("figure");
      const svg = svgRoot({ alt: item.label }, 110, 110);
      shapeEl(svg, item.shape, 55, 55, 40);
      if (withAxes) drawAxes(svg, item);
      figure.appendChild(svg);
      const cap = document.createElement("figcaption");
      cap.textContent = item.label || "";
      figure.appendChild(cap);
      grid.appendChild(figure);
    });
    return grid;
  }

  // Axis directions in degrees (0 = horizontal, 90 = vertical) for regular polygons drawn point-up.
  // Odd n: one axis through each vertex. Even n: n axes, alternating vertex and edge-midpoint axes.
  function axisAngles(item) {
    if (Array.isArray(item.axes)) return item.axes;
    const n = { triangel: 3, femhörning: 5, sexhörning: 6, åttahörning: 8 }[String(item.shape).toLowerCase()];
    if (!n) return [];
    const stepDeg = n % 2 ? 360 / n : 180 / n;
    const out = [];
    for (let k = 0; k < n; k++) out.push((((-90 + stepDeg * k) % 180) + 180) % 180);
    return out;
  }

  function drawAxes(svg, item) {
    axisAngles(item).forEach(function (deg) {
      const a = deg * Math.PI / 180;
      const len = 49;
      s("line", { x1: 55 - len * Math.cos(a), y1: 55 - len * Math.sin(a), x2: 55 + len * Math.cos(a), y2: 55 + len * Math.sin(a), "class": "fig-axisline" }, svg);
    });
  }

  // ----- growing patterns / arrays -----
  function Lcells(n) {
    const cells = [[0, 0]];
    for (let i = 1; i <= n; i++) { cells.push([i, 0]); cells.push([0, i]); }
    return cells;
  }

  function generated(c) {
    const g = String(c.generator).toLowerCase();
    const n = Math.max(1, Math.min(g === "faktorer" ? 60 : 10, Math.round(Number(c.n) || 3)));
    if (g === "faktorer") {
      const out = [];
      for (let a = 1; a * a <= n; a++) if (n % a === 0) out.push({ label: a + " · " + (n / a), rows: a, cols: n / a });
      return out;
    }
    const make = function (k) {
      if (g === "l") return { label: "Figur " + k, cells: Lcells(k), accent: k === 1 ? [] : [[k, 0], [0, k]] };
      if (g === "kvadrat") return { label: "Figur " + k, rows: k, cols: k };
      if (g === "rad") return { label: "Figur " + k, rows: 1, cols: k };
      const cells = [];   // "trappa": row j has j squares
      for (let j = 1; j <= k; j++) for (let i = 0; i < j; i++) cells.push([i, j - 1]);
      return { label: "Figur " + k, cells: cells };
    };
    if (c.only) return [make(Math.max(1, Math.min(10, Math.round(Number(c.only)))))];
    const out = [];
    for (let k = 1; k <= n; k++) out.push(make(k));
    return out;
  }

  function pattern(c) {
    const steps = (c.generator ? generated(c) : (c.steps || [])).map(function (st) {
      let cells = st.cells;
      if (!cells && st.rows && st.cols) {
        cells = [];
        for (let y = 0; y < st.rows; y++) for (let x = 0; x < st.cols; x++) cells.push([x, y]);
      }
      cells = cells || [];
      const maxX = cells.reduce(function (m, p) { return Math.max(m, p[0]); }, 0) + 1;
      const maxY = cells.reduce(function (m, p) { return Math.max(m, p[1]); }, 0) + 1;
      return { label: st.label, cells: cells, accent: st.accent || [], cols: maxX, rows: maxY };
    });
    const gap = 26;
    const sumCols = steps.reduce(function (t, st) { return t + st.cols; }, 0) || 1;
    const maxRows = steps.reduce(function (m, st) { return Math.max(m, st.rows); }, 1);
    const u = Math.max(8, Math.min(30, (560 - gap * (steps.length - 1)) / sumCols, 150 / maxRows));
    const W = Math.ceil(sumCols * u + gap * (steps.length - 1)) + 20;
    const H = maxRows * u + 56;
    const svg = svgRoot(c, W, H);
    let ox = 10;
    steps.forEach(function (st) {
      const base = 10 + maxRows * u;
      const accent = {};
      st.accent.forEach(function (p) { accent[p[0] + "," + p[1]] = true; });
      st.cells.forEach(function (p) {
        s("rect", { x: ox + p[0] * u + 1.5, y: base - (p[1] + 1) * u + 1.5, width: u - 3, height: u - 3, rx: Math.min(5, u / 4),
          "class": accent[p[0] + "," + p[1]] ? "fig-cell is-accent" : "fig-cell" }, svg);
      });
      if (st.label) text(svg, ox + (st.cols * u) / 2, base + 26, st.label, "fig-dim");
      ox += st.cols * u + gap;
    });
    return wrap([svg]);
  }

  // ----- number grid (primes etc.) -----
  function numbergrid(c) {
    const from = Number(c.from || 1), to = Number(c.to || 30), cols = Number(c.columns || 10);
    const hi = {}, mu = {};
    const hl = c.highlight;
    if (hl === "primtal") {
      for (let n = from; n <= to; n++) {
        let prime = n > 1;
        for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
        if (prime) hi[n] = true;
      }
    } else if (hl && hl.multiplesOf) {
      for (let n = from; n <= to; n++) if (n % hl.multiplesOf === 0) hi[n] = true;
    } else if (hl && hl.divisorsOf) {
      for (let n = from; n <= to; n++) if (hl.divisorsOf % n === 0) hi[n] = true;
    } else {
      (hl || []).forEach(function (n) { hi[n] = true; });
    }
    (c.muted || []).forEach(function (n) { mu[n] = true; });
    const cw = 52, ch = 38;
    const count = to - from + 1;
    const rows = Math.ceil(count / cols);
    const svg = svgRoot(c, cols * cw + 4, rows * ch + 4);
    for (let i = 0; i < count; i++) {
      const n = from + i;
      const x = (i % cols) * cw + 2, y = Math.floor(i / cols) * ch + 2;
      s("rect", { x: x + 2, y: y + 2, width: cw - 4, height: ch - 4, rx: 8, "class": "fig-numcell" + (hi[n] ? " is-hi" : "") + (mu[n] ? " is-muted" : "") }, svg);
      text(svg, x + cw / 2, y + ch / 2 + 5, String(n), "fig-numtext" + (hi[n] ? " is-hi" : ""));
    }
    return wrap([svg]);
  }

  // ----- bar chart with optional reference line -----
  function niceTicks(max) {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    let tick = steps[steps.length - 1];
    for (let i = 0; i < steps.length; i++) if (max / steps[i] <= 6) { tick = steps[i]; break; }
    return { tick: tick, top: Math.max(tick, Math.ceil(max / tick) * tick) };
  }

  function bars(c) {
    const data = c.data || [];
    const W = 460, H = 240, L = 44, R = 18, T = 30, B = 44;
    const values = data.map(function (d) { return Number(d.value) || 0; });
    const maxV = Number(c.max) || Math.max.apply(null, values.concat([c.line ? Number(c.line.value) : 0, 1]));
    const nt = niceTicks(maxV);
    const svg = svgRoot(c, W, H);
    const plotH = H - T - B, plotW = W - L - R;
    const y = function (v) { return T + plotH - (v / nt.top) * plotH; };
    for (let v = 0; v <= nt.top + 1e-9; v += nt.tick) {
      s("line", { x1: L, y1: y(v), x2: W - R, y2: y(v), "class": v === 0 ? "fig-axis" : "fig-grid" }, svg);
      text(svg, L - 8, y(v) + 4, fmt(v), "fig-ticklabel", "end");
    }
    const slot = plotW / Math.max(1, data.length);
    const bw = Math.min(58, slot * 0.62);
    data.forEach(function (d, i) {
      const v = values[i];
      const x0 = L + slot * i + (slot - bw) / 2;
      s("rect", { x: x0, y: y(v), width: bw, height: Math.max(0, y(0) - y(v)), rx: 5, "class": "fig-bar" + (d.tone ? " is-" + d.tone : "") }, svg);
      text(svg, x0 + bw / 2, y(v) - 7, fmt(v), "fig-barvalue");
      text(svg, x0 + bw / 2, H - B + 22, String(d.label === undefined ? "" : d.label), "fig-dim");
    });
    if (c.line) {
      s("line", { x1: L, y1: y(Number(c.line.value)), x2: W - R, y2: y(Number(c.line.value)), "class": "fig-axisline" }, svg);
      if (c.line.label) text(svg, W - R, y(Number(c.line.value)) - 7, c.line.label, "fig-linelabel", "end");
    }
    return wrap([svg]);
  }

  // ----- angle -----
  function angle(c) {
    const deg = Math.max(0, Math.min(360, Number(c.deg) || 0));
    const W = 340, H = 220, vx = 60, vy = 180, len = 230;
    const svg = svgRoot(c, W, H);
    const rad = deg * Math.PI / 180;
    const ex = vx + 170 * Math.cos(rad), ey = vy - 170 * Math.sin(rad);
    const r = 52;
    const ax = vx + r * Math.cos(rad), ay = vy - r * Math.sin(rad);
    const large = deg > 180 ? 1 : 0;
    s("path", { d: "M" + vx + " " + vy + " L" + (vx + r) + " " + vy + " A" + r + " " + r + " 0 " + large + " 0 " + ax + " " + ay + " Z", "class": "fig-sector" }, svg);
    s("line", { x1: vx, y1: vy, x2: vx + len, y2: vy, "class": "fig-ray" }, svg);
    s("line", { x1: vx, y1: vy, x2: ex, y2: ey, "class": "fig-ray" }, svg);
    if (Math.abs(deg - 90) < 0.01) s("path", { d: "M" + (vx + 22) + " " + vy + " v-22 h-22", "class": "fig-right" }, svg);
    s("circle", { cx: vx, cy: vy, r: 5, "class": "fig-point" }, svg);
    const mid = rad / 2;
    text(svg, vx + (r + 34) * Math.cos(mid), vy - (r + 34) * Math.sin(mid) + 5, (c.label !== undefined ? c.label : fmt(deg) + "°"), "fig-dim");
    return wrap([svg]);
  }

  // A formula in x as a function, or null. Where the formula does not work (lg of a negative number, one divided by zero) it gives NaN.
  function curveFunction(src) {
    if (!window.GaussicaPyssel || !window.GaussicaPyssel.compile) return null;
    let fn;
    try { fn = window.GaussicaPyssel.compile(String(src)); } catch (e) { return null; }
    return function (x) { try { return Number(fn({ x: x })); } catch (e) { return NaN; } };
  }

  // The path of a curve over x from `from` to `to`, as the "d" of an svg path. Points where the formula has no value, or is far outside of
  // the picture, are left out and the line is lifted there, so that 1/x or lg(x) get no line across the gap. Returns { d, last }, where
  // last is the last point inside the picture (for the label).
  function curvePath(f, from, to, ymin, ymax, px, py) {
    const N = 240, far = (ymax - ymin) * 20;
    let d = "", pen = false, last = null;
    for (let i = 0; i <= N; i++) {
      const xv = from + (to - from) * i / N;
      const yv = f(xv);
      if (!isFinite(yv) || yv > ymax + far || yv < ymin - far) { pen = false; continue; }
      d += (pen ? " L" : " M") + px(xv).toFixed(1) + " " + py(yv).toFixed(1);
      pen = true;
      if (yv >= ymin && yv <= ymax) last = [xv, yv];
    }
    return { d: d.trim(), last: last };
  }

  // ----- coordinate system with straight lines and curves -----
  function graph(c) {
    const xmin = c.xmin !== undefined ? Number(c.xmin) : -5, xmax = c.xmax !== undefined ? Number(c.xmax) : 5;
    const ymin = c.ymin !== undefined ? Number(c.ymin) : -5, ymax = c.ymax !== undefined ? Number(c.ymax) : 5;
    const W = 460, H = 340, P = 30;
    const svg = svgRoot(c, W, H);
    const x = function (v) { return P + ((v - xmin) / (xmax - xmin)) * (W - 2 * P); };
    const y = function (v) { return H - P - ((v - ymin) / (ymax - ymin)) * (H - 2 * P); };
    const clipId = "clip-" + Math.random().toString(36).slice(2, 8);
    const defs = s("defs", {}, svg);
    s("rect", { x: P, y: P, width: W - 2 * P, height: H - 2 * P }, s("clipPath", { id: clipId }, defs));
    const tx = Math.max(1, Math.ceil((xmax - xmin) / 10)), ty = Math.max(1, Math.ceil((ymax - ymin) / 10));
    for (let v = Math.ceil(xmin); v <= xmax; v += 1) s("line", { x1: x(v), y1: P, x2: x(v), y2: H - P, "class": "fig-grid" }, svg);
    for (let v = Math.ceil(ymin); v <= ymax; v += 1) s("line", { x1: P, y1: y(v), x2: W - P, y2: y(v), "class": "fig-grid" }, svg);
    const ax = Math.min(Math.max(0, xmin), xmax), ay = Math.min(Math.max(0, ymin), ymax);
    s("line", { x1: P, y1: y(ay), x2: W - P, y2: y(ay), "class": "fig-axis" }, svg);
    s("line", { x1: x(ax), y1: P, x2: x(ax), y2: H - P, "class": "fig-axis" }, svg);
    for (let v = Math.ceil(xmin); v <= xmax; v += tx) if (v !== 0) text(svg, x(v), y(ay) + 18, fmt(v), "fig-ticklabel");
    for (let v = Math.ceil(ymin); v <= ymax; v += ty) if (v !== 0) text(svg, x(ax) - 8, y(v) + 4, fmt(v), "fig-ticklabel", "end");
    const g = s("g", { "clip-path": "url(#" + clipId + ")" }, svg);
    (c.lines || []).forEach(function (ln) {
      const k = Number(ln.k), m = Number(ln.m);
      s("line", { x1: x(xmin - 1), y1: y(k * (xmin - 1) + m), x2: x(xmax + 1), y2: y(k * (xmax + 1) + m), "class": "fig-graphline" + (ln.tone ? " is-" + ln.tone : "") }, g);
    });
    (c.curves || []).forEach(function (cv) {
      const f = curveFunction(cv.fn);
      if (!f) return;
      const from = cv.from !== undefined ? Number(cv.from) : xmin, to = cv.to !== undefined ? Number(cv.to) : xmax;
      const path = curvePath(f, from, to, ymin, ymax, x, y);
      if (!path.d) return;
      s("path", { d: path.d, fill: "none", "class": "fig-graphline fig-curve" + (cv.tone ? " is-" + cv.tone : "") }, g);
      if (cv.label && path.last) text(svg, x(path.last[0]) - 6, y(path.last[1]) - 10, cv.label, "fig-dim", "end");
    });
    (c.points || []).forEach(function (p) {
      s("circle", { cx: x(p.x), cy: y(p.y), r: 6, "class": "fig-point" + (p.tone === "coral" ? " is-q" : "") }, svg);
      if (p.label) text(svg, x(p.x) + 10, y(p.y) - 8, p.label, "fig-dim", "start");
    });
    return wrap([svg]);
  }

  // ----- hundred grid -----
  function hundred(c) {
    const filled = Math.max(0, Math.min(100, Math.round(Number(c.filled) || 0)));
    const cs = 26, gap = 3, size = 10 * cs + 9 * gap;
    const svg = svgRoot(c, size + 4, size + (c.label ? 34 : 4));
    for (let i = 0; i < 100; i++) {
      const cx = (i % 10) * (cs + gap) + 2, cy = Math.floor(i / 10) * (cs + gap) + 2;
      s("rect", { x: cx, y: cy, width: cs, height: cs, rx: 5, "class": "fig-hcell" + (i < filled ? " is-on" : "") }, svg);
    }
    if (c.label) text(svg, (size + 4) / 2, size + 26, c.label, "fig-dim");
    const wrapEl = wrap([svg]);
    svg.style.maxWidth = "300px";
    return wrapEl;
  }

  // ----- analog clock -----
  function clock(c) {
    const h = Number(c.h) || 0, m = Number(c.m) || 0;
    const R = 86, cx = 100, cy = 100;
    const svg = svgRoot(c, 200, c.digital === false ? 200 : 236);
    s("circle", { cx: cx, cy: cy, r: R, "class": "fig-clockface" }, svg);
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, long = i % 5 === 0;
      const r1 = R - (long ? 11 : 6);
      s("line", { x1: cx + r1 * Math.sin(a), y1: cy - r1 * Math.cos(a), x2: cx + (R - 2) * Math.sin(a), y2: cy - (R - 2) * Math.cos(a), "class": long ? "fig-tick" : "fig-grid" }, svg);
    }
    for (let n = 1; n <= 12; n++) {
      const a = n * 30 * Math.PI / 180;
      text(svg, cx + (R - 26) * Math.sin(a), cy - (R - 26) * Math.cos(a) + 5, String(n), "fig-clocknum");
    }
    const hourA = ((h % 12) + m / 60) * 30 * Math.PI / 180, minA = m * 6 * Math.PI / 180;
    s("line", { x1: cx, y1: cy, x2: cx + 46 * Math.sin(hourA), y2: cy - 46 * Math.cos(hourA), "class": "fig-hand-hour" }, svg);
    s("line", { x1: cx, y1: cy, x2: cx + 68 * Math.sin(minA), y2: cy - 68 * Math.cos(minA), "class": "fig-hand-min" }, svg);
    s("circle", { cx: cx, cy: cy, r: 5, "class": "fig-point" }, svg);
    if (c.digital !== false) text(svg, cx, 226, String(h) + ":" + (m < 10 ? "0" : "") + m, "fig-clockdigital");
    const wrapEl = wrap([svg]);
    svg.style.maxWidth = "250px";
    return wrapEl;
  }

  // ----- uppställning: written column arithmetic, shown one step at a time -----
  const PLACES = ["ental", "tiotal", "hundratal", "tusental", "tiotusental", "hundratusental", "miljonental"];

  function digitsOf(n) {
    return String(Math.max(0, Math.round(Number(n)))).split("").map(Number);
  }

  function place(p) { return PLACES[p] || "plats " + (p + 1); }

  function digitAt(D, p) { return p < D.length ? D[D.length - 1 - p] : 0; }

  // Every frame: { caption, hi (column from the left, or -1), res: [text per column], marks: { column: [text] } }
  function framesAdd(c) {
    const a = Number(c.a), b = Number(c.b), sum = a + b;
    const A = digitsOf(a), B = digitsOf(b), R = digitsOf(sum);
    const n = Math.max(A.length, B.length, R.length);
    const res = new Array(n).fill("");
    const marks = {};
    const snap = function (caption, hi) { return { caption: caption, hi: hi, res: res.slice(), marks: JSON.parse(JSON.stringify(marks)) }; };
    const frames = [snap("Ställ upp talen under varandra: ental under ental, tiotal under tiotal.", -1)];
    const len = Math.max(A.length, B.length);
    let carry = 0;
    for (let p = 0; p < n; p++) {
      const col = n - 1 - p;
      if (p >= len) {
        res[col] = String(carry);
        frames.push(snap("Det blir " + carry + " " + place(p) + " över. Skriv " + carry + " längst till vänster.", col));
        break;
      }
      const da = digitAt(A, p), db = digitAt(B, p);
      const s = da + db + carry, digit = s % 10, cout = Math.floor(s / 10);
      let cap = cap1(place(p)) + ": " + da + " + " + db + (carry ? " + " + carry + " (minnessiffran)" : "") + " = " + s + ". ";
      cap += cout ? "Skriv " + digit + " och minns " + cout + "." : "Skriv " + digit + ".";
      res[col] = String(digit);
      if (cout && col > 0) marks[col - 1] = [String(cout)];
      frames.push(snap(cap, col));
      carry = cout;
    }
    frames.push(snap("Klart! " + a + " + " + b + " = " + sum + ".", -1));
    return { n: n, frames: frames, op: "+", top: A, bottom: B };
  }

  function framesSub(c) {
    let a = Number(c.a), b = Number(c.b);
    if (b > a) { const t = a; a = b; b = t; }
    const diff = a - b;
    const A = digitsOf(a), B = digitsOf(b), R = digitsOf(diff);
    const n = A.length;
    const res = new Array(n).fill("");
    const marks = {};
    const snap = function (caption, hi) { return { caption: caption, hi: hi, res: res.slice(), marks: JSON.parse(JSON.stringify(marks)) }; };
    const frames = [snap("Ställ upp talen under varandra: ental under ental, tiotal under tiotal. Det större talet står överst.", -1)];
    let borrowIn = 0;
    for (let p = 0; p < n; p++) {
      const col = n - 1 - p;
      const ta = digitAt(A, p), tb = digitAt(B, p);
      const eff = ta - borrowIn;
      const borrow = eff < tb ? 1 : 0;
      const top = borrow ? eff + 10 : eff;
      const digit = top - tb;
      let cap = cap1(place(p)) + ": ";
      if (borrowIn && eff < 0) {
        cap += "Här lånade du 1 nyss, men " + ta + " går inte att minska med 1. Låna 1 " + place(p + 1) + ". 1 " + place(p + 1) + " är 10 " + place(p) + ", och 10 − 1 = " + (eff + 10) + ". ";
        cap += (eff + 10) + " − " + tb + " = " + digit + ". Skriv " + digit + ".";
        marks[col] = (marks[col] || []).concat(["+10"]);
        if (col > 0) marks[col - 1] = (marks[col - 1] || []).concat(["−1"]);
      } else {
      if (borrowIn) cap += "Här lånade du 1 nyss, så " + ta + " är nu " + eff + ". ";
      if (borrow) {
        cap += eff + " − " + tb + " går inte. Låna 1 " + place(p + 1) + ". 1 " + place(p + 1) + " är 10 " + place(p) + ", så " + eff + " blir " + (eff + 10) + ". ";
        cap += (eff + 10) + " − " + tb + " = " + digit + ". Skriv " + digit + ".";
        marks[col] = (marks[col] || []).concat(["+10"]);
        if (col > 0) marks[col - 1] = (marks[col - 1] || []).concat(["−1"]);
      } else {
        cap += eff + " − " + tb + " = " + digit + ". Skriv " + digit + ".";
      }
      }
      if (p < R.length) res[col] = String(digit);
      else cap = cap.replace(/Skriv \d+\.$/, "Svaret börjar inte med en nolla, så du skriver inget här.");
      frames.push(snap(cap, col));
      borrowIn = borrow;
    }
    frames.push(snap("Klart! " + a + " − " + b + " = " + diff + ". Kontrollera med addition: " + diff + " + " + b + " = " + a + ".", -1));
    return { n: n, frames: frames, op: "−", top: A, bottom: B };
  }

  function framesMul(c) {
    if (Number(c.b) >= 10) return framesMul2(c);
    const a = Number(c.a), m = Number(c.b), prod = a * m;
    const A = digitsOf(a), R = digitsOf(prod);
    const n = Math.max(A.length, R.length);
    const res = new Array(n).fill("");
    const marks = {};
    const snap = function (caption, hi) { return { caption: caption, hi: hi, res: res.slice(), marks: JSON.parse(JSON.stringify(marks)) }; };
    const frames = [snap("Ställ upp talen under varandra. Det lilla talet står under entalen. Du multiplicerar det med en siffra i taget, från höger.", -1)];
    let carry = 0;
    A.slice().reverse().forEach(function (da, p) {
      const col = n - 1 - p;
      const last = p === A.length - 1;
      const own = da * m, total = own + carry, digit = total % 10, cout = Math.floor(total / 10);
      let cap = cap1(place(p)) + ": " + m + " · " + da + " = " + own;
      if (carry) cap += ", och " + own + " + " + carry + " (minnessiffran) = " + total;
      cap += ". ";
      if (last) {
        cap += "Det är sista siffran, så skriv hela " + total + ".";
        digitsOf(total).reverse().forEach(function (d, j) { res[col - j] = String(d); });
      } else {
        cap += cout ? "Skriv " + digit + " och minns " + cout + "." : "Skriv " + digit + ".";
        res[col] = String(digit);
        if (cout) marks[col - 1] = [String(cout)];
      }
      frames.push(snap(cap, col));
      carry = cout;
    });
    let final = "Klart! " + a + " · " + m + " = " + prod + ".";
    if (A.length >= 2) {
      const unit = Math.pow(10, A.length - 1), rounded = Math.round(a / unit) * unit;
      final += " Kolla med överslag: ungefär " + rounded + " · " + m + " = " + (rounded * m) + ". Svaret ska ligga nära det.";
    }
    frames.push(snap(final, -1));
    return { n: n, frames: frames, op: "·", top: A, bottom: digitsOf(m) };
  }

  // Multiplying with a two-digit number: one row per digit, then the rows are added.
  function framesMul2(c) {
    const a = Number(c.a), b = Number(c.b), prod = a * b;
    const A = digitsOf(a), Bd = digitsOf(b), R = digitsOf(prod);
    const d0 = Bd[Bd.length - 1], d1 = Bd[Bd.length - 2];
    const P1 = a * d0, P2 = a * d1 * 10;
    const n = Math.max(R.length, digitsOf(P1).length, digitsOf(P2).length);
    const p1 = new Array(n).fill(""), p2 = new Array(n).fill(""), res = new Array(n).fill("");
    let marks = {};
    const snap = function (caption, hi) {
      return { caption: caption, hi: hi, res: res.slice(), p1: p1.slice(), p2: p2.slice(), marks: JSON.parse(JSON.stringify(marks)) };
    };
    const frames = [snap("Ställ upp talen under varandra. Du multiplicerar " + a + " med en siffra i " + b + " i taget: först entalssiffran " + d0 + ", sedan tiotalssiffran " + d1 + ".", -1)];

    // one row: a times one digit of b, written `shift` columns further to the left
    function row(target, digit, shift, intro) {
      let carry = 0;
      A.slice().reverse().forEach(function (da, p) {
        const topCol = n - 1 - p, col = topCol - shift;
        const last = p === A.length - 1;
        const own = da * digit, total = own + carry, out = total % 10, cout = Math.floor(total / 10);
        let cap = (p === 0 && intro ? intro + " " : "") + cap1(place(p)) + ": " + digit + " · " + da + " = " + own;
        if (carry) cap += ", och " + own + " + " + carry + " (minnessiffran) = " + total;
        cap += ". ";
        if (last) {
          cap += "Det är sista siffran, så skriv hela " + total + ".";
          digitsOf(total).reverse().forEach(function (d, j) { target[col - j] = String(d); });
        } else {
          cap += cout ? "Skriv " + out + " och minns " + cout + "." : "Skriv " + out + ".";
          target[col] = String(out);
          if (cout) marks[topCol - 1] = [String(cout)];
        }
        frames.push(snap(cap, shift ? [topCol, col] : col));
        carry = cout;
      });
    }
    row(p1, d0, 0, "");
    marks = {};
    p2[n - 1] = "0";
    frames.push(snap("Nu multiplicerar du med tiotalssiffran " + d1 + ". Det är tiotal, så du börjar med en nolla på entalsplatsen.", n - 1));
    row(p2, d1, 1, "");

    // add the two rows
    marks = {};
    let carry = 0;
    for (let p = 0; p < n; p++) {
      const col = n - 1 - p;
      const x = Number(p1[col] || 0), y = Number(p2[col] || 0);
      if (p >= R.length) break;
      const s = x + y + carry, out = s % 10, cout = Math.floor(s / 10);
      let cap = cap1(place(p)) + ": " + x + " + " + y + (carry ? " + " + carry + " (minnessiffran)" : "") + " = " + s + ". ";
      const lastCol = p === R.length - 1;
      cap += lastCol ? "Skriv " + s + "." : cout ? "Skriv " + out + " och minns " + cout + "." : "Skriv " + out + ".";
      res[col] = String(lastCol ? s : out);
      if (cout && col > 0 && !lastCol) marks[col - 1] = [String(cout)];
      frames.push(snap(p === 0 ? "Lägg ihop raderna. " + cap : cap, col));
      carry = cout;
    }
    const r1 = Math.round(a / Math.pow(10, A.length - 1)) * Math.pow(10, A.length - 1), r2 = Math.round(b / 10) * 10;
    frames.push(snap("Klart! " + a + " · " + b + " = " + prod + ". Kolla med överslag: ungefär " + r1 + " · " + r2 + " = " + (r1 * r2) + ". Svaret ska ligga nära det.", -1));
    return { n: n, frames: frames, op: "·", top: A, bottom: Bd, partial: true };
  }

  // ----- balance scale: the same on both sides, or not -----
  // { left: [{ n, tone }], right: [{ n, tone }], leftLabel, rightLabel }   n = how many blocks, tone "x" makes them pink
  function scale(c) {
    const count = function (parts) { return (parts || []).reduce(function (sum, p) { return sum + Math.max(0, Math.min(40, Math.round(Number(p.n) || 0))); }, 0); };
    const L = count(c.left), R = count(c.right);
    const W = 480, H = 330, px = 240, py = 70, half = 170;
    const tilt = Math.max(-12, Math.min(12, (R - L) * 2));   // degrees, clockwise: the right side goes down
    const balanced = L === R && L > 0;
    const svg = svgRoot(c, W, H);
    const a = tilt * Math.PI / 180;
    const ends = [[px - half * Math.cos(a), py - half * Math.sin(a)], [px + half * Math.cos(a), py + half * Math.sin(a)]];
    s("polygon", { points: (px - 46) + ",300 " + (px + 46) + ",300 " + px + "," + py, "class": "fig-bal-stand" }, svg);
    s("line", { x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1], "class": "fig-bal-beam" + (balanced ? " is-ok" : "") }, svg);
    s("circle", { cx: px, cy: py, r: 9, "class": "fig-bal-pivot" }, svg);
    [[ends[0], c.left, c.leftLabel], [ends[1], c.right, c.rightLabel]].forEach(function (side) {
      const ex = side[0][0], ey = side[0][1], plateY = ey + 120;
      s("line", { x1: ex - 56, y1: plateY - 100 + 100, x2: ex, y2: ey, "class": "fig-bal-string" }, svg);
      s("line", { x1: ex + 56, y1: plateY, x2: ex, y2: ey, "class": "fig-bal-string" }, svg);
      s("rect", { x: ex - 64, y: plateY, width: 128, height: 8, rx: 4, "class": "fig-bal-plate" + (balanced ? " is-ok" : "") }, svg);
      const blocks = [];
      (side[1] || []).forEach(function (part) {
        const n = Math.max(0, Math.min(40, Math.round(Number(part.n) || 0)));
        for (let i = 0; i < n; i++) blocks.push(part.tone === "x");
      });
      const cols = 6, size = 20;
      blocks.forEach(function (isX, i) {
        const colIdx = i % cols, rowIdx = Math.floor(i / cols);
        const inRow = Math.min(cols, blocks.length - rowIdx * cols);
        s("rect", { x: ex - inRow * size / 2 + colIdx * size + 1, y: plateY - (rowIdx + 1) * size + 1, width: size - 2, height: size - 2, rx: 3, "class": "fig-bal-block" + (isX ? " is-x" : "") }, svg);
      });
      if (side[2]) text(svg, ex, plateY + 32, side[2], "fig-dim");
    });
    if (balanced) text(svg, px, 322, "I balans", "fig-dim fig-bal-ok");
    return wrap([svg]);
  }

  function framesDiv(c) {
    const a = Number(c.a), d = Number(c.b);
    const D = digitsOf(a), L = D.length;
    const q = new Array(L).fill("");
    const carries = {};
    const snap = function (caption, hi, extra) {
      return Object.assign({ caption: caption, hi: hi, res: q.slice(), marks: JSON.parse(JSON.stringify(carries)) }, extra || {});
    };
    const frames = [snap("Ställ upp talen: " + a + " ska delas med " + d + ". Du delar en siffra i taget, från vänster.", -1)];
    let r = 0, started = false;
    D.forEach(function (digit, i) {
      const pl = place(L - 1 - i);
      const cur = r * 10 + digit;
      const qd = Math.floor(cur / d), rem = cur % d;
      let cap = "";
      if (i > 0 && r > 0) cap += r + " " + place(L - i) + " blir " + (r * 10) + " " + pl + ". " + (r * 10) + " + " + digit + " = " + cur + " " + pl + ". ";
      cap += cur + " " + pl + " delat med " + d;
      if (qd === 0 && !started) {
        cap += " går inte, för " + cur + " är mindre än " + d + ". Gå vidare till nästa siffra.";
      } else {
        started = true;
        cap += " är " + qd + (rem ? ", och " + rem + " blir över." : ".") + " Skriv " + qd + " i svaret.";
        q[i] = String(qd);
      }
      if (i < L - 1 && rem > 0) carries[i + 1] = [String(rem)];
      r = rem;
      frames.push(snap(cap, i));
    });
    const Q = String(Math.floor(a / d));
    frames.push(snap(r > 0
      ? "Det blir " + r + " över. Svaret är " + Q + " rest " + r + "."
      : "Klart! " + a + " delat med " + d + " är " + Q + ". Kontrollera: " + d + " · " + Q + " = " + a + ".", -1, { rest: r }));
    return { n: L, frames: frames, op: "/", top: D, divisor: d };
  }

  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function upModel(c) {
    const op = String(c.op || "+");
    if (op === "-" || op === "−") return framesSub(c);
    if (op === "*" || op === "·" || op === "×") return framesMul(c);
    if (op === "/" || op === "÷" || op === ":") return framesDiv(c);
    return framesAdd(c);
  }

  function cellEl(cls, text) {
    const e = document.createElement("span");
    e.className = "up-c " + cls;
    if (text !== undefined && text !== "") e.textContent = text;
    return e;
  }

  function drawUp(model, frame) {
    const n = model.n;
    const grid = document.createElement("div");
    grid.className = "up-grid" + (model.op === "/" ? " is-div" : "");
    const row = function (cls) { const r = document.createElement("div"); r.className = "up-row " + cls; grid.appendChild(r); return r; };
    const hi = function (col) { return col === frame.hi || (Array.isArray(frame.hi) && frame.hi.indexOf(col) >= 0) ? " is-hi" : ""; };

    if (model.op === "/") {
      const qrow = row("up-q");
      qrow.appendChild(cellEl("up-side", ""));
      qrow.appendChild(cellEl("up-side", ""));
      for (let i = 0; i < n; i++) qrow.appendChild(cellEl("up-digit up-res" + hi(i), frame.res[i]));
      if (frame.rest) qrow.appendChild(cellEl("up-rest", "rest " + frame.rest));
      const drow = row("up-dividend");
      drow.appendChild(cellEl("up-side up-divisor", String(model.divisor)));
      drow.appendChild(cellEl("up-side up-bracket", ")"));
      for (let i = 0; i < n; i++) {
        const cell = cellEl("up-digit up-line" + hi(i), String(model.top[i]));
        const m = frame.marks[i];
        if (m && m.length) {
          const small = document.createElement("span");
          small.className = "up-small";
          small.textContent = m[0];
          cell.appendChild(small);
        }
        drow.appendChild(cell);
      }
      return grid;
    }

    const marksRow = row("up-marks");
    marksRow.appendChild(cellEl("up-side", ""));
    for (let col = 0; col < n; col++) {
      const cell = cellEl("up-small-cell" + hi(col), "");
      (frame.marks[col] || []).forEach(function (t) {
        const s = document.createElement("span");
        s.className = "up-small" + (/^[+−]/.test(t) ? " is-borrow" : "");
        s.textContent = t;
        cell.appendChild(s);
      });
      marksRow.appendChild(cell);
    }
    const put = function (cls, digits, opText) {
      const r = row(cls);
      r.appendChild(cellEl("up-side up-op" + (opText === "·" ? " is-dot" : ""), opText || ""));
      for (let col = 0; col < n; col++) {
        const p = n - 1 - col;
        const has = p < digits.length;
        r.appendChild(cellEl("up-digit" + hi(col), has ? String(digits[digits.length - 1 - p]) : ""));
      }
    };
    put("up-top", model.top, "");
    put("up-bottom", model.bottom, model.op);
    if (model.partial) {   // one row for each digit of the lower number
      const r1 = row("up-result");
      r1.appendChild(cellEl("up-side", ""));
      for (let col = 0; col < n; col++) r1.appendChild(cellEl("up-digit up-res up-line" + hi(col), frame.p1[col]));
      const r2 = row("up-result");
      r2.appendChild(cellEl("up-side up-op", "+"));
      for (let col = 0; col < n; col++) r2.appendChild(cellEl("up-digit up-res" + hi(col), frame.p2[col]));
    }
    const rr = row("up-result");
    rr.appendChild(cellEl("up-side", ""));
    for (let col = 0; col < n; col++) rr.appendChild(cellEl("up-digit up-res up-line" + hi(col), frame.res[col]));
    return grid;
  }

  function uppstallning(c) {
    const model = upModel(c);
    const box = document.createElement("div");
    box.className = "up";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", c.alt || c.title || "Uppställning steg för steg");
    const stage = document.createElement("div");
    stage.className = "up-stage";
    const caption = document.createElement("p");
    caption.className = "up-caption";
    caption.setAttribute("aria-live", "polite");
    const controls = document.createElement("div");
    controls.className = "up-controls";
    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "up-btn"; prev.textContent = "← Förra steget";
    const next = document.createElement("button");
    next.type = "button"; next.className = "up-btn up-btn-main"; next.textContent = "Nästa steg →";
    const again = document.createElement("button");
    again.type = "button"; again.className = "up-btn up-btn-quiet"; again.textContent = "Börja om";
    const count = document.createElement("span");
    count.className = "up-count";
    controls.append(prev, next, again, count);
    box.append(stage, caption, controls);
    let at = Math.max(0, Math.min(model.frames.length - 1, Number(c.start) || 0));
    function draw() {
      const frame = model.frames[at];
      stage.replaceChildren(drawUp(model, frame));
      caption.textContent = frame.caption;
      count.textContent = "Steg " + (at + 1) + " av " + model.frames.length;
      prev.disabled = at === 0;
      next.disabled = at === model.frames.length - 1;
      again.hidden = at === 0;
    }
    prev.addEventListener("click", function () { if (at > 0) { at -= 1; draw(); } });
    next.addEventListener("click", function () { if (at < model.frames.length - 1) { at += 1; draw(); } });
    again.addEventListener("click", function () { at = 0; draw(); });
    draw();
    return wrap([box]);
  }

  // ----- Pythagoras: a right triangle with a square on each side -----
  function pythagoras(c) {
    const a = Number(c.a), b = Number(c.b);
    const hyp = Math.sqrt(a * a + b * b);
    const unit = c.unit ? " " + c.unit : "";
    const lab = c.labels || {};
    // right angle at the origin, leg a along x, leg b along y (up)
    const B = [a, 0], C = [0, -b];
    const nx = b, ny = -a;   // outward direction for the hypotenuse square (length = hyp)
    const pts = [[0, 0], B, C, [0, a], [a, a], [-b, 0], [-b, -b], [B[0] + nx, B[1] + ny], [C[0] + nx, C[1] + ny]];
    const xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    const W = 460, H = 380, P = 16;
    const sc = Math.min((W - 2 * P) / (maxX - minX), (H - 2 * P) / (maxY - minY));
    const ox = (W - (maxX - minX) * sc) / 2 - minX * sc, oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
    const X = function (p) { return ox + p[0] * sc; }, Y = function (p) { return oy + p[1] * sc; };
    const poly = function (list, cls) {
      return s("polygon", { points: list.map(function (p) { return X(p) + "," + Y(p); }).join(" "), "class": cls }, svg);
    };
    const svg = svgRoot(c, W, H);
    poly([[0, 0], [0, a], [a, a], [a, 0]], "fig-sq fig-sq-a");
    poly([[0, 0], [-b, 0], [-b, -b], [0, -b]], "fig-sq fig-sq-b");
    poly([B, C, [C[0] + nx, C[1] + ny], [B[0] + nx, B[1] + ny]], "fig-sq fig-sq-c");
    poly([[0, 0], B, C], "fig-shape");
    const q = 10;
    s("path", { d: "M" + (X([0, 0]) + q) + " " + Y([0, 0]) + " v-" + q + " h-" + q, "class": "fig-right" }, svg);
    const showArea = c.areas !== false;
    const nameA = lab.a || "a", nameB = lab.b || "b", nameC = lab.c || "c";
    const r2 = function (v) { return String(Math.round(v * 100) / 100).replace(".", ","); };
    // each square says how long its side is and how big its area is
    const say = function (center, name, side, hidden, area) {
      text(svg, X(center), Y(center) - 6, name + (hidden ? " = ?" : " = " + r2(side) + unit), "fig-dim");
      text(svg, X(center), Y(center) + 16, showArea && !hidden ? name + "² = " + r2(area) : name + "²", "fig-dim");
    };
    say([a / 2, a / 2], nameA, a, c.hideA, a * a);
    say([-b / 2, -b / 2], nameB, b, c.hideB, b * b);
    say([(B[0] + C[0]) / 2 + nx / 2, (B[1] + C[1]) / 2 + ny / 2], nameC, hyp, c.hideC, a * a + b * b);
    return wrap([svg]);
  }

  // ----- tree diagram: every branch of a series of choices -----
  // { levels: [["krona","klave"], ["krona","klave"]], root: "Start" }   one list of choices per step
  function tradiagram(c) {
    const levels = (c.levels || []).map(function (l) { return l.map(String); }).filter(function (l) { return l.length; });
    const leafCount = levels.reduce(function (n, l) { return n * l.length; }, 1);
    const ROW = 38, PADY = 18;
    const widths = [c.root === false ? 0 : 58].concat(levels.map(function (l) {
      return Math.max.apply(null, l.map(function (t) { return t.length; })) * 9 + 26;
    }));
    const GAP = 46;
    const W = widths.reduce(function (s, w) { return s + w; }, 0) + GAP * levels.length + 20;
    const H = Math.max(120, leafCount * ROW + 2 * PADY);
    const svg = svgRoot(c, W, H);
    const xs = [];
    let x = 10;
    widths.forEach(function (w) { xs.push(x); x += w + GAP; });

    let leaf = 0;
    const edges = [], nodes = [];
    function build(depth, path) {   // returns y of this node
      let y;
      if (depth === levels.length) {
        y = PADY + ROW / 2 + leaf * ROW;
        leaf += 1;
        return { y: y, id: nodes.length };
      }
      const kids = levels[depth].map(function (label) {
        const child = build(depth + 1, path.concat(label));
        nodes.push({ depth: depth + 1, y: child.y, label: label, leaf: depth + 1 === levels.length });
        return child;
      });
      y = (kids[0].y + kids[kids.length - 1].y) / 2;
      kids.forEach(function (k) { edges.push({ from: depth, y1: y, y2: k.y }); });
      return { y: y };
    }
    const root = build(0, []);
    edges.forEach(function (e) {
      s("line", { x1: xs[e.from] + widths[e.from], y1: e.y1, x2: xs[e.from + 1], y2: e.y2, "class": "fig-branch" }, svg);
    });
    if (widths[0]) {
      s("rect", { x: xs[0], y: root.y - 15, width: widths[0], height: 30, rx: 15, "class": "fig-tnode is-root" }, svg);
      text(svg, xs[0] + widths[0] / 2, root.y + 5, c.root || "Start", "fig-dim");
    }
    nodes.forEach(function (n) {
      s("rect", { x: xs[n.depth], y: n.y - 15, width: widths[n.depth], height: 30, rx: 15, "class": "fig-tnode" + (n.leaf ? " is-leaf" : "") }, svg);
      text(svg, xs[n.depth] + widths[n.depth] / 2, n.y + 5, n.label, "fig-dim");
    });
    return wrap([svg]);
  }

  // ----- parallelogram: base, height and the slanted sides -----
  // { base, height, shift, unit, showHeight, showRect, labels:{base,height,side} }
  function parallelogram(c) {
    const b = Number(c.base), ht = Number(c.height);
    const shift = c.shift !== undefined ? Number(c.shift) : Math.round(b / 3 * 10) / 10;
    const unit = c.unit ? " " + c.unit : "";
    const lab = c.labels || {};
    const sc = Math.min(40, 300 / (b + shift), 170 / ht);
    const W = 460, H = ht * sc + 96;
    const x0 = (W - (b + shift) * sc) / 2, yb = 30 + ht * sc, yt = 30;
    const A = [x0, yb], B = [x0 + b * sc, yb], C = [x0 + (b + shift) * sc, yt], D = [x0 + shift * sc, yt];
    const svg = svgRoot(c, W, H);
    if (c.showRect) s("rect", { x: D[0], y: yt, width: b * sc, height: ht * sc, "class": "fig-dash" }, svg);
    s("polygon", { points: [A, B, C, D].map(function (p) { return p.join(","); }).join(" "), "class": "fig-shape" }, svg);
    if (c.showHeight !== false) {
      s("line", { x1: D[0], y1: yt, x2: D[0], y2: yb, "class": "fig-axisline" }, svg);
      const q = 10;
      s("path", { d: "M" + (D[0] + q) + " " + yb + " v-" + q + " h-" + q, "class": "fig-right" }, svg);
      text(svg, D[0] - 8, (yt + yb) / 2 + 5, lab.height || ("h = " + fmt(ht) + unit), "fig-dim", "end");
    }
    text(svg, (A[0] + B[0]) / 2, yb + 26, lab.base || ("b = " + fmt(b) + unit), "fig-dim");
    if (lab.side) text(svg, (A[0] + D[0]) / 2 - 12, (A[1] + D[1]) / 2, lab.side, "fig-dim", "end");
    return wrap([svg]);
  }

  // ----- trapezoid: two parallel sides a (top) and b (bottom) and the height -----
  // { a, b, height, offset, unit, showHeight, showCopy, labels:{a,b,height} }
  function trapezoid(c) {
    const a = Number(c.a), b = Number(c.b), ht = Number(c.height);
    const off = c.offset !== undefined ? Number(c.offset) : (b - a) / 2;
    const unit = c.unit ? " " + c.unit : "";
    const lab = c.labels || {};
    const yb0 = ht, yt0 = 0;   // unscaled: y grows downwards
    const P0 = [[0, yb0], [b, yb0], [off + a, yt0], [off, yt0]];
    let copy0 = null;
    if (c.showCopy) {   // the same trapezoid turned half a turn around the middle of the right leg
      const mx = (P0[1][0] + P0[2][0]) / 2, my = (P0[1][1] + P0[2][1]) / 2;
      copy0 = P0.map(function (p) { return [2 * mx - p[0], 2 * my - p[1]]; });
    }
    const all = P0.concat(copy0 || []);
    const minX = Math.min.apply(null, all.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, all.map(function (p) { return p[0]; }));
    const W = 500, H = ht * 40 + 96;
    const sc = Math.min(40, (W - 40) / (maxX - minX), 170 / ht);
    const svg = svgRoot(c, W, ht * sc + 96);
    const ox = (W - (maxX - minX) * sc) / 2 - minX * sc, oy = 30;
    const T = function (p) { return [ox + p[0] * sc, oy + p[1] * sc]; };
    const pts = function (list) { return list.map(function (p) { return T(p).join(","); }).join(" "); };
    if (copy0) s("polygon", { points: pts(copy0), "class": "fig-copy" }, svg);
    s("polygon", { points: pts(P0), "class": "fig-shape" }, svg);
    const P = P0.map(T);
    if (c.showHeight !== false) {
      const hx = P[3][0], yt = P[3][1], yb = P[0][1];
      s("line", { x1: hx, y1: yt, x2: hx, y2: yb, "class": "fig-axisline" }, svg);
      const q = 10;
      s("path", { d: "M" + (hx + q) + " " + yb + " v-" + q + " h-" + q, "class": "fig-right" }, svg);
      text(svg, hx - 8, (yt + yb) / 2 + 5, lab.height || ("h = " + fmt(ht) + unit), "fig-dim", "end");
    }
    text(svg, (P[3][0] + P[2][0]) / 2, P[3][1] - 8, lab.a || ("a = " + fmt(a) + unit), "fig-dim");
    text(svg, (P[0][0] + P[1][0]) / 2, P[0][1] + 26, lab.b || ("b = " + fmt(b) + unit), "fig-dim");
    return wrap([svg]);
  }

  // ----- solids (kroppar): a row of simple drawings -----
  // { items: [{ shape: "kub" | "ratblock" | "cylinder" | "klot" | "kon" | "pyramid", label }], columns }
  function solid(svg, shape, cx, cy) {   // cx, cy: top left of a 150 x 125 cell
    const g = s("g", { transform: "translate(" + cx + " " + cy + ")" }, svg);
    const poly = function (pts, cls) { return s("polygon", { points: pts.map(function (p) { return p.join(","); }).join(" "), "class": cls }, g); };
    if (shape === "kub" || shape === "ratblock") {
      const w = shape === "kub" ? 60 : 92, h = shape === "kub" ? 60 : 48, dx = 24, dy = -22, x = 20, y = 48;
      poly([[x, y], [x + dx, y + dy], [x + dx + w, y + dy], [x + w, y]], "fig-k fig-k-top");
      poly([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dy + h], [x + w, y + h]], "fig-k fig-k-side");
      poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "fig-k fig-k-front");
    } else if (shape === "cylinder") {
      const rx = 38, ry = 12, x0 = 75 - rx, x1 = 75 + rx, top = 36, bottom = 96;
      s("path", { d: "M" + x0 + "," + top + " L" + x0 + "," + bottom + " A" + rx + "," + ry + " 0 0 0 " + x1 + "," + bottom + " L" + x1 + "," + top + " Z", "class": "fig-k fig-k-front" }, g);
      s("ellipse", { cx: 75, cy: top, rx: rx, ry: ry, "class": "fig-k fig-k-top" }, g);
    } else if (shape === "klot") {
      s("circle", { cx: 75, cy: 62, r: 44, "class": "fig-k fig-k-front" }, g);
      s("ellipse", { cx: 75, cy: 62, rx: 44, ry: 12, "class": "fig-k-line" }, g);
      s("ellipse", { cx: 60, cy: 44, rx: 10, ry: 6, "class": "fig-k-shine", transform: "rotate(-30 60 44)" }, g);
    } else if (shape === "kon") {
      const rx = 40, ry = 12, base = 100;
      s("path", { d: "M75,14 L" + (75 - rx) + "," + base + " A" + rx + "," + ry + " 0 0 0 " + (75 + rx) + "," + base + " Z", "class": "fig-k fig-k-front" }, g);
      s("ellipse", { cx: 75, cy: base, rx: rx, ry: ry, "class": "fig-k fig-k-top" }, g);
    } else if (shape === "pyramid") {
      const A = [28, 104], B = [100, 104], C = [128, 84], D = [56, 84], P = [78, 14];
      poly([P, B, C], "fig-k fig-k-side");
      poly([P, A, B], "fig-k fig-k-front");
      s("line", { x1: D[0], y1: D[1], x2: A[0], y2: A[1], "class": "fig-k-hidden" }, g);
      s("line", { x1: D[0], y1: D[1], x2: C[0], y2: C[1], "class": "fig-k-hidden" }, g);
      s("line", { x1: D[0], y1: D[1], x2: P[0], y2: P[1], "class": "fig-k-hidden" }, g);
    }
  }

  function solids(c) {
    const items = c.items || [];
    const cols = Math.max(1, Math.min(items.length, c.columns || 3));
    const rows = Math.ceil(items.length / cols);
    const svg = svgRoot(c, cols * 150 + 10, rows * 160 + 6);
    items.forEach(function (it, i) {
      const col = i % cols, row = Math.floor(i / cols);
      solid(svg, it.shape, 5 + col * 150, 6 + row * 160);
      text(svg, 5 + col * 150 + 75, 6 + row * 160 + 142, it.label || it.shape, "fig-dim");
    });
    return wrap([svg]);
  }

  // ----- lines: parallel, perpendicular, crossing -----
  // { items: [{ kind: "parallella" | "vinkelrata" | "skarande", label }] }
  function lines(c) {
    const items = c.items || [];
    const cols = Math.max(1, Math.min(items.length, c.columns || 3));
    const rows = Math.ceil(items.length / cols);
    const svg = svgRoot(c, cols * 160 + 10, rows * 140 + 6);
    items.forEach(function (it, i) {
      const col = i % cols, row = Math.floor(i / cols);
      const g = s("g", { transform: "translate(" + (5 + col * 160) + " " + (6 + row * 140) + ")" }, svg);
      if (it.kind === "parallella") {
        s("line", { x1: 12, y1: 36, x2: 148, y2: 36, "class": "fig-lin" }, g);
        s("line", { x1: 12, y1: 78, x2: 148, y2: 78, "class": "fig-lin" }, g);
        [36, 78].forEach(function (y) { s("polyline", { points: "78,"+ (y - 6) + " 84," + y + " 78," + (y + 6), "class": "fig-lin-mark" }, g); });
      } else if (it.kind === "vinkelrata") {
        s("line", { x1: 12, y1: 78, x2: 148, y2: 78, "class": "fig-lin" }, g);
        s("line", { x1: 80, y1: 12, x2: 80, y2: 108, "class": "fig-lin" }, g);
        s("path", { d: "M80,64 H94 V78", "class": "fig-right" }, g);
      } else {
        s("line", { x1: 18, y1: 100, x2: 142, y2: 22, "class": "fig-lin" }, g);
        s("line", { x1: 18, y1: 30, x2: 142, y2: 92, "class": "fig-lin" }, g);
      }
      text(g, 80, 128, it.label || "", "fig-dim");
    });
    return wrap([svg]);
  }

  // ----- tally chart (strecktabell): groups of five -----
  // { rows: [{ label, n }] }
  function tally(c) {
    const rows = c.rows || [];
    const W = 480, ROWH = 42;
    const svg = svgRoot(c, W, rows.length * ROWH + 12);
    rows.forEach(function (r, i) {
      const y = 10 + i * ROWH;
      text(svg, 8, y + 25, r.label || "", "fig-dim", "start");
      let n = Math.max(0, Math.round(Number(r.n) || 0));
      let x = 120;
      while (n > 0) {
        const k = Math.min(5, n);
        const four = Math.min(4, k);
        for (let j = 0; j < four; j++) s("line", { x1: x + j * 9, y1: y + 6, x2: x + j * 9, y2: y + 30, "class": "fig-tally" }, svg);
        if (k === 5) s("line", { x1: x - 5, y1: y + 27, x2: x + 4 * 9 - 4 + 4, y2: y + 9, "class": "fig-tally" }, svg);
        x += k === 5 ? 54 : four * 9 + 20;
        n -= k;
      }
      if (c.counts) text(svg, W - 10, y + 25, String(Math.round(Number(r.n) || 0)), "fig-dim", "end");
    });
    return wrap([svg]);
  }

  // ----- long division (långdivision): the whole calculation written out -----
  // { a, b }   a is divided by b. Each step shows the product that is subtracted and what is left (with the next digit brought down).
  function longdivision(c) {
    const a = Math.max(1, Math.round(Number(c.a))), d = Math.max(1, Math.round(Number(c.b)));
    const D = digitsOf(a), L = D.length;
    const CW = 28, RH = 30, left = 78, top = 14;
    const q = new Array(L).fill("");
    const steps = [];
    let cur = 0, started = false;
    D.forEach(function (digit, i) {
      cur = cur * 10 + digit;
      const qd = Math.floor(cur / d);
      if (qd > 0) started = true;
      if (!started) return;
      q[i] = String(qd);
      steps.push({ col: i, prod: qd * d, rem: cur - qd * d, next: i + 1 < L ? D[i + 1] : null });
      cur = cur - qd * d;
    });
    const base = top + 62;   // baseline of the dividend row
    const W = left + L * CW + 40, H = base + steps.length * 2 * RH + 22;
    const svg = svgRoot(c, W, H);
    const cx = function (col) { return left + col * CW + CW / 2; };
    // the digits of a number, right aligned so that the last digit sits in column `col`
    const put = function (value, col, y, cls) {
      const ds = digitsOf(value);
      ds.forEach(function (dig, j) { text(svg, cx(col - (ds.length - 1 - j)), y, String(dig), "fig-ld " + (cls || "")); });
      return ds.length;
    };
    text(svg, left - 18, base, String(d), "fig-ld", "end");
    s("line", { x1: left - 8, y1: base - 24, x2: left - 8, y2: base + 8, "class": "fig-ld-line" }, svg);
    s("line", { x1: left - 8, y1: base - 24, x2: left + L * CW + 6, y2: base - 24, "class": "fig-ld-line" }, svg);
    D.forEach(function (dig, i) { text(svg, cx(i), base, String(dig), "fig-ld"); });
    q.forEach(function (dig, i) { if (dig !== "") text(svg, cx(i), base - 34, dig, "fig-ld fig-ld-q"); });
    steps.forEach(function (st, j) {
      const yProd = base + (2 * j + 1) * RH, yRem = base + (2 * j + 2) * RH;
      const n = put(st.prod, st.col, yProd);
      text(svg, cx(st.col - n) , yProd, "−", "fig-ld fig-ld-minus");
      s("line", { x1: cx(st.col - n) - CW / 2 + 4, y1: yProd + 8, x2: cx(st.col) + CW / 2, y2: yProd + 8, "class": "fig-ld-line" }, svg);
      if (st.next !== null) put(st.rem * 10 + st.next, st.col + 1, yRem);
      else put(st.rem, st.col, yRem, "fig-ld-rest");
    });
    return wrap([svg]);
  }

  // ----- area model: (x + 3)(x + 2) as a rectangle cut in four -----
  // { cols: ["x", "3"], rows: ["x", "2"], cells: [["x²", "3x"], ["2x", "6"]], widths: [0.6, 0.4], heights: [0.6, 0.4] }
  function areamodel(c) {
    const cols = c.cols || ["a", "b"], rows = c.rows || ["a", "b"], cells = c.cells || [["", ""], ["", ""]];
    const wf = c.widths || [0.6, 0.4], hf = c.heights || [0.6, 0.4];
    const W = 420, H = 300, left = 70, top = 50, gw = 300, gh = 210;
    const svg = svgRoot(c, W, H);
    let y = top;
    rows.forEach(function (rlabel, r) {
      let x = left;
      const h = gh * hf[r];
      cols.forEach(function (clabel, k) {
        const w = gw * wf[k];
        s("rect", { x: x, y: y, width: w, height: h, "class": "fig-am fig-am-" + ((r + k) % 2 === 0 ? (r === k ? "sq" : "a") : "b") }, svg);
        text(svg, x + w / 2, y + h / 2 + 7, cells[r] && cells[r][k] !== undefined ? cells[r][k] : "", "fig-am-text");
        if (r === 0) text(svg, x + w / 2, top - 14, clabel, "fig-dim");
        x += w;
      });
      text(svg, left - 14, y + h / 2 + 5, rlabel, "fig-dim", "end");
      y += h;
    });
    return wrap([svg]);
  }

  // ----- trigonometry: a right triangle with its sides named from one angle -----
  // { angle: 30, names: true, labels: { hyp, opp, adj, angle } }   labels replace the names, e.g. { opp: "5 cm", hyp: "x" }
  function trig(c) {
    const deg = Math.max(10, Math.min(80, Number(c.angle) || 30));
    const rad = deg * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
    const W = 440, H = 270;
    const len = Math.min(300 / cs, 170 / sn);
    const A = [(W - len * cs) / 2, H - 56];
    const C = [A[0] + len * cs, A[1]];
    const B = [C[0], A[1] - len * sn];
    const svg = svgRoot(c, W, H);
    s("polygon", { points: [A, C, B].map(function (p) { return p.join(","); }).join(" "), "class": "fig-shape" }, svg);
    s("path", { d: "M" + (C[0] - 14) + "," + C[1] + " V" + (C[1] - 14) + " H" + C[0], "class": "fig-right" }, svg);
    const arc = 34;
    s("path", { d: "M" + (A[0] + arc) + "," + A[1] + " A" + arc + "," + arc + " 0 0 0 " + (A[0] + arc * cs) + "," + (A[1] - arc * sn), "class": "fig-trig-arc" }, svg);
    const lab = c.labels || {}, names = c.names !== false;
    const say = function (key, fallback) { return lab[key] !== undefined ? lab[key] : (names ? fallback : ""); };
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    if (say("hyp", "hypotenusa")) text(svg, mid[0] - sn * 14, mid[1] - cs * 14, say("hyp", "hypotenusa"), "fig-dim", "end");
    if (say("opp", "motstående katet")) text(svg, C[0] + 10, (B[1] + C[1]) / 2 + 5, say("opp", "motstående katet"), "fig-dim", "start");
    if (say("adj", "närliggande katet")) text(svg, (A[0] + C[0]) / 2, A[1] + 26, say("adj", "närliggande katet"), "fig-dim");
    if (c.showAngle !== false) text(svg, A[0] + 60 * Math.cos(rad / 2) + 4, A[1] - 60 * Math.sin(rad / 2) + 5, lab.angle !== undefined ? lab.angle : deg + "°", "fig-dim fig-trig-angle", "start");
    return wrap([svg]);
  }

  function render(config) {
    const type = String(config.type || "").toLowerCase();
    if (type === "tallinje" || type === "numberline") return numberline(config);
    if (type === "rektangel" || type === "kvadrat") return rectangle(config);
    if (type === "triangel") return triangle(config);
    if (type === "figurer") return wrap([gallery(config, false)]);
    if (type === "symmetri") return wrap([gallery(config, true)]);
    if (type === "monster") return pattern(config);
    if (type === "talrutnat") return numbergrid(config);
    if (type === "staplar") return bars(config);
    if (type === "vinkel") return angle(config);
    if (type === "graf") return graph(config);
    if (type === "hundrarutor") return hundred(config);
    if (type === "klocka") return clock(config);
    if (type === "uppstallning") return uppstallning(config);
    if (type === "pythagoras") return pythagoras(config);
    if (type === "vag") return scale(config);
    if (type === "tradiagram") return tradiagram(config);
    if (type === "parallellogram") return parallelogram(config);
    if (type === "trapets") return trapezoid(config);
    if (type === "kroppar") return solids(config);
    if (type === "linjer") return lines(config);
    if (type === "strecktabell") return tally(config);
    if (type === "langdivision") return longdivision(config);
    if (type === "areamodell") return areamodel(config);
    if (type === "trigonometri") return trig(config);
    return null;
  }

  return { supports: supports, badge: badge, render: render };
}());
