// More figures for the lessons of the lower years (åk 3 and 4), added to figures.js with register(). They are drawn as inline SVG, use the
// colours of the site through the .fx-* and .fig-* rules in styles.css, and most of them move a little when they come into view (the parts pop in,
// the mercury rises, the spinner turns). With reduced motion they are still. The first line of each is a visual config, as for the other figures.
//
//   grupper     { groups, per, item, mode:"gange"|"dela", remainder, show:"uttryck"|"ingen", hide }   equal groups of things: 3 groups of 4 apples
//               item: kula apple stjarna kaka fisk blomma penna; mode "dela" deals the things out one at a time; remainder is what is left over
//   tiobas      { value, total }                           base ten blocks for a number up to 9999: thousands, hundreds, tens and ones
//   pengar      { items:[{value, n}], total }               Swedish coins (1, 2, 5, 10) and notes (20, 50, 100, 200, 500)
//   brak        { shape:"cirkel"|"rektangel", parts, shaded, compare:[{parts, shaded}] }   a whole in equal parts, some of them coloured
//   termometer  { value, min, max, step, label } | { values:[{value,label}] }   a thermometer, the mercury rises to the value (also below zero)
//   linjal      { length, from, max, object, label, hide }   a ruler in centimetres with an object laid against it
//   kalender    { year, month, days:[n], range:{from,to}, note }   a month with the days marked (the week begins on Monday)
//   tidslinje   { from:"09:20", to:"10:10", label, hide }  two times on a line, and the time between them
//   tarning     { values:[1..6] }                          dice with dots
//   snurra      { sectors:[{label, n}], land }              a spinner that turns and stops on sector number `land` (from 0)
//   pase        { items:[{color, n}], label }               a bag of marbles (rod, bla, gul, gron)
//   matglas     { capacity, level, unit, label, hide }       a measuring jug in litres (capacity) with decilitre marks, filled to `level` litres
//   stege       { rungs, marks:[{at, label, tone}], jumps:[{from, to, label}], numbered, pet, animate }   a ladder with the rungs numbered from the bottom; at is a rung or "mitten", a jump is an arrow up or down
//   volym       { w, h, d, unit, label }                     a block built of unit cubes, layer by layer (volume = w · h · d)

