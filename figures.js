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
//   graf        { xmin,xmax,ymin,ymax, lines:[{k,m,label}], points:[{x,y,label}] }  coordinate system with straight lines
//   hundrarutor { filled, label }                                                    10 x 10 grid with the first n squares filled
//   klocka      { h, m, digital }                                                    analog clock
// tallinje also takes sequence:{start,step,count}; monster takes generator:"L"|"kvadrat"|"trappa"|"rad"|"faktorer", n, only.

window.GaussicaFigures = (function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const TYPES = {
    tallinje: "TALLINJE", numberline: "TALLINJE", rektangel: "FIGUR", kvadrat: "FIGUR", triangel: "FIGUR",
    figurer: "FIGURER", symmetri: "SYMMETRI", monster: "MÖNSTER", talrutnat: "TALRUTNÄT",
    staplar: "STAPLAR", vinkel: "VINKEL", graf: "GRAF", hundrarutor: "HUNDRARUTOR", klocka: "KLOCKA"
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

  // ----- coordinate system with straight lines -----
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
    return null;
  }

  return { supports: supports, badge: badge, render: render };
}());