(function () {
  "use strict";
  const F = window.GaussicaFigures;
  if (!F || !F.register) return;
  const K = F.kit, s = K.s, text = K.text, svgRoot = K.svgRoot, wrap = K.wrap, fmt = K.fmt, delay = K.delay, animated = K.animated;

  const num = function (v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const int = function (v, lo, hi, d) { const n = Math.round(num(v, d)); return Math.max(lo, Math.min(hi, n)); };
  const SWEDISH_MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

  // the colours of the things: a class each (see styles.css, .fx-c0 ... .fx-c5)
  function tone(i) { return "fx-c" + (i % 6); }

  // ----- the things that are counted -----
  // One thing, drawn around (cx, cy) with the radius r, in a group of its own (so that it can move).
  function thing(parent, kind, cx, cy, r, cls, style) {
    const g = s("g", { "class": "fx-pop", style: style || "" }, parent);
    if (kind === "apple") {
      s("circle", { cx: cx, cy: cy + 1, r: r, "class": "fx-apple" }, g);
      s("path", { d: "M" + cx + " " + (cy - r + 2) + " q1 -" + (r * 0.5) + " " + (r * 0.5) + " -" + (r * 0.6), "class": "fx-stem" }, g);
      s("ellipse", { cx: cx + r * 0.45, cy: cy - r * 0.75, rx: r * 0.4, ry: r * 0.22, "class": "fx-leaf" }, g);
    } else if (kind === "stjarna") {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r * 1.1;
        pts.push((cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1));
      }
      s("polygon", { points: pts.join(" "), "class": "fx-star" }, g);
    } else if (kind === "kaka") {
      s("circle", { cx: cx, cy: cy, r: r, "class": "fx-cookie" }, g);
      [[-0.35, -0.3], [0.3, -0.35], [0, 0.1], [-0.3, 0.45], [0.4, 0.4]].forEach(function (d) { s("circle", { cx: cx + d[0] * r, cy: cy + d[1] * r, r: r * 0.14, "class": "fx-chip" }, g); });
    } else if (kind === "fisk") {
      s("ellipse", { cx: cx - r * 0.1, cy: cy, rx: r * 0.95, ry: r * 0.6, "class": "fx-fish" }, g);
      s("polygon", { points: (cx + r * 0.7) + "," + cy + " " + (cx + r * 1.2) + "," + (cy - r * 0.5) + " " + (cx + r * 1.2) + "," + (cy + r * 0.5), "class": "fx-fish" }, g);
      s("circle", { cx: cx - r * 0.55, cy: cy - r * 0.12, r: r * 0.1, "class": "fx-eye" }, g);
    } else if (kind === "blomma") {
      for (let i = 0; i < 5; i++) {
        const a = i * 2 * Math.PI / 5;
        s("circle", { cx: cx + r * 0.55 * Math.cos(a), cy: cy + r * 0.55 * Math.sin(a), r: r * 0.42, "class": "fx-petal" }, g);
      }
      s("circle", { cx: cx, cy: cy, r: r * 0.3, "class": "fx-heart" }, g);
    } else if (kind === "penna") {
      s("rect", { x: cx - r * 1.0, y: cy - r * 0.3, width: r * 1.6, height: r * 0.6, rx: 2, "class": "fx-pencil" }, g);
      s("polygon", { points: (cx + r * 0.6) + "," + (cy - r * 0.3) + " " + (cx + r * 1.1) + "," + cy + " " + (cx + r * 0.6) + "," + (cy + r * 0.3), "class": "fx-wood" }, g);
    } else {
      s("circle", { cx: cx, cy: cy, r: r, "class": "fx-ball " + cls }, g);
      s("circle", { cx: cx - r * 0.3, cy: cy - r * 0.3, r: r * 0.22, "class": "fx-shine" }, g);
    }
    return g;
  }

  // ----- equal groups -----
  function groups(c) {
    const n = int(c.groups, 1, 12, 3), per = int(c.per, 1, 20, 4), rest = int(c.remainder, 0, 19, 0);
    const kind = c.item || "kula";
    const dela = c.mode === "dela";
    const cols = per <= 4 ? per : per <= 8 ? 4 : 5;
    const rows = Math.ceil(per / cols);
    const cell = 30, pad = 10;
    const gw = cols * cell + pad * 2, gh = rows * cell + pad * 2;
    const gap = 14, W = 600;
    const perRow = Math.max(1, Math.floor((W + gap) / (gw + gap)));
    const lines = Math.ceil(n / perRow);
    const showText = c.show !== "ingen";
    const H = lines * (gh + gap) + (rest ? 8 + cell + pad * 2 : 0) + (showText ? 46 : 8);
    const total = n * per + rest;
    const svg = svgRoot(Object.assign({ alt: n + " grupper med " + per + " i varje" + (rest ? " och " + rest + " över" : "") }, c), W, H);
    const rowW = Math.min(n, perRow) * (gw + gap) - gap;
    const x0 = (W - rowW) / 2;
    for (let g = 0; g < n; g++) {
      const rowN = Math.floor(g / perRow), colN = g % perRow;
      const inRow = rowN === lines - 1 ? n - perRow * (lines - 1) : perRow;
      const rx = (W - (inRow * (gw + gap) - gap)) / 2 + colN * (gw + gap), ry = rowN * (gh + gap) + 4;
      s("rect", { x: rx, y: ry, width: gw, height: gh, rx: 16, "class": "fx-plate" }, svg);
      for (let k = 0; k < per; k++) {
        const cx = rx + pad + (k % cols) * cell + cell / 2, cy = ry + pad + Math.floor(k / cols) * cell + cell / 2;
        // dealing out: the things arrive one at a time, round and round; otherwise one group at a time
        const order = dela ? k * n + g : g * per + k;
        thing(svg, kind, cx, cy, 11, tone(g), delay(order, Math.min(dela ? 0.14 : 0.1, 2.6 / Math.max(1, n * per))));
      }
    }
    if (rest) {
      const ry = lines * (gh + gap) + 4, rw = rest * cell + pad * 2;
      s("rect", { x: (W - rw) / 2, y: ry, width: rw, height: cell + pad * 2, rx: 16, "class": "fx-plate is-rest" }, svg);
      text(svg, (W - rw) / 2 - 8, ry + (cell + pad * 2) / 2 + 5, "Rest", "fig-dim", "end");
      for (let k = 0; k < rest; k++) thing(svg, kind, (W - rw) / 2 + pad + k * cell + cell / 2, ry + pad + cell / 2, 11, "fx-c5", delay(n * per + k, Math.min(0.1, 2.6 / Math.max(1, n * per))));
    }
    if (showText) {
      const result = c.hide ? "?" : String(dela ? per : total);
      const line = dela
        ? total + " : " + n + " = " + result + (rest && !c.hide ? ", rest " + rest : "")
        : n + " · " + per + (rest ? " + " + rest : "") + " = " + (c.hide ? "?" : total);
      text(svg, W / 2, H - 12, line, "fig-dim fx-fade", "middle");
    }
    return animated(wrap([svg]));
  }

  // ----- base ten blocks -----
  function tiobas(c) {
    const v = int(c.value, 0, 9999, 0);
    const d = [Math.floor(v / 1000) % 10, Math.floor(v / 100) % 10, Math.floor(v / 10) % 10, v % 10];
    const names = ["tusental", "hundratal", "tiotal", "ental"];
    const W = 600, H = 236;
    const svg = svgRoot(Object.assign({ alt: "Positionssystemet: " + d[0] + " tusental, " + d[1] + " hundratal, " + d[2] + " tiotal och " + d[3] + " ental" }, c), W, H);
    const colW = W / 4;
    let order = 0;
    for (let col = 0; col < 4; col++) {
      const cx = col * colW + colW / 2;
      s("rect", { x: col * colW + 6, y: 6, width: colW - 12, height: H - 20, rx: 16, "class": "fx-plate" }, svg);
      text(svg, cx, 28, names[col], "fig-dim", "middle");
      const count = d[col];
      for (let k = 0; k < count; k++) {
        const g = s("g", { "class": "fx-pop", style: delay(order++, 0.08) }, svg);
        if (col === 0) {   // a thousand: a big cube
          const bx = col * colW + 14 + (k % 3) * 34, by = 44 + Math.floor(k / 3) * 40;
          s("rect", { x: bx + 6, y: by, width: 26, height: 26, rx: 3, "class": "fx-block is-back" }, g);
          s("rect", { x: bx, y: by + 6, width: 26, height: 26, rx: 3, "class": "fx-block is-thousand" }, g);
        } else if (col === 1) {   // a hundred: a flat of 10 x 10
          const bx = col * colW + 14 + (k % 3) * 42, by = 44 + Math.floor(k / 3) * 44;
          s("rect", { x: bx, y: by, width: 38, height: 38, rx: 3, "class": "fx-block is-hundred" }, g);
          for (let i = 1; i < 10; i++) {
            s("line", { x1: bx + i * 3.8, y1: by, x2: bx + i * 3.8, y2: by + 38, "class": "fx-blockgrid" }, g);
            s("line", { x1: bx, y1: by + i * 3.8, x2: bx + 38, y2: by + i * 3.8, "class": "fx-blockgrid" }, g);
          }
        } else if (col === 2) {   // a ten: a rod of 10
          const bx = col * colW + 14 + k * 13, by = 48;
          s("rect", { x: bx, y: by, width: 10, height: 130, rx: 3, "class": "fx-block is-ten" }, g);
          for (let i = 1; i < 10; i++) s("line", { x1: bx, y1: by + i * 13, x2: bx + 11, y2: by + i * 13, "class": "fx-blockgrid" }, g);
        } else {   // a one: a small cube
          const bx = col * colW + 18 + (k % 3) * 24, by = 48 + Math.floor(k / 3) * 26;
          s("rect", { x: bx, y: by, width: 18, height: 18, rx: 3, "class": "fx-block is-one" }, g);
        }
      }
      text(svg, cx, H - 26, String(count), "fx-bignum", "middle");
    }
    const figure = wrap([svg]);
    if (c.total) {
      const p = document.createElement("p");
      p.className = "fig-caption";
      p.textContent = d.map(function (n, i) { return n + " " + names[i]; }).filter(function (t, i) { return d[i] > 0; }).join(" + ") + " = " + fmt(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      figure.appendChild(p);
    }
    return animated(figure);
  }

  // ----- Swedish money -----
  const COINS = { 1: 15, 2: 17, 5: 19, 10: 21 };
  const NOTES = { 20: "is-20", 50: "is-50", 100: "is-100", 200: "is-200", 500: "is-500" };

  function pengar(c) {
    const items = (Array.isArray(c.items) ? c.items : []).map(function (it) { return { value: int(it.value, 1, 1000, 1), n: int(it.n, 1, 20, 1) }; });
    const coins = [], notes = [];
    items.forEach(function (it) {
      for (let k = 0; k < it.n; k++) (NOTES[it.value] ? notes : coins).push(it.value);
    });
    const total = coins.concat(notes).reduce(function (a, b) { return a + b; }, 0);
    const W = 600, noteW = 84, noteH = 40;
    const noteCols = Math.max(1, Math.min(notes.length, 6)), noteRows = Math.ceil(notes.length / 6);
    const coinCols = Math.max(1, Math.min(coins.length, 12)), coinRows = Math.ceil(coins.length / 12);
    const H = 20 + (notes.length ? noteRows * (noteH + 12) : 0) + (coins.length ? coinRows * 50 + 8 : 0) + (c.total ? 34 : 0);
    const svg = svgRoot(Object.assign({ alt: "Pengar: " + total + " kronor" }, c), W, H);
    let y = 14, order = 0;
    notes.forEach(function (v, i) {
      const col = i % 6, row = Math.floor(i / 6);
      const inRow = row === noteRows - 1 ? notes.length - 6 * (noteRows - 1) : noteCols;
      const x = (W - (inRow * (noteW + 12) - 12)) / 2 + col * (noteW + 12), yy = y + row * (noteH + 12);
      const g = s("g", { "class": "fx-pop", style: delay(order++, 0.12) }, svg);
      s("rect", { x: x, y: yy, width: noteW, height: noteH, rx: 6, "class": "fx-note " + NOTES[v] }, g);
      s("rect", { x: x + 4, y: yy + 4, width: noteW - 8, height: noteH - 8, rx: 4, "class": "fx-noteframe" }, g);
      text(g, x + noteW / 2, yy + noteH / 2 + 6, v + " kr", "fx-notetext", "middle");
    });
    y += notes.length ? noteRows * (noteH + 12) : 0;
    coins.forEach(function (v, i) {
      const col = i % 12, row = Math.floor(i / 12);
      const inRow = row === coinRows - 1 ? coins.length - 12 * (coinRows - 1) : coinCols;
      const r = COINS[v] || 18;
      const cx = (W - (inRow * 46 - 4)) / 2 + col * 46 + 21, cy = y + row * 50 + 24;
      const g = s("g", { "class": "fx-pop", style: delay(order++, 0.12) }, svg);
      s("circle", { cx: cx, cy: cy, r: r, "class": "fx-coin" + (v === 10 ? " is-gold" : "") }, g);
      s("circle", { cx: cx, cy: cy, r: r - 3.5, "class": "fx-coinring" }, g);
      text(g, cx, cy + 5, String(v), "fx-cointext", "middle");
    });
    if (c.total) text(svg, W / 2, H - 10, "Tillsammans: " + total + " kr", "fig-dim fx-fade", "middle");
    return animated(wrap([svg]));
  }

  // ----- fractions -----
  function fractionText(parent, x, y, n, d) {
    text(parent, x, y - 8, String(n), "fig-dim", "middle");
    s("line", { x1: x - 12, y1: y - 3, x2: x + 12, y2: y - 3, "class": "fig-tick" }, parent);
    text(parent, x, y + 17, String(d), "fig-dim", "middle");
  }

  function brak(c) {
    const list = Array.isArray(c.compare) && c.compare.length ? c.compare : [{ parts: c.parts, shaded: c.shaded }];
    const shape = c.shape === "rektangel" ? "rektangel" : "cirkel";
    const k = Math.min(list.length, 4);
    const W = 600, H = 190;
    const svg = svgRoot(Object.assign({ alt: "Bråk: " + list.slice(0, k).map(function (p) { return int(p.shaded, 0, 24, 1) + " av " + int(p.parts, 1, 24, 4); }).join(" och ") }, c), W, H);
    list.slice(0, k).forEach(function (p, idx) {
      const parts = int(p.parts, 1, 24, 4), shaded = int(p.shaded, 0, parts, 1);
      const cx = (W / k) * (idx + 0.5), cy = 78, R = 62;
      if (shape === "cirkel") {
        for (let i = 0; i < parts; i++) {
          const a0 = -Math.PI / 2 + i * 2 * Math.PI / parts, a1 = -Math.PI / 2 + (i + 1) * 2 * Math.PI / parts;
          const d = parts === 1
            ? "M" + (cx - R) + " " + cy + " a" + R + " " + R + " 0 1 0 " + (2 * R) + " 0 a" + R + " " + R + " 0 1 0 -" + (2 * R) + " 0"
            : "M" + cx + " " + cy + " L" + (cx + R * Math.cos(a0)).toFixed(2) + " " + (cy + R * Math.sin(a0)).toFixed(2) +
              " A" + R + " " + R + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + (cx + R * Math.cos(a1)).toFixed(2) + " " + (cy + R * Math.sin(a1)).toFixed(2) + " Z";
          const on = i < shaded;
          s("path", { d: d, "class": "fx-slice" + (on ? " is-on fx-pop" : ""), style: on ? delay(i, 0.18) : "" }, svg);
        }
      } else {
        const bw = Math.min(190, W / k - 30), bh = 58, bx = cx - bw / 2, by = cy - bh / 2;
        for (let i = 0; i < parts; i++) {
          const on = i < shaded;
          s("rect", { x: bx + i * bw / parts, y: by, width: bw / parts, height: bh, "class": "fx-slice" + (on ? " is-on fx-pop" : ""), style: on ? delay(i, 0.18) : "" }, svg);
        }
        s("rect", { x: bx, y: by, width: bw, height: bh, "class": "fx-sliceframe" }, svg);
      }
      fractionText(svg, cx, 168, shaded, parts);
    });
    return animated(wrap([svg]));
  }

  // ----- thermometer -----
  // ----- a ladder: rungs numbered from the bottom, marks on the rungs and arrows for the ways up and down -----
  function stege(c) {
    const n = int(c.rungs, 2, 25, 11);
    const sp = n > 15 ? 14 : 20;
    const nj = Math.min(4, (c.jumps || []).length);
    const xl = 70 + Math.max(1, nj) * 62, xr = xl + 56, W = xr + 150, H = n * sp + 60, top = 30, bottom = H - 30;
    const svg = svgRoot(Object.assign({ alt: "En stege med " + n + " pinnar, numrerade nerifrån" }, c), W, H);
    const y = function (k) { return bottom - (k - 1) * (bottom - top) / (n - 1); };
    const rung = function (at) { return at === "mitten" ? (n + 1) / 2 : Math.max(1, Math.min(n, num(at, 1))); };
    s("line", { x1: xl, y1: top - 14, x2: xl, y2: bottom + 14, "class": "fx-rail" }, svg);
    s("line", { x1: xr, y1: top - 14, x2: xr, y2: bottom + 14, "class": "fx-rail" }, svg);
    for (let k = 1; k <= n; k++) {
      s("line", { x1: xl, y1: y(k), x2: xr, y2: y(k), "class": "fx-rung" }, svg);
      if (c.numbered !== false && n <= 17) text(svg, xl - 12, y(k) + 5, String(k), "fig-ticklabel", "end");
    }
    (c.jumps || []).slice(0, 4).forEach(function (j, i) {
      const x = xl - 58 - i * 62, from = y(rung(j.from)), to = y(rung(j.to)), dir = to < from ? 1 : -1;
      s("line", { x1: x, y1: from, x2: x, y2: to + dir * 10, "class": "fig-jump" }, svg);
      s("polygon", { points: x + "," + to + " " + (x - 7) + "," + (to + dir * 13) + " " + (x + 7) + "," + (to + dir * 13), "class": "fig-arrow" }, svg);
      if (j.label) text(svg, x - 9, (from + to) / 2 + 5, j.label, "fig-dim", "end");
    });
    (c.marks || []).forEach(function (m) {
      const at = rung(m.at);
      s("circle", { cx: (xl + xr) / 2, cy: y(at), r: 8, "class": "fig-point" + (m.tone === "coral" ? " is-q" : "") }, svg);
      if (m.label) text(svg, xr + 18, y(at) + 5, m.label, "fig-dim", "start");
    });
    const figure = wrap([svg]);
    if (!c.pet) return figure;
    // the pet (or a marker) climbs from rung to rung along the arrows
    const out = c.animate ? animated(figure) : figure;
    const cx0 = (xl + xr) / 2;
    const g = K.walker(svg, c, 66);
    const route = (c.jumps || []).slice(0, 8).map(function (j) {
      return { x1: cx0, y1: y(rung(j.from)) + 4, x2: cx0, y2: y(rung(j.to)) + 4, h: 5, ms: 340 + 110 * Math.abs(rung(j.to) - rung(j.from)) };
    });
    if (!route.length) { const at = c.marks && c.marks.length ? rung(c.marks[0].at) : 1; route.push({ x1: cx0, y1: y(at) + 4, x2: cx0, y2: y(at) + 4, h: 0 }); }
    K.attachWalk(out, g, route, 600, 300, c.animate);
    return out;
  }

  // ----- a map in a grid: rows are letters, columns are numbers; the pet walks a path of squares -----
  function karta(c) {
    const rows = int(c.rows, 1, 8, 3), cols = int(c.cols, 2, 10, 4);
    const cs = cols > 7 ? 52 : 66, left = 34, top = 38;
    const W = left + cols * cs + 12, H = top + rows * cs + 12;
    const svg = svgRoot(Object.assign({ alt: "En karta med " + rows + " rader (A till " + String.fromCharCode(64 + rows) + ") och " + cols + " kolumner" }, c), W, H);
    const spot = function (id) {
      const m = /^([A-Ha-h])(\d{1,2})$/.exec(String(id));
      return m ? { r: m[1].toUpperCase().charCodeAt(0) - 65, k: Number(m[2]) - 1 } : null;
    };
    const px = function (k) { return left + k * cs + cs / 2; }, py = function (r) { return top + r * cs + cs / 2; };
    const path = (Array.isArray(c.path) ? c.path : []).map(spot).filter(function (p) { return p && p.r >= 0 && p.r < rows && p.k >= 0 && p.k < cols; });
    for (let k = 0; k < cols; k++) text(svg, px(k), top - 12, String(k + 1), "fig-dim");
    for (let r = 0; r < rows; r++) text(svg, left - 16, py(r) + 6, String.fromCharCode(65 + r), "fig-dim");
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const first = path.length && path[0].r === r && path[0].k === k, goal = path.length > 1 && path[path.length - 1].r === r && path[path.length - 1].k === k;
      s("rect", { x: left + k * cs + 1, y: top + r * cs + 1, width: cs - 2, height: cs - 2, rx: 8, "class": "fx-kartacell" + (first ? " is-start" : goal ? " is-goal" : "") }, svg);
    }
    const names = c.cells || {};
    Object.keys(names).forEach(function (id) {
      const p = spot(id);
      if (p && p.r < rows && p.k < cols) text(svg, px(p.k), py(p.r) - cs * 0.24, String(names[id]), "fig-ticklabel fx-celllabel");
    });
    svg.style.maxWidth = Math.min(520, Math.round(W * 1.4)) + "px";
    const figure = wrap([svg]);
    if (path.length < 2) return figure;
    s("path", { d: "M" + path.map(function (p) { return px(p.k) + " " + py(p.r); }).join(" L"), fill: "none", "class": "fig-dash" }, svg);
    const out = c.animate ? animated(figure) : figure;
    const g = K.walker(svg, c, cs * 0.95);
    const route = path.slice(1).map(function (p, i) {
      const q = path[i];
      return { x1: px(q.k), y1: py(q.r) + cs * 0.36, x2: px(p.k), y2: py(p.r) + cs * 0.36, h: 9, ms: 520 };
    });
    K.attachWalk(out, g, route, 520, 300, c.animate);
    return out;
  }

  // ----- the digits of a number slide one place to the left (times 10, 100, 1000) or to the right (divided by 10, 100, 1000) -----
  function skift(c) {
    const value = Math.max(0, Math.round(num(c.value, 34)));
    const places = int(c.places, 1, 4, 1);
    const toLeft = c.dir !== "hoger";
    const digits = String(value).split("");
    const n = digits.length;
    const kept = toLeft ? digits : digits.slice(0, Math.max(0, n - places));
    const resultLen = toLeft ? n + places : Math.max(1, kept.length);
    const cols = Math.min(8, Math.max(4, toLeft ? n + places : n));
    const cw = 62, ch = 62, x0 = 16, top = 40, W = x0 * 2 + cols * cw, H = top + ch + 130;
    const NAMES = ["ental", "tiotal", "hundratal", "tusental", "tiotusental", "hundratusental", "miljontal", "tiomiljontal"];
    const svg = svgRoot(Object.assign({ alt: toLeft ? fmt(value) + " gånger " + Math.pow(10, places) + ": siffrorna flyttas " + places + " steg åt vänster och nollor fylls på" : fmt(value) + " delat med " + Math.pow(10, places) + ": siffrorna flyttas " + places + " steg åt höger" }, c), W, H);
    const colX = function (fromRight) { return x0 + (cols - 1 - fromRight) * cw; };
    for (let k = 0; k < cols; k++) {
      s("rect", { x: colX(k) + 2, y: top - 4, width: cw - 4, height: ch + 8, rx: 10, "class": "fx-placecol" + (k % 2 ? " is-odd" : "") }, svg);
      if (c.labels !== false) text(svg, colX(k) + cw / 2, top - 12, NAMES[k], "fx-placename");
    }
    const digit = function (parent, ch2, fromRight, cls, style) {
      const g = s("g", { "class": cls, style: style || "" }, parent);
      s("rect", { x: colX(fromRight) + 7, y: top + 5, width: cw - 14, height: ch - 10, rx: 9, "class": "fx-digitbox" + (ch2 === "0" ? " is-zero" : "") }, g);
      text(g, colX(fromRight) + cw / 2, top + ch / 2 + 11, ch2, "fx-digit");
      return g;
    };
    const dx = (toLeft ? 1 : -1) * places * cw;       // where the digits came from, in relation to where they are drawn
    if (toLeft) {
      digits.forEach(function (d, i) { digit(svg, d, (n - 1 - i) + places, "fx-shift", "--dx:" + dx + "px"); });
      for (let k = 0; k < places; k++) digit(svg, "0", k, "fx-pop", "--d:" + (1.25 + k * 0.25) + "s");   // the zeros come when the digits have moved
    } else {
      kept.forEach(function (d, i) { digit(svg, d, kept.length - 1 - i, "fx-shift", "--dx:" + dx + "px"); });
      digits.slice(kept.length).forEach(function (d, i) { digit(svg, d, places - 1 - i, "fx-leave", ""); });
    }
    const result = toLeft ? String(value) + new Array(places + 1).join("0") : (kept.join("") || "0");
    const sum = toLeft ? fmt(value) + " · " + Math.pow(10, places) + " = " + result : fmt(value) + "/" + Math.pow(10, places) + " = " + result;
    text(svg, W / 2, top + ch + 110, sum, "fig-dim fx-fade");
    const zeros = places === 1 ? "en nolla" : ["", "", "två nollor", "tre nollor", "fyra nollor"][places];
    text(svg, W / 2, top + ch + 134, toLeft ? "Siffrorna flyttar " + places + (places === 1 ? " plats" : " platser") + " åt vänster och " + zeros + " fylls på" : "Siffrorna flyttar " + places + (places === 1 ? " plats" : " platser") + " åt höger och " + zeros + " försvinner", "fig-ticklabel fx-fade");
    const figure = wrap([svg]);
    const out = c.animate !== false ? animated(figure) : figure;
    if (c.pet) {
      // the pet goes along under the number, from where it was to where it is
      const g = K.walker(svg, c, 74);
      const fromC = x0 + (cols - n / 2) * cw, toC = x0 + (cols - resultLen / 2) * cw, y = top + ch + 74;
      K.attachWalk(out, g, [{ x1: fromC, y1: y, x2: toC, y2: y, h: 6, ms: 900 }], 900, 350, c.animate !== false);
    }
    return out;
  }

  // ----- a price shared out: the whole price as a bar, cut into as many pieces as there are things, a price tag on each -----
  function styckpris(c) {
    const n = int(c.n, 2, 10, 4);
    const total = num(c.total, 48);
    const per = total / n;
    const unit = c.unit !== undefined ? String(c.unit) : "kr";
    const kind = c.item || "apple";
    const W = 460, L = 30, R = 30, barY = 34, barH = 38, H = 232;
    const svg = svgRoot(Object.assign({ alt: n + " saker kostar tillsammans " + fmt(total) + " " + unit + ", så en kostar " + fmt(per) + " " + unit }, c), W, H);
    const seg = (W - L - R) / n;
    s("rect", { x: L, y: barY, width: W - L - R, height: barH, rx: 12, "class": "fx-pricebar" }, svg);
    for (let i = 1; i < n; i++) s("line", { x1: L + i * seg, y1: barY + 4, x2: L + i * seg, y2: barY + barH - 4, "class": "fx-pricecut fx-fade" }, svg);
    text(svg, W / 2, barY - 9, fmt(total) + " " + unit + " tillsammans", "fig-dim fx-pricetotal");
    for (let i = 0; i < n; i++) {
      const cx = L + i * seg + seg / 2;
      s("line", { x1: cx, y1: barY + barH, x2: cx, y2: 106, "class": "fx-pricelink fx-fade" }, svg);
      thing(svg, kind, cx, 122, Math.min(20, seg * 0.36), "", delay(i, 0.18));
      const g = s("g", { "class": "fx-pop", style: delay(i, 0.18) }, svg);
      s("rect", { x: cx - Math.min(36, seg * 0.46), y: 154, width: Math.min(72, seg * 0.92), height: 28, rx: 14, "class": "fx-pricetag" }, g);
      text(g, cx, 174, fmt(per) + " " + unit, "fig-ticklabel fx-pricetext");
    }
    text(svg, W / 2, 216, fmt(total) + "/" + n + " = " + fmt(per) + " " + unit + " för en", "fig-dim fx-fade");
    return animated(wrap([svg]));
  }

  function termometer(c) {
    const list = Array.isArray(c.values) && c.values.length ? c.values : [{ value: c.value, label: c.label }];
    const vals = list.map(function (t) { return num(t.value, 0); });
    const min = c.min !== undefined ? num(c.min, -10) : Math.min(-5, Math.floor(Math.min.apply(null, vals) / 5) * 5);
    const max = c.max !== undefined ? num(c.max, 30) : Math.max(10, Math.ceil(Math.max.apply(null, vals) / 5) * 5);
    const step = num(c.step, 5) > 0 ? num(c.step, 5) : 5;
    const k = Math.min(list.length, 3);
    const W = Math.max(300, 200 * k), H = 280, top = 22, bottom = 232;
    const svg = svgRoot(Object.assign({ alt: "Termometer: " + list.slice(0, k).map(function (t) { return fmt(num(t.value, 0)) + " grader"; }).join(" och ") }, c), W, H);
    const y = function (v) { return bottom - (v - min) / (max - min) * (bottom - top); };
    list.slice(0, k).forEach(function (t, idx) {
      const v = num(t.value, 0), cx = (W / k) * (idx + 0.5) + (idx === 0 && k === 1 ? -30 : 0);
      s("rect", { x: cx - 11, y: top - 8, width: 22, height: bottom - top + 28, rx: 11, "class": "fx-tube" }, svg);
      s("circle", { cx: cx, cy: bottom + 20, r: 20, "class": "fx-tube" }, svg);
      const warm = v >= 0;
      const m = s("rect", { x: cx - 6, y: y(v), width: 12, height: bottom + 20 - y(v), rx: 6, "class": "fx-mercury fx-rise" + (warm ? "" : " is-cold") }, svg);
      m.setAttribute("style", "--dur:1.6s");
      s("circle", { cx: cx, cy: bottom + 20, r: 15, "class": "fx-mercury" + (warm ? "" : " is-cold") }, svg);
      for (let g = Math.ceil(min / step) * step; g <= max + 1e-9; g += step) {
        s("line", { x1: cx + 14, y1: y(g), x2: cx + 24, y2: y(g), "class": g === 0 ? "fig-axis" : "fig-tick" }, svg);
        text(svg, cx + 30, y(g) + 5, fmt(g).replace("-", "−"), "fig-ticklabel", "start");
      }
      if (min < 0 && max > 0 && idx === 0) s("line", { x1: cx + 14, y1: y(0), x2: cx - 14, y2: y(0), "class": "fx-zeroline" }, svg);
      const label = t.label !== undefined ? t.label : fmt(v).replace("-", "−") + " °C";
      text(svg, cx - 24, y(v) + 5, label, "fig-dim fx-fade", "end");
    });
    return animated(wrap([svg]));
  }

  // ----- ruler -----
  function linjal(c) {
    const length = Math.max(0.5, num(c.length, 6)), from = Math.max(0, num(c.from, 0));
    const max = Math.max(Math.ceil(from + length) + 1, int(c.max, 5, 30, 0) || 0);
    const W = 600, L = 24, R = 24, H = 170;
    const x = function (cm) { return L + cm / max * (W - L - R); };
    const svg = svgRoot(Object.assign({ alt: "En linjal med ett föremål som är " + fmt(length) + " cm" }, c), W, H);
    const top = 96;
    s("rect", { x: L - 10, y: top, width: W - L - R + 20, height: 56, rx: 8, "class": "fx-ruler" }, svg);
    for (let mm = 0; mm <= max * 10; mm++) {
      const cm = mm / 10, whole = mm % 10 === 0, half = mm % 5 === 0;
      s("line", { x1: x(cm), y1: top, x2: x(cm), y2: top + (whole ? 24 : half ? 17 : 10), "class": whole ? "fig-tick" : "fig-grid" }, svg);
      if (whole) text(svg, x(cm), top + 44, String(mm / 10), "fig-ticklabel", "middle");
    }
    const objKind = c.object || "penna";
    const ox = x(from), ow = x(from + length) - ox;
    const g = s("g", { "class": "fx-slide" }, svg);
    if (objKind === "sladd") {
      s("path", { d: "M" + ox + " 58 q" + ow * 0.25 + " -18 " + ow * 0.5 + " 0 t" + ow * 0.5 + " 0", "class": "fx-rope" }, g);
    } else {
      s("rect", { x: ox, y: 44, width: Math.max(4, ow - 16), height: 26, rx: 3, "class": objKind === "suddgummi" ? "fx-eraser" : "fx-pencil" }, g);
      s("polygon", { points: (ox + Math.max(4, ow - 16)) + ",44 " + (ox + ow) + ",57 " + (ox + Math.max(4, ow - 16)) + ",70", "class": objKind === "suddgummi" ? "fx-eraser" : "fx-wood" }, g);
    }
    s("line", { x1: ox, y1: 38, x2: ox, y2: top, "class": "fig-dash" }, svg);
    s("line", { x1: ox + ow, y1: 38, x2: ox + ow, y2: top, "class": "fig-dash" }, svg);
    text(svg, ox + ow / 2, 28, c.hide ? "? cm" : (c.label || fmt(length) + " cm"), "fig-dim fx-fade", "middle");
    return animated(wrap([svg]));
  }

  // ----- calendar -----
  function kalender(c) {
    const year = int(c.year, 1900, 2200, new Date().getFullYear()), month = int(c.month, 1, 12, 1) - 1;
    const first = (new Date(year, month, 1).getDay() + 6) % 7;   // Monday = 0
    const days = new Date(year, month + 1, 0).getDate();
    const marked = (Array.isArray(c.days) ? c.days : []).map(Number);
    const range = c.range && Number.isFinite(Number(c.range.from)) ? { from: Number(c.range.from), to: Number(c.range.to) } : null;
    const weeks = Math.ceil((first + days) / 7);
    const W = 420, cw = 54, ch = 38, top = 74, H = top + weeks * ch + (c.note ? 36 : 14);
    const svg = svgRoot(Object.assign({ alt: SWEDISH_MONTHS[month] + " " + year }, c), W, H);
    const x0 = (W - 7 * cw) / 2;
    text(svg, W / 2, 28, SWEDISH_MONTHS[month] + " " + year, "fig-dim", "middle");
    ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"].forEach(function (d, i) { text(svg, x0 + i * cw + cw / 2, 58, d, "fig-ticklabel" + (i >= 5 ? " fx-weekend" : ""), "middle"); });
    for (let d = 1; d <= days; d++) {
      const idx = first + d - 1, col = idx % 7, row = Math.floor(idx / 7);
      const cx = x0 + col * cw + cw / 2, cy = top + row * ch + ch / 2;
      const inRange = range && d >= range.from && d <= range.to;
      if (inRange) s("rect", { x: x0 + col * cw + 2, y: top + row * ch + 3, width: cw - 4, height: ch - 6, rx: 8, "class": "fx-daybg" }, svg);
      const on = marked.indexOf(d) >= 0;
      if (on) s("circle", { cx: cx, cy: cy, r: 16, "class": "fx-day fx-pop", style: delay(marked.indexOf(d), 0.3) }, svg);
      text(svg, cx, cy + 5, String(d), "fig-ticklabel" + (on ? " fx-daymarked" : "") + (col >= 5 ? " fx-weekend" : ""), "middle");
    }
    if (c.note) text(svg, W / 2, H - 12, c.note, "fig-dim", "middle");
    return animated(wrap([svg]));
  }

  // ----- time between two clock times -----
  function minutesOf(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function clockText(min) { return Math.floor(min / 60) + ":" + ("0" + (min % 60)).slice(-2); }

  function tidslinje(c) {
    const a = minutesOf(c.from), b = minutesOf(c.to);
    if (a === null || b === null || b <= a) return null;
    const h0 = Math.floor(a / 60), h1 = Math.ceil(b / 60);
    const W = 600, L = 40, R = 40, H = 150, y0 = 84;
    const x = function (min) { return L + (min - h0 * 60) / ((h1 - h0) * 60) * (W - L - R); };
    const svg = svgRoot(Object.assign({ alt: "Från " + clockText(a) + " till " + clockText(b) + ": " + (b - a) + " minuter" }, c), W, H);
    s("line", { x1: L - 10, y1: y0, x2: W - R + 10, y2: y0, "class": "fig-axis" }, svg);
    for (let h = h0; h <= h1; h++) {
      s("line", { x1: x(h * 60), y1: y0 - 10, x2: x(h * 60), y2: y0 + 10, "class": "fig-tick" }, svg);
      text(svg, x(h * 60), y0 + 30, clockText(h * 60), "fig-ticklabel", "middle");
      if (h < h1) for (let q = 1; q < 4; q++) s("line", { x1: x(h * 60 + q * 15), y1: y0 - 5, x2: x(h * 60 + q * 15), y2: y0 + 5, "class": "fig-grid" }, svg);
    }
    const len = Math.round(x(b) - x(a));
    s("rect", { x: x(a), y: y0 - 6, width: len, height: 12, rx: 6, "class": "fig-range fx-draw", style: "--len:" + len + "px;--dur:1.4s" }, svg);
    [a, b].forEach(function (m, i) {
      s("circle", { cx: x(m), cy: y0, r: 8, "class": "fig-point" + (i ? " is-q" : "") }, svg);
      text(svg, x(m), y0 - 22, clockText(m), "fig-dim", "middle");
    });
    text(svg, (x(a) + x(b)) / 2, y0 - 50, c.hide ? "? minuter" : (c.label || (b - a) + " minuter"), "fig-jumplabel fx-fade", "middle");
    return animated(wrap([svg]));
  }

  // ----- dice -----
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

  function tarning(c) {
    const vals = (Array.isArray(c.values) ? c.values : [3]).map(function (v) { return int(v, 1, 6, 1); }).slice(0, 8);
    const size = 64, gap = 18, W = Math.max(200, vals.length * (size + gap) + gap), H = size + 40;
    const svg = svgRoot(Object.assign({ alt: "Tärningar: " + vals.join(", ") }, c), W, H);
    vals.forEach(function (v, i) {
      const x = gap + i * (size + gap), y = 20;
      const g = s("g", { "class": "fx-pop", style: delay(i, 0.2) }, svg);
      s("rect", { x: x, y: y, width: size, height: size, rx: 12, "class": "fx-die" }, g);
      PIPS[v].forEach(function (p) { s("circle", { cx: x + size / 2 + p[0] * 17, cy: y + size / 2 + p[1] * 17, r: 6, "class": "fx-pip" }, g); });
    });
    return animated(wrap([svg]));
  }

  // ----- spinner -----
  function snurra(c) {
    const secs = (Array.isArray(c.sectors) && c.sectors.length ? c.sectors : [{ label: "A" }, { label: "B" }, { label: "C" }, { label: "D" }]).slice(0, 12);
    const weights = secs.map(function (x) { return int(x.n, 1, 12, 1); });
    const sum = weights.reduce(function (a, b) { return a + b; }, 0);
    const land = int(c.land, 0, secs.length - 1, 0);
    const W = 360, H = 300, cx = W / 2, cy = 160, R = 110;
    const svg = svgRoot(Object.assign({ alt: "Ett lyckohjul med " + secs.length + " fält" }, c), W, H);
    const wheel = s("g", { "class": "fx-spin" }, svg);
    let at = -Math.PI / 2, landMid = 0;
    const labels = [];
    secs.forEach(function (sec, i) {
      const span = weights[i] / sum * 2 * Math.PI, a0 = at, a1 = at + span;
      const d = secs.length === 1
        ? "M" + (cx - R) + " " + cy + " a" + R + " " + R + " 0 1 0 " + (2 * R) + " 0 a" + R + " " + R + " 0 1 0 -" + (2 * R) + " 0"
        : "M" + cx + " " + cy + " L" + (cx + R * Math.cos(a0)).toFixed(2) + " " + (cy + R * Math.sin(a0)).toFixed(2) +
          " A" + R + " " + R + " 0 " + (span > Math.PI ? 1 : 0) + " 1 " + (cx + R * Math.cos(a1)).toFixed(2) + " " + (cy + R * Math.sin(a1)).toFixed(2) + " Z";
      s("path", { d: d, "class": "fx-sector " + tone(i) }, wheel);
      const mid = (a0 + a1) / 2;
      if (i === land) landMid = mid;
      const label = text(wheel, cx + R * 0.62 * Math.cos(mid), cy + R * 0.62 * Math.sin(mid) + 5, String(sec.label === undefined ? "" : sec.label), "fx-sectortext fx-unspin", "middle");
      labels.push(label);
      at = a1;
    });
    // the wheel turns three times and a bit, so that the middle of the sector `land` ends up under the pointer (at the top)
    const turn = 360 * 3 + (-(landMid + Math.PI / 2) * 180 / Math.PI);
    wheel.setAttribute("style", "--turn:" + Math.round(turn * 10) / 10 + "deg;transform-box:view-box;transform-origin:" + cx + "px " + cy + "px;transform:rotate(" + Math.round((turn % 360) * 10) / 10 + "deg)");
    // the words on the wheel stay the right way up while it turns: they turn the other way by as much
    labels.forEach(function (l) { l.setAttribute("style", "--turn-neg:" + (-Math.round(turn * 10) / 10) + "deg;transform:rotate(" + (-Math.round((turn % 360) * 10) / 10) + "deg)"); });
    s("circle", { cx: cx, cy: cy, r: 9, "class": "fig-point" }, svg);
    s("polygon", { points: (cx - 11) + ",30 " + (cx + 11) + ",30 " + cx + ",56", "class": "fx-pointer" }, svg);
    return animated(wrap([svg]));
  }

  // ----- bag of marbles -----
  const MARBLE = { rod: "fx-m-red", bla: "fx-m-blue", gul: "fx-m-yellow", gron: "fx-m-green" };

  function pase(c) {
    const items = (Array.isArray(c.items) ? c.items : [{ color: "rod", n: 3 }]).map(function (it) { return { color: MARBLE[it.color] ? it.color : "rod", n: int(it.n, 0, 20, 1) }; });
    const marbles = [];
    items.forEach(function (it) { for (let k = 0; k < it.n; k++) marbles.push(it.color); });
    const W = 420, H = 230, cx = W / 2;
    const svg = svgRoot(Object.assign({ alt: "En påse med " + items.map(function (it) { return it.n + " " + it.color + (it.n === 1 ? " kula" : " kulor"); }).join(", ") }, c), W, H);
    s("path", { d: "M" + (cx - 40) + " 40 Q" + (cx - 100) + " 70 " + (cx - 105) + " 150 Q" + (cx - 105) + " 205 " + cx + " 205 Q" + (cx + 105) + " 205 " + (cx + 105) + " 150 Q" + (cx + 100) + " 70 " + (cx + 40) + " 40 Z", "class": "fx-bag" }, svg);
    s("path", { d: "M" + (cx - 40) + " 40 q40 22 80 0", "class": "fx-bagtie" }, svg);
    const cols = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(marbles.length * 1.6))));
    marbles.forEach(function (col, i) {
      const row = Math.floor(i / cols), inRow = Math.min(cols, marbles.length - row * cols);
      const x = cx - ((inRow - 1) * 34) / 2 + (i % cols) * 34, y = 166 - row * 34;
      const g = s("g", { "class": "fx-pop", style: delay(i, 0.1) }, svg);
      s("circle", { cx: x, cy: y, r: 15, "class": "fx-marble " + MARBLE[col] }, g);
      s("circle", { cx: x - 5, cy: y - 5, r: 4, "class": "fx-shine" }, g);
    });
    if (c.label) text(svg, W / 2, H - 4, c.label, "fig-dim", "middle");
    return animated(wrap([svg]));
  }

  // ----- measuring jug -----
  function matglas(c) {
    const cap = Math.max(0.5, Math.min(5, num(c.capacity, 1)));
    const level = Math.max(0, Math.min(cap, num(c.level, cap / 2)));
    const W = 360, H = 330, x0 = 110, x1 = 250, top = 40, bottom = 280;
    const y = function (l) { return bottom - l / cap * (bottom - top); };
    const svg = svgRoot(Object.assign({ alt: "Ett måttglas som rymmer " + fmt(cap) + " liter, fyllt till " + fmt(Math.round(level * 100) / 10) + " deciliter" }, c), W, H);
    s("path", { d: "M" + (x0 - 8) + " " + (top - 8) + " L" + x0 + " " + top + " L" + x0 + " " + bottom + " Q" + x0 + " " + (bottom + 14) + " " + (x0 + 14) + " " + (bottom + 14) + " L" + (x1 - 14) + " " + (bottom + 14) + " Q" + x1 + " " + (bottom + 14) + " " + x1 + " " + bottom + " L" + x1 + " " + top + " L" + (x1 + 8) + " " + (top - 8), "class": "fx-glass" }, svg);
    s("path", { d: "M" + x1 + " " + (top + 30) + " q42 4 42 40 t-42 60", "class": "fx-handle" }, svg);
    if (level > 0) s("rect", { x: x0 + 3, y: y(level), width: x1 - x0 - 6, height: bottom + 12 - y(level), rx: 6, "class": "fx-water fx-rise" }, svg).setAttribute("style", "--dur:1.5s");
    const dl = Math.round(cap * 10);
    for (let i = 0; i <= dl; i++) {
      const yy = y(i / 10), major = i % 5 === 0 || i === dl;
      s("line", { x1: x0, y1: yy, x2: x0 + (major ? 26 : 14), y2: yy, "class": major ? "fig-tick" : "fig-grid" }, svg);
      if (i % 2 === 0 || major) text(svg, x0 - 8, yy + 4, i % 10 === 0 ? (i / 10) + " l" : i + " dl", "fig-ticklabel", "end");
    }
    text(svg, (x0 + x1) / 2, H - 8, c.hide ? "? dl" : (c.label || fmt(Math.round(level * 100) / 10) + " dl"), "fig-dim fx-fade", "middle");
    return animated(wrap([svg]));
  }

  // ----- block of unit cubes -----
  function volym(c) {
    const w = int(c.w, 1, 8, 3), h = int(c.h, 1, 8, 2), d = int(c.d, 1, 8, 2);
    const u = Math.min(34, 300 / (w + d * 0.6), 220 / (h + d * 0.6)), dx = u * 0.5, dy = u * 0.35;
    const W = w * u + d * dx + 120, H = h * u + d * dy + 90;
    const svg = svgRoot(Object.assign({ alt: "En kloss av kuber: " + w + " långa, " + d + " djupa och " + h + " höga, " + w * h * d + " kuber" }, c), W, H);
    const ox = 20, oy = d * dy + 20;
    // layer by layer from the bottom, and in each layer the back first, so that the front covers the back
    let n = 0;
    for (let layer = 0; layer < h; layer++) {
      for (let k = d - 1; k >= 0; k--) {
        for (let i = 0; i < w; i++) {
          const x = ox + i * u + k * dx, y = oy + (h - 1 - layer) * u + (d - 1 - k) * dy - (d - 1) * dy + (d - 1) * dy;
          const g = s("g", { "class": "fx-pop", style: delay(n++, Math.min(0.06, 2.6 / (w * h * d))) }, svg);
          s("rect", { x: x, y: y, width: u, height: u, "class": "fx-cube-front" }, g);
          s("polygon", { points: x + "," + y + " " + (x + dx) + "," + (y - dy) + " " + (x + u + dx) + "," + (y - dy) + " " + (x + u) + "," + y, "class": "fx-cube-top" }, g);
          s("polygon", { points: (x + u) + "," + y + " " + (x + u + dx) + "," + (y - dy) + " " + (x + u + dx) + "," + (y + u - dy) + " " + (x + u) + "," + (y + u), "class": "fx-cube-side" }, g);
        }
      }
    }
    const unit = c.unit || "cm";
    text(svg, ox + w * u / 2, H - 38, w + " " + unit, "fig-dim", "middle");
    text(svg, ox + w * u + d * dx + 14, oy + h * u / 2, h + " " + unit, "fig-dim", "start");
    text(svg, ox + w * u + d * dx * 0.55 + 18, oy - 4, d + " " + unit, "fig-dim", "start");
    text(svg, W / 2, H - 10, c.label || (w + " · " + h + " · " + d + " = " + w * h * d + " kuber"), "fig-dim fx-fade", "middle");
    return animated(wrap([svg]));
  }

  F.register("matglas", "MÅTTGLAS", matglas);
  F.register("volym", "VOLYM", volym);
  F.register("stege", "STEGE", stege);
  F.register("karta", "KARTA", karta);
  F.register("skift", "PLATSVÄRDE", skift);
  F.register("styckpris", "PRIS", styckpris);
  F.register("grupper", "GRUPPER", groups);
  F.register("tiobas", "PLATSVÄRDE", tiobas);
  F.register("pengar", "PENGAR", pengar);
  F.register("brak", "BRÅK", brak);
  F.register("termometer", "TERMOMETER", termometer);
  F.register("linjal", "LINJAL", linjal);
  F.register("kalender", "KALENDER", kalender);
  F.register("tidslinje", "TIDSLINJE", tidslinje);
  F.register("tarning", "TÄRNING", tarning);
  F.register("snurra", "LYCKOHJUL", snurra);
  F.register("pase", "PÅSE", pase);
}());
